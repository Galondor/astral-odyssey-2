import { analyzeMaterialUpgrade, MATERIAL_UPGRADE_RECIPES, upgradeMaterial } from "../../items/crafting";
import { CRAFTING_MATERIALS } from "../../items/craftingMaterials";
import { MATERIALS } from "../../items/materials";
import { MATERIAL_TIER_LEVELS } from "../../character/professions";

jest.mock("../../firebase", () => ({ db: {} }));

test("all four families have every adjacent-tier recipe with tier-based costs and requirements", () => {
  expect(MATERIAL_UPGRADE_RECIPES).toHaveLength(24);
  for (const family of ["ore", "wood", "hide", "cloth"]) {
    const recipes = MATERIAL_UPGRADE_RECIPES.filter((recipe) => recipe.family === family);
    expect(recipes.map(({ tier }) => tier)).toEqual([2, 3, 4, 5, 6, 7]);
    for (const recipe of recipes) {
      expect(CRAFTING_MATERIALS[recipe.input]).toMatchObject({ family, tier: recipe.tier - 1 });
      expect(CRAFTING_MATERIALS[recipe.output]).toMatchObject({ family, tier: recipe.tier });
      expect(recipe.level).toBe(MATERIAL_TIER_LEVELS[recipe.tier - 1]);
      expect(recipe.astraCost).toBe(25 * recipe.tier);
    }
  }
});

test.each(["weaponry", "armor", "jewelry"])("any %s level can unlock upgrades without a character level gate", (profession) => {
  for (const recipe of MATERIAL_UPGRADE_RECIPES) {
    const player = {
      level: 1, astra: recipe.astraCost,
      materials: { [recipe.input]: 3, [recipe.output]: 2, slime_gel: 10 },
      professions: { [profession]: { level: recipe.level } },
    };
    const snapshot = JSON.stringify(player);
    expect(upgradeMaterial({ ...player, professions: { [profession]: { level: recipe.level - 1 } } }, recipe.input))
      .toMatchObject({ ok: false, message: expect.stringContaining(`level ${recipe.level}`) });
    const result = upgradeMaterial(player, recipe.input);
    expect(result).toMatchObject({ ok: true, patch: { astra: 0, materials: { [recipe.output]: 3, slime_gel: 10 } } });
    expect(result.patch.materials[recipe.input]).toBeUndefined();
    expect(Object.keys(result.patch).sort()).toEqual(["astra", "materials"]);
    expect(JSON.stringify(player)).toBe(snapshot);
  }
});

test("invalid recipes and insufficient resources fail explicitly without changing the player", () => {
  const player = { astra: 50, materials: { metal_scraps: 3 }, professions: { armor: { level: 8 } } };
  expect(analyzeMaterialUpgrade(null, "metal_scraps")).toMatchObject({ ok: false });
  for (const key of ["unknown", "warsteel_ingot", "copper_nugget"])
    expect(upgradeMaterial(player, key)).toMatchObject({ ok: false, message: "Unknown material upgrade recipe." });
  expect(upgradeMaterial({ ...player, astra: 49 }, "metal_scraps")).toMatchObject({ ok: false, message: expect.stringContaining("50 astra") });
  expect(upgradeMaterial({ ...player, materials: { metal_scraps: 2 } }, "metal_scraps")).toMatchObject({ ok: false, message: expect.stringContaining("3 Metal Scraps") });
  expect(upgradeMaterial({}, "metal_scraps")).toMatchObject({ ok: false, message: expect.stringContaining("level 8") });
  expect(player.materials).toEqual({ metal_scraps: 3 });
});

test("bulk transmutation scales costs and output atomically across every recipe", () => {
  for (const recipe of MATERIAL_UPGRADE_RECIPES) {
    const player = {
      astra: recipe.astraCost * 4,
      materials: { [recipe.input]: 12, [recipe.output]: 2, slime_gel: 10 },
      professions: { armor: { level: recipe.level, exp: 20, crafts: 2 } },
    };
    const snapshot = JSON.stringify(player);
    expect(analyzeMaterialUpgrade(player, recipe.input, 3))
      .toMatchObject({ ok: true, quantity: 3, inputCount: 9, astraCost: recipe.astraCost * 3 });
    expect(upgradeMaterial(player, recipe.input, 3)).toMatchObject({
      ok: true,
      patch: { astra: recipe.astraCost, materials: { [recipe.input]: 3, [recipe.output]: 5, slime_gel: 10 } },
    });
    expect(upgradeMaterial(player, recipe.input, 4).patch.materials[recipe.input]).toBeUndefined();
    expect(upgradeMaterial(player, recipe.input, 5)).toMatchObject({ ok: false });
    expect(upgradeMaterial({ ...player, astra: recipe.astraCost * 5 }, recipe.input, 5))
      .toMatchObject({ ok: false, message: expect.stringContaining(`15 ${MATERIALS[recipe.input].name}`) });
    expect(JSON.stringify(player)).toBe(snapshot);
  }
});

test.each([0, -1, 1.5, NaN, Infinity, "2", null, Number.MAX_SAFE_INTEGER])("invalid bulk quantity %s fails without a patch", (quantity) => {
  const player = { astra: 10000, materials: { metal_scraps: 100 }, professions: { weaponry: { level: 50 } } };
  expect(upgradeMaterial(player, "metal_scraps", quantity)).toEqual({ ok: false, message: expect.any(String) });
});

test("bulk output cannot overflow the saved material count", () => {
  const player = { astra: 100, materials: { metal_scraps: 6, bog_iron: Number.MAX_SAFE_INTEGER }, professions: { armor: { level: 8 } } };
  expect(upgradeMaterial(player, "metal_scraps", 2)).toEqual({ ok: false, message: "That quantity is too large to transmute." });
});
