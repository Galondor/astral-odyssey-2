import { get, update } from "firebase/database";
import { commitPlayerChange, getPlayer, setPlayer } from "../character/player";
import { auth } from "../firebase";
import { CONSUMABLES } from "../items/consumables";
import { generateRandomGemstone } from "../items/items";
import { DEFAULT_FILTERS, buyListing, cancelListing, filterListings, listItem, sortListings } from "./marketplace";

jest.mock("../firebase", () => ({ db: {}, auth: { currentUser: { uid: "seller" } } }));
jest.mock("../character/player", () => ({
  getPlayer: jest.fn(), setPlayer: jest.fn(), commitPlayerChange: jest.fn(),
}));
jest.mock("../combat/combat", () => ({ getEnemy: () => null }));
jest.mock("firebase/database", () => ({
  ref: (_, path) => path, push: () => ({ key: "listing" }),
  get: jest.fn(), update: jest.fn(), onValue: jest.fn(),
}));

let player;
const elixir = { kind: "consumable", key: "elixirOfNameChanging", name: "Elixir of Name Changing" };
const gear = { id: "sword", name: "Sword", slot: "weapon", rarity: "Rare", iLevel: 10, subStats: {} };
const material = { kind: "material", key: "slime_gel", name: "Slime Gel", tier: "common", count: 3 };
const gemstone = { kind: "gemstone", id: "ruby-1", name: "Rare Ruby", type: "ruby", stat: "strength", value: 3, rarity: "Rare" };
const listing = (item = elixir) => ({
  id: "listing", sellerUid: "seller", sellerName: "Seller", item, price: 101, listedAt: 1,
});

beforeEach(() => {
  jest.clearAllMocks();
  auth.currentUser = { uid: "seller" };
  player = { name: "Seller", level: 25, astra: 1000, consumables: { elixirOfNameChanging: 2 }, materials: { slime_gel: 5 }, gemstones: [gemstone], inventory: [gear] };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
  update.mockResolvedValue();
  get.mockResolvedValue({ val: () => listing() });
  commitPlayerChange.mockImplementation(async (change) => update(undefined, change()));
});

test("selling a consumable removes exactly one and keeps gear untouched", async () => {
  expect(await listItem("elixirOfNameChanging", 101)).toMatchObject({ ok: true });
  expect(player.consumables.elixirOfNameChanging).toBe(1);
  expect(player.inventory).toEqual([gear]);
  expect(update).toHaveBeenCalledWith(undefined, {
    "marketplace/listing": expect.objectContaining({ item: elixir, price: 101 }),
  });

});

test("holofoil equipment keeps its exact colors when listed and returned", async () => {
  const foil = { ...gear, holofoil: ["#ABCDEF", "#123456"] };
  player.inventory = [foil];
  expect(await listItem(0, 101)).toMatchObject({ ok: true });
  const stored = update.mock.calls[0][1]["marketplace/listing"];
  expect(stored.item.holofoil).toEqual(foil.holofoil);
  expect(player.inventory).toEqual([]);
  get.mockResolvedValue({ val: () => stored });
  expect(await cancelListing({ id: "listing", ...stored })).toMatchObject({ ok: true });
  expect(player.inventory[0].holofoil).toEqual(foil.holofoil);
});

test.each([
  ["gear", "sword", 0],
  ["consumables", "elixirOfNameChanging", "elixirOfNameChanging"],
  ["materials", "slime_gel", { kind: "material", key: "slime_gel" }],
  ["gemstones", "ruby-1", gemstone],
])("favorite %s cannot be listed, but can be listed after unfavoriting", async (category, key, target) => {
  player.favoriteInventoryItems = { [category]: [key] };
  const before = JSON.parse(JSON.stringify(player));
  expect(await listItem(target, 100)).toEqual({
    ok: false, message: "Unfavorite that item in your inventory before selling it.",
  });
  expect(player).toEqual(before);
  expect(setPlayer).not.toHaveBeenCalled();
  expect(commitPlayerChange).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
  player.favoriteInventoryItems[category] = [];
  expect(await listItem(target, 100)).toMatchObject({ ok: true });
});

test.each(Object.keys(CONSUMABLES))("selling %s preserves its listing type and removes only one", async (key) => {
  player.consumables = { [key]: 1 };
  expect(await listItem(key, 101)).toMatchObject({ ok: true });
  expect(player.consumables).toEqual({});
  expect(player.inventory).toEqual([gear]);
  expect(update).toHaveBeenCalledWith(undefined, {
    "marketplace/listing": expect.objectContaining({
      item: { kind: "consumable", key, name: CONSUMABLES[key].name },
    }),
  });
});

test("listing failure is reported without a second compensating transfer", async () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  update.mockRejectedValueOnce(new Error("offline"));
  expect(await listItem("elixirOfNameChanging", 101)).toMatchObject({ ok: false });
  expect(update).toHaveBeenCalledTimes(1);
  expect(player.inventory).toEqual([gear]);
  warn.mockRestore();
});

test("cancelling a consumable listing restores the consumable count", async () => {
  expect(await cancelListing(listing())).toMatchObject({ ok: true });
  expect(player.consumables.elixirOfNameChanging).toBe(3);
  expect(player.inventory).toEqual([gear]);
  expect(update).toHaveBeenCalledWith(undefined, { "marketplace/listing": null });
});

test("materials can be listed in selected stacks and restored when a listing is cancelled", async () => {
  expect(await listItem({ kind: "material", key: "slime_gel" }, 101, 0, 3)).toMatchObject({ ok: true });
  expect(player.materials).toEqual({ slime_gel: 2 });
  expect(update).toHaveBeenCalledWith(undefined, {
    "marketplace/listing": expect.objectContaining({ item: material, price: 101 }),
  });

  get.mockResolvedValue({ val: () => listing(material) });
  expect(await cancelListing(listing(material))).toMatchObject({ ok: true });
  expect(player.materials).toEqual({ slime_gel: 5 });
});

test("gemstones can be listed and restored with their exact stats", async () => {
  expect(await listItem(gemstone, 250, 0)).toMatchObject({ ok: true });
  expect(player.gemstones).toEqual([]);
  get.mockResolvedValue({ val: () => listing(gemstone) });
  expect(await cancelListing(listing(gemstone))).toMatchObject({ ok: true });
  expect(player.gemstones).toEqual([gemstone]);
});

test.each([0, 1, 2, 3, 4])("generated gemstones can be listed and cancelled (minimum rarity %s)", async (minRarity) => {
  const owned = generateRandomGemstone(minRarity);
  expect(owned.kind).toBeUndefined();
  player.gemstones = [owned, gemstone];
  expect(await listItem({ ...owned, kind: "gemstone" }, 250)).toMatchObject({ ok: true });
  const listed = { ...owned, kind: "gemstone" };
  expect(update).toHaveBeenCalledWith(undefined, {
    "marketplace/listing": expect.objectContaining({ item: listed }),
  });
  expect(player.gemstones).toEqual([gemstone]);
  expect(owned.kind).toBeUndefined();

  get.mockResolvedValue({ val: () => listing(listed) });
  expect(await cancelListing(listing(listed))).toMatchObject({ ok: true });
  expect(player.gemstones).toEqual([gemstone, listed]);
});

test("purchases atomically mail a consumable and the taxed seller payout", async () => {
  auth.currentUser.uid = "buyer";
  expect(await buyListing(listing())).toMatchObject({ ok: true });
  expect(update).toHaveBeenCalledWith(undefined, expect.objectContaining({
    "marketplace/listing": null,
    "inbox/buyer/market-listing": expect.objectContaining({
      attachments: { consumables: { elixirOfNameChanging: 1 } },
    }),
    "inbox/seller/market-sale-listing": expect.objectContaining({ attachments: { astra: 90 } }),
  }));
  expect(player.astra).toBe(899);
});

test.each([
  [material, { materials: { slime_gel: 3 } }],
  [gemstone, { gemstoneItems: [gemstone] }],
])("material and gemstone purchases deliver the exact attachment", async (item, attachment) => {
  auth.currentUser.uid = "buyer";
  get.mockResolvedValue({ val: () => listing(item) });
  await buyListing(listing(item));
  expect(update).toHaveBeenCalledWith(undefined, expect.objectContaining({
    [`inbox/buyer/market-${listing().id}`]: expect.objectContaining({ attachments: attachment }),
  }));
});

test("gear purchases retain their exact gear attachment format", async () => {
  auth.currentUser.uid = "buyer";
  await buyListing(listing(gear));
  expect(update).toHaveBeenCalledWith(undefined, expect.objectContaining({
    "inbox/buyer/market-listing": expect.objectContaining({ attachments: { items: [gear] } }),
  }));
});

test("type filters distinguish consumables and gear, including usable consumables", () => {
  const rows = [listing(), { ...listing(gear), id: "gear" }];
  expect(filterListings(rows, DEFAULT_FILTERS)).toHaveLength(2);
  expect(filterListings(rows, { ...DEFAULT_FILTERS, kind: "consumable", usable: true }, 1)).toEqual([rows[0]]);
  expect(filterListings(rows, { ...DEFAULT_FILTERS, kind: "gear" })).toEqual([rows[1]]);
  expect(sortListings(rows, "gearScoreDesc")).toHaveLength(2);
});

test("material and gemstone filters include tier, stat, and quantity-aware sorting", () => {
  const rows = [
    listing({ ...material, count: 1 }),
    { ...listing({ ...material, count: 4 }), id: "stack" },
    { ...listing(gemstone), id: "gemstone" },
  ];
  expect(filterListings(rows, { ...DEFAULT_FILTERS, kind: "material", tier: "common" })).toHaveLength(2);
  expect(filterListings(rows, { ...DEFAULT_FILTERS, kind: "gemstone", stat: "strength", minStat: "3" })).toEqual([rows[2]]);
  expect(sortListings(rows.slice(0, 2), "quantityDesc")[0].item.count).toBe(4);
});

test("missing consumables, invalid prices, and signed-out listings are rejected", async () => {
  player.consumables = {};
  expect(await listItem("elixirOfNameChanging", 101)).toMatchObject({ ok: false });
  expect(await listItem(0, 1.5)).toMatchObject({ ok: false });
  auth.currentUser = null;
  expect(await listItem(0, 10)).toMatchObject({ ok: false });
  expect(update).not.toHaveBeenCalled();
});
