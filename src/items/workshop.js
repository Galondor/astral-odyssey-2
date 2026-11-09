import { hasMaterials, spendMaterials } from "./materials";
import { KEY_ITEMS } from "./consumables";
import { recalculateStats } from "../character/stats";
import { REGIONS } from "../world/regions";

export const WORKSHOP_RANKS = [
  { region: "Meadowlands", priceScale: 1 },
  { region: "Meadowlands", levelOffset: 4, priceScale: 2 },
  { region: "Darkwood", priceScale: 5 },
  { region: "Darkwood", levelOffset: 5, priceScale: 9 },
  { region: "AshenPeaks", priceScale: 16 },
  { region: "TempestReach", priceScale: 32 },
  { region: "FrostfallRange", priceScale: 55 },
  { region: "SuncleftExpanse", priceScale: 90 },
  { region: "ShatteredFront", priceScale: 140 },
  { region: "ShatteredFront", levelOffset: 10, priceScale: 210 },
].map((rank) => ({
  ...rank,
  minLevel: REGIONS[rank.region].entryLevel + (rank.levelOffset || 0),
}));

// Ingredient lists are item-specific; only regional gates and price growth are shared.
const upgrade = (name, description, bonus, baseAstra, ingredients, { tier = "standard", firstLevel = 1 } = {}) => {
  const premium = tier !== "standard";
  const growth = tier === "attribute" ? 0.5 : premium ? 0.35 : 0;
  return {
    name, type: "upgrade", description, bonus, premium, limit: WORKSHOP_RANKS.length,
    ranks: WORKSHOP_RANKS.map(({ region, minLevel, priceScale }, index) => ({
      region,
      minLevel: Math.max(firstLevel, premium && index < 2 ? (index === 0 ? 5 : 8) : minLevel),
      cost: {
        astra: Math.ceil(baseAstra * priceScale * (1 + index * growth)),
        materials: ingredients[index],
      },
    })),
  };
};

export const RECIPES = {
  sharpeningStone: upgrade("Sharpening Stone", "+10 maximum attack per level.", { attackMax: 10 }, 75, [
    { goblin_scrap: 6, metal_scraps: 3 },
    { metal_scraps: 10, boar_tusk: 6, beast_fang: 2 },
    { metal_scraps: 12, rotwood_bark: 6, beast_fang: 4 },
    { metal_scraps: 18, rotwood_bark: 10, beast_fang: 6 },
    { obsidian_shard: 18, ember_core: 3, metal_scraps: 12 },
    { obsidian_shard: 24, abyssal_scale: 3, metal_scraps: 16 },
    { obsidian_shard: 30, rimebound_plate: 4, metal_scraps: 20 },
    { glassback_chitin: 5, obsidian_shard: 36, suncleft_scourge_fang: 16 },
    { war_hardened_insignia: 5, glassback_chitin: 6, metal_scraps: 30 },
    { commanders_crest: 1, buried_wyrm_scale: 1, glassback_chitin: 8, obsidian_shard: 50 },
  ], { firstLevel: 3 }),
  arcanebattery: upgrade("Arcane Battery", "+10 maximum magic attack per level.", { magicAttackMax: 10 }, 80, [
    { slime_gel: 6, metal_scraps: 3 },
    { slime_gel: 10, metal_scraps: 6, primal_essence: 1 },
    { slime_gel: 12, rotwood_bark: 6, primal_essence: 2 },
    { wraith_essence: 9, rotwood_bark: 16 },
    { obsidian_shard: 18, ember_core: 3, slime_gel: 12 },
    { obsidian_shard: 24, abyssal_scale: 3, ember_core: 4 },
    { rimebound_plate: 4, wraith_essence: 8, slime_gel: 18 },
    { glassback_chitin: 5, obsidian_shard: 36, ember_core: 4 },
    { war_hardened_insignia: 5, glassback_chitin: 6, wraith_essence: 8 },
    { commanders_crest: 1, glacier_core: 1, wraith_essence: 20, obsidian_shard: 50 },
  ], { firstLevel: 3 }),
  hardenedHide: upgrade("Hardened Hide", "+10 defense per level.", { defense: 10 }, 225, [
    { wolf_pelt: 8, leather: 8, boar_tusk: 3 },
    { wolf_pelt: 14, leather: 12, beast_fang: 3 },
    { rotwood_bark: 14, leather: 18, spider_silk: 6 },
    { rotwood_bark: 22, leather: 24, spider_silk: 12 },
    { obsidian_shard: 20, leather: 28, ember_core: 4 },
    { abyssal_scale: 5, leather: 34, spider_silk: 16 },
    { rimebound_plate: 6, frostfang_pelt: 22, leather: 40 },
    { glassback_chitin: 7, leather: 48, rimebound_plate: 4 },
    { war_hardened_insignia: 8, metal_scraps: 35, leather: 55 },
    { commanders_crest: 1, buried_wyrm_scale: 1, rimebound_plate: 10, leather: 70 },
  ], { firstLevel: 3 }),
  silkLining: upgrade("Silk Lining", "+0.5% evasion per level.", { evasion: 0.005 }, 180, [
    { leather: 6, wolf_pelt: 4, slime_gel: 4 },
    { leather: 10, wolf_pelt: 8, living_thatch: 2 },
    { spider_silk: 14, leather: 12, slime_gel: 8 },
    { spider_silk: 22, widow_heart: 1, leather: 16 },
    { spider_silk: 30, obsidian_shard: 12, leather: 20 },
    { spider_silk: 38, abyssal_scale: 3, leather: 24 },
    { frostfang_pelt: 20, spider_silk: 46, leather: 28 },
    { glassback_chitin: 4, spider_silk: 55, leather: 32 },
    { war_hardened_insignia: 4, spider_silk: 65, leather: 38 },
    { commanders_crest: 1, widow_heart: 1, spider_silk: 80, frostfang_pelt: 30 },
  ], { firstLevel: 2 }),
  vitalityTonic: upgrade("Vitality Tonic", "+25 maximum health per level.", { maxHealth: 25 }, 125, [
    { slime_gel: 10 },
    { slime_gel: 18, primal_essence: 2, gelatinous_core: 1 },
    { slime_gel: 24, rotwood_bark: 10, venom_sac: 2 },
    { slime_gel: 30, wraith_essence: 4, widow_heart: 1 },
    { ember_core: 5, primal_essence: 4, slime_gel: 36 },
    { leviathan_heart: 1, primal_essence: 6, slime_gel: 45 },
    { glacier_core: 1, primal_essence: 8, slime_gel: 55 },
    { buried_wyrm_scale: 1, venom_sac: 12, slime_gel: 65 },
    { war_hardened_insignia: 4, primal_essence: 12, slime_gel: 80 },
    { commanders_crest: 1, leviathan_heart: 1, gelatinous_core: 1, primal_essence: 16 },
  ]),
  essenceVessel: upgrade("Essence Vessel", "+2 maximum power per level.", { maxPower: 2 }, 160, [
    { slime_gel: 6, boar_tusk: 4 },
    { gelatinous_core: 1, primal_essence: 2, boar_tusk: 8 },
    { rotwood_bark: 12, primal_essence: 3, slime_gel: 16 },
    { wraith_essence: 8, wraith_crown: 1, rotwood_bark: 18 },
    { obsidian_shard: 18, ember_core: 8, wraith_essence: 10 },
    { abyssal_scale: 4, leviathan_heart: 1, wraith_essence: 12 },
    { rimebound_plate: 5, glacier_core: 1, wraith_essence: 16 },
    { glassback_chitin: 6, buried_wyrm_scale: 1, ember_core: 12 },
    { war_hardened_insignia: 6, wraith_essence: 22, primal_essence: 10 },
    { commanders_crest: 1, glacier_core: 1, wraith_crown: 1, wraith_essence: 30 },
  ], { firstLevel: 2 }),
  enduranceCharm: upgrade("Endurance Charm", "+2 maximum stamina per level.", { maxStamina: 2 }, 300, [
    { boar_tusk: 5, beast_fang: 3, leather: 6 },
    { boar_tusk: 10, beast_fang: 5, primal_essence: 2 },
    { rotwood_bark: 14, spider_silk: 10, primal_essence: 3 },
    { wraith_essence: 5, spider_silk: 18, primal_essence: 4 },
    { ember_core: 6, infernal_heart: 1, beast_fang: 12 },
    { leviathan_heart: 1, abyssal_scale: 4, primal_essence: 6 },
    { frostfang_pelt: 24, glacier_core: 1, primal_essence: 8 },
    { suncleft_scourge_fang: 25, buried_wyrm_scale: 1, primal_essence: 10 },
    { salvaged_dog_tag: 30, war_hardened_insignia: 6, primal_essence: 12 },
    { commanders_crest: 1, leviathan_heart: 1, primal_essence: 16, beast_fang: 30 },
  ], { firstLevel: 3 }),
  powerBracers: upgrade("Power Bracers", "+5 strength per level.", { strength: 5 }, 1800, [
    { beast_fang: 6, primal_essence: 3, leather: 12, metal_scraps: 8 },
    { beast_fang: 10, primal_essence: 5, leather: 20, metal_scraps: 14 },
    { rotwood_bark: 24, primal_essence: 8, leather: 30, metal_scraps: 20 },
    { wraith_crown: 2, primal_essence: 12, rotwood_bark: 36, leather: 44 },
    { infernal_heart: 3, ember_core: 18, metal_scraps: 40, leather: 55 },
    { leviathan_heart: 4, abyssal_scale: 18, metal_scraps: 55, leather: 70 },
    { glacier_core: 5, rimebound_plate: 24, frostfang_pelt: 45, leather: 90 },
    { buried_wyrm_scale: 6, glassback_chitin: 30, suncleft_scourge_fang: 65, leather: 110 },
    { commanders_crest: 7, war_hardened_insignia: 36, metal_scraps: 110, leather: 140 },
    { commanders_crest: 10, buried_wyrm_scale: 8, war_hardened_insignia: 50, primal_essence: 40 },
  ], { tier: "attribute" }),
  precisionGrips: upgrade("Precision Grips", "+5 dexterity per level.", { dexterity: 5 }, 1850, [
    { leather: 16, living_thatch: 2, primal_essence: 2, beast_fang: 4 },
    { leather: 26, living_thatch: 3, primal_essence: 3, beast_fang: 8 },
    { spider_silk: 30, venom_sac: 8, leather: 36, primal_essence: 7 },
    { widow_heart: 2, spider_silk: 40, venom_sac: 20, leather: 40 },
    { infernal_heart: 3, obsidian_shard: 35, spider_silk: 60, leather: 65 },
    { abyssal_scale: 20, leviathan_heart: 4, spider_silk: 80, leather: 85 },
    { frostfang_pelt: 45, rimebound_plate: 24, glacier_core: 5, spider_silk: 50, leather: 40 },
    { glassback_chitin: 30, buried_wyrm_scale: 6, spider_silk: 100, leather: 75 },
    { war_hardened_insignia: 36, commanders_crest: 7, spider_silk: 140, leather: 110 },
    { commanders_crest: 10, widow_heart: 8, glassback_chitin: 50, spider_silk: 150 },
  ], { tier: "attribute" }),
  scholarsLens: upgrade("Scholar's Lens", "+5 intelligence per level.", { intelligence: 5 }, 1900, [
    { living_thatch: 2, primal_essence: 3, slime_gel: 16, metal_scraps: 8 },
    { living_thatch: 3, primal_essence: 5, slime_gel: 24, metal_scraps: 14 },
    { rotwood_bark: 24, primal_essence: 8, slime_gel: 30, metal_scraps: 20 },
    { wraith_crown: 2, wraith_essence: 20, rotwood_bark: 36, metal_scraps: 44 },
    { obsidian_shard: 40, ember_core: 18, infernal_heart: 3, wraith_essence: 14 },
    { leviathan_heart: 4, abyssal_scale: 18, obsidian_shard: 55, wraith_essence: 18 },
    { glacier_core: 5, rimebound_plate: 24, obsidian_shard: 45, wraith_essence: 22 },
    { buried_wyrm_scale: 6, glassback_chitin: 30, obsidian_shard: 65, wraith_essence: 28 },
    { commanders_crest: 7, war_hardened_insignia: 36, obsidian_shard: 110, wraith_essence: 35 },
    { commanders_crest: 10, wraith_crown: 8, glassback_chitin: 50, wraith_essence: 40 },
  ], { tier: "attribute" }),
  fortuneCharm: upgrade("Fortune Charm", "+5 luck per level.", { luck: 5 }, 1000, [
    { living_thatch: 4, boar_tusk: 10, primal_essence: 2 },
    { living_thatch: 7, beast_fang: 8, primal_essence: 4 },
    { spider_silk: 20, venom_sac: 6, living_thatch: 10 },
    { wraith_crown: 2, widow_heart: 2, living_thatch: 14 },
    { infernal_heart: 2, obsidian_shard: 28, living_thatch: 18 },
    { bilge_raider_insignia: 40, leviathan_heart: 3, living_thatch: 24 },
    { glacier_core: 3, rimebound_plate: 14, living_thatch: 30 },
    { buried_wyrm_scale: 4, suncleft_scourge_fang: 50, living_thatch: 38 },
    { salvaged_dog_tag: 65, commanders_crest: 4, war_hardened_insignia: 20 },
    { commanders_crest: 6, wraith_crown: 5, living_thatch: 60, primal_essence: 30 },
  ], { tier: "premium" }),
  warriorsWhetstone: upgrade("Warrior's Whetstone", "+3% increased attack per level.", { attackPercent: 0.03 }, 800, [
    { beast_fang: 5, primal_essence: 2, metal_scraps: 10, boar_tusk: 8 },
    { beast_fang: 8, primal_essence: 4, metal_scraps: 18, boar_tusk: 14 },
    { rotwood_bark: 18, beast_fang: 12, primal_essence: 6, metal_scraps: 26 },
    { wraith_crown: 2, beast_fang: 16, primal_essence: 8, metal_scraps: 36 },
    { obsidian_shard: 32, infernal_heart: 2, ember_core: 12, metal_scraps: 46 },
    { abyssal_scale: 12, leviathan_heart: 2, obsidian_shard: 42, metal_scraps: 58 },
    { rimebound_plate: 16, glacier_core: 3, obsidian_shard: 55, metal_scraps: 72 },
    { glassback_chitin: 22, buried_wyrm_scale: 3, obsidian_shard: 70, metal_scraps: 90 },
    { war_hardened_insignia: 28, commanders_crest: 4, glassback_chitin: 28, metal_scraps: 110 },
    { commanders_crest: 6, buried_wyrm_scale: 5, glassback_chitin: 36, obsidian_shard: 100 },
  ], { tier: "premium" }),
  resonantPrism: upgrade("Resonant Prism", "+3% increased magic attack per level.", { magicAttackPercent: 0.03 }, 825, [
    { living_thatch: 2, primal_essence: 2, slime_gel: 14, metal_scraps: 8 },
    { living_thatch: 3, primal_essence: 4, slime_gel: 24, metal_scraps: 12 },
    { rotwood_bark: 18, primal_essence: 8, slime_gel: 34 },
    { wraith_essence: 14, wraith_crown: 2, primal_essence: 9 },
    { obsidian_shard: 32, ember_core: 18, infernal_heart: 2, metal_scraps: 22 },
    { leviathan_heart: 2, abyssal_scale: 12, ember_core: 25 },
    { glacier_core: 3, rimebound_plate: 16, wraith_essence: 32 },
    { buried_wyrm_scale: 3, glassback_chitin: 22, ember_core: 40 },
    { commanders_crest: 4, war_hardened_insignia: 28, wraith_essence: 85 },
    { commanders_crest: 6, glacier_core: 5, glassback_chitin: 36, wraith_essence: 25 },
  ], { tier: "premium" }),
  quicksilverSpurs: upgrade("Quicksilver Spurs", "+10 speed per level.", { speed: 10 }, 1300, [
    { beast_fang: 6, primal_essence: 2, leather: 12, metal_scraps: 8 },
    { beast_fang: 10, primal_essence: 4, leather: 20, metal_scraps: 14 },
    { spider_silk: 24, venom_sac: 6, leather: 28, metal_scraps: 20 },
    { widow_heart: 2, spider_silk: 36, leather: 38, metal_scraps: 28 },
    { obsidian_shard: 28, ember_core: 12, leather: 48, metal_scraps: 36 },
    { abyssal_scale: 14, bilge_raider_insignia: 35, leather: 60, metal_scraps: 46 },
    { frostfang_pelt: 40, rimebound_plate: 18, leather: 75, metal_scraps: 58 },
    { suncleft_scourge_fang: 55, glassback_chitin: 24, leather: 90, metal_scraps: 72 },
    { war_hardened_insignia: 30, commanders_crest: 3, leather: 110, metal_scraps: 90 },
    { commanders_crest: 5, leviathan_heart: 4, spider_silk: 110, metal_scraps: 120 },
  ], { tier: "premium" }),
  deadeyeSight: upgrade("Deadeye Sight", "+1% critical hit chance per level.", { criticalHitChance: 0.01 }, 1100, [
    { beast_fang: 5, living_thatch: 3, boar_tusk: 8, metal_scraps: 6 },
    { beast_fang: 9, living_thatch: 5, boar_tusk: 14, metal_scraps: 12 },
    { spider_silk: 22, venom_sac: 7, beast_fang: 12, metal_scraps: 20 },
    { widow_heart: 2, wraith_crown: 1, spider_silk: 32, metal_scraps: 28 },
    { obsidian_shard: 30, ember_core: 10, primal_essence: 10, metal_scraps: 36 },
    { abyssal_scale: 13, leviathan_heart: 2, obsidian_shard: 40, metal_scraps: 46 },
    { rimebound_plate: 17, glacier_core: 3, obsidian_shard: 52, metal_scraps: 58 },
    { glassback_chitin: 23, buried_wyrm_scale: 3, obsidian_shard: 66, metal_scraps: 72 },
    { war_hardened_insignia: 29, commanders_crest: 4, glassback_chitin: 28, metal_scraps: 90 },
    { commanders_crest: 6, wraith_crown: 4, glassback_chitin: 36, metal_scraps: 115 },
  ], { tier: "premium" }),
  executionersSeal: upgrade("Executioner's Seal", "+5% critical damage per level.", { criticalDamageBonus: 0.05 }, 1200, [
    { beast_fang: 7, primal_essence: 2, boar_tusk: 12 },
    { beast_fang: 12, primal_essence: 4, boar_tusk: 20 },
    { venom_sac: 9, beast_fang: 16, rotwood_bark: 18 },
    { wraith_crown: 2, venom_sac: 14, beast_fang: 22 },
    { infernal_heart: 2, obsidian_shard: 32, beast_fang: 28 },
    { leviathan_heart: 3, abyssal_scale: 15, beast_fang: 36 },
    { glacier_core: 3, rimebound_plate: 19, beast_fang: 45 },
    { buried_wyrm_scale: 4, suncleft_scourge_fang: 65, glassback_chitin: 24 },
    { commanders_crest: 4, war_hardened_insignia: 30, suncleft_scourge_fang: 85 },
    { commanders_crest: 7, buried_wyrm_scale: 5, wraith_crown: 4, beast_fang: 70 },
  ], { tier: "premium" }),
  wardedGorget: upgrade("Warded Gorget", "+1% critical resistance per level.", { criticalResistance: 0.01 }, 850, [
    { living_thatch: 3, primal_essence: 2, leather: 14, metal_scraps: 8 },
    { living_thatch: 5, primal_essence: 4, leather: 24, metal_scraps: 14 },
    { rotwood_bark: 24, spider_silk: 14, primal_essence: 6, leather: 34 },
    { wraith_crown: 2, wraith_essence: 10, spider_silk: 22, leather: 46 },
    { obsidian_shard: 30, infernal_heart: 2, leather: 58, metal_scraps: 32 },
    { abyssal_scale: 16, leviathan_heart: 2, leather: 72, metal_scraps: 42 },
    { rimebound_plate: 22, glacier_core: 3, frostfang_pelt: 35, leather: 88 },
    { glassback_chitin: 28, buried_wyrm_scale: 3, rimebound_plate: 15, leather: 108 },
    { war_hardened_insignia: 34, commanders_crest: 4, metal_scraps: 80, leather: 130 },
    { commanders_crest: 6, glacier_core: 5, rimebound_plate: 35, leather: 165 },
  ], { tier: "premium" }),
  purifyingFilter: upgrade("Purifying Filter", "+2% status resistance per level.", { statusResistance: 0.02 }, 1250, [
    { slime_gel: 16, living_thatch: 4, gelatinous_core: 1 },
    { slime_gel: 26, living_thatch: 7, gelatinous_core: 2 },
    { venom_sac: 10, spider_silk: 24, slime_gel: 36 },
    { venom_sac: 16, widow_heart: 2, wraith_essence: 10, spider_silk: 34 },
    { ember_core: 16, infernal_heart: 2, spider_silk: 46, slime_gel: 55 },
    { abyssal_scale: 15, leviathan_heart: 3, venom_sac: 24, spider_silk: 60 },
    { glacier_core: 3, frostfang_pelt: 35, venom_sac: 30, spider_silk: 76 },
    { glassback_chitin: 25, buried_wyrm_scale: 4, venom_sac: 38, spider_silk: 94 },
    { war_hardened_insignia: 31, commanders_crest: 4, venom_sac: 48, spider_silk: 115 },
    { commanders_crest: 6, widow_heart: 5, glacier_core: 5, venom_sac: 65, spider_silk: 145 },
  ], { tier: "premium" }),
  analyzer: {
    name: "Analyzer",
    type: "key",
    item: "analyzer",
    region: "Darkwood",
    cost: { astra: 800, materials: { wolf_pelt: 6, spider_silk: 4, goblin_scrap: 8, primal_essence: 1 } },
  },
  gatherersCompass: {
    name: "Gatherer's Compass",
    type: "key",
    item: "gatherersCompass",
    region: "Meadowlands",
    cost: { astra: 9000, materials: { metal_scraps: 50, meadow_oak: 50, meadow_flax: 6, copper_nugget: 6 } },
  },
  oreDiviner: {
    name: "Ore Diviner",
    type: "key",
    item: "oreDiviner",
    region: "Meadowlands",
    cost: { astra: 4500, materials: { metal_scraps: 30, copper_nugget: 10 } },
  },
  forestersMap: {
    name: "Forester's Map",
    type: "key",
    item: "forestersMap",
    region: "Meadowlands",
    cost: { astra: 4500, materials: { meadow_oak: 30, meadow_flax: 10 } },
  },
  travelersPack: {
    name: "Traveler's Pack",
    type: "key",
    item: "travelersPack",
    region: "Meadowlands",
    cost: { astra: 1000, materials: { wolf_pelt: 16, gelatinous_core: 1 } },
  },
  scavengersSatchel: {
    name: "Scavenger's Satchel",
    type: "key",
    item: "scavengersSatchel",
    region: "Darkwood",
    cost: { astra: 3000, materials: { spider_silk: 30, widow_heart: 1 } },
  },
  huntersHorn: {
    name: "Hunter's Horn",
    type: "key",
    item: "huntersHorn",
    region: "AshenPeaks",
    cost: { astra: 2000, materials: { boar_tusk: 20, beast_fang: 8, infernal_heart: 1 } },
  },
  wayfindersCompass: {
    name: "Wayfinder's Compass",
    type: "key",
    item: "wayfindersCompass",
    region: "AshenPeaks",
    cost: { astra: 4000, materials: { obsidian_shard: 25, wraith_crown: 1 } },
  },
  medicKit: {
    name: "Field Medic's Kit",
    type: "key",
    item: "medicKit",
    region: "Darkwood",
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

const getNextRank = (player, key) => {
  const recipe = RECIPES[key];
  return recipe.ranks[Math.min(getCraftedCount(player, key), recipe.limit - 1)];
};

export const getRecipeRequirement = (player, key) => {
  const recipe = RECIPES[key];
  if (recipe.type === "upgrade") {
    const { region, minLevel } = getNextRank(player, key);
    return { region, minLevel };
  }
  return { region: recipe.region, minLevel: REGIONS[recipe.region].entryLevel };
};

export const getRecipeCost = (player, key) => {
  const r = RECIPES[key];
  return r.type === "upgrade" ? getNextRank(player, key).cost : r.cost;
};

export const canAfford = (player, key) => {
  if (!RECIPES[key] || isMaxed(player, key)) return false;
  if ((player?.level || 1) < getRecipeRequirement(player, key).minLevel) return false;
  const cost = getRecipeCost(player, key);
  return (player?.astra || 0) >= cost.astra && hasMaterials(player, cost.materials);
};

// Returns { ok, message, patch }; the caller applies the patch with setPlayer.
export function craft(player, key) {
  const r = RECIPES[key];
  if (!r) return { ok: false, message: "Unknown recipe." };
  if (isMaxed(player, key))
    return { ok: false, message: r.type === "key" ? `You already own the ${r.name}.` : `The ${r.name} cannot be improved further.` };
  const requirement = getRecipeRequirement(player, key);
  if ((player?.level || 1) < requirement.minLevel)
    return { ok: false, message: `You must reach level ${requirement.minLevel} (${REGIONS[requirement.region].name}) to craft the ${r.name}.` };
  const cost = getRecipeCost(player, key);
  if ((player.astra || 0) < cost.astra)
    return { ok: false, message: `You need ${cost.astra} {{astra|astra}} to craft the ${r.name}.` };
  if (!hasMaterials(player, cost.materials))
    return { ok: false, message: `You lack the materials to craft the ${r.name}.` };

  const base = {
    workshopVersion: 2,
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
    message: `The Workshop completes your ${r.name} (level ${base.crafted[key]}/${r.limit}). ${r.description}`,
    patch: recalculateStats(player, { ...base, bonusStats }),
  };
}
