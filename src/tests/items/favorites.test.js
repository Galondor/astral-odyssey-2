import { getPlayer, setPlayer } from "../../character/player";
import { isFavorite, toggleFavorite } from "../../items/favorites";
import { equipItem, sellEquippedItem, sellGemstone, sellInventoryItem, unequipItem } from "../../items/items";

jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(),
  setPlayer: jest.fn(),
  getInventoryItemKey: (item) => item.id || JSON.stringify(item),
}));
jest.mock("../../combat/combat", () => ({ getEnemy: () => null }));

const gear = { id: "sword", name: "Sword", slot: "weapon", rarity: "Rare", iLevel: 1, price: 100, subStats: {} };
const gemstone = { id: "ruby", rarity: "Rare" };
let player;
beforeEach(() => {
  jest.clearAllMocks();
  player = {
    level: 25, astra: 100, stats: { strength: 2, dexterity: 2, intelligence: 2 },
    inventory: [gear], equipment: {}, gemstones: [gemstone],
    consumables: { healthPotion: 2 }, materials: { slime_gel: 3 }, keyItems: ["test-key"],
  };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
});

test.each([
  ["gear", gear], ["gemstones", gemstone], ["consumables", "healthPotion"],
  ["materials", "slime_gel"], ["keyItems", "test-key"],
])("%s favorites toggle without modifying items, counts, or unseen markers", (category, item) => {
  const original = JSON.parse(JSON.stringify(player));
  expect(isFavorite(player, category, item)).toBe(false);
  expect(toggleFavorite(category, item)).toEqual({ ok: true, favorite: true });
  expect(isFavorite(player, category, item)).toBe(true);
  expect(player).toMatchObject(original);
  expect(setPlayer).toHaveBeenCalledWith({ favoriteInventoryItems: { [category]: [typeof item === "string" ? item : item.id] } });
  expect(toggleFavorite(category, item)).toEqual({ ok: true, favorite: false });
  expect(isFavorite(player, category, item)).toBe(false);
});

test("favorites are isolated by category and invalid targets fail explicitly", () => {
  toggleFavorite("gear", gear);
  toggleFavorite("materials", "slime_gel");
  expect(isFavorite(player, "gemstones", gear.id)).toBe(false);
  expect(isFavorite(player, "gear", gear)).toBe(true);
  expect(toggleFavorite("gear", "missing")).toMatchObject({ ok: false, message: expect.any(String) });
  expect(toggleFavorite("unknown", "healthPotion")).toMatchObject({ ok: false });
});

test("favorites remain protected when equipped and unequipped", () => {
  toggleFavorite("gear", gear);
  expect(equipItem(0)).toEqual({ ok: true });
  expect(isFavorite(player, "gear", player.equipment.mainHand)).toBe(true);
  const equipped = player;
  expect(sellEquippedItem("mainHand")).toEqual({ ok: false, reason: "favorite" });
  expect(player).toBe(equipped);
  unequipItem("mainHand");
  expect(isFavorite(player, "gear", player.inventory[0])).toBe(true);
  toggleFavorite("gear", gear);
  expect(sellInventoryItem(0)).toMatchObject({ ok: true, item: gear, value: 50 });
});

test.each([
  ["gear", gear, sellInventoryItem], ["gemstones", gemstone, sellGemstone],
])("the trader rejects favorite %s without changing astra, items, or buyback", (category, item, sell) => {
  toggleFavorite(category, item);
  const before = player;
  setPlayer.mockClear();
  expect(sell(0)).toEqual({ ok: false, reason: "favorite" });
  expect(player).toBe(before);
  expect(setPlayer).not.toHaveBeenCalled();
  toggleFavorite(category, item);
  expect(sell(0).ok).toBe(true);
});
