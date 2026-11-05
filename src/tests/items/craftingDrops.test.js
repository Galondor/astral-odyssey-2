import { CRAFTING_MATERIALS } from "../../items/craftingMaterials";
import {
  CATALYSTS,
  getEnemyCraftingTier,
  getFamilyMaterial,
  rollCraftingDrops,
  rollEndgameCraftingDrops,
} from "../../items/craftingDrops";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(() => null), setPlayer: jest.fn() }));
jest.mock("../../combat/combat", () => ({ getEnemy: jest.fn(() => null) }));

afterEach(() => jest.restoreAllMocks());

const tierOf = (key) => CRAFTING_MATERIALS[key].tier;

test("overworld enemies use their region tier and dungeon enemies use their level", () => {
  expect(getEnemyCraftingTier({ region: "Meadowlands", level: 9 })).toBe(1);
  expect(getEnemyCraftingTier({ region: "ShatteredFront", level: 90 })).toBe(7);
  expect(getEnemyCraftingTier({ dungeon: true, level: 30 })).toBe(3);
  expect(getEnemyCraftingTier({ dungeon: true, level: 100 })).toBe(7);
});

test("every regional tier drops a full family set", () => {
  for (let tier = 1; tier <= 7; tier++)
    for (const family of ["ore", "hide", "cloth", "wood", "precious", "gem"])
      expect(getFamilyMaterial(tier, family)).toBeTruthy();
});

test("basic enemies drop regional family materials only", () => {
  jest.spyOn(Math, "random").mockReturnValue(0);
  const drops = rollCraftingDrops({ tier: "basic", region: "AshenPeaks", level: 25 });
  expect(Object.keys(drops)).toHaveLength(2);
  for (const key of Object.keys(drops)) expect(tierOf(key)).toBe(3);
});

test("bosses can drop parts, catalysts, and Mythos Fragments; specialty fights are excluded", () => {
  jest.spyOn(Math, "random").mockReturnValue(0);
  const drops = rollCraftingDrops({ tier: "boss", region: "FrostfallRange", level: 60 });
  expect(drops.mythos_fragment).toBe(1);
  expect(Object.keys(drops).some((key) => CRAFTING_MATERIALS[key].family === "part")).toBe(true);
  expect(Object.keys(drops).some((key) => CATALYSTS.includes(key))).toBe(true);
  expect(rollCraftingDrops({ tier: "boss", region: "Meadowlands", level: 10 }).mythos_fragment).toBeUndefined();
  for (const special of [{ colosseum: true }, { labyrinth: true }, { worldBossCycle: "c" }])
    expect(rollCraftingDrops({ tier: "boss", level: 90, ...special })).toEqual({});
});

test("nothing drops on high rolls, and endgame rewards include the rare Primordial Spark", () => {
  jest.spyOn(Math, "random").mockReturnValue(0.999);
  expect(rollCraftingDrops({ tier: "elite", region: "Darkwood", level: 15 })).toEqual({});
  expect(rollEndgameCraftingDrops()).toEqual({});
  Math.random.mockReturnValue(0);
  expect(rollEndgameCraftingDrops()).toMatchObject({ primordial_spark: 1 });
});
