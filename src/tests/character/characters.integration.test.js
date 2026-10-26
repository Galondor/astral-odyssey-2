import http from "http";
import { deleteApp, getApp } from "firebase/app";
import { get, goOffline, ref } from "firebase/database";
import { db } from "../../firebase";
import { createCharacter, deleteCharacter, loadCharacters } from "../../character/characters";
import { flushPlayer, getPlayer, loadPlayer, savePlayerName, setPlayer, unloadPlayer } from "../../character/player";

jest.mock("../../firebase", () => {
  const { initializeApp } = require("firebase/app");
  const { connectDatabaseEmulator, getDatabase } = require("firebase/database");
  const app = initializeApp({
    projectId: "demo-name-elixir",
    databaseURL: "https://demo-name-elixir-default-rtdb.firebaseio.com",
  }, "characters-integration");
  const db = getDatabase(app);
  if (process.env.DATABASE_RULES_TEST_URL) {
    const url = new URL(process.env.DATABASE_RULES_TEST_URL);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      throw new Error("Character integration tests require a local emulator.");
    connectDatabaseEmulator(db, url.hostname, Number(url.port), {
      mockUserToken: { sub: "alice", user_id: "alice" },
    });
  }
  return { db };
});

const emulator = process.env.DATABASE_RULES_TEST_URL;
const integration = emulator ? describe : describe.skip;

const seed = (value) => new Promise((resolve, reject) => {
  const url = new URL(`${emulator}/.json?ns=demo-name-elixir-default-rtdb`);
  const request = http.request(url, {
    method: "PUT",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
  }, (response) => {
    response.resume();
    response.on("end", () => response.statusCode === 200 ? resolve() : reject(new Error(`Seed failed: ${response.statusCode}`)));
  });
  request.on("error", reject);
  request.end(JSON.stringify(value));
});

integration("character lifecycle with the real Firebase SDK and local database rules", () => {
  afterAll(async () => {
    await unloadPlayer();
    goOffline(db);
    await deleteApp(getApp("characters-integration"));
  });

  test("migrates, creates all slots, switches, names, saves, and reloads without losing progress", async () => {
    Object.defineProperty(global, "crypto", { value: require("crypto").webcrypto, configurable: true });
    localStorage.clear();
    await seed({
      users: { alice: { player: { name: "Alice", level: 20, astra: 500 }, saveRevision: 4 } },
      directory: { alice: { name: "Alice", level: 20 } },
      characterNames: { Alice: "alice" },
    });
    const roster = await loadCharacters("alice");
    expect(roster.characters).toHaveLength(1);
    const first = roster.characters[0].id;
    await loadPlayer("alice", first);
    setPlayer({ astra: 600 });
    await flushPlayer();
    await unloadPlayer();

    const second = await createCharacter("alice");
    await loadPlayer("alice", second);
    expect(getPlayer()).toBeNull();
    expect(await savePlayerName("Nova")).toMatchObject({ ok: true });
    await unloadPlayer();
    await createCharacter("alice");
    await expect(createCharacter("alice")).rejects.toThrow("up to 3");

    await loadPlayer("alice", first);
    expect(getPlayer()).toMatchObject({ name: "Alice", astra: 600 });
    await unloadPlayer();
    await loadPlayer("alice", second);
    expect(getPlayer().name).toBe("Nova");
    const account = (await get(ref(db, "users/alice"))).val();
    expect(account.legacyBackup).toEqual({ name: "Alice", level: 20, astra: 500 });
    expect(Object.keys(account.characters)).toHaveLength(3);
    await unloadPlayer();
    await deleteCharacter("alice", second, "Nova");
    expect((await loadCharacters("alice")).characters).toHaveLength(2);
    await expect(loadPlayer("alice", second)).rejects.toThrow("no longer exists");
    const replacement = await createCharacter("alice");
    expect(replacement).not.toBe(second);
    await loadPlayer("alice", replacement);
    expect(getPlayer()).toBeNull();
    expect(await savePlayerName("Nova")).toMatchObject({ ok: true });
    await unloadPlayer();
    await deleteCharacter("alice", first, "Alice");
    const afterDeletion = (await get(ref(db, "users/alice"))).val();
    expect(afterDeletion.legacyBackup).toBeUndefined();
    expect(afterDeletion.characters[first].player).toBeUndefined();
    expect((await get(ref(db, "leaderboardEntries/alice"))).exists()).toBe(false);
    await createCharacter("alice");
    expect((await loadCharacters("alice")).characters).toHaveLength(3);
  }, 30000);
});
