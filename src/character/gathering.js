export const MAX_GATHERING_LEVEL = 50;
export const GATHERING_TIER_LEVELS = [1, 8, 15, 22, 29, 36, 43];
export const GATHERING_PROFESSIONS = {
  mining: { name: "Mining", slot: "pickaxe", family: "ore", description: "Time precise strikes to uncover ore." },
  logging: { name: "Logging", slot: "axe", family: "wood", description: "Alternate rhythmic chops to harvest wood." },
};
export const GATHERING_UNLOCKS = [
  { level: 5, name: "Tools of the trade", description: "Equip Pickaxes or Axes up to your gathering level." },
  { level: 10, name: "Rich harvest", description: "50% chance to harvest one extra resource." },
  { level: 20, name: "Steady hands", description: "Perfect timing windows are 20% wider." },
  { level: 30, name: "Flow", description: "A combo of four good inputs grants an extra material roll." },
  { level: 40, name: "Prospector", description: "Higher-tier eligible resources are more likely." },
  { level: 50, name: "Master gatherer", description: "+20% yield and further improved higher-tier finds." },
];

export const getGathering = (player, id) => {
  const saved = player?.gathering?.[id] || {};
  const level = Math.min(50, Math.max(1, Math.floor(Number(saved.level) || 1)));
  return {
    level,
    exp: level === 50 ? 0 : Math.max(0, Math.floor(Number(saved.exp) || 0)),
    attempts: Math.max(0, Math.floor(Number(saved.attempts) || 0)),
  };
};
export const getGatheringLevel = (player, id) => getGathering(player, id).level;
export const getGatheringTier = (power) =>
  GATHERING_TIER_LEVELS.filter((min) => Math.min(50, Math.max(1, Number(power) || 1)) >= min).length;
export const getGatheringExpNeeded = (level) =>
  level >= 50 ? Infinity : Math.round((6 + level * 0.6) * 20 * (1 + Math.floor((level - 1) / 7) * 0.5));
export const getGatheringRates = (level) => ({
  yield: (level - 1) * 0.005 + (level >= 50 ? 0.2 : 0),
  timing: (level - 1) * 0.003,
  perfect: level >= 20 ? 0.2 : 0,
  rarity: (level >= 40 ? 0.3 : 0) + (level >= 50 ? 0.2 : 0),
  bonusHarvest: level >= 10 ? 0.5 : 0,
  comboRoll: level >= 30,
});
export const addGatheringExp = (player, id, amount, { countAttempt = true } = {}) => {
  const current = getGathering(player, id);
  let { level, exp } = current;
  exp += Math.max(0, Math.floor(Number(amount) || 0));
  while (level < 50 && exp >= getGatheringExpNeeded(level)) {
    exp -= getGatheringExpNeeded(level);
    level++;
  }
  return {
    gathering: {
      ...(player?.gathering || {}),
      [id]: { level, exp: level === 50 ? 0 : exp, attempts: current.attempts + Number(countAttempt) },
    },
    level,
    levelsGained: level - current.level,
  };
};
