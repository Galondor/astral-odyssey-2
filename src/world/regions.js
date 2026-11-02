/*
 Overworld regions, ordered from the start of the adventure to the end.
   minLevel / maxLevel - the level range enemies and events in the region are tuned for
   entryLevel          - the player level required to travel there
   fare                - static portal fare in astra
   danger              - multiplier on enemy health, attack, and defense
   reward              - multiplier on enemy and event astra/exp rewards
   rarityBonus         - raises the minimum rarity of gear dropped by enemies
   dropBonus           - added to the chance enemies drop gear
*/
export const REGIONS = {
  Meadowlands: {
    name: "Meadowlands",
    minLevel: 1,
    maxLevel: 10,
    entryLevel: 1,
    fare: 100,
    keywords: ["meadowlands", "meadow"],
    danger: 1,
    reward: 1,
    rarityBonus: 0,
    dropBonus: 0,
  },
  Darkwood: {
    name: "Darkwood",
    minLevel: 10,
    maxLevel: 20,
    entryLevel: 10,
    fare: 500,
    keywords: ["darkwood", "forest"],
    danger: 1.05,
    reward: 1.1,
    rarityBonus: 0,
    dropBonus: 0.02,
  },
  AshenPeaks: {
    name: "Ashen Peaks",
    minLevel: 20,
    maxLevel: 40,
    entryLevel: 20,
    fare: 2000,
    keywords: ["ashen", "peaks"],
    danger: 1.1,
    reward: 1.25,
    rarityBonus: 0,
    dropBonus: 0.04,
  },
  TempestReach: {
    name: "Tempest Reach",
    minLevel: 40,
    maxLevel: 55,
    entryLevel: 40,
    fare: 5000,
    keywords: ["tempest", "sea"],
    danger: 1.15,
    reward: 1.4,
    rarityBonus: 1,
    dropBonus: 0.06,
  },
  FrostfallRange: {
    name: "Frostfall Range",
    minLevel: 55,
    maxLevel: 70,
    entryLevel: 55,
    fare: 10000,
    keywords: ["frostfall", "cold mountain"],
    danger: 1.2,
    reward: 1.6,
    rarityBonus: 1,
    dropBonus: 0.08,
  },
  SuncleftExpanse: {
    name: "Suncleft Expanse",
    minLevel: 70,
    maxLevel: 85,
    entryLevel: 70,
    fare: 18000,
    keywords: ["suncleft", "desert"],
    danger: 1.25,
    reward: 1.8,
    rarityBonus: 1,
    dropBonus: 0.1,
  },
  ShatteredFront: {
    name: "Shattered Front",
    minLevel: 85,
    maxLevel: 100,
    entryLevel: 85,
    fare: 30000,
    keywords: ["shattered", "warzone"],
    danger: 1.3,
    reward: 2,
    rarityBonus: 2,
    dropBonus: 0.12,
  },
};
export const DEFAULT_REGION = "Meadowlands";
export const REGION_ORDER = Object.keys(REGIONS);

export const getRegion = (player) => {
  const saved = player?.region;
  if (REGIONS[saved]) return saved;
  // Older saves stored the display name (e.g. "Ashen Peaks").
  return Object.keys(REGIONS).find((id) => REGIONS[id].name === saved) || DEFAULT_REGION;
};

const levelOf = (player) => Math.max(1, Number(player?.level) || 1);

export const canEnterRegion = (player, regionId) =>
  !!REGIONS[regionId] && levelOf(player) >= REGIONS[regionId].entryLevel;

export const getAccessibleRegions = (player) => REGION_ORDER.filter((id) => canEnterRegion(player, id));

// The furthest region the player can enter; used to relocate saves that are under-leveled for their region.
export const getHighestAccessibleRegion = (player) => {
  const accessible = getAccessibleRegions(player);
  return accessible[accessible.length - 1] || DEFAULT_REGION;
};

export const clampToRegion = (level, regionId) => {
  const region = REGIONS[regionId];
  if (!region) return level;
  return Math.min(region.maxLevel, Math.max(region.minLevel, level));
};

export const regionLevelText = (regionId) => {
  const region = REGIONS[regionId];
  return region ? `Levels ${region.minLevel}-${region.maxLevel}` : "";
};
