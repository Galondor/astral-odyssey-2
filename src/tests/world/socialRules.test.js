import http from "http";

// Integration tier: start the emulator with `firebase emulators:start --only database --project demo-name-elixir`
// and set DATABASE_RULES_TEST_URL (for example http://127.0.0.1:9000) before running npm test.
const emulator = process.env.DATABASE_RULES_TEST_URL;
if (emulator && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(emulator).hostname))
  throw new Error("Social rules tests must use a local emulator.");
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
  if (uid === "owner") headers.Authorization = ["Bearer", "owner"].join(" ");
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

const ask = { name: "Alice", at: 1 };
const accept = {
  "friends/bob/alice": { name: "Alice", since: 2 },
  "friends/alice/bob": { name: "Bob", since: 2 },
  "friendRequests/bob/alice": null,
};

integration("Social Firebase rules", () => {
  beforeEach(async () => {
    expect(await status("DELETE", "", undefined, "owner")).toBe(200);
  });
  afterAll(async () => { await request("DELETE", "", undefined, "owner"); });

  test("friend requests can only be sent as yourself and read by the two players", async () => {
    expect(await status("PUT", "friendRequests/bob/alice", ask, "carol")).toBe(401);
    expect(await status("PUT", "friendRequests/alice/alice", ask, "alice")).toBe(401);
    expect(await status("PUT", "friendRequests/bob/alice", { ...ask, extra: true }, "alice")).toBe(401);
    expect(await status("PUT", "friendRequests/bob/alice", { name: "A".repeat(41), at: 1 }, "alice")).toBe(401);
    expect(await status("PUT", "friendRequests/bob/alice", ask, "alice")).toBe(200);
    expect(await status("GET", "friendRequests/bob", undefined, "bob")).toBe(200);
    expect(await status("GET", "friendRequests/bob/alice", undefined, "alice")).toBe(200);
    expect(await status("GET", "friendRequests/bob", undefined, "alice")).toBe(401);
    expect(await status("GET", "friendRequests/bob/alice", undefined, "carol")).toBe(401);
  });

  test("either player can withdraw or decline a request, nobody else can", async () => {
    expect(await status("PUT", "friendRequests/bob/alice", ask, "alice")).toBe(200);
    expect(await status("DELETE", "friendRequests/bob/alice", undefined, "carol")).toBe(401);
    expect(await status("DELETE", "friendRequests/bob/alice", undefined, "bob")).toBe(200);
    expect(await status("PUT", "friendRequests/bob/alice", ask, "alice")).toBe(200);
    expect(await status("DELETE", "friendRequests/bob/alice", undefined, "alice")).toBe(200);
  });

  test("a friendship needs a pending request and is accepted by the invitee", async () => {
    expect(await status("PATCH", "", accept, "bob")).toBe(401);
    expect(await status("PUT", "friends/bob/alice", { name: "Alice", since: 2 }, "alice")).toBe(401);
    expect(await status("PUT", "friendRequests/bob/alice", ask, "alice")).toBe(200);
    expect(await status("PATCH", "", accept, "carol")).toBe(401);
    expect(await status("PATCH", "", accept, "bob")).toBe(200);
    expect((await request("GET", "friendRequests/bob/alice", undefined, "bob")).body).toBeNull();
    expect((await request("GET", "friends/alice", undefined, "alice")).body).toEqual({ bob: { name: "Bob", since: 2 } });
    expect(await status("GET", "friends/alice", undefined, "bob")).toBe(401);
  });

  test("either friend can end the friendship, nobody else can", async () => {
    expect(await status("PUT", "friendRequests/bob/alice", ask, "alice")).toBe(200);
    expect(await status("PATCH", "", accept, "bob")).toBe(200);
    const unfriend = { "friends/alice/bob": null, "friends/bob/alice": null };
    expect(await status("PATCH", "", unfriend, "carol")).toBe(401);
    expect(await status("PUT", "friends/alice/bob", { name: "Mallory", since: 3 }, "bob")).toBe(401);
    expect(await status("PATCH", "", unfriend, "alice")).toBe(200);
    expect((await request("GET", "friends/bob", undefined, "bob")).body).toBeNull();
  });
});
