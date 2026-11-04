jest.mock("../../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "account" } },
}));
jest.mock("firebase/database", () => ({
  get: jest.fn(),
  onValue: jest.fn(),
  ref: (_, path = "") => path,
  remove: jest.fn(),
  update: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: () => 123,
}));

let api;
let database;
let values;

const score = (name, wave = 0) => ({
  name, level: 10, gearScore: 100, astra: 500, highestClearedColosseumWave: wave,
});

beforeEach(() => {
  jest.resetModules();
  localStorage.clear();
  database = require("firebase/database");
  values = {};
  database.get.mockImplementation(async (path) => ({ val: () => values[path] ?? null }));
  database.onValue.mockImplementation((path, listener) => {
    listener({ val: () => values[path] ?? 0 });
    return () => {};
  });
  database.update.mockResolvedValue();
  database.remove.mockResolvedValue();
  database.runTransaction.mockImplementation(async (_, callback) => ({
    snapshot: { val: () => ({ ...callback(null), updatedAt: Date.now() }) },
  }));
  api = require("../../world/leaderboards");
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("scores publish immediately and republish at the 15-second cooldown boundary", async () => {
  const now = jest.spyOn(Date, "now").mockReturnValue(100000);
  const player = { name: "Player", level: 10 };
  await api.publishLeaderboardEntry("character", player);
  expect(database.runTransaction).toHaveBeenCalledTimes(1);

  now.mockReturnValue(114999);
  await api.publishLeaderboardEntry("character", { ...player, level: 11 });
  expect(database.runTransaction).toHaveBeenCalledTimes(1);

  now.mockReturnValue(115000);
  await api.publishLeaderboardEntry("character", { ...player, level: 11 });
  expect(database.runTransaction).toHaveBeenCalledTimes(2);
  const [, publish] = database.runTransaction.mock.calls[1];
  expect(publish(null)).toMatchObject({ name: "Player", level: 11 });
});

test("the stored publication cooldown expires after 15 seconds in a returning session", async () => {
  const now = jest.spyOn(Date, "now").mockReturnValue(114999);
  localStorage.setItem("LeaderboardPublishedV2:character", "100000");
  const player = { name: "Player", level: 11 };

  await api.publishLeaderboardEntry("character", player);
  expect(database.runTransaction).not.toHaveBeenCalled();

  now.mockReturnValue(115000);
  await api.publishLeaderboardEntry("character", player);
  expect(database.runTransaction).toHaveBeenCalledTimes(1);
});

test("the server score cooldown expires after 15 seconds in a new browser", async () => {
  const now = jest.spyOn(Date, "now").mockReturnValue(114999);
  const current = { ...score("Player"), accountId: "account", updatedAt: 100000 };
  database.runTransaction.mockImplementation(async (_, callback) => ({
    snapshot: { val: () => callback(current) ?? current },
  }));
  const player = { name: "Player", level: 11 };

  await api.publishLeaderboardEntry("character", player);
  expect(database.runTransaction.mock.calls[0][1](current)).toBeUndefined();

  now.mockReturnValue(115000);
  await api.publishLeaderboardEntry("character", player);
  expect(database.runTransaction).toHaveBeenCalledTimes(2);
  expect(database.runTransaction.mock.calls[1][1](current)).toMatchObject({ level: 11 });
});

test("rankings use the cache only until the 15-second refresh boundary", async () => {
  const now = jest.spyOn(Date, "now").mockReturnValue(100000);
  values.leaderboardEntries = { character: { ...score("Player"), accountId: "account" } };
  await api.getLeaderboards();
  values.leaderboardEntries = {
    character: { ...score("Player"), level: 11, accountId: "account" },
  };

  now.mockReturnValue(114999);
  expect((await api.getLeaderboards()).entries.character.level).toBe(10);
  expect(database.get.mock.calls.filter(([path]) => path === "leaderboardEntries")).toHaveLength(1);

  now.mockReturnValue(115000);
  expect((await api.getLeaderboards()).entries.character.level).toBe(11);
  expect(database.get.mock.calls.filter(([path]) => path === "leaderboardEntries")).toHaveLength(2);
});

test("equipping and removing a title cannot bypass the publication cooldown", async () => {
  const now = jest.spyOn(Date, "now").mockReturnValue(100000);
  const player = { name: "Player", activeTitle: "monarchOfTheOdyssey" };
  await api.publishLeaderboardEntry("character", player);
  now.mockReturnValue(100001);
  await api.publishLeaderboardEntry("character", { ...player, activeTitle: null });
  expect(database.runTransaction).toHaveBeenCalledTimes(1);
  now.mockReturnValue(115000);
  await api.publishLeaderboardEntry("character", { ...player, activeTitle: null });
  expect(database.runTransaction).toHaveBeenCalledTimes(2);
  expect(database.runTransaction.mock.calls[1][1](null)).not.toHaveProperty("activeTitle");
});

test.each([-60000, 60000])("publication uses server time when the device clock is offset by %i ms", async (offset) => {
  const now = jest.spyOn(Date, "now").mockReturnValue(114999 - offset);
  values[".info/serverTimeOffset"] = offset;
  localStorage.setItem("LeaderboardPublishedV2:character", "100000");
  await api.publishLeaderboardEntry("character", { name: "Player" });
  expect(database.runTransaction).not.toHaveBeenCalled();
  now.mockReturnValue(115000 - offset);
  await api.publishLeaderboardEntry("character", { name: "Player" });
  expect(database.runTransaction).toHaveBeenCalledTimes(1);
});

test("a fresh server entry prevents a cold-browser write even when the title changed", async () => {
  jest.spyOn(Date, "now").mockReturnValue(100001);
  values["leaderboardEntries/character"] = {
    ...score("Player"), accountId: "account", updatedAt: 100000,
    activeTitle: "monarchOfTheOdyssey",
  };
  await api.publishLeaderboardEntry("character", { name: "Player", activeTitle: null });
  expect(database.runTransaction).not.toHaveBeenCalled();
  expect(localStorage.getItem("LeaderboardPublishedV2:character")).toBe("100000");
});

test("server time failures reject rather than attempting an unverified publication", async () => {
  database.onValue.mockImplementation((_, __, reject) => reject(new Error("Disconnected")));
  await expect(api.publishLeaderboardEntry("character", { name: "Player" })).rejects.toThrow("Disconnected");
  expect(database.runTransaction).not.toHaveBeenCalled();
});

test("compact scores publish cleared waves, never the older reached-wave record", () => {
  expect(api.buildLeaderboardEntry({
    name: "Player",
    records: { highestClearedColosseumWave: 8, highestColosseumWave: 9 },
  }).highestClearedColosseumWave).toBe(8);
});

test("wave ranking excludes zero clears, missing scores, and admin entries and preserves ties", () => {
  const rows = api.rankLeaderboard({
    a: score("Alice", 8),
    b: score("Bryn", 8),
    c: score("Cora", 5),
    d: score("Newcomer"),
    admin: { ...score("Admin", 100), isAdmin: true },
    legacy: { name: "Legacy", level: 50, gearScore: 1000, astra: 9000 },
  }, "highestClearedColosseumWave");
  expect(rows.map(({ name, rank }) => [name, rank])).toEqual([
    ["Alice", 1], ["Bryn", 1], ["Cora", 3],
  ]);
});

test("loading rankings removes legacy and character-owned admin entries", async () => {
  values.admins = { admin: true };
  values.leaderboardEntries = {
    legacy: score("Player", 2),
    admin: score("Legacy Admin", 50),
    character: score("Admin Character", 60),
  };
  values["characterOwners/character/accountId"] = "admin";

  const snapshot = await api.getLeaderboards();

  expect(Object.keys(snapshot.entries)).toEqual(["legacy"]);
  expect(database.update).toHaveBeenCalledWith("", {
    "leaderboardEntries/admin": null,
    "leaderboardEntries/character": null,
  });
  for (const metric of ["level", "gearScore", "astra", "highestClearedColosseumWave"])
    expect(api.rankLeaderboard(snapshot.entries, metric).map(({ uid }) => uid)).toEqual(["legacy"]);
});

test("fresh cached scores are rechecked when their account becomes an admin", async () => {
  values.leaderboardEntries = { character: { ...score("Player", 5), accountId: "account" } };
  await api.getLeaderboards();
  values.admins = { account: true };

  const snapshot = await api.getLeaderboards();

  expect(snapshot.entries).toEqual({});
  expect(database.get.mock.calls.filter(([path]) => path === "leaderboardEntries")).toHaveLength(1);
  expect(database.update).toHaveBeenCalledWith("", { "leaderboardEntries/character": null });
});

test("admin publication deletes an existing score even during publication cooldown", async () => {
  const player = { name: "Player", records: { highestClearedColosseumWave: 5 } };
  await api.publishLeaderboardEntry("character", player);
  expect(database.runTransaction).toHaveBeenCalledTimes(1);
  values["admins/account"] = true;

  await api.publishLeaderboardEntry("character", player);

  expect(database.runTransaction).toHaveBeenCalledTimes(1);
  expect(database.remove).toHaveBeenCalledWith("leaderboardEntries/character");
});

test("eligibility failures reject instead of showing unverified rankings", async () => {
  database.get.mockRejectedValue(new Error("Permission denied"));
  await expect(api.getLeaderboards()).rejects.toThrow("Permission denied");
});
