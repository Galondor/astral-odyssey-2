import {
  addProfessionExp,
  CRAFT_BASE_EXP,
  getOnLevelTier,
  getProfession,
  getProfessionMythicChance,
  getProfessionRates,
  getReagentSlots,
  hasProfessionEffect,
  MYTHIC_CHANCE_CAP,
  MYTHIC_MATERIAL_CAP,
  PROFESSIONS,
  TIER_EXP_MULT,
} from "../character/professions";
import { REGIONS } from "../world/regions";
import { BLUEPRINTS } from "./craftingBlueprints";
import {
  CRAFTING_MATERIALS,
  findReactions,
  getCraftingMaterial,
  getMaterialCraftLevel,
  isBaseMaterial,
  isHarmfulEffect,
  isReagentMaterial,
  REACTIONS,
  REGION_TIERS,
} from "./craftingMaterials";
import { CONDITION_NAMES, createCraftedItem, createMythicItem, createUniqueItem } from "./items";
import { getMaterialCount, MATERIALS, spendMaterials } from "./materials";
import { TOOL_MAX_ITEM_LEVEL } from "./craftingStats";
import { createToolItem, getToolBonuses } from "./tools";

/*
 Material Crafting engine. A selection is { blueprintId, base: materialKey, reagents: [materialKey] }.
 analyzeCraft() is deterministic and powers the preview; craftItem() rolls the result and returns a player patch.
 The player saves `craftingBook: { materials: { key: propertiesKnown }, reactions: [reactionId] }`.
*/
export const CRAFT_RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
const RESULT_RARITY_ORDER = [...CRAFT_RARITIES, "Unique", "Mythic"];
const BASE_RARITY_WEIGHTS = [50, 25, 15, 8, 2];
const BASE_CONDITION_WEIGHTS = [10, 20, 35, 20, 10, 5];
const QUALITY_PER_TIER = 40;
const QUALITY_TIER_CAP = 5;
const BASE_HOLOFOIL_CHANCE = 0.01;
const POTENT_EFFECTS = ["quality", "rarityBoost", "holofoil", "mythic"];

export const getCraftingBook = (player) => {
  const saved = player?.craftingBook || {};
  const materials = {};
  for (const [key, count] of Object.entries(saved.materials || {})) {
    const total = CRAFTING_MATERIALS[key]?.properties.length || 0;
    const known = Math.min(total, Math.max(0, Math.floor(Number(count) || 0)));
    if (known) materials[key] = known;
  }
  const reactions = [...new Set(Array.isArray(saved.reactions) ? saved.reactions : Object.values(saved.reactions || {}))]
    .filter((id) => REACTIONS[id]);
  return { materials, reactions };
};

export const getKnownProperties = (book, key) =>
  (CRAFTING_MATERIALS[key]?.properties || []).slice(0, book.materials[key] || 0);

const weightedOdds = (weights, quality, floorIndex = 0) => {
  const scaled = weights.map((weight, index) => (index < floorIndex ? 0 : weight * (1 + Math.max(0, quality) / 100) ** index));
  const total = scaled.reduce((sum, weight) => sum + weight, 0);
  return scaled.map((weight) => weight / total);
};

const rollIndex = (odds) => {
  let roll = Math.random();
  for (let index = 0; index < odds.length; index++) {
    if (roll < odds[index]) return index;
    roll -= odds[index];
  }
  for (let index = odds.length - 1; index >= 0; index--) if (odds[index] > 0) return index;
  return 0;
};

const regionForTier = (tier) => REGIONS[REGION_TIERS[Math.min(REGION_TIERS.length, Math.max(1, tier)) - 1]];

const fail = (message) => ({ ok: false, message });

export const analyzeCraft = (player, selection = {}) => {
  if (!player) return fail("No character loaded.");
  const blueprint = BLUEPRINTS[selection.blueprintId];
  if (!blueprint) return fail("Choose something to craft.");
  const profession = getProfession(player, blueprint.profession);
  const professionName = PROFESSIONS[blueprint.profession].name;
  const { level } = profession;
  if (level < blueprint.level)
    return fail(`${blueprint.name} unlocks at ${professionName} level ${blueprint.level}.`);
  const baseKey = selection.base;
  const base = getCraftingMaterial(baseKey);
  if (!baseKey || !base || !isBaseMaterial(baseKey))
    return fail("Choose a base material.");
  if (!blueprint.families.includes(base.family))
    return fail(`${blueprint.name} needs a ${blueprint.families.join(" or ")} base material.`);
  if (base.tier < (blueprint.minTier || 1))
    return fail(`${blueprint.name} needs a tier ${blueprint.minTier} or higher base material.`);
  if (getMaterialCraftLevel(baseKey) > level)
    return fail(`${MATERIALS[baseKey].name} requires ${professionName} level ${getMaterialCraftLevel(baseKey)}.`);
  const reagents = (Array.isArray(selection.reagents) ? selection.reagents : []).filter(Boolean);
  const slots = getReagentSlots(level);
  if (reagents.length > slots) return fail(`You have ${slots} reagent slot${slots === 1 ? "" : "s"}.`);
  for (const key of reagents) {
    if (!isReagentMaterial(key)) return fail("Base materials can't be used as reagents.");
    if (getMaterialCraftLevel(key) > level)
      return fail(`${MATERIALS[key].name} requires ${professionName} level ${getMaterialCraftLevel(key)}.`);
  }
  if (blueprint.kind === "tool") {
    for (const type of blueprint.parts) {
      if (!reagents.some((key) => CRAFTING_MATERIALS[key].part?.tool === blueprint.slot && CRAFTING_MATERIALS[key].part.type === type))
        return fail(`${blueprint.name} needs a ${type} tool part in a reagent slot.`);
    }
  }

  const cost = { [baseKey]: blueprint.baseQty };
  for (const key of reagents) cost[key] = (cost[key] || 0) + 1;
  for (const [key, qty] of Object.entries(blueprint.requires || {})) cost[key] = (cost[key] || 0) + qty;
  const missing = Object.entries(cost).filter(([key, qty]) => getMaterialCount(player, key) < qty);

  // Gather material effects; Kindred Ash repeats the first other reagent.
  const entries = [];
  const addMaterial = (key, source = key) =>
    CRAFTING_MATERIALS[key].properties.forEach((effect) => entries.push({ effect, source, origin: "material" }));
  addMaterial(baseKey);
  reagents.forEach((key) => addMaterial(key));
  const echoTarget = reagents.find((key) => !CRAFTING_MATERIALS[key].properties.some((effect) => effect.type === "echo"));
  const echoes = reagents.filter((key) => CRAFTING_MATERIALS[key].properties.some((effect) => effect.type === "echo")).length;
  if (echoTarget) for (let i = 0; i < echoes; i++) addMaterial(echoTarget, echoTarget);
  const stabilized = entries.some(({ effect }) => effect.type === "stabilize");

  const tool = getToolBonuses(player, blueprint.profession);
  const potency = 1 + tool.reactionPotency +
    entries.reduce((sum, { effect }) => sum + (effect.type === "potency" ? effect.value : 0), 0);
  const triggered = findReactions([baseKey, ...reagents]);
  const suppressed = stabilized ? triggered.filter((id) => REACTIONS[id].harmful) : [];
  const reactions = triggered.filter((id) => !suppressed.includes(id));
  for (const id of reactions) {
    for (const effect of REACTIONS[id].effects) {
      const scaled = POTENT_EFFECTS.includes(effect.type) && effect.value > 0
        ? { ...effect, value: effect.type === "quality" || effect.type === "rarityBoost" ? Math.round(effect.value * potency) : effect.value * potency }
        : effect;
      entries.push({ effect: scaled, source: id, origin: "reaction" });
    }
  }

  const gated = { ability: "infusion", mainStat: "attunement" };
  const active = [];
  const inactive = [];
  for (const entry of entries) {
    if (stabilized && entry.origin === "material" && isHarmfulEffect(entry.effect)) inactive.push({ ...entry, reason: "stabilized" });
    else if (gated[entry.effect.type] && !hasProfessionEffect(level, gated[entry.effect.type])) inactive.push({ ...entry, reason: gated[entry.effect.type] });
    else active.push(entry);
  }
  const effectsOf = (type) => active.map(({ effect }) => effect).filter((effect) => effect.type === type);
  const sum = (type) => effectsOf(type).reduce((total, effect) => total + effect.value, 0);

  const rates = getProfessionRates(level);
  const qualityRaw = rates.quality + tool.craftQuality + sum("quality");
  const quality = Math.max(0, Math.round(qualityRaw * (hasProfessionEffect(level, "masterwork") ? 1.25 : 1)));
  const rarityQuality = quality + tool.rarityChance + sum("rarityBoost");
  const rarityFloor = Math.max(0, ...effectsOf("rarityFloor").map((effect) => CRAFT_RARITIES.indexOf(effect.rarity)));
  const rarityOdds = blueprint.kind === "unique"
    ? []
    : weightedOdds(BASE_RARITY_WEIGHTS, rarityQuality, rarityFloor).map((chance, index) => ({ rarity: CRAFT_RARITIES[index], chance }));
  const conditionFloor = Math.max(
    hasProfessionEffect(level, "tempering") ? CONDITION_NAMES.indexOf("Average") : 0,
    ...effectsOf("conditionFloor").map((effect) => CONDITION_NAMES.indexOf(effect.condition)),
  );
  const conditionOdds = weightedOdds(BASE_CONDITION_WEIGHTS, quality, conditionFloor);
  const conditionShift = Math.min(0, sum("conditionShift"));
  const minTier = Math.min(7, Math.max(Math.min(QUALITY_TIER_CAP, Math.floor(quality / QUALITY_PER_TIER)), ...effectsOf("subTierAll").map((effect) => effect.min)));
  const subTierMins = {};
  for (const effect of effectsOf("subTier")) subTierMins[effect.stat] = Math.max(subTierMins[effect.stat] || 0, effect.min);
  const guaranteed = [...new Set(effectsOf("substat").map((effect) => effect.stat))];
  const toolGuaranteed = [...new Set(effectsOf("toolSub").map((effect) => effect.stat))];
  const mainStatEffects = effectsOf("mainStat");
  const mainStat = mainStatEffects.length ? mainStatEffects[mainStatEffects.length - 1].stat : blueprint.stat;
  const mainBoost = sum("mainBoost") + (hasProfessionEffect(level, "attunement") ? 2 : 0);
  const abilityChance = sum("ability");
  const socket = effectsOf("socket").length > 0 || hasProfessionEffect(level, "socketcraft");
  const holofoilChance = Math.min(1, BASE_HOLOFOIL_CHANCE + sum("holofoil") + (hasProfessionEffect(level, "socketcraft") ? 0.01 : 0));
  const region = regionForTier(base.tier);
  let iLevel;
  if (blueprint.kind === "tool") {
    const caps = blueprint.parts.map((type) => Math.max(...reagents
      .map((key) => CRAFTING_MATERIALS[key].part)
      .filter((part) => part?.tool === blueprint.slot && part.type === type)
      .map((part) => part.cap)));
    iLevel = Math.max(1, Math.min(TOOL_MAX_ITEM_LEVEL, level, ...caps) + sum("iLevel"));
    iLevel = Math.min(TOOL_MAX_ITEM_LEVEL, level, iLevel);
  } else {
    iLevel = Math.min(100, Math.min(region.maxLevel, Math.max(region.minLevel, player.level || 1)) + sum("iLevel"));
  }
  const materialMythic = Math.min(MYTHIC_MATERIAL_CAP, sum("mythic"));
  const mythicChance = blueprint.kind === "tool"
    ? 0
    : Math.min(MYTHIC_CHANCE_CAP, getProfessionMythicChance(level) + tool.mythicChance + materialMythic);
  const expBonus = sum("exp") + tool.craftExp;
  const lowTierPenalty = base.tier < getOnLevelTier(level) - 1 ? 0.25 : 1;
  const exp = level >= 50 ? 0 : Math.round(
    CRAFT_BASE_EXP * TIER_EXP_MULT[base.tier - 1] * lowTierPenalty * (1 + 0.05 * reagents.length) *
      (1 + expBonus) * (blueprint.kind === "unique" ? 3 : 1),
  );
  const discount = Math.min(0.6, rates.astraDiscount + tool.astraDiscount);
  const astraCost = Math.max(1, Math.round(
    50 * TIER_EXP_MULT[base.tier - 1] ** 1.4 * (1 + 0.2 * reagents.length) * (blueprint.kind === "unique" ? 5 : 1) * (1 - discount),
  ));

  const analysis = {
    ok: true,
    blueprint, profession, professionName, baseKey, reagents, cost, astraCost, tool,
    active, inactive, reactions, suppressed, stabilized,
    quality, rarityQuality, rarityOdds, conditionOdds, conditionShift, minTier, subTierMins,
    guaranteed, toolGuaranteed, mainStat, mainBoost, abilityChance, socket, holofoilChance,
    iLevel, mythicChance, exp, lowTierPenalty, discoveryChance: Math.min(1, rates.discoveryChance + tool.discoveryChance),
  };
  if (missing.length)
    return { ...analysis, ok: false, message: `You need more ${missing.map(([key]) => MATERIALS[key]?.name || key).join(", ")}.` };
  if ((player.astra || 0) < astraCost)
    return { ...analysis, ok: false, message: `You need ${astraCost} astra to craft this.` };
  return analysis;
};

const rollCondition = (analysis) => {
  const index = rollIndex(analysis.conditionOdds);
  return CONDITION_NAMES[Math.max(0, index + analysis.conditionShift)];
};

export const craftItem = (player, selection) => {
  const a = analyzeCraft(player, selection);
  if (!a.ok) return a;
  const { blueprint } = a;
  let item;
  if (blueprint.kind !== "tool" && Math.random() < a.mythicChance) {
    item = createMythicItem({
      slot: blueprint.slot,
      baseName: blueprint.baseName,
      stat: a.mainStat,
      iLevel: a.iLevel,
      unique: blueprint.kind === "unique" ? { ...blueprint.unique, stat: a.mainStat } : undefined,
    });
  } else if (blueprint.kind === "unique") {
    item = createUniqueItem({ ...blueprint.unique, stat: a.mainStat }, a.iLevel, Math.random() < a.holofoilChance ? true : undefined);
  } else {
    const rarity = a.rarityOdds[rollIndex(a.rarityOdds.map((entry) => entry.chance))].rarity;
    const condition = rollCondition(a);
    const holofoil = Math.random() < a.holofoilChance ? true : undefined;
    item = blueprint.kind === "tool"
      ? createToolItem({ slot: blueprint.slot, iLevel: a.iLevel, rarity, condition, minTier: a.minTier, guaranteed: a.toolGuaranteed, holofoil })
      : createCraftedItem({
        slot: blueprint.slot,
        baseName: blueprint.baseName,
        stat: a.mainStat,
        rarity,
        condition,
        iLevel: a.iLevel,
        minTier: a.minTier,
        subTierMins: a.subTierMins,
        guaranteed: a.guaranteed,
        abilityChance: a.abilityChance,
        mainBoost: a.mainBoost,
        socketCount: rarity === "Epic" && a.socket ? 2 : undefined,
        holofoil,
      });
  }
  item = { ...item, crafted: true, craftedBy: blueprint.profession };

  // Tool preservation can save reagents; base and recipe materials are always consumed.
  const spent = { ...a.cost };
  const preserved = [];
  for (const key of a.reagents) {
    if (a.tool.materialPreservation > 0 && Math.random() < a.tool.materialPreservation) {
      spent[key] -= 1;
      preserved.push(key);
    }
  }
  for (const key of Object.keys(spent)) if (spent[key] <= 0) delete spent[key];

  const rarityIndex = Math.max(0, RESULT_RARITY_ORDER.indexOf(item.rarity));
  const exp = Math.round(a.exp * (1 + 0.05 * rarityIndex));
  const progress = addProfessionExp(player, blueprint.profession, exp);

  const book = getCraftingBook(player);
  const discoveries = [];
  for (const key of [...new Set([a.baseKey, ...a.reagents])]) {
    const properties = CRAFTING_MATERIALS[key].properties;
    const known = book.materials[key] || 0;
    if (known >= properties.length) continue;
    if (known === 0 || Math.random() < a.discoveryChance) {
      book.materials[key] = known + 1;
      discoveries.push({ key, effect: properties[known] });
    }
  }
  const newReactions = a.reactions.filter((id) => !book.reactions.includes(id));
  book.reactions = [...book.reactions, ...newReactions];

  const professionName = a.professionName;
  const messages = [`You crafted ${item.name}!`];
  if (item.rarity === "Mythic") messages.push("A Mythic item answers the forge!");
  if (exp) messages.push(`+${exp} ${professionName} exp.`);
  if (progress.levelsGained) messages.push(`${professionName} reached level ${progress.level}!`);
  if (preserved.length) messages.push(`Your tool preserved ${preserved.map((key) => MATERIALS[key].name).join(", ")}.`);
  return {
    ok: true,
    item,
    exp,
    levelsGained: progress.levelsGained,
    discoveries,
    reactions: a.reactions,
    newReactions,
    suppressed: a.suppressed,
    preserved,
    message: messages.join(" "),
    patch: {
      inventory: [...(player.inventory || []), item],
      materials: spendMaterials(player, spent),
      astra: (player.astra || 0) - a.astraCost,
      professions: progress.professions,
      craftingBook: book,
    },
  };
};
