import { calculateStats } from "../../character/stats";
import { migrateWorkshopUpgrades } from "../../items/workshopMigration";

jest.mock("../../firebase", () => ({ db: {} }));

const legacyPlayer = () => ({
  level: 30, astra: 100, powerLevelVersion: 1,
  baseStats: { strength: 2, dexterity: 2, intelligence: 2 },
  stats: { health: 500, power: 50, stamina: 30 },
  bonusStats: {
    attackMax: 28, magicAttackMax: 25, defense: 7, evasion: 0.07,
    maxHealth: 490, maxPower: 27, maxStamina: 17, luck: 4,
  },
  crafted: {
    sharpeningStone: 5, arcanebattery: 5, hardenedHide: 5, silkLining: 5,
    vitalityTonic: 10, essenceVessel: 10, enduranceCharm: 3, analyzer: 1,
  },
  materials: { goblin_scrap: 2, slime_gel: 3 },
  keyItems: ["analyzer", "huntersHorn"],
});

test("refunds all historical ranks with per-purchase rounding and removes only workshop bonuses", () => {
  const original = legacyPlayer();
  const before = JSON.stringify(original);
  const migrated = migrateWorkshopUpgrades(original);
  expect(migrated.workshopVersion).toBe(2);
  expect(migrated.workshopRefund).toEqual({
    upgrades: 43,
    astra: 14401,
    materials: {
      goblin_scrap: 60, rotwood_bark: 60, wolf_pelt: 100, boar_tusk: 11,
      spider_silk: 80, slime_gel: 325, wraith_essence: 195,
      obsidian_shard: 100, beast_fang: 32, primal_essence: 5,
    },
  });
  expect(migrated.astra).toBe(14501);
  expect(migrated.materials).toEqual({
    ...migrated.workshopRefund.materials, goblin_scrap: 62, slime_gel: 328,
  });
  expect(migrated.bonusStats).toEqual({
    attackMax: 3, defense: 2, evasion: 0.02,
    maxHealth: 290, maxPower: 7, maxStamina: 14, luck: 4,
  });
  expect(migrated.crafted).toEqual({ analyzer: 1 });
  expect(migrated.keyItems).toEqual(original.keyItems);
  const stats = calculateStats(migrated);
  expect(stats.health).toBeLessThanOrEqual(stats.maxHealth);
  expect(stats.power).toBeLessThanOrEqual(stats.maxPower);
  expect(stats.stamina).toBeLessThanOrEqual(stats.maxStamina);
  expect(JSON.stringify(original)).toBe(before);
  expect(migrateWorkshopUpgrades(migrated)).toBe(migrated);
});

test("partial legacy purchases refund only the ranks actually bought", () => {
  const player = {
    ...legacyPlayer(), crafted: { sharpeningStone: 2, vitalityTonic: 1, analyzer: 1 },
    bonusStats: { attackMax: 10, maxHealth: 310 },
  };
  const migrated = migrateWorkshopUpgrades(player);
  expect(migrated.workshopRefund).toEqual({
    upgrades: 3, astra: 225, materials: { goblin_scrap: 15, slime_gel: 10 },
  });
  expect(migrated.bonusStats).toEqual({ maxHealth: 290 });
});

test("empty, new and already migrated characters cannot receive duplicate refunds", () => {
  expect(migrateWorkshopUpgrades(null)).toBeNull();
  const naming = { name: "Nova" };
  expect(migrateWorkshopUpgrades(naming)).toBe(naming);
  const fresh = { stats: {}, astra: 10 };
  expect(migrateWorkshopUpgrades(fresh)).toEqual({ ...fresh, workshopVersion: 2 });
  const current = { ...legacyPlayer(), workshopVersion: 2 };
  expect(migrateWorkshopUpgrades(current)).toBe(current);
});

test("version-one upgrades refund their actual prior rank costs, including removed recipes", () => {
  const player = {
    ...legacyPlayer(), workshopVersion: 1,
    crafted: { lifeweave: 2, ironboneBrace: 1, windstepSoles: 3, powerBracers: 2, analyzer: 1 },
    bonusStats: { vitality: 8, resilience: 5, agility: 9, strength: 12, maxHealth: 290 },
    workshopRefund: { upgrades: 1, astra: 50, materials: { goblin_scrap: 6 } },
  };
  const before = JSON.stringify(player);
  const migrated = migrateWorkshopUpgrades(player);
  expect(migrated.workshopVersion).toBe(2);
  expect(migrated.workshopRefund).toEqual({
    upgrades: 8, astra: 1100,
    materials: {
      slime_gel: 16, beast_fang: 6, primal_essence: 3, living_thatch: 3,
      leather: 6, wolf_pelt: 16, spider_silk: 12, venom_sac: 2, metal_scraps: 16,
    },
  });
  expect(migrated.astra).toBe(1200);
  expect(migrated.bonusStats).toEqual({
    vitality: 4, resilience: 3, agility: 3, strength: 10, maxHealth: 290,
  });
  expect(migrated.crafted).toEqual({ analyzer: 1 });
  expect(migrated.keyItems).toEqual(player.keyItems);
  expect(JSON.stringify(player)).toBe(before);
  expect(migrateWorkshopUpgrades(migrated)).toBe(migrated);
});

test("all version-one upgrade types refund ten ranks without using new recipe prices or bonuses", () => {
  const previousBonuses = {
    sharpeningStone: ["attackMax", 10], arcanebattery: ["magicAttackMax", 10],
    hardenedHide: ["defense", 2], silkLining: ["evasion", 0.005],
    vitalityTonic: ["maxHealth", 25], essenceVessel: ["maxPower", 2],
    enduranceCharm: ["maxStamina", 1], powerBracers: ["strength", 1],
    precisionGrips: ["dexterity", 1], scholarsLens: ["intelligence", 1],
    lifeweave: ["vitality", 2], ironboneBrace: ["resilience", 2], windstepSoles: ["agility", 2],
    fortuneCharm: ["luck", 1], warriorsWhetstone: ["attackPercent", 0.01],
    resonantPrism: ["magicAttackPercent", 0.01], quicksilverSpurs: ["speed", 1],
    deadeyeSight: ["criticalHitChance", 0.005], executionersSeal: ["criticalDamageBonus", 0.02],
    wardedGorget: ["criticalResistance", 0.01], purifyingFilter: ["statusResistance", 0.01],
  };
  const player = {
    ...legacyPlayer(), workshopVersion: 1,
    crafted: Object.fromEntries(Object.keys(previousBonuses).map((key) => [key, 10])),
    bonusStats: Object.fromEntries(Object.values(previousBonuses).map(([stat, value]) => [stat, value * 10 + 3])),
  };
  const migrated = migrateWorkshopUpgrades(player);
  expect(migrated.workshopRefund).toEqual({
    upgrades: 210, astra: 846825,
    materials: {
      goblin_scrap: 80, slime_gel: 112, wolf_pelt: 64, boar_tusk: 48, metal_scraps: 16, leather: 16,
      rotwood_bark: 336, spider_silk: 252,
      beast_fang: 42, primal_essence: 21, living_thatch: 21, venom_sac: 42,
      wraith_essence: 42, widow_heart: 21, wraith_crown: 21,
      obsidian_shard: 378, ember_core: 84, infernal_heart: 21,
      bilge_raider_insignia: 378, abyssal_scale: 63,
      frostfang_pelt: 420, rimebound_plate: 63,
      suncleft_scourge_fang: 462, glassback_chitin: 84,
      salvaged_dog_tag: 1134, war_hardened_insignia: 210,
      leviathan_heart: 21, glacier_core: 21, buried_wyrm_scale: 21, commanders_crest: 21,
    },
  });
  expect(migrated.crafted).toEqual({});
  expect(Object.values(migrated.bonusStats).every((bonus) => bonus === 3)).toBe(true);
});
