import { get, update } from "firebase/database";
import { commitPlayerChange, getPlayer, setPlayer } from "../character/player";
import { auth } from "../firebase";
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
const listing = (item = elixir) => ({
  id: "listing", sellerUid: "seller", sellerName: "Seller", item, price: 101, listedAt: 1,
});

beforeEach(() => {
  jest.clearAllMocks();
  auth.currentUser = { uid: "seller" };
  player = { name: "Seller", level: 25, astra: 1000, consumables: { elixirOfNameChanging: 2 }, inventory: [gear] };
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

test("missing consumables, invalid prices, and signed-out listings are rejected", async () => {
  player.consumables = {};
  expect(await listItem("elixirOfNameChanging", 101)).toMatchObject({ ok: false });
  expect(await listItem(0, 1.5)).toMatchObject({ ok: false });
  auth.currentUser = null;
  expect(await listItem(0, 10)).toMatchObject({ ok: false });
  expect(update).not.toHaveBeenCalled();
});
