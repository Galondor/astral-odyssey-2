import { getPlayer } from "../../character/player";
import { recalculateStats } from "../../character/stats";
import {
  applyHolofoilBonuses, createCraftedItem, createCustomItem, createMythicItem,
  createUniqueItem, generateRandomItem, getCustomSubStatTiers, getSubStatTier,
  itemTooltip, migrateHolofoilItems, rollSubStatAtTier, SUBSTAT_NAMES,
} from "../../items/items";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn() }));

beforeEach(() => getPlayer.mockReturnValue({ level: 100 }));
afterEach(() => jest.restoreAllMocks());

test.each([false, true])("Power has fixed rolls across every tier and level (two-handed: %s)", (twoHanded) => {
  const random = jest.spyOn(Math, "random");
  const tiers = Array.from({ length: 10 }, (_, tier) => tier);
  for (const level of [1, 5, 25, 100, 105]) {
    expect(getCustomSubStatTiers("maxPower", level, twoHanded, 9)).toEqual(tiers);
    for (const tier of tiers) {
      for (const rng of [0, 0.5, 0.999999]) {
        random.mockReturnValue(rng);
        const value = Math.max(1, tier) * (twoHanded ? 2 : 1);
        expect(rollSubStatAtTier("maxPower", level, tier, twoHanded, 9)).toBe(value);
        expect(getSubStatTier("maxPower", value, level, twoHanded, 9)).toBe(Math.max(1, tier));
        if (tier <= 7) {
          const item = createCustomItem({
            name: "Power gear", slot: "weapon", rarity: "Rare", condition: "Average",
            iLevel: level, price: 100, twoHanded,
            mainStat: { stat: "strength", tier: 0 }, subStats: { maxPower: tier },
          });
          expect(item.subStats.maxPower).toBe(value);
          expect(item.subTiers.maxPower).toBe(tier);
          expect(itemTooltip(item).stats).toContainEqual(
            expect.objectContaining({ label: "Power", value: `+${value}`, tier: `T${tier}` }),
          );
        }
      }
    }
  }
});

test.each([0, 0.5, 0.999999])("random, crafted, Unique and Mythic Power obey saved tiers at RNG %s", (rng) => {
  jest.spyOn(Math, "random").mockReturnValue(rng);
  for (const level of [1, 100]) {
    getPlayer.mockReturnValue({ level });
    const items = [
      generateRandomItem("weapon"),
      createCraftedItem({
        slot: "weapon", baseName: "Greatsword", rarity: "Legendary",
        condition: "Perfect", iLevel: level, guaranteed: ["maxPower"], minTier: 4,
      }),
      createUniqueItem({
        id: "power", name: "Power", slot: "weapon", stat: "strength",
        ability: "Plunder", twoHanded: true, subStats: ["maxPower"],
      }, level),
      createMythicItem({ slot: "weapon", baseName: "Greatsword", iLevel: level }),
    ];
    for (const item of items) {
      const scale = item.twoHanded ? 2 : 1;
      if (item.subStats.maxPower !== undefined) {
        expect(item.subStats.maxPower).toBe(Math.max(1, item.subTiers.maxPower) * scale);
        expect(item.gearPowerVersion).toBe(1);
      }
      if (item.mythicSubStat?.stat === "maxPower")
        expect(item.mythicSubStat.value).toBe(item.mythicSubStat.tier * scale);
    }
    expect(items[1].subTiers.maxPower).toBeGreaterThanOrEqual(4);
    expect(items[2].subTiers.maxPower).toBeGreaterThanOrEqual(4);
  }
});

test("legacy Power is rebalanced at saved tiers across owned gear, stock and buyback exactly once", () => {
  const item = {
    id: "power", slot: "weapon", rarity: "Mythic", iLevel: 100, twoHanded: true,
    price: 1000, subStats: { maxPower: 30, attackMin: 100 },
    subTiers: { maxPower: 7, attackMin: 4 },
    mythicSubStat: { stat: "maxPower", value: 34, tier: 8 },
    holofoil: ["#123456", "#abcdef"], holofoilEffect: "aurora", holofoilBonusVersion: 1,
  };
  const placeholder = { twoHandedOf: "mainHand" };
  const player = {
    baseStats: { strength: 2, dexterity: 2, intelligence: 2 },
    inventory: [item], equipment: { mainHand: item, offHand: placeholder },
    gearTraderStock: { hour: 123, items: [item] },
    gearTraderBuyback: [{ item, price: 123 }],
  };
  const migrated = migrateHolofoilItems(player);
  for (const gear of [
    migrated.inventory[0], migrated.equipment.mainHand,
    migrated.gearTraderStock.items[0], migrated.gearTraderBuyback[0].item,
  ]) {
    expect(gear.subStats).toEqual({ maxPower: 14, attackMin: 100 });
    expect(gear.subTiers).toEqual(item.subTiers);
    expect(gear.mythicSubStat).toEqual({ stat: "maxPower", value: 16, tier: 8 });
    expect(gear.price).toBe(1000);
    expect(gear.gearPowerVersion).toBe(1);
  }
  expect(migrated.equipment.offHand).toBe(placeholder);
  expect(migrated.gearTraderBuyback[0].price).toBe(123);
  expect(migrateHolofoilItems(migrated)).toBe(migrated);
  expect(migrateHolofoilItems(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
  expect(item.subStats.maxPower).toBe(30);
});

test("new Mythic Power wildcard rolls also use fixed tier values", () => {
  const wildcardRoll = (SUBSTAT_NAMES.indexOf("maxPower") + 0.5) / SUBSTAT_NAMES.length;
  jest.spyOn(Math, "random").mockReturnValue(wildcardRoll);
  for (const iLevel of [1, 100]) {
    const item = createMythicItem({ slot: "weapon", baseName: "Greatsword", iLevel });
    expect(item.mythicSubStat).toEqual({ stat: "maxPower", tier: 7, value: 14 });
  }
});

test.each([[1, 1, 7], [100, 1, 0], [100, 8, 4], [100, 15, 7]])(
  "missing saved tiers are recovered using legacy level-%i rolls of %i",
  (iLevel, value, tier) => {
    const item = applyHolofoilBonuses({ slot: "weapon", iLevel, subStats: { maxPower: value } });
    expect(item.subTiers.maxPower).toBe(tier);
    expect(item.subStats.maxPower).toBe(Math.max(1, tier));
    expect(applyHolofoilBonuses(item)).toBe(item);
  },
);

test("Holofoil raises low Power to T5 without multiplying high Power or applying bonuses twice", () => {
  jest.spyOn(Math, "random").mockReturnValue(0);
  for (const tier of [0, 1, 5, 7]) {
    const item = applyHolofoilBonuses({
      slot: "weapon", iLevel: 100, twoHanded: true,
      subStats: { maxPower: 30 }, subTiers: { maxPower: tier },
      holofoil: ["#123456", "#abcdef"], price: 100,
    });
    expect(item.subTiers.maxPower).toBe(Math.max(5, tier));
    expect(item.subStats.maxPower).toBe(Math.max(5, tier) * 2);
    expect(item.price).toBe(200);
    expect(applyHolofoilBonuses(item)).toBe(item);
  }
});

test("migration preserves legacy base stats and recalculates equipped Power", () => {
  const equipment = {
    mainHand: {
      slot: "weapon", iLevel: 100, subStats: { maxPower: 15 }, subTiers: { maxPower: 7 },
    },
  };
  let player = {
    level: 100, baseStats: { strength: 2, dexterity: 2, intelligence: 2 },
    stats: {}, equipment, inventory: [], powerLevelVersion: 1,
  };
  player = { ...player, ...recalculateStats(player) };
  const oldMax = player.stats.maxPower;
  delete player.baseStats;
  const migrated = migrateHolofoilItems(player);
  const recalculated = recalculateStats(migrated);
  expect(recalculated.stats.maxPower).toBe(oldMax - 8);
  expect(recalculated.stats.strength).toBe(player.stats.strength);
});
