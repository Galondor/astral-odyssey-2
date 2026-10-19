import { MATERIALS } from "../items/materials";
import { STATUSES } from "./statuses";

/*
 Enemies. Each template is { id, name, tier, regions, level, maxHp, attack, defense, speed, critical,
 astra, exp, abilities, drops, phases? }. Stats are for the template's own level and scale up with the level it spawns at.
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
    hp: 1,
    attack: 1.6,
    defense: 1.3,
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
    hp: 2,
    attack: 2.2,
    defense: 2.5,
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
    hp: 4,
    attack: 3.5,
    defense: 4,
    reward: 8,
    dropChance: 0.75,
    minRarity: 3,
    materialAmount: 2,
    dotResist: 0.5,
    stunResist: 1,
  },
};

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
    regions: ["Meadowlands", "Darkwood"],
    level: 1,
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
    regions: ["Meadowlands", "Darkwood"],
    level: 2,
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
    drops: [{ key: "boar_tusk", chance: 0.6, min: 1, max: 2 }],
  },
  {
    id: "goblinScavenger",
    name: "Goblin Scavenger",
    tier: "basic",
    regions: ["Meadowlands", "Darkwood", "AshenPeaks"],
    level: 3,
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
    drops: [{ key: "goblin_scrap", chance: 0.75, min: 1, max: 3 }],
  },
  {
    id: "giantSpider",
    name: "Giant Spider",
    tier: "basic",
    regions: ["Darkwood"],
    level: 4,
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
        status: { id: "stun", chance: 0.6 },
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
    level: 4,
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
    regions: ["Darkwood", "AshenPeaks"],
    level: 6,
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
    level: 7,
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
    level: 8,
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

  // Elite
  {
    id: "alphaWolf",
    name: "Alpha Wolf",
    tier: "elite",
    regions: ["Meadowlands", "Darkwood"],
    level: 5,
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
    regions: ["Meadowlands", "Darkwood", "AshenPeaks"],
    level: 6,
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
    ],
  },
  {
    id: "venomweaver",
    name: "Venomweaver",
    tier: "elite",
    regions: ["Darkwood"],
    level: 8,
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
        status: { id: "stun", chance: 0.7 },
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
    level: 10,
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

  // Boss
  {
    id: "gelatinousKing",
    name: "Gelatinous King",
    tier: "boss",
    regions: ["Meadowlands"],
    level: 6,
    maxHp: 130,
    attack: [5, 12],
    defense: 4,
    speed: 4,
    critical: 0.08,
    astra: 40,
    exp: 70,
    abilities: [
      {
        name: "Engulf",
        power: 1.4,
        status: { id: "poison", turns: 4, power: 0.03, chance: 1 },
      },
      { name: "Acid Rain", power: 0.8, hits: 2 },
      {
        name: "Absorb",
        power: 0,
        heal: 0.12,
        below: 0.8,
        cooldown: 4,
        weight: 3,
        text: "The king swallows its own slime to mend itself.",
      },
    ],
    phases: [
      {
        below: 0.5,
        text: "The Gelatinous King quivers and swells in fury!",
        self: { id: "enrage", turns: 99, power: 0.35 },
        heal: 0.1,
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
    level: 9,
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
        status: { id: "stun", chance: 0.6 },
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
    regions: ["Darkwood", "AshenPeaks"],
    level: 12,
    maxHp: 170,
    attack: [9, 19],
    defense: 5,
    speed: 9,
    critical: 0.1,
    astra: 70,
    exp: 120,
    abilities: [
      { name: "Soul Rend", power: 1.5, leech: 0.6, cooldown: 2 },
      {
        name: "Dread Aura",
        power: 0,
        status: { id: "weaken", turns: 3, power: 0.3, chance: 1 },
        cooldown: 4,
        text: "A crushing dread settles over you.",
      },
      {
        name: "Withering Curse",
        power: 1,
        status: { id: "vulnerable", turns: 3, power: 0.3, chance: 1 },
        cooldown: 4,
      },
    ],
    phases: [
      {
        below: 0.5,
        text: "The Wraith King's crown blazes with cold fire!",
        self: { id: "regen", turns: 99, power: 0.03 },
      },
      {
        below: 0.25,
        text: "The Wraith King howls, gripped by a ghostly rage!",
        self: { id: "enrage", turns: 99, power: 0.5 },
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
    level: 14,
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
];

const GEAR_SCORE_PER_LEVEL = 100;
// Enemies never get weaker than this fraction of their normal stats.
const MIN_UNDERGEAR_FACTOR = 0.4;

// Expected gear score is playerLevel * 100. Below that, enemy stats shrink proportionally (floored).
export const getUndergearFactor = (playerLevel = 1, gearScore = 0) => {
  const expected = Math.max(1, Number(playerLevel) || 1) * GEAR_SCORE_PER_LEVEL;
  const ratio = (Number(gearScore) || 0) / expected;
  return Math.min(1, Math.max(MIN_UNDERGEAR_FACTOR, ratio));
};

const randBetween = (min, max) =>
  min + Math.floor(Math.random() * (max - min + 1));

// Templates of `tier` found in `region` that suit a player of `playerLevel` (nothing far above their level).
export const getEnemyCandidates = (tier, region, playerLevel) =>
  ENEMIES.filter(
    (e) =>
      e.tier === tier &&
      e.regions.includes(region) &&
      e.level <= playerLevel + 4,
  );

export const hasEnemy = (tier, region, playerLevel) =>
  getEnemyCandidates(tier, region, playerLevel).length > 0;

// The level enemies scale to: the player's level or gear score / 100, whichever is higher.
export const getEffectiveLevel = (playerLevel = 1, gearScore = 0) =>
  Math.max(
    1,
    Number(playerLevel) || 1,
    Math.floor((Number(gearScore) || 0) / GEAR_SCORE_PER_LEVEL),
  );

// Level the enemy spawns at: 1 below to 5 above the effective level, never below the template's own level.
const rollLevel = (template, effectiveLevel) =>
  Math.min(
    150,
    Math.max(
      template.level,
      randBetween(Math.max(1, effectiveLevel - 1), effectiveLevel + 5),
    ),
  );

// Picks and scales a random enemy of the tier for the region. Returns null if none are available.
export const getRandomEnemy = (
  tier = "basic",
  region,
  playerLevel = 1,
  gearScore = 0,
) => {
  const level0 = getEffectiveLevel(playerLevel, gearScore);
  const candidates = getEnemyCandidates(tier, region, level0);
  if (!candidates.length) return null;
  const template = candidates[Math.floor(Math.random() * candidates.length)];
  const t = TIERS[template.tier];
  const level = rollLevel(template, level0);
  const d = level - template.level;
  const weak = getUndergearFactor(playerLevel, gearScore);

  const round = Math.round;
  const levelScaled = {
    maxHp: template.maxHp * (1 + d * 0.4) * t.hp * weak,
    attack: template.attack.map((v) => v * (1 + d * 0.3) * t.attack * weak),
    defense: template.defense * (1 + d * 0.2) * t.defense * weak,
    speed: template.speed * (1 + d * 0.25) * (0.5 + 0.5 * weak),
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
    astra: round(template.astra * (1 + d * 0.25) * t.reward),
    exp: round(template.exp * (1 + d * 0.25) * t.reward),
    dropChance: t.dropChance,
    minRarity: t.minRarity,
    dotResist: t.dotResist,
    stunResist: t.stunResist,
    materialAmount: t.materialAmount,
  };
};

// Rolls the materials an enemy drops. `chanceBonus` is added to each drop chance. Returns { key: amount }.
export const rollMaterialDrops = (enemy, chanceBonus = 0) => {
  const out = {};
  for (const d of enemy.drops || []) {
    if (
      !MATERIALS[d.key] ||
      Math.random() >= Math.min(1, d.chance + chanceBonus)
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
