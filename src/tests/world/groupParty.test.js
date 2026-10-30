import { calculateStats } from "../../character/stats";
import { getClassForStats } from "../../character/classes";
import { commitPlayerChange, getCharacterIdentity, getPlayer, setPlayer } from "../../character/player";
import { GROUP_ROUND_MS } from "../../combat/groupCombat";
import {
  GROUP_CHAT_LIMIT, GROUP_LEADER_GRACE_MS, acceptInvite, createParty, getGroupStatus, invitePlayer, inviteToParty, kickMember,
  leaveParty, sendChat, setPartyOpen, setReady, startGroupSession, startRun, submitIntent,
} from "../../world/groupParty";
import { isInGroupDungeon } from "../../world/groupState";

let mockStore = {};
const mockListeners = [];
let mockPushCount = 0;
let mockEnemy = null;

jest.mock("firebase/database", () => {
  const split = (path) => (path ? path.split("/").filter(Boolean) : []);
  const read = (path) => split(path).reduce((node, key) => (node == null ? undefined : node[key]), mockStore) ?? null;
  const prune = (node) => {
    if (node === null || typeof node !== "object" || Array.isArray(node)) return node;
    for (const key of Object.keys(node)) {
      node[key] = prune(node[key]);
      if (node[key] === null || node[key] === undefined
        || (typeof node[key] === "object" && !Array.isArray(node[key]) && !Object.keys(node[key]).length)) delete node[key];
    }
    return node;
  };
  const write = (path, value) => {
    const keys = split(path);
    const copy = value === undefined || value === null ? null : JSON.parse(JSON.stringify(value));
    if (!keys.length) {
      mockStore = copy || {};
      return;
    }
    let node = mockStore;
    for (const key of keys.slice(0, -1)) {
      if (!node[key] || typeof node[key] !== "object") node[key] = {};
      node = node[key];
    }
    node[keys[keys.length - 1]] = copy;
    prune(mockStore);
  };
  const notify = (paths) => {
    for (const listener of [...mockListeners]) {
      if (!mockListeners.includes(listener) || listener.path.startsWith(".info")) continue;
      if (paths.some((p) => listener.path === p || listener.path.startsWith(`${p}/`) || p.startsWith(`${listener.path}/`) || !p))
        listener.cb({ val: () => JSON.parse(JSON.stringify(read(listener.path))) });
    }
  };
  const ref = (db, path = "") => ({ path, key: split(path).pop() || null });
  return {
    ref,
    get: async (r) => ({ val: () => JSON.parse(JSON.stringify(read(r.path))) }),
    set: async (r, value) => {
      write(r.path, value);
      notify([r.path]);
    },
    update: async (r, patch) => {
      const paths = Object.keys(patch).map((key) => (r.path ? `${r.path}/${key}` : key));
      Object.keys(patch).forEach((key, i) => write(paths[i], patch[key]));
      notify(paths);
    },
    push: (r) => {
      mockPushCount += 1;
      const key = `k${String(mockPushCount).padStart(4, "0")}`;
      return ref(null, `${r.path}/${key}`);
    },
    onDisconnect: () => ({ set: async () => {}, cancel: async () => {} }),
    onValue: (r, cb) => {
      const listener = { path: r.path, cb };
      mockListeners.push(listener);
      if (r.path === ".info/connected") cb({ val: () => true });
      else if (r.path === ".info/serverTimeOffset") cb({ val: () => 0 });
      else cb({ val: () => JSON.parse(JSON.stringify(read(r.path))) });
      return () => {
        const index = mockListeners.indexOf(listener);
        if (index >= 0) mockListeners.splice(index, 1);
      };
    },
  };
});
jest.mock("../../firebase", () => ({ db: {}, auth: { currentUser: { uid: "alice" } } }));
jest.mock("../../character/player", () => ({
  commitPlayerChange: jest.fn(), flushPlayer: async () => {},
  getCharacterIdentity: jest.fn(), getPlayer: jest.fn(), setPlayer: jest.fn(),
}));
jest.mock("../../combat/combat", () => ({ getEnemy: () => mockEnemy }));
jest.mock("../../world/colosseum", () => ({ getColosseumRun: () => null }));
jest.mock("../../world/contest", () => ({ getContestStatus: () => ({ locked: false }) }));
jest.mock("../../world/dungeons", () => ({ isInDungeon: () => false }));
jest.mock("../../world/labyrinth", () => ({ isLabyrinthActive: () => false }));

const makePlayer = (name, level) => {
  const points = 15 + 3 * (level - 1);
  const player = {
    name, level,
    baseStats: { strength: 1 + Math.round(points * 0.7), dexterity: 1 + Math.round(points * 0.3), intelligence: 1 },
    bonusStats: { maxHealth: 10 * (level - 1), maxStamina: level - 1 },
    equipment: {}, skills: {}, equippedSkills: [],
    consumables: { healthPotion: 3 },
    astra: 0,
  };
  player.stats = calculateStats(player);
  player.class = getClassForStats(player.stats);
  return player;
};

let me;
let players;
let stop;
const settle = async () => {
  for (let count = 0; count < 30; count += 1) await Promise.resolve();
};
const tick = async (ms = 1000) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 1000) {
    jest.advanceTimersByTime(Math.min(1000, ms - elapsed));
    await settle();
  }
};
const as = async (id) => {
  stop?.();
  await settle();
  me = id;
  stop = startGroupSession();
  await settle();
};
const party = () => mockStore.groupParties?.[getGroupStatus().partyId];
// Another client's direct writes (bypassing this module), as if they came from the server.
const remoteWrite = async (path, value) => {
  const { set, ref } = jest.requireMock("firebase/database");
  await set(ref(null, path), value);
  await settle();
};

beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockStore = {
    characterNames: { Alice: "alice", Bob: "bob" },
    groupPresence: { bob: true },
  };
  mockListeners.length = 0;
  mockPushCount = 0;
  mockEnemy = null;
  players = { alice: makePlayer("Alice", 45), bob: makePlayer("Bob", 45) };
  getCharacterIdentity.mockImplementation(() => me);
  getPlayer.mockImplementation(() => players[me]);
  setPlayer.mockImplementation((patch) => { players[me] = { ...players[me], ...patch }; });
  commitPlayerChange.mockImplementation(async (change) => change());
  await as("alice");
});
afterEach(async () => {
  stop?.();
  stop = null;
  await settle();
  jest.useRealTimers();
});

const formParty = async () => {
  expect(await createParty("tidewrack")).toBe(true);
  expect(await invitePlayer("bob")).toBe(true);
  const partyId = getGroupStatus().partyId;
  await as("bob");
  expect(await acceptInvite(partyId)).toBe(true);
  return partyId;
};

const startTwoPlayerRun = async () => {
  const partyId = await formParty();
  expect(await setReady(true)).toBe(true);
  await as("alice");
  expect(await setReady(true)).toBe(true);
  expect(getGroupStatus().startBlocker).toBeNull();
  expect(await startRun()).toBe(true);
  return partyId;
};

test("a leader creates a party, invites by name, and the invitee joins", async () => {
  const partyId = await formParty();
  expect(mockStore.groupMembership).toEqual({ alice: partyId, bob: partyId });
  expect(mockStore.groupInvites).toBeUndefined();
  const status = getGroupStatus();
  expect(status.members.map((m) => m.name)).toEqual(["Alice", "Bob"]);
  expect(status.isLeader).toBe(false);
  expect(await createParty("tidewrack")).toBe(false);
  expect(getGroupStatus().error).toMatch(/already in a party/);
});

test("inviting a friend from Social forms a party for the hardest unlocked dungeon when needed", async () => {
  players.alice = makePlayer("Alice", 65);
  expect(await inviteToParty("Bob")).toBe(true);
  const partyId = getGroupStatus().partyId;
  expect(party()).toMatchObject({ leader: "alice", dungeon: "chronoforge" });
  expect(mockStore.groupInvites.bob[partyId]).toMatchObject({ from: "Alice", dungeon: "chronoforge" });
  expect(await inviteToParty("Alice")).toBe(false);
  expect(getGroupStatus().error).toMatch(/invite yourself/);

  await as("bob");
  expect(await acceptInvite(partyId)).toBe(true);
  expect(await inviteToParty("Alice")).toBe(false);
  expect(getGroupStatus().error).toMatch(/Only the party leader/);
});

test("players below the first group dungeon can't form a party by inviting", async () => {
  players.alice = makePlayer("Alice", 20);
  expect(await inviteToParty("Bob")).toBe(false);
  expect(getGroupStatus().error).toMatch(/unlock at level 40/);
  expect(mockStore.groupParties).toBeUndefined();
});

test("open parties are listed for looking-for-group and removed while running", async () => {
  players.alice = makePlayer("Alice", 65);
  await createParty("chronoforge");
  const partyId = getGroupStatus().partyId;
  expect(await setPartyOpen(true)).toBe(true);
  expect(mockStore.groupLfg[partyId]).toMatchObject({ dungeon: "chronoforge", leaderName: "Alice", size: 1 });
  expect(await setReady(true)).toBe(true);
  expect(await startRun()).toBe(true);
  expect(mockStore.groupLfg).toBeUndefined();
});

test("readying requires the dungeon level and a free character", async () => {
  players.alice = makePlayer("Alice", 30);
  await createParty("tidewrack");
  expect(await setReady(true)).toBe(false);
  expect(getGroupStatus().error).toMatch(/Reach level 40/);
  players.alice = makePlayer("Alice", 45);
  mockEnemy = { name: "Slime" };
  expect(await setReady(true)).toBe(false);
  expect(getGroupStatus().error).toMatch(/battle/);
  mockEnemy = null;
  expect(await setReady(true)).toBe(true);
  expect(party().members.alice.snapshot.stats.maxHealth).toBe(players.alice.stats.maxHealth);
});

test("the leader starts the run once everyone is ready and resolves when all intents are in", async () => {
  await startTwoPlayerRun();
  let run = party().run;
  expect(run).toMatchObject({ revision: 1, status: "active", stage: 0, members: ["alice", "bob"] });
  expect(isInGroupDungeon()).toBe(true);
  expect(await submitIntent({ type: "defend" })).toBe(true);
  await tick();
  expect(party().run.revision).toBe(1);
  await remoteWrite(`groupParties/${getGroupStatus().partyId}/intents/bob`, { run: run.id, round: 1, stage: 0, type: "defend" });
  await tick();
  run = party().run;
  expect(run.revision).toBe(2);
  expect(run.round).toBe(2);
  expect(party().intents).toBeUndefined();
});

test("members' ready snapshots are consumed by the run", async () => {
  await startTwoPlayerRun();
  expect(party().members.alice.ready).toBe(false);
  expect(party().members.alice.snapshot).toBeUndefined();
});

test("a round resolves on its deadline even if someone never acts", async () => {
  await startTwoPlayerRun();
  await tick(GROUP_ROUND_MS - 2000);
  expect(party().run.revision).toBe(1);
  await tick(3000);
  expect(party().run.revision).toBe(2);
});

test("a timed-out run fails, removes the party from the instance, and settles rewards once", async () => {
  await startTwoPlayerRun();
  const partyId = getGroupStatus().partyId;
  await remoteWrite(`groupParties/${partyId}/run/deadline`, Date.now() - 1);
  await tick();
  const run = party().run;
  expect(run).toMatchObject({ status: "failed", reason: "timeout", revision: 2 });
  expect(isInGroupDungeon()).toBe(false);
  expect(players.alice.groupDungeonClaims[run.id]).toBeDefined();
  expect(party().members.alice.claimed).toBe(run.id);
  expect(getGroupStatus().startBlocker).toMatch(/collect/);
  const astra = players.alice.astra;
  await remoteWrite(`groupParties/${partyId}/members/alice/claimed`, null);
  await tick();
  expect(players.alice.astra).toBe(astra);
  expect(party().members.alice.claimed).toBe(run.id);
});

test("a member who quits mid-run settles their consumables and is marked as left", async () => {
  await startTwoPlayerRun();
  const partyId = getGroupStatus().partyId;
  const runId = party().run.id;
  await remoteWrite(`groupParties/${partyId}/run/party/bob/spent`, { healthPotion: 2 });
  await as("bob");
  expect(isInGroupDungeon()).toBe(true);
  expect(await leaveParty()).toBe(true);
  expect(players.bob.consumables.healthPotion).toBe(1);
  expect(players.bob.groupDungeonClaims[runId]).toBeDefined();
  expect(players.bob.astra).toBe(0);
  expect(isInGroupDungeon()).toBe(false);
  expect(mockStore.groupMembership.bob).toBeUndefined();
  await as("alice");
  await tick();
  expect(party().run.left).toEqual({ bob: true });
  expect(party().run.status).toBe("active");
});

test("an offline leader is replaced by the next online member", async () => {
  await startTwoPlayerRun();
  const partyId = getGroupStatus().partyId;
  await as("bob");
  await remoteWrite("groupPresence/alice", false);
  await tick(GROUP_LEADER_GRACE_MS - 1000);
  expect(party().leader).toBe("alice");
  await tick(2000);
  expect(party().leader).toBe("bob");
  expect(getGroupStatus().isLeader).toBe(true);
  await tick(GROUP_ROUND_MS);
  expect(mockStore.groupParties[partyId].run.actor).toBe("bob");
});

test("a kicked member drops the party and the leader marks them as left", async () => {
  await startTwoPlayerRun();
  expect(await kickMember("bob")).toBe(true);
  expect(mockStore.groupMembership.bob).toBeUndefined();
  await tick();
  expect(party().run.left).toEqual({ bob: true });
});

test("chat is kept to the most recent messages", async () => {
  await createParty("starless");
  for (let i = 0; i < GROUP_CHAT_LIMIT + 4; i += 1) {
    jest.advanceTimersByTime(1);
    expect(await sendChat(`hello ${i}`)).toBe(true);
  }
  await tick();
  const chat = getGroupStatus().chat;
  expect(chat).toHaveLength(GROUP_CHAT_LIMIT);
  expect(chat[chat.length - 1].text).toBe(`hello ${GROUP_CHAT_LIMIT + 3}`);
  expect(chat[0].text).toBe("hello 4");
});

test("the last leader leaving disbands the party", async () => {
  await createParty("tidewrack");
  await setPartyOpen(true);
  expect(await leaveParty()).toBe(true);
  expect(mockStore.groupParties).toBeUndefined();
  expect(mockStore.groupLfg).toBeUndefined();
  expect(mockStore.groupMembership).toBeUndefined();
  expect(getGroupStatus().partyId).toBeNull();
});
