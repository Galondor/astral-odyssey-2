import { hasMaterials, spendMaterials } from "./materials";
import { KEY_ITEMS } from "./consumables";
import { recalculateStats } from "../character/stats";

/*
 Workshop recipes. Crafting costs astra plus materials.
   upgrade - permanent bonus (`bonus` is added to player.bonusStats); repeatable up to `limit`,
             each purchase raising the cost by COST_GROWTH.
   key     - a key item from KEY_ITEMS; can be crafted once.
 The player saves `crafted` ({ recipeKey: timesCrafted }).
*/
const COST_GROWTH = 0.5;

export const RECIPES = {
  sharpeningStone: {
    name: "Sharpening Stone",
    type: "upgrade",
    description: "+5 maximum attack.",
    cost: { astra: 50, materials: { goblin_scrap: 6 } },
    bonus: { attackMax: 5 },
    limit: 5,
  },
  arcanebattery: {
    name: "Arcane Battery",
    type: "upgrade",
    description: "+5 maximum magic attack.",
    cost: { astra: 50, materials: { rotwood_bark: 6 } },
    bonus: { magicAttackMax: 5 },
    limit: 5,
  },
  hardenedHide: {
    name: "Hardened Hide",
    type: "upgrade",
    description: "+1 defense.",
    cost: { astra: 150, materials: { wolf_pelt: 10, boar_tusk: 1 } },
    bonus: { defense: 1 },
    limit: 5,
  },
  silkLining: {
    name: "Silk Lining",
    type: "upgrade",
    description: "+1% evasion.",
    cost: { astra: 125, materials: { spider_silk: 8 } },
    bonus: { evasion: 0.01 },
    limit: 5,
  },
  vitalityTonic: {
    name: "Vitality Tonic",
    type: "upgrade",
    description: "+20 maximum health.",
    cost: { astra: 100, materials: { slime_gel: 10 } },
    bonus: { maxHealth: 20 },
    limit: 10,
  },
  essenceVessel: {
    name: "Essence Vessel",
    type: "upgrade",
    description: "+2 maximum power.",
    cost: { astra: 200, materials: { wraith_essence: 6, obsidian_shard: 3 } },
    bonus: { maxPower: 2 },
    limit: 3,
  },
  enduranceCharm: {
    name: "Endurance Charm",
    type: "upgrade",
    description: "+1 maximum stamina.",
    cost: { astra: 200, materials: { beast_fang: 7, primal_essence: 1 } },
    bonus: { maxStamina: 1 },
    limit: 3,
  },
  analyzer: {
    name: "Analyzer",
    type: "key",
    item: "analyzer",
    cost: { astra: 800, materials: { wolf_pelt: 6, spider_silk: 4, goblin_scrap: 8, primal_essence: 1 } },
  },
  travelersPack: {
    name: "Traveler's Pack",
    type: "key",
    item: "travelersPack",
    cost: { astra: 1000, materials: { wolf_pelt: 16, gelatinous_core: 1 } },
  },
  scavengersSatchel: {
    name: "Scavenger's Satchel",
    type: "key",
    item: "scavengersSatchel",
    cost: { astra: 3000, materials: { spider_silk: 30, widow_heart: 1 } },
  },
  huntersHorn: {
    name: "Hunter's Horn",
    type: "key",
    item: "huntersHorn",
    cost: { astra: 2000, materials: { boar_tusk: 20, beast_fang: 8, infernal_heart: 1 } },
  },
  wayfindersCompass: {
    name: "Wayfinder's Compass",
    type: "key",
    item: "wayfindersCompass",
    cost: { astra: 4000, materials: { obsidian_shard: 25, wraith_crown: 1 } },
  },
  medicKit: {
    name: "Field Medic's Kit",
    type: "key",
    item: "medicKit",
    cost: { astra: 5000, materials: { venom_sac: 60, slime_gel: 100, gelatinous_core: 2 } },
  },
};

export const getCraftedCount = (player, key) => player?.crafted?.[key] || 0;

export const isMaxed = (player, key) => {
  const r = RECIPES[key];
  return r.type === "key"
    ? (player?.keyItems || []).includes(r.item)
    : getCraftedCount(player, key) >= r.limit;
};

export const getRecipeCost = (player, key) => {
  const r = RECIPES[key];
  const scale = r.type === "upgrade" ? 1 + COST_GROWTH * getCraftedCount(player, key) : 1;
  return {
    astra: Math.ceil(r.cost.astra * scale),
    materials: Object.fromEntries(
      Object.entries(r.cost.materials).map(([m, n]) => [m, Math.ceil(n * scale)]),
    ),
  };
};

export const canAfford = (player, key) => {
  const cost = getRecipeCost(player, key);
  return (player?.astra || 0) >= cost.astra && hasMaterials(player, cost.materials);
};

// Returns { ok, message, patch }; the caller applies the patch with setPlayer.
export function craft(player, key) {
  const r = RECIPES[key];
  if (!r) return { ok: false, message: "Unknown recipe." };
  if (isMaxed(player, key))
    return { ok: false, message: r.type === "key" ? `You already own the ${r.name}.` : `The ${r.name} cannot be improved further.` };
  const cost = getRecipeCost(player, key);
  if ((player.astra || 0) < cost.astra)
    return { ok: false, message: `You need ${cost.astra} {{astra|astra}} to craft the ${r.name}.` };
  if (!hasMaterials(player, cost.materials))
    return { ok: false, message: `You lack the materials to craft the ${r.name}.` };

  const base = {
    astra: player.astra - cost.astra,
    materials: spendMaterials(player, cost.materials),
    crafted: { ...player.crafted, [key]: getCraftedCount(player, key) + 1 },
  };
  if (r.type === "key")
    return {
      ok: true,
      message: `You craft the ${KEY_ITEMS[r.item].name}. ${KEY_ITEMS[r.item].description}`,
      patch: { ...base, keyItems: [...(player.keyItems || []), r.item] },
    };

  const bonusStats = { ...player.bonusStats };
  for (const [k, v] of Object.entries(r.bonus)) bonusStats[k] = (bonusStats[k] || 0) + v;
  return {
    ok: true,
    message: `The Workshop completes your ${r.name}. ${r.description}`,
    patch: recalculateStats(player, { ...base, bonusStats }),
  };
}
