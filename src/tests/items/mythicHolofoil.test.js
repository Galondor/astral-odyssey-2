import { getPlayer } from "../../character/player";
import {
  applyHolofoilBonuses, createCraftedItem, createCustomItem, createItem, createMythicItem,
  createUniqueItem, generateRandomSlotItem, ITEMS, itemTooltip, migrateHolofoilItems,
} from "../../items/items";
import {
  getHolofoilStyle, HOLOFOIL_EFFECTS, MYTHIC_HOLOFOIL_EFFECTS,
  MYTHIC_HOLOFOIL_PALETTES, normalizeHolofoilEffect, rollHolofoil,
} from "../../items/holofoil";
import { createToolItem } from "../../items/tools";
import { UNIQUES } from "../../world/dungeonData";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn() }));
beforeEach(() => getPlayer.mockReturnValue({ level: 50 }));
afterEach(() => jest.restoreAllMocks());

const colors = ["#123456", "#abcdef"];
const decodeImage = (style) => decodeURIComponent(style.match(/data:image\/svg\+xml,([^"]+)/)[1]);

test("the Mythic pool contains exactly the five requested effects and is disjoint from ordinary foils", () => {
  expect(MYTHIC_HOLOFOIL_EFFECTS).toEqual([
    "event-horizon", "astral-orrery", "runic-circuit", "phoenix-gilding", "meteor-script",
  ]);
  expect(HOLOFOIL_EFFECTS.filter(effect => MYTHIC_HOLOFOIL_EFFECTS.includes(effect))).toEqual([]);
});

test.each(MYTHIC_HOLOFOIL_EFFECTS)("Mythics can roll all three persisted colorways for %s", effect => {
  const index = MYTHIC_HOLOFOIL_EFFECTS.indexOf(effect);
  const random = jest.spyOn(Math, "random");
  for (let variant = 0; variant < 3; variant++) {
    random.mockReturnValueOnce((index + .5) / 5).mockReturnValueOnce((variant + .5) / 3);
    const result = rollHolofoil(undefined, "Mythic");
    expect(result).toEqual({ holofoilEffect: effect, holofoil: MYTHIC_HOLOFOIL_PALETTES[effect][variant] });
    expect(result.holofoil).not.toBe(MYTHIC_HOLOFOIL_PALETTES[effect][variant]);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  }
});

test.each(["Common", "Uncommon", "Rare", "Epic", "Legendary", "Unique", "Artifact", undefined])(
  "%s cannot roll a Mythic effect, even on forced/custom-color foils", rarity => {
    const random = jest.spyOn(Math, "random");
    HOLOFOIL_EFFECTS.forEach((effect, index) => {
      random.mockReturnValue((index + .5) / HOLOFOIL_EFFECTS.length);
      expect(rollHolofoil(colors, rarity)).toEqual({ holofoil: colors, holofoilEffect: effect });
      expect(HOLOFOIL_EFFECTS).toContain(rollHolofoil(true, rarity).holofoilEffect);
      expect(rollHolofoil(undefined, rarity)).toEqual({});
    });
  },
);

test.each([0, .199999, .2, .399999, .4, .599999, .6, .799999, .8, .999999])(
  "Mythic effect boundaries and guaranteed foils are exact (%s)", value => {
    jest.spyOn(Math, "random").mockReturnValue(value);
    const result = rollHolofoil(undefined, "Mythic");
    expect(result.holofoilEffect).toBe(MYTHIC_HOLOFOIL_EFFECTS[Math.floor(value * 5)]);
    expect(result.holofoil).toHaveLength(2);
    expect(rollHolofoil(colors, "Mythic").holofoil).toEqual(colors);
    expect(() => rollHolofoil(["invalid", "#ffffff"], "Mythic")).toThrow(/hex codes/);
  },
);

test("every gear creation path uses the rarity-specific pool", () => {
  jest.spyOn(Math, "random").mockReturnValue(.5);
  const unique = Object.values(UNIQUES)[0];
  const spec = { slot: "weapon", baseName: "Sword", stat: "strength", rarity: "Mythic", condition: "Perfect", iLevel: 50 };
  ITEMS.testMythicFoil = { ...spec, name: "Template Mythic", mainStat: {}, subStats: {} };
  try {
    const mythics = [
      createMythicItem(spec),
      createMythicItem({ unique, iLevel: 50 }),
      createCraftedItem(spec),
      generateRandomSlotItem(0, 0, { rarity: "Mythic" }),
      createItem("testMythicFoil"),
      createCustomItem({ ...spec, name: "Admin Mythic", price: 500, mainStat: { stat: "strength", tier: 7 } }),
    ];
    for (const item of mythics) {
      expect(item.rarity).toBe("Mythic");
      expect(MYTHIC_HOLOFOIL_EFFECTS).toContain(item.holofoilEffect);
      expect(itemTooltip(item).backgroundStyle).toEqual(getHolofoilStyle(item));
    }
    for (const item of [
      createUniqueItem(unique, 50, true),
      createCraftedItem({ ...spec, rarity: "Legendary", holofoil: true }),
      createToolItem({ slot: "hammer", rarity: "Legendary", holofoil: true }),
    ]) expect(HOLOFOIL_EFFECTS).toContain(item.holofoilEffect);
  } finally {
    delete ITEMS.testMythicFoil;
  }
});

test.each(MYTHIC_HOLOFOIL_EFFECTS)("%s has valid animated artwork, static artwork and distinct palette variants", effect => {
  const backgrounds = new Set();
  for (const palette of MYTHIC_HOLOFOIL_PALETTES[effect]) {
    const style = getHolofoilStyle({ rarity: "Mythic", holofoil: palette, holofoilEffect: effect });
    const animated = decodeImage(style.backgroundImage);
    const still = decodeImage(style["--holofoil-mythic-still"]);
    for (const svg of [animated, still]) {
      expect(new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("parsererror")).toBeNull();
      expect(svg).toContain(palette[0]);
      expect(svg).toContain(palette[1]);
    }
    expect(animated).toMatch(/<animate(?:Transform|Motion)? /);
    expect(still).not.toContain("<animate");
    expect(style.backgroundSize).toBe("100% 100%");
    backgrounds.add(style.backgroundImage);
  }
  expect(backgrounds.size).toBe(3);
});

test("Event Horizon spins more slowly than the concept's roughly four-second orbit", () => {
  const style = getHolofoilStyle({ rarity: "Mythic", holofoil: colors, holofoilEffect: "event-horizon" });
  const durations = [...decodeImage(style.backgroundImage).matchAll(/dur="([\d.]+)s"/g)].map(match => Number(match[1]));
  expect(durations.length).toBeGreaterThan(0);
  expect(Math.min(...durations)).toBeGreaterThanOrEqual(14);
});

test("legacy and cross-pool effects normalize deterministically without changing other data", () => {
  const legacy = {
    id: "legacy-mythic", rarity: "Mythic", holofoil: colors, holofoilEffect: "nebula",
    holofoilBonusVersion: 1, price: 1000, mainStat: { stat: "strength", value: 22 },
    subStats: { speed: 77 }, mythicSubStat: { stat: "speed", value: 20, tier: 7 },
  };
  const result = normalizeHolofoilEffect(legacy);
  expect(MYTHIC_HOLOFOIL_EFFECTS).toContain(result.holofoilEffect);
  expect(result).toEqual({ ...legacy, holofoilEffect: result.holofoilEffect });
  expect(normalizeHolofoilEffect(result)).toBe(result);
  expect(normalizeHolofoilEffect(JSON.parse(JSON.stringify(legacy)))).toEqual(result);
  expect(applyHolofoilBonuses(legacy)).toEqual(result);
  expect(getHolofoilStyle(legacy)).toEqual(getHolofoilStyle(result));
  const ordinary = { ...legacy, rarity: "Rare", holofoilEffect: result.holofoilEffect };
  expect(normalizeHolofoilEffect(ordinary)).toEqual({ ...ordinary, holofoilEffect: "aurora" });
  expect(getHolofoilStyle(ordinary)).not.toHaveProperty("--holofoil-mythic-still");
  expect(normalizeHolofoilEffect({ ...legacy, holofoil: undefined }).holofoil).toBeUndefined();
  const placeholder = { ...legacy, twoHandedOf: "mainHand" };
  expect(normalizeHolofoilEffect(placeholder)).toBe(placeholder);
  expect(normalizeHolofoilEffect(null)).toBeNull();
});

test("ownership migration persists Mythic effects once for inventory, equipment, trader and buyback", () => {
  const legacy = { id: "owned", rarity: "Mythic", holofoil: colors, holofoilBonusVersion: 1, price: 1000 };
  const player = {
    inventory: [legacy], equipment: { mainHand: legacy },
    gearTraderStock: { items: [legacy] }, gearTraderBuyback: [{ item: legacy }],
  };
  const migrated = migrateHolofoilItems(player);
  for (const item of [
    migrated.inventory[0], migrated.equipment.mainHand,
    migrated.gearTraderStock.items[0], migrated.gearTraderBuyback[0].item,
  ]) {
    expect(MYTHIC_HOLOFOIL_EFFECTS).toContain(item.holofoilEffect);
    expect(item.price).toBe(1000);
    expect(item.holofoil).toEqual(colors);
  }
  expect(migrateHolofoilItems(migrated)).toBe(migrated);
});
