import { getPlayer } from "../../character/player";
import {
  ITEMS, GEAR_SLOT_TYPES, SUBSTAT_NAMES, applyHolofoilBonuses, createCustomItem,
  createItem, createUniqueItem, generateRandomGemstone, generateRandomItem,
  generateRandomSlotItem, getSellPrice, getSubStatTier, itemTooltip, migrateHolofoilItems,
} from "../../items/items";
import { getHolofoilStyle, HOLOFOIL_EFFECTS, rollHolofoil } from "../../items/holofoil";
import { UNIQUES } from "../../world/dungeonData";
import { getItemSocketCount } from "../../items/sockets";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn() }));

beforeEach(() => getPlayer.mockReturnValue({ level: 1 }));
afterEach(() => jest.restoreAllMocks());

test.each([0, 0.009999, 0.01, 0.5, 0.999999])("the independent holofoil roll has an exact 1%% threshold (%s)", (roll) => {
  jest.spyOn(Math, "random").mockReturnValue(roll);
  const result = rollHolofoil();
  if (roll < 0.01) {
    expect(result.holofoil).toHaveLength(2);
    result.holofoil.forEach((color) => expect(color).toMatch(/^#[0-9a-f]{6}$/));
    expect(HOLOFOIL_EFFECTS).toContain(result.holofoilEffect);
  } else {
    expect(result).toEqual({});
  }
});

test("forced random colors use the full RGB range", () => {
  jest.spyOn(Math, "random")
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0.99999999)
    .mockReturnValue(0.5);
  expect(rollHolofoil(true)).toEqual({
    holofoil: ["#000000", "#ffffff"],
    holofoilEffect: HOLOFOIL_EFFECTS[Math.floor(0.5 * HOLOFOIL_EFFECTS.length)],
  });
});

test("custom colors are copied, an effect is rolled, and invalid colors are rejected", () => {
  jest.spyOn(Math, "random").mockReturnValue(0);
  const colors = ["#ABCDEF", "#123456"];
  expect(rollHolofoil(colors)).toEqual({ holofoil: colors, holofoilEffect: HOLOFOIL_EFFECTS[0] });
  expect(rollHolofoil(colors).holofoil).not.toBe(colors);
  expect(rollHolofoil(colors).holofoilEffect).toBe(HOLOFOIL_EFFECTS[0]);
  expect(() => rollHolofoil(["red", "#123456"])).toThrow(/hex codes/);
});

test("all equipment generators roll holofoil, while gemstones do not", () => {
  jest.spyOn(Math, "random").mockReturnValue(0);
  ITEMS.testHolofoil = { name: "Test", mainStat: {}, subStats: {} };
  try {
    for (const item of [
      createItem("testHolofoil"),
      generateRandomItem("weapon"),
      generateRandomSlotItem(),
      createUniqueItem(Object.values(UNIQUES)[0]),
    ]) {
      expect(item.holofoil).toEqual(["#000000", "#000000"]);
      expect(item.holofoilEffect).toBe(HOLOFOIL_EFFECTS[0]);
    }
    expect(generateRandomGemstone()).not.toHaveProperty("holofoil");
  } finally {
    delete ITEMS.testHolofoil;
  }
});

test("gear and unique generators accept forced custom colors and tooltips expose a rolled effect", () => {
  jest.spyOn(Math, "random").mockReturnValue(0.5);
  const colors = ["#ff0000", "#0000ff"];
  for (const item of [
    generateRandomItem("helmet", 0, colors),
    createUniqueItem(Object.values(UNIQUES)[0], 1, colors),
  ]) {
    expect(item.holofoil).toEqual(colors);
    expect(item.holofoilEffect).toBe(HOLOFOIL_EFFECTS[Math.floor(0.5 * HOLOFOIL_EFFECTS.length)]);
    expect(itemTooltip(item).subtitle).toContain("Holofoil");
    expect(itemTooltip(item).backgroundStyle).toEqual(getHolofoilStyle(item));
  }
  expect(getHolofoilStyle({})).toBeUndefined();
  expect(getHolofoilStyle({ holofoil: colors })).toEqual({
    "--holofoil-background": "linear-gradient(135deg, #ff000066, #0000ff66)",
    backgroundImage: "linear-gradient(135deg, #ff000099, transparent 55%), linear-gradient(315deg, #0000ff99, transparent 55%), var(--holofoil-background)",
  });

  expect(getHolofoilStyle({ holofoil: colors, holofoilEffect: "ripple" }).backgroundImage)
    .toContain("repeating-radial-gradient");
  for (const effect of HOLOFOIL_EFFECTS) {
    expect(getHolofoilStyle({ holofoil: colors, holofoilEffect: effect }).backgroundImage)
      .toContain("var(--holofoil-background)");
  }
  for (const effect of ["aurora", "nebula", "glow", "facets"]) {
    expect(getHolofoilStyle({ holofoil: colors, holofoilEffect: `${effect}-animated` }).animation)
      .toBe(`holofoil-${effect} 8s ease-in-out infinite alternate`);
  }
  expect(getHolofoilStyle({ holofoil: colors, holofoilEffect: "aurora" })).not.toHaveProperty("animation");
  expect(getHolofoilStyle({ holofoil: ["invalid", "#ffffff"] })).toBeUndefined();
});

const colors = ["#123456", "#abcdef"];

test.each([1, 25, 100])("Holofoil stats meet T5 for every substat at level %s and either handedness", (iLevel) => {
  jest.spyOn(Math, "random").mockReturnValue(0);
  for (const twoHanded of [false, true]) {
    const original = {
      id: "foil", name: "Foil", rarity: "Rare", slot: "weapon", iLevel, twoHanded,
      price: 101, mainStat: { stat: "strength", value: 1, tier: 0 },
      subStats: Object.fromEntries(SUBSTAT_NAMES.map((stat) => [stat, 0])),
      subTiers: Object.fromEntries(SUBSTAT_NAMES.map((stat) => [stat, 0])),
      holofoil: colors,
    };
    const upgraded = applyHolofoilBonuses(original);
    expect(upgraded.mainStat.tier).toBeGreaterThanOrEqual(5);
    for (const stat of SUBSTAT_NAMES) {
      expect(getSubStatTier(stat, upgraded.subStats[stat], iLevel, twoHanded)).toBeGreaterThanOrEqual(5);
      expect(upgraded.subTiers[stat]).toBeGreaterThanOrEqual(5);
    }
    expect(upgraded.price).toBe(202);
    expect(getSellPrice(upgraded)).toBe(101);
    expect(getItemSocketCount(upgraded)).toBe(2);
    expect(original.price).toBe(101);
    expect(original.mainStat.value).toBe(1);
  }
});

test("random, fixed, Unique and admin-created Holofoils receive all gameplay bonuses", () => {
  jest.spyOn(Math, "random").mockReturnValue(0);
  getPlayer.mockReturnValue({ level: 100 });
  const generated = GEAR_SLOT_TYPES.map((slot) => generateRandomItem(slot));
  generated.push(createUniqueItem(Object.values(UNIQUES)[0], 100, colors));
  generated.push(createCustomItem({
    name: "Admin Foil", slot: "weapon", rarity: "Legendary", condition: "Broken",
    iLevel: 1, price: 500, mainStat: { stat: "strength", tier: 0 },
    subStats: { attackMin: 0, maxPower: 0, criticalDamage: 0 }, holofoil: colors,
  }));
  ITEMS.testFoilBonuses = {
    name: "Fixed Foil", rarity: "Rare", slot: "weapon", price: 100,
    mainStat: { stat: "strength", value: 2 }, subStats: { speed: 1 },
  };
  try {
    generated.push(createItem("testFoilBonuses"));
  } finally {
    delete ITEMS.testFoilBonuses;
  }
  for (const item of generated) {
    expect(item.holofoilBonusVersion).toBe(1);
    expect(item.mainStat.tier).toBeGreaterThanOrEqual(5);
    for (const [stat, value] of Object.entries(item.subStats)) {
      expect(getSubStatTier(stat, value, item.iLevel, item.twoHanded)).toBeGreaterThanOrEqual(5);
      expect(item.subTiers[stat]).toBeGreaterThanOrEqual(5);
    }
  }
  expect(generated.find((item) => item.name === "Fixed Foil").price).toBe(200);
  expect(generated.find((item) => item.name === "Admin Foil").price).toBe(1000);
});

test("upgrades preserve already-high stats and never stack value on rerolls or saved reloads", () => {
  const original = {
    name: "High Foil", rarity: "Epic", socketCount: 2, holofoil: colors, iLevel: 100,
    price: 150, mainStat: { stat: "strength", value: 22 },
    subStats: { speed: 77 }, gemstones: [{ id: "gem" }],
  };
  const upgraded = applyHolofoilBonuses(original);
  expect(upgraded.mainStat.value).toBe(22);
  expect(upgraded.subStats.speed).toBe(77);
  expect(upgraded.gemstones).toEqual(original.gemstones);
  expect(getItemSocketCount(upgraded)).toBe(3);
  expect(applyHolofoilBonuses(upgraded)).toBe(upgraded);
  const reloaded = JSON.parse(JSON.stringify(upgraded));
  expect(applyHolofoilBonuses(reloaded)).toBe(reloaded);
  expect(applyHolofoilBonuses({ ...reloaded, ...rollHolofoil(true) }).price).toBe(300);
  expect(original.price).toBe(150);
});

test("legacy migration upgrades owned gear, trader stock and buyback once without changing plain gear", () => {
  const foil = {
    id: "foil", name: "Foil", rarity: "Rare", slot: "weapon", iLevel: 1,
    price: 100, mainStat: { stat: "strength", value: 1 }, holofoil: colors,
  };
  const plain = { ...foil, id: "plain", holofoil: undefined };
  const player = {
    baseStats: { strength: 2, dexterity: 2, intelligence: 2 },
    inventory: [plain, foil], equipment: { mainHand: foil, offHand: { twoHandedOf: "mainHand" } },
    gearTraderStock: { hour: 123, items: [foil, plain] },
    gearTraderBuyback: [{ item: foil, price: 100 }],
  };
  const migrated = migrateHolofoilItems(player);
  expect(migrated.inventory[0]).toBe(plain);
  expect(migrated.inventory[1].price).toBe(200);
  expect(migrated.equipment.mainHand.price).toBe(200);
  expect(migrated.gearTraderStock.items[0].price).toBe(200);
  expect(migrated.gearTraderBuyback[0].item.price).toBe(200);
  expect(migrateHolofoilItems(migrated)).toBe(migrated);
  expect(player.inventory[1].price).toBe(100);
  expect(applyHolofoilBonuses(plain)).toBe(plain);
});

test("Holofoil upgrades reject values that cannot be safely doubled", () => {
  for (const price of [-1, 1.5, Number.MAX_SAFE_INTEGER]) {
    expect(() => applyHolofoilBonuses({ holofoil: colors, price })).toThrow(/value/);
  }
});
