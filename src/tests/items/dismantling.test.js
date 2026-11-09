import { getPlayer, setPlayer } from "../../character/player";
import { recalculateStats } from "../../character/stats";
import { getEnemy } from "../../combat/combat";
import { dismantleOwnedItem, extractOwnedItem, getDismantleResources } from "../../items/dismantling";
import { CRAFTING_MATERIALS } from "../../items/craftingMaterials";
import { analyzeCraft, craftItem, getCraftingBook } from "../../items/crafting";
import { BLUEPRINTS, getExtractableBlueprint } from "../../items/craftingBlueprints";
import { UNIQUES } from "../../world/dungeonData";

jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(), setPlayer: jest.fn(),
  getInventoryItemKey: (item) => item?.id || JSON.stringify(item),
}));
jest.mock("../../character/stats", () => ({
  recalculateStats: jest.fn((player, patch) => ({ ...patch, stats: { recalculated: true } })),
}));
jest.mock("../../combat/combat", () => ({ getEnemy: jest.fn(() => null) }));

const sword = { id: "sword", name: "Renamed sword", baseType: "Sword", slot: "weapon", iLevel: 1, rarity: "Common" };
let player;
beforeEach(() => {
  jest.clearAllMocks();
  getEnemy.mockReturnValue(null);
  recalculateStats.mockImplementation((player, patch) => ({ ...patch, stats: { recalculated: true } }));
  player = { inventory: [sword], equipment: {}, materials: { metal_scraps: 7 }, astra: 100 };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
});

test.each([
  ["weapon", "Sword", 1, "ore", 1],
  ["weapon", "Bow", 40, "wood", 4],
  ["helmet", "Cap", 20, "hide", 3],
  ["chestplate", "Robe", 85, "cloth", 7],
  ["necklace", "Pendant", 55, "precious", 5],
  ["pickaxe", null, 29, "ore", 5],
  ["axe", null, 43, "ore", 7],
  ["hammer", null, 8, "ore", 2],
  ["precisionTools", null, 22, "precious", 4],
])("%s %s at level %i recovers %s tier %i", (slot, baseType, iLevel, family, tier) => {
  const resources = getDismantleResources({ ...sword, slot, baseType, iLevel });
  expect(CRAFTING_MATERIALS[resources.key]).toMatchObject({ family, tier });
});

test("rarity and size improve random quantity, and both inclusive bounds are reachable", () => {
  const common = getDismantleResources(sword);
  const mythic = getDismantleResources({ ...sword, rarity: "Mythic", twoHanded: true });
  expect(mythic.min).toBeGreaterThan(common.min);
  expect(mythic.max).toBeGreaterThan(common.max);
  expect(dismantleOwnedItem(sword, () => 0).materials.metal_scraps).toBe(common.min);
  player.inventory = [sword];
  expect(dismantleOwnedItem(sword, () => 0.99999).materials.metal_scraps).toBe(common.max);
});

test("dismantles once, merges current resources, and clears only this item's unseen marker", () => {
  player.unseenInventoryItems = { gear: ["sword", "other"], materials: ["slime_gel"] };
  const result = dismantleOwnedItem(sword, () => 0);
  expect(result.ok).toBe(true);
  expect(player.inventory).toEqual([]);
  expect(player.materials).toEqual({ metal_scraps: 8 });
  expect(player.astra).toBe(100);
  expect(player.unseenInventoryItems).toEqual({ gear: ["other"], materials: ["slime_gel"] });
  expect(dismantleOwnedItem(sword).ok).toBe(false);
  expect(setPlayer).toHaveBeenCalledTimes(1);
});

test("uses the current owned item rather than stale popup rarity, level, or sockets", () => {
  player.inventory = [{ ...sword, rarity: "Mythic", iLevel: 85, gemstones: [{ id: "socketed" }] }];
  const result = dismantleOwnedItem(sword, () => 0);
  expect(result.materials).toEqual({ warsteel_ingot: 4 });
  expect(player.gemstones).toBeUndefined();
  expect(player.inventory).toEqual([]);
});

test("dismantling equipped two-handed gear clears its placeholder and recalculates stats atomically", () => {
  const item = { ...sword, twoHanded: true };
  player.inventory = [];
  player.equipment = { mainHand: item, offHand: { twoHandedOf: "mainHand" }, boots: { id: "boots" } };
  const original = player;
  expect(dismantleOwnedItem(item, () => 0).ok).toBe(true);
  expect(player.equipment).toEqual({ boots: { id: "boots" } });
  expect(recalculateStats).toHaveBeenCalledWith(original, {
    equipment: { boots: { id: "boots" } }, materials: { metal_scraps: 8 },
  });
  expect(setPlayer).toHaveBeenCalledTimes(1);
  expect(player.stats).toEqual({ recalculated: true });
});

test.each(["favorite", "combat", "missing", "unsupported"])("%s items cannot be dismantled", (reason) => {
  let item = sword;
  if (reason === "favorite") player.favoriteInventoryItems = { gear: [sword.id] };
  if (reason === "combat") getEnemy.mockReturnValue({});
  if (reason === "missing") player.inventory = [];
  if (reason === "unsupported") {
    item = { ...sword, slot: "consumable" };
    player.inventory = [item];
  }
  const result = dismantleOwnedItem(item);
  expect(result).toMatchObject({ ok: false, message: expect.any(String) });
  expect(setPlayer).not.toHaveBeenCalled();
});

const unique = {
  id: "unique-instance", name: "Renamed Phylactery", unique: "maldrathPhylactery",
  slot: "necklace", rarity: "Unique", iLevel: 20,
};

test("extracting destroys only the owned instance, preserves discoveries, and learns a reusable recipe", () => {
  const second = { ...unique, id: "second" };
  player.inventory = [unique, second, sword];
  player.craftingBook = { materials: { slime_gel: 1 }, reactions: ["thermal_shock"] };
  player.unseenInventoryItems = { gear: [unique.id, sword.id] };
  const selection = { blueprintId: "unique:maldrathPhylactery", base: "silver_ore" };
  expect(analyzeCraft(player, selection).message).toContain("learn its blueprint");
  expect(extractOwnedItem(unique).ok).toBe(true);
  expect(player.inventory).toEqual([second, sword]);
  expect(player.unseenInventoryItems.gear).toEqual([sword.id]);
  expect(getCraftingBook(player)).toEqual({
    materials: { slime_gel: 1 }, reactions: ["thermal_shock"], recipes: [selection.blueprintId],
  });
  expect(player.materials).toEqual({ metal_scraps: 7 });
  expect(extractOwnedItem(second)).toMatchObject({ ok: false, message: "You already know this blueprint." });
  expect(player.inventory).toContain(second);

  const blueprint = BLUEPRINTS[selection.blueprintId];
  const base = Object.keys(CRAFTING_MATERIALS).find((key) =>
    CRAFTING_MATERIALS[key].family === blueprint.families[0] && CRAFTING_MATERIALS[key].tier === blueprint.minTier);
  player.professions = { jewelry: { level: 50 } };
  player.astra = 100000;
  player.materials = { [base]: blueprint.baseQty * 3 };
  Object.entries(blueprint.requires).forEach(([key, qty]) => { player.materials[key] = qty * 3; });
  for (let count = 0; count < 2; count++) {
    const result = craftItem(player, { ...selection, base });
    expect(result.ok).toBe(true);
    expect(result.item.unique).toBe(unique.unique);
    player = { ...player, ...result.patch };
    expect(player.craftingBook.recipes).toEqual([selection.blueprintId]);
  }
});

test("extracting equipped two-handed gear clears its placeholder and recalculates stats", () => {
  const item = { ...unique, unique: "hoardkingAxe", slot: "weapon", twoHanded: true };
  player.inventory = [];
  player.equipment = { mainHand: item, offHand: { twoHandedOf: "mainHand" }, boots: sword };
  expect(extractOwnedItem(item).ok).toBe(true);
  expect(player.equipment).toEqual({ boots: sword });
  expect(player.stats).toEqual({ recalculated: true });
  expect(recalculateStats).toHaveBeenCalledTimes(1);
});

test.each(["favorite", "combat", "missing", "unsupported", "mythic", "crafted", "stale"])("%s extraction is rejected without mutations", (reason) => {
  player.inventory = [unique];
  if (reason === "favorite") player.favoriteInventoryItems = { gear: [unique.id] };
  if (reason === "combat") getEnemy.mockReturnValue({});
  if (reason === "missing") player.inventory = [];
  if (reason === "unsupported") player.inventory = [{ ...unique, unique: "unknown" }];
  if (reason === "mythic") player.inventory = [{ ...unique, rarity: "Mythic" }];
  if (reason === "crafted") player.inventory = [{ ...unique, unique: "emberwroughtBlade" }];
  if (reason === "stale") player.inventory = [{ ...unique, unique: undefined, rarity: "Rare" }];
  const snapshot = JSON.stringify(player);
  expect(extractOwnedItem(unique)).toMatchObject({ ok: false, message: expect.any(String) });
  expect(JSON.stringify(player)).toBe(snapshot);
  expect(setPlayer).not.toHaveBeenCalled();
});

test("every dropped Unique has a valid source-derived recipe", () => {
  Object.values(UNIQUES).forEach((definition) => {
    const blueprint = getExtractableBlueprint({ ...definition, unique: definition.id, rarity: "Unique" });
    expect(blueprint).toMatchObject({ kind: "unique", requiresExtraction: true, unique: definition });
    expect(blueprint.level).toBeGreaterThan(0);
    expect(blueprint.baseQty).toBeGreaterThan(0);
    Object.keys(blueprint.requires).forEach((key) => expect(CRAFTING_MATERIALS[key]).toBeDefined());
  });
});
