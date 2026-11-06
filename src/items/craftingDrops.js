import { REGIONS } from "../world/regions";
import { CRAFTING_MATERIALS, REGION_TIERS } from "./craftingMaterials";

/*
 Material Crafting drops, rolled on top of an enemy's own drop table.
 Overworld enemies use their region's tier; dungeon enemies use the region whose level range fits them.
 Colosseum, Labyrinth, and World Boss fights keep their own reward rules.
 Ore and wood are gathered instead; old direct Metal Scraps/Rotwood Bark drops are preserved.
   basic - 2 random families (40%, 1-2)
   elite - 3 random families (55%, 1-3), 10% tool part, 5% catalyst
   boss  - 4 random families (70%, 2-4), 30% tool part, 15% catalyst, 1% Mythos Fragment (dungeons or level 55+)
*/
const FAMILIES = ["hide", "cloth", "precious", "gem"];
const DROP_RATES = {
  basic: { families: 2, chance: 0.4, min: 1, max: 2, part: 0, catalyst: 0 },
  elite: { families: 3, chance: 0.55, min: 1, max: 3, part: 0.1, catalyst: 0.05 },
  boss: { families: 4, chance: 0.7, min: 2, max: 4, part: 0.3, catalyst: 0.15 },
};
export const MYTHOS_FRAGMENT_CHANCE = 0.01;
export const PRIMORDIAL_SPARK_CHANCE = 0.005;
export const CATALYSTS = Object.keys(CRAFTING_MATERIALS).filter((key) => CRAFTING_MATERIALS[key].family === "catalyst");
const PARTS = Object.keys(CRAFTING_MATERIALS).filter((key) =>
  CRAFTING_MATERIALS[key].family === "part" && !CRAFTING_MATERIALS[key].craftOnly);

const randBetween = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export const getFamilyMaterial = (tier, family) =>
  Object.keys(CRAFTING_MATERIALS).find((key) => CRAFTING_MATERIALS[key].tier === tier && CRAFTING_MATERIALS[key].family === family);

export const getPartTier = (tier) => (tier <= 2 ? 1 : tier <= 4 ? 3 : 5);
export const getTierParts = (tier) => PARTS.filter((key) => CRAFTING_MATERIALS[key].tier === getPartTier(tier));

export const getEnemyCraftingTier = (enemy) => {
  const regionIndex = REGION_TIERS.indexOf(enemy?.region);
  if (regionIndex >= 0) return regionIndex + 1;
  const level = Math.max(1, Number(enemy?.level) || 1);
  const index = REGION_TIERS.findIndex((id) => level <= REGIONS[id].maxLevel);
  return (index >= 0 ? index : REGION_TIERS.length - 1) + 1;
};

const add = (out, key, amount) => {
  if (key && amount > 0) out[key] = (out[key] || 0) + amount;
};

export const rollCraftingDrops = (enemy, chanceBonus = 0) => {
  const out = {};
  if (!enemy || enemy.colosseum || enemy.labyrinth || enemy.worldBossCycle) return out;
  const rates = DROP_RATES[enemy.tier];
  if (!rates) return out;
  const tier = getEnemyCraftingTier(enemy);
  const families = [...FAMILIES];
  for (let i = 0; i < rates.families; i++) {
    const family = families.splice(Math.floor(Math.random() * families.length), 1)[0];
    if (Math.random() < Math.min(1, rates.chance + chanceBonus))
      add(out, getFamilyMaterial(tier, family), randBetween(rates.min, rates.max));
  }
  if (rates.part && Math.random() < rates.part) add(out, pick(getTierParts(tier)), 1);
  if (rates.catalyst && Math.random() < rates.catalyst) add(out, pick(CATALYSTS), 1);
  if (enemy.tier === "boss" && (enemy.dungeon || (enemy.level || 1) >= 55) && Math.random() < MYTHOS_FRAGMENT_CHANCE)
    add(out, "mythos_fragment", 1);
  return out;
};

// Group dungeon clears and World Boss contributions: high-tier parts, catalysts, and the rare Primordial Spark.
export const rollEndgameCraftingDrops = ({ partChance = 0.3, catalystChance = 0.25 } = {}) => {
  const out = {};
  if (Math.random() < partChance) add(out, pick(getTierParts(7)), 1);
  if (Math.random() < catalystChance) add(out, pick(CATALYSTS), 1);
  if (Math.random() < PRIMORDIAL_SPARK_CHANCE) add(out, "primordial_spark", 1);
  return out;
};
