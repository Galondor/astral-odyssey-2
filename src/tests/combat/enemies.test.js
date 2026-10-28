import {
  ENEMIES,
  getEnemyCandidates,
  getRandomEnemy,
  getUndergearFactor,
} from "../../combat/enemies";
import { MATERIALS } from "../../items/materials";

jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(),
  setPlayer: jest.fn(),
}));

const spawnAtTemplateLevel = (template) =>
  getRandomEnemy(
    template.tier,
    template.regions[0],
    template.level,
    template.level * 150,
    template.id,
  );

beforeEach(() => {
  jest.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => jest.restoreAllMocks());

test("enemy stats scale against the 150 gear-score-per-level target across every template", () => {
  for (const template of ENEMIES) {
    const enemy = spawnAtTemplateLevel(template);
    const tier = {
      basic: { hp: 1.1, attack: 2.4, defense: 5 },
      elite: { hp: 2.2, attack: 3, defense: 6.5 },
      boss: { hp: 4.5, attack: 3.8, defense: 7.5 },
    }[template.tier];

    expect(enemy.level).toBe(template.level);
    expect(enemy.maxHp).toBe(Math.round(template.maxHp * tier.hp));
    expect(enemy.attack).toEqual(
      template.attack.map((value) => Math.round(value * tier.attack)),
    );
    expect(enemy.defense).toBe(Math.round(template.defense * tier.defense));
  }
});

test("enemy stats grow more strongly above the template level", () => {
  const template = ENEMIES.find((entry) => entry.id === "greenSlime");
  const enemy = getRandomEnemy(
    template.tier,
    template.regions[0],
    10,
    1500,
    template.id,
  );
  const levelDifference = enemy.level - template.level;
  const tier = { hp: 1.1, attack: 2.4, defense: 5 };

  expect(enemy.level).toBe(9);
  expect(enemy.maxHp).toBe(
    Math.round(template.maxHp * (1 + levelDifference * 0.5) * tier.hp),
  );
  expect(enemy.attack).toEqual(
    template.attack.map((value) =>
      Math.round(value * (1 + levelDifference * 0.4) * tier.attack),
    ),
  );
  expect(enemy.defense).toBe(
    Math.round(
      template.defense * (1 + levelDifference * 0.3) * tier.defense,
    ),
  );
  expect(enemy.speed).toBe(
    Math.round(template.speed * (1 + levelDifference * 0.3)),
  );
});

test("undergeared and well-geared players are scaled against the same gear-score target", () => {
  expect(getUndergearFactor(10, 0)).toBe(0.4);
  expect(getUndergearFactor(10, 1500)).toBe(1);
  expect(getUndergearFactor(10, 3000)).toBe(1);
});

test.each(["gelatinousKing", "wraithKing"])(
  "%s is comparable to the Infernal Drake at its template level",
  (id) => {
    const enemy = spawnAtTemplateLevel(ENEMIES.find((entry) => entry.id === id));
    const drake = spawnAtTemplateLevel(
      ENEMIES.find((entry) => entry.id === "infernalDrake"),
    );

    expect(enemy.maxHp).toBeGreaterThanOrEqual(drake.maxHp * 0.9);
    expect(enemy.attack[0]).toBeGreaterThanOrEqual(
      Math.round(drake.attack[0] * 0.9),
    );
    expect(enemy.attack[1]).toBeGreaterThanOrEqual(
      Math.round(drake.attack[1] * 0.9),
    );
    expect(enemy.defense).toBeGreaterThanOrEqual(
      Math.round(drake.defense * 0.8),
    );
  },
);

test.each([
  ["SuncleftExpanse", ["duneJackal", "glassbackScorpion", "buriedWyrm"]],
  ["TempestReach", ["bilgeRaider", "reefStalker", "leviathan"]],
  ["FrostfallRange", ["frostfang", "rimeSentinel", "avalancheColossus"]],
  ["ShatteredFront", ["trenchScavenger", "frontlineVeteran", "siegeCaptain"]],
])("%s has basic, elite, and boss enemies with unique regional drops", (region, ids) => {
  const roster = ENEMIES.filter((enemy) => enemy.regions.includes(region));

  expect(roster.map(({ tier }) => tier).sort()).toEqual(["basic", "boss", "elite"]);
  expect(roster.map(({ id }) => id).sort()).toEqual([...ids].sort());
  for (const enemy of roster) {
    expect(getEnemyCandidates(enemy.tier, region, enemy.level)).toContain(enemy);
    expect(enemy.drops).toHaveLength(1);
    expect(MATERIALS[enemy.drops[0].key]).toBeDefined();
    expect(MATERIALS[enemy.drops[0].key].tier).toBe(
      { basic: "common", elite: "rare", boss: "unique" }[enemy.tier],
    );
    expect(getRandomEnemy(enemy.tier, region, enemy.level, enemy.level * 150, enemy.id).id)
      .toBe(enemy.id);
  }
});

test("the Living Scarecrow is an elite Meadowlands enemy with its own material", () => {
  const enemy = ENEMIES.find(({ id }) => id === "livingScarecrow");

  expect(enemy).toEqual(
    expect.objectContaining({
      tier: "elite",
      regions: ["Meadowlands"],
      drops: [{ key: "living_thatch", chance: 0.75, min: 1, max: 2 }],
    }),
  );
  expect(MATERIALS.living_thatch).toBeDefined();
  expect(getEnemyCandidates("elite", "Meadowlands", 5)).toContain(enemy);
});
