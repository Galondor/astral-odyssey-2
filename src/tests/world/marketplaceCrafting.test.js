import { get, update } from "firebase/database";
import { commitPlayerChange, getCharacterIdentity, getPlayer, setPlayer } from "../../character/player";
import { auth } from "../../firebase";
import { createMythicItem } from "../../items/items";
import { MATERIALS } from "../../items/materials";
import { createToolItem } from "../../items/tools";
import { DEFAULT_FILTERS, buyListing, cancelListing, filterListings, listItem } from "../../world/marketplace";
import { normalizeAttachments } from "../../world/inbox";

jest.mock("../../firebase", () => ({ db: {}, auth: { currentUser: { uid: "seller" } } }));
jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(), setPlayer: jest.fn(), commitPlayerChange: jest.fn(),
  getCharacterIdentity: jest.fn(),
}));
jest.mock("../../combat/combat", () => ({ getEnemy: () => null }));
jest.mock("firebase/database", () => ({
  ref: (_, path) => path, push: () => ({ key: "listing" }),
  get: jest.fn(), update: jest.fn(), onValue: jest.fn(),
}));

let player;
const hammer = createToolItem({ slot: "hammer", iLevel: 30, rarity: "Epic", condition: "Pristine", holofoil: ["#123456", "#abcdef"] });
const mythic = createMythicItem({ slot: "ring", iLevel: 60 });
const listing = (item) => ({ id: "listing", sellerUid: "seller", sellerName: "Seller", item, price: 5000, listedAt: 1 });
const roundTrip = (value) => JSON.parse(JSON.stringify(value));

beforeEach(() => {
  jest.clearAllMocks();
  getCharacterIdentity.mockReturnValue(null);
  auth.currentUser = { uid: "seller" };
  player = {
    name: "Seller", level: 25, astra: 100000, inventory: [hammer, mythic],
    materials: { warsteel_ingot: 10, mythos_fragment: 2, hammerhead_iii: 1, quicksilver: 4 },
    professions: { weaponry: { level: 10 }, armor: { level: 35 }, jewelry: { level: 5 } },
  };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
  update.mockResolvedValue();
  commitPlayerChange.mockImplementation(async (change) => update(undefined, change()));
});

test.each(["warsteel_ingot", "mythos_fragment", "hammerhead_iii", "quicksilver"])("new crafting material %s can be listed, cancelled, and bought", async (key) => {
  const before = player.materials[key];
  expect(await listItem({ kind: "material", key }, 100, 0, 1)).toMatchObject({ ok: true });
  expect(player.materials[key] || 0).toBe(before - 1);
  const stored = update.mock.calls[0][1]["marketplace/listing"];
  expect(stored.item).toEqual({ kind: "material", key, name: MATERIALS[key].name, tier: MATERIALS[key].tier, count: 1 });
  get.mockResolvedValue({ val: () => stored });
  expect(await cancelListing({ id: "listing", ...stored })).toMatchObject({ ok: true });
  expect(player.materials[key]).toBe(before);
  auth.currentUser = { uid: "buyer" };
  await buyListing(listing(stored.item));
  expect(update.mock.calls.at(-1)[1]["inbox/buyer/market-listing"].attachments).toEqual({ materials: { [key]: 1 } });
});

test.each([["Hammer", hammer], ["Mythic gear", mythic]])("%s can be listed, cancelled, and bought without losing stats", async (_, item) => {
  const index = player.inventory.indexOf(item);
  expect(await listItem(index, 5000)).toMatchObject({ ok: true });
  const stored = update.mock.calls[0][1]["marketplace/listing"];
  expect(stored.item).toMatchObject({ slot: item.slot, subStats: item.subStats, mainStat: item.mainStat });
  get.mockResolvedValue({ val: () => stored });
  expect(await cancelListing({ id: "listing", ...stored })).toMatchObject({ ok: true });
  const returned = player.inventory.at(-1);
  expect(returned).toMatchObject({ id: item.id, subStats: item.subStats, price: item.price });
  if (item.mythicSubStat) expect(returned.mythicSubStat).toEqual(item.mythicSubStat);
  if (item.slot === "hammer") expect(returned.socketCount).toBe(0);

  auth.currentUser = { uid: "buyer" };
  await buyListing(listing(stored.item));
  const mail = update.mock.calls.at(-1)[1]["inbox/buyer/market-listing"];
  const [delivered] = normalizeAttachments(roundTrip(mail.attachments)).items;
  expect(delivered.subStats).toEqual(item.subStats);
  if (item.mythicSubStat) expect(delivered.mythicSubStat).toEqual(item.mythicSubStat);
});

test("the usable filter checks tool requirements against professions", () => {
  const rows = [listing(hammer), listing(createToolItem({ slot: "precisionTools", iLevel: 30 }))];
  expect(filterListings(rows, { ...DEFAULT_FILTERS, usable: true }, 25, player)).toEqual([rows[0]]);
  expect(filterListings(rows, { ...DEFAULT_FILTERS, slot: "precisionTools" }, 25, player)).toEqual([rows[1]]);
  expect(filterListings(rows, { ...DEFAULT_FILTERS, query: "blacksmith craft quality" }, 25, player)
    .every((row) => row.item.slot === "hammer")).toBe(true);
  expect(filterListings(rows, { ...DEFAULT_FILTERS, query: "blacksmith" }, 25, player)).toEqual([rows[0]]);
});
