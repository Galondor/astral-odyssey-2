import { get, onValue, set, update } from "firebase/database";
import { commitPlayerChange, getPlayer, setPlayer } from "../../character/player";
import { administerPlayerTimer, claimMessage, describeAttachments, getMessages, hasAttachments, normalizeAttachments, sendMessage, startInbox } from "../../world/inbox";
import { UNIQUES } from "../../world/dungeonData";
import { createCustomItem } from "../../items/items";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(), setPlayer: jest.fn(), commitPlayerChange: jest.fn(),
}));
jest.mock("firebase/database", () => ({
  ref: (_, path) => path,
  onValue: jest.fn(),
  get: jest.fn(async () => ({ val: () => false })),
  push: (path) => `${path}/sent`,
  set: jest.fn(),
  update: jest.fn(),
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

test.each([false, true])("admin Colosseum resets preserve progress and bump save revisions (character=%s)", async (character) => {
  stop();
  get.mockImplementation(async (path) => ({
    val: () => path === "admins/admin" ? true
      : path === "characterOwners/target" && character
        ? { accountId: "account", characterId: "1".repeat(40) }
        : path.endsWith("/saveRevision") ? 7 : null,
  }));
  stop = startInbox("admin", () => {});
  await Promise.resolve();

  await administerPlayerTimer("target", "colosseum");

  const accountId = character ? "account" : "target";
  const playerPath = character
    ? `users/account/characters/${"1".repeat(40)}/player`
    : "users/target/player";
  expect(update).toHaveBeenCalledWith(undefined, {
    [`users/${accountId}/saveRevision`]: 8,
    [`${playerPath}/lastColosseumRunAt`]: null,
  });
});

test("non-admins cannot force-refresh a Colosseum timer", async () => {
  await Promise.resolve();
  await expect(administerPlayerTimer("target", "colosseum")).rejects.toThrow("Admin access is required.");
  expect(update).not.toHaveBeenCalled();
});

test("title mail only grants catalog titles when claimed and equips the first claimed title", async () => {
  const title = "monarchOfTheOdyssey";
  expect(normalizeAttachments({ titles: [title, "not-a-title"] }).titles).toEqual([title]);
  expect(hasAttachments({ titles: [title] })).toBe(true);
  await sendMessage({ to: "alice", subject: "Title", body: "A reward.", attachments: { titles: [title] } });
  expect(set).toHaveBeenCalledWith("inbox/alice/sent", expect.objectContaining({
    attachments: { titles: [title] },
  }));

  stop();
  onValue.mockImplementation((path, callback) => {
    callback({ val: () => path === "inbox/alice"
      ? { title: { subject: "Title", attachments: { titles: [title] } } }
      : {} });
    return () => {};
  });
  stop = startInbox("alice", () => {});

  expect(await claimMessage("title")).toEqual({ ok: true, lines: ["Monarch of the Odyssey"] });
  expect(player.titles).toEqual([title]);
  expect(player.activeTitle).toBe(title);
  expect(writes).toEqual({
    "inboxState/alice/title/claimed": true,
    "inboxState/alice/title/read": true,
    "users/alice/accountWideTitles/monarchOfTheOdyssey": true,
  });
});

test("character mail uses the character identity while admin access uses the account", () => {
  stop();
  stop = startInbox("1234567890", () => {}, "alice");
  expect(onValue.mock.calls.some(([path]) => path === "inbox/1234567890")).toBe(true);
  expect(onValue.mock.calls.some(([path]) => path === "inboxState/1234567890")).toBe(true);
  expect(get).toHaveBeenLastCalledWith("admins/alice");
});

test("queued claims retain their character identity after the inbox unmounts", async () => {
  let finish;
  commitPlayerChange.mockImplementationOnce((change) => new Promise((resolve) => {
    finish = () => { writes = change(); resolve(); };
  }));
  const pending = claimMessage("gift");
  stop();
  finish();
  expect(await pending).toMatchObject({ ok: true });
  expect(writes["inboxState/alice/gift/claimed"]).toBe(true);
  expect(Object.keys(writes).some((path) => path.includes("/null/"))).toBe(false);
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

test("Labyrinth materials and consumables can be mailed and claimed", async () => {
  const attachments = {
    materials: { relicFragments: 7, labyrinth_etched_fang: 2, sealedRelic: 1 },
    consumables: { relic: 1, healthPotion: 2 },
    uniques: [{ id: "unwrittenPath", count: 1 }],
  };
  expect(normalizeAttachments(attachments).materials).toEqual([
    ["relicFragments", 7],
    ["labyrinth_etched_fang", 2],
    ["sealedRelic", 2],
  ]);
  expect(normalizeAttachments(attachments).consumables).toEqual([
    ["healthPotion", 2],
  ]);
  await sendMessage({ to: "alice", subject: "Labyrinth supplies", body: "A reward.", attachments });
  expect(set).toHaveBeenCalledWith(
    "inbox/alice/sent",
    expect.objectContaining({
      attachments: {
        materials: { relicFragments: 7, labyrinth_etched_fang: 2, sealedRelic: 2 },
        consumables: { healthPotion: 2 },
        uniques: [{ id: "unwrittenPath", count: 1 }],
      },
    }),
  );

  stop();
  onValue.mockImplementation((path, callback) => {
    callback({ val: () => path === "inbox/alice"
      ? { labyrinth: { subject: "Labyrinth supplies", attachments } }
      : {} });
    return () => {};
  });
  stop = startInbox("alice", () => {});

  expect(await claimMessage("labyrinth")).toEqual({
    ok: true,
    lines: ["7× Relic Fragments", "2× Maze-Etched Fang", "2× Sealed Relic", "2× Health Potion", "The Unwritten Path"],
  });
  expect(player.materials).toEqual({ relicFragments: 7, labyrinth_etched_fang: 2, sealedRelic: 2 });
  expect(player.consumables).toEqual({ healthPotion: 2 });
  expect(player.inventory[0]).toMatchObject({
    name: "The Unwritten Path",
    rarity: "Unique",
    slot: "weapon",
    ability: { name: "Unwritten Path" },
  });
});

test("legacy sealed relic mail is converted to the unique material", () => {
  expect(normalizeAttachments({ consumables: { relic: 3 } })).toMatchObject({
    materials: [["sealedRelic", 3]],
    consumables: [],
  });
});

test("exact gear attachments are restricted to the slot's substat pool", async () => {
  const item = {
    id: "admin-gift",
    name: "Admin Gift",
    slot: "weapon",
    subStats: { attackMin: 4, luck: 5 },
    subTiers: { attackMin: 3, luck: 4 },
  };
  const normalized = normalizeAttachments({ items: [item] }).items[0];
  expect(normalized.subStats).toEqual({ attackMin: 4 });
  expect(normalized.subTiers).toEqual({ attackMin: 3 });

  await sendMessage({
    to: "alice",
    subject: "Gear",
    body: "Enjoy",
    attachments: { items: [item] },
  });
  expect(set).toHaveBeenCalledWith(
    "inbox/alice/sent",
    expect.objectContaining({
      attachments: { items: [expect.objectContaining({ subStats: { attackMin: 4 }, subTiers: { attackMin: 3 } })] },
    }),
  );
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

test("mailed gear can enforce a minimum stat tier", () => {
  const gear = { gear: [{ slot: "weapon", minRarity: 3, minTier: 3, count: 1 }] };
  expect(normalizeAttachments(gear).gear).toEqual(gear.gear);
  expect(describeAttachments(gear)).toEqual(["1× random Epic+ T3+ weapon"]);
});

test("World Boss rewards appear as claimable mail", async () => {
  const cycle = "123456789";
  stop();
  onValue.mockImplementation((path, callback) => {
    callback({ val: () => path === "worldBossMail/alice"
      ? { [cycle]: { subject: "The Colossus has fallen!", body: "Rank #1", from: "World Boss", sentAt: 1, attachments: { astra: 500 } } }
      : {} });
    return () => {};
  });
  stop = startInbox("alice", () => {});

  expect(getMessages()).toContainEqual(expect.objectContaining({
    id: `world-boss-${cycle}`,
    source: "worldBossMail",
    from: "World Boss",
  }));
  expect(await claimMessage(`world-boss-${cycle}`)).toEqual({ ok: true, lines: ["500 astra"] });
  expect(writes).toEqual({
    [`inboxState/alice/world-boss-${cycle}/claimed`]: true,
    [`inboxState/alice/world-boss-${cycle}/read`]: true,
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

test.each(["all", "alice"])("custom gear is sent and claimed with exact values for %s", async (to) => {
    const item = createCustomItem({
      name: "Admin's Gift", slot: "weapon", rarity: "Legendary", condition: "Broken",
      iLevel: 99, price: 123, mainStat: { stat: "dexterity", tier: 7 },
      subStats: { criticalDamage: 3, attackMin: 5 }, ability: "Piercing", twoHanded: true,
      holofoil: true,
    });
    const plain = createCustomItem({
      name: "Plain Gift", slot: "ring", rarity: "Common", condition: "Average",
      iLevel: 1, price: 0, mainStat: { stat: "strength", tier: 0 },
    });
    const attachments = { items: [item, plain] };
    await sendMessage({ to, subject: "Custom gear", body: "Enjoy", attachments });
    expect(set).toHaveBeenCalledWith(to === "all" ? "broadcasts/sent" : "inbox/alice/sent",
      expect.objectContaining({ attachments }));
    const stored = JSON.parse(JSON.stringify(set.mock.calls[0][1]));
    // Firebase omits empty objects and null fields.
    delete stored.attachments.items[1].subStats;
    delete stored.attachments.items[1].ability;
    stop();
    onValue.mockImplementation((path, callback) => {
      callback({ val: () => path === (to === "all" ? "broadcasts" : "inbox/alice")
        ? { custom: stored } : {} });
      return () => {};
    });
    stop = startInbox("alice", () => {});
    const random = jest.spyOn(Math, "random").mockImplementation(() => { throw new Error("Unexpected RNG"); });
    try {
      expect(await claimMessage("custom")).toEqual({ ok: true, lines: [item.name, plain.name] });
      expect(player.inventory).toEqual([item, plain]);
      expect(random).not.toHaveBeenCalled();
      expect(writes["inboxState/alice/custom/claimed"]).toBe(true);
    } finally {
      random.mockRestore();
    }
  });
