import { isHolofoilColors, rollHolofoil } from "./holofoil";
import { CRAFTING_STATS, isToolItem, TOOL_MAIN_STAT, TOOL_MAX_ITEM_LEVEL, TOOL_SUBSTATS } from "./craftingStats";
import { getToolProfessionLevel, PROFESSIONS } from "../character/professions";

/*
 Blacksmith's Hammers and Precision Tools: crafting-only gear for the `hammer` and `precisionTools` slots.
 They behave like gear (rarity, condition, item level, upgrades, Holofoil) but never have sockets, never
 add combat stats, and require a profession level equal to their item level (Hammers use the higher of
 Weaponry and Armor; Precision Tools use Jewelry). The Hammer boosts Weaponry and Armor crafts and
 Precision Tools boost Jewelry crafts.
*/
export const TOOL_NAMES = { hammer: "Blacksmith's Hammer", precisionTools: "Precision Tools" };
export const TOOL_RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
const TOOL_RARITY_CONFIG = {
  Common: { substats: 1, mainBonus: 1, priceMult: 1 },
  Uncommon: { substats: 2, mainBonus: 2, priceMult: 1.5 },
  Rare: { substats: 3, mainBonus: 3, priceMult: 2.5 },
  Epic: { substats: 4, mainBonus: 4, priceMult: 4 },
  Legendary: { substats: 5, mainBonus: 5, priceMult: 8 },
};
const TOOL_CONDITIONS = {
  Broken: { main: -3, value: 0.25 },
  Poor: { main: -2, value: 0.5 },
  Average: { main: 0, value: 0.75 },
  Pristine: { main: 2, value: 1 },
  Flawless: { main: 3, value: 1.5 },
  Perfect: { main: 5, value: 2 },
};
const TOOL_PREFIXES = {
  hammer: ["Iron", "Steel", "Mythril"],
  precisionTools: ["Brass", "Silver", "Mythril"],
};
const TOOL_MAIN_MAX = 15;
const MAX_TIER = 7;
const HOLOFOIL_TOOL_MIN_TIER = 5;

let toolCounter = 0;
const newToolId = () => `item-${Date.now().toString(36)}-t${(toolCounter++).toString(36)}`;
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const statMax = (stat, iLevel) => CRAFTING_STATS[stat].cap * iLevel;
const precisionOf = (stat) => CRAFTING_STATS[stat].precision || 1;
const roundStat = (stat, value) => Math.round(value * precisionOf(stat)) / precisionOf(stat);

export const getToolSubStatTier = (stat, value, iLevel) => {
  if (!CRAFTING_STATS[stat]?.cap || !Number.isFinite(value) || !(iLevel >= 1)) return null;
  return Math.round(Math.min(1, Math.max(0, value / statMax(stat, iLevel))) * MAX_TIER);
};

const rollToolSubStat = (stat, iLevel, minTier = 0) => {
  const max = statMax(stat, iLevel);
  const minimum = 1 / precisionOf(stat);
  const low = Math.max(0, (Math.min(MAX_TIER, minTier) - 0.5) / MAX_TIER);
  for (let attempt = 0; attempt < 20; attempt++) {
    const value = Math.max(minimum, roundStat(stat, (low + Math.random() * (1 - low)) * max));
    if (getToolSubStatTier(stat, value, iLevel) >= minTier) return value;
  }
  return Math.max(minimum, roundStat(stat, max));
};

const toolMainTier = (value) => Math.round(Math.min(1, Math.max(0, value / TOOL_MAIN_MAX)) * MAX_TIER);

// Holofoil tools (crafted, mailed, or Prismatic Alloy) raise low stats to T5+ and double their value once.
export const applyToolHolofoilBonuses = (item) => {
  if (!isToolItem(item) || !isHolofoilColors(item.holofoil) || item.holofoilBonusVersion === 1) return item;
  const level = Math.min(TOOL_MAX_ITEM_LEVEL, Math.max(1, item.iLevel || 1));
  const subStats = { ...(item.subStats || {}) };
  const subTiers = { ...(item.subTiers || {}) };
  for (const [stat, value] of Object.entries(subStats)) {
    if (!CRAFTING_STATS[stat]?.cap) continue;
    if ((getToolSubStatTier(stat, value, level) ?? 0) < HOLOFOIL_TOOL_MIN_TIER) subStats[stat] = rollToolSubStat(stat, level, HOLOFOIL_TOOL_MIN_TIER);
    subTiers[stat] = getToolSubStatTier(stat, subStats[stat], level);
  }
  const minimumMain = Math.ceil(((HOLOFOIL_TOOL_MIN_TIER - 0.5) / MAX_TIER) * TOOL_MAIN_MAX);
  const mainValue = Math.max(item.mainStat?.value || 0, minimumMain);
  return {
    ...item,
    subStats,
    subTiers,
    mainStat: { stat: TOOL_MAIN_STAT, value: mainValue, tier: toolMainTier(mainValue) },
    price: Number.isSafeInteger(item.price) ? item.price * 2 : item.price,
    socketCount: 0,
    holofoilBonusVersion: 1,
  };
};

/*
 spec: { slot, iLevel (1-50), rarity, condition, minTier, guaranteed: [tool stats], holofoil (true/colors forces one) }
*/
export const createToolItem = ({ slot, iLevel = 1, rarity = "Common", condition = "Average", minTier = 0, guaranteed = [], holofoil } = {}) => {
  if (!TOOL_NAMES[slot]) throw new Error("Choose a Hammer or Precision Tools.");
  const config = TOOL_RARITY_CONFIG[rarity];
  const conditionDef = TOOL_CONDITIONS[condition];
  if (!config || !conditionDef) throw new Error("Tools can be Common to Legendary in any condition.");
  const level = Math.min(TOOL_MAX_ITEM_LEVEL, Math.max(1, Math.floor(Number(iLevel) || 1)));
  const foil = rollHolofoil(holofoil);
  const floor = Math.min(MAX_TIER, Math.floor(minTier) || 0);
  const chosen = [...new Set(guaranteed)].filter((stat) => TOOL_SUBSTATS.includes(stat)).slice(0, config.substats);
  const rest = TOOL_SUBSTATS.filter((stat) => !chosen.includes(stat));
  while (chosen.length < config.substats) chosen.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
  const subStats = {};
  const subTiers = {};
  for (const stat of chosen) {
    subStats[stat] = rollToolSubStat(stat, level, floor);
    subTiers[stat] = getToolSubStatTier(stat, subStats[stat], level);
  }
  const rolls = [1, 2, 3, 4, 5].map((roll) => Math.max(0, roll + config.mainBonus + conditionDef.main));
  const allowed = rolls.filter((value) => toolMainTier(value) >= floor);
  const mainValue = allowed.length ? pick(allowed) : Math.max(...rolls);
  const prefix = TOOL_PREFIXES[slot][level > 35 ? 2 : level > 20 ? 1 : 0];
  const tierSum = Object.values(subTiers).reduce((sum, tier) => sum + tier, 0);
  const price = Math.max(1, Math.round((10 + level * 4 + mainValue * 3 + tierSum * level) * config.priceMult * conditionDef.value));
  return applyToolHolofoilBonuses({
    id: newToolId(),
    name: `${condition} ${prefix} ${TOOL_NAMES[slot]}`,
    slot,
    twoHanded: false,
    rarity,
    socketCount: 0,
    condition,
    iLevel: level,
    price,
    description: "",
    mainStat: { stat: TOOL_MAIN_STAT, value: mainValue, tier: toolMainTier(mainValue) },
    subStats,
    subTiers,
    ability: null,
    ...foil,
  });
};

// The equipped tool that serves a profession, if the player still meets its requirement.
export const getProfessionTool = (player, professionId) => {
  const slot = PROFESSIONS[professionId]?.tool;
  const tool = slot ? player?.equipment?.[slot] : null;
  return isToolItem(tool) && getToolProfessionLevel(player, tool.slot) >= (tool.iLevel || 1) ? tool : null;
};

// Crafting bonuses from the profession's tool; Craftsmanship adds 2 craft quality per point.
export const getToolBonuses = (player, professionId) => {
  const tool = getProfessionTool(player, professionId);
  const sub = tool?.subStats || {};
  const value = (stat) => (Number.isFinite(sub[stat]) ? sub[stat] : 0);
  return {
    tool,
    craftQuality: value("craftQuality") + (tool?.mainStat?.stat === TOOL_MAIN_STAT ? (tool.mainStat.value || 0) * 2 : 0),
    rarityChance: value("rarityChance"),
    mythicChance: value("mythicChance"),
    craftExp: value("craftExp"),
    discoveryChance: value("discoveryChance"),
    materialPreservation: Math.min(0.5, value("materialPreservation")),
    astraDiscount: Math.min(0.5, value("astraDiscount")),
    reactionPotency: value("reactionPotency"),
  };
};

export const TOOL_CONDITION_NAMES = Object.keys(TOOL_CONDITIONS);
