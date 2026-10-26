import { getPlayer, setPlayer } from "../../character/player";
import {
  buyGearTraderItem,
  GEAR_SLOT_TYPES,
  GEAR_TRADER_REFRESH_MS,
  generateRandomItem,
  getGearTraderStock,
  itemTooltip,
} from "../../items/items";

jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(),
  setPlayer: jest.fn(),
}));
jest.mock("../../combat/combat", () => ({ getEnemy: () => null }));

const SUBSTAT_CAPS = {
  maxPower: 0.5, resilience: 2, agility: 2, vitality: 3, luck: 1,
  attackMin: 3, attackMax: 3, magicAttackMin: 3, magicAttackMax: 3,
  criticalDamage: 0.02,
};

let player;
beforeEach(() => {
  jest.clearAllMocks();
  player = { level: 25, rep: 0, astra: 1000000, inventory: [] };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
  jest.spyOn(Date, "now").mockReturnValue(100 * GEAR_TRADER_REFRESH_MS);
  let seed = 12345;
  jest.spyOn(Math, "random").mockImplementation(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  });
});

afterEach(() => jest.restoreAllMocks());

const expectTierFloor = (item, minTier) => {
  expect(item.mainStat.tier).toBeGreaterThanOrEqual(minTier);
  expect(itemTooltip(item).stats[0].tier).toBe(`T${item.mainStat.tier}`);
  for (const [key, value] of Object.entries(item.subStats)) {
    const precision = key === "criticalDamage" ? 100 : 1;
    const max = Math.max(1, Math.ceil(SUBSTAT_CAPS[key] * item.iLevel * precision));
    const unscaled = value / (item.twoHanded ? 1.5 : 1) * precision;
    // Two-handed integer stats can round by half a point when scaled.
    const rounding = item.twoHanded ? precision / 3 : 0;
    const minimum = Math.ceil(1 + ((minTier - 0.5) / 7) * (max - 1));
    expect(unscaled + rounding + 1e-8).toBeGreaterThanOrEqual(minimum);
    expect(unscaled - rounding - 1e-8).toBeLessThanOrEqual(max);
    expect(item.subTiers[key]).toBeGreaterThanOrEqual(minTier);
  }
  expect(item.price).toBeGreaterThan(0);
  expect(item.name).toContain(item.condition);
};

test.each([
  [0, 0], [19, 0], [20, 0], [79, 0], [80, 1], [249, 1],
  [250, 2], [699, 2], [700, 3], [1799, 3], [1800, 4], [5000, 4],
])("reputation %i grants a T%i stat floor", (rep, minTier) => {
  player.rep = rep;
  for (let i = 0; i < 10; i++) {
    delete player.gearTraderStock;
    const items = getGearTraderStock();
    expect(items).toHaveLength(20);
    items.forEach((item) => expectTierFloor(item, minTier));
  }
});

test.each([1, 25, 100])("T4 floors hold for every slot at level %i", (level) => {
  player = { ...player, rep: 1800, level };
  const slots = new Set();
  const stats = new Set();
  const handedness = new Set();
  for (let i = 0; i < 30; i++) {
    delete player.gearTraderStock;
    getGearTraderStock().forEach((item) => {
      slots.add(item.slot);
      handedness.add(item.twoHanded);
      Object.keys(item.subStats).forEach((key) => stats.add(key));
      expectTierFloor(item, 4);
    });
  }
  expect([...slots].sort()).toEqual([...GEAR_SLOT_TYPES].sort());
  expect([...stats].sort()).toEqual(Object.keys(SUBSTAT_CAPS).sort());
  expect(handedness).toEqual(new Set([false, true]));
});

test.each([0, 0.999999999])("T4 floors hold at random extreme %s", (random) => {
  Math.random.mockReturnValue(random);
  player.rep = 1800;
  getGearTraderStock().forEach((item) => expectTierFloor(item, 4));
});

test.each([
  [0, [0.5, 0.2, 0.15, 0.14, 0.01]],
  [20, [0.35, 0.3, 0.2, 0.14, 0.01]],
  [80, [0.15, 0.3, 0.3, 0.22, 0.03]],
  [250, [0, 0.15, 0.35, 0.43, 0.07]],
  [700, [0, 0, 0.3, 0.58, 0.12]],
  [1800, [0, 0, 0.2, 0.6, 0.2]],
])("reputation %i uses the intended rarity distribution", (rep, odds) => {
  player.rep = rep;
  const counts = { Common: 0, Uncommon: 0, Rare: 0, Epic: 0, Legendary: 0 };
  for (let i = 0; i < 300; i++) {
    delete player.gearTraderStock;
    getGearTraderStock().forEach((item) => { counts[item.rarity]++; });
  }
  Object.values(counts).forEach((count, index) => {
    if (odds[index] === 0) expect(count).toBe(0);
    else expect(Math.abs(count / 6000 - odds[index])).toBeLessThan(0.025);
  });
});

test("stock and purchases persist until refresh, even after a reputation upgrade", () => {
  const stock = getGearTraderStock();
  expect(getGearTraderStock()).toBe(stock);
  expect(setPlayer).toHaveBeenCalledTimes(1);
  const purchased = stock[0];
  expect(buyGearTraderItem(0)).toEqual({ ok: true, item: purchased, price: purchased.price });
  expect(player.inventory).toEqual([purchased]);
  expect(player.astra).toBe(1000000 - purchased.price);
  player.rep = 1800;
  expect(getGearTraderStock()).toHaveLength(19);
  expect(getGearTraderStock()).not.toContain(purchased);
  Date.now.mockReturnValue(101 * GEAR_TRADER_REFRESH_MS);
  const refreshed = getGearTraderStock();
  expect(refreshed).toHaveLength(20);
  refreshed.forEach((item) => expectTierFloor(item, 4));
  expect(player.gearTraderStock.items).toBe(refreshed);
});

test("saved stock from before reputation scaling remains valid this cycle", () => {
  const items = [{ id: "existing-stock", rarity: "Common" }];
  player = { ...player, rep: 1800, gearTraderStock: { hour: 100, items } };
  expect(getGearTraderStock()).toBe(items);
  expect(setPlayer).not.toHaveBeenCalled();
});

test("explicit player data controls trader level and reputation", () => {
  const stock = getGearTraderStock({ level: 100, rep: 1800 });
  stock.forEach((item) => {
    expect(item.iLevel).toBeGreaterThanOrEqual(100);
    expectTierFloor(item, 4);
  });
});

test("non-trader loot retains low rolls and existing minimum-rarity behavior", () => {
  player.rep = 1800;
  Math.random.mockReturnValue(0);
  const common = generateRandomItem("helmet");
  expect(common.rarity).toBe("Common");
  expect(common.mainStat.value).toBe(0);
  expect(common.mainStat.tier).toBe(0);
  expect(common.subTiers.maxPower).toBe(0);
  expect(generateRandomItem("helmet", 3).rarity).toBe("Epic");
});
