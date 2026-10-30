import { get, update } from "firebase/database";
import { auth } from "../../firebase";
import { GAME_DATA_PATHS, resetPlayerData, resetServerData } from "../../world/adminData";
import rules from "../../../database.rules.json";
import { scenes } from "../../world/gameLogic";
import { getPlayer } from "../../character/player";

jest.mock("../../firebase", () => ({ db: {}, auth: { currentUser: { uid: "admin" } } }));
jest.mock("../../character/player", () => ({ getPlayer: jest.fn() }));
jest.mock("firebase/database", () => ({
  ref: (_, path) => path || "/",
  get: jest.fn(),
  update: jest.fn(),
}));

const first = "1".repeat(40);
const second = "2".repeat(40);
let data;
beforeEach(() => {
  jest.clearAllMocks();
  auth.currentUser = { uid: "admin" };
  data = {
    admins: { admin: true },
    users: {
      account: {
        saveRevision: 7, legacyCharacterId: first, legacyBackup: { astra: 500 },
        accountWideTitles: { monarchOfTheOdyssey: true },
        characters: {
          [first]: { externalId: "account", slot: 0, createdAt: 1, player: {
            name: "Nova", level: 99, astra: 10000, bank: { balance: 2000 }, inventory: [{ name: "Sword" }],
            titles: ["monarchOfTheOdyssey"], stats: { health: 200 }, records: { wins: 100 },
          } },
          [second]: { externalId: second, slot: 1, createdAt: 2, player: { name: "Luna", level: 40 } },
          unfinished: { externalId: "unfinished", slot: 2, createdAt: 3 },
          deleted: { externalId: "deleted", deletedAt: 4 },
        },
      },
      legacy: { saveRevision: 3, player: { name: "Legacy", level: 50, publicProfile: false } },
    },
    characterOwners: { account: { accountId: "account", characterId: first } },
    characterNames: { Nova: "account", Luna: second, Legacy: "legacy" },
    broadcasts: { gift: { attachments: { astra: 500 } } },
    marketplace: { mine: { sellerUid: "account" }, other: { sellerUid: second } },
    groupParties: { party: { leader: second, members: { account: {}, [second]: {} }, run: { rewards: 50 } } },
    groupMembership: { account: "party", [second]: "party" },
    groupInvites: { another: { party: {} } },
    friends: { account: { [second]: {} }, [second]: { account: {} } },
    friendRequests: { [second]: { account: {} } },
    contest: { matches: { match: { host: "account", guest: second } },
      entries: { account: { matchId: "match" }, [second]: { matchId: "match" } } },
    worldBoss: { cycles: { cycle: { totalDamage: 100, players: { account: { damage: 100 } } } } },
    bugReports: { mine: { uid: "account" }, other: { uid: second } },
  };
  get.mockImplementation(async (path) => ({ val: () => path === "admins/admin" ? true : data }));
  update.mockResolvedValue();
});

test("single-character reset removes rewards and linked sessions without resetting other characters", async () => {
  await resetPlayerData("account", "Nova");
  const writes = update.mock.calls[0][1];
  expect(writes[`users/account/characters/${first}/player`]).toEqual({
    name: "Nova", level: 1, astra: 0, resetPending: true, publicProfile: true,
    ignoredAccountWideTitles: ["monarchOfTheOdyssey"],
  });
  expect(writes["users/account/saveRevision"]).toBe(8);
  expect(writes["users/account/legacyBackup"]).toBeNull();
  expect(writes["users/account/accountWideTitles"]).toBeUndefined();
  expect(writes[`users/account/characters/${second}/player`]).toBeUndefined();
  for (const path of ["inbox/account", "marketplace/mine", "leaderboardEntries/account",
    "groupParties/party", `groupMembership/${second}`, "groupInvites/another/party",
    `friends/${second}/account`, `friendRequests/${second}/account`,
    "contest/matches/match", `contest/entries/${second}`,
    "worldBoss/cycles/cycle/players/account", "bugReports/mine"])
    expect(writes[path]).toBeNull();
  expect(writes["inboxState/account"]).toEqual({ gift: { read: true, claimed: true, deleted: true } });
  expect(writes["marketplace/other"]).toBeUndefined();
  expect(writes["bugReports/other"]).toBeUndefined();
  expect(writes["directory/account"]).toMatchObject({ name: "Nova", level: 1, gearScore: 0 });
  expect(update).toHaveBeenCalledTimes(1);
});

test("server reset atomically wipes shared data and progression while retaining identity and configuration", async () => {
  expect(await resetServerData("RESET SERVER")).toBe(3);
  const writes = update.mock.calls[0][1];
  for (const path of GAME_DATA_PATHS.filter((path) => !["directory", "publicProfiles"].includes(path)))
    expect(writes[path]).toBeNull();
  expect(writes["users/account/accountWideTitles"]).toBeNull();
  expect(writes["users/account/saveRevision"]).toBe(8);
  expect(writes["users/legacy/saveRevision"]).toBe(4);
  expect(writes["users/legacy/player"]).toMatchObject({ name: "Legacy", level: 1, astra: 0, resetPending: true });
  expect(writes.directory).toMatchObject({ account: { name: "Nova", level: 1 }, [second]: { name: "Luna", level: 1 } });
  expect(writes.publicProfiles.legacy).toBeUndefined();
  expect(writes[`users/account/characters/${first}/player`].ignoredAccountWideTitles).toBeUndefined();
  expect(Object.keys(writes).some((path) => /characterOwners|characterNames|characterSlots|characterLimits|admins|deleted|unfinished/.test(path))).toBe(false);
  expect(update).toHaveBeenCalledTimes(1);
});

test("all database gameplay roots are covered without wiping account configuration", () => {
  const preserved = ["users", "characterOwners", "characterNames", "characterSlots", "characterLimits", "admins"];
  expect(Object.keys(rules.rules).filter((key) => !key.startsWith(".") && !preserved.includes(key)).sort())
    .toEqual([...GAME_DATA_PATHS].sort());
});

test.each(["", "reset server", "RESET SERVER "])("server reset rejects incorrect confirmation %p", async (confirmation) => {
  await expect(resetServerData(confirmation)).rejects.toThrow("exactly");
  expect(update).not.toHaveBeenCalled();
});

test("player reset validates confirmation, identity, and existence", async () => {
  await expect(resetPlayerData("account", "nova")).rejects.toThrow("exact name");
  await expect(resetPlayerData("users/account", "Nova")).rejects.toThrow("Select");
  await expect(resetPlayerData("missing", "Nova")).rejects.toThrow("no longer exists");
  expect(update).not.toHaveBeenCalled();
});

test.each([null, { uid: "not-admin" }])("unauthenticated and non-admin callers cannot reset data", async (user) => {
  auth.currentUser = user;
  get.mockResolvedValue({ val: () => false });
  await expect(resetServerData("RESET SERVER")).rejects.toThrow("Admin access");
  await expect(resetPlayerData("account", "Nova")).rejects.toThrow("Admin access");
  expect(update).not.toHaveBeenCalled();
});

test("invalid revisions and failed writes surface errors without claiming success", async () => {
  data.users.account.saveRevision = -1;
  await expect(resetServerData("RESET SERVER")).rejects.toThrow("revision");
  expect(update).not.toHaveBeenCalled();
  data.users.account.saveRevision = 7;
  update.mockRejectedValue(new Error("Permission denied"));
  await expect(resetPlayerData("account", "Nova")).rejects.toThrow("Permission denied");
});

test("reset characters choose fresh stats without receiving starter items", () => {
  getPlayer.mockReturnValue({ name: "Nova", resetPending: true });
  const setPlayer = jest.fn();
  const stats = { strength: 4, dexterity: 1, intelligence: 1 };
  expect(scenes.createCharacter.form.onSubmit(stats, { setPlayer })).toEqual({ next: "menu" });
  expect(setPlayer).toHaveBeenCalledWith(expect.objectContaining({
    level: 1, astra: 0, baseStats: stats, inventory: [], equipment: {}, resetPending: false,
    stats: expect.objectContaining({ exp: 0 }),
  }));
  getPlayer.mockReturnValue({ name: "New" });
  scenes.createCharacter.form.onSubmit(stats, { setPlayer });
  expect(setPlayer.mock.calls[1][0].inventory.length).toBeGreaterThan(0);
});
