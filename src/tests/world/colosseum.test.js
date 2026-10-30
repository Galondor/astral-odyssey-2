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

test("each successive wave has greater health", () => {
  const health = Array.from({ length: 10 }, (_, index) =>
    createColosseumEnemy(index + 1, player).maxHp,
  );

  expect(health.every((value, index) => index === 0 || value > health[index - 1])).toBe(true);
});

test.each([
  [1, { maxHp: 25, attack: [1, 2], defense: 1, speed: 2, astra: 20, exp: 24 }],
  [2, { maxHp: 31, attack: [1, 2], defense: 1, speed: 2, astra: 38, exp: 45 }],
  [5, { maxHp: 46, attack: [1, 3], defense: 2, speed: 2, astra: 83, exp: 99 }],
])("wave %s has quarter-strength core stats without reduced rewards", (wave, expected) => {
  expect(createColosseumEnemy(wave, player)).toMatchObject(expected);
});

test("reduced stats retain level scaling and valid attack ranges far into a run", () => {
  const veteran = {
    ...player,
    level: 50,
    stats: { maxHealth: 1000, attackMax: 100, defense: 100, speed: 100 },
  };
  const early = createColosseumEnemy(1, veteran);
  const late = createColosseumEnemy(100, veteran);
  expect(early.maxHp).toBe(1600);
  expect(early.attack).toEqual([61, 96]);
  expect(early.defense).toBe(5);
  expect(early.speed).toBe(17);
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
