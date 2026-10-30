jest.mock("../../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "account" } },
}));
jest.mock("firebase/database", () => ({
  get: jest.fn(),
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
  database.update.mockResolvedValue();
  database.remove.mockResolvedValue();
  database.runTransaction.mockImplementation(async (_, callback) => ({
    snapshot: { val: () => ({ ...callback(null), updatedAt: Date.now() }) },
  }));
  api = require("../../world/leaderboards");
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
