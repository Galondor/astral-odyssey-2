import { getCharacterIdentity, getPlayer } from "../../character/player";
import { getGroupStatus, lookupIdentity } from "../../world/groupParty";
import {
  acceptFriendRequest, declineFriendRequest, getSocialStatus, hasSocialNotification, markSocialSeen, removeFriend,
  sendFriendRequest, startSocial,
} from "../../world/social";

let mockStore = {};
const mockListeners = [];

jest.mock("firebase/database", () => {
  const split = (path) => (path ? path.split("/").filter(Boolean) : []);
  const read = (path) => split(path).reduce((node, key) => (node == null ? undefined : node[key]), mockStore) ?? null;
  const prune = (node) => {
    if (node === null || typeof node !== "object") return node;
    for (const key of Object.keys(node)) {
      node[key] = prune(node[key]);
      if (node[key] === null || (typeof node[key] === "object" && !Object.keys(node[key]).length)) delete node[key];
    }
    return node;
  };
  const write = (path, value) => {
    const keys = split(path);
    let node = mockStore;
    for (const key of keys.slice(0, -1)) {
      if (!node[key] || typeof node[key] !== "object") node[key] = {};
      node = node[key];
    }
    node[keys[keys.length - 1]] = value == null ? null : JSON.parse(JSON.stringify(value));
    prune(mockStore);
  };
  const notify = (paths) => {
    for (const listener of [...mockListeners])
      if (mockListeners.includes(listener) && paths.some((p) => listener.path === p || listener.path.startsWith(`${p}/`) || p.startsWith(`${listener.path}/`)))
        listener.cb({ val: () => JSON.parse(JSON.stringify(read(listener.path))) });
  };
  return {
    ref: (db, path = "") => ({ path }),
    get: async (r) => ({ exists: () => read(r.path) !== null, val: () => read(r.path) }),
    set: async (r, value) => {
      write(r.path, value);
      notify([r.path]);
    },
    update: async (r, patch) => {
      const paths = Object.keys(patch).map((key) => (r.path ? `${r.path}/${key}` : key));
      Object.keys(patch).forEach((key, i) => write(paths[i], patch[key]));
      notify(paths);
    },
    onValue: (r, cb) => {
      const listener = { path: r.path, cb };
      mockListeners.push(listener);
      cb({ val: () => JSON.parse(JSON.stringify(read(r.path))) });
      return () => mockListeners.splice(mockListeners.indexOf(listener), 1);
    },
  };
});
jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../character/player", () => ({ getCharacterIdentity: jest.fn(), getPlayer: jest.fn() }));
jest.mock("../../world/groupParty", () => ({ getGroupStatus: jest.fn(), lookupIdentity: jest.fn() }));

const NAMES = { Alice: "alice", Bob: "bob", Cy: "cy" };
let me;
let invites;
let stop;
const as = (id) => {
  stop?.();
  me = id;
  stop = startSocial();
};

beforeEach(() => {
  mockStore = { groupPresence: { bob: true } };
  mockListeners.length = 0;
  invites = [];
  window.localStorage.clear();
  jest.spyOn(console, "error").mockImplementation(() => {});
  getCharacterIdentity.mockImplementation(() => me);
  getPlayer.mockImplementation(() => ({ name: me[0].toUpperCase() + me.slice(1), stats: {} }));
  getGroupStatus.mockImplementation(() => ({ invites }));
  lookupIdentity.mockImplementation(async (name) => {
    const key = name[0].toUpperCase() + name.slice(1).toLowerCase();
    if (!NAMES[key]) throw new Error(`No character named ${name} was found.`);
    return { id: NAMES[key], name: key };
  });
  as("alice");
});
afterEach(() => {
  stop?.();
  stop = null;
});

test("a friend request is accepted into a two-sided friendship with presence", async () => {
  expect(await sendFriendRequest("bob")).toBe(true);
  expect(getSocialStatus().notice).toBe("Friend request sent to Bob.");
  expect(mockStore.friendRequests.bob.alice).toEqual({ name: "Alice", at: expect.any(Number) });
  expect(await sendFriendRequest("Bob")).toBe(false);
  expect(getSocialStatus().error).toMatch(/already sent Bob/);

  as("bob");
  expect(getSocialStatus().requests).toEqual([{ id: "alice", name: "Alice", at: expect.any(Number) }]);
  expect(await acceptFriendRequest("alice")).toBe(true);
  expect(mockStore.friendRequests).toBeUndefined();
  expect(mockStore.friends.bob.alice.name).toBe("Alice");
  expect(mockStore.friends.alice.bob.name).toBe("Bob");

  as("alice");
  expect(getSocialStatus().friends).toEqual([expect.objectContaining({ id: "bob", name: "Bob", online: true })]);
  expect(await sendFriendRequest("bob")).toBe(false);
  expect(getSocialStatus().error).toMatch(/already your friend/);
});

test("requests reject unknown players and yourself, and a crossed request befriends both", async () => {
  expect(await sendFriendRequest("Zed")).toBe(false);
  expect(getSocialStatus().error).toMatch(/No character named Zed/);
  expect(await sendFriendRequest("alice")).toBe(false);
  expect(getSocialStatus().error).toMatch(/befriend yourself/);

  as("bob");
  await sendFriendRequest("alice");
  as("alice");
  expect(await sendFriendRequest("bob")).toBe(true);
  expect(getSocialStatus().notice).toBe("You and Bob are now friends.");
  expect(Object.keys(mockStore.friends)).toEqual(["alice", "bob"]);
});

test("declining removes the request and removing a friend clears both sides", async () => {
  as("cy");
  await sendFriendRequest("alice");
  as("bob");
  await sendFriendRequest("alice");
  as("alice");
  expect(await declineFriendRequest("cy")).toBe(true);
  expect(Object.keys(mockStore.friendRequests.alice)).toEqual(["bob"]);
  await acceptFriendRequest("bob");
  expect(await removeFriend("bob")).toBe(true);
  expect(mockStore.friends).toBeUndefined();
  expect(getSocialStatus().friends).toEqual([]);
});

test("new friend requests and party invitations raise the notification until seen", async () => {
  expect(hasSocialNotification()).toBe(false);
  as("bob");
  await sendFriendRequest("alice");
  as("alice");
  expect(hasSocialNotification()).toBe(true);
  markSocialSeen();
  expect(hasSocialNotification()).toBe(false);
  as("alice");
  expect(hasSocialNotification()).toBe(false);

  invites = [{ id: "p1", from: "Cy", dungeon: "tidewrack", at: Date.now() + 1000 }];
  expect(hasSocialNotification()).toBe(true);
  markSocialSeen();
  expect(hasSocialNotification()).toBe(false);
});
