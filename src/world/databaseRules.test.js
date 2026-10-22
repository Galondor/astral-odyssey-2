import http from "http";
import { CONSUMABLES } from "../items/consumables";
import databaseRules from "../../database.rules.json";

jest.mock("../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));

test("marketplace rules accept exactly the current consumable catalog", () => {
  const validation = databaseRules.rules.marketplace.$listingId[".validate"];
  const pattern = validation.match(/child\('item\/key'\)\.val\(\)\.matches\(\/(.+?)\/\)/);
  expect(pattern).not.toBeNull();
  const allowedKeys = pattern[1].replace(/^\^\(|\)\$$/g, "").split("|");
  expect(allowedKeys.sort()).toEqual(Object.keys(CONSUMABLES).sort());
});

// Optional integration tier: run against an isolated Firebase Database emulator.
// Start with: firebase emulators:start --only database --project demo-name-elixir
// Then set DATABASE_RULES_TEST_URL to its local URL before running npm test.
const emulator = process.env.DATABASE_RULES_TEST_URL;
const rulesTests = emulator ? describe : describe.skip;
const project = "demo-name-elixir";
const namespace = `${project}-default-rtdb`;
if (emulator && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(emulator).hostname))
  throw new Error("Database rules tests must target a local emulator.");

const token = (uid) => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    aud: project, iss: `https://securetoken.google.com/${project}`,
    sub: uid, user_id: uid, iat: now, exp: now + 3600,
    firebase: { sign_in_provider: "custom" },
  })}.`;
};

const request = (method, path, value, uid, query = "") => new Promise((resolve, reject) => {
  const url = new URL(`${emulator}/${path}.json?ns=${namespace}${query}`);
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

const elixir = { kind: "consumable", key: "elixirOfNameChanging", name: "Elixir of Name Changing" };
const sword = { id: "sword", name: "Sword", slot: "weapon", rarity: "Rare", iLevel: 10 };
const slimeGel = { kind: "material", key: "slime_gel", name: "Slime Gel", tier: "common", count: 3 };
const ruby = { kind: "gemstone", id: "ruby-1", name: "Rare Ruby", type: "ruby", stat: "strength", value: 3, rarity: "Rare" };
const consumableItems = Object.entries(CONSUMABLES).map(([key, item]) => ({
  kind: "consumable", key, name: item.name,
}));
const listing = (item = elixir) => ({
  sellerUid: "seller", sellerName: "Seller", item, price: 101, listedAt: 1,
});
const purchase = (attachments = { consumables: { elixirOfNameChanging: 1 } }) => ({
  "marketplace/test": null,
  "inbox/buyer/market-test": {
    from: "Marketplace", listingId: "test", subject: "Purchased", body: "", sentAt: 1, attachments,
  },
  "inbox/seller/market-sale-test": {
    from: "Marketplace", listingId: "test", subject: "Sold", body: "", sentAt: 1, attachments: { astra: 90 },
  },
});

rulesTests("Firebase name and consumable marketplace rules", () => {
  beforeEach(async () => {
    const result = await request("PUT", "", {
      users: { seller: { player: { name: "Seller", consumables: { elixirOfNameChanging: 1 } } } },
      directory: { seller: { name: "Seller", level: 10 } },
      characterNames: { Seller: "seller" },
      marketplace: { test: listing() },
      admins: { admin: true },
    }, "owner");
    expect(result.status).toBe(200);
  });

  afterAll(async () => {
    await request("DELETE", "", undefined, "owner");
  });

  test("requires authentication and prevents a second owner claiming the same name", async () => {
    expect((await request("PUT", "characterNames/Nova", "buyer")).status).toBe(401);
    expect((await request("PUT", "characterNames/Nova", "buyer", "buyer")).status).toBe(200);
    expect((await request("PUT", "characterNames/Nova", "seller", "seller")).status).toBe(401);
    expect((await request("GET", "characterNames/Nova", undefined, "buyer")).body).toBe("buyer");
  });

  test("name creation requires a reservation, and saves the player immediately", async () => {
    expect((await request("PUT", "users/buyer/player", { name: "Nova" }, "buyer")).status).toBe(401);
    await request("PUT", "characterNames/Nova", "buyer", "buyer");
    expect((await request("PUT", "users/buyer/player", { name: "Nova" }, "buyer")).status).toBe(200);
    expect((await request("GET", "users/buyer/player", undefined, "buyer")).body).toEqual({ name: "Nova" });
  });

  test("a rename, item cost, directory update, and old-name release can be saved atomically", async () => {
    const updatedAt = Date.now();
    await request("PUT", "leaderboardEntries/seller", {
      name: "Seller", level: 10, gearScore: 0, astra: 0, updatedAt,
    }, "owner");
    await request("PUT", "characterNames/Nova", "seller", "seller");
    expect((await request("PATCH", "", {
      "users/seller/player": { name: "Nova", level: 10 },
      "directory/seller": { name: "Nova", level: 10 },
      "characterNames/Seller": null,
      "leaderboardEntries/seller/name": "Nova",
    }, "seller")).status).toBe(200);
    expect((await request("GET", "users/seller/player", undefined, "seller")).body).toEqual({ name: "Nova", level: 10 });
    expect((await request("GET", "characterNames/Seller", undefined, "buyer")).body).toBeNull();
    expect((await request("GET", "leaderboardEntries/seller", undefined, "buyer")).body)
      .toMatchObject({ name: "Nova", updatedAt });
  });

  test("the current name cannot be released while still in use", async () => {
    expect((await request("DELETE", "characterNames/Seller", undefined, "seller")).status).toBe(401);
  });

  test("non-admins can look up an exact legacy name but cannot read the entire directory", async () => {
    const query = '&orderBy="name"&equalTo="Seller"';
    expect((await request("GET", "directory", undefined, "buyer", query)).body).toEqual({ seller: { name: "Seller", level: 10 } });
    expect((await request("GET", "directory", undefined, "buyer")).status).toBe(401);
  });

  test.each([...consumableItems, sword, slimeGel, ruby])("sellers can list and cancel $name", async (item) => {
    expect((await request("PUT", "marketplace/second", listing(item), "seller")).status).toBe(200);
    expect((await request("DELETE", "marketplace/second", undefined, "seller")).status).toBe(200);
  });

  test.each(consumableItems)("versioned sales and purchases accept $name", async (item) => {
    await request("DELETE", "marketplace/test", undefined, "owner");
    await request("PATCH", "users/seller", { saveRevision: 1 }, "seller");
    expect((await request("PATCH", "", {
      "marketplace/test": listing(item),
      "users/seller/player": { name: "Seller" },
      "users/seller/saveRevision": 2,
    }, "seller")).status).toBe(200);
    expect((await request("PATCH", "", purchase({ consumables: { [item.key]: 1 } }), "buyer")).status).toBe(200);
    expect((await request("GET", "inbox/buyer/market-test", undefined, "buyer")).body.attachments)
      .toEqual({ consumables: { [item.key]: 1 } });
  });

  test("consumable purchases deliver one elixir and the taxed payout exactly once", async () => {
    expect((await request("PATCH", "", purchase(), "buyer")).status).toBe(200);
    expect((await request("GET", "inbox/buyer/market-test", undefined, "buyer")).body.attachments)
      .toEqual({ consumables: { elixirOfNameChanging: 1 } });
    expect((await request("GET", "inbox/seller/market-sale-test", undefined, "seller")).body.attachments)
      .toEqual({ astra: 90 });
    expect((await request("PATCH", "", purchase(), "buyer")).status).toBe(401);
  });

  test("gear purchases still deliver the exact gear attachment", async () => {
    await request("PUT", "marketplace/test", listing(sword), "owner");
    expect((await request("PATCH", "", purchase({ items: [sword] }), "buyer")).status).toBe(200);
  });

  test.each([
    [slimeGel, { materials: { slime_gel: 3 } }],
    [ruby, { gemstoneItems: [ruby] }],
  ])("material and gemstone purchases deliver matching attachments", async (item, attachments) => {
    await request("PUT", "marketplace/test", listing(item), "owner");
    expect((await request("PATCH", "", purchase(attachments), "buyer")).status).toBe(200);
    expect((await request("GET", "inbox/buyer/market-test", undefined, "buyer")).body.attachments)
      .toEqual(attachments);
  });

  test.each([
    { consumables: { elixirOfNameChanging: 2 } },
    { consumables: { elixirOfNameChanging: 1, healthPotion: 1 } },
    { consumables: { healthPotion: 1 } },
    { consumables: { elixirOfNameChanging: 1 }, astra: 100 },
    { consumables: { elixirOfNameChanging: 1 }, items: [sword] },
  ])("rejects mismatched or extra purchase attachments: %j", async (attachments) => {
    expect((await request("PATCH", "", purchase(attachments), "buyer")).status).toBe(401);
    expect((await request("GET", "marketplace/test", undefined, "buyer")).body.item).toEqual(elixir);
  });

  test("admins can mail the elixir, while ordinary players cannot send admin gifts", async () => {
    const message = { from: "Admin", subject: "Gift", attachments: { consumables: { elixirOfNameChanging: 2 } } };
    expect((await request("PUT", "inbox/buyer/gift", message, "seller")).status).toBe(401);
    expect((await request("PUT", "inbox/buyer/gift", message, "admin")).status).toBe(200);
    expect((await request("GET", "inbox/buyer/gift", undefined, "buyer")).body.attachments)
      .toEqual(message.attachments);
  });

  test("only one browser can commit a given next save revision", async () => {
    await request("PATCH", "users/seller", { saveRevision: 1 }, "seller");
    const save = (astra) => ({
      "users/seller/player": { name: "Seller", astra },
      "users/seller/saveRevision": 2,
    });
    const attempts = await Promise.all([
      request("PATCH", "", save(100), "seller"),
      request("PATCH", "", save(200), "seller"),
    ]);
    expect(attempts.map((r) => r.status).sort()).toEqual([200, 401]);
    expect((await request("PUT", "users/seller/player", { name: "Seller", astra: 999 }, "seller")).status).toBe(401);
    expect((await request("DELETE", "users/seller", undefined, "seller")).status).toBe(401);
  });

  test("versioned marketplace listings require the inventory save in the same commit", async () => {
    await request("PATCH", "users/seller", { saveRevision: 1 }, "seller");
    expect((await request("PUT", "marketplace/second", listing(), "seller")).status).toBe(401);
    const writes = {
      "marketplace/second": listing(),
      "users/seller/player": { name: "Seller" },
      "users/seller/saveRevision": 2,
    };
    expect((await request("PATCH", "", writes, "seller")).status).toBe(200);
    const cancel = {
      "marketplace/second": null,
      "users/seller/player": { name: "Seller", consumables: { elixirOfNameChanging: 1 } },
      "users/seller/saveRevision": 3,
    };
    expect((await request("PATCH", "", cancel, "seller")).status).toBe(200);
    expect((await request("PATCH", "", { ...cancel, "users/seller/saveRevision": 4 }, "seller")).status).toBe(401);
  });

  test("inbox claims and rewards commit together and cannot be claimed twice", async () => {
    await request("PATCH", "users/seller", { saveRevision: 1 }, "seller");
    expect((await request("PUT", "inboxState/seller/gift/claimed", true, "seller")).status).toBe(401);
    const writes = {
      "inboxState/seller/gift/claimed": true,
      "users/seller/player": { name: "Seller", astra: 100 },
      "users/seller/saveRevision": 2,
    };
    expect((await request("PATCH", "", writes, "seller")).status).toBe(200);
    expect((await request("PATCH", "", { ...writes, "users/seller/saveRevision": 3 }, "seller")).status).toBe(401);
    expect((await request("GET", "users/seller", undefined, "seller")).body)
      .toMatchObject({ saveRevision: 2, player: { astra: 100 } });
  });
});
