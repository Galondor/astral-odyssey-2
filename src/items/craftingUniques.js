/*
 Crafting-only Unique items. Same shape as dungeon UNIQUES ({ id, name, slot, stat, ability, subStats[], twoHanded? })
 plus their recipe: profession, unlock level, base material family, minimum base tier, base quantity and
 additional required materials. Abilities live in UNIQUE_ABILITIES (src/combat/abilities.js).
*/
export const CRAFTED_UNIQUES = {
  emberwroughtBlade: {
    id: "emberwroughtBlade", name: "Emberwrought Blade", slot: "weapon", stat: "strength", ability: "Forgefire",
    subStats: ["maxPower", "attackMin", "attackMax", "criticalDamage", "attackPercent", "magicAttackPercent"],
    recipe: { profession: "weaponry", level: 20, family: "ore", minTier: 3, baseQty: 5, requires: { infernal_heart: 1, ember_core: 5, forge_tempered_alloy: 2 } },
  },
  tidecallerBulwark: {
    id: "tidecallerBulwark", name: "Tidecaller's Bulwark", slot: "offhand", stat: "intelligence", ability: "Undertow Ward",
    subStats: ["defense", "resilience", "vitality", "speed", "magicAttackPercent", "luck"],
    recipe: { profession: "weaponry", level: 35, family: "ore", minTier: 5, baseQty: 6, requires: { leviathan_heart: 1, abyssal_scale: 6, bilge_raider_insignia: 8 } },
  },
  starforgedGreatblade: {
    id: "starforgedGreatblade", name: "Starforged Greatblade", slot: "weapon", stat: "strength", twoHanded: true, ability: "Starforged Edge",
    subStats: ["maxPower", "attackMin", "attackMax", "criticalDamage", "attackPercent", "magicAttackPercent"],
    recipe: { profession: "weaponry", level: 50, family: "ore", minTier: 7, baseQty: 10, requires: { commanders_crest: 1, glacier_core: 1, buried_wyrm_scale: 1, war_hardened_insignia: 8 } },
  },
  frostwovenMantle: {
    id: "frostwovenMantle", name: "Frostwoven Mantle", slot: "chestplate", stat: "intelligence", ability: "Rimeshell",
    subStats: ["defense", "resilience", "vitality", "statusResistance", "criticalResistance", "magicAttackPercent"],
    recipe: { profession: "armor", level: 20, family: "cloth", minTier: 3, baseQty: 6, requires: { wraith_essence: 6, ember_core: 3, primal_essence: 3 } },
  },
  sandstriderTreads: {
    id: "sandstriderTreads", name: "Sandstrider Treads", slot: "boots", stat: "dexterity", ability: "Dune Dancer",
    subStats: ["speed", "agility", "luck", "vitality", "attackPercent", "criticalResistance"],
    recipe: { profession: "armor", level: 35, family: "hide", minTier: 5, baseQty: 5, requires: { glassback_chitin: 4, suncleft_scourge_fang: 10, buried_wyrm_scale: 1 } },
  },
  aegisOfTheUnbroken: {
    id: "aegisOfTheUnbroken", name: "Aegis of the Unbroken", slot: "helmet", stat: "strength", ability: "Unbroken Line",
    subStats: ["defense", "resilience", "vitality", "criticalResistance", "statusResistance", "attackPercent"],
    recipe: { profession: "armor", level: 50, family: "ore", minTier: 7, baseQty: 8, requires: { commanders_crest: 1, glacier_core: 1, war_hardened_insignia: 10 } },
  },
  brinelightPendant: {
    id: "brinelightPendant", name: "Brinelight Pendant", slot: "necklace", stat: "intelligence", ability: "Tidal Fortune",
    subStats: ["maxPower", "speed", "criticalDamage", "magicAttackPercent", "luck", "resilience"],
    recipe: { profession: "jewelry", level: 20, family: "precious", minTier: 3, baseQty: 4, requires: { venom_sac: 4, wraith_essence: 4, primal_essence: 3 } },
  },
  venomkissBand: {
    id: "venomkissBand", name: "Venomkiss Band", slot: "ring", stat: "dexterity", ability: "Venomkiss",
    subStats: ["criticalDamage", "attackPercent", "agility", "speed", "luck", "statusResistance"],
    recipe: { profession: "jewelry", level: 35, family: "precious", minTier: 5, baseQty: 5, requires: { widow_heart: 2, venom_sac: 10, glassback_chitin: 3 } },
  },
  sovereignsSignet: {
    id: "sovereignsSignet", name: "Sovereign's Signet", slot: "ring", stat: "strength", ability: "Sovereign's Due",
    subStats: ["maxPower", "criticalDamage", "attackPercent", "defense", "luck", "vitality"],
    recipe: { profession: "jewelry", level: 50, family: "precious", minTier: 7, baseQty: 6, requires: { commanders_crest: 1, buried_wyrm_scale: 1, leviathan_heart: 1, war_hardened_insignia: 6 } },
  },
};
