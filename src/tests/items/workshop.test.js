import { STAT_INFO, calculateStats } from "../../character/stats";
import { ENEMIES } from "../../combat/enemies";
import { MATERIALS } from "../../items/materials";
import {
  RECIPES, WORKSHOP_RANKS, canAfford, craft, getRecipeCost,
  getRecipeRequirement, isMaxed,
} from "../../items/workshop";
import { REGIONS, REGION_ORDER } from "../../world/regions";

jest.mock("../../firebase", () => ({ db: {} }));

const playerAt = (level = 100, crafted = {}) => ({
  level, crafted, astra: 1000000, workshopVersion: 2,
  baseStats: { strength: 2, dexterity: 2, intelligence: 2 },
  bonusStats: {}, stats: {}, materials: {},
});
const funded = (key, rank = 0, level = 100) => {
  const player = playerAt(level, { [key]: rank });
  const cost = getRecipeCost(player, key);
  return { ...player, astra: cost.astra, materials: { ...cost.materials } };
};
const upgrades = Object.entries(RECIPES).filter(([, recipe]) => recipe.type === "upgrade");

test("workshop covers supported stats except removed secondary attributes, minimum attacks and gear score", () => {
  const expected = Object.keys(STAT_INFO).filter(
    (key) => !["attackMin", "magicAttackMin", "gearScore", "vitality", "resilience", "agility"].includes(key),
  );
  const stats = upgrades.flatMap(([, recipe]) => Object.keys(recipe.bonus));
  expect([...new Set(stats)].sort()).toEqual(expected.sort());
  expect(stats).not.toContain("attack");
  expect(stats).not.toContain("magicAttack");
  expect(upgrades.every(([, recipe]) => recipe.limit === 10)).toBe(true);
});

test("rank progression spans all regions and derives entry levels from the region rules", () => {
  expect([...new Set(WORKSHOP_RANKS.map((rank) => rank.region))]).toEqual(REGION_ORDER);
  expect(WORKSHOP_RANKS.map((rank) => rank.minLevel)).toEqual([1, 5, 10, 15, 20, 40, 55, 70, 85, 95]);
  for (const [key] of upgrades) {
    let previousAstra = 0;
    for (let rank = 0; rank < 10; rank += 1) {
      const player = playerAt(100, { [key]: rank });
      const requirement = getRecipeRequirement(player, key);
      const cost = getRecipeCost(player, key);
      expect(requirement.minLevel).toBeGreaterThanOrEqual(REGIONS[requirement.region].entryLevel);
      expect(cost.astra).toBeGreaterThan(previousAstra);
      previousAstra = cost.astra;
      for (const [material, count] of Object.entries(cost.materials)) {
        expect(MATERIALS[material]).toBeDefined();
        expect(Number.isInteger(count) && count > 0).toBe(true);
        const sources = ENEMIES.filter((enemy) => enemy.drops?.some((drop) => drop.key === material));
        const accessible = sources.some((enemy) => !enemy.eventOnly && enemy.regions.some(
          (region) => REGIONS[region].entryLevel <= requirement.minLevel,
        ) && enemy.level <= requirement.minLevel);
        expect(accessible ? null : `${key} rank ${rank + 1}: ${material} is not obtainable yet`).toBeNull();
        if (MATERIALS[material].tier === "legendary" && !RECIPES[key].premium) expect(count).toBe(1);
      }
    }
  }
});

test("requested bonuses and removed recipes match the new balance exactly", () => {
  const expected = {
    hardenedHide: { defense: 10 }, enduranceCharm: { maxStamina: 2 },
    powerBracers: { strength: 5 }, precisionGrips: { dexterity: 5 }, scholarsLens: { intelligence: 5 },
    fortuneCharm: { luck: 5 }, warriorsWhetstone: { attackPercent: 0.03 },
    resonantPrism: { magicAttackPercent: 0.03 }, quicksilverSpurs: { speed: 10 },
    deadeyeSight: { criticalHitChance: 0.01 }, executionersSeal: { criticalDamageBonus: 0.05 },
    wardedGorget: { criticalResistance: 0.01 }, purifyingFilter: { statusResistance: 0.02 },
  };
  for (const [key, bonus] of Object.entries(expected)) expect(RECIPES[key].bonus).toEqual(bonus);
  for (const key of ["lifeweave", "ironboneBrace", "windstepSoles"]) expect(RECIPES[key]).toBeUndefined();
});

test.each(upgrades.filter(([, recipe]) => recipe.premium))(
  "premium %s begins with rare drops and scales materials and Astra harder than standard recipes",
  (key, recipe) => {
    expect(recipe.ranks.map((rank) => rank.minLevel)).toEqual([5, 8, 10, 15, 20, 40, 55, 70, 85, 95]);
    const first = recipe.ranks[0].cost;
    expect(Object.keys(first.materials).some(
      (key) => ["rare", "legendary"].includes(MATERIALS[key].tier),
    )).toBe(true);
    for (let rank = 0; rank < 10; rank += 1) {
      const cost = recipe.ranks[rank].cost;
      const standard = RECIPES.sharpeningStone.ranks[rank].cost;
      expect(cost.astra).toBeGreaterThanOrEqual(standard.astra * (6 + rank * 2));
    }
    expect(recipe.ranks[9].cost.astra / first.astra).toBeGreaterThan(
      RECIPES.sharpeningStone.ranks[9].cost.astra / RECIPES.sharpeningStone.ranks[0].cost.astra,
    );
    const weights = { common: 1, uncommon: 4, rare: 10, legendary: 40 };
    const burden = (cost) => Object.entries(cost.materials).reduce(
      (total, [material, count]) => total + count * weights[MATERIALS[material].tier], 0,
    );
    expect(burden(recipe.ranks[9].cost)).toBeGreaterThan(burden(first) * 8);
    expect(burden(recipe.ranks[9].cost)).toBeGreaterThan(burden(RECIPES.sharpeningStone.ranks[9].cost) * 2);
    expect(recipe.ranks[9].cost.materials.commanders_crest).toBeGreaterThanOrEqual(5);
  },
);

test("core attribute recipes are more expensive than other premiums at every rank", () => {
  for (const key of ["powerBracers", "precisionGrips", "scholarsLens"]) {
    for (let rank = 0; rank < 10; rank += 1) {
      const cost = RECIPES[key].ranks[rank].cost;
      for (const [, premium] of upgrades.filter(
        ([key, recipe]) => recipe.premium && !["powerBracers", "precisionGrips", "scholarsLens"].includes(key),
      )) {
        expect(cost.astra).toBeGreaterThan(premium.ranks[rank].cost.astra);
      }
    }
  }
});

test("recipes use every overworld material and generic leather and metal, with varied starting costs", () => {
  const used = new Set(upgrades.flatMap(([, recipe]) => recipe.ranks.flatMap(
    (rank) => Object.keys(rank.cost.materials),
  )));
  const overworld = ENEMIES.filter((enemy) => !enemy.eventOnly).flatMap(
    (enemy) => (enemy.drops || []).map((drop) => drop.key),
  );
  for (const material of overworld) expect(used.has(material) ? null : material).toBeNull();
  expect(used.has("leather")).toBe(true);
  expect(used.has("metal_scraps")).toBe(true);
  const starting = new Set(upgrades.map(([, recipe]) => JSON.stringify(recipe.ranks[0].cost.materials)));
  expect(starting.size).toBe(upgrades.length);
  for (let rank = 0; rank < 10; rank += 1) {
    const prices = upgrades.map(([, recipe]) => recipe.ranks[rank].cost.astra);
    expect(new Set(prices).size).toBe(upgrades.length);
    const materials = upgrades.map(([, recipe]) => JSON.stringify(recipe.ranks[rank].cost.materials));
    expect(new Set(materials).size).toBe(upgrades.length);
  }
});

test("thematic ingredient identities persist rather than using a shared regional recipe", () => {
  const identities = {
    sharpeningStone: ["goblin_scrap", "metal_scraps", "boar_tusk", "beast_fang", "rotwood_bark", "obsidian_shard", "ember_core", "abyssal_scale", "rimebound_plate", "glassback_chitin", "suncleft_scourge_fang", "war_hardened_insignia", "commanders_crest", "buried_wyrm_scale"],
    arcanebattery: ["slime_gel", "metal_scraps", "primal_essence", "rotwood_bark", "wraith_essence", "obsidian_shard", "ember_core", "abyssal_scale", "glacier_core", "rimebound_plate", "glassback_chitin", "war_hardened_insignia", "commanders_crest"],
    hardenedHide: ["wolf_pelt", "leather", "boar_tusk", "beast_fang", "rotwood_bark", "spider_silk", "obsidian_shard", "ember_core", "abyssal_scale", "rimebound_plate", "frostfang_pelt", "glassback_chitin", "war_hardened_insignia", "metal_scraps", "commanders_crest", "buried_wyrm_scale"],
  };
  for (const [key, allowed] of Object.entries(identities)) {
    for (const rank of RECIPES[key].ranks) {
      expect(Object.keys(rank.cost.materials).every((material) => allowed.includes(material))).toBe(true);
    }
  }
  expect(RECIPES.scholarsLens.ranks[0].cost.materials.primal_essence).toBe(3);
  expect(RECIPES.fortuneCharm.ranks[0].cost.materials.living_thatch).toBe(4);
  expect(RECIPES.purifyingFilter.ranks[2].cost.materials.venom_sac).toBe(10);
  expect(RECIPES.quicksilverSpurs.ranks[6].cost.materials.frostfang_pelt).toBe(40);
  expect(RECIPES.executionersSeal.ranks[7].cost.materials.suncleft_scourge_fang).toBe(65);
});

test("physical and magic upgrades and core attributes have comparable costs at every level", () => {
  const weights = { common: 1, uncommon: 4, rare: 10, legendary: 40 };
  const burden = (cost) => Object.entries(cost.materials).reduce(
    (total, [material, count]) => total + count * weights[MATERIALS[material].tier], 0,
  );
  const groups = [
    ["sharpeningStone", "arcanebattery"],
    ["warriorsWhetstone", "resonantPrism"],
    ["powerBracers", "precisionGrips", "scholarsLens"],
  ];
  for (const keys of groups) {
    for (let level = 0; level < 10; level += 1) {
      const costs = keys.map((key) => RECIPES[key].ranks[level].cost);
      const materialCosts = costs.map(burden);
      const astraCosts = costs.map((cost) => cost.astra);
      const materialRatio = Math.max(...materialCosts) / Math.min(...materialCosts);
      expect(materialRatio > 1.2 ? { keys, level: level + 1, materialCosts } : null).toBeNull();
      expect(Math.max(...astraCosts) / Math.min(...astraCosts)).toBeLessThanOrEqual(1.1);
      const bossCounts = costs.map((cost) => Object.entries(cost.materials).reduce(
        (total, [material, count]) => total + (MATERIALS[material].tier === "legendary" ? count : 0), 0,
      ));
      expect(new Set(bossCounts).size > 1 ? { keys, level: level + 1, bossCounts } : null).toBeNull();
      const levels = keys.map((key) => RECIPES[key].ranks[level].minLevel);
      expect(new Set(levels).size).toBe(1);
    }
  }
  for (const key of ["scholarsLens", "resonantPrism"]) {
    expect(RECIPES[key].ranks.every((level) => !("gelatinous_core" in level.cost.materials))).toBe(true);
  }
});
test.each(upgrades)("level gates and affordability agree for %s at every rank", (key) => {
  for (let rank = 0; rank < 10; rank += 1) {
    const minLevel = getRecipeRequirement(playerAt(100, { [key]: rank }), key).minLevel;
    const player = funded(key, rank, minLevel);
    const before = JSON.stringify(player);
    expect(canAfford(player, key)).toBe(true);
    const result = craft(player, key);
    expect(result.ok).toBe(true);
    expect(result.patch.workshopVersion).toBe(2);
    expect(result.patch.crafted[key]).toBe(rank + 1);
    expect(result.patch.astra).toBe(0);
    expect(result.patch.materials).toEqual({});
    expect(result.patch.bonusStats).toEqual(RECIPES[key].bonus);
    expect(JSON.stringify(player)).toBe(before);
    if (minLevel > 1) {
      const locked = { ...player, level: minLevel - 1 };
      expect(canAfford(locked, key)).toBe(false);
      expect(craft(locked, key)).toEqual(expect.objectContaining({
        ok: false, message: expect.stringContaining(`level ${minLevel}`),
      }));
    }
    expect(craft({ ...player, astra: player.astra - 1 }, key).ok).toBe(false);
    expect(craft({ ...player, materials: {} }, key).ok).toBe(false);
  }
});

test("ten Sharpening Stone ranks add 100 maximum attack and never directly add minimum attack", () => {
  let player = playerAt();
  const initial = calculateStats(player);
  for (let rank = 0; rank < 10; rank += 1) {
    const cost = getRecipeCost(player, "sharpeningStone");
    const result = craft({ ...player, astra: cost.astra, materials: cost.materials }, "sharpeningStone");
    expect(result.ok).toBe(true);
    player = { ...player, ...result.patch };
  }
  expect(player.stats.attackMax).toBe(initial.attackMax + 100);
  expect(player.stats.attackMin).toBe(initial.attackMin);
  expect(isMaxed(player, "sharpeningStone")).toBe(true);
  expect(canAfford(player, "sharpeningStone")).toBe(false);
  expect(craft(player, "sharpeningStone").ok).toBe(false);
});

test("key item recipes remain single purchases and check their material region level", () => {
  for (const [key, recipe] of Object.entries(RECIPES).filter(([, recipe]) => recipe.type === "key")) {
    const player = funded(key);
    expect(getRecipeCost(player, key)).toEqual(recipe.cost);
    const result = craft(player, key);
    expect(result.ok).toBe(true);
    const owner = { ...player, ...result.patch };
    expect(owner.keyItems).toContain(recipe.item);
    expect(craft(owner, key).ok).toBe(false);
    expect(getRecipeCost({ ...player, crafted: { [key]: 5 } }, key)).toEqual(recipe.cost);
    const minLevel = getRecipeRequirement(player, key).minLevel;
    if (minLevel > 1) expect(craft({ ...player, level: minLevel - 1 }, key).ok).toBe(false);
  }
});

test("unknown recipes fail explicitly", () => {
  expect(craft(playerAt(), "missing")).toEqual({ ok: false, message: "Unknown recipe." });
  expect(canAfford(playerAt(), "missing")).toBe(false);
});