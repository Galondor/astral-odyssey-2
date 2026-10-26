import { get, runTransaction, update } from "firebase/database";
import { createCharacter, deleteCharacter, loadCharacters } from "../../character/characters";
import { webcrypto } from "crypto";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("firebase/database", () => ({
  ref: (_, path) => path,
  get: jest.fn(),
  runTransaction: jest.fn(),
  update: jest.fn(),
  query: (path, order, value) => ({ path, value }),
  orderByChild: (key) => key,
  equalTo: (value) => value,
}));

let records;
const snapshot = (value) => ({ val: () => value });

beforeEach(() => {
  Object.defineProperty(global, "crypto", { value: webcrypto, configurable: true });
  localStorage.clear();
  records = {};
  jest.clearAllMocks();
  get.mockImplementation(async (path) => snapshot(records[path] ?? null));
  update.mockResolvedValue();
  runTransaction.mockImplementation(async (path, change) => {
    const next = change(records[path] ?? null);
    if (next === undefined) return { committed: false, snapshot: snapshot(records[path] ?? null) };
    records[path] = next;
    return { committed: true, snapshot: snapshot(next) };
  });
});

test("new accounts open with three available slots without creating a character", async () => {
  expect(await loadCharacters("alice")).toEqual({ characters: [], limit: 3 });
  expect(runTransaction).not.toHaveBeenCalled();
});

test("numeric character IDs are unique strings used directly as account keys", async () => {
  const first = await createCharacter("alice");
  const second = await createCharacter("alice");
  expect(first).toMatch(/^[0-9]{40}$/);
  expect(second).toMatch(/^[0-9]{40}$/);
  expect(first).not.toBe(second);
  expect(records[`characterOwners/${first}`]).toEqual({ accountId: "alice", characterId: first });
  expect(Object.keys(records["users/alice"].characters)).toEqual([first, second]);
  expect(records["users/alice"].characters[first].externalId).toBe(first);
});

test("concurrent requests cannot create a fourth character", async () => {
  await createCharacter("alice");
  await createCharacter("alice");
  const results = await Promise.allSettled([createCharacter("alice"), createCharacter("alice")]);
  expect(results.some((result) => result.status === "fulfilled")).toBe(true);
  expect(Object.keys(records["users/alice"].characters)).toHaveLength(3);
});

test("a future server-configured limit permits additional slots", async () => {
  records["characterLimits/alice"] = 5;
  for (let i = 0; i < 5; i++) await createCharacter("alice");
  expect((await loadCharacters("alice")).characters).toHaveLength(5);
  await expect(createCharacter("alice")).rejects.toThrow("up to 5");
});

test("migration preserves the full legacy character and original backup, and is idempotent", async () => {
  const player = {
    name: "Alice", level: 50, astra: 900, inventory: [{ id: "sword" }],
    dungeon: { floor: 2 }, quests: { completed: ["first"] }, bank: { balance: 100 },
  };
  records["users/alice"] = { player, saveRevision: 7 };
  const first = await loadCharacters("alice");
  const [{ id, externalId, player: migrated }] = first.characters;
  expect(id).toMatch(/^[0-9]{40}$/);
  expect(externalId).toBe("alice");
  expect(migrated).toEqual(player);
  expect(records["users/alice"]).toMatchObject({
    player: null, legacyBackup: player, legacyCharacterId: id, saveRevision: 8,
  });
  expect(records["characterOwners/alice"]).toEqual({ accountId: "alice", characterId: id });
  expect(await loadCharacters("alice")).toEqual(first);
  expect(records["users/alice"].saveRevision).toBe(8);
});

test("migration recovers only a safe dirty cache matching the cloud revision", async () => {
  records["users/alice"] = { player: { name: "Alice", astra: 10 }, saveRevision: 3 };
  localStorage.setItem("Player", JSON.stringify({ name: "Alice", astra: 20 }));
  localStorage.setItem("PlayerMeta", JSON.stringify({ uid: "alice", dirty: true, revision: 3 }));
  const roster = await loadCharacters("alice");
  expect(roster.characters[0].player.astra).toBe(20);
  expect(records["users/alice"].legacyBackup.astra).toBe(10);
});

test.each([
  { uid: "bob", dirty: true, revision: 3 },
  { uid: "alice", dirty: true, revision: 2 },
  { uid: "alice", dirty: true, revision: 3, unsafe: true },
])("migration cannot overwrite cloud progress with an unsafe cache: %j", async (meta) => {
  records["users/alice"] = { player: { name: "Alice", astra: 10 }, saveRevision: 3 };
  localStorage.setItem("Player", JSON.stringify({ name: "Alice", astra: 999 }));
  localStorage.setItem("PlayerMeta", JSON.stringify(meta));
  expect((await loadCharacters("alice")).characters[0].player.astra).toBe(10);
});

test("an unversioned dirty cache cannot overwrite an existing unversioned cloud character", async () => {
  records["users/alice"] = { player: { name: "Alice", astra: 10 } };
  localStorage.setItem("Player", JSON.stringify({ name: "Alice", astra: 999 }));
  localStorage.setItem("PlayerMeta", JSON.stringify({ uid: "alice", dirty: true }));
  expect((await loadCharacters("alice")).characters[0].player.astra).toBe(10);
});

test("failed migration leaves the original save intact and propagates the failure", async () => {
  const original = { player: { name: "Alice" }, saveRevision: 1 };
  records["users/alice"] = original;
  runTransaction.mockImplementationOnce(async (path, change) => {
    const value = change(null);
    return { committed: true, snapshot: snapshot(value) };
  }).mockImplementationOnce(async (path, change) => {
    const value = change(null);
    return { committed: true, snapshot: snapshot(value) };
  }).mockRejectedValueOnce(new Error("offline"));
  await expect(loadCharacters("alice")).rejects.toThrow("offline");
  expect(records["users/alice"]).toEqual(original);
});

test("deletion atomically clears progress and linked data while preserving other characters", async () => {
  records["users/alice"] = {
    saveRevision: 5, legacyCharacterId: "123", legacyBackup: { name: "Nova" },
    characters: {
      "123": { externalId: "alice", slot: 0, createdAt: 1, player: { name: "Nova" } },
      "456": { externalId: "456", slot: 1, createdAt: 2, player: { name: "Luna" } },
    },
  };
  records["characterNames/Nova"] = "alice";
  get.mockImplementation(async (path) => snapshot(typeof path === "object" ? { sale: {} } : records[path] ?? null));
  await deleteCharacter("alice", "123", "Nova");
  const writes = update.mock.calls[0][1];
  expect(writes).toMatchObject({
    "users/alice/characters/123": { externalId: "alice", slot: 0, deletedAt: expect.any(Number) },
    "users/alice/saveRevision": 6,
    "directory/alice": null, "leaderboardEntries/alice": null,
    "inbox/alice": null, "inboxState/alice": null,
    "characterNames/Nova": null, "marketplace/sale": null,
    "users/alice/legacyBackup": null, "users/alice/legacyCharacterId": null,
  });
  expect(writes["users/alice/characters/123"].player).toBeUndefined();
  expect(writes["users/alice/characters/456"]).toBeUndefined();
});

test.each(["nova", " Nova", "Nova ", ""])("deletion rejects incorrect confirmation %j", async (confirmation) => {
  records["users/alice"] = { characters: { "123": { player: { name: "Nova" } } } };
  await expect(deleteCharacter("alice", "123", confirmation)).rejects.toThrow("exact name");
  expect(update).not.toHaveBeenCalled();
});

test("deleted characters stay hidden and their slot creates a fresh identity", async () => {
  const old = await createCharacter("alice");
  const slot = records["users/alice"].characters[old];
  slot.deletedAt = 1;
  expect((await loadCharacters("alice")).characters).toEqual([]);
  const replacement = await createCharacter("alice");
  expect(replacement).not.toBe(old);
  expect(records["users/alice"].characters[replacement].slot).toBe(0);
  expect((await loadCharacters("alice")).characters).toHaveLength(1);
});

test("failed deletion propagates the failure without changing the local roster", async () => {
  const id = await createCharacter("alice");
  update.mockRejectedValueOnce(new Error("permission_denied"));
  await expect(deleteCharacter("alice", id, "New adventurer")).rejects.toThrow("permission_denied");
  expect((await loadCharacters("alice")).characters).toHaveLength(1);
});
