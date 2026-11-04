// Historical values must not change when the current workshop is rebalanced.
const LEGACY_UPGRADES = {
  sharpeningStone: { astra: 50, materials: { goblin_scrap: 6 }, bonus: { attackMax: 5 } },
  arcanebattery: { astra: 50, materials: { rotwood_bark: 6 }, bonus: { magicAttackMax: 5 } },
  hardenedHide: { astra: 150, materials: { wolf_pelt: 10, boar_tusk: 1 }, bonus: { defense: 1 } },
  silkLining: { astra: 125, materials: { spider_silk: 8 }, bonus: { evasion: 0.01 } },
  vitalityTonic: { astra: 100, materials: { slime_gel: 10 }, bonus: { maxHealth: 20 } },
  essenceVessel: { astra: 200, materials: { wraith_essence: 6, obsidian_shard: 3 }, bonus: { maxPower: 2 } },
  enduranceCharm: { astra: 200, materials: { beast_fang: 7, primal_essence: 1 }, bonus: { maxStamina: 1 } },
};

const PREVIOUS_RANKS = [
  { astra: 75, common: 6 },
  { astra: 150, common: 10, materials: { beast_fang: 2, primal_essence: 1, living_thatch: 1 } },
  { astra: 350, common: 12, materials: { venom_sac: 2 } },
  { astra: 650, common: 16, materials: { wraith_essence: 2, widow_heart: 1, wraith_crown: 1 } },
  { astra: 1200, materials: { obsidian_shard: 18, ember_core: 4, infernal_heart: 1 } },
  { astra: 2400, materials: { bilge_raider_insignia: 18, abyssal_scale: 3 } },
  { astra: 4000, materials: { frostfang_pelt: 20, rimebound_plate: 3 } },
  { astra: 6500, materials: { suncleft_scourge_fang: 22, glassback_chitin: 4 } },
  { astra: 10000, materials: { salvaged_dog_tag: 24, war_hardened_insignia: 4 } },
  {
    astra: 15000,
    materials: {
      salvaged_dog_tag: 30, war_hardened_insignia: 6,
      leviathan_heart: 1, glacier_core: 1, buried_wyrm_scale: 1, commanders_crest: 1,
    },
  },
];

const previousUpgrade = (bonus, meadow, darkwood) => ({
  bonus,
  ranks: PREVIOUS_RANKS.map(({ astra, common, materials }, index) => ({
    astra,
    materials: { ...(common ? { [index < 2 ? meadow : darkwood]: common } : {}), ...materials },
  })),
});

const PREVIOUS_UPGRADES = {
  sharpeningStone: previousUpgrade({ attackMax: 10 }, "goblin_scrap", "rotwood_bark"),
  arcanebattery: previousUpgrade({ magicAttackMax: 10 }, "slime_gel", "rotwood_bark"),
  hardenedHide: previousUpgrade({ defense: 2 }, "wolf_pelt", "rotwood_bark"),
  silkLining: previousUpgrade({ evasion: 0.005 }, "wolf_pelt", "spider_silk"),
  vitalityTonic: previousUpgrade({ maxHealth: 25 }, "slime_gel", "rotwood_bark"),
  essenceVessel: previousUpgrade({ maxPower: 2 }, "slime_gel", "rotwood_bark"),
  enduranceCharm: previousUpgrade({ maxStamina: 1 }, "boar_tusk", "spider_silk"),
  powerBracers: previousUpgrade({ strength: 1 }, "metal_scraps", "rotwood_bark"),
  precisionGrips: previousUpgrade({ dexterity: 1 }, "goblin_scrap", "spider_silk"),
  scholarsLens: previousUpgrade({ intelligence: 1 }, "slime_gel", "rotwood_bark"),
  lifeweave: previousUpgrade({ vitality: 2 }, "slime_gel", "spider_silk"),
  ironboneBrace: previousUpgrade({ resilience: 2 }, "leather", "rotwood_bark"),
  windstepSoles: previousUpgrade({ agility: 2 }, "wolf_pelt", "spider_silk"),
  fortuneCharm: previousUpgrade({ luck: 1 }, "boar_tusk", "spider_silk"),
  warriorsWhetstone: previousUpgrade({ attackPercent: 0.01 }, "goblin_scrap", "rotwood_bark"),
  resonantPrism: previousUpgrade({ magicAttackPercent: 0.01 }, "slime_gel", "rotwood_bark"),
  quicksilverSpurs: previousUpgrade({ speed: 1 }, "goblin_scrap", "spider_silk"),
  deadeyeSight: previousUpgrade({ criticalHitChance: 0.005 }, "goblin_scrap", "spider_silk"),
  executionersSeal: previousUpgrade({ criticalDamageBonus: 0.02 }, "boar_tusk", "rotwood_bark"),
  wardedGorget: previousUpgrade({ criticalResistance: 0.01 }, "wolf_pelt", "rotwood_bark"),
  purifyingFilter: previousUpgrade({ statusResistance: 0.01 }, "slime_gel", "spider_silk"),
};

export const migrateWorkshopUpgrades = (player) => {
  if (!player?.stats || player.workshopVersion >= 2) return player;
  const crafted = { ...player.crafted };
  const bonusStats = { ...player.bonusStats };
  const refund = { upgrades: 0, astra: 0, materials: {} };
  const recipes = player.workshopVersion === 1 ? PREVIOUS_UPGRADES : LEGACY_UPGRADES;
  for (const [key, recipe] of Object.entries(recipes)) {
    const count = crafted[key] || 0;
    if (!count) continue;
    refund.upgrades += count;
    for (let rank = 0; rank < count; rank += 1) {
      const scale = recipe.ranks ? 1 : 1 + 0.5 * rank;
      const cost = recipe.ranks ? recipe.ranks[rank] : recipe;
      refund.astra += Math.ceil(cost.astra * scale);
      for (const [material, amount] of Object.entries(cost.materials)) {
        refund.materials[material] = (refund.materials[material] || 0) + Math.ceil(amount * scale);
      }
    }
    for (const [stat, amount] of Object.entries(recipe.bonus)) {
      const remaining = Math.max(0, Math.round(((bonusStats[stat] || 0) - amount * count) * 1e12) / 1e12);
      if (remaining) bonusStats[stat] = remaining;
      else delete bonusStats[stat];
    }
    delete crafted[key];
  }
  if (!refund.upgrades) return { ...player, workshopVersion: 2 };
  const materials = { ...player.materials };
  for (const [key, amount] of Object.entries(refund.materials)) {
    materials[key] = (materials[key] || 0) + amount;
  }
  return {
    ...player, workshopVersion: 2, workshopRefund: refund,
    astra: (player.astra || 0) + refund.astra,
    materials, crafted, bonusStats,
  };
};
