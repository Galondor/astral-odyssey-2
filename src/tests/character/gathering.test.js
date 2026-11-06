import { addGatheringExp, getGathering, getGatheringExpNeeded, getGatheringRates, getGatheringTier } from "../../character/gathering";

test("old saves default to level one and gathering caps at fifty", () => {
  expect(getGathering({}, "mining")).toEqual({ level: 1, exp: 0, attempts: 0 });
  const result = addGatheringExp({ gathering: { logging: { level: 4 } } }, "mining", 10000000);
  expect(result.gathering.mining).toEqual({ level: 50, exp: 0, attempts: 1 });
  expect(result.gathering.logging).toEqual({ level: 4 });
  expect(getGatheringExpNeeded(50)).toBe(Infinity);
});

test("granted gathering experience does not count as an attempt", () => {
  const result = addGatheringExp({ gathering: { mining: { attempts: 4 } } }, "mining", 200, { countAttempt: false });
  expect(result.gathering.mining).toEqual({ level: 2, exp: 68, attempts: 4 });
});

test("acquisition power has seven exact tier boundaries and progressive milestones", () => {
  [1, 8, 15, 22, 29, 36, 43].forEach((power, index) => {
    expect(getGatheringTier(power)).toBe(index + 1);
    if (power > 1) expect(getGatheringTier(power - 1)).toBe(index);
  });
  expect(getGatheringTier(999)).toBe(7);
  expect(getGatheringRates(9).bonusHarvest).toBe(0);
  expect(getGatheringRates(10).bonusHarvest).toBe(0.2);
  expect(getGatheringRates(20).perfect).toBe(0.2);
  expect(getGatheringRates(30).comboRoll).toBe(true);
  expect(getGatheringRates(40).rarity).toBeGreaterThan(0);
  expect(getGatheringRates(50).yield).toBeGreaterThan(getGatheringRates(49).yield);
});
