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
*/
export const ABILITIES = [
  {
    name: "Vampiric",
    description: "Heal for 1% of damage dealt.",
    slots: ["weapon", "gauntlets", "ring"],
    effects: { lifesteal: 0.01 },
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
    description: "Restore half your max power when landing a critical hit.",
    slots: ["weapon", "offhand", "ring", "necklace"],
    effects: { surge: 0.5 },
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

export const findAbility = (ability) => ABILITIES.find((a) => a.name === ability?.name) || null;

// Sums the effects of every equipped item's ability.
export const getAbilityTotals = (player) => {
  const totals = {};
  for (const item of Object.values(player?.equipment || {})) {
    const def = findAbility(item?.ability);
    if (!def) continue;
    for (const [k, v] of Object.entries(def.effects)) totals[k] = (totals[k] || 0) + v;
  }
  return totals;
};
