import { get, runTransaction, set } from "firebase/database";
import { getCharacterIdentity, getPlayer } from "../../character/player";
import {
  deliverWorldBossResetNotice,
  deliverWorldBossRewards,
  finishWorldBossAttempt,
  getWorldBossCycleId,
  getWorldBossUniqueDropChance,
  startWorldBossAttempt,
  summarizeWorldBoss,
  WORLD_BOSS_DAILY_ATTEMPTS,
  WORLD_BOSS_HEALTH,
  WORLD_BOSS_MAX_ROUNDS,
} from "../../world/worldBoss";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../character/player", () => ({
  getCharacterIdentity: jest.fn(() => "alice"),
  getPlayer: jest.fn(),
}));
jest.mock("../../world/inbox", () => ({ isAdmin: jest.fn(() => false) }));
jest.mock("firebase/database", () => ({
  get: jest.fn(),
  onValue: jest.fn(),
  ref: (_, path) => path,
  runTransaction: jest.fn(),
  set: jest.fn(),
}));

const state = new Map();
const readPath = (path) => {
  if (path === "worldBoss/forcedSpawnAt") return null;
  if (path === "worldBoss/cycles") return null;
  if (path.endsWith("/players")) {
    const prefix = `${path}/`;
    return Object.fromEntries([...state.entries()]
      .filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"))
      .map(([key, value]) => [key.slice(prefix.length), value]));
  }
  return state.get(path) ?? null;
};

beforeEach(() => {
  state.clear();
  jest.clearAllMocks();
  getCharacterIdentity.mockReturnValue("alice");
  get.mockImplementation(async (path) => ({ val: () => readPath(path) }));
  runTransaction.mockImplementation(async (path, update) => {
    const current = state.get(path) ?? null;
    const next = update(current);
    if (next === undefined) return { committed: false, snapshot: { val: () => current } };
    state.set(path, next);
    return { committed: true, snapshot: { val: () => next } };
  });
  set.mockImplementation(async (path, value) => state.set(path, value));
  getPlayer.mockReturnValue({
    name: "Alice",
    level: 35,
    stats: { maxHealth: 100, maxPower: 50 },
    titles: [],
  });
});

test("the cycle rolls over every 72 hours and an admin override anchors the schedule", () => {
  const interval = 72 * 60 * 60 * 1000;
  expect(getWorldBossCycleId(interval * 2 + 1)).toBe(String(interval * 2));
  expect(getWorldBossCycleId(interval * 2 + 1, 500)).toBe(String(500 + interval));
});

test("shared health is derived from all players' damage and ranked by contribution", () => {
  const summary = summarizeWorldBoss({
    a: { name: "Alice", damage: 720_000 },
    b: { name: "Bryn", damage: 280_000 },
  });
  expect(summary.health).toBe(0);
  expect(summary.defeated).toBe(true);
  expect(summary.fighters.map(({ name }) => name)).toEqual(["Alice", "Bryn"]);
});

test("admin damage still affects shared health without occupying a rank", () => {
  const summary = summarizeWorldBoss({
    admin: { name: "Admin", damage: 720_000 },
    alice: { name: "Alice", damage: 280_000 },
  }, ["admin"]);
  expect(summary.health).toBe(0);
  expect(summary.fighters.map(({ name }) => name)).toEqual(["Alice"]);
});

test("admin-owned characters are excluded from World Boss placement rewards", async () => {
  state.set("admins", { admin: true });
  state.set("characterOwners/admin-character/accountId", "admin");
  const participants = {
    "admin-character": { name: "Admin", damage: 600_000 },
    alice: { name: "Alice", damage: 400_000 },
  };

  await deliverWorldBossRewards("no-admin-ranks", participants);
  expect(state.get("worldBossMail/alice/no-admin-ranks").attachments.astra).toBe(850_000);

  getCharacterIdentity.mockReturnValue("admin-character");
  await deliverWorldBossRewards("no-admin-reward", participants);
  expect(state.has("worldBossMail/admin-character/no-admin-reward")).toBe(false);
});

test("the unique drop chance scales to 15% for first place and bottoms at 1%", () => {
  expect(getWorldBossUniqueDropChance(1)).toBe(15);
  expect(getWorldBossUniqueDropChance(2)).toBeCloseTo(13.6);
  expect(getWorldBossUniqueDropChance(10)).toBeCloseTo(2.4);
  expect(getWorldBossUniqueDropChance(11)).toBe(1);
});

test("a contributor receives a defeat notice when the boss resets before being killed", async () => {
  state.set("worldBoss/cycles/cycle-reset/players/alice", { name: "Alice", damage: 12_345 });
  state.set("worldBoss/cycles/cycle-reset/totalDamage", 12_345);

  await deliverWorldBossResetNotice("cycle-reset");

  expect(state.get("worldBossMail/alice/cycle-reset")).toMatchObject({
    subject: "The Astral Colossus has withdrawn",
    body: expect.stringContaining("12,345 damage"),
    from: "World Boss",
    cycle: "cycle-reset",
  });
});

test("no defeat notice is sent when the boss was killed or the player did no damage", async () => {
  state.set("worldBoss/cycles/cycle-killed/players/alice", { name: "Alice", damage: WORLD_BOSS_HEALTH });
  state.set("worldBoss/cycles/cycle-killed/totalDamage", WORLD_BOSS_HEALTH);
  state.set("worldBoss/cycles/cycle-empty/players/alice", { name: "Alice", damage: 0 });

  await deliverWorldBossResetNotice("cycle-killed");
  await deliverWorldBossResetNotice("cycle-empty");

  expect(state.has("worldBossMail/alice/cycle-killed")).toBe(false);
  expect(state.has("worldBossMail/alice/cycle-empty")).toBe(false);
});

test("the Giant Slayer title is mailed only for a character's first first-place finish", async () => {
  jest.spyOn(Math, "random").mockReturnValue(0);
  const participants = {
    alice: { name: "Alice", damage: 600_000 },
    bob: { name: "Bryn", damage: 400_000 },
  };
  await deliverWorldBossRewards("cycle-one", participants);
  const firstMail = state.get("worldBossMail/alice/cycle-one");
  expect(firstMail.attachments.titles).toEqual(["giantSlayer"]);
  expect(firstMail.attachments.astra).toBe(850_000);
  expect(firstMail.attachments.consumables.runeOfUnpredictability).toBe(1);
  expect(firstMail.attachments.gear).toEqual([{ slot: "weapon", minRarity: 3, minTier: 5, count: 3 }]);
  expect(state.get("worldBoss/titleAwards/alice")).toBe(true);

  await deliverWorldBossRewards("cycle-two", participants);
  const secondMail = state.get("worldBossMail/alice/cycle-two");
  expect(secondMail.attachments.titles).toBeUndefined();
  Math.random.mockRestore();
});

test("only 1% damage contributors can roll the 1% world boss rune drop", async () => {
  getCharacterIdentity.mockReturnValue("player-11");
  const participants = Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => [`player-${index + 1}`, { name: `Player ${index + 1}`, damage: 95_000 }])
      .concat([["player-11", { name: "Player 11", damage: 50_000 }]]),
  );
  jest.spyOn(Math, "random")
    .mockReturnValueOnce(0.5)
    .mockReturnValueOnce(0.009)
    .mockReturnValueOnce(0.99);

  await deliverWorldBossRewards("cycle-rune-drop", participants);

  expect(state.get("worldBossMail/player-11/cycle-rune-drop").attachments.consumables)
    .toEqual({ runeOfUnpredictability: 1 });

  jest.spyOn(Math, "random")
    .mockReturnValueOnce(0.5)
    .mockReturnValueOnce(0.01)
    .mockReturnValueOnce(0.99);
  await deliverWorldBossRewards("cycle-rune-miss", participants);
  expect(state.get("worldBossMail/player-11/cycle-rune-miss").attachments.consumables).toBeUndefined();
  Math.random.mockRestore();
});

test("1% contributors outside the top ten receive 50,000 Astra and 3-8 Epic T3+ gear", async () => {
  jest.spyOn(Math, "random").mockReturnValue(0);
  getCharacterIdentity.mockReturnValue("player-11");
  const participants = Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => [`player-${index + 1}`, { name: `Player ${index + 1}`, damage: 95_000 }])
      .concat([["player-11", { name: "Player 11", damage: 50_000 }]]),
  );

  await deliverWorldBossRewards("cycle-eleven", participants);
  const mail = state.get("worldBossMail/player-11/cycle-eleven");
  expect(mail.attachments.astra).toBe(50_000);
  expect(mail.attachments.gear).toEqual([{ slot: "weapon", minRarity: 3, minTier: 3, count: 3 }]);
  Math.random.mockRestore();
});

test("three attempts per day consume the allowance and save each contribution", async () => {
  const attempt = await startWorldBossAttempt();
  if (!attempt.ok) throw new Error(attempt.message);
  expect(attempt).toMatchObject({ ok: true });
  expect(attempt.enemy.maxHp).toBe(WORLD_BOSS_HEALTH);
  expect(attempt.enemy.maxRounds).toBe(WORLD_BOSS_MAX_ROUNDS);
  expect(attempt.remainingAttempts).toBe(WORLD_BOSS_DAILY_ATTEMPTS - 1);

  attempt.enemy.worldBossDamageDealt = 12_345;
  await finishWorldBossAttempt(attempt.enemy);
  for (let index = 0; index < WORLD_BOSS_DAILY_ATTEMPTS - 1; index++) {
    const additionalAttempt = await startWorldBossAttempt();
    expect(additionalAttempt.ok).toBe(true);
    additionalAttempt.enemy.worldBossDamageDealt = 100;
    await finishWorldBossAttempt(additionalAttempt.enemy);
  }
  const exhausted = await startWorldBossAttempt();
  expect(exhausted).toMatchObject({ ok: false, message: expect.stringContaining("3 attempts") });
  const participant = state.get(`worldBoss/cycles/${attempt.cycle}/players/alice`);
  expect(participant).toMatchObject({
    name: "Alice",
    damage: 12_545,
    attemptsUsed: WORLD_BOSS_DAILY_ATTEMPTS,
    attemptsTotal: WORLD_BOSS_DAILY_ATTEMPTS,
    activeUntil: 0,
  });
  expect(state.get(`worldBoss/cycles/${attempt.cycle}/totalDamage`)).toBe(12_545);
  expect(set).not.toHaveBeenCalled();
});
