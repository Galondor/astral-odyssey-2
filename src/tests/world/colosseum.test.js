import { getPlayer, setPlayer } from "../../character/player";
import {
  advanceColosseumRun,
  beginColosseumRun,
  COLOSSEUM_COOLDOWN_MS,
  createColosseumEnemy,
  endColosseumRun,
  getColosseumStatus,
  getColosseumWaveTier,
} from "../../world/colosseum";

jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(),
  setPlayer: jest.fn(),
}));

let player;

beforeEach(() => {
  jest.clearAllMocks();
  endColosseumRun();
  player = {
    level: 5,
    astra: 0,
    stats: { maxHealth: 100, attackMax: 10, defense: 5, speed: 10 },
  };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => {
    player = { ...player, ...patch };
  });
});

test("waves repeat basic, elite, basic, elite, boss", () => {
  expect(Array.from({ length: 10 }, (_, index) => getColosseumWaveTier(index + 1))).toEqual([
    "basic",
    "elite",
    "basic",
    "elite",
    "boss",
    "basic",
    "elite",
    "basic",
    "elite",
    "boss",
  ]);
});

test("Colosseum status resistance increases with wave difficulty within tier ranges", () => {
  for (const [wave, min, max] of [[1, 0.05, 0.1], [2, 0.15, 0.3], [5, 0.35, 0.65]]) {
    const first = createColosseumEnemy(wave, player).statusResistance;
    const later = createColosseumEnemy(wave + 100, player).statusResistance;
    expect(first).toBeGreaterThanOrEqual(min);
    expect(first).toBeLessThan(max);
    expect(later).toBe(max);
  }
});
test("each successive wave has greater health", () => {
  const health = Array.from({ length: 10 }, (_, index) =>
    createColosseumEnemy(index + 1, player).maxHp,
  );

  expect(health.every((value, index) => index === 0 || value > health[index - 1])).toBe(true);
});

test.each([
  [1, { level: 1, maxHp: 100, attack: [3, 6], defense: 2, speed: 7, astra: 20, exp: 24 }],
  [2, { level: 2, maxHp: 137, attack: [5, 9], defense: 4, speed: 8, astra: 38, exp: 45 }],
  [5, { level: 5, maxHp: 275, attack: [10, 17], defense: 9, speed: 11, astra: 83, exp: 99 }],
])("wave %s has full-strength core stats without reduced rewards", (wave, expected) => {
  expect(createColosseumEnemy(wave)).toMatchObject(expected);
});

test("enemy level equals the wave and ignores the player's level and stats", () => {
  const veteran = {
    ...player,
    level: 50,
    stats: { maxHealth: 1000, attackMax: 100, defense: 100, speed: 100 },
  };
  getPlayer.mockImplementation(() => veteran);
  expect(createColosseumEnemy(1).level).toBe(1);
  expect(createColosseumEnemy(150).level).toBe(150);
  expect(createColosseumEnemy(1)).toEqual(createColosseumEnemy(1, player));
  const early = createColosseumEnemy(1);
  const late = createColosseumEnemy(100);
  expect(late.maxHp).toBeGreaterThan(early.maxHp);
  expect(late.attack[0]).toBeGreaterThan(early.attack[0]);
  expect(late.attack[1]).toBeGreaterThanOrEqual(late.attack[0]);
});

test("entry is level-gated, starts a cooldown, and does not count an uncleared wave", () => {
  player.level = 4;
  expect(beginColosseumRun(1_000)).toEqual({ ok: false, reason: "level" });

  player.level = 5;
  const started = beginColosseumRun(1_000);
  expect(started.ok).toBe(true);
  expect(started.enemy).toMatchObject({
    colosseum: true,
    colosseumWave: 1,
    colosseumWaveType: "basic",
    name: expect.stringMatching(/Pit|Arena|Bronze/),
  });
  expect(player.lastColosseumRunAt).toBe(1_000);
  expect(player.records?.highestClearedColosseumWave).toBeUndefined();
  expect(getColosseumStatus(player, 1_000).active).toBe(true);
  expect(beginColosseumRun(1_001)).toEqual({ ok: false, reason: "active" });

  endColosseumRun();
  expect(getColosseumStatus(player, 1_000 + COLOSSEUM_COOLDOWN_MS - 1).canEnter).toBe(false);
  expect(getColosseumStatus(player, 1_000 + COLOSSEUM_COOLDOWN_MS).canEnter).toBe(true);
});

test.each([1, 2, 5, 40, 100])("wave %s only reduces critical chance for bosses", (wave) => {
  const enemy = createColosseumEnemy(wave);
  const chance = 0.05 + Math.min(0.2, wave * 0.005);
  expect(enemy.critical).toBe(enemy.tier === "boss" ? Math.round(chance * 800) / 1000 : chance);
});

test("advancing alone does not count clears and boss drops are singular", () => {
  beginColosseumRun(10_000);
  let enemy;
  for (let wave = 2; wave <= 5; wave++) enemy = advanceColosseumRun();

  expect(player.records?.highestClearedColosseumWave).toBeUndefined();
  expect(enemy).toMatchObject({
    tier: "boss",
    drops: [{ key: "champions_medallion", chance: 1, min: 1, max: 1 }],
    materialAmount: 1,
  });
});
