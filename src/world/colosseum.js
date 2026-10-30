import { getPlayer, setPlayer } from "../character/player";
import { isInGroupDungeon } from "./groupState";

export const COLOSSEUM_MIN_LEVEL = 5;
export const COLOSSEUM_COOLDOWN_MS = 15 * 60 * 1000;

const WAVE_PATTERN = ["basic", "elite", "basic", "elite", "boss"];
const ENEMY_STAT_MULTIPLIER = 0.25;
const NAMES = {
  basic: ["Pit Recruit", "Arena Swordsman", "Bronze Shieldbearer"],
  elite: ["Ironclad Duelist", "Veteran Spearmaster", "Gladiator Captain"],
  boss: ["Champion of the Colosseum"],
};
const TIER_SCALE = {
  basic: { health: 1, attack: 0.7, defense: 0.2, reward: 1 },
  elite: { health: 1.04, attack: 0.73, defense: 0.25, reward: 1.6 },
  boss: { health: 1.08, attack: 0.77, defense: 0.3, reward: 2.4 },
};

let activeRun = null;

export const getColosseumRun = () => activeRun;

export const getColosseumWaveTier = (wave) =>
  WAVE_PATTERN[(wave - 1) % WAVE_PATTERN.length];

export const createColosseumEnemy = (wave, player = getPlayer()) => {
  const tier = getColosseumWaveTier(wave);
  const tierScale = TIER_SCALE[tier];
  const waveScale = 1 + (wave - 1) * 0.18;
  const level = Math.max(COLOSSEUM_MIN_LEVEL, player?.level || 1);
  const levelScale = 1 + (level - COLOSSEUM_MIN_LEVEL) * 0.12;
  const stats = player?.stats || {};
  const baseHealth = Math.max(80, stats.maxHealth || 100);
  const baseAttack = Math.max(5, stats.attackMax || 10);
  const nameList = NAMES[tier];
  const name = nameList[(wave - 1) % nameList.length];
  const isBoss = tier === "boss";

  return {
    id: `colosseum-${tier}-${wave}`,
    name,
    tier,
    level: level + wave - 1,
    colosseum: true,
    colosseumWave: wave,
    colosseumWaveType: tier,
    maxHp: Math.round(baseHealth * tierScale.health * waveScale * levelScale * ENEMY_STAT_MULTIPLIER),
    attack: [
      Math.max(1, Math.floor(baseAttack * tierScale.attack * waveScale * levelScale * 0.55 * ENEMY_STAT_MULTIPLIER)),
      Math.max(2, Math.ceil(baseAttack * tierScale.attack * waveScale * levelScale * 0.85 * ENEMY_STAT_MULTIPLIER)),
    ],
    defense: Math.max(0, Math.round(((stats.defense || 0) * tierScale.defense * waveScale + wave) * ENEMY_STAT_MULTIPLIER)),
    speed: Math.max(1, Math.round((stats.speed || 5) * (0.65 + wave * 0.015) * ENEMY_STAT_MULTIPLIER)),
    critical: 0.05 + Math.min(0.2, wave * 0.005),
    astra: Math.round(20 * tierScale.reward * waveScale),
    exp: Math.round(24 * tierScale.reward * waveScale),
    abilities: isBoss
      ? [
          { name: "Shield Bash", power: 1.1, status: { id: "stun", chance: 0.2 }, cooldown: 3 },
          { name: "Champion's Lunge", power: 1.45, ignoreDefense: 0.2, cooldown: 2 },
        ]
      : tier === "elite"
        ? [{ name: "Spear Thrust", power: 1.25, ignoreDefense: 0.15, cooldown: 2 }]
        : [{ name: "Gladiator's Strike", power: 1.1 }],
    phases: isBoss
      ? [{
          below: 0.5,
          text: "The champion raises a battered shield and surges into the fray!",
          self: { id: "enrage", turns: 99, power: 0.25 },
        }]
      : [],
    stunResist: isBoss ? 0.5 : tier === "elite" ? 0.25 : 0,
    drops: isBoss
      ? [{ key: "champions_medallion", chance: 1, min: 1, max: 1 }]
      : [{ key: "broken_blade_fragments", chance: tier === "elite" ? 0.3 : 0.2, min: 1, max: 2 }],
    materialAmount: 1,
  };
};

export const getColosseumStatus = (player = getPlayer(), now = Date.now()) => {
  const lastRunAt = Number(player?.lastColosseumRunAt);
  const cooldownRemainingMs =
    Number.isFinite(lastRunAt) && lastRunAt > 0
      ? Math.max(0, lastRunAt + COLOSSEUM_COOLDOWN_MS - now)
      : 0;
  return {
    active: !!activeRun,
    wave: activeRun?.wave || null,
    waitingForBossDecision: !!activeRun?.waitingForBossDecision,
    cooldownRemainingMs,
    canEnter:
      !activeRun &&
      (player?.level || 1) >= COLOSSEUM_MIN_LEVEL &&
      cooldownRemainingMs === 0,
  };
};

export const beginColosseumRun = (now = Date.now()) => {
  const player = getPlayer();
  if (!player) return { ok: false, reason: "character" };
  if (activeRun) return { ok: false, reason: "active" };
  if (isInGroupDungeon()) return { ok: false, reason: "group" };
  if ((player.level || 1) < COLOSSEUM_MIN_LEVEL)
    return { ok: false, reason: "level" };
  const status = getColosseumStatus(player, now);
  if (status.cooldownRemainingMs > 0)
    return { ok: false, reason: "cooldown", cooldownRemainingMs: status.cooldownRemainingMs };

  setPlayer({ lastColosseumRunAt: now });
  activeRun = { wave: 1, waitingForBossDecision: false };
  return { ok: true, enemy: createColosseumEnemy(1, player) };
};

export const advanceColosseumRun = () => {
  if (!activeRun) return null;
  const wave = activeRun.wave + 1;
  const player = getPlayer();
  activeRun = { wave, waitingForBossDecision: false };
  return createColosseumEnemy(wave, player);
};

export const awaitColosseumBossDecision = () => {
  if (activeRun) activeRun = { ...activeRun, waitingForBossDecision: true };
};

export const endColosseumRun = () => {
  activeRun = null;
};
