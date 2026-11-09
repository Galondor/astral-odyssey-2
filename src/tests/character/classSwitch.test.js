import { getPlayer, setPlayer } from "../../character/player";
import { recalculateStats } from "../../character/stats";
import { spendStatPoint, respecSkills, respecStatPoints } from "../../character/progression";
import { cancelClassSwitch, commitWithClassPreview, confirmClassSwitch, getClassSwitchPreview } from "../../character/classSwitch";
import { getEnemy } from "../../combat/combat";
import { deleteOwnedItem, equipItem, removeGemstone, sellEquippedItem, sellGearSelection, socketGemstone, unequipItem } from "../../items/items";
import { dismantleOwnedItem, extractOwnedItem } from "../../items/dismantling";

jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(), setPlayer: jest.fn(), getInventoryItemKey: (item) => item.id,
}));
jest.mock("../../combat/combat", () => ({ getEnemy: jest.fn() }));

let player;
const gear = { id: "sword", name: "Iron Sword", slot: "weapon", rarity: "Rare", condition: "Average", iLevel: 5, price: 100, mainStat: { stat: "strength", value: 30 }, subStats: {} };
beforeEach(() => {
  jest.clearAllMocks();
  cancelClassSwitch();
  getEnemy.mockReturnValue(null);
  player = {
    level: 25, astra: 10000, statPoints: 20, skillPoints: 0,
    baseStats: { strength: 10, dexterity: 1, intelligence: 8 },
    inventory: [gear], equipment: {}, skills: { fireball: 2 }, equippedSkills: ["fireball"],
    classMastery: { Spellblade: ["runicGuard"], Swordsman: ["brace"] },
  };
  player = { ...player, ...recalculateStats(player) };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
});

test("stat spending previews the class transition without spending points; cancel preserves everything", () => {
  const before = JSON.stringify(player);
  expect(spendStatPoint("strength", 10)).toMatchObject({ ok: false, reason: "class-change" });
  expect(getClassSwitchPreview()).toMatchObject({ from: "Spellblade", to: "Swordsman" });
  expect(setPlayer).not.toHaveBeenCalled();
  cancelClassSwitch();
  expect(JSON.stringify(player)).toBe(before);
});

test("confirmation commits equipment and class together, activating saved mastery", () => {
  expect(equipItem(0)).toMatchObject({ reason: "class-change" });
  expect(player.inventory).toHaveLength(1);
  expect(confirmClassSwitch().ok).toBe(true);
  expect(player.class).toBe("Swordsman");
  expect(player.inventory).toHaveLength(0);
  expect(player.equipment.mainHand.id).toBe(gear.id);
  expect(player.classMastery.Spellblade).toEqual(["runicGuard"]);
});

test.each([
  ["unequip", () => unequipItem("mainHand")],
  ["sell", () => sellEquippedItem("mainHand")],
  ["delete", () => deleteOwnedItem(gear, { kind: "equipment", slotKey: "mainHand" })],
  ["dismantle", () => dismantleOwnedItem(gear, () => 0)],
  ["extract", () => extractOwnedItem(gear)],
])("%s equipped gear cannot silently change class or award rewards", (action, mutate) => {
  const owned = action === "extract" ? { ...gear, rarity: "Unique", unique: "hoardkingAxe" } : gear;
  player = { ...player, ...recalculateStats(player, { inventory: [], equipment: { mainHand: owned } }) };
  const before = JSON.stringify(player);
  expect(mutate()).toMatchObject({ ok: false, reason: "class-change" });
  expect(setPlayer).not.toHaveBeenCalled();
  expect(JSON.stringify(player)).toBe(before);
  expect(confirmClassSwitch().ok).toBe(true);
  expect(player.class).toBe("Spellblade");
});

test("socketing and removing a core-stat gem preview class changes before charging or moving gemstones", () => {
  const gem = { id: "ruby", type: "ruby", name: "Ruby", rarity: "Rare", stat: "strength", value: 30, price: 100 };
  player.gemstones = [gem];
  player.equipment = { helmet: { id: "helm", name: "Helm", slot: "helmet", rarity: "Rare", socketCount: 1, subStats: {} } };
  expect(socketGemstone("ruby", { kind: "equipment", slotKey: "helmet" })).toMatchObject({ reason: "class-change" });
  expect(player.gemstones).toHaveLength(1);
  expect(confirmClassSwitch().ok).toBe(true);
  expect(removeGemstone({ kind: "equipment", slotKey: "helmet" })).toMatchObject({ reason: "class-change" });
  expect(player.class).toBe("Swordsman");
  expect(confirmClassSwitch().ok).toBe(true);
  expect(player.class).toBe("Spellblade");
});

test("stat reset previews refunds and costs before a class switch", () => {
  expect(respecStatPoints()).toMatchObject({ reason: "class-change" });
  expect(player.astra).toBe(10000);
  expect(confirmClassSwitch()).toMatchObject({ ok: true, refund: 16, cost: 1250 });
  expect(player.class).toBe("Specialist");
});

test("same-class stat spending commits without a confirmation", () => {
  expect(spendStatPoint("strength")).toEqual({ ok: true });
  expect(getClassSwitchPreview()).toBeNull();
  expect(player.statPoints).toBe(19);
});

test("confirmation rejects stale state and combat without overwriting newer changes", () => {
  equipItem(0);
  player.astra += 1;
  expect(confirmClassSwitch()).toMatchObject({ ok: false, message: expect.stringContaining("changed") });
  expect(player.astra).toBe(10001);
  expect(setPlayer).not.toHaveBeenCalled();
  equipItem(0);
  getEnemy.mockReturnValue({});
  expect(confirmClassSwitch()).toMatchObject({ ok: false, message: expect.stringContaining("combat") });
  expect(setPlayer).not.toHaveBeenCalled();
});

test("permanent bonus patches wait for explicit confirmation", () => {
  const patch = recalculateStats(player, { bonusStats: { intelligence: 50 }, astra: 9000 });
  expect(commitWithClassPreview(player, patch)).toMatchObject({ reason: "class-change" });
  expect(player.astra).toBe(10000);
  expect(confirmClassSwitch().ok).toBe(true);
  expect(player.class).toBe("Spellcaster");
  expect(player.astra).toBe(9000);
});

test("bulk selling is one atomic preview, including inventory items, rewards and all equipped removals", () => {
  const spare = { ...gear, id: "spare" };
  player = { ...player, ...recalculateStats(player, { inventory: [spare], equipment: { mainHand: gear } }) };
  expect(sellGearSelection([0], ["mainHand"])).toMatchObject({ reason: "class-change" });
  expect(player.inventory).toEqual([spare]);
  expect(player.equipment.mainHand).toEqual(gear);
  expect(player.astra).toBe(10000);
  expect(confirmClassSwitch()).toMatchObject({ ok: true, count: 2 });
  expect(player.inventory).toEqual([]);
  expect(player.equipment.mainHand).toBeUndefined();
  expect(player.class).toBe("Spellblade");
  expect(player.astra).toBeGreaterThan(10000);
});

test("shared respec never refunds class techniques or signatures and preserves mastery", () => {
  player.skills = { fireball: 2, runicGuard: 1, fusionStrike: 1 };
  player.equippedSkills = ["fireball", "runicGuard"];
  const mastery = JSON.stringify(player.classMastery);
  expect(respecSkills()).toMatchObject({ ok: true, refund: 2 });
  expect(player.skillPoints).toBe(2);
  expect(player.skills).toEqual({ runicGuard: 1 });
  expect(player.equippedSkills).toEqual(["runicGuard"]);
  expect(JSON.stringify(player.classMastery)).toBe(mastery);
});
