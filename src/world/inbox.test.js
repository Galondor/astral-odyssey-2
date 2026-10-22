import { get, onValue } from "firebase/database";
import { commitPlayerChange, getPlayer, setPlayer } from "../character/player";
import { claimMessage, normalizeAttachments, startInbox } from "./inbox";

jest.mock("../firebase", () => ({ db: {} }));
jest.mock("../character/player", () => ({
  getPlayer: jest.fn(), setPlayer: jest.fn(), commitPlayerChange: jest.fn(),
}));
jest.mock("firebase/database", () => ({
  ref: (_, path) => path,
  onValue: jest.fn(),
  get: jest.fn(async () => ({ val: () => false })),
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
