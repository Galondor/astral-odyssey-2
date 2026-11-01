import { getPlayer, setPlayer } from "../../character/player";
import { getEnemy } from "../../combat/combat";
import {
  ITEMS, createItem, createCustomItem, createUniqueItem, createStarterInventory,
  generateRandomItem, findGemstone, socketGemstone, removeGemstone,
  equipItem, unequipItem, itemTooltip, itemComparisonTooltip,
} from "../../items/items";
import { getItemGemstones, getItemSocketCount, rollItemSocketCount } from "../../items/sockets";
import { getItemGearScore } from "../../items/gearScore";
import { getGearBonuses } from "../../character/stats";
import { getItemStats, filterListings, DEFAULT_FILTERS } from "../../world/marketplace";
import { UNIQUES } from "../../world/dungeonData";

jest.mock("../../firebase", () => ({ db: {}, auth: { currentUser: { uid: "alice" } } }));
jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(), setPlayer: jest.fn(),
  getInventoryItemKey: (item) => item?.id || JSON.stringify(item),
}));
jest.mock("../../combat/combat", () => ({ getEnemy: jest.fn() }));

const ruby = { id: "ruby", name: "Ruby", type: "ruby", stat: "strength", rarity: "Rare", value: 3 };
const emerald = { id: "emerald", name: "Emerald", type: "emerald", stat: "dexterity", rarity: "Epic", value: 4 };
const sapphire = { id: "sapphire", name: "Sapphire", type: "sapphire", stat: "intelligence", rarity: "Rare", value: 3 };
const gear = { id: "gear", name: "Sword", slot: "weapon", rarity: "Legendary", socketCount: 2, iLevel: 1, price: 100 };
const target = { kind: "inventory", index: 0 };
let player;

beforeEach(() => {
  jest.clearAllMocks();
  getEnemy.mockReturnValue(null);
  player = {
    class: "Specialist", level: 25, astra: 1000,
    baseStats: { strength: 2, dexterity: 2, intelligence: 2 },
    stats: {}, inventory: [gear], equipment: {}, gemstones: [ruby, emerald, sapphire],
  };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
});
afterEach(() => jest.restoreAllMocks());

test.each([
  ["Common", 0], ["Uncommon", 0], ["Rare", 1], ["Epic", 1],
  ["Legendary", 2], ["Unique", 2], ["Mythic", 2],
])("%s gear has %i sockets without a saved roll", (rarity, count) => {
  expect(getItemSocketCount({ rarity })).toBe(count);
  expect(getItemSocketCount({ rarity, socketCount: 99 })).toBe(count);
  expect(getItemSocketCount({ rarity, twoHandedOf: "mainHand" })).toBe(0);
});

test.each([[0, 1], [0.499999, 1], [0.5, 2], [0.999999, 2]])(
  "Epic socket roll %s gives %s sockets with an exact 50%% split",
  (roll, count) => {
    jest.spyOn(Math, "random").mockReturnValue(roll);
    expect(rollItemSocketCount("Epic")).toBe(count);
    expect(getItemSocketCount({ rarity: "Epic", socketCount: count })).toBe(count);
  },
);

test("every gear creation path saves its socket count", () => {
  jest.spyOn(Math, "random").mockReturnValue(0.5);
  ITEMS.socketTest = { ...gear, rarity: "Epic", mainStat: {}, subStats: {} };
  try {
    expect(createItem("socketTest").socketCount).toBe(2);
  } finally {
    delete ITEMS.socketTest;
  }
  expect(createUniqueItem(Object.values(UNIQUES)[0]).socketCount).toBe(2);
  expect(createStarterInventory({ strength: 2 }).every((item) => item.socketCount === 0)).toBe(true);
  for (const [rarity, socketCount] of [
    ["Common", 0], ["Uncommon", 0], ["Rare", 1], ["Epic", 2],
    ["Legendary", 2], ["Unique", 2], ["Mythic", 2],
  ]) {
    const item = createCustomItem({
      name: "Test Sword", slot: "weapon", rarity, condition: "Average",
      iLevel: 25, price: 100, mainStat: { stat: "strength", tier: 1 },
    });
    expect(item.socketCount).toBe(socketCount);
  }
  const generated = generateRandomItem("helmet", 3);
  expect(generated.rarity).toBe("Epic");
  expect(generated.socketCount).toBe(2);
  Math.random.mockReturnValue(0);
  const single = generateRandomItem("helmet", 3);
  expect(single.socketCount).toBe(1);
  Math.random.mockReturnValue(0.99);
  expect(getItemSocketCount(single)).toBe(2);
  expect(getItemSocketCount(JSON.parse(JSON.stringify(generated)))).toBe(2);
});

test("socketing fills both sockets and rejects a third without consuming a gem", () => {
  expect(socketGemstone(ruby.id, target)).toEqual({ ok: true });
  expect(socketGemstone(emerald.id, target)).toEqual({ ok: true });
  expect(player.inventory[0].gemstones).toEqual([ruby, emerald]);
  expect(player.inventory[0]).not.toHaveProperty("gemstone");
  expect(socketGemstone(sapphire.id, target)).toEqual({ ok: false, reason: "occupied" });
  expect(player.gemstones).toEqual([sapphire]);
});

test.each([
  ["Common", 0, 1], ["Uncommon", 0, 1], ["Rare", 1, 2],
  ["Epic", 1, 2], ["Epic", 2, 3], ["Legendary", 2, 3], ["Unique", 2, 3], ["Mythic", 2, 3],
])("Holofoil %s gear with %s base sockets keeps its %s total capacity through socket changes", (rarity, socketCount, count) => {
  player.inventory = [{ ...gear, rarity, socketCount, holofoil: ["#123456", "#abcdef"] }];
  const gems = [ruby, emerald, sapphire];
  for (let index = 0; index < count; index++) {
    expect(socketGemstone(gems[index].id, target)).toEqual({ ok: true });
    expect(getItemSocketCount(player.inventory[0])).toBe(count);
    expect(player.inventory[0].socketCount).toBe(socketCount);
  }
  const fourth = { ...ruby, id: "fourth" };
  player.gemstones.push(fourth);
  expect(socketGemstone(fourth.id, target)).toEqual({ ok: false, reason: "occupied" });
  expect(removeGemstone(target, count - 1)).toMatchObject({ ok: true });
  expect(getItemSocketCount(player.inventory[0])).toBe(count);
  expect(socketGemstone(fourth.id, target)).toEqual({ ok: true });
  expect(getItemSocketCount(player.inventory[0])).toBe(count);
});

test("same-type gemstones stack and removal charges only for the chosen gemstone", () => {
  const anotherRuby = { ...ruby, id: "ruby2", value: 5 };
  player.gemstones = [ruby, anotherRuby];
  socketGemstone(ruby.id, target);
  socketGemstone(anotherRuby.id, target);
  expect(getGearBonuses({ mainHand: player.inventory[0] }).strength).toBe(8);
  expect(removeGemstone(target, 1)).toEqual({ ok: true, cost: 300 });
  expect(player.inventory[0].gemstones).toEqual([ruby]);
  expect(player.gemstones).toEqual([anotherRuby]);
  expect(player.astra).toBe(700);
  expect(socketGemstone(anotherRuby.id, target)).toEqual({ ok: true });
});

test.each(["Common", "Uncommon"])("legacy %s gemstones remain effective but cannot be replaced", (rarity) => {
  player.inventory = [{ ...gear, rarity, gemstone: ruby }];
  expect(getItemGemstones(player.inventory[0])).toEqual([ruby]);
  expect(getGearBonuses({ mainHand: player.inventory[0] }).strength).toBe(3);
  expect(socketGemstone(emerald.id, target)).toEqual({ ok: false, reason: "noSockets" });
  expect(removeGemstone(target)).toEqual({ ok: true, cost: 300 });
  expect(player.inventory[0].gemstones).toEqual([]);
  expect(socketGemstone(emerald.id, target)).toEqual({ ok: false, reason: "noSockets" });
});

test("legacy single-gem saves migrate on socket change without doubling their bonus", () => {
  player.inventory = [{ ...gear, gemstone: ruby }];
  player.gemstones = [emerald];
  socketGemstone(emerald.id, target);
  const item = player.inventory[0];
  expect(item.gemstones).toEqual([ruby, emerald]);
  expect(item).not.toHaveProperty("gemstone");
  expect(getItemGemstones({ ...item, gemstone: ruby })).toEqual([ruby, emerald]);
});

test.each([
  { rarity: "Common" },
  { rarity: "Common", gemstone: ruby },
  { rarity: "Rare" },
  { rarity: "Legendary", gemstones: [ruby, emerald] },
])("item tooltip omits socket tags for %j", (patch) => {
  expect(itemTooltip({ ...gear, ...patch }).tags.join(" ")).not.toMatch(/socket|legacy gemstone/i);
});

test("all gemstone bonuses appear in stats, gear score, comparisons, filters and lookups", () => {
  const item = { ...gear, gemstones: [ruby, emerald] };
  player.inventory = [item];
  expect(getItemGearScore(item)).toBe(21);
  expect(getItemStats(item)).toEqual({ strength: 3, dexterity: 4 });
  expect(itemTooltip(item).stats.map((stat) => stat.value)).toEqual(["+3", "+4"]);
  player.equipment = { mainHand: { ...gear, id: "comparison" } };
  expect(itemComparisonTooltip(item).sections[0].stats).toEqual(expect.arrayContaining([
    expect.objectContaining({ label: "Strength", value: "+3" }),
    expect.objectContaining({ label: "Dexterity", value: "+4" }),
  ]));
  player.equipment = {};
  player.gemstones = [];
  expect(findGemstone(emerald.id)).toEqual(emerald);
  const listing = { id: "listing", sellerName: "Alice", item };
  expect(filterListings([listing], { ...DEFAULT_FILTERS, query: "Emerald" })).toEqual([listing]);
  expect(equipItem(0)).toEqual({ ok: true });
  expect(player.stats.strength).toBe(5);
  expect(player.stats.dexterity).toBe(6);
  expect(findGemstone(emerald.id)).toEqual(emerald);
  expect(unequipItem("mainHand")).toEqual({ ok: true });
  expect(player.inventory[0].gemstones).toEqual([ruby, emerald]);
  expect(player.stats.strength).toBe(2);
});

test("combat, insufficient astra, bad indices and placeholders leave gems unchanged", () => {
  player.inventory = [{ ...gear, gemstones: [ruby, emerald] }];
  player.astra = 399;
  expect(removeGemstone(target, 1)).toEqual({ ok: false, reason: "astra", cost: 400 });
  for (const index of [-1, 2, 0.5, "1"]) {
    expect(removeGemstone(target, index)).toEqual({ ok: false, reason: "invalid" });
  }
  getEnemy.mockReturnValue({});
  expect(removeGemstone(target)).toEqual({ ok: false, reason: "combat" });
  expect(socketGemstone(sapphire.id, target)).toEqual({ ok: false, reason: "combat" });
  getEnemy.mockReturnValue(null);
  player.inventory = [{ ...gear, twoHandedOf: "mainHand" }];
  expect(socketGemstone(sapphire.id, target)).toEqual({ ok: false, reason: "invalid" });
  expect(setPlayer).not.toHaveBeenCalled();
});
