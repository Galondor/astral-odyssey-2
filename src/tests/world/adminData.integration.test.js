import http from "http";
import { deleteApp, getApp } from "firebase/app";
import { get, goOffline, ref } from "firebase/database";
import { auth, db } from "../../firebase";
import { resetPlayerData, resetServerData } from "../../world/adminData";

jest.mock("../../firebase", () => {
  const { initializeApp } = require("firebase/app");
  const { connectDatabaseEmulator, getDatabase } = require("firebase/database");
  const app = initializeApp({
    projectId: "demo-name-elixir",
    databaseURL: "https://demo-name-elixir-default-rtdb.firebaseio.com",
  }, "admin-reset-integration");
  const db = getDatabase(app);
  if (process.env.DATABASE_RULES_TEST_URL) {
    const url = new URL(process.env.DATABASE_RULES_TEST_URL);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      throw new Error("Reset integration tests require a local emulator.");
    connectDatabaseEmulator(db, url.hostname, Number(url.port), {
      mockUserToken: { sub: "admin", user_id: "admin" },
    });
  }
  return { db, auth: { currentUser: { uid: "admin" } } };
});

const emulator = process.env.DATABASE_RULES_TEST_URL;
const integration = emulator ? describe : describe.skip;
const first = "1".repeat(40);
const second = "2".repeat(40);
const token = (uid) => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    aud: "demo-name-elixir", iss: "https://securetoken.google.com/demo-name-elixir",
    sub: uid, user_id: uid, iat: now, exp: now + 3600,
    firebase: { sign_in_provider: "custom" },
  })}.`;
};
const request = (method, value, uid = "owner") => new Promise((resolve, reject) => {
  const url = new URL(`${emulator}/.json?ns=demo-name-elixir-default-rtdb`);
  const headers = { "Content-Type": "application/json" };
  if (uid === "owner") headers.Authorization = "Bearer owner";
  else if (uid) url.searchParams.set("auth", token(uid));
  const req = http.request(url, { method, headers }, (res) => {
    let body = "";
    res.on("data", (chunk) => { body += chunk; });
    res.on("end", () => resolve({ status: res.statusCode, data: JSON.parse(body || "null") }));
  });
  req.on("error", reject);
  req.end(JSON.stringify(value));
});

integration("admin data resets with the real Firebase SDK and local rules", () => {
  let original;
  beforeEach(async () => {
    auth.currentUser = { uid: "admin" };
    original = {
      admins: { admin: true },
      characterLimits: { account: 4 },
      characterOwners: {
        account: { accountId: "account", characterId: first },
        [second]: { accountId: "account", characterId: second },
      },
      characterSlots: { account: {
        0: { index: 0, characterId: first }, 1: { index: 1, characterId: second },
      } },
      characterNames: { Nova: "account", Luna: second, Admin: "admin" },
      users: {
        account: {
          saveRevision: 7, lastCharacterIdentity: "account",
          legacyCharacterId: first, legacyBackup: { name: "Nova", astra: 500 },
          accountWideTitles: { monarchOfTheOdyssey: true },
          characters: {
            [first]: { externalId: "account", slot: 0, createdAt: 1, player: {
              name: "Nova", level: 99, astra: 5000, inventory: [{ name: "Sword" }], bank: { balance: 500 },
            } },
            [second]: { externalId: second, slot: 1, createdAt: 2, player: { name: "Luna", level: 20, astra: 500 } },
          },
        },
        admin: { saveRevision: 2, player: { name: "Admin", level: 50, astra: 123 } },
      },
      directory: { account: { name: "Nova", level: 99 }, [second]: { name: "Luna", level: 20 } },
      leaderboardEntries: { account: { name: "Nova", level: 99 }, [second]: { name: "Luna", level: 20 } },
      marketplace: { mine: { sellerUid: "account" }, other: { sellerUid: second } },
      inbox: { account: { gift: { attachments: { astra: 500 } } } },
      broadcasts: { old: { attachments: { astra: 100 } } },
      worldBoss: { cycles: { cycle: { totalDamage: 100, players: { account: { damage: 100 } } } } },
      worldBossMail: { account: { cycle: { attachments: { astra: 100 } } } },
      friends: { account: { [second]: { name: "Luna", since: 1 } }, [second]: { account: { name: "Nova", since: 1 } } },
      groupParties: { party: { leader: "account", dungeon: "tidewrack", createdAt: 1, members: { account: { name: "Nova", level: 99 } } } },
      groupMembership: { account: "party" },
      groupLfg: { party: { dungeon: "tidewrack", leaderName: "Nova", size: 1, at: 1 } },
      contest: { entries: { account: { status: "waiting" } } },
      bugReports: { report: { uid: "account" } },
    };
    expect((await request("PUT", original)).status).toBe(200);
  });
  afterAll(async () => {
    await request("PUT", null);
    goOffline(db);
    await deleteApp(getApp("admin-reset-integration"));
  });

  test("a character reset persists, preserves other characters, and blocks stale saves", async () => {
    await resetPlayerData("account", "Nova");
    const data = (await get(ref(db))).val();
    expect(data.users.account.characters[first].player).toMatchObject({
      name: "Nova", astra: 0, level: 1, resetPending: true,
    });
    expect(data.users.account.characters[first].player.inventory).toBeUndefined();
    expect(data.users.account.characters[second]).toEqual(original.users.account.characters[second]);
    expect(data.users.account.saveRevision).toBe(8);
    expect(data.users.account.legacyBackup).toBeUndefined();
    expect(data.users.account.accountWideTitles).toEqual(original.users.account.accountWideTitles);
    expect(data.inbox?.account).toBeUndefined();
    expect(data.inboxState.account.old).toEqual({ claimed: true, read: true, deleted: true });
    expect(data.marketplace.mine).toBeUndefined();
    expect(data.leaderboardEntries.account).toBeUndefined();
    expect(data.leaderboardEntries[second]).toBeDefined();
    expect(data.groupParties).toBeUndefined();
    expect(data.worldBoss.cycles.cycle.players).toBeUndefined();
    expect((await request("PATCH", {
      [`users/account/characters/${first}/player`]: original.users.account.characters[first].player,
      "users/account/saveRevision": 8,
    }, "account")).status).toBe(401);
    expect((await get(ref(db, `users/account/characters/${first}/player/astra`))).val()).toBe(0);
  });

  test("server reset persists across reads, clears shared data, and preserves accounts and identities", async () => {
    expect(await resetServerData("RESET SERVER")).toBe(3);
    const data = (await get(ref(db))).val();
    for (const key of ["admins", "characterOwners", "characterNames", "characterLimits"])
      expect(data[key]).toEqual(original[key]);
    expect(data.characterSlots.account).toEqual(Object.values(original.characterSlots.account));
    expect(data.users.account.saveRevision).toBe(8);
    expect(data.users.admin.saveRevision).toBe(3);
    expect(data.users.account.accountWideTitles).toBeUndefined();
    expect(data.users.account.legacyBackup).toBeUndefined();
    expect(data.users.account.characters[first]).toMatchObject({
      externalId: "account", slot: 0, createdAt: 1, player: { name: "Nova", astra: 0, level: 1 },
    });
    for (const path of ["broadcasts", "inbox", "inboxState", "worldBossMail", "worldBoss",
      "marketplace", "leaderboardEntries", "friends", "contest", "groupParties", "bugReports"])
      expect(data[path]).toBeUndefined();
    expect(data.directory.account).toMatchObject({ name: "Nova", level: 1, gearScore: 0 });
    expect(data.publicProfiles.account).toMatchObject({ name: "Nova", level: 1, astra: 0 });
  });

  test("rules reject unauthenticated and non-admin reset writes and private reads", async () => {
    for (const uid of [null, "account", "stranger"]) {
      expect((await request("GET", undefined, uid)).status).toBe(401);
      expect((await request("PATCH", { marketplace: null, broadcasts: null, worldBoss: null }, uid)).status).toBe(401);
      expect((await request("PATCH", {
        [`users/account/characters/${first}/player`]: { name: "Nova", astra: 0, level: 1 },
        "users/account/saveRevision": 8,
      }, uid === "account" ? "stranger" : uid)).status).toBe(401);
    }
    auth.currentUser = { uid: "stranger" };
    await expect(resetServerData("RESET SERVER")).rejects.toThrow("Admin access");
    expect((await get(ref(db, "users/account/saveRevision"))).val()).toBe(7);
  });

  test("a conflicting revision rejects the whole reset without deleting shared data", async () => {
    expect((await request("PATCH", {
      [`users/account/characters/${first}/player`]: {
        name: "Nova", publicProfile: true, level: 1, astra: 0, resetPending: true,
      },
      "users/account/saveRevision": 7,
      marketplace: null,
      broadcasts: null,
    }, "admin")).status).toBe(401);
    const data = (await get(ref(db))).val();
    expect(data.users.account.characters[first].player.level).toBe(99);
    expect(data.marketplace).toEqual(original.marketplace);
    expect(data.broadcasts).toEqual(original.broadcasts);
    for (const path of ["users/account", "characterOwners", "admins", "characterSlots", "characterNames"])
      expect((await request("PATCH", { [path]: null }, "admin")).status).toBe(401);
  });
});
