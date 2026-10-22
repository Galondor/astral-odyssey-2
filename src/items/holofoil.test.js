import { getPlayer } from "../character/player";
import { ITEMS, createItem, createUniqueItem, generateRandomGemstone, generateRandomItem, generateRandomSlotItem, itemTooltip } from "./items";
import { getHolofoilStyle, rollHolofoil } from "./holofoil";
import { UNIQUES } from "../world/dungeonData";

jest.mock("../character/player", () => ({ getPlayer: jest.fn() }));

beforeEach(() => getPlayer.mockReturnValue({ level: 1 }));
afterEach(() => jest.restoreAllMocks());

test.each([0, 0.009999, 0.01, 0.5, 0.999999])("the independent holofoil roll has an exact 1%% threshold (%s)", (roll) => {
  jest.spyOn(Math, "random").mockReturnValue(roll);
  const result = rollHolofoil();
  if (roll < 0.01) {
    expect(result.holofoil).toHaveLength(2);
    result.holofoil.forEach((color) => expect(color).toMatch(/^#[0-9a-f]{6}$/));
  } else {
    expect(result).toEqual({});
  }
});

test("forced random colors use the full RGB range", () => {
  jest.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.99999999);
  expect(rollHolofoil(true)).toEqual({ holofoil: ["#000000", "#ffffff"] });
});

test("custom colors are copied without consuming randomness and invalid colors are rejected", () => {
  const random = jest.spyOn(Math, "random");
  const colors = ["#ABCDEF", "#123456"];
  expect(rollHolofoil(colors)).toEqual({ holofoil: colors });
  expect(rollHolofoil(colors).holofoil).not.toBe(colors);
  expect(random).not.toHaveBeenCalled();
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
    }
    expect(generateRandomGemstone()).not.toHaveProperty("holofoil");
  } finally {
    delete ITEMS.testHolofoil;
  }
});

test("gear and unique generators accept forced custom colors and tooltips expose the gradient", () => {
  jest.spyOn(Math, "random").mockReturnValue(0.5);
  const colors = ["#ff0000", "#0000ff"];
  for (const item of [
    generateRandomItem("helmet", 0, colors),
    createUniqueItem(Object.values(UNIQUES)[0], 1, colors),
  ]) {
    expect(item.holofoil).toEqual(colors);
    expect(itemTooltip(item).subtitle).toContain("Holofoil");
    expect(itemTooltip(item).backgroundStyle).toEqual(getHolofoilStyle(item));
  }
  expect(getHolofoilStyle({})).toBeUndefined();
  expect(getHolofoilStyle({ holofoil: colors })).toEqual({
    "--holofoil-background": "linear-gradient(135deg, #ff000066, #0000ff66)",
    backgroundImage: "var(--holofoil-background)",
  });
  expect(getHolofoilStyle({ holofoil: ["invalid", "#ffffff"] })).toBeUndefined();
});
