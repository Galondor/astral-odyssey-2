import {
  calculateStats,
  expForLevel,
  gainExp,
  migratePowerProgression,
} from "./stats";

const makePlayer = (overrides = {}) => ({
  level: 1,
  baseStats: { strength: 1, dexterity: 1, intelligence: 1 },
  equipment: {},
  stats: { health: 95, stamina: 8, power: 5, exp: 0 },
  ...overrides,
});

test("intelligence adds two magic attack per point and does not increase max power", () => {
  const stats = calculateStats(makePlayer({
    baseStats: { strength: 1, dexterity: 1, intelligence: 10 },
  }));

  expect(stats.magicAttackMin).toBe(21);
  expect(stats.magicAttackMax).toBe(25);
  expect(stats.maxPower).toBe(5);
});

test("existing level power bonuses migrate without losing permanent upgrades", () => {
  const existing = makePlayer({
    level: 8,
    baseStats: { strength: 1, dexterity: 1, intelligence: 25 },
    bonusStats: { maxPower: 10 },
  });
  const migrated = migratePowerProgression(existing);
  const stats = calculateStats(migrated);

  expect(migrated).toMatchObject({
    powerLevelVersion: 1,
    bonusStats: { maxPower: 3 },
  });
  expect(stats.maxPower).toBe(15);
});

test("equipped Power substats increase maximum power", () => {
  const stats = calculateStats(makePlayer({
    equipment: {
      necklace: { name: "Power Pendant", subStats: { maxPower: 3 } },
    },
  }));

  expect(stats.maxPower).toBe(8);
});

test("each gained level adds one max power and restores one current power", () => {
  const player = makePlayer({
    stats: { health: 95, stamina: 8, power: 5, exp: expForLevel(1) - 1 },
  });
  const { patch } = gainExp(player, 1);

  expect(patch.level).toBe(2);
  expect(patch.stats.maxPower).toBe(6);
  expect(patch.stats.power).toBe(6);
  expect(patch.bonusStats.maxPower).toBeUndefined();
});
