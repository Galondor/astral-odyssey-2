import { getGatheringLevel } from "./gathering";

/*
 Crafting professions. The player saves `professions: { [id]: { level, exp, crafts } }`;
 missing entries default to level 1, so older saves need no migration.
 Exp needed per level is tuned so roughly 1,200 on-level crafts reach the level 50 cap.
*/
export const MAX_PROFESSION_LEVEL = 50;

export const PROFESSIONS = {
  weaponry: {
    id: "weaponry",
    name: "Weaponry",
    description: "Forges weapons, off-hand gear, Blacksmith's Hammers, and gathering tools and heads.",
    slots: ["weapon", "offhand", "hammer", "pickaxe", "axe"],
    tool: "hammer",
  },
  armor: {
    id: "armor",
    name: "Armor",
    description: "Crafts helmets, chestplates, gauntlets, leg armor, and boots.",
    slots: ["helmet", "chestplate", "gauntlets", "legs", "boots"],
    tool: "hammer",
  },
  jewelry: {
    id: "jewelry",
    name: "Jewelry",
    description: "Sets rings, necklaces, and Precision Tools.",
    slots: ["ring", "necklace", "precisionTools"],
    tool: "precisionTools",
  },
};
export const PROFESSION_IDS = Object.keys(PROFESSIONS);

// Profession level at which each regional material tier (1-7) becomes usable.
export const MATERIAL_TIER_LEVELS = [1, 8, 15, 22, 29, 36, 43];
export const CRAFT_BASE_EXP = 20;
export const TIER_EXP_MULT = [1, 1.5, 2.2, 3.2, 4.6, 6.5, 9];

export const getOnLevelTier = (level) => {
  let tier = 1;
  MATERIAL_TIER_LEVELS.forEach((min, index) => { if (level >= min) tier = index + 1; });
  return tier;
};

const craftsForLevel = (level) => 9 + 0.75 * (level - 1);

export const getExpToNextLevel = (level) =>
  level >= MAX_PROFESSION_LEVEL
    ? Infinity
    : Math.round(craftsForLevel(level) * CRAFT_BASE_EXP * TIER_EXP_MULT[getOnLevelTier(level) - 1]);

const clampLevel = (level) => Math.min(MAX_PROFESSION_LEVEL, Math.max(1, Math.floor(Number(level) || 1)));

export const getProfession = (player, id) => {
  const saved = player?.professions?.[id] || {};
  const level = clampLevel(saved.level);
  return {
    id,
    level,
    exp: level >= MAX_PROFESSION_LEVEL ? 0 : Math.max(0, Math.floor(Number(saved.exp) || 0)),
    crafts: Math.max(0, Math.floor(Number(saved.crafts) || 0)),
  };
};

export const getProfessionLevel = (player, id) => getProfession(player, id).level;

// Hammers serve both Weaponry and Armor, so they use the higher of the two levels.
export const getToolProfessionLevel = (player, slot) =>
  slot === "hammer"
    ? Math.max(getProfessionLevel(player, "weaponry"), getProfessionLevel(player, "armor"))
    : slot === "precisionTools"
      ? getProfessionLevel(player, "jewelry")
      : slot === "pickaxe" || slot === "axe"
        ? (getGatheringLevel(player, slot === "pickaxe" ? "mining" : "logging") >= 5
          ? getGatheringLevel(player, slot === "pickaxe" ? "mining" : "logging") : 0)
      : 0;

export const getToolProfessionLabel = (slot) =>
  slot === "hammer" ? "Weaponry or Armor" : slot === "precisionTools" ? "Jewelry"
    : slot === "pickaxe" ? "Mining" : slot === "axe" ? "Logging" : "";

// Returns the new professions object and the levels gained.
export const addProfessionExp = (player, id, amount, { countCraft = true } = {}) => {
  const current = getProfession(player, id);
  let { level, exp } = current;
  exp += Math.max(0, Math.floor(amount));
  const start = level;
  while (level < MAX_PROFESSION_LEVEL && exp >= getExpToNextLevel(level)) {
    exp -= getExpToNextLevel(level);
    level += 1;
  }
  if (level >= MAX_PROFESSION_LEVEL) exp = 0;
  return {
    professions: {
      ...(player?.professions || {}),
      [id]: { level, exp, crafts: current.crafts + Number(countCraft) },
    },
    levelsGained: level - start,
    level,
  };
};

// ---- Unlock track (shared by every crafting profession) ----

export const REAGENT_SLOT_LEVELS = [1, 5, 15, 30, 45];
export const getReagentSlots = (level) => REAGENT_SLOT_LEVELS.filter((min) => level >= min).length;

export const PROFESSION_EFFECTS = {
  tempering: { level: 10, name: "Tempering", description: "Crafted gear never rolls below Average condition." },
  infusion: { level: 20, name: "Infusion", description: "Material ability effects take hold on crafted gear." },
  socketcraft: { level: 28, name: "Socketcraft", description: "Epic results always gain a second socket and Holofoil chance is increased by 1%." },
  attunement: { level: 35, name: "Attunement", description: "Material main stat effects take hold and crafted main stats gain +2." },
  masterwork: { level: 42, name: "Masterwork", description: "Craft quality is increased by 25%." },
};

export const hasProfessionEffect = (level, effect) => level >= (PROFESSION_EFFECTS[effect]?.level ?? Infinity);

// Passive rates that grow every level.
export const getProfessionRates = (level) => ({
  quality: level * 2,
  astraDiscount: Math.min(0.25, (level - 1) * 0.005),
  discoveryChance: 0.25 + level * 0.005,
});

// Mythic odds from the profession alone: virtually zero until level 30, then up to 1.5% at level 50.
export const MYTHIC_CHANCE_CAP = 0.05;
export const MYTHIC_MATERIAL_CAP = 0.01;
export const MYTHIC_BASE_CHANCE = 0.0001;
export const getProfessionMythicChance = (level) =>
  MYTHIC_BASE_CHANCE + (level >= 30 ? ((level - 29) / 21) * 0.0149 : 0);
