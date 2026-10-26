import {
  ENEMIES,
  getRandomEnemy,
  getUndergearFactor,
} from "../../combat/enemies";

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
