import { commitPlayerChange, getPlayer, setPlayer } from "../../character/player";
import { get, onValue, update } from "firebase/database";
import { applyConsumable, consumableTooltip, drinkConsumable } from "../../items/consumables";
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
