import http from "http";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));

// Integration tier: start the emulator with `firebase emulators:start --only database --project demo-name-elixir`
// and set DATABASE_RULES_TEST_URL (for example http://127.0.0.1:9000) before running npm test.
const emulator = process.env.DATABASE_RULES_TEST_URL;
if (emulator && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(emulator).hostname))
  throw new Error("Group rules tests must use a local emulator.");
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
const status = async (...args) => (await request(...args)).status;

const member = (name) => ({ name, level: 45, cls: "Swordsman", ready: false });
const party = {
  leader: "alice",
  dungeon: "tidewrack",
  open: false,
  createdAt: 1,
  members: { alice: member("Alice") },
};
const run = (revision, id = "run1") => ({ id, dungeon: "tidewrack", revision, status: "active", members: ["alice"] });

integration("Group dungeon Firebase rules", () => {
  beforeEach(async () => {
    expect(await status("DELETE", "", undefined, "owner")).toBe(200);
  });
  afterAll(async () => { await request("DELETE", "", undefined, "owner"); });

  const createParty = async () => expect(await status("PUT", "groupParties/p1", party, "alice")).toBe(200);

  test("a party can only be created with yourself as leader and an allowed dungeon", async () => {
    expect(await status("PUT", "groupParties/p1", { ...party, leader: "bob" }, "alice")).toBe(401);
    expect(await status("PUT", "groupParties/p1", { ...party, dungeon: "nowhere" }, "alice")).toBe(401);
    await createParty();
    expect(await status("PUT", "groupParties/p1", { ...party, leader: "bob", members: { bob: member("Bob") } }, "bob")).toBe(401);
  });

  test("joining needs an invite or an open party", async () => {
    await createParty();
    expect(await status("PUT", "groupParties/p1/members/bob", member("Bob"), "bob")).toBe(401);
    expect(await status("PUT", "groupInvites/bob/p1", { from: "Alice", dungeon: "tidewrack", at: 1 }, "carol")).toBe(401);
    expect(await status("PUT", "groupInvites/bob/p1", { from: "Alice", dungeon: "tidewrack", at: 1 }, "alice")).toBe(200);
    expect(await status("PUT", "groupParties/p1/members/bob", member("Bob"), "bob")).toBe(200);
    expect(await status("DELETE", "groupInvites/bob/p1", undefined, "bob")).toBe(200);
    expect(await status("PUT", "groupParties/p1/members/carol", member("Carol"), "carol")).toBe(401);
    expect(await status("PUT", "groupParties/p1/open", true, "bob")).toBe(401);
    expect(await status("PUT", "groupParties/p1/open", true, "alice")).toBe(200);
    expect(await status("PUT", "groupParties/p1/members/carol", member("Carol"), "carol")).toBe(200);
  });

  test("members manage only themselves; the leader can kick", async () => {
    await createParty();
    await status("PUT", "groupParties/p1/open", true, "alice");
    await status("PUT", "groupParties/p1/members/bob", member("Bob"), "bob");
    await status("PUT", "groupParties/p1/members/carol", member("Carol"), "carol");
    expect(await status("PUT", "groupParties/p1/members/carol/ready", true, "bob")).toBe(401);
    expect(await status("PUT", "groupParties/p1/members/bob/ready", true, "bob")).toBe(200);
    expect(await status("DELETE", "groupParties/p1/members/carol", undefined, "bob")).toBe(401);
    expect(await status("DELETE", "groupParties/p1/members/carol", undefined, "alice")).toBe(200);
    expect(await status("DELETE", "groupParties/p1/members/bob", undefined, "bob")).toBe(200);
  });

  test("intents and chat are written by members as themselves", async () => {
    await createParty();
    await status("PUT", "groupParties/p1/open", true, "alice");
    await status("PUT", "groupParties/p1/members/bob", member("Bob"), "bob");
    const intent = { run: "run1", round: 1, stage: 0, type: "defend" };
    expect(await status("PUT", "groupParties/p1/intents/alice", intent, "bob")).toBe(401);
    expect(await status("PUT", "groupParties/p1/intents/bob", intent, "bob")).toBe(200);
    expect(await status("PUT", "groupParties/p1/intents/carol", intent, "carol")).toBe(401);
    const msg = { from: "bob", name: "Bob", text: "Ready!", at: 1 };
    expect(await status("PUT", "groupParties/p1/chat/m1", msg, "bob")).toBe(200);
    expect(await status("PUT", "groupParties/p1/chat/m2", { ...msg, from: "alice" }, "bob")).toBe(401);
    expect(await status("PUT", "groupParties/p1/chat/m3", { ...msg, text: "x".repeat(201) }, "bob")).toBe(401);
    expect(await status("PUT", "groupParties/p1/chat/m1", { ...msg, text: "edited" }, "bob")).toBe(401);
    expect(await status("DELETE", "groupParties/p1/chat", undefined, "alice")).toBe(200);
  });

  test("only the leader advances the run, one revision at a time", async () => {
    await createParty();
    await status("PUT", "groupParties/p1/open", true, "alice");
    await status("PUT", "groupParties/p1/members/bob", member("Bob"), "bob");
    expect(await status("PUT", "groupParties/p1/run", run(1), "bob")).toBe(401);
    expect(await status("PUT", "groupParties/p1/run", run(1), "alice")).toBe(200);
    expect(await status("PUT", "groupParties/p1/run", run(3), "alice")).toBe(401);
    expect(await status("PUT", "groupParties/p1/run", run(2), "alice")).toBe(200);
    expect(await status("PUT", "groupParties/p1/run", run(1, "run2"), "alice")).toBe(200);
  });

  test("leadership can be taken only from an offline or departed leader", async () => {
    await createParty();
    await status("PUT", "groupParties/p1/open", true, "alice");
    await status("PUT", "groupParties/p1/members/bob", member("Bob"), "bob");
    expect(await status("PUT", "groupPresence/alice", true, "alice")).toBe(200);
    expect(await status("PUT", "groupPresence/alice", false, "bob")).toBe(401);
    expect(await status("PUT", "groupParties/p1/leader", "bob", "bob")).toBe(401);
    expect(await status("PUT", "groupPresence/alice", false, "alice")).toBe(200);
    expect(await status("PUT", "groupParties/p1/leader", "carol", "carol")).toBe(401);
    expect(await status("PUT", "groupParties/p1/leader", "bob", "bob")).toBe(200);
    expect(await status("PUT", "groupParties/p1/dungeon", "starless", "alice")).toBe(401);
    expect(await status("PUT", "groupParties/p1/dungeon", "starless", "bob")).toBe(200);
  });

  test("only the leader can disband and list the party", async () => {
    await createParty();
    const lfg = { dungeon: "tidewrack", leaderName: "Alice", size: 1, at: 1 };
    expect(await status("PUT", "groupLfg/p1", lfg, "bob")).toBe(401);
    expect(await status("PUT", "groupLfg/p1", lfg, "alice")).toBe(200);
    expect(await status("DELETE", "groupParties/p1", undefined, "bob")).toBe(401);
    expect(await status("DELETE", "groupParties/p1", undefined, "alice")).toBe(200);
    // Anyone may sweep listings for parties that no longer exist
    expect(await status("DELETE", "groupLfg/p1", undefined, "bob")).toBe(200);
  });
});
