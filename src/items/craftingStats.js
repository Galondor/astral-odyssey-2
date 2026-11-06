/*
 Crafting and gathering tool stats (src/items/tools.js).
 Kept dependency-free so items.js can label and format them without import cycles.
   cap      - maximum roll per item level (tools reach item level 50)
   percent  - stored as a fraction and shown as a percentage
*/
export const TOOL_SLOT_TYPES = ["hammer", "precisionTools", "pickaxe", "axe"];
export const isGatheringToolSlot = (slot) => slot === "pickaxe" || slot === "axe";
export const TOOL_MAX_ITEM_LEVEL = 50;
export const isToolSlot = (slot) => TOOL_SLOT_TYPES.includes(slot);
export const isToolItem = (item) => !!item && isToolSlot(item.slot);

export const TOOL_MAIN_STAT = "craftsmanship";

export const CRAFTING_STATS = {
  craftsmanship: { label: "Craftsmanship", percent: false },
  craftQuality: { label: "Craft quality", cap: 0.8, percent: false },
  rarityChance: { label: "Rarity chance", cap: 0.8, percent: false },
  mythicChance: { label: "Mythic chance", cap: 0.0005, percent: true, precision: 10000 },
  craftExp: { label: "Profession exp", cap: 0.02, percent: true, precision: 1000 },
  discoveryChance: { label: "Discovery chance", cap: 0.006, percent: true, precision: 1000 },
  materialPreservation: { label: "Material preservation", cap: 0.005, percent: true, precision: 1000 },
  astraDiscount: { label: "Astra discount", cap: 0.005, percent: true, precision: 1000 },
  reactionPotency: { label: "Reaction potency", cap: 0.01, percent: true, precision: 1000 },
};

export const TOOL_SUBSTATS = Object.keys(CRAFTING_STATS).filter((stat) => stat !== TOOL_MAIN_STAT);
export const GATHERING_STATS = {
  gatheringPower: { label: "Gathering Power", percent: false },
  gatheringTiming: { label: "Gathering timing tolerance", cap: 0.008, percent: true, precision: 1000 },
  gatheringSlowdown: { label: "Gathering slowdown", cap: 0.006, percent: true, precision: 1000 },
  gatheringPerfect: { label: "Gathering perfect window", cap: 0.008, percent: true, precision: 1000 },
  gatheringYield: { label: "Gathering resource yield", cap: 0.012, percent: true, precision: 1000 },
  gatheringRarity: { label: "Gathering resource rarity", cap: 0.012, percent: true, precision: 1000 },
  gatheringExp: { label: "Gathering exp", cap: 0.02, percent: true, precision: 1000 },
};
export const TOOL_STAT_DEFS = { ...CRAFTING_STATS, ...GATHERING_STATS };
export const getToolSubStats = (slot) => isGatheringToolSlot(slot)
  ? Object.keys(GATHERING_STATS).filter((stat) => stat !== "gatheringPower") : TOOL_SUBSTATS;

export const CRAFTING_STAT_LABELS = Object.fromEntries(
  Object.entries(TOOL_STAT_DEFS).map(([key, def]) => [key, def.label]),
);
export const CRAFTING_PERCENT_STATS = Object.keys(TOOL_STAT_DEFS).filter((key) => TOOL_STAT_DEFS[key].percent);
