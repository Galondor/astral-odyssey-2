/*
 Passive skills. The player saves `passives` (learned keys) and `equippedPassives` (up to
 MAX_EQUIPPED_PASSIVES keys). Passives have no levels; each costs PASSIVE_POINT_COST skill points and
 unlocks at its own level. Combat reads the equipped list through getEquippedPassives.
*/
export const PASSIVE_POINT_COST = 3;
export const MAX_EQUIPPED_PASSIVES = 3;

export const PASSIVE_ROLES = { damage: "Damage", support: "Support", tank: "Tank", flex: "Flex" };

export const PASSIVE_TUNING = {
  vitalityOverflow: {},
  scavenger: { restore: 0.1 },
  apexPredator: { threshold: 0.5, bonus: 0.2 },
  protect: { reduction: 0.25 },
  battleTrance: { power: 4 },
  bloodlust: { bonus: 0.1, maxStacks: 3 },
  inspiration: { bonus: 0.1 },
  revenge: { maxBonus: 0.3 },
  quickReflexes: {},
  efficiency: { discount: 0.25 },
  glassCannon: { dealt: 0.3, taken: 0.2 },
  overcharge: { cap: 1.5, bonus: 0.15 },
  lastLight: { barrier: 0.2 },
  unbreakable: { threshold: 0.35, cap: 0.25, penalty: 0.2 },
  skillful: { slots: 4 },
};

export const PASSIVES = {
  vitalityOverflow: {
    name: "Vitality Overflow",
    role: "support",
    level: 15,
    description: "Overhealing from your support skills becomes a barrier of that amount.",
  },
  scavenger: {
    name: "Scavenger",
    role: "flex",
    level: 18,
    description: "After each won combat, recover 10% of your max health and max power.",
  },
  apexPredator: {
    name: "Apex Predator",
    role: "damage",
    level: 20,
    description: "Deal 20% more damage to enemies below 50% health.",
  },
  protect: {
    name: "Protect",
    role: "tank",
    level: 22,
    description: "While guarding an ally in group combat, damage you take for them is reduced by a further 25%.",
  },
  battleTrance: {
    name: "Battle Trance",
    role: "flex",
    level: 26,
    description: "Basic melee and magic attacks restore 4 power.",
  },
  bloodlust: {
    name: "Bloodlust",
    role: "damage",
    level: 30,
    description: "Each enemy you defeat grants +10% damage for the rest of combat, stacking up to 3 times.",
  },
  inspiration: {
    name: "Inspiration",
    role: "support",
    level: 32,
    description: "Allies you heal or buff with support skills deal 10% more damage on their next attack.",
  },
  revenge: {
    name: "Revenge",
    role: "tank",
    level: 35,
    description: "Direct enemy damage you take builds Hatred. Your next damaging attack consumes it for bonus damage equal to Hatred as a share of your max health (up to +30%).",
  },
  quickReflexes: {
    name: "Quick Reflexes",
    role: "flex",
    level: 38,
    description: "Your first non-ultimate skill each solo or PvP combat is a Quick Action.",
  },
  efficiency: {
    name: "Efficiency",
    role: "flex",
    level: 40,
    description: "Non-ultimate skills cost 25% less power.",
  },
  glassCannon: {
    name: "Glass Cannon",
    role: "damage",
    level: 45,
    description: "Deal 30% more damage, but take 20% more damage.",
  },
  overcharge: {
    name: "Overcharge",
    role: "flex",
    level: 48,
    description: "Power can overfill to 150% of max during combat. Skills used while above max power deal 15% more damage.",
  },
  lastLight: {
    name: "Last Light",
    role: "support",
    level: 50,
    description: "Once per combat, the first ally (or you) who would be defeated survives at 1 health with a barrier of 20% of their max health.",
  },
  unbreakable: {
    name: "Unbreakable",
    role: "tank",
    level: 55,
    description: "While below 35% health, no single enemy hit can deal more than 25% of your max health. You always deal 20% less damage.",
  },
  skillful: {
    name: "Skillful",
    role: "flex",
    level: 70,
    description: "Equip 4 regular skills instead of 3.",
  },
};

export const PASSIVE_ORDER = Object.keys(PASSIVES).sort((a, b) => PASSIVES[a].level - PASSIVES[b].level);

export const getLearnedPassives = (player) => (player?.passives || []).filter((key) => PASSIVES[key]);
export const getEquippedPassives = (player) => {
  const learned = getLearnedPassives(player);
  return (player?.equippedPassives || []).filter((key) => learned.includes(key)).slice(0, MAX_EQUIPPED_PASSIVES);
};
// `source` may be a player or a list of equipped passive keys.
export const hasPassive = (source, key) =>
  (Array.isArray(source) ? source : getEquippedPassives(source)).includes(key);

export const passiveTooltip = (key, extra) => {
  const p = PASSIVES[key];
  if (!p) return null;
  return {
    title: p.name,
    subtitle: "Passive",
    description: [p.description],
    stats: [
      { label: "Unlocks at", value: `Level ${p.level}` },
      { label: "Skill points", value: PASSIVE_POINT_COST },
    ],
    footer: extra,
  };
};
