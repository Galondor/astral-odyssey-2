import { getEnemyStatusResistance, getRandomEnemy } from "../../combat/enemies";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));

test.each([["basic", 0.05, 0.1], ["elite", 0.15, 0.3], ["boss", 0.35, 0.65]])(
  "%s resistance scales within %s-%s with content difficulty",
  (tier, min, max) => {
    expect(getEnemyStatusResistance(tier, "travel")).toBe(min);
    expect(getEnemyStatusResistance(tier, "worldBoss")).toBe(max);
    const dungeon = getEnemyStatusResistance(tier, "dungeon");
    expect(dungeon).toBeGreaterThan(min);
    expect(dungeon).toBeLessThan(max);
    for (const content of ["travel", "dungeon", "group", "labyrinth", "colosseum"]) {
      expect(getEnemyStatusResistance(tier, content, -10)).toBeGreaterThanOrEqual(min);
      expect(getEnemyStatusResistance(tier, content, 10)).toBe(max);
      expect(getEnemyStatusResistance(tier, content, 0.5)).toBeGreaterThan(getEnemyStatusResistance(tier, content, 0));
    }
  },
);

test("low-level travel basics have 5% resistance and dungeon basics have 8%", () => {
  const random = jest.spyOn(Math, "random").mockReturnValue(0);
  expect(getRandomEnemy("basic", "Meadowlands", 1, 0, "greenSlime").statusResistance).toBe(0.05);
  random.mockRestore();
  expect(getEnemyStatusResistance("basic", "dungeon")).toBe(0.08);
});
