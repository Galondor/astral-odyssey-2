import http from "http";
import { reduceContest } from "../../world/contest";

jest.mock("../../firebase", () => ({ db: {}, auth: {} }));
jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));

const emulator = process.env.DATABASE_RULES_TEST_URL;
if (emulator && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(emulator).hostname))
  throw new Error("Contest rules tests must use a local emulator.");
const integration = emulator ? describe : describe.skip;
const token = (uid) => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    aud: "demo-name-elixir", iss: "https://securetoken.google.com/demo-name-elixir",
    sub: uid, user_id: uid, iat: now, exp: now + 3600, firebase: { sign_in_provider: "custom" },
  })}.`;
};
const request = (method, path, value, uid) => new Promise((resolve, reject) => {
  const url = new URL(`${emulator}/${path}.json?ns=demo-name-elixir-default-rtdb`);
  const headers = { "Content-Type": "application/json" };
  if (uid === "owner") headers.Authorization = "Bearer owner";
  else if (uid) url.searchParams.set("auth", token(uid));
  const req = http.request(url, { method, headers }, (res) => {
    let body = "";
    res.on("data", (chunk) => { body += chunk; });
    res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(body || "null") }));
  });
  req.on("error", reject);
  req.end(value === undefined ? undefined : JSON.stringify(value));
});
const writes = (before, after) => {
  const patch = { revision: after.revision, actor: after.actor, command: after.command };
  for (const section of ["entries", "matches"])
    for (const key of new Set([...Object.keys(before?.[section] || {}), ...Object.keys(after[section] || {})])) {
      const value = after[section]?.[key] || null;
      if (JSON.stringify(value) !== JSON.stringify(before?.[section]?.[key]))
        patch[`${section}/${key}`] = value;
    }
  return patch;
};
const player = (name, speed) => ({
  name, level: 10, skills: { frostLance: 1 }, equippedSkills: ["frostLance"], equipment: {},
  consumables: { healthPotion: 2 },
  stats: {
    maxHealth: 100, maxPower: 10, maxStamina: 10, speed,
    defense: 0, attackMin: 5, attackMax: 5, magicAttackMin: 5,
    magicAttackMax: 5, criticalHitChance: 0, criticalDamageBonus: 2,
  },
});

integration("Contest Firebase rules and atomic concurrency", () => {
  beforeEach(async () => {
    expect((await request("DELETE", "", undefined, "owner")).status).toBe(200);
  });
  afterAll(async () => { await request("DELETE", "", undefined, "owner"); });

  const read = async () => (await request("GET", "contest", undefined, "alice")).body;
  const queue = async (id, speed) => {
    expect((await request("PUT", `contestPresence/${id}`, true, id)).status).toBe(200);
    const before = await read();
    const livePlayers = (await request("GET", "contestPresence", undefined, id)).body;
    const after = reduceContest(before, id, id, { type: "queue", player: player(id, speed), livePlayers }, Date.now());
    const result = await request("PATCH", "contest", writes(before, after), id);
    expect(result).toEqual(expect.objectContaining({ status: 200 }));
    return after;
  };
  const action = async (id, command) => {
    const before = await read();
    const matchId = before.entries[id].matchId;
    const after = reduceContest(before, id, id, {
      ...command, matchId, revision: before.matches[matchId].revision,
    }, Date.now());
    const result = await request("PATCH", "contest", writes(before, after), id);
    expect(result).toEqual(expect.objectContaining({ status: 200 }));
    return after;
  };

  test("two authenticated players queue, alternate actions, spend items, and forfeit", async () => {
    await queue("alice", 20);
    await queue("bob", 10);
    await action("alice", { type: "action", action: { type: "melee" } });
    await action("bob", { type: "action", action: { type: "consume", key: "healthPotion" } });
    const after = await action("alice", { type: "forfeit" });
    expect(after.entries.alice.deaths).toBe(1);
    expect(after.entries.bob.kills).toBe(1);
    expect(after.entries.bob.spent.healthPotion).toBe(1);
    await queue("alice", 20);
    const saved = await read();
    expect(saved.entries.alice.deaths).toBe(1);
  });

  test("equipped skills and stun effects persist through live turn writes", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    try {
      await queue("alice", 20);
      await queue("bob", 10);
      await action("alice", { type: "action", action: { type: "skill", key: "frostLance" } });
      let state = await read();
      const id = state.entries.alice.matchId;
      expect(state.matches[id].fighters.alice.player.stats.power).toBe(6);
      expect(state.matches[id].fighters.bob.statuses).toContainEqual(expect.objectContaining({ id: "stun", power: 0 }));
      await action("bob", { type: "action", action: { type: "pass" } });
      state = await read();
      expect(state.matches[id].turn).toBe("alice");
      expect(state.matches[id].fighters.bob.statuses.some((effect) => effect.id === "stun")).toBe(false);
    } finally {
      jest.restoreAllMocks();
    }
  });

  test("stale matchmaking writes fail atomically and outsiders cannot change or delete matches", async () => {
    const before = await queue("alice", 20);
    await request("PUT", "contestPresence/bob", true, "bob");
    await request("PUT", "contestPresence/charlie", true, "charlie");
    const livePlayers = { alice: true, bob: true, charlie: true };
    const bob = reduceContest(before, "bob", "bob", { type: "queue", player: player("bob", 10), livePlayers }, Date.now());
    const charlie = reduceContest(before, "charlie", "charlie", { type: "queue", player: player("charlie", 10), livePlayers }, Date.now());
    expect((await request("PATCH", "contest", writes(before, bob), "bob")).status).toBe(200);
    expect((await request("PATCH", "contest", writes(before, charlie), "charlie")).status).toBe(401);
    expect((await request("DELETE", "contest", undefined, "bob")).status).toBe(401);
    const state = await read();
    const id = state.entries.alice.matchId;
    expect((await request("DELETE", `contest/matches/${id}`, undefined, "charlie")).status).toBe(401);
    expect((await request("PUT", `contest/matches/${id}/winner`, "charlie", "charlie")).status).toBe(401);
    const forged = {
      revision: state.revision + 1, actor: "charlie", command: "action",
      [`matches/${id}`]: { ...state.matches[id], revision: state.matches[id].revision + 1, winner: "bob" },
    };
    expect((await request("PATCH", "contest", forged, "charlie")).status).toBe(401);
  });

  test("timeout results are server-time gated and completed history can be pruned without losing totals", async () => {
    await queue("alice", 20);
    await queue("bob", 10);
    let before = await read();
    const id = before.entries.alice.matchId;
    const premature = reduceContest(before, "bob", "bob", {
      type: "timeout", matchId: id, revision: 0,
    }, before.matches[id].deadline);
    expect((await request("PATCH", "contest", writes(before, premature), "bob")).status).toBe(401);
    await request("PUT", `contest/matches/${id}/deadline`, Date.now() - 1000, "owner");
    const completed = await action("bob", { type: "timeout" });
    expect(completed.matches[id].winner).toBe("bob");
    await queue("alice", 20);
    await queue("bob", 10);
    before = await read();
    expect(before.matches[id]).toBeUndefined();
    expect(before.entries.alice.deaths).toBe(1);
    expect(before.entries.bob.kills).toBe(1);
  });

  test("character identities use account ownership and reject impersonation and disconnected hosts", async () => {
    await request("PUT", "characterOwners/alice", { accountId: "account-a", characterId: "slot-a" }, "owner");
    expect((await request("PUT", "contestPresence/alice", true, "impostor")).status).toBe(401);
    expect((await request("PUT", "contestPresence/alice", true, "account-a")).status).toBe(200);
    let state = reduceContest(null, "alice", "account-a", {
      type: "queue", player: player("Alice", 20), livePlayers: { alice: true },
    }, Date.now());
    expect((await request("PATCH", "contest", writes(null, state), "account-a")).status).toBe(200);
    const before = await read();
    state = reduceContest(before, "bob", "bob", {
      type: "queue", player: player("Bob", 10), livePlayers: { alice: true, bob: true },
    }, Date.now());
    await request("PUT", "contestPresence/bob", true, "bob");
    await request("PUT", "contestPresence/alice", false, "account-a");
    expect((await request("PATCH", "contest", writes(before, state), "bob")).status).toBe(401);
  });
});
