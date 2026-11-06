import { getPlayer, setPlayer } from "../character/player";
import {
  addGatheringExp, GATHERING_PROFESSIONS, getGatheringLevel, getGatheringRates, getGatheringTier,
} from "../character/gathering";
import { CRAFTING_MATERIALS, REGION_TIERS } from "../items/craftingMaterials";
import { MATERIALS } from "../items/materials";
import { REGIONS } from "./regions";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const fail = (message) => ({ ok: false, message });
const clock = () => performance.now();
let sequence = 0;
let attempt = null;
let notice = "";
export const GATHERING_HIT_RANGES = { mining: [6, 10], logging: [10, 16] };

export const getGatheringConfig = (player, activity) => {
  const definition = GATHERING_PROFESSIONS[activity];
  if (!definition) return null;
  const level = getGatheringLevel(player, activity);
  const equipped = player?.equipment?.[definition.slot];
  const tool = equipped?.slot === definition.slot && level >= Math.max(5, equipped.iLevel || 1)
    ? equipped : null;
  const rates = getGatheringRates(level);
  const sub = (key) => tool && Number.isFinite(tool.subStats?.[key]) ? Math.max(0, tool.subStats[key]) : 0;
  const power = tool?.mainStat?.stat === "gatheringPower" ? clamp(tool.mainStat.value || 1, 1, 50) : 1;
  const timing = Math.min(0.75, rates.timing + sub("gatheringTiming"));
  const slowdown = Math.min(0.4, sub("gatheringSlowdown"));
  const perfect = Math.min(0.75, rates.perfect + sub("gatheringPerfect"));
  const interval = Math.round((activity === "mining" ? 1850 : 700) * (1 + slowdown));
  return {
    activity, level, toolName: tool?.name || "Bare hands", hasTool: !!tool, power, maxTier: getGatheringTier(power),
    count: GATHERING_HIT_RANGES[activity][0], countdown: 1000, interval,
    window: activity === "mining" ? 0.14 * (1 + timing) : 130 * (1 + timing),
    perfect: activity === "mining" ? 0.027 * (1 + perfect) : 28 * (1 + perfect),
    yield: rates.yield + Math.min(1, sub("gatheringYield")),
    rarity: rates.rarity + Math.min(1, sub("gatheringRarity")),
    expBonus: Math.min(1, sub("gatheringExp")),
    bonusHarvest: rates.bonusHarvest, comboRoll: rates.comboRoll,
  };
};

export const getGatheringPool = (activity, region, config, score = 0) => {
  const family = GATHERING_PROFESSIONS[activity]?.family;
  const regionTier = REGION_TIERS.indexOf(region) + 1;
  if (!family || !regionTier || !config) return [];
  return Object.entries(CRAFTING_MATERIALS)
    .filter(([, material]) => material.family === family && material.tier <= config.maxTier)
    .map(([key, material]) => ({
      key, tier: material.tier,
      weight: (1 + (clamp(score, 0, 1) + config.rarity) * (material.tier - 1)) /
        (1 + Math.abs(material.tier - regionTier)),
    }));
};
const weightedMaterial = (pool, rng) => {
  let roll = rng() * pool.reduce((sum, entry) => sum + entry.weight, 0);
  return pool.find((entry) => (roll -= entry.weight) < 0)?.key || pool[pool.length - 1].key;
};
export const gatheringGrade = (score) =>
  score === 0 ? "Missed" : score < 0.4 ? "Rough" : score < 0.7 ? "Good" : score < 0.9 ? "Great" : "Perfect";

export const rollGatheringRewards = (player, activity, region, config, scores, rng = Math.random) => {
  const performance = scores.reduce((sum, value) => sum + clamp(value || 0, 0, 1), 0) / config.count;
  const lengthBonus = config.count / (activity === "mining" ? 5 : 8);
  const materials = {};
  const pool = getGatheringPool(activity, region, config, performance);
  let combo = 0;
  let bestCombo = 0;
  scores.forEach((value) => { combo = value >= 0.5 ? combo + 1 : 0; bestCombo = Math.max(bestCombo, combo); });
  if ((config.hasTool || performance > 0) && pool.length) {
    const key = pool.find(({ tier }) => tier === 1).key;
    materials[key] = Math.max(1, Math.floor((1 + 5 * performance) * lengthBonus * (1 + config.yield)));
    if (rng() < config.bonusHarvest) materials[key]++;
    if (performance > 0 && config.maxTier > 1) {
      const bonus = weightedMaterial(pool, rng);
      materials[bonus] = (materials[bonus] || 0) + Math.max(1, Math.floor(3 * performance * lengthBonus));
    }
    if (config.comboRoll && bestCombo >= 4) {
      const bonus = weightedMaterial(pool, rng);
      materials[bonus] = (materials[bonus] || 0) + 1;
    }
  }
  const onLevelTier = getGatheringTier(config.level);
  const penalty = Math.max(0.1, 1 - Math.max(0, onLevelTier - config.maxTier) * 0.2);
  const exp = Math.max(2, Math.round(lengthBonus * (performance === 0 ? 2 :
    100 * (1 + (config.maxTier - 1) * 0.5) * (0.25 + 1.75 * performance ** 2) * penalty * (1 + config.expBonus))));
  const progress = addGatheringExp(player, activity, exp);
  return { materials, exp, performance, grade: gatheringGrade(performance), bestCombo, ...progress };
};

export const getMiningMarker = (elapsed, config) => {
  const phase = ((Math.max(0, elapsed - config.countdown) % config.interval) / config.interval) * 2;
  return phase <= 1 ? phase : 2 - phase;
};
export const getGatheringDuration = (config) =>
  config.countdown + config.count * config.interval + (config.activity === "logging" ? config.window : 0);
export const getGatheringAttempt = () => attempt ? {
  ...attempt, config: attempt.config ? { ...attempt.config } : null,
  scores: [...attempt.scores], targets: [...attempt.targets],
} : null;

export const offerGathering = (player, region, activity = Math.random() < 0.5 ? "mining" : "logging", rng = Math.random) => {
  if (!GATHERING_PROFESSIONS[activity] || !REGIONS[region]) return fail("That gathering opportunity is unavailable.");
  if (attempt?.state === "active") return fail("Finish or leave your current gathering attempt first.");
  notice = "";
  const [min, max] = GATHERING_HIT_RANGES[activity];
  const config = { ...getGatheringConfig(player, activity), count: min + Math.floor(rng() * (max - min + 1)) };
  attempt = { id: `gather-${++sequence}`, activity, region, state: "offered", scores: [], targets: [], config };
  return { ok: true, id: attempt.id };
};
export const startGathering = (id, player = getPlayer(), now = clock(), rng = Math.random) => {
  if (!player) return fail("No character loaded.");
  if (attempt?.id !== id || attempt.state !== "offered") return fail("This gathering opportunity is no longer available.");
  const config = { ...getGatheringConfig(player, attempt.activity), count: attempt.config.count };
  attempt = {
    ...attempt, config, state: "active", startedAt: now,
    scores: Array(config.count).fill(null),
    targets: Array.from({ length: config.count }, () => 0.25 + rng() * 0.5),
  };
  return { ok: true };
};
export const forfeitGathering = (id, message = "You left the gathering opportunity. No rewards were granted.") => {
  if (!attempt || (id && attempt.id !== id) || !["offered", "active"].includes(attempt.state)) return;
  attempt.state = "forfeited";
  notice = message;
};
export const takeGatheringNotice = () => { const text = notice; notice = ""; return text; };

const expireInputs = (elapsed) => {
  const c = attempt.config;
  attempt.scores.forEach((value, index) => {
    const end = c.countdown + (index + 1) * c.interval + (c.activity === "logging" ? c.window : 0);
    if (value === null && elapsed >= end) attempt.scores[index] = 0;
  });
};
export const recordGatheringInput = (id, side, now = clock()) => {
  if (attempt?.id !== id || attempt.state !== "active") return fail("There is no active gathering attempt.");
  const c = attempt.config;
  const elapsed = now - attempt.startedAt;
  expireInputs(elapsed);
  if (elapsed < c.countdown) return { ok: true, ignored: true };
  const index = c.activity === "mining"
    ? Math.floor((elapsed - c.countdown) / c.interval)
    : clamp(Math.round((elapsed - c.countdown) / c.interval) - 1, 0, c.count - 1);
  if (index >= c.count || attempt.scores[index] !== null) return { ok: true, ignored: true };
  const distance = c.activity === "mining"
    ? Math.abs(getMiningMarker(elapsed, c) - attempt.targets[index])
    : Math.abs(elapsed - (c.countdown + (index + 1) * c.interval));
  const correct = c.activity === "mining" || side === (index % 2 ? "right" : "left");
  const score = !correct || distance >= c.window ? 0
    : distance <= c.perfect ? 1 : 1 - 0.8 * (distance - c.perfect) / (c.window - c.perfect);
  attempt.scores[index] = score;
  return { ok: true, score, index };
};
export const advanceGathering = (id, now = clock()) => {
  if (attempt?.id !== id || attempt.state !== "active") return fail("There is no active gathering attempt.");
  expireInputs(now - attempt.startedAt);
  return { ok: true, complete: attempt.scores.every((value) => value !== null) };
};
export const finishGathering = (id, now = clock()) => {
  if (attempt?.id !== id || attempt.state !== "active") return fail("This gathering reward was already claimed or forfeited.");
  expireInputs(now - attempt.startedAt);
  if (attempt.scores.some((value) => value === null)) return fail("Finish the gathering attempt first.");
  const player = getPlayer();
  if (!player) return fail("No character loaded.");
  const result = rollGatheringRewards(player, attempt.activity, attempt.region, attempt.config, attempt.scores);
  const materials = { ...(player.materials || {}) };
  for (const [key, count] of Object.entries(result.materials)) materials[key] = (materials[key] || 0) + count;
  attempt.state = "resolved";
  setPlayer({ materials, gathering: result.gathering });
  attempt.result = result;
  return { ok: true, ...result };
};
export const describeGatheringMaterials = (materials) =>
  Object.entries(materials).map(([key, count]) => `${count} ${MATERIALS[key].name}`).join(", ");
