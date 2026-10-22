import { getPlayer, setPlayer } from "../character/player";
import { recalculateStats } from "../character/stats";
import { getEnemy } from "../combat/combat";
import { applyConsumable, CONSUMABLES, drinkConsumable } from "./consumables";
import { itemTooltip } from "./items";
import { applyRune, canApplyRune } from "./runes";

jest.mock("../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
jest.mock("../combat/combat", () => ({ getEnemy: jest.fn() }));

let player;
let item;
beforeEach(() => {
  jest.clearAllMocks();
  getEnemy.mockReturnValue(null);
  item = {
    id: "gear-1", name: "Iron Sword", slot: "weapon", rarity: "Rare", iLevel: 5,
    mainStat: { stat: "strength", value: 12, tier: 4 },
    subStats: { vitality: 2 }, subTiers: { vitality: 1 },
    gemstone: { type: "ruby", stat: "strength", value: 2 },
    ability: null, price: 300, originalOwner: "Nova",
  };
  player = {
    level: 20, baseStats: { strength: 5, dexterity: 5, intelligence: 5 },
    inventory: [item], equipment: {}, consumables: { architectsRune: 2, healthPotion: 3 },
  };
  player = { ...player, ...recalculateStats(player) };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
});

test.each(["dexterity", "intelligence"])("changes the main stat to %s, preserving the item and consuming one rune", (stat) => {
  expect(applyRune("architectsRune", item.id, stat).ok).toBe(true);
  expect(player.inventory[0]).toEqual({
    ...item, mainStat: { ...item.mainStat, stat }, crafted: true,
  });
  expect(player.consumables).toEqual({ architectsRune: 1, healthPotion: 3 });
  expect(itemTooltip(player.inventory[0]).tags).toContain("Crafted");
  expect(item.mainStat.stat).toBe("strength");
  expect(canApplyRune(player.inventory[0])).toBe(false);
  expect(applyRune("architectsRune", item.id, "strength")).toMatchObject({ ok: false, message: "Crafted items cannot receive runes." });
  expect(player.consumables.architectsRune).toBe(1);
});

test("equipped items recalculate stats and keep two-handed placeholders intact", () => {
  const placeholder = { twoHandedOf: "mainHand", name: item.name };
  player = { ...player, ...recalculateStats(player, {
    inventory: [], equipment: { mainHand: { ...item, twoHanded: true }, offHand: placeholder },
    consumables: { architectsRune: 1 },
  }) };
  expect(player.stats.strength).toBe(19);
  expect(applyRune("architectsRune", item.id, "intelligence").ok).toBe(true);
  expect(player.stats).toMatchObject({ strength: 7, intelligence: 17 });
  expect(player.equipment.offHand).toEqual(placeholder);
  expect(player.equipment.mainHand.crafted).toBe(true);
  expect(player.consumables).toEqual({});
});

test.each(["strength", "luck", "", undefined])("invalid or unchanged stat %s does not spend a rune", (stat) => {
  expect(applyRune("architectsRune", item.id, stat).ok).toBe(false);
  expect(setPlayer).not.toHaveBeenCalled();
});

test("combat, missing items, missing runes, and non-runes cannot modify gear", () => {
  getEnemy.mockReturnValue({});
  expect(applyRune("architectsRune", item.id, "dexterity").ok).toBe(false);
  getEnemy.mockReturnValue(null);
  expect(applyRune("architectsRune", "missing", "dexterity").ok).toBe(false);
  expect(applyRune("healthPotion", item.id, "dexterity").ok).toBe(false);
  player.consumables.architectsRune = 0;
  expect(applyRune("architectsRune", item.id, "dexterity").ok).toBe(false);
  expect(setPlayer).not.toHaveBeenCalled();
});

test("Crafted protection is shared by future runes", () => {
  CONSUMABLES.testRune = { name: "Test Rune", rune: true };
  try {
    player.inventory[0] = { ...item, crafted: true };
    player.consumables.testRune = 1;
    expect(applyRune("testRune", item.id)).toMatchObject({
      ok: false, message: "Crafted items cannot receive runes.",
    });
    expect(setPlayer).not.toHaveBeenCalled();
  } finally {
    delete CONSUMABLES.testRune;
  }
});

test("opening rune selection and combat consumable use do not consume runes", () => {
  expect(drinkConsumable("architectsRune")).toMatchObject({ ok: true, requiresRune: true });
  const stats = { ...player.stats };
  expect(applyConsumable(player, "architectsRune", stats).ok).toBe(false);
  expect(stats).toEqual(player.stats);
  expect(setPlayer).not.toHaveBeenCalled();
});
