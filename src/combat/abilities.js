/*
 Item abilities. Items save `ability: { name, description }`; the live definition is looked up by name, so
 effects and wording can be rebalanced without breaking saved items.
 Ability fields:
   name, description, slots (item slot types it can roll on)
   effects - numbers that are summed across every equipped item (see getAbilityTotals):
     lifesteal     fraction of damage dealt healed
     speedMult     added to your speed multiplier (turn order and speed comparisons)
     reflect       fraction of damage taken returned to the attacker
     secondWind    once per combat, heal this fraction of max health when dropping to 10% health
     astraBonus    extra astra from kills
     surge         fraction of max power restored when you land a critical hit
     damageReduction  fraction of damage taken negated (capped at 60% in total)
     damageBonus   extra damage dealt
     pierce        fraction of enemy defense ignored
     ignite        chance for hits to set the enemy on fire
    weakened      chance for hits to weaken the enemy
    poison        chance for hits to poison the enemy
*/
export const ABILITIES = [
  {
    name: "Vampiric",
    description: "Heal for 5% of damage dealt.",
    slots: ["weapon", "gauntlets", "ring"],
    effects: { lifesteal: 0.05 },
  },
  {
    name: "Swift",
    description: "Increase speed by 50% when determining turn order and speed comparisons.",
    slots: ["boots"],
    effects: { speedMult: 0.5 },
  },
  {
    name: "Thorny",
    description: "Reflect 10% of damage taken back to the attacker.",
    slots: ["chestplate", "legs", "boots", "gauntlets", "helmet"],
    effects: { reflect: 0.1 },
  },
  {
    name: "Second Wind",
    description: "Once per combat, recover 50% health when falling below 10% health.",
    slots: ["necklace", "chestplate"],
    effects: { secondWind: 0.5 },
  },
  {
    name: "Fortunate",
    description: "Increase astra gain by 10%.",
    slots: ["ring", "necklace", "gauntlets"],
    effects: { astraBonus: 0.1 },
  },
  {
    name: "Arcane Surge",
    description: "Restore 25% of your max power when landing a critical hit.",
    slots: ["weapon", "offhand", "ring", "necklace"],
    effects: { surge: 0.25 },
  },
  {
    name: "Protective",
    description: "Reduce damage taken by 10%.",
    slots: ["chestplate", "legs", "boots", "gauntlets", "helmet"],
    effects: { damageReduction: 0.1 },
  },
  {
    name: "Empowered",
    description: "Increase damage dealt by 10%.",
    slots: ["weapon", "offhand", "gauntlets"],
    effects: { damageBonus: 0.1 },
  },
  {
    name: "Piercing",
    description: "Ignore 25% of the enemy's defense.",
    slots: ["weapon", "offhand", "gauntlets", "ring"],
    effects: { pierce: 0.25 },
  },
  {
    name: "Scorching",
    description: "Hits have a 15% chance to set the enemy on fire.",
    slots: ["weapon", "offhand", "ring", "necklace"],
    effects: { ignite: 0.15 },
  },
];

// Fixed combat mechanics of Unique gear (dropped by dungeon bosses).
export const UNIQUE_ABILITIES = [
  {
    name: "Undying Hunger",
    description: "Striking an enemy with a damage-over-time effect restores 8% of your maximum health.",
    uniqueEffect: "undyingHunger",
    effects: {},
  },
  {
    name: "Marrow Ward",
    description: "A bone ward absorbs damage equal to 20% of your maximum health at the start of each combat.",
    uniqueEffect: "marrowWard",
    effects: {},
  },
  {
    name: "Plunder",
    description: "Defeating an enemy grants 10% more astra for each different harmful effect on it, up to 30%.",
    uniqueEffect: "plunder",
    effects: {},
  },
  {
    name: "Fortune's Spark",
    description: "Critical hits have a 25% chance to deal 100% to 300% more damage.",
    uniqueEffect: "fortunesSpark",
    effects: {},
  },
  {
    name: "Molten Grip",
    description: "Hitting a burning enemy detonates the burn damage for 100% more damage.",
    uniqueEffect: "moltenGrip",
    effects: {},
  },
  {
    name: "Tempered Steel",
    description: "Every second enemy strike is blocked, then answered with a counterattack.",
    uniqueEffect: "temperedSteel",
    effects: {},
  },
  {
    name: "Frozen Resolve",
    description: "When an enemy hits you, you have a 10% chance to stun it.",
    uniqueEffect: "frozenResolve",
    effects: {},
  },
  {
    name: "Glacial Edge",
    description: "Striking a vulnerable enemy shatters them, dealing 35% more damage.",
    uniqueEffect: "glacialEdge",
    effects: {},
  },
  {
    name: "Rootstride",
    description: "If you act first, your first strike roots the enemy and steals its first action.",
    uniqueEffect: "rootstride",
    effects: {},
  },
  {
    name: "Bloom of Decay",
    description: "Every hit adds a poison stack, up to 5 stacks.",
    uniqueEffect: "bloomOfDecay",
    effects: {},
  },
  {
    name: "Orbital Focus",
    description: "Critical hits launch a second attack form orbit that deals 35% of the critical hit's damage.",
    uniqueEffect: "orbitalFocus",
    effects: {},
  },
  {
    name: "Star-Charted",
    description: "Use a basic melee attack, a basic magic attack, and a skill to align a constellation; your next strike stuns and deals 150% more damage.",
    uniqueEffect: "starCharted",
    effects: {},
  },
  {
    name: "Unwritten Path",
    description: "Every third attack discovers an impossible shortcut, ignoring the enemy's defense and dealing double damage.",
    uniqueEffect: "unwrittenPath",
    effects: {},
  },
  {
    name: "Saltblood Tide",
    description: "Your hits make enemies bleed. Every 4th hit the tide breaks, dealing all of the remaining bleed damage at once and healing the most wounded ally (you when alone) for half of it, up to 15% of their max health.",
    uniqueEffect: "saltbloodTide",
    effects: {},
  },
  {
    name: "Chronal Loop",
    description: "Every 3rd attack or skill echoes through time and repeats at 30% power for free. Echoed support skills repeat their healing and shielding.",
    uniqueEffect: "temporalEcho",
    effects: {},
  },
  {
    name: "Star-Eater's Hunger",
    description: "Your hits devour one enemy buff (Enraged, Fortified, Regenerating, Empowered, Shielded or Warded), healing you for 10% of your max health and adding 15% damage for the rest of the fight, up to 45%. In group combat, defeating an enemy also feeds the hunger.",
    uniqueEffect: "starEaterHunger",
    effects: {},
  },
  {
    name: "Colossus Breaker",
    description: "Your attacks deal 20% more damage.",
    effects: { damageBonus: 0.2 },
  },
];

// Tuning for the group dungeon boss uniques (shared by solo and group combat).
export const SALTBLOOD_TIDE = { every: 4, bleed: { turns: 3, power: 0.03 }, healShare: 0.5, healCap: 0.15 };
export const TEMPORAL_ECHO = { every: 3, power: 0.3 };
export const STAR_EATER = { buffs: ["enrage", "fortify", "regen", "empower", "barrier", "warded"], heal: 0.1, bonus: 0.15, maxStacks: 3 };

// Counts an action toward Chronal Loop; returns true when this action echoes. `state` holds echoCount.
export const advanceEcho = (state, ab) => {
  if (!ab?.uniqueEffects?.includes("temporalEcho")) return false;
  state.echoCount = (state.echoCount || 0) + 1;
  if (state.echoCount < TEMPORAL_ECHO.every) return false;
  state.echoCount = 0;
  return true;
};

// Total damage left on a bleed: every remaining tick at once.
export const bleedRemaining = (bleed, maxHp) =>
  Math.max(1, Math.round(maxHp * bleed.power * bleed.stacks * Math.max(1, bleed.turns)));

export const findAbility = (ability) =>
  ABILITIES.find((a) => a.name === ability?.name) ||
  UNIQUE_ABILITIES.find((a) => a.name === ability?.name) ||
  null;

// Sums the effects of every equipped item's ability.
export const getAbilityTotals = (player) => {
  const totals = { uniqueEffects: [] };
  for (const item of Object.values(player?.equipment || {})) {
    const def = findAbility(item?.ability);
    if (!def) continue;
    for (const [k, v] of Object.entries(def.effects)) totals[k] = (totals[k] || 0) + v;
    if (def.uniqueEffect) totals.uniqueEffects.push(def.uniqueEffect);
  }
  return totals;
};
