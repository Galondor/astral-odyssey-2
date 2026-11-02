import { commitPlayerChange, getPlayer, setPlayer } from "../../character/player";
import { get, onValue, update } from "firebase/database";
import { applyConsumable, buyConsumable, consumableTooltip, drinkConsumable, getKeyItemEffect, keyItemTooltip, toggleKeyItem } from "../../items/consumables";
import { claimMessage, describeAttachments, normalizeAttachments, startInbox } from "../../world/inbox";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn(), commitPlayerChange: jest.fn() }));
jest.mock("firebase/database", () => ({
  ref: (_, path) => path, get: jest.fn(), onValue: jest.fn(),
  update: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

test("using the elixir requests a name without spending it or modifying stats", () => {
  getPlayer.mockReturnValue({ consumables: { elixirOfNameChanging: 1 }, stats: {} });
  expect(drinkConsumable("elixirOfNameChanging")).toMatchObject({ ok: true, requiresNameChange: true });
  expect(setPlayer).not.toHaveBeenCalled();
});

test("the elixir cannot be spent by the combat potion handler", () => {
  const player = { consumables: { elixirOfNameChanging: 1 } };
  expect(applyConsumable(player, "elixirOfNameChanging", {})).toMatchObject({ ok: false });
  expect(player.consumables.elixirOfNameChanging).toBe(1);
});

test("normal healing potions still work", () => {
  const player = { consumables: { healthPotion: 2 }, stats: { health: 1, maxHealth: 100, power: 0, maxPower: 100 } };
  getPlayer.mockReturnValue(player);
  expect(drinkConsumable("healthPotion")).toMatchObject({ ok: true, consumables: { healthPotion: 1 } });
  expect(setPlayer).toHaveBeenCalledWith(expect.objectContaining({ stats: { ...player.stats, health: 61 } }));
});

test("stamina potions restore all stamina and cannot be wasted at full stamina", () => {
  const player = { consumables: { staminaPotion: 2 }, stats: { health: 100, maxHealth: 100, power: 10, maxPower: 10, stamina: 2, maxStamina: 37 } };
  getPlayer.mockReturnValue(player);
  expect(drinkConsumable("staminaPotion")).toMatchObject({ ok: true, message: expect.stringContaining("35 stamina") });
  expect(setPlayer).toHaveBeenCalledWith({ stats: { ...player.stats, stamina: 37 }, consumables: { staminaPotion: 1 } });
  expect(applyConsumable(player, "staminaPotion", { ...player.stats, stamina: 37 })).toMatchObject({ ok: false });
});

test("cleansing removes all removable debuffs, preserving buffs and uncleanseable effects", () => {
  const player = { consumables: { cleansingPotion: 2 }, stats: { health: 100, maxHealth: 100, power: 10, maxPower: 10 } };
  const statuses = ["poison", "burn", "doom", "corruption", "fortify", "temporalRot", "soulLink"].map((id) => ({ id, turns: 3 }));
  expect(applyConsumable(player, "cleansingPotion", { ...player.stats }, { statuses })).toMatchObject({ ok: true, consumables: { cleansingPotion: 1 } });
  expect(statuses.map((st) => st.id)).toEqual(["fortify", "temporalRot", "soulLink"]);
  expect(applyConsumable(player, "cleansingPotion", { ...player.stats }, { statuses })).toMatchObject({ ok: false });
  getPlayer.mockReturnValue(player);
  expect(drinkConsumable("cleansingPotion")).toMatchObject({ ok: false });
  expect(setPlayer).not.toHaveBeenCalled();
});

test("bulk purchases spend exact astra and add to existing inventory in one update", () => {
  getPlayer.mockReturnValue({ astra: 7000, consumables: { healthPotion: 2 } });
  expect(buyConsumable("healthPotion", 100)).toMatchObject({ ok: true });
  expect(setPlayer).toHaveBeenCalledWith({ astra: 0, consumables: { healthPotion: 102 } });
  expect(setPlayer).toHaveBeenCalledTimes(1);
});

test.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, "2"])("invalid or unaffordable purchase %s changes nothing", (quantity) => {
  getPlayer.mockReturnValue({ astra: 100, consumables: {} });
  expect(buyConsumable("healthPotion", quantity).ok).toBe(false);
  expect(setPlayer).not.toHaveBeenCalled();
});

test("the Hunter's Horn can be toggled off and on, suspending its effect", () => {
  let player = { keyItems: ["huntersHorn"] };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
  expect(getKeyItemEffect(player, "huntBonus")).toBe(1);
  expect(keyItemTooltip("huntersHorn", player).footer).toContain("Active");

  expect(toggleKeyItem("huntersHorn")).toMatchObject({ ok: true });
  expect(player.disabledKeyItems).toEqual(["huntersHorn"]);
  expect(getKeyItemEffect(player, "huntBonus")).toBe(0);
  expect(keyItemTooltip("huntersHorn", player).footer).toContain("Disabled");

  expect(toggleKeyItem("huntersHorn")).toMatchObject({ ok: true });
  expect(player.disabledKeyItems).toEqual([]);
  expect(getKeyItemEffect(player, "huntBonus")).toBe(1);
});

test("non-toggleable and unowned key items cannot be toggled", () => {
  let player = { keyItems: ["analyzer"] };
  getPlayer.mockImplementation(() => player);
  expect(toggleKeyItem("analyzer")).toMatchObject({ ok: false });
  expect(toggleKeyItem("huntersHorn")).toMatchObject({ ok: false });
  expect(setPlayer).not.toHaveBeenCalled();
  expect(keyItemTooltip("analyzer", player).footer).toBeUndefined();
});

test("admin and marketplace elixir attachments normalize and describe correctly", () => {
  const attachments = { consumables: { elixirOfNameChanging: 2 } };
  expect(normalizeAttachments(attachments).consumables).toEqual([["elixirOfNameChanging", 2]]);
  expect(describeAttachments(attachments)).toEqual(["2× Elixir of Name Changing"]);
  expect(consumableTooltip("elixirOfNameChanging").footer).not.toContain("undefined");

  const alloy = { consumables: { prismaticAlloy: 1 } };
  expect(normalizeAttachments(alloy).consumables).toEqual([["prismaticAlloy", 1]]);
  expect(describeAttachments(alloy)).toEqual(["1× Prismatic Alloy"]);
});

test.each([1, 2])("claiming %s mailed elixirs adds consumables, never gear, and cannot be repeated", async (amount) => {
  let player = { name: "Alice", consumables: { elixirOfNameChanging: 1 }, inventory: [] };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
  const mail = { gift: { attachments: { consumables: { elixirOfNameChanging: amount } } } };
  get.mockResolvedValue({ val: () => false });
  let updateState;
  onValue.mockImplementation((path, callback) => {
    if (path === "inboxState/alice") updateState = callback;
    callback({ val: () => path === "inbox/alice" ? mail : {} });
    return () => {};
  });
  update.mockResolvedValue();
  commitPlayerChange.mockImplementation(async (change) => {
    await update(undefined, change());
    updateState({ val: () => ({ gift: { claimed: true, read: true } }) });
  });
  const stop = startInbox("alice", () => {});
  expect(await claimMessage("gift")).toMatchObject({ ok: true });
  expect(player.consumables.elixirOfNameChanging).toBe(1 + amount);
  expect(player.inventory).toEqual([]);
  expect(await claimMessage("gift")).toMatchObject({ ok: false });
  expect(player.consumables.elixirOfNameChanging).toBe(1 + amount);
  stop();
});
