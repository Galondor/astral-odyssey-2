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
    name: "Colossus Breaker",
    description: "Your attacks deal 20% more damage.",
    effects: { damageBonus: 0.2 },
  },
];

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
