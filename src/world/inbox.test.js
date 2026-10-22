import { get, onValue, set } from "firebase/database";
import { commitPlayerChange, getPlayer, setPlayer } from "../character/player";
import { claimMessage, normalizeAttachments, sendMessage, startInbox } from "./inbox";
import { UNIQUES } from "./dungeonData";

jest.mock("../firebase", () => ({ db: {} }));
jest.mock("../character/player", () => ({
  getPlayer: jest.fn(), setPlayer: jest.fn(), commitPlayerChange: jest.fn(),
}));
jest.mock("firebase/database", () => ({
  ref: (_, path) => path,
  onValue: jest.fn(),
  get: jest.fn(async () => ({ val: () => false })),
  push: (path) => `${path}/sent`,
  set: jest.fn(),
}));

let player;
let writes;
let stop;
beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ val: () => false });
  player = { name: "Nova", astra: 100 };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
  commitPlayerChange.mockImplementation(async (change) => { writes = change(); });
  onValue.mockImplementation((path, callback) => {
    callback({ val: () => path === "inbox/alice"
      ? { gift: { subject: "Gift", attachments: { astra: 25 } } }
      : {} });
    return () => {};
  });
  stop = startInbox("alice", () => {});
});
afterEach(() => stop());

test("claim flags and granted rewards are submitted in the same player commit", async () => {
  expect(await claimMessage("gift")).toEqual({ ok: true, lines: ["25 astra"] });
  expect(player.astra).toBe(125);
  expect(writes).toEqual({
    "inboxState/alice/gift/claimed": true,
    "inboxState/alice/gift/read": true,
  });
  expect(commitPlayerChange).toHaveBeenCalledTimes(1);
});

test("a rejected claim is reported rather than announcing rewards", async () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  commitPlayerChange.mockRejectedValueOnce(new Error("conflicting save"));
  expect(await claimMessage("gift")).toMatchObject({ ok: false });
  expect(player.astra).toBe(100);
  warn.mockRestore();
});

test("marketplace material stacks and exact gemstones can be claimed", async () => {
  const ruby = { id: "ruby-1", name: "Ruby", type: "ruby", stat: "strength", value: 3, rarity: "Rare" };
  expect(normalizeAttachments({ gemstoneItems: [ruby] }).gemstoneItems).toEqual([ruby]);

  stop();
  onValue.mockImplementation((path, callback) => {
    callback({ val: () => path === "inbox/alice"
      ? { market: { subject: "Purchase", attachments: { materials: { slime_gel: 3 }, gemstoneItems: [ruby] } } }
      : {} });
    return () => {};
  });

  stop = startInbox("alice", () => {});

  expect(await claimMessage("market")).toEqual({
    ok: true,
    lines: ["3× Slime Gel", "Rare Ruby"],
  });
  expect(player.materials).toEqual({ slime_gel: 3 });
  expect(player.gemstones).toEqual([ruby]);
});

test("Architect's Rune attachments are recognized and claimed", async () => {
  stop();
  onValue.mockImplementation((path, callback) => {
    callback({ val: () => path === "inbox/alice"
      ? { rune: { subject: "Rune gift", attachments: { consumables: { architectsRune: 3 } } } }
      : {} });
    return () => {};
  });

  stop = startInbox("alice", () => {});
  expect(normalizeAttachments({ consumables: { architectsRune: 3 } }).consumables)
    .toEqual([["architectsRune", 3]]);
  expect(await claimMessage("rune")).toEqual({ ok: true, lines: ["3× Architect's Rune"] });
  expect(player.consumables.architectsRune).toBe(3);
  expect(writes).toEqual({
    "inboxState/alice/rune/claimed": true,
    "inboxState/alice/rune/read": true,
  });
});

test.each(["all", "alice"])("holofoil attachment options survive sending and claiming for %s", async (to) => {
  const colors = ["#123456", "#abcdef"];
  const attachments = {
    gear: [{ slot: "helmet", minRarity: 0, count: 2, holofoil: colors }],
    uniques: [{ id: Object.keys(UNIQUES)[0], count: 1, holofoil: true }],
  };
  await sendMessage({ to, subject: "Foils", body: "Enjoy", attachments });
  expect(set).toHaveBeenCalledWith(
    to === "all" ? "broadcasts/sent" : "inbox/alice/sent",
    expect.objectContaining({ attachments }),
  );
  stop();
  onValue.mockImplementation((path, callback) => {
    callback({ val: () => path === "inbox/alice"
      ? { foils: { subject: "Foils", attachments } } : {} });
    return () => {};
  });
  stop = startInbox("alice", () => {});
  expect(await claimMessage("foils")).toMatchObject({ ok: true });
  expect(player.inventory).toHaveLength(3);
  expect(player.inventory.slice(0, 2).map((item) => item.holofoil)).toEqual([colors, colors]);
  expect(player.inventory[2].holofoil).toHaveLength(2);
});

test("invalid custom holofoil colors cannot be sent", async () => {
  await expect(sendMessage({
    to: "all", subject: "Foils", body: "Enjoy",
    attachments: { gear: [{ slot: "helmet", count: 1, holofoil: ["bad", "#ffffff"] }] },
  })).rejects.toThrow(/hex codes/);
  expect(set).not.toHaveBeenCalled();
});

test("exact marketplace equipment retains its colors rather than rerolling", async () => {
  const item = { id: "foil", name: "Foil helmet", slot: "helmet", holofoil: ["#123456", "#abcdef"] };
  stop();
  onValue.mockImplementation((path, callback) => {
    callback({ val: () => path === "inbox/alice"
      ? { foil: { attachments: { items: [item] } } } : {} });
    return () => {};
  });
  stop = startInbox("alice", () => {});
  expect(await claimMessage("foil")).toMatchObject({ ok: true });
  expect(player.inventory[0]).toMatchObject(item);
});
