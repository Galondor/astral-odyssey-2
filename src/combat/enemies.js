import { MATERIALS } from "../items/materials";
import { REGIONS, clampToRegion } from "../world/regions";
import { STATUSES } from "./statuses";

/*
 Enemies. Each template is { id, name, tier, regions, level, statLevel, maxHp, attack, defense, speed, critical,
 astra, exp, abilities, drops, phases? }. `level` is the lowest level the template spawns at inside its region
 (see world/regions.js for each region's level range). Stats are written for `statLevel` and scale up with the
 level it spawns at, then the region's danger multiplies health, attack, and defense and its reward multiplier
 raises astra and exp.
 An enemy can spawn in every region listed in `regions`.

 Tiers: basic -> elite -> boss. Higher tiers have more health, damage and abilities, resist
 stuns and damage-over-time, and give better astra, exp, gear and material rewards (see TIERS).

 Ability fields (all optional except name):
   power         multiplier on the enemy's attack roll (default 1); 0 makes it a pure utility move
   weight        relative chance of being chosen (default 2.5)
   cooldown      rounds before it can be used again
   below         only usable while enemy health is under this fraction
   hits          number of strikes (default 1)
   ignoreDefense fraction of your defense ignored
   status        { id, turns?, power?, chance? } inflicted on you (power is a fraction of YOUR max health for damage over time)
   self          { id, turns?, power? } buff the enemy gives itself
   heal          fraction of max health restored
   leech         fraction of damage dealt that heals the enemy
   text          flavor line shown when used
 Phases (bosses): [{ below, text, self?, heal? }] - each triggers once when health first drops under `below`.
 Drops: [{ key, chance, min, max }] of materials (key from MATERIALS).
*/
export const TIERS = {
  basic: {
    label: "Basic",
    color: "#b0b0b0",
    hp: 1.1,
    attack: 2.4,
    defense: 5,
    reward: 1,
    dropChance: 0.25,
    minRarity: 0,
    materialAmount: 1,
    dotResist: 1,
    stunResist: 0,
  },
  elite: {
    label: "Elite",
    color: "#0070dd",
    hp: 2.2,
    attack: 3,
    defense: 6.5,
    reward: 3,
    dropChance: 0.5,
    minRarity: 2,
    materialAmount: 1.5,
    dotResist: 0.75,
    stunResist: 0.5,
  },
  boss: {
    label: "Boss",
    color: "#ff8000",
    hp: 4.5,
    attack: 3.8,
    defense: 7.5,
    reward: 8,
    dropChance: 0.75,
    minRarity: 3,
    materialAmount: 2,
    dotResist: 0.5,
    stunResist: 1,
  },
};

// Content difficulty interpolates within each tier's resistance range.
export const getEnemyStatusResistance = (tier = "basic", content = "travel", difficulty = 0) => {
  const [min, max] = { basic: [0.05, 0.1], elite: [0.15, 0.3], boss: [0.35, 0.65] }[tier] || [0.05, 0.1];
  const base = { travel: 0, dungeon: 0.6, group: 0.8, labyrinth: 0.8, colosseum: 0.2, worldBoss: 1 }[content] ?? 0;
  const scale = base + (1 - base) * Math.min(1, Math.max(0, difficulty));
  return Math.round((min + (max - min) * scale) * 1000) / 1000;
};

export const getEnemyCriticalChance = (tier, chance) =>
  tier === "boss" ? Math.round(chance * 0.8 * 1000) / 1000 : chance;

export const enemyAbilityTooltip = (ability) => {
  if (!ability) return null;
  const stats = [];
  const descriptions = [];
  if (ability.power > 0 && ability.power !== 1)
    stats.push({
      label: "Attack power",
      value: `${Math.round(ability.power * 100)}%`,
    });
  if (ability.hits > 1) stats.push({ label: "Hits", value: ability.hits });
  if (ability.ignoreDefense)
    stats.push({
      label: "Defense ignored",
      value: `${Math.round(ability.ignoreDefense * 100)}%`,
    });
  if (ability.cooldown)
    stats.push({ label: "Cooldown", value: `${ability.cooldown} rounds` });
  if (ability.below)
    stats.push({
      label: "Health condition",
      value: `Below ${Math.round(ability.below * 100)}% enemy health`,
    });
  if (ability.weight != null && ability.weight !== 2.5)
    stats.push({ label: "Use tendency", value: ability.weight });
  if (ability.status) {
    const status = STATUSES[ability.status.id];
    if (status) {
      const chance = ability.status.chance ?? 1;
      const turns = ability.status.turns ?? status.defaultTurns;
      const power = ability.status.power ?? status.defaultPower;
      descriptions.push(
        `On hit: ${status.name} (${Math.round(chance * 100)}% chance${turns ? `, ${turns} rounds` : ""}${power ? `, ${Math.round(power * 100)}% strength` : ""}).`,
      );
      descriptions.push(status.description);
    }
  }
  if (ability.self) {
    const status = STATUSES[ability.self.id];
    if (status) {
      const turns = ability.self.turns ?? status.defaultTurns;
      const power = ability.self.power ?? status.defaultPower;
      descriptions.push(
        `Applies ${status.name} to itself${turns ? ` for ${turns} rounds` : ""}${power ? ` (${Math.round(power * 100)}% strength)` : ""}.`,
      );
      descriptions.push(status.description);
    }
  }
  if (ability.heal)
    stats.push({
      label: "Healing",
      value: `${Math.round(ability.heal * 100)}% max health`,
    });
  if (ability.leech)
    stats.push({
      label: "Life steal",
      value: `${Math.round(ability.leech * 100)}% of damage dealt`,
    });
  if (ability.text) descriptions.unshift(ability.text);
  if (ability.power === 0 && !ability.heal && !ability.status && !ability.self)
    descriptions.push("A utility ability with no direct attack.");
  return {
    title: ability.name,
    subtitle: "Enemy Ability",
    description: descriptions.length ? descriptions : undefined,
    stats: stats.length ? stats : undefined,
  };
};

export const ENEMIES = [
  // Basic
  {
    id: "greenSlime",
    name: "Green Slime",
    tier: "basic",
    regions: ["Meadowlands"],
    level: 1,
    statLevel: 1,
    maxHp: 30,
    attack: [1, 6],
    defense: 2,
    speed: 3,
    critical: 0.05,
    astra: 6,
    exp: 10,
    abilities: [
      {
        name: "Acid Splash",
        power: 1.3,
        status: { id: "poison", turns: 3, power: 0.03, chance: 0.5 },
      },
      {
        name: "Regrow",
        power: 0,
        heal: 0.15,
        below: 0.6,
        cooldown: 4,
        weight: 3,
        text: "The slime reabsorbs its stray goo.",
      },
    ],
    drops: [{ key: "slime_gel", chance: 0.7, min: 1, max: 2 }],
  },
  {
    id: "direWolf",
    name: "Dire Wolf",
    tier: "basic",
    regions: ["Meadowlands"],
    level: 2,
    statLevel: 2,
    maxHp: 50,
    attack: [3, 9],
    defense: 3,
    speed: 7,
    critical: 0.1,
    astra: 10,
    exp: 18,
    abilities: [
      { name: "Pounce", power: 1.8, cooldown: 2 },
      {
        name: "Rending Bite",
        power: 1,
        status: { id: "bleed", turns: 3, power: 0.04, chance: 0.7 },
      },
    ],
    drops: [
      { key: "wolf_pelt", chance: 0.55, min: 1, max: 2 },
      { key: "beast_fang", chance: 0.2, min: 1, max: 1 },
    ],
  },
  {
    id: "wildBoar",
    name: "Wild Boar",
    tier: "basic",
    regions: ["Meadowlands"],
    level: 2,
    statLevel: 2,
    maxHp: 60,
    attack: [2, 8],
    defense: 4,
    speed: 4,
    critical: 0.05,
    astra: 11,
    exp: 18,
    abilities: [
      {
        name: "Gore Charge",
        power: 1.6,
        status: { id: "stun", chance: 0.3 },
        cooldown: 3,
      },
      {
        name: "Thick Hide",
        power: 0,
        self: { id: "fortify", turns: 3, power: 0.4 },
        cooldown: 5,
        text: "The boar lowers its head and bristles.",
      },
    ],
    drops: [
      { key: "boar_tusk", chance: 0.6, min: 1, max: 2 },
      { key: "leather", chance: 0.8, min: 2, max: 4 }
    ],
  },
  {
    id: "goblinScavenger",
    name: "Goblin Scavenger",
    tier: "basic",
    regions: ["Meadowlands"],
    level: 3,
    statLevel: 3,
    maxHp: 45,
    attack: [3, 8],
    defense: 3,
    speed: 6,
    critical: 0.08,
    astra: 14,
    exp: 22,
    abilities: [
      {
        name: "Dirty Trick",
        power: 0.8,
        status: { id: "weaken", turns: 2, power: 0.25 },
      },
      { name: "Sling Shot", power: 1.4 },
    ],
    drops: [
      { key: "goblin_scrap", chance: 0.75, min: 1, max: 3 },
      { key: "leather", chance: 0.5, min: 1, max: 2 },
      { key: "metal_scraps", chance: 0.3, min: 1, max: 1 },
    ],
  },
  {
    id: "poacher",
    name: "Poacher",
    tier: "basic",
    eventOnly: true,
    regions: ["Darkwood"],
    level: 10,
    statLevel: 3,
    maxHp: 50,
    attack: [3, 9],
    defense: 3,
    speed: 6,
    critical: 0.1,
    astra: 16,
    exp: 26,
    abilities: [
      { name: "Crossbow Shot", power: 1.5, cooldown: 2 },
      {
        name: "Barbed Bolt",
        power: 1,
        status: { id: "bleed", turns: 3, power: 0.04, chance: 0.6 },
      },
    ],
    drops: [
      { key: "metal_scraps", chance: 0.6, min: 1, max: 2 },
      { key: "leather", chance: 0.5, min: 1, max: 2 },
      { key: "wolf_pelt", chance: 0.4, min: 1, max: 2 },
      { key: "boar_tusk", chance: 0.3, min: 1, max: 1 },
      { key: "beast_fang", chance: 0.2, min: 1, max: 1 },
    ],
  },
  {
    id: "giantSpider",
    name: "Giant Spider",
    tier: "basic",
    regions: ["Darkwood"],
    level: 10,
    statLevel: 4,
    maxHp: 55,
    attack: [4, 10],
    defense: 3,
    speed: 9,
    critical: 0.08,
    astra: 18,
    exp: 28,
    abilities: [
      {
        name: "Venom Bite",
        power: 1.1,
        status: { id: "poison", turns: 4, power: 0.03, chance: 1 },
      },
      {
        name: "Web Trap",
        power: 0,
        status: { id: "stun", chance: 0.8 },
        cooldown: 4,
        text: "The spider spits a tangle of webbing.",
      },
    ],
    drops: [
      { key: "spider_silk", chance: 0.65, min: 1, max: 2 },
      { key: "venom_sac", chance: 0.3, min: 1, max: 1 },
    ],
  },
  {
    id: "rotwoodTreant",
    name: "Rotwood Treant",
    tier: "basic",
    regions: ["Darkwood"],
    level: 10,
    statLevel: 4,
    maxHp: 90,
    attack: [4, 10],
    defense: 6,
    speed: 2,
    critical: 0.03,
    astra: 20,
    exp: 30,
    abilities: [
      { name: "Root Slam", power: 1.6, cooldown: 2 },
      {
        name: "Bark Skin",
        power: 0,
        self: { id: "fortify", turns: 3, power: 0.35 },
        cooldown: 5,
        text: "Bark knits over the treant's wounds.",
      },
      {
        name: "Regrowth",
        power: 0,
        self: { id: "regen", turns: 3, power: 0.05 },
        below: 0.7,
        cooldown: 6,
        text: "Green shoots sprout from the treant.",
      },
    ],
    drops: [{ key: "rotwood_bark", chance: 0.7, min: 1, max: 3 }],
  },
  {
    id: "wraith",
    name: "Restless Wraith",
    tier: "basic",
    regions: ["Darkwood"],
    level: 13,
    statLevel: 6,
    maxHp: 60,
    attack: [5, 12],
    defense: 2,
    speed: 8,
    critical: 0.08,
    astra: 26,
    exp: 40,
    abilities: [
      {
        name: "Chilling Touch",
        power: 1,
        status: { id: "weaken", turns: 2, power: 0.25 },
      },
      { name: "Life Drain", power: 1.2, leech: 0.5, cooldown: 3 },
    ],
    drops: [{ key: "wraith_essence", chance: 0.5, min: 1, max: 2 }],
  },
  {
    id: "emberImp",
    name: "Ember Imp",
    tier: "basic",
    regions: ["AshenPeaks"],
    level: 20,
    statLevel: 7,
    maxHp: 55,
    attack: [6, 13],
    defense: 3,
    speed: 10,
    critical: 0.1,
    astra: 30,
    exp: 46,
    abilities: [
      {
        name: "Fire Bolt",
        power: 1.3,
        status: { id: "burn", turns: 3, power: 0.04, chance: 0.6 },
      },
      {
        name: "Cackle",
        power: 0,
        self: { id: "enrage", turns: 3, power: 0.3 },
        cooldown: 5,
        text: "The imp cackles, flames flaring.",
      },
    ],
    drops: [{ key: "ember_core", chance: 0.15, min: 1, max: 2 }],
  },
  {
    id: "stoneGolem",
    name: "Obsidian Golem",
    tier: "basic",
    regions: ["AshenPeaks"],
    level: 22,
    statLevel: 8,
    maxHp: 120,
    attack: [7, 15],
    defense: 9,
    speed: 2,
    critical: 0.03,
    astra: 34,
    exp: 52,
    abilities: [
      {
        name: "Crushing Slam",
        power: 1.8,
        status: { id: "stun", chance: 0.35 },
        cooldown: 3,
      },
      {
        name: "Stone Skin",
        power: 0,
        self: { id: "fortify", turns: 3, power: 0.4 },
        cooldown: 5,
        text: "Obsidian plates grind into place.",
      },
    ],
    drops: [{ key: "obsidian_shard", chance: 0.65, min: 1, max: 3 }],
  },
  {
    id: "duneJackal",
    name: "Dune Jackal",
    tier: "basic",
    regions: ["SuncleftExpanse"],
    level: 70,
    statLevel: 4,
    maxHp: 58,
    attack: [4, 10],
    defense: 3,
    speed: 8,
    critical: 0.1,
    astra: 18,
    exp: 28,
    abilities: [
      { name: "Sand Snap", power: 1.2, status: { id: "weaken", turns: 2, power: 0.2, chance: 0.5 } },
      { name: "Dune Pounce", power: 1.7, cooldown: 2 },
    ],
    drops: [{ key: "suncleft_scourge_fang", chance: 0.7, min: 1, max: 2 }],
  },
  {
    id: "bilgeRaider",
    name: "Bilge Raider",
    tier: "basic",
    regions: ["TempestReach"],
    level: 40,
    statLevel: 4,
    maxHp: 62,
    attack: [4, 10],
    defense: 4,
    speed: 6,
    critical: 0.08,
    astra: 19,
    exp: 29,
    abilities: [
      { name: "Hooked Cut", power: 1.1, status: { id: "bleed", turns: 3, power: 0.035, chance: 0.6 } },
      { name: "Deckside Feint", power: 1.5, cooldown: 2 },
    ],
    drops: [{ key: "bilge_raider_insignia", chance: 0.7, min: 1, max: 2 }],
  },
  {
    id: "frostfang",
    name: "Frostfang",
    tier: "basic",
    regions: ["FrostfallRange"],
    level: 55,
    statLevel: 5,
    maxHp: 64,
    attack: [5, 11],
    defense: 4,
    speed: 8,
    critical: 0.1,
    astra: 21,
    exp: 32,
    abilities: [
      { name: "Rime Bite", power: 1.2, status: { id: "bleed", turns: 3, power: 0.04, chance: 0.6 } },
      { name: "Whiteout Pounce", power: 1.7, cooldown: 2 },
    ],
    drops: [{ key: "frostfang_pelt", chance: 0.7, min: 1, max: 2 }],
  },
  {
    id: "trenchScavenger",
    name: "Trench Scavenger",
    tier: "basic",
    regions: ["ShatteredFront"],
    level: 85,
    statLevel: 5,
    maxHp: 68,
    attack: [5, 11],
    defense: 5,
    speed: 5,
    critical: 0.08,
    astra: 22,
    exp: 34,
    abilities: [
      { name: "Scrap Flurry", power: 0.75, hits: 2 },
      { name: "Suppressing Shot", power: 1.2, status: { id: "weaken", turns: 2, power: 0.2, chance: 0.5 } },
    ],
    drops: [{ key: "salvaged_dog_tag", chance: 0.7, min: 1, max: 2 }],
  },

  // Elite
  {
    id: "alphaWolf",
    name: "Alpha Wolf",
    tier: "elite",
    regions: ["Meadowlands"],
    level: 4,
    statLevel: 5,
    maxHp: 70,
    attack: [5, 12],
    defense: 4,
    speed: 9,
    critical: 0.12,
    astra: 18,
    exp: 30,
    abilities: [
      {
        name: "Howl",
        power: 0,
        self: { id: "enrage", turns: 3, power: 0.4 },
        cooldown: 5,
        weight: 3,
        text: "The alpha howls, and its eyes burn red.",
      },
      {
        name: "Rending Bite",
        power: 1.1,
        status: { id: "bleed", turns: 3, power: 0.05, chance: 0.9 },
      },
      { name: "Savage Pounce", power: 2, cooldown: 3 },
    ],
    drops: [
      { key: "wolf_pelt", chance: 1, min: 2, max: 3 },
      { key: "beast_fang", chance: 0.6, min: 1, max: 2 },
      { key: "primal_essence", chance: 0.25, min: 1, max: 1 },
    ],
  },
  {
    id: "goblinWarchief",
    name: "Goblin Warchief",
    tier: "elite",
    regions: ["Meadowlands"],
    level: 6,
    statLevel: 6,
    maxHp: 80,
    attack: [6, 13],
    defense: 6,
    speed: 6,
    critical: 0.1,
    astra: 22,
    exp: 36,
    abilities: [
      {
        name: "War Cry",
        power: 0,
        self: { id: "enrage", turns: 3, power: 0.35 },
        cooldown: 5,
        text: "The warchief bellows a rallying cry!",
      },
      {
        name: "Shield Bash",
        power: 1.3,
        status: { id: "stun", chance: 0.4 },
        cooldown: 3,
      },
      {
        name: "Dirty Trick",
        power: 0.9,
        status: { id: "weaken", turns: 3, power: 0.3 },
      },
    ],
    drops: [
      { key: "goblin_scrap", chance: 1, min: 3, max: 5 },
      { key: "primal_essence", chance: 0.3, min: 1, max: 1 },
      { key: "leather", chance: 0.5, min: 1, max: 3 },
      { key: "metal_scraps", chance: 0.3, min: 1, max: 3 },
    ],
  },
  {
    id: "venomweaver",
    name: "Venomweaver",
    tier: "elite",
    regions: ["Darkwood"],
    level: 10,
    statLevel: 8,
    maxHp: 85,
    attack: [7, 15],
    defense: 5,
    speed: 11,
    critical: 0.1,
    astra: 28,
    exp: 46,
    abilities: [
      {
        name: "Web Trap",
        power: 0,
        status: { id: "stun", chance: 0.85 },
        cooldown: 5,
        text: "Sticky threads drop from the canopy.",
      },
      {
        name: "Venom Bite",
        power: 1.2,
        status: { id: "poison", turns: 4, power: 0.035, chance: 1 },
      },
      { name: "Feast", power: 1.3, leech: 0.6, cooldown: 3 },
    ],
    drops: [
      { key: "spider_silk", chance: 1, min: 2, max: 4 },
      { key: "venom_sac", chance: 0.8, min: 1, max: 2 },
      { key: "primal_essence", chance: 0.3, min: 1, max: 1 },
    ],
  },
  {
    id: "flameWarden",
    name: "Flame Warden",
    tier: "elite",
    regions: ["AshenPeaks"],
    level: 20,
    statLevel: 10,
    maxHp: 100,
    attack: [8, 17],
    defense: 8,
    speed: 7,
    critical: 0.1,
    astra: 36,
    exp: 58,
    abilities: [
      {
        name: "Immolate",
        power: 1.2,
        status: { id: "burn", turns: 4, power: 0.05, chance: 1 },
      },
      {
        name: "Cinder Shield",
        power: 0,
        self: { id: "fortify", turns: 3, power: 0.4 },
        cooldown: 5,
        text: "Cinders swirl into a protective shell.",
      },
      {
        name: "Eruption",
        power: 2.2,
        status: { id: "vulnerable", turns: 2, power: 0.25, chance: 0.6 },
        cooldown: 3,
      },
    ],
    drops: [
      { key: "ember_core", chance: 0.5, min: 2, max: 4 },
      { key: "obsidian_shard", chance: 0.6, min: 1, max: 3 },
      { key: "primal_essence", chance: 0.35, min: 1, max: 1 },
    ],
  },
  {
    id: "livingScarecrow",
    name: "Living Scarecrow",
    tier: "elite",
    regions: ["Meadowlands"],
    level: 3,
    statLevel: 5,
    maxHp: 82,
    attack: [6, 13],
    defense: 5,
    speed: 8,
    critical: 0.1,
    astra: 28,
    exp: 46,
    abilities: [
      { name: "Haymaker", power: 1.6, cooldown: 2 },
      { name: "Thorned Stitching", power: 1.1, status: { id: "bleed", turns: 3, power: 0.04, chance: 0.65 } },
      { name: "Rooted Stance", power: 0, self: { id: "fortify", turns: 2, power: 0.3 }, cooldown: 4 },
    ],
    drops: [{ key: "living_thatch", chance: 0.75, min: 1, max: 2 }],
  },
  {
    id: "glassbackScorpion",
    name: "Glassback Scorpion",
    tier: "elite",
    regions: ["SuncleftExpanse"],
    level: 70,
    statLevel: 9,
    maxHp: 100,
    attack: [7, 15],
    defense: 7,
    speed: 9,
    critical: 0.1,
    astra: 34,
    exp: 55,
    abilities: [
      { name: "Venom Sting", power: 1.15, status: { id: "poison", turns: 4, power: 0.035, chance: 0.8 } },
      { name: "Shardshell", power: 0, self: { id: "fortify", turns: 3, power: 0.35 }, cooldown: 5 },
      { name: "Pincer Crush", power: 1.8, cooldown: 3 },
    ],
    drops: [{ key: "glassback_chitin", chance: 0.75, min: 1, max: 2 }],
  },
  {
    id: "reefStalker",
    name: "Reef Stalker",
    tier: "elite",
    regions: ["TempestReach"],
    level: 40,
    statLevel: 9,
    maxHp: 98,
    attack: [7, 15],
    defense: 6,
    speed: 12,
    critical: 0.12,
    astra: 35,
    exp: 57,
    abilities: [
      { name: "Undertow Lunge", power: 1.6, cooldown: 2 },
      { name: "Razor Fin", power: 1.1, status: { id: "bleed", turns: 3, power: 0.05, chance: 0.7 } },
      { name: "Reef Ambush", power: 0, status: { id: "stun", chance: 0.35 }, cooldown: 5 },
    ],
    drops: [{ key: "abyssal_scale", chance: 0.75, min: 1, max: 2 }],
  },
  {
    id: "rimeSentinel",
    name: "Rime Sentinel",
    tier: "elite",
    regions: ["FrostfallRange"],
    level: 55,
    statLevel: 10,
    maxHp: 110,
    attack: [8, 16],
    defense: 9,
    speed: 5,
    critical: 0.08,
    astra: 37,
    exp: 60,
    abilities: [
      { name: "Rime Spear", power: 1.6, status: { id: "vulnerable", turns: 2, power: 0.2, chance: 0.4 }, cooldown: 2 },
      { name: "Glacial Guard", power: 0, self: { id: "fortify", turns: 3, power: 0.4 }, cooldown: 5 },
      { name: "Shatter Strike", power: 1.8, below: 0.6 },
    ],
    drops: [{ key: "rimebound_plate", chance: 0.75, min: 1, max: 2 }],
  },
  {
    id: "frontlineVeteran",
    name: "Frontline Veteran",
    tier: "elite",
    regions: ["ShatteredFront"],
    level: 85,
    statLevel: 10,
    maxHp: 105,
    attack: [8, 16],
    defense: 8,
    speed: 7,
    critical: 0.1,
    astra: 38,
    exp: 62,
    abilities: [
      { name: "Bayonet Rush", power: 1.5, status: { id: "bleed", turns: 3, power: 0.04, chance: 0.6 }, cooldown: 2 },
      { name: "Covering Fire", power: 0, status: { id: "weaken", turns: 2, power: 0.25, chance: 0.6 }, cooldown: 4 },
      { name: "Combat Roll", power: 0, self: { id: "fortify", turns: 2, power: 0.25 }, cooldown: 4 },
    ],
    drops: [{ key: "war_hardened_insignia", chance: 0.75, min: 1, max: 2 }],
  },

  // Boss
  {
    id: "gelatinousKing",
    name: "Gelatinous King",
    tier: "boss",
    regions: ["Meadowlands"],
    level: 5,
    statLevel: 6,
    maxHp: 165,
    attack: [7, 15],
    defense: 6,
    speed: 6,
    critical: 0.08,
    astra: 40,
    exp: 70,
    abilities: [
      {
        name: "Engulf",
        power: 1.3,
        status: { id: "poison", turns: 3, power: 0.03, chance: 0.8 },
      },
      { name: "Acid Rain", power: 0.8, hits: 2 },
      {
        name: "Absorb",
        power: 0,
        heal: 0.1,
        below: 0.6,
        cooldown: 4,
        weight: 3,
        text: "The king swallows its own slime to mend itself.",
      },
    ],
    phases: [
      {
        below: 0.5,
        text: "The Gelatinous King quivers and swells in fury!",
        self: { id: "enrage", turns: 99, power: 0.3 },
        heal: 0.08,
      },
    ],
    drops: [
      { key: "gelatinous_core", chance: 0.5, min: 1, max: 1 },
      { key: "slime_gel", chance: 1, min: 4, max: 6 },
      { key: "primal_essence", chance: 0.6, min: 1, max: 2 },
    ],
  },
  {
    id: "widowQueen",
    name: "Widow Queen",
    tier: "boss",
    regions: ["Darkwood"],
    level: 10,
    statLevel: 9,
    maxHp: 150,
    attack: [7, 15],
    defense: 6,
    speed: 12,
    critical: 0.12,
    astra: 55,
    exp: 95,
    abilities: [
      {
        name: "Web Trap",
        power: 0,
        status: { id: "stun", chance: 0.9 },
        cooldown: 5,
        text: "The queen hurls a net of silk.",
      },
      {
        name: "Venom Bite",
        power: 1.3,
        status: { id: "poison", turns: 4, power: 0.035, chance: 1 },
      },
      { name: "Brood Feast", power: 1.2, leech: 0.7, cooldown: 3 },
      { name: "Skittering Flurry", power: 0.7, hits: 3, cooldown: 3 },
    ],
    phases: [
      {
        below: 0.5,
        text: "The Widow Queen shrieks, and her legs blur with speed!",
        self: { id: "enrage", turns: 99, power: 0.4 },
      },
    ],
    drops: [
      { key: "widow_heart", chance: 0.5, min: 1, max: 1 },
      { key: "spider_silk", chance: 1, min: 5, max: 8 },
      { key: "venom_sac", chance: 1, min: 2, max: 4 },
      { key: "primal_essence", chance: 0.6, min: 1, max: 2 },
    ],
  },
  {
    id: "wraithKing",
    name: "Wraith King",
    tier: "boss",
    regions: ["Darkwood"],
    level: 15,
    statLevel: 12,
    maxHp: 240,
    attack: [12, 24],
    defense: 10,
    speed: 10,
    critical: 0.1,
    astra: 70,
    exp: 120,
    abilities: [
      { name: "Soul Rend", power: 1.7, leech: 0.75, cooldown: 2 },
      {
        name: "Dread Aura",
        power: 0,
        status: { id: "weaken", turns: 3, power: 0.35, chance: 1 },
        cooldown: 4,
        text: "A crushing dread settles over you.",
      },
      {
        name: "Withering Curse",
        power: 1.15,
        status: { id: "vulnerable", turns: 3, power: 0.35, chance: 1 },
        cooldown: 4,
      },
    ],
    phases: [
      {
        below: 0.5,
        text: "The Wraith King's crown blazes with cold fire!",
        self: { id: "regen", turns: 99, power: 0.04 },
      },
      {
        below: 0.25,
        text: "The Wraith King howls, gripped by a ghostly rage!",
        self: { id: "enrage", turns: 99, power: 0.6 },
      },
    ],
    drops: [
      { key: "wraith_crown", chance: 0.5, min: 1, max: 1 },
      { key: "wraith_essence", chance: 1, min: 3, max: 5 },
      { key: "primal_essence", chance: 0.7, min: 1, max: 2 },
    ],
  },
  {
    id: "infernalDrake",
    name: "Infernal Drake",
    tier: "boss",
    regions: ["AshenPeaks"],
    level: 20,
    statLevel: 14,
    maxHp: 200,
    attack: [10, 21],
    defense: 10,
    speed: 8,
    critical: 0.1,
    astra: 90,
    exp: 150,
    abilities: [
      {
        name: "Flame Breath",
        power: 1.8,
        status: { id: "burn", turns: 4, power: 0.06, chance: 1 },
        cooldown: 3,
      },
      {
        name: "Tail Sweep",
        power: 1.4,
        status: { id: "stun", chance: 0.3 },
        cooldown: 3,
      },
      {
        name: "Scale Armor",
        power: 0,
        self: { id: "fortify", turns: 3, power: 0.4 },
        cooldown: 6,
        text: "The drake's scales glow white-hot.",
      },
      {
        name: "Rending Claws",
        power: 0.8,
        hits: 2,
        status: { id: "bleed", turns: 3, power: 0.05, chance: 0.7 },
      },
    ],
    phases: [
      {
        below: 0.5,
        text: "The Infernal Drake roars, and the air itself ignites!",
        self: { id: "enrage", turns: 99, power: 0.4 },
      },
    ],
    drops: [
      { key: "infernal_heart", chance: 0.5, min: 1, max: 1 },
      { key: "ember_core", chance: 0.85, min: 4, max: 6 },
      { key: "obsidian_shard", chance: 1, min: 3, max: 5 },
      { key: "primal_essence", chance: 0.7, min: 1, max: 3 },
    ],
  },
  {
    id: "buriedWyrm",
    name: "Buried Wyrm",
    tier: "boss",
    regions: ["SuncleftExpanse"],
    level: 70,
    statLevel: 14,
    maxHp: 235,
    attack: [11, 23],
    defense: 10,
    speed: 7,
    critical: 0.1,
    astra: 88,
    exp: 145,
    abilities: [
      { name: "Sandstorm", power: 0, status: { id: "weaken", turns: 3, power: 0.3, chance: 1 }, cooldown: 4 },
      { name: "Burrowing Charge", power: 1.8, cooldown: 2 },
      { name: "Wyrm's Bite", power: 1.4, hits: 2, status: { id: "bleed", turns: 3, power: 0.05, chance: 0.6 } },
    ],
    phases: [{ below: 0.5, text: "The Buried Wyrm tears through the dunes in a frenzy!", self: { id: "enrage", turns: 99, power: 0.35 } }],
    drops: [{ key: "buried_wyrm_scale", chance: 0.55, min: 1, max: 1 }],
  },
  {
    id: "leviathan",
    name: "Leviathan",
    tier: "boss",
    regions: ["TempestReach"],
    level: 40,
    statLevel: 15,
    maxHp: 260,
    attack: [12, 26],
    defense: 10,
    speed: 8,
    critical: 0.1,
    astra: 95,
    exp: 160,
    abilities: [
      { name: "Tidal Slam", power: 1.7, status: { id: "stun", chance: 0.3 }, cooldown: 3 },
      { name: "Undertow", power: 1.3, leech: 0.5, cooldown: 2 },
      { name: "Maelstrom", power: 0.8, hits: 2, status: { id: "weaken", turns: 2, power: 0.2, chance: 0.5 }, cooldown: 4 },
    ],
    phases: [{ below: 0.5, text: "The Leviathan rises higher above the waves, drawing the storm around it!", self: { id: "enrage", turns: 99, power: 0.35 } }],
    drops: [{ key: "leviathan_heart", chance: 0.55, min: 1, max: 1 }],
  },
  {
    id: "avalancheColossus",
    name: "Avalanche Colossus",
    tier: "boss",
    regions: ["FrostfallRange"],
    level: 55,
    statLevel: 16,
    maxHp: 280,
    attack: [12, 25],
    defense: 12,
    speed: 4,
    critical: 0.08,
    astra: 98,
    exp: 165,
    abilities: [
      { name: "Avalanche Crush", power: 1.8, status: { id: "stun", chance: 0.35 }, cooldown: 3 },
      { name: "Permafrost Armor", power: 0, self: { id: "fortify", turns: 3, power: 0.4 }, cooldown: 5 },
      { name: "Glacier Fist", power: 1.6, below: 0.6 },
    ],
    phases: [{ below: 0.5, text: "The Avalanche Colossus shakes the mountain as its glacier core flares!", self: { id: "enrage", turns: 99, power: 0.35 } }],
    drops: [{ key: "glacier_core", chance: 0.55, min: 1, max: 1 }],
  },
  {
    id: "siegeCaptain",
    name: "Siege Captain",
    tier: "boss",
    regions: ["ShatteredFront"],
    level: 85,
    statLevel: 16,
    maxHp: 245,
    attack: [13, 25],
    defense: 11,
    speed: 9,
    critical: 0.12,
    astra: 100,
    exp: 170,
    abilities: [
      { name: "Rally the Line", power: 0, self: { id: "enrage", turns: 3, power: 0.35 }, cooldown: 5 },
      { name: "Shield Breaker", power: 1.6, status: { id: "vulnerable", turns: 2, power: 0.25, chance: 0.6 }, cooldown: 3 },
      { name: "Commanding Strike", power: 1.7, status: { id: "weaken", turns: 2, power: 0.2, chance: 0.5 } },
    ],
    phases: [{ below: 0.5, text: "The Siege Captain rallies the remaining forces and presses the attack!", self: { id: "enrage", turns: 99, power: 0.35 } }],
    drops: [{ key: "commanders_crest", chance: 0.55, min: 1, max: 1 }],
  },

  // ---- Upper-range threats that appear deeper into each region ----
  {
    id: "rotwoodElder",
    name: "Rotwood Elder",
    tier: "elite",
    regions: ["Darkwood"],
    level: 15,
    statLevel: 8,
    maxHp: 110,
    attack: [7, 15],
    defense: 8,
    speed: 4,
    critical: 0.06,
    astra: 30,
    exp: 48,
    abilities: [
      { name: "Crushing Bough", power: 1.6, cooldown: 2 },
      { name: "Strangling Roots", power: 0.8, status: { id: "stun", chance: 0.4 }, cooldown: 4 },
      { name: "Sap Bloom", power: 0, heal: 0.12, below: 0.5, cooldown: 5, weight: 3, text: "Dark sap seals the Elder's wounds." },
    ],
    drops: [
      { key: "rotwood_bark", chance: 0.8, min: 2, max: 3 },
      { key: "primal_essence", chance: 0.3, min: 1, max: 1 },
    ],
  },
  {
    id: "cinderHound",
    name: "Cinder Hound",
    tier: "basic",
    regions: ["AshenPeaks"],
    level: 28,
    statLevel: 8,
    maxHp: 70,
    attack: [7, 14],
    defense: 4,
    speed: 11,
    critical: 0.12,
    astra: 32,
    exp: 50,
    abilities: [
      { name: "Searing Bite", power: 1.2, status: { id: "burn", turns: 3, power: 0.04, chance: 0.6 } },
      { name: "Pack Lunge", power: 1.7, cooldown: 2 },
    ],
    drops: [
      { key: "obsidian_shard", chance: 0.5, min: 1, max: 2 },
      { key: "beast_fang", chance: 0.35, min: 1, max: 2 },
    ],
  },
  {
    id: "ashenWarlord",
    name: "Ashen Warlord",
    tier: "elite",
    regions: ["AshenPeaks"],
    level: 30,
    statLevel: 11,
    maxHp: 115,
    attack: [9, 18],
    defense: 9,
    speed: 7,
    critical: 0.1,
    astra: 40,
    exp: 64,
    abilities: [
      { name: "Molten Cleave", power: 1.7, status: { id: "burn", turns: 3, power: 0.05, chance: 0.5 }, cooldown: 2 },
      { name: "War Cry", power: 0, self: { id: "enrage", turns: 3, power: 0.3 }, cooldown: 5 },
      { name: "Obsidian Guard", power: 0, self: { id: "fortify", turns: 3, power: 0.35 }, below: 0.5, cooldown: 6 },
    ],
    drops: [
      { key: "ember_core", chance: 0.6, min: 1, max: 2 },
      { key: "obsidian_shard", chance: 0.6, min: 1, max: 3 },
      { key: "primal_essence", chance: 0.35, min: 1, max: 1 },
    ],
  },
  {
    id: "drownedDeckhand",
    name: "Drowned Deckhand",
    tier: "basic",
    regions: ["TempestReach"],
    level: 46,
    statLevel: 5,
    maxHp: 70,
    attack: [5, 11],
    defense: 4,
    speed: 5,
    critical: 0.08,
    astra: 21,
    exp: 32,
    abilities: [
      { name: "Waterlogged Grip", power: 1.1, status: { id: "weaken", turns: 2, power: 0.2, chance: 0.6 } },
      { name: "Anchor Swing", power: 1.8, cooldown: 3 },
    ],
    drops: [{ key: "bilge_raider_insignia", chance: 0.6, min: 1, max: 2 }],
  },
  {
    id: "stormHarpy",
    name: "Storm Harpy",
    tier: "elite",
    regions: ["TempestReach"],
    level: 48,
    statLevel: 10,
    maxHp: 95,
    attack: [8, 16],
    defense: 5,
    speed: 14,
    critical: 0.14,
    astra: 37,
    exp: 60,
    abilities: [
      { name: "Gale Talons", power: 0.75, hits: 3 },
      { name: "Thunder Shriek", power: 0.8, status: { id: "stun", chance: 0.35 }, cooldown: 4 },
      { name: "Tailwind", power: 0, self: { id: "enrage", turns: 3, power: 0.25 }, cooldown: 5 },
    ],
    drops: [{ key: "abyssal_scale", chance: 0.75, min: 1, max: 2 }],
  },
  {
    id: "snowdriftYeti",
    name: "Snowdrift Yeti",
    tier: "basic",
    regions: ["FrostfallRange"],
    level: 61,
    statLevel: 6,
    maxHp: 85,
    attack: [6, 12],
    defense: 6,
    speed: 4,
    critical: 0.06,
    astra: 24,
    exp: 36,
    abilities: [
      { name: "Avalanche Slam", power: 1.7, status: { id: "stun", chance: 0.3 }, cooldown: 3 },
      { name: "Frozen Hide", power: 0, self: { id: "fortify", turns: 3, power: 0.35 }, cooldown: 5 },
    ],
    drops: [{ key: "frostfang_pelt", chance: 0.6, min: 1, max: 2 }],
  },
  {
    id: "frostWyvern",
    name: "Frost Wyvern",
    tier: "elite",
    regions: ["FrostfallRange"],
    level: 63,
    statLevel: 11,
    maxHp: 115,
    attack: [9, 17],
    defense: 8,
    speed: 10,
    critical: 0.1,
    astra: 40,
    exp: 64,
    abilities: [
      { name: "Glacial Breath", power: 1.4, status: { id: "weaken", turns: 2, power: 0.25, chance: 0.6 }, cooldown: 3 },
      { name: "Icicle Barrage", power: 0.6, hits: 3 },
      { name: "Wing Buffet", power: 1.2, status: { id: "vulnerable", turns: 2, power: 0.2, chance: 0.5 } },
    ],
    drops: [{ key: "rimebound_plate", chance: 0.75, min: 1, max: 2 }],
  },
  {
    id: "sandscourNomad",
    name: "Sandscour Nomad",
    tier: "basic",
    regions: ["SuncleftExpanse"],
    level: 76,
    statLevel: 6,
    maxHp: 66,
    attack: [6, 12],
    defense: 4,
    speed: 9,
    critical: 0.12,
    astra: 24,
    exp: 36,
    abilities: [
      { name: "Sand in the Eyes", power: 0.7, status: { id: "weaken", turns: 2, power: 0.25, chance: 0.7 } },
      { name: "Curved Blade", power: 1.2, status: { id: "bleed", turns: 3, power: 0.04, chance: 0.6 } },
    ],
    drops: [{ key: "suncleft_scourge_fang", chance: 0.6, min: 1, max: 2 }],
  },
  {
    id: "sunCursedSentinel",
    name: "Sun-Cursed Sentinel",
    tier: "elite",
    regions: ["SuncleftExpanse"],
    level: 78,
    statLevel: 11,
    maxHp: 120,
    attack: [8, 17],
    defense: 10,
    speed: 6,
    critical: 0.08,
    astra: 40,
    exp: 64,
    abilities: [
      { name: "Solar Lance", power: 1.6, status: { id: "burn", turns: 3, power: 0.05, chance: 0.6 }, cooldown: 2 },
      { name: "Gilded Ward", power: 0, self: { id: "fortify", turns: 3, power: 0.35 }, cooldown: 6 },
      { name: "Judgement", power: 1.3, ignoreDefense: 0.3 },
    ],
    drops: [{ key: "glassback_chitin", chance: 0.75, min: 1, max: 2 }],
  },
  {
    id: "shellshockGunner",
    name: "Shellshock Gunner",
    tier: "basic",
    regions: ["ShatteredFront"],
    level: 91,
    statLevel: 6,
    maxHp: 70,
    attack: [6, 13],
    defense: 5,
    speed: 6,
    critical: 0.12,
    astra: 25,
    exp: 38,
    abilities: [
      { name: "Suppressing Fire", power: 0.5, hits: 3 },
      { name: "Shrapnel Round", power: 1.3, status: { id: "bleed", turns: 3, power: 0.05, chance: 0.6 }, cooldown: 2 },
    ],
    drops: [{ key: "salvaged_dog_tag", chance: 0.6, min: 1, max: 2 }],
  },
  {
    id: "ironcladJuggernaut",
    name: "Ironclad Juggernaut",
    tier: "elite",
    regions: ["ShatteredFront"],
    level: 93,
    statLevel: 12,
    maxHp: 135,
    attack: [9, 18],
    defense: 11,
    speed: 4,
    critical: 0.08,
    astra: 42,
    exp: 68,
    abilities: [
      { name: "Battering Ram", power: 1.8, status: { id: "stun", chance: 0.35 }, cooldown: 3 },
      { name: "Plated Advance", power: 0, self: { id: "fortify", turns: 3, power: 0.4 }, cooldown: 5 },
      { name: "Rivet Spray", power: 0.6, hits: 3, ignoreDefense: 0.2 },
    ],
    drops: [{ key: "war_hardened_insignia", chance: 0.75, min: 1, max: 2 }],
  },
];

const GEAR_SCORE_PER_LEVEL = 150;
// Region rarity bonuses never push guaranteed gear rarity past Legendary.
const MAX_REGION_RARITY = 4;
// Enemies never get weaker than this fraction of their normal stats.
const MIN_UNDERGEAR_FACTOR = 0.4;

// Expected gear score is playerLevel * 150. Below that, enemy stats shrink proportionally (floored).
export const getUndergearFactor = (playerLevel = 1, gearScore = 0) => {
  const expected = Math.max(1, Number(playerLevel) || 1) * GEAR_SCORE_PER_LEVEL;
  const ratio = (Number(gearScore) || 0) / expected;
  return Math.min(1, Math.max(MIN_UNDERGEAR_FACTOR, ratio));
};

const randBetween = (min, max) =>
  min + Math.floor(Math.random() * (max - min + 1));

// Highest level an enemy can spawn at for a player in `region`: two above their effective level, within the region's range.
const getSpawnCeiling = (region, playerLevel) =>
  clampToRegion(Math.max(1, Number(playerLevel) || 1) + 2, region);

// Templates of `tier` found in `region` that can spawn for a player of `playerLevel`.
export const getEnemyCandidates = (tier, region, playerLevel) =>
  ENEMIES.filter(
    (e) =>
      !e.eventOnly &&
      e.tier === tier &&
      e.regions.includes(region) &&
      e.level <= getSpawnCeiling(region, playerLevel),
  );

export const hasEnemy = (tier, region, playerLevel) =>
  getEnemyCandidates(tier, region, playerLevel).length > 0;

// The level enemies scale to: the player's level or gear score / 150, whichever is higher.
export const getEffectiveLevel = (playerLevel = 1, gearScore = 0) =>
  Math.max(
    1,
    Number(playerLevel) || 1,
    Math.floor((Number(gearScore) || 0) / GEAR_SCORE_PER_LEVEL),
  );

// Spawn level: 1 below to 2 above the effective level, kept inside the region's level range.
const rollSpawnLevel = (region, effectiveLevel) =>
  clampToRegion(
    randBetween(Math.max(1, effectiveLevel - 1), effectiveLevel + 2),
    region,
  );

// Picks and scales a random enemy of the tier for the region. Returns null if none are available.
// Stats are written for the template's `statLevel` and grow with the spawn level, then the region's danger applies.
export const getRandomEnemy = (
  tier = "basic",
  region,
  playerLevel = 1,
  gearScore = 0,
  templateId = null,
) => {
  const level0 = getEffectiveLevel(playerLevel, gearScore);
  const rolled = rollSpawnLevel(region, level0);
  let candidates;
  if (templateId) {
    // A specific template (including event-only enemies) can be requested by id.
    candidates = ENEMIES.filter((e) => e.id === templateId);
  } else {
    const pool = ENEMIES.filter(
      (e) => !e.eventOnly && e.tier === tier && e.regions.includes(region),
    );
    candidates = pool.filter((e) => e.level <= rolled);
    if (!candidates.length) candidates = getEnemyCandidates(tier, region, level0);
  }
  if (!candidates.length) return null;
  const template = candidates[Math.floor(Math.random() * candidates.length)];
  const t = TIERS[template.tier];
  const zone = REGIONS[region] || REGIONS[template.regions[0]] || {};
  const danger = zone.danger || 1;
  const rewardMult = zone.reward || 1;
  const level = clampToRegion(Math.max(rolled, template.level), region);
  const statLevel = template.statLevel ?? template.level;
  const d = level - statLevel;
  // Above the stat level each level adds `k` of the base; below it, stats shrink in proportion to the level.
  const grow = (k) => (d >= 0 ? 1 + d * k : level / statLevel);
  const weak = getUndergearFactor(playerLevel, gearScore);

  const round = Math.round;
  const levelScaled = {
    maxHp: template.maxHp * grow(0.5) * t.hp * danger * weak,
    attack: template.attack.map((v) => v * grow(0.4) * t.attack * danger * weak),
    defense: template.defense * grow(0.3) * t.defense * danger * weak,
    speed: template.speed * grow(0.3) * (0.5 + 0.5 * weak),
  };
  return {
    ...template,
    region,
    level,
    tierLabel: t.label,
    tierColor: t.color,
    maxHp: round(levelScaled.maxHp),
    attack: levelScaled.attack.map((v) => round(v)),
    defense: round(levelScaled.defense),
    speed: round(levelScaled.speed),
    critical: getEnemyCriticalChance(template.tier, template.critical),
    astra: round(template.astra * grow(0.25) * t.reward * rewardMult),
    exp: round(template.exp * grow(0.25) * t.reward * rewardMult),
    dropChance: Math.min(1, t.dropChance + (zone.dropBonus || 0)),
    minRarity: Math.min(MAX_REGION_RARITY, t.minRarity + (zone.rarityBonus || 0)),
    dotResist: t.dotResist,
    stunResist: t.stunResist,
    statusResistance: getEnemyStatusResistance(template.tier, "travel", (level - 1) / 100),
    materialAmount: t.materialAmount,
  };
};

// Dungeon legendary/unique material rates are fixed; other drops receive `chanceBonus`. Returns { key: amount }.
export const rollMaterialDrops = (enemy, chanceBonus = 0) => {
  const out = {};
  for (const d of enemy.drops || []) {
    const fixedChance = enemy.dungeon && ["legendary", "unique"].includes(MATERIALS[d.key]?.tier);
    if (
      !MATERIALS[d.key] ||
      Math.random() >= Math.min(1, d.chance + (fixedChance ? 0 : chanceBonus))
    )
      continue;
    const amount = Math.max(
      1,
      Math.round(randBetween(d.min, d.max) * (enemy.materialAmount || 1)),
    );
    out[d.key] = (out[d.key] || 0) + amount;
  }
  return out;
};
