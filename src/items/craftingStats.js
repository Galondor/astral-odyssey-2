/*
 Crafting tool stats, shared by Hammers and Precision Tools (src/items/tools.js).
 Kept dependency-free so items.js can label and format them without import cycles.
   cap      - maximum roll per item level (tools reach item level 50)
   percent  - stored as a fraction and shown as a percentage
*/
export const TOOL_SLOT_TYPES = ["hammer", "precisionTools"];
export const TOOL_MAX_ITEM_LEVEL = 50;
export const isToolSlot = (slot) => TOOL_SLOT_TYPES.includes(slot);
export const isToolItem = (item) => !!item && isToolSlot(item.slot);

export const TOOL_MAIN_STAT = "craftsmanship";

export const CRAFTING_STATS = {
  craftsmanship: { label: "Craftsmanship", percent: false },
  craftQuality: { label: "Craft quality", cap: 0.8, percent: false },
  rarityChance: { label: "Rarity chance", cap: 0.8, percent: false },
  mythicChance: { label: "Mythic chance", cap: 0.0005, percent: true, precision: 10000 },
  craftExp: { label: "Profession exp", cap: 0.006, percent: true, precision: 1000 },
  discoveryChance: { label: "Discovery chance", cap: 0.006, percent: true, precision: 1000 },
  materialPreservation: { label: "Material preservation", cap: 0.005, percent: true, precision: 1000 },
  astraDiscount: { label: "Astra discount", cap: 0.005, percent: true, precision: 1000 },
  reactionPotency: { label: "Reaction potency", cap: 0.01, percent: true, precision: 1000 },
};

export const TOOL_SUBSTATS = Object.keys(CRAFTING_STATS).filter((stat) => stat !== TOOL_MAIN_STAT);

export const CRAFTING_STAT_LABELS = Object.fromEntries(
  Object.entries(CRAFTING_STATS).map(([key, def]) => [key, def.label]),
);
export const CRAFTING_PERCENT_STATS = Object.keys(CRAFTING_STATS).filter((key) => CRAFTING_STATS[key].percent);
