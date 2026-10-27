import http from "http";
import { CONSUMABLES } from "../../items/consumables";
import databaseRules from "../../../database.rules.json";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));

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
const characterId = "0000000000000000000000000000000000000000";
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
      users: {
        seller: { player: { name: "Seller", consumables: { elixirOfNameChanging: 1 } } },
        account: {
          saveRevision: 4,
          characters: {
            [characterId]: {
              externalId: "character-player",
              slot: 0,
              createdAt: 1,
              player: { dungeonBoard: { slot: 3 }, labyrinth: { weekId: "old-week" } },
            },
          },
        },
      },
      characterOwners: {
        "character-player": { accountId: "account", characterId },
      },
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

  test("admins can refresh legacy and character timers while other users cannot", async () => {
    expect((await request("PATCH", "", {
      "users/seller/player/labyrinth": null,
    }, "buyer")).status).toBe(401);
    expect((await request("GET", "characterOwners/character-player", undefined, "admin")).body)
      .toEqual({ accountId: "account", characterId });
    expect((await request("PATCH", "", {
      "users/seller/saveRevision": 1,
      "users/seller/player/dungeonBoard/slot": -1,
      "users/account/saveRevision": 5,
      [`users/account/characters/${characterId}/player/labyrinth/weekId`]: null,
    }, "admin")).status).toBe(200);
    expect((await request("GET", "users/seller", undefined, "seller")).body)
      .toMatchObject({ saveRevision: 1, player: { dungeonBoard: { slot: -1 } } });
    expect((await request("GET", `users/account/characters/${characterId}`, undefined, "account")).body.player)
      .toMatchObject({ dungeonBoard: { slot: 3 } });
    expect((await request("GET", `users/account/characters/${characterId}`, undefined, "account")).body.player.labyrinth)
      .toBeUndefined();
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

  const id = (n) => String(n).padStart(40, "0");
  const reserve = async (accountId, characterId, identity = characterId) => {
    expect((await request("PUT", `characterOwners/${identity}`, { accountId, characterId }, accountId)).status).toBe(200);
  };
  const reserveSlot = async (accountId, index, characterId) => {
    expect((await request("PUT", `characterSlots/${accountId}/${index}`, { index, characterId }, accountId)).status).toBe(200);
  };
  const migrateSeller = async () => {
    const original = (await request("GET", "users/seller", undefined, "seller")).body.player;
    await reserve("seller", id(1), "seller");
    await reserveSlot("seller", 0, id(1));
    expect((await request("PATCH", "users/seller", {
      player: null, legacyBackup: original, legacyCharacterId: id(1), saveRevision: 1,
      characters: { [id(1)]: { externalId: "seller", slot: 0, createdAt: 1, player: original } },
    }, "seller")).status).toBe(200);
    return original;
  };

  test("legacy migration preserves the character, mail, claims, name, and marketplace links", async () => {
    await request("PUT", "inbox/seller/gift", { subject: "Old gift" }, "owner");
    await request("PUT", "inboxState/seller/gift", { claimed: true }, "owner");
    const original = await migrateSeller();
    const account = (await request("GET", "users/seller", undefined, "seller")).body;
    expect(account.legacyBackup).toEqual(original);
    expect(account.characters[id(1)].player).toEqual(original);
    expect((await request("GET", "inbox/seller/gift", undefined, "seller")).body.subject).toBe("Old gift");
    expect((await request("GET", "inboxState/seller/gift", undefined, "seller")).body.claimed).toBe(true);
    expect((await request("GET", "characterNames/Seller", undefined, "seller")).body).toBe("seller");
    expect((await request("PATCH", "", purchase(), "buyer")).status).toBe(200);
    expect((await request("GET", "inbox/seller/market-sale-test", undefined, "seller")).body.attachments.astra).toBe(90);
    expect((await request("PATCH", "users/seller", {
      player: { name: "Seller", astra: 999 }, saveRevision: 2,
    }, "seller")).status).toBe(401);
  });

  test("slot limits are enforced by rules and can be raised only on the server", async () => {
    for (let n = 1; n <= 4; n++) await reserve("buyer", id(n));
    for (let n = 1; n <= 3; n++) {
      await reserveSlot("buyer", n - 1, id(n));
      expect((await request("PATCH", "users/buyer", {
        [`characters/${id(n)}`]: { externalId: id(n), slot: n - 1, createdAt: 1 }, saveRevision: n,
      }, "buyer")).status).toBe(200);
    }
    expect((await request("PUT", "characterSlots/buyer/3", { index: 3, characterId: id(4) }, "buyer")).status).toBe(401);
    const fourth = { [`characters/${id(4)}`]: { externalId: id(4), slot: 3, createdAt: 1 }, saveRevision: 4 };
    expect((await request("PATCH", "users/buyer", fourth, "buyer")).status).toBe(401);
    expect((await request("PUT", "characterLimits/buyer", 5, "buyer")).status).toBe(401);
    await request("PUT", "characterLimits/buyer", 5, "owner");
    await reserveSlot("buyer", 3, id(4));
    expect((await request("PATCH", "users/buyer", fourth, "buyer")).status).toBe(200);
  });

  test("numeric identities cannot be stolen or attached to another account or slot", async () => {
    await reserve("seller", id(1));
    expect((await request("PUT", `characterOwners/${id(1)}`, { accountId: "buyer", characterId: id(1) }, "buyer")).status).toBe(401);
    expect((await request("PATCH", "users/buyer", {
      [`characters/${id(1)}`]: { externalId: id(1), slot: 0, createdAt: 1 }, saveRevision: 1,
    }, "buyer")).status).toBe(401);
    expect((await request("PATCH", "users/seller", {
      [`characters/${id(2)}`]: { externalId: id(1), slot: 0, createdAt: 1 }, player: null, saveRevision: 1,
    }, "seller")).status).toBe(401);
    expect((await request("GET", "users/seller", undefined, "buyer")).status).toBe(401);
  });

  const createBuyer = async () => {
    await reserve("buyer", id(2));
    await reserveSlot("buyer", 0, id(2));
    expect((await request("PUT", "characterNames/Nova", id(2), "buyer")).status).toBe(200);
    expect((await request("PATCH", "users/buyer", {
      saveRevision: 1,
      characters: { [id(2)]: { externalId: id(2), slot: 0, createdAt: 1, player: { name: "Nova", level: 10, astra: 1000 } } },
    }, "buyer")).status).toBe(200);
  };

  test("deletion clears linked data, prevents revival, and permits a new character in the slot", async () => {
    await createBuyer();
    await request("PUT", `inbox/${id(2)}/gift`, { subject: "Gift" }, "owner");
    await request("PUT", `inboxState/${id(2)}/gift`, { claimed: true }, "owner");
    await request("PUT", `leaderboardEntries/${id(2)}`, {
      name: "Nova", level: 10, gearScore: 0, astra: 1000, updatedAt: Date.now(),
    }, "owner");
    await request("PUT", "marketplace/second", { ...listing(), sellerUid: id(2) }, "owner");
    const deletion = {
      [`users/buyer/characters/${id(2)}`]: { externalId: id(2), slot: 0, createdAt: 1, deletedAt: Date.now() },
      "users/buyer/saveRevision": 2,
      "users/buyer/lastCharacterIdentity": id(2),
      [`inbox/${id(2)}`]: null, [`inboxState/${id(2)}`]: null,
      [`directory/${id(2)}`]: null, [`leaderboardEntries/${id(2)}`]: null,
      "characterNames/Nova": null, "marketplace/second": null,
    };
    expect((await request("PATCH", "", deletion, "seller")).status).toBe(401);
    expect((await request("DELETE", `inbox/${id(2)}`, undefined, "buyer")).status).toBe(401);
    expect((await request("PATCH", "", deletion, "buyer")).status).toBe(200);
    expect((await request("GET", `inbox/${id(2)}`, undefined, "buyer")).body).toBeNull();
    expect((await request("GET", "characterNames/Nova", undefined, "buyer")).body).toBeNull();
    expect((await request("PATCH", "users/buyer", {
      [`characters/${id(2)}/player`]: { name: "Nova" }, saveRevision: 3,
    }, "buyer")).status).toBe(401);
    expect((await request("PATCH", "users/buyer", {
      [`characters/${id(2)}/deletedAt`]: null, saveRevision: 3,
    }, "buyer")).status).toBe(401);
    await reserve("buyer", id(3));
    await reserveSlot("buyer", 0, id(3));
    expect((await request("PATCH", "users/buyer", {
      [`characters/${id(3)}`]: { externalId: id(3), slot: 0, createdAt: 1 }, saveRevision: 3,
    }, "buyer")).status).toBe(200);
    expect((await request("PUT", `characterSlots/buyer/0`, { index: 0, characterId: id(2) }, "buyer")).status).toBe(401);
  });

  test("names, directory, leaderboards, and claims belong to individual characters", async () => {
    await createBuyer();
    expect((await request("PUT", "characterNames/Luna", id(2), "buyer")).status).toBe(200);
    const write = {
      [`users/buyer/characters/${id(2)}/player`]: { name: "Luna", level: 10, astra: 1000 },
      "users/buyer/saveRevision": 2,
      "users/buyer/lastCharacterIdentity": id(2),
      [`directory/${id(2)}`]: { name: "Luna", level: 10 },
      "characterNames/Nova": null,
      [`inboxState/${id(2)}/gift/claimed`]: true,
    };
    expect((await request("PATCH", "", write, "buyer")).status).toBe(200);
    expect((await request("PATCH", "", { ...write, "users/buyer/saveRevision": 3 }, "buyer")).status).toBe(401);
    expect((await request("GET", `inboxState/${id(2)}`, undefined, "seller")).status).toBe(401);
    expect((await request("PUT", `leaderboardEntries/${id(2)}`, {
      name: "Luna", level: 10, gearScore: 0, astra: 1000, updatedAt: { ".sv": "timestamp" },
    }, "buyer")).status).toBe(200);
    expect((await request("GET", `leaderboardEntries/${id(2)}`, undefined, "seller")).body.name).toBe("Luna");
  });

  test("numeric characters can buy old listings and receive mail in their own inbox", async () => {
    await createBuyer();
    const writes = purchase();
    writes[`inbox/${id(2)}/market-test`] = { ...writes["inbox/buyer/market-test"], buyerUid: id(2) };
    delete writes["inbox/buyer/market-test"];
    writes["inbox/seller/market-sale-test"].buyerUid = id(2);
    writes[`users/buyer/characters/${id(2)}/player`] = { name: "Nova", level: 10, astra: 899 };
    writes["users/buyer/saveRevision"] = 2;
    writes["users/buyer/lastCharacterIdentity"] = id(2);
    expect((await request("PATCH", "", writes, "buyer")).status).toBe(200);
    expect((await request("GET", `inbox/${id(2)}/market-test`, undefined, "buyer")).body.attachments)
      .toEqual({ consumables: { elixirOfNameChanging: 1 } });
    expect((await request("GET", `inbox/${id(2)}`, undefined, "seller")).status).toBe(401);
    expect((await request("PATCH", "", { ...writes, "users/buyer/saveRevision": 3 }, "buyer")).status).toBe(401);
  });

  test("numeric characters can list, cancel, and receive payouts from legacy buyers", async () => {
    await createBuyer();
    const save = (revision, extra) => ({
      [`users/buyer/characters/${id(2)}/player`]: { name: "Nova", level: 10, astra: 1000 },
      "users/buyer/saveRevision": revision,
      "users/buyer/lastCharacterIdentity": id(2),
      ...extra,
    });
    expect((await request("PATCH", "", save(2, {
      "marketplace/second": { ...listing(), sellerUid: id(2), sellerName: "Nova" },
    }), "buyer")).status).toBe(200);
    expect((await request("PATCH", "", save(3, { "marketplace/second": null }), "buyer")).status).toBe(200);
    expect((await request("PATCH", "", save(4, {
      "marketplace/second": { ...listing(), sellerUid: id(2), sellerName: "Nova" },
    }), "buyer")).status).toBe(200);
    const mail = {
      "marketplace/second": null,
      "inbox/seller/market-second": { from: "Marketplace", listingId: "second", attachments: { consumables: { elixirOfNameChanging: 1 } } },
      [`inbox/${id(2)}/market-sale-second`]: { from: "Marketplace", listingId: "second", attachments: { astra: 90 } },
    };
    expect((await request("PATCH", "", mail, "seller")).status).toBe(200);
    expect((await request("GET", `inbox/${id(2)}/market-sale-second`, undefined, "buyer")).body.attachments.astra).toBe(90);
  });
});
