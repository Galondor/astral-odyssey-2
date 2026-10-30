import { get, onDisconnect, onValue, ref, set, update } from "firebase/database";
import { commitPlayerChange, getCharacterIdentity, getPlayer, setPlayer } from "../../character/player";
import { getContestStatus, reduceContest, sendContestCommand, startContest } from "../../world/contest";

jest.mock("firebase/database", () => ({
  get: jest.fn(), onDisconnect: jest.fn(), onValue: jest.fn(),
  ref: jest.fn(), set: jest.fn(), update: jest.fn(),
}));
jest.mock("../../firebase", () => ({ db: {}, auth: { currentUser: { uid: "alice" } } }));
jest.mock("../../character/player", () => ({
  commitPlayerChange: jest.fn(), flushPlayer: jest.fn(),
  getCharacterIdentity: jest.fn(), getPlayer: jest.fn(), setPlayer: jest.fn(),
}));
jest.mock("../../world/dungeons", () => ({ isInDungeon: () => false }));
jest.mock("../../world/labyrinth", () => ({ isLabyrinthActive: () => false }));

const player = (name, speed) => ({
  name, level: 10, skills: {}, equipment: {}, consumables: { healthPotion: 2 },
  stats: { health: 20, maxHealth: 100, maxPower: 10, maxStamina: 10,
    speed, attackMin: 5, attackMax: 5, defense: 0 },
});
let state;
let current;
let subscriptions;
let stop;
const settle = async () => {
  for (let count = 0; count < 20; count += 1) await Promise.resolve();
};
const applyPatch = (before, patch) => {
  const next = JSON.parse(JSON.stringify(before));
  for (const [key, value] of Object.entries(patch)) {
    const [section, id] = key.split("/");
    if (id) next[section][id] = value;
    else next[section] = value;
  }
  return next;
};

beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  subscriptions = {};
  current = player("alice", 20);
  const livePlayers = { alice: true, bob: true };
  state = reduceContest(null, "alice", "alice", { type: "queue", player: current, livePlayers }, Date.now());
  state = reduceContest(state, "bob", "bob", { type: "queue", player: player("bob", 10), livePlayers }, Date.now());
  getCharacterIdentity.mockReturnValue("alice");
  getPlayer.mockImplementation(() => current);
  setPlayer.mockImplementation((patch) => { current = { ...current, ...patch }; });
  commitPlayerChange.mockImplementation(async (change) => change());
  ref.mockImplementation((db, path) => path);
  get.mockImplementation(async () => ({ val: () => state }));
  set.mockResolvedValue(undefined);
  onDisconnect.mockReturnValue({ set: jest.fn().mockResolvedValue(), cancel: jest.fn().mockResolvedValue() });
  onValue.mockImplementation((path, listener) => {
    subscriptions[path] = listener;
    if (path === ".info/connected") listener({ val: () => true });
    else if (path === ".info/serverTimeOffset") listener({ val: () => 0 });
    else if (path === "contest") listener({ val: () => state });
    return () => { delete subscriptions[path]; };
  });
  update.mockImplementation(async (path, patch) => {
    state = applyPatch(state, patch);
    subscriptions.contest({ val: () => state });
  });
  stop = startContest();
  await settle();
});
afterEach(async () => {
  stop();
  await settle();
  jest.useRealTimers();
});

test("reconnect reconciles pending wins exactly once without changing adventure health", async () => {
  state.entries.alice.kills = 2;
  state.entries.alice.deaths = 1;
  subscriptions.contest({ val: () => state });
  await settle();
  expect(current.records).toEqual({ playerKills: 2, playerDeaths: 1 });
  expect(current.materials.proof_of_victory).toBe(2);
  expect(current.stats.health).toBe(20);
  subscriptions.contest({ val: () => state });
  await settle();
  expect(current.materials.proof_of_victory).toBe(2);
});

test("optimistic local victory events cannot grant rewards before server confirmation", async () => {
  let confirm;
  update.mockImplementation(async (path, patch) => {
    const optimistic = applyPatch(state, patch);
    subscriptions.contest({ val: () => optimistic });
    await new Promise((resolve) => { confirm = resolve; });
    state = optimistic;
  });
  const command = sendContestCommand({ type: "forfeit" });
  await settle();
  expect(confirm).toBeDefined();
  expect(current.records).toBeUndefined();
  confirm();
  await command;
  await settle();
  expect(current.records.playerDeaths).toBe(1);
  expect(current.stats.health).toBe(20);
});

test("a rejected optimistic result is rolled back without recording a death", async () => {
  update.mockImplementation(async (path, patch) => {
    const provisional = { ...state, entries: { ...state.entries, alice: patch["entries/alice"] } };
    subscriptions.contest({ val: () => provisional });
    subscriptions.contest({ val: () => state });
    throw new Error("Connection failed");
  });
  await expect(sendContestCommand({ type: "forfeit" })).rejects.toThrow("Connection failed");
  await settle();
  expect(current.records).toBeUndefined();
  expect(getContestStatus().playing).toBe(true);
});

test("the session automatically forfeits an expired turn after exactly 60 seconds", async () => {
  jest.advanceTimersByTime(59000);
  await settle();
  expect(update).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1000);
  await settle();
  expect(update).toHaveBeenCalledTimes(1);
  expect(current.records.playerDeaths).toBe(1);
  expect(getContestStatus().match.winner).toBe("bob");
});

test("a stale lobby revision is retried without awarding duplicate results", async () => {
  update.mockRejectedValueOnce(Object.assign(new Error("Stale revision"), { code: "PERMISSION_DENIED" }));
  await sendContestCommand({ type: "forfeit" });
  await settle();
  expect(update).toHaveBeenCalledTimes(2);
  expect(current.records.playerDeaths).toBe(1);
});

test("unrelated lobby activity does not lock an idle character's gameplay", async () => {
  state.entries.alice.status = "idle";
  subscriptions.contest({ val: () => state });
  expect(getContestStatus().locked).toBe(false);
  expect(getContestStatus().saving).toBe(false);
});
