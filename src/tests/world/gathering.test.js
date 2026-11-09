import { getPlayer, setPlayer } from "../../character/player";
import {
  advanceGathering, finishGathering, forfeitGathering, getGatheringAttempt, getGatheringConfig,
  getGatheringDuration, getGatheringPool, getGatheringTierChance, getMiningMarker, offerGathering, recordGatheringInput,
  rollGatheringRewards, startGathering,
} from "../../world/gathering";
import { REGION_TIERS, CRAFTING_MATERIALS } from "../../items/craftingMaterials";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
jest.mock("../../combat/combat", () => ({ getEnemy: jest.fn(() => null) }));

const hero = (activity = "mining", level = 50, power = 50, subStats = {}) => ({
  gathering: { [activity]: { level, exp: 0, attempts: 0 } },
  equipment: { [activity === "mining" ? "pickaxe" : "axe"]: {
    name: "Test tool", slot: activity === "mining" ? "pickaxe" : "axe", iLevel: level,
    mainStat: { stat: "gatheringPower", value: power }, subStats,
  } },
});
beforeEach(() => {
  forfeitGathering();
  jest.clearAllMocks();
  getPlayer.mockReturnValue({});
});

test.each(["mining", "logging"])("%s has all tool-unlocked tiers in every region, never above the cap", (activity) => {
  for (const region of REGION_TIERS) {
    const config = getGatheringConfig(hero(activity, 50, 22), activity);
    const pool = getGatheringPool(activity, region, config);
    expect(pool.map(({ tier }) => tier)).toEqual([1, 2, 3, 4]);
    expect(pool.every(({ weight }) => weight > 0)).toBe(true);
    const max = getGatheringConfig(hero(activity), activity);
    expect(getGatheringPool(activity, region, max).map(({ tier }) => tier)).toContain(7);
    const top = rollGatheringRewards(hero(activity), activity, region, max, Array(max.count).fill(1), () => 0.99999);
    expect(Object.keys(top.materials).some((key) => CRAFTING_MATERIALS[key].tier === 7)).toBe(true);
    const reward = rollGatheringRewards(hero(activity), activity, region, config, Array(config.count).fill(1), () => 0.99999);
    expect(Object.keys(reward.materials).every((key) => CRAFTING_MATERIALS[key].tier <= 4)).toBe(true);
  }
});

test("region preference, performance and rarity alter actual reward weights", () => {
  const config = getGatheringConfig(hero(), "mining");
  const meadow = getGatheringPool("mining", "Meadowlands", config, 0);
  const front = getGatheringPool("mining", "ShatteredFront", config, 0);
  expect(front[6].weight / front[0].weight).toBeGreaterThan(meadow[6].weight / meadow[0].weight);
  const skilled = getGatheringPool("mining", "Meadowlands", { ...config, rarity: config.rarity + 0.5 }, 1);
  expect(skilled[6].weight / skilled[0].weight).toBeGreaterThan(meadow[6].weight / meadow[0].weight);
  const good = rollGatheringRewards(hero(), "mining", "Meadowlands", config, Array(config.count).fill(1), () => 0);
  const rough = rollGatheringRewards(hero(), "mining", "Meadowlands", config, Array(config.count).fill(0.2), () => 0);
  expect(good.materials.metal_scraps).toBeGreaterThan(rough.materials.metal_scraps);
  expect(good.exp).toBeGreaterThan(rough.exp);
  expect(good.grade).toBe("Perfect");
});

test("bare hands, unmet equip requirements, bonus caps and practice rewards", () => {
  const config = getGatheringConfig(hero("mining", 4, 50), "mining");
  expect(config).toMatchObject({ maxTier: 1, toolName: "Bare hands" });
  const capped = getGatheringConfig(hero("logging", 50, 50, {
    gatheringTiming: 99, gatheringSlowdown: 99, gatheringPerfect: 99,
  }), "logging");
  expect(capped.window).toBe(227.5);
  expect(capped.interval).toBe(1225);
  const missed = rollGatheringRewards({}, "mining", "Meadowlands", config, Array(config.count).fill(0));
  expect(missed).toMatchObject({ materials: {}, exp: 2, grade: "Missed" });
});

test.each(["mining", "logging"])("%s grants substantially more XP with accelerating performance rewards", (activity) => {
  const config = getGatheringConfig({}, activity);
  const rewards = [0, 0.2, 0.5, 0.8, 1].map((score) =>
    rollGatheringRewards({}, activity, "Meadowlands", config, Array(config.count).fill(score), () => 0));
  expect(rewards.map(({ exp }) => exp)).toEqual(activity === "mining" ? [2, 38, 83, 164, 240] : [3, 40, 86, 171, 250]);
  expect(rewards[3].exp - rewards[2].exp).toBeGreaterThan(rewards[2].exp - rewards[1].exp);
  expect(rewards[4].gathering[activity]).toMatchObject({ level: 2, exp: activity === "mining" ? 108 : 118, attempts: 1 });
});

test.each(["mining", "logging"])("%s XP retains material tier scaling, tool bonuses and under-tier penalties", (activity) => {
  const earned = (level, power, subStats = {}) => {
    const player = hero(activity, level, power, subStats);
    const config = getGatheringConfig(player, activity);
    return rollGatheringRewards(player, activity, "Meadowlands", config, Array(config.count).fill(1), () => 0).exp;
  };
  const scale = activity === "mining" ? 6 / 5 : 10 / 8;
  expect(earned(8, 8)).toBe(Math.round(300 * scale));
  expect(earned(8, 8, { gatheringExp: 0.5 })).toBe(Math.round(450 * scale));
  expect(earned(8, 8, { gatheringExp: 1 })).toBe(Math.round(600 * scale));
  expect(earned(8, 1)).toBe(Math.round(160 * scale));
  expect(earned(43, 43)).toBe(Math.round(800 * scale));
});

test("Mining records one timed strike per round and settles exactly once against latest player data", () => {
  const player = hero();
  getPlayer.mockReturnValue(player);
  const { id } = offerGathering(player, "Meadowlands", "mining");
  expect(finishGathering(id, 0).ok).toBe(false);
  expect(startGathering(id, player, 0, () => 0.5).ok).toBe(true);
  const c = getGatheringAttempt().config;
  expect(recordGatheringInput(id, "strike", 0).ignored).toBe(true);
  for (let i = 0; i < c.count; i++) {
    const time = c.countdown + i * c.interval + c.interval / 4;
    expect(getMiningMarker(time, c)).toBe(0.5);
    expect(recordGatheringInput(id, "strike", time).score).toBe(1);
    expect(recordGatheringInput(id, "strike", time).ignored).toBe(true);
  }
  getPlayer.mockReturnValue({ ...player, materials: { slime_gel: 17 }, gathering: { ...player.gathering, logging: { level: 8 } } });
  const result = finishGathering(id, 99999);
  expect(result.ok).toBe(true);
  expect(result.grade).toBe("Perfect");
  expect(setPlayer).toHaveBeenCalledTimes(1);
  const patch = setPlayer.mock.calls[0][0];
  expect(patch.materials.slime_gel).toBe(17);
  expect(patch.gathering.logging).toEqual({ level: 8 });
  expect(finishGathering(id, 99999).ok).toBe(false);
  expect(setPlayer).toHaveBeenCalledTimes(1);
});

test("Logging requires alternating sides, penalizes wrong/early inputs and expires missed beats", () => {
  const player = hero("logging");
  const { id } = offerGathering(player, "Darkwood", "logging");
  startGathering(id, player, 0);
  const c = getGatheringAttempt().config;
  expect(recordGatheringInput(id, "right", c.countdown + c.interval).score).toBe(0);
  expect(recordGatheringInput(id, "left", c.countdown + c.interval).ignored).toBe(true);
  expect(recordGatheringInput(id, "right", c.countdown + 2 * c.interval).score).toBe(1);
  expect(recordGatheringInput(id, "left", c.countdown + 3 * c.interval - c.window - 1).score).toBe(0);
  expect(advanceGathering(id, getGatheringDuration(c) + 1).complete).toBe(true);
  expect(getGatheringAttempt().scores).toEqual([0, 1, ...Array(c.count - 2).fill(0)]);
});

test("tool configuration is snapshotted and a forfeit never grants XP/materials", () => {
  const player = hero();
  const { id } = offerGathering(player, "Meadowlands", "mining");
  startGathering(id, player, 0);
  player.equipment.pickaxe.mainStat.value = 1;
  expect(getGatheringAttempt().config.maxTier).toBe(7);
  forfeitGathering(id);
  expect(startGathering(id, player).ok).toBe(false);
  expect(finishGathering(id, 99999).ok).toBe(false);
  expect(setPlayer).not.toHaveBeenCalled();
});

test.each([
  [0, 1],
  [28, 1],
  [29, 1 - 0.8 / 102],
  [130, 0],
  [131, 0],
])("Logging timing boundary at %i ms produces score %s", (distance, expected) => {
  const { id } = offerGathering({}, "Meadowlands", "logging");
  startGathering(id, {}, 0);
  const c = getGatheringAttempt().config;
  recordGatheringInput(id, "left", c.countdown + c.interval + distance);
  expect(getGatheringAttempt().scores[0]).toBeCloseTo(expected);
});

test("Mining weak-point boundary, perfect center and round timeout are scored consistently", () => {
  const { id } = offerGathering({}, "Meadowlands", "mining");
  startGathering(id, {}, 0, () => 0.5);
  const c = getGatheringAttempt().config;
  const atMarker = (position, round) => c.countdown + round * c.interval + position * c.interval / 2;
  expect(recordGatheringInput(id, "strike", atMarker(0.5, 0)).score).toBe(1);
  expect(recordGatheringInput(id, "strike", atMarker(0.69, 1)).score).toBe(0);
  advanceGathering(id, c.countdown + 3 * c.interval);
  expect(getGatheringAttempt().scores[2]).toBe(0);
});

test("bare-handed successes can reach the tool unlock without advanced resources", () => {
  let player = {};
  let count = 0;
  while ((player.gathering?.mining.level || 1) < 5 && count < 60) {
    const c = getGatheringConfig(player, "mining");
    const result = rollGatheringRewards(player, "mining", "Meadowlands", c, Array(c.count).fill(1), () => 0);
    player = { gathering: result.gathering };
    count++;
  }
  expect(player.gathering.mining.level).toBe(5);
  expect(count).toBeLessThan(60);
});

test.each([
  ["mining", 6, 10],
  ["logging", 10, 16],
])("%s rolls the full hit range once and scales materials and XP with length", (activity, min, max) => {
  const player = hero(activity);
  const low = offerGathering(player, "Meadowlands", activity, () => 0);
  expect(getGatheringAttempt().config.count).toBe(min);
  startGathering(low.id, player, 0);
  expect(getGatheringAttempt().scores).toHaveLength(min);
  const short = getGatheringAttempt().config;
  forfeitGathering(low.id);
  const high = offerGathering(player, "Meadowlands", activity, () => 0.99999);
  expect(getGatheringAttempt().config.count).toBe(max);
  startGathering(high.id, player, 0);
  const long = getGatheringAttempt().config;
  expect(long.count).toBe(max);
  expect(getGatheringAttempt().scores).toHaveLength(max);
  const reward = (config) => rollGatheringRewards(player, activity, "Meadowlands", config, Array(config.count).fill(1), () => 0);
  expect(reward(long).exp).toBeGreaterThan(reward(short).exp);
  expect(Object.values(reward(long).materials).reduce((a, b) => a + b, 0))
    .toBeGreaterThan(Object.values(reward(short).materials).reduce((a, b) => a + b, 0));
});

test.each(["mining", "logging"])("%s guarantees T1 with usable tools even on misses and can also award every unlocked tier", (activity) => {
  const player = hero(activity);
  const c = getGatheringConfig(player, activity);
  const key = activity === "mining" ? "metal_scraps" : "meadow_oak";
  for (const region of REGION_TIERS) {
    const missed = rollGatheringRewards(player, activity, region, c, Array(c.count).fill(0), () => 0.99999);
    expect(missed.materials[key]).toBeGreaterThanOrEqual(1);
    expect(Object.keys(missed.materials)).toEqual([key]);
    const pool = getGatheringPool(activity, region, c, 1);
    const total = pool.reduce((sum, { weight }) => sum + weight, 0);
    let before = 0;
    for (const entry of pool) {
      const rng = () => (before + entry.weight / 2) / total;
      const result = rollGatheringRewards(player, activity, region, c, Array(c.count).fill(1), rng);
      expect(result.materials[key]).toBeGreaterThanOrEqual(1);
      expect(result.materials[entry.key]).toBeGreaterThanOrEqual(1);
      before += entry.weight;
    }
  }
});

test("base QTE tuning tightens perfect and good windows, with a larger change for logging", () => {
  expect(getGatheringConfig({}, "mining")).toMatchObject({ interval: 1850, window: 0.14, perfect: 0.027 });
  expect(getGatheringConfig({}, "logging")).toMatchObject({ interval: 875, window: 130, perfect: 28 });
});

test.each(["mining", "logging"])("%s independently rolls tiers at the requested baseline chances", (activity) => {
  const player = hero(activity, 22, 22);
  const c = { ...getGatheringConfig(player, activity), rarity: 0, bonusHarvest: 0, comboRoll: false };
  const pool = getGatheringPool(activity, "Meadowlands", c);
  expect(pool.map(({ tier }) => getGatheringTierChance(tier, "Meadowlands", c))).toEqual([1, 0.8, 0.6, 0.5]);
  const counts = {};
  for (let i = 0; i < 1000; i++) {
    const reward = rollGatheringRewards(player, activity, "Meadowlands", c, Array(c.count).fill(0.7), () => i / 1000);
    for (const key of Object.keys(reward.materials)) counts[key] = (counts[key] || 0) + 1;
  }
  expect(pool.map(({ key }) => counts[key])).toEqual([1000, 800, 600, 500]);
  const rolls = [0.9, 0.79, 0.61, 0.49];
  const reward = rollGatheringRewards(player, activity, "Meadowlands", c, Array(c.count).fill(0.7), () => rolls.shift());
  expect(Object.keys(reward.materials)).toEqual([pool[0].key, pool[1].key, pool[3].key]);
});

test.each(["mining", "logging"])("%s guarantees all tiers at 95 percent, including every attempt length", (activity) => {
  const player = hero(activity);
  const config = { ...getGatheringConfig(player, activity), comboRoll: false, bonusHarvest: 0 };
  for (let count = activity === "mining" ? 6 : 10; count <= (activity === "mining" ? 10 : 16); count++) {
    const c = { ...config, count };
    const pool = getGatheringPool(activity, "Meadowlands", c);
    for (const score of [0.95, 1]) {
      const reward = rollGatheringRewards(player, activity, "Meadowlands", c, Array(count).fill(score), () => 0.99999);
      expect(Object.keys(reward.materials)).toEqual(pool.map(({ key }) => key));
      const scale = count / (activity === "mining" ? 5 : 8);
      expect(reward.materials[pool[0].key]).toBe(Math.floor((1 + 5 * score) * scale * (1 + c.yield) * 1.5));
      expect(reward.materials[pool[6].key]).toBe(Math.floor(3 * score * scale * (1 + c.yield) * 1.5));
    }
    const below = rollGatheringRewards(player, activity, "Meadowlands", c, Array(count).fill(0.94999), () => 0.99999);
    expect(Object.keys(below.materials)).toEqual([pool[0].key]);
  }
});

test.each(["mining", "logging"])("%s Rich harvest grants an extra T1 resource on exactly the lower half of rolls", (activity) => {
  const player = hero(activity, 10, 1);
  const c = getGatheringConfig(player, activity);
  const scores = Array(c.count).fill(1);
  const key = activity === "mining" ? "metal_scraps" : "meadow_oak";
  const harvest = (roll) => rollGatheringRewards(player, activity, "Meadowlands", c, scores, () => roll).materials[key];
  expect(c.bonusHarvest).toBe(0.5);
  expect(harvest(0)).toBe(harvest(0.5) + 1);
  expect(harvest(0.49999)).toBe(harvest(0.5) + 1);
  expect(harvest(0.99999)).toBe(harvest(0.5));
});
