import { getPlayer } from "../../character/player";
import { ITEMS, createItem, createUniqueItem, generateRandomGemstone, generateRandomItem, generateRandomSlotItem, itemTooltip } from "../../items/items";
import { getHolofoilStyle, HOLOFOIL_EFFECTS, rollHolofoil } from "../../items/holofoil";
import { UNIQUES } from "../../world/dungeonData";

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
