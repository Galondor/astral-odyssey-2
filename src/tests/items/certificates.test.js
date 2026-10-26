import { getPlayer, setPlayer } from "../../character/player";
import { getEnemy } from "../../combat/combat";
import { applyConsumable, drinkConsumable } from "../../items/consumables";
import { canRenameItem, renameItem } from "../../items/certificates";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
jest.mock("../../combat/combat", () => ({ getEnemy: jest.fn() }));

let player;
const sword = {
  id: "sword", name: "Iron Sword", slot: "weapon", rarity: "Unique",
  mainStat: { stat: "strength", value: 15, tier: 4 }, crafted: true,
  ability: { name: "Bloom of Decay" }, originalOwner: "Nova",
};

beforeEach(() => {
  jest.clearAllMocks();
  player = {
    inventory: [{ ...sword }], equipment: {}, stats: { health: 10, maxHealth: 100 },
    consumables: { itemCertificate: 2, healthPotion: 3 },
  };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
  getEnemy.mockReturnValue(null);
});

test("renames carried gear without changing its identity, stats, or other properties", () => {
  expect(renameItem("sword", "  Nova Blade 42  ").ok).toBe(true);
  expect(player.inventory[0]).toEqual({ ...sword, name: "Nova Blade 42" });
  expect(player.consumables).toEqual({ itemCertificate: 1, healthPotion: 3 });
  expect(player.stats).toEqual({ health: 10, maxHealth: 100 });
});

test("renames equipped two-handed gear and its placeholder, spending the last certificate", () => {
  player.inventory = [];
  player.equipment = {
    mainHand: { ...sword, twoHanded: true },
    offHand: { twoHandedOf: "mainHand", name: sword.name, rarity: sword.rarity },
  };
  player.consumables.itemCertificate = 1;
  expect(renameItem("sword", "123").ok).toBe(true);
  expect(player.equipment.mainHand).toEqual({ ...sword, twoHanded: true, name: "123" });
  expect(player.equipment.offHand.name).toBe("123");
  expect(player.consumables).toEqual({ healthPotion: 3 });
});

test.each(["", "   ", "Bad!", "[red]Blade", "a".repeat(65), "F u c k", "Iron Sword"])(
  "rejects %s without changing the item or consuming the certificate", (name) => {
    const before = JSON.parse(JSON.stringify(player));
    expect(renameItem("sword", name).ok).toBe(false);
    expect(player).toEqual(before);
    expect(setPlayer).not.toHaveBeenCalled();
  },
);

test("rejects missing items, placeholders, missing certificates, combat, and missing characters", () => {
  expect(canRenameItem({ ...sword, twoHandedOf: "mainHand" })).toBe(false);
  expect(renameItem("missing", "New Sword").ok).toBe(false);
  player.consumables.itemCertificate = 0;
  expect(renameItem("sword", "New Sword").ok).toBe(false);
  player.consumables.itemCertificate = 1;
  getEnemy.mockReturnValue({});
  expect(renameItem("sword", "New Sword").ok).toBe(false);
  player = null;
  expect(renameItem("sword", "New Sword").ok).toBe(false);
  expect(setPlayer).not.toHaveBeenCalled();
});

test("opening the certificate flow or attempting combat use never consumes it", () => {
  expect(drinkConsumable("itemCertificate")).toMatchObject({ ok: true, requiresItemRename: true });
  expect(applyConsumable(player, "itemCertificate", player.stats)).toMatchObject({ ok: false });
  expect(player.consumables.itemCertificate).toBe(2);
  expect(setPlayer).not.toHaveBeenCalled();
  player.consumables.itemCertificate = 0;
  expect(drinkConsumable("itemCertificate")).toMatchObject({ ok: false });
});
