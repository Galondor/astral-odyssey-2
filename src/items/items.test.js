import { getPlayer } from "../character/player";
import { generateRandomItem, itemTooltip } from "./items";

jest.mock("../character/player", () => ({ getPlayer: jest.fn() }));

beforeEach(() => {
  getPlayer.mockReturnValue({ level: 1 });
});

test.each([
  [0, 0],
  [7, 2],
  [10, 3],
  [22, 7],
])("main stat value %i displays its tier on the absolute 0–22 scale", (value, tier) => {
  const tooltip = itemTooltip({
    name: "Test item",
    slot: "weapon",
    rarity: "Common",
    iLevel: 1,
    price: 1,
    mainStat: { stat: "strength", value, tier: 0 },
  });

  expect(tooltip.stats[0].tier).toBe(`T${tier}`);
});

test.each(["weapon", "helmet"])("%s can roll Power as a substat", (slot) => {
  jest.spyOn(Math, "random").mockReturnValue(0);
  const item = generateRandomItem(slot);
  Math.random.mockRestore();

  expect(item.subStats.maxPower).toBeGreaterThan(0);
  expect(itemTooltip(item).stats).toContainEqual(
    expect.objectContaining({ label: "Power", value: `+${item.subStats.maxPower}` }),
  );
});

test("substat tiers increase with displayed rolls for the same stat and item type", () => {
  let seed = 12345;
  jest.spyOn(Math, "random").mockImplementation(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  });

  const rollsByItemType = new Map();
  for (let i = 0; i < 1200; i++) {
    const item = generateRandomItem("weapon");
    for (const [stat, value] of Object.entries(item.subStats)) {
      const itemType = [
        stat,
        item.rarity,
        item.iLevel,
        item.twoHanded,
      ].join(":");
      const rolls = rollsByItemType.get(itemType) || [];
      rolls.push({ value, tier: item.subTiers[stat] });
      rollsByItemType.set(itemType, rolls);
    }
  }
  Math.random.mockRestore();

  for (const rolls of rollsByItemType.values()) {
    rolls.sort((a, b) => a.value - b.value);
    for (let i = 1; i < rolls.length; i++) {
      expect(rolls[i].tier).toBeGreaterThanOrEqual(rolls[i - 1].tier);
    }
  }
});
