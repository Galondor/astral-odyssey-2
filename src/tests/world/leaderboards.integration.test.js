import http from "http";
import { deleteApp, getApp } from "firebase/app";
import { get, goOffline, ref } from "firebase/database";
import { db } from "../../firebase";
import { publishLeaderboardEntry } from "../../world/leaderboards";
import { TITLES } from "../../character/titles";

jest.mock("../../firebase", () => {
  const { initializeApp } = require("firebase/app");
  const { connectDatabaseEmulator, getDatabase } = require("firebase/database");
  const app = initializeApp({
    projectId: "demo-name-elixir",
    databaseURL: "https://demo-name-elixir-default-rtdb.firebaseio.com",
  }, "leaderboards-integration");
  const db = getDatabase(app);
  if (process.env.DATABASE_RULES_TEST_URL) {
    const url = new URL(process.env.DATABASE_RULES_TEST_URL);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      throw new Error("Leaderboard integration tests require a local emulator.");
    connectDatabaseEmulator(db, url.hostname, Number(url.port), {
      mockUserToken: { sub: "alice", user_id: "alice" },
    });
  }
  return { db, auth: { currentUser: { uid: "alice" } } };
});

const emulator = process.env.DATABASE_RULES_TEST_URL;
const integration = emulator ? describe : describe.skip;
const player = { name: "Alice", level: 10, astra: 500, stats: { gearScore: 100 } };

const seed = (value) => new Promise((resolve, reject) => {
  const url = new URL(`${emulator}/.json?ns=demo-name-elixir-default-rtdb`);
  const request = http.request(url, {
    method: "PUT",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
  }, (response) => {
    response.resume();
    response.on("end", () => response.statusCode === 200
      ? resolve()
      : reject(new Error(`Leaderboard seed failed: ${response.statusCode}`)));
  });
  request.on("error", reject);
  request.end(JSON.stringify(value));
});

integration("leaderboard publication with the real Firebase SDK and local rules", () => {
  afterAll(async () => {
    goOffline(db);
    await deleteApp(getApp("leaderboards-integration"));
  });

  test.each(Object.keys(TITLES))("publishes the equipped %s title for character-owned identities", async (activeTitle) => {
    localStorage.clear();
    const characterId = "0000000000000000000000000000000000000000";
    const identity = `title-${activeTitle}`;
    await seed({
      users: { alice: { characters: { [characterId]: { player: { ...player, activeTitle } } } } },
      characterOwners: { [identity]: { accountId: "alice", characterId } },
    });
    await publishLeaderboardEntry(identity, { ...player, activeTitle });
    expect((await get(ref(db, `leaderboardEntries/${identity}`))).val()).toMatchObject({
      activeTitle, level: player.level, astra: player.astra,
    });
  });

  test.each([
    ["missing", {}],
    ["null", { activeTitle: null, titles: [] }],
    ["empty", { activeTitle: "", titles: [] }],
    ["unequipped", { titles: ["giantSlayer"] }],
  ])("publishes players with no equipped title: %s", async (label, titleFields) => {
    const identity = `untitled-${label}`;
    const characterId = "0000000000000000000000000000000000000000";
    const untitledPlayer = { ...player, ...titleFields };
    await seed({
      users: { alice: { characters: { [characterId]: { player: untitledPlayer } } } },
      characterOwners: { [identity]: { accountId: "alice", characterId } },
      leaderboardEntries: {
        [identity]: {
          name: "Alice", accountId: "alice", level: 1, gearScore: 0, astra: 0,
          highestClearedColosseumWave: 0, activeTitle: "giantSlayer",
          updatedAt: Date.now() - 16000,
        },
      },
    });
    await publishLeaderboardEntry(identity, untitledPlayer);
    const published = (await get(ref(db, `leaderboardEntries/${identity}`))).val();
    expect(published).toMatchObject({ level: player.level, astra: player.astra });
    expect(published).not.toHaveProperty("activeTitle");
  });

  test("legacy players with no owned or equipped titles can publish", async () => {
    localStorage.clear();
    await seed({ users: { alice: { player: { ...player, titles: [], activeTitle: null } } } });
    await publishLeaderboardEntry("alice", { ...player, titles: [], activeTitle: null });
    const published = (await get(ref(db, "leaderboardEntries/alice"))).val();
    expect(published).toMatchObject({ level: player.level, astra: player.astra });
    expect(published).not.toHaveProperty("activeTitle");
  });

  test("a cold browser defers a fresh score despite a changed title", async () => {
    localStorage.clear();
    const updatedAt = Date.now();
    await seed({
      users: { alice: { player } },
      leaderboardEntries: {
        alice: {
          name: "Alice", accountId: "alice", level: 10, gearScore: 100, astra: 500,
          highestClearedColosseumWave: 0, activeTitle: "monarchOfTheOdyssey", updatedAt,
        },
      },
    });
    await publishLeaderboardEntry("alice", { ...player, activeTitle: null });
    expect((await get(ref(db, "leaderboardEntries/alice"))).val().updatedAt).toBe(updatedAt);
  });

  test("an expired score publishes and subsequent title changes wait for the cooldown", async () => {
    const identity = "expired-character";
    const characterId = "0000000000000000000000000000000000000000";
    await seed({
      users: { alice: { characters: { [characterId]: { player } } } },
      characterOwners: { [identity]: { accountId: "alice", characterId } },
      leaderboardEntries: {
        [identity]: {
          name: "Alice", accountId: "alice", level: 1, gearScore: 0, astra: 0,
          highestClearedColosseumWave: 0, updatedAt: Date.now() - 16000,
        },
      },
    });
    await publishLeaderboardEntry(identity, player);
    const published = (await get(ref(db, `leaderboardEntries/${identity}`))).val();
    expect(published).toMatchObject({ level: 10, gearScore: 100, astra: 500 });
    await publishLeaderboardEntry(identity, { ...player, activeTitle: "monarchOfTheOdyssey" });
    expect((await get(ref(db, `leaderboardEntries/${identity}`))).val()).toEqual(published);
  });
});
