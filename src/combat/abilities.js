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

// Fixed abilities of Unique gear (dropped by dungeon bosses). Same fields as ABILITIES; never rolled at random.
export const UNIQUE_ABILITIES = [
  { name: "Undying Hunger", description: "Heal for 6% of damage dealt. Once per combat, recover 75% health when falling below 10% health.", effects: { lifesteal: 0.06, secondWind: 0.75 } },
  { name: "Marrow Ward", description: "Reduce damage taken by 20% and reflect 20% of damage taken back to the attacker.", effects: { damageReduction: 0.2, reflect: 0.2 } },
  { name: "Plunder", description: "Increase damage dealt by 25% and astra gain by 35%.", effects: { damageBonus: 0.25, astraBonus: 0.35 } },
  { name: "Fortune's Spark", description: "Restore your full power when landing a critical hit. Increase astra gain by 25%. Hits have a 20% chance to set the enemy on fire.", effects: { surge: 1, astraBonus: 0.25, ignite: 0.2 } },
  { name: "Molten Grip", description: "Hits have a 40% chance to set the enemy on fire. Increase damage dealt by 15% and ignore 20% of the enemy's defense.", effects: { ignite: 0.4, damageBonus: 0.15, pierce: 0.2 } },
  { name: "Tempered Steel", description: "Reduce damage taken by 25% and reflect 15% of damage taken back to the attacker.", effects: { damageReduction: 0.25, reflect: 0.15 } },
  { name: "Frozen Resolve", description: "Reduce damage taken by 15%. Once per combat, recover 60% health when falling below 10% health.", effects: { damageReduction: 0.15, secondWind: 0.6 } },
  { name: "Glacial Edge", description: "Ignore 40% of the enemy's defense and increase damage dealt by 15%.", effects: { pierce: 0.4, damageBonus: 0.15 } },
  { name: "Rootstride", description: "Increase speed by 100% when determining turn order and speed comparisons. Reflect 15% of damage taken.", effects: { speedMult: 1, reflect: 0.15 } },
  { name: "Bloom of Decay", description: "Heal for 5% of damage dealt. Hits have a 25% chance to set the enemy on fire. Restore half your power when landing a critical hit.", effects: { lifesteal: 0.05, ignite: 0.25, surge: 0.5 } },
  { name: "Orbital Focus", description: "Restore your full power when landing a critical hit and increase damage dealt by 20%.", effects: { surge: 1, damageBonus: 0.2 } },
  { name: "Star-Charted", description: "Increase speed by 60%, ignore 30% of the enemy's defense and increase astra gain by 20%.", effects: { speedMult: 0.6, pierce: 0.3, astraBonus: 0.2 } },
];

export const findAbility = (ability) =>
  ABILITIES.find((a) => a.name === ability?.name) ||
  UNIQUE_ABILITIES.find((a) => a.name === ability?.name) ||
  null;

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
