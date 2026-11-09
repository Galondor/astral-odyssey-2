import { getPlayer, setPlayer } from "../../character/player";
import { recalculateStats } from "../../character/stats";
import { getEnemy } from "../../combat/combat";
import { getSellPrice, getSubStatTier, itemTooltip, unequipItem, equipItem } from "../../items/items";
import { getItemUpgradeStatus, upgradeInventoryItem } from "../../items/upgrades";
import { cancelClassSwitch, confirmClassSwitch } from "../../character/classSwitch";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
jest.mock("../../combat/combat", () => ({ getEnemy: jest.fn() }));

let player;
const makeItem = (changes = {}) => ({
  id: "sword", name: "Iron Sword", slot: "weapon", rarity: "Rare", condition: "Pristine",
  iLevel: 50, price: 500, mainStat: { stat: "strength", value: 7 },
  subStats: { speed: 25, attackMin: 50, criticalDamage: 0.3, attackPercent: 0.05 },
  subTiers: { speed: 5 }, socketCount: 1,
  gemstones: [{ type: "ruby", name: "Rare Ruby", stat: "strength", value: 3, rarity: "Rare" }],
  ability: { name: "Plunder" }, holofoil: ["#123456", "#abcdef"], holofoilEffect: "nebula",
  holofoilBonusVersion: 1, favorite: true, originalOwner: "Owner",
  ...changes,
});

beforeEach(() => {
  jest.clearAllMocks();
  cancelClassSwitch();
  player = {
    level: 100, astra: 1000000, stats: {}, inventory: [makeItem()],
    baseStats: { strength: 2, dexterity: 2, intelligence: 2 },
    equipment: { mainHand: makeItem({ id: "equipped" }) },
  };
  player = { ...player, ...recalculateStats(player) };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
  getEnemy.mockReturnValue(null);
});

test("upgrades inventory gear with exact ascending costs without changing equipped stats", () => {
  const original = player.inventory[0];
  const equipment = player.equipment;
  const stats = player.stats;
  expect(getItemUpgradeStatus(original)).toEqual({ ok: true, cost: 5000, nextLevel: 51 });
  expect(upgradeInventoryItem("sword")).toMatchObject({ ok: true });
  const upgraded = player.inventory[0];
  expect(upgraded).toMatchObject({ iLevel: 51, upgrades: 1, price: 5500 });
  expect(getSellPrice(upgraded)).toBe(2750);
  expect(itemTooltip(upgraded).footer).toContain("Value: 5500");
  expect(upgraded.subStats).toEqual({
    speed: 25.5, attackMin: 51, criticalDamage: 0.306, attackPercent: 0.051,
  });
  expect(upgraded.subTiers.speed).toBe(getSubStatTier("speed", 25.5, 51));
  for (const field of ["id", "name", "rarity", "condition", "mainStat", "gemstones",
    "socketCount", "ability", "holofoil", "holofoilEffect", "holofoilBonusVersion", "favorite", "originalOwner"])
    expect(upgraded[field]).toEqual(original[field]);
  expect(original.iLevel).toBe(50);
  expect(original.price).toBe(500);
  expect(original.subStats.speed).toBe(25);
  expect(player.astra).toBe(995000);
  expect(player.stats.strength).toBe(12);
  expect(player.stats).toBe(stats);
  expect(player.equipment).toBe(equipment);

  expect(getItemUpgradeStatus(upgraded).cost).toBe(10200);
  expect(upgradeInventoryItem("sword").ok).toBe(true);
  expect(player.inventory[0]).toMatchObject({ iLevel: 52, upgrades: 2, price: 15700 });
  expect(getSellPrice(player.inventory[0])).toBe(7850);
  expect(player.inventory[0].subStats.speed).toBe(26);
  expect(player.astra).toBe(984800);
});

test("all ten upgrades have ascending costs, then upgrading stops", () => {
  const costs = [];
  for (let index = 0; index < 10; index++) {
    costs.push(getItemUpgradeStatus(player.inventory[0]).cost);
    expect(upgradeInventoryItem("sword").ok).toBe(true);
  }
  expect(costs).toEqual([5000, 10200, 15600, 21200, 27000, 33000, 39200, 45600, 52200, 59000]);
  expect(player.inventory[0]).toMatchObject({ iLevel: 60, upgrades: 10 });
  expect(player.inventory[0].subStats.speed).toBeCloseTo(30, 5);
  expect(player.astra).toBe(1000000 - costs.reduce((sum, cost) => sum + cost, 0));
  expect(player.inventory[0].price).toBe(500 + costs.reduce((sum, cost) => sum + cost, 0));
  const before = player;
  expect(upgradeInventoryItem("sword")).toMatchObject({ ok: false, message: expect.stringContaining("Maximum upgrades") });
  expect(player).toBe(before);
  expect(setPlayer).toHaveBeenCalledTimes(10);
});

test("level 99 can reach 100 but neither level 100 nor higher can upgrade", () => {
  player.inventory[0] = makeItem({ iLevel: 99, upgrades: 2 });
  expect(upgradeInventoryItem("sword").ok).toBe(true);
  expect(player.inventory[0]).toMatchObject({ iLevel: 100, upgrades: 3 });
  expect(player.astra).toBe(970300);
  expect(upgradeInventoryItem("sword")).toMatchObject({ ok: false, message: expect.stringContaining("Maximum item level") });
  player.inventory[0].iLevel = 105;
  expect(upgradeInventoryItem("sword").ok).toBe(false);
  expect(setPlayer).toHaveBeenCalledTimes(1);
});

test("validates the latest wallet and gear before spending, including an exact balance", () => {
  player.astra = 4999;
  expect(upgradeInventoryItem("sword")).toMatchObject({ ok: false, message: expect.stringContaining("5000 astra") });
  expect(setPlayer).not.toHaveBeenCalled();
  player.astra = 5000;
  expect(upgradeInventoryItem("sword").ok).toBe(true);
  expect(player.astra).toBe(0);
  expect(upgradeInventoryItem("sword").ok).toBe(false);
  expect(player.inventory[0].upgrades).toBe(1);
});

test("rejects equipped items, missing items, placeholders, non-gear, and combat", () => {
  player.inventory.push({ id: "placeholder", twoHandedOf: "mainHand", name: "Iron Sword" });
  player.inventory.push(makeItem({ id: "non-gear", slot: "consumable" }));
  player.equipment.offHand = { twoHandedOf: "mainHand", name: "Iron Sword" };
  for (const id of ["equipped", "missing", "placeholder", "non-gear", undefined])
    expect(upgradeInventoryItem(id).ok).toBe(false);
  getEnemy.mockReturnValue({ name: "Enemy" });
  expect(upgradeInventoryItem("sword")).toMatchObject({ ok: false, message: expect.stringContaining("combat") });
  getPlayer.mockReturnValue(null);
  expect(upgradeInventoryItem("sword")).toEqual({ ok: false, message: "No character loaded." });
  expect(setPlayer).not.toHaveBeenCalled();
});

test.each([
  { iLevel: 0 }, { iLevel: 1.5 }, { upgrades: -1 }, { upgrades: 1.5 },
  { upgrades: 10 }, { subStats: { speed: NaN } },
  { price: undefined }, { price: NaN }, { price: Infinity }, { price: -1 },
])("invalid or exhausted item data never spends astra: %j", (changes) => {
  player.inventory[0] = makeItem(changes);
  expect(upgradeInventoryItem("sword").ok).toBe(false);
  expect(player.astra).toBe(1000000);
  expect(setPlayer).not.toHaveBeenCalled();
});

test("inventory weapons and rings are upgraded independently without changing equipment", () => {
  const placeholder = { twoHandedOf: "mainHand", name: "Iron Sword" };
  player.equipment.offHand = placeholder;
  player.inventory = [
    makeItem({ twoHanded: true }),
    makeItem({ id: "ring1", slot: "ring" }),
    makeItem({ id: "ring2", slot: "ring" }),
  ];
  expect(upgradeInventoryItem("sword").ok).toBe(true);
  expect(player.equipment.offHand).toBe(placeholder);
  expect(player.inventory[0].subTiers.speed).toBe(getSubStatTier("speed", 25.5, 51, true));
  expect(upgradeInventoryItem("ring2").ok).toBe(true);
  expect(player.inventory[1].upgrades).toBeUndefined();
  expect(player.inventory[2].upgrades).toBe(1);
  expect(upgradeInventoryItem("ring1").ok).toBe(true);
  expect(player.inventory[1].upgrades).toBe(1);
});

test("legacy character stats remain unchanged when upgrading inventory gear", () => {
  delete player.baseStats;
  expect(upgradeInventoryItem("sword").ok).toBe(true);
  expect(player.baseStats).toBeUndefined();
  expect(player.stats.strength).toBe(12);
});

test("fractional upgrade gains are retained while item stat displays stay readable", () => {
  player.inventory[0] = makeItem({ iLevel: 51, subStats: { speed: 26, attackPercent: 0.001 } });
  expect(upgradeInventoryItem("sword").ok).toBe(true);
  expect(player.inventory[0].subStats).toEqual({ speed: 26.509804, attackPercent: 0.00102 });
  expect(itemTooltip(player.inventory[0]).stats).toContainEqual(
    expect.objectContaining({ label: "Speed", value: "+26.51" }),
  );
});

test("upgrade count survives serialization, unequipping, and reequipping", () => {
  expect(upgradeInventoryItem("sword").ok).toBe(true);
  player = JSON.parse(JSON.stringify(player));
  expect(player.inventory[0]).toMatchObject({ id: "sword", iLevel: 51, upgrades: 1, price: 5500 });
  expect(equipItem(0).ok).toBe(true);
  expect(player.equipment.mainHand).toMatchObject({ iLevel: 51, upgrades: 1, price: 5500 });
  expect(upgradeInventoryItem("sword")).toMatchObject({ ok: false, message: expect.stringContaining("Unequip") });
  expect(unequipItem("mainHand")).toMatchObject({ ok: false, reason: "class-change" });
  expect(confirmClassSwitch().ok).toBe(true);
  expect(upgradeInventoryItem("sword").ok).toBe(true);
  expect(player.inventory.find((item) => item.id === "sword")).toMatchObject({ iLevel: 52, upgrades: 2 });
  const upgraded = player.inventory.find((item) => item.id === "sword");
  expect(getItemUpgradeStatus(upgraded).cost).toBe(15600);
  expect(itemTooltip(upgraded).upgrades).toBe(2);
  expect(itemTooltip(makeItem()).upgrades).toBe(0);
});

test("an item equipped after selection or duplicated in equipment cannot be upgraded", () => {
  player.equipment.mainHand = player.inventory[0];
  expect(upgradeInventoryItem("sword")).toMatchObject({ ok: false, message: expect.stringContaining("Unequip") });
  expect(player.inventory[0].iLevel).toBe(50);
  expect(setPlayer).not.toHaveBeenCalled();
  player.inventory = [];
  expect(upgradeInventoryItem("sword").ok).toBe(false);
});

test("upgrading uses item identity after inventory order changes", () => {
  player.inventory.unshift(makeItem({ id: "other" }));
  expect(upgradeInventoryItem("sword").ok).toBe(true);
  expect(player.inventory[0].upgrades).toBeUndefined();
  expect(player.inventory[1].upgrades).toBe(1);
});
