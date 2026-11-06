import { getPlayer, setPlayer } from "../../character/player";
import {
  advanceGathering, finishGathering, forfeitGathering, getGatheringAttempt, getGatheringConfig,
  getGatheringDuration, getGatheringPool, getMiningMarker, offerGathering, recordGatheringInput,
  rollGatheringRewards, startGathering,
} from "../../world/gathering";
import { REGION_TIERS, CRAFTING_MATERIALS } from "../../items/craftingMaterials";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
jest.mock("../../combat/combat", () => ({ getEnemy: jest.fn(() => null) }));

const hero = (activity = "mining", level = 50, power = 50, subStats = {}) => ({
  gathering: { [activity]: { level, exp: 0, attempts: 0 } },
  equipment: { [activity === "mining" ? "pickaxe" : "axe"]: {
    name: "Test tool", slot: activity === "mining" ? "pickaxe" : "axe", iLevel: level,
    mainStat: { stat: "gatheringPower", value: power }, subStats,
  } },
});
beforeEach(() => {
  forfeitGathering();
  jest.clearAllMocks();
  getPlayer.mockReturnValue({});
});

test.each(["mining", "logging"])("%s has all tool-unlocked tiers in every region, never above the cap", (activity) => {
  for (const region of REGION_TIERS) {
    const config = getGatheringConfig(hero(activity, 50, 22), activity);
    const pool = getGatheringPool(activity, region, config);
    expect(pool.map(({ tier }) => tier)).toEqual([1, 2, 3, 4]);
    expect(pool.every(({ weight }) => weight > 0)).toBe(true);
    const max = getGatheringConfig(hero(activity), activity);
    expect(getGatheringPool(activity, region, max).map(({ tier }) => tier)).toContain(7);
    const top = rollGatheringRewards(hero(activity), activity, region, max, Array(max.count).fill(1), () => 0.99999);
    expect(Object.keys(top.materials).some((key) => CRAFTING_MATERIALS[key].tier === 7)).toBe(true);
    const reward = rollGatheringRewards(hero(activity), activity, region, config, Array(config.count).fill(1), () => 0.99999);
    expect(Object.keys(reward.materials).every((key) => CRAFTING_MATERIALS[key].tier <= 4)).toBe(true);
  }
});

test("region preference, performance and rarity alter actual reward weights", () => {
  const config = getGatheringConfig(hero(), "mining");
  const meadow = getGatheringPool("mining", "Meadowlands", config, 0);
  const front = getGatheringPool("mining", "ShatteredFront", config, 0);
  expect(front[6].weight / front[0].weight).toBeGreaterThan(meadow[6].weight / meadow[0].weight);
  const skilled = getGatheringPool("mining", "Meadowlands", { ...config, rarity: config.rarity + 0.5 }, 1);
  expect(skilled[6].weight / skilled[0].weight).toBeGreaterThan(meadow[6].weight / meadow[0].weight);
  const good = rollGatheringRewards(hero(), "mining", "Meadowlands", config, [1, 1, 1, 1, 1], () => 0);
  const rough = rollGatheringRewards(hero(), "mining", "Meadowlands", config, [0.2, 0, 0, 0, 0], () => 0);
  expect(good.materials.metal_scraps).toBeGreaterThan(rough.materials.metal_scraps);
  expect(good.exp).toBeGreaterThan(rough.exp);
  expect(good.grade).toBe("Perfect");
});

test("bare hands, unmet equip requirements, bonus caps and practice rewards", () => {
  const config = getGatheringConfig(hero("mining", 4, 50), "mining");
  expect(config).toMatchObject({ maxTier: 1, toolName: "Bare hands" });
  const capped = getGatheringConfig(hero("logging", 50, 50, {
    gatheringTiming: 99, gatheringSlowdown: 99, gatheringPerfect: 99,
  }), "logging");
  expect(capped.window).toBe(420);
  expect(capped.interval).toBe(1400);
  const missed = rollGatheringRewards({}, "mining", "Meadowlands", config, [0, 0, 0, 0, 0]);
  expect(missed).toMatchObject({ materials: {}, exp: 2, grade: "Missed" });
});

test.each(["mining", "logging"])("%s grants substantially more XP with accelerating performance rewards", (activity) => {
  const config = getGatheringConfig({}, activity);
  const rewards = [0, 0.2, 0.5, 0.8, 1].map((score) =>
    rollGatheringRewards({}, activity, "Meadowlands", config, Array(config.count).fill(score), () => 0));
  expect(rewards.map(({ exp }) => exp)).toEqual([2, 32, 69, 137, 200]);
  expect(rewards[3].exp - rewards[2].exp).toBeGreaterThan(rewards[2].exp - rewards[1].exp);
  expect(rewards[4].gathering[activity]).toMatchObject({ level: 2, exp: 68, attempts: 1 });
});

test.each(["mining", "logging"])("%s XP retains material tier scaling, tool bonuses and under-tier penalties", (activity) => {
  const earned = (level, power, subStats = {}) => {
    const player = hero(activity, level, power, subStats);
    const config = getGatheringConfig(player, activity);
    return rollGatheringRewards(player, activity, "Meadowlands", config, Array(config.count).fill(1), () => 0).exp;
  };
  expect(earned(8, 8)).toBe(300);
  expect(earned(8, 8, { gatheringExp: 0.5 })).toBe(450);
  expect(earned(8, 8, { gatheringExp: 1 })).toBe(600);
  expect(earned(8, 1)).toBe(160);
  expect(earned(43, 43)).toBe(800);
});

test("Mining records one timed strike per round and settles exactly once against latest player data", () => {
  const player = hero();
  getPlayer.mockReturnValue(player);
  const { id } = offerGathering(player, "Meadowlands", "mining");
  expect(finishGathering(id, 0).ok).toBe(false);
  expect(startGathering(id, player, 0, () => 0.5).ok).toBe(true);
  const c = getGatheringAttempt().config;
  expect(recordGatheringInput(id, "strike", 0).ignored).toBe(true);
  for (let i = 0; i < c.count; i++) {
    const time = c.countdown + i * c.interval + c.interval / 4;
    expect(getMiningMarker(time, c)).toBe(0.5);
    expect(recordGatheringInput(id, "strike", time).score).toBe(1);
    expect(recordGatheringInput(id, "strike", time).ignored).toBe(true);
  }
  getPlayer.mockReturnValue({ ...player, materials: { slime_gel: 17 }, gathering: { ...player.gathering, logging: { level: 8 } } });
  const result = finishGathering(id, 99999);
  expect(result.ok).toBe(true);
  expect(result.grade).toBe("Perfect");
  expect(setPlayer).toHaveBeenCalledTimes(1);
  const patch = setPlayer.mock.calls[0][0];
  expect(patch.materials.slime_gel).toBe(17);
  expect(patch.gathering.logging).toEqual({ level: 8 });
  expect(finishGathering(id, 99999).ok).toBe(false);
  expect(setPlayer).toHaveBeenCalledTimes(1);
});

test("Logging requires alternating sides, penalizes wrong/early inputs and expires missed beats", () => {
  const player = hero("logging");
  const { id } = offerGathering(player, "Darkwood", "logging");
  startGathering(id, player, 0);
  const c = getGatheringAttempt().config;
  expect(recordGatheringInput(id, "right", c.countdown + c.interval).score).toBe(0);
  expect(recordGatheringInput(id, "left", c.countdown + c.interval).ignored).toBe(true);
  expect(recordGatheringInput(id, "right", c.countdown + 2 * c.interval).score).toBe(1);
  expect(recordGatheringInput(id, "left", c.countdown + 3 * c.interval - c.window - 1).score).toBe(0);
  expect(advanceGathering(id, getGatheringDuration(c) + 1).complete).toBe(true);
  expect(getGatheringAttempt().scores).toEqual([0, 1, 0, 0, 0, 0, 0, 0]);
});

test("tool configuration is snapshotted and a forfeit never grants XP/materials", () => {
  const player = hero();
  const { id } = offerGathering(player, "Meadowlands", "mining");
  startGathering(id, player, 0);
  player.equipment.pickaxe.mainStat.value = 1;
  expect(getGatheringAttempt().config.maxTier).toBe(7);
  forfeitGathering(id);
  expect(startGathering(id, player).ok).toBe(false);
  expect(finishGathering(id, 99999).ok).toBe(false);
  expect(setPlayer).not.toHaveBeenCalled();
});

test.each([
  [0, 1],
  [65, 1],
  [66, 0.9954285714285714],
  [240, 0],
  [241, 0],
])("Logging timing boundary at %i ms produces score %s", (distance, expected) => {
  const { id } = offerGathering({}, "Meadowlands", "logging");
  startGathering(id, {}, 0);
  const c = getGatheringAttempt().config;
  recordGatheringInput(id, "left", c.countdown + c.interval + distance);
  expect(getGatheringAttempt().scores[0]).toBeCloseTo(expected);
});

test("Mining weak-point boundary, perfect center and round timeout are scored consistently", () => {
  const { id } = offerGathering({}, "Meadowlands", "mining");
  startGathering(id, {}, 0, () => 0.5);
  const c = getGatheringAttempt().config;
  const atMarker = (position, round) => c.countdown + round * c.interval + position * c.interval / 2;
  expect(recordGatheringInput(id, "strike", atMarker(0.5, 0)).score).toBe(1);
  expect(recordGatheringInput(id, "strike", atMarker(0.69, 1)).score).toBe(0);
  advanceGathering(id, c.countdown + 3 * c.interval);
  expect(getGatheringAttempt().scores[2]).toBe(0);
});

test("bare-handed successes can reach the tool unlock without advanced resources", () => {
  let player = {};
  let count = 0;
  while ((player.gathering?.mining.level || 1) < 5 && count < 60) {
    const c = getGatheringConfig(player, "mining");
    const result = rollGatheringRewards(player, "mining", "Meadowlands", c, [1, 1, 1, 1, 1], () => 0);
    player = { gathering: result.gathering };
    count++;
  }
  expect(player.gathering.mining.level).toBe(5);
  expect(count).toBeLessThan(60);
});
