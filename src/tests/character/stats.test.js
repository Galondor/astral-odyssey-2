import {
  calculateStats,
  expForLevel,
  gainExp,
  migratePowerProgression,
} from "../../character/stats";

const makePlayer = (overrides = {}) => ({
  level: 1,
  baseStats: { strength: 1, dexterity: 1, intelligence: 1 },
  equipment: {},
  stats: { health: 95, stamina: 8, power: 5, exp: 0 },
  ...overrides,
});

test("intelligence adds one magic attack per point and does not increase max power", () => {
  const stats = calculateStats(makePlayer({
    baseStats: { strength: 1, dexterity: 1, intelligence: 10 },
  }));

  expect(stats.magicAttackMin).toBe(11);
  expect(stats.magicAttackMax).toBe(15);
  expect(stats.maxPower).toBe(5);
});

test("vitality adds five max health for every two points", () => {
  const belowThreshold = calculateStats(makePlayer({
    bonusStats: { vitality: 1 },
  }));
  const atThreshold = calculateStats(makePlayer({
    bonusStats: { vitality: 2 },
  }));

  expect(belowThreshold.vitality).toBe(2);
  expect(belowThreshold.maxHealth).toBe(95);
  expect(atThreshold.vitality).toBe(3);
  expect(atThreshold.maxHealth).toBe(95);
  expect(calculateStats(makePlayer({
    bonusStats: { vitality: 3 },
  })).maxHealth).toBe(100);
});

test("percent attack substats increase only their matching attack damage", () => {
  const stats = calculateStats(makePlayer({
    baseStats: { strength: 2, dexterity: 3, intelligence: 4 },
    equipment: {
      weapon: { name: "Balanced weapon", subStats: { attackPercent: 0.25, magicAttackPercent: 0.5 } },
    },
  }));

  expect(stats.attackMin).toBe(8);
  expect(stats.attackMax).toBe(13);
  expect(stats.magicAttackMin).toBe(8);
  expect(stats.magicAttackMax).toBe(14);
  expect(stats.attackPercent).toBe(0.25);
  expect(stats.magicAttackPercent).toBe(0.5);
});

test("agility adds one percent evasion per eight points", () => {
  const atEightAgility = calculateStats(makePlayer({
    baseStats: { strength: 1, dexterity: 14, intelligence: 1 },
  }));
  const atSixteenAgility = calculateStats(makePlayer({
    baseStats: { strength: 1, dexterity: 30, intelligence: 1 },
  }));

  expect(atEightAgility.agility).toBe(8);
  expect(atEightAgility.evasion).toBe(0.02);
  expect(atSixteenAgility.agility).toBe(16);
  expect(atSixteenAgility.evasion).toBe(0.03);
});

test("evasion and critical chance are capped at 60 percent", () => {
  const stats = calculateStats(makePlayer({
    baseStats: { strength: 1, dexterity: 1000, intelligence: 1 },
    equipment: {
      charm: { name: "Lucky Charm", subStats: { evasion: 0.5, criticalHitChance: 0.5 } },
    },
    bonusStats: { evasion: 0.5, criticalHitChance: 0.5 },
  }));

  expect(stats.evasion).toBe(0.6);
  expect(stats.criticalHitChance).toBe(0.6);
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
  expect(stats.maxPower).toBe(12);
});

test("equipped Power substats increase maximum power", () => {
  const stats = calculateStats(makePlayer({
    equipment: {
      necklace: { name: "Power Pendant", subStats: { maxPower: 3 } },
    },
  }));

  expect(stats.maxPower).toBe(8);
});

test("reaching an even level adds one max power and restores one current power", () => {
  const player = makePlayer({
    stats: { health: 95, stamina: 8, power: 5, exp: expForLevel(1) - 1 },
  });
  const { patch } = gainExp(player, 1);

  expect(patch.level).toBe(2);
  expect(patch.stats.maxPower).toBe(6);
  expect(patch.stats.power).toBe(6);
  expect(patch.bonusStats.maxPower).toBeUndefined();
});

test("max power and current power increase only on every other level", () => {
  const player = makePlayer({
    stats: { health: 95, stamina: 8, power: 0, exp: 0 },
  });
  const toLevelThree = expForLevel(1) + expForLevel(2);
  const toLevelFour = toLevelThree + expForLevel(3);

  const atLevelThree = gainExp(player, toLevelThree).patch;
  expect(atLevelThree.level).toBe(3);
  expect(atLevelThree.stats.maxPower).toBe(6);
  expect(atLevelThree.stats.power).toBe(1);

  const atLevelFour = gainExp(player, toLevelFour).patch;
  expect(atLevelFour.level).toBe(4);
  expect(atLevelFour.stats.maxPower).toBe(7);
  expect(atLevelFour.stats.power).toBe(2);
});

test("stamina and skill points are awarded at their new level intervals", () => {
  const toLevelThree = expForLevel(1) + expForLevel(2);
  const { patch } = gainExp(makePlayer(), toLevelThree);

  expect(patch.level).toBe(3);
  expect(patch.bonusStats.maxStamina).toBe(1);
  expect(patch.stats.maxStamina).toBe(9);
  expect(patch.stats.stamina).toBe(9);
  expect(patch.skillPoints).toBe(1);
});

test("multi-level gains award stamina every other level and skill points every third level", () => {
  const expToLevelSeven = Array.from({ length: 6 }, (_, index) => expForLevel(index + 1))
    .reduce((total, exp) => total + exp, 0);
  const { patch } = gainExp(makePlayer(), expToLevelSeven);

  expect(patch.level).toBe(7);
  expect(patch.bonusStats.maxStamina).toBe(3);
  expect(patch.stats.maxStamina).toBe(11);
  expect(patch.stats.stamina).toBe(11);
  expect(patch.skillPoints).toBe(2);
});
