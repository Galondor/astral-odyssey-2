import { hasPassive, PASSIVE_TUNING } from "./passives";

/*
 Saved allocations are preferences, not trusted combat state. Resolve each class independently
 against the same level budget; callers can copy the resulting ids into a combat snapshot.
*/
export const CLASS_TREES = {
  Swordsman: {
    name: "Swordsman",
    description: "Defending or guarding grants 1 Resolve. Blocking a hit grants 1 more, at most once per round (maximum 3 Resolve).",
    signature: {
      key: "resolveStrike",
      name: "Resolve Strike",
      description: "Spend 2 Resolve for a normal-action strike dealing 150% melee damage.",
    },
    nodes: [
      { id: "brace", name: "Brace", description: "Your first blocked hit each round grants 2 Resolve instead of 1 (maximum 3 Resolve).", cost: 1 },
      { id: "sundering", name: "Sundering", description: "Cleave applies enhanced Vulnerable (+30% damage taken) for 3 rounds.", cost: 1 },
      { id: "shieldBash", name: "Shield Bash", description: "Unlock Shield Bash: deal 90% melee damage and weaken the enemy by 20% for 2 rounds. Costs 3 power.", cost: 1, skill: "shieldBash" },
      { id: "bastion", name: "Bastion", description: "Resolve Strike also grants a barrier absorbing 15% of your maximum health.", cost: 2, requires: ["brace"], excludes: ["executioner"] },
      { id: "executioner", name: "Executioner", description: "Resolve Strike gains +50% damage.", cost: 2, requires: ["sundering"], excludes: ["bastion"] },
    ],
  },
  Spellblade: {
    name: "Spellblade",
    description: "Your first offensive action grants 1 Weave. Alternating melee and magic grants another Weave and 25% more damage; repeating a type grants none (maximum 2 Weave).",
    signature: {
      key: "fusionStrike",
      name: "Fusion Strike",
      description: "Spend 2 Weave for a normal-action strike dealing 180% damage using the stronger of your melee and magic attack, delivered as melee damage.",
    },
    nodes: [
      { id: "emberWeave", name: "Ember Weave", description: "Fireball primes your next melee attack to burn for 3% of the enemy's maximum health each round for 2 rounds.", cost: 1 },
      { id: "flowingWeave", name: "Flowing Weave", description: "Alternating melee and magic refunds 1 power, at most once per action.", cost: 1 },
      { id: "runicGuard", name: "Runic Guard", description: "Unlock Runic Guard: spend 3 power and 1 Weave to shield yourself for 15% of maximum health.", cost: 1, skill: "runicGuard" },
      { id: "continuity", name: "Continuity", description: "Fusion Strike retains 1 Weave after use.", cost: 2, requires: ["flowingWeave"], excludes: ["rupture"] },
      { id: "rupture", name: "Rupture", description: "Fusion Strike gains +50% damage.", cost: 2, requires: ["emberWeave"], excludes: ["continuity"] },
    ],
  },
  Tactician: {
    name: "Tactician",
    description: "Defend or Guard to survey the enemy and gain 1 Advantage. Attacking a defending, recovering, or debuffed enemy also grants 1, once per action (maximum 3).",
    signature: { key: "precisionStrike", name: "Precision Strike", description: "Spend 2 Advantage for a 170% melee strike that ignores 50% of defense." },
    nodes: [
      { id: "survey", name: "Survey", description: "Defend and Guard grant 2 Advantage instead of 1.", cost: 1 },
      { id: "exposingCleave", name: "Exposing Cleave", description: "Cleave applies Vulnerable (+20% damage taken) for 3 rounds.", cost: 1 },
      { id: "feint", name: "Feint", description: "Unlock Feint: 70% melee damage and Vulnerable for 3 rounds. Costs 2 power.", cost: 1, skill: "feint" },
      { id: "strategist", name: "Strategist", description: "Precision Strike spends only 1 Advantage, but still requires 2 to use.", cost: 2, requires: ["survey"], excludes: ["checkmate"] },
      { id: "checkmate", name: "Checkmate", description: "Precision Strike gains +50% damage and weakens its target by 20% for 2 rounds.", cost: 2, requires: ["exposingCleave"], excludes: ["strategist"] },
    ],
  },
  Spellcaster: {
    name: "Spellcaster",
    description: "Magic attacks build 1 Instability (maximum 3). Each stack adds 10% magic damage and 1 power to spell costs. Basic magic remains free. Release the buildup or keep escalating.",
    signature: { key: "arcaneRelease", name: "Arcane Release", description: "Vent all Instability (requires 1) for 100% magic damage, plus 40% per stack spent. Costs no power." },
    nodes: [
      { id: "efficientFlow", name: "Efficient Flow", description: "Reduce the Instability surcharge on spells by 1 power.", cost: 1 },
      { id: "fracturingFrost", name: "Fracturing Frost", description: "Frost Lance also applies Vulnerable (+20% damage taken) for 3 rounds.", cost: 1 },
      { id: "stabilize", name: "Stabilize", description: "Unlock Stabilize: vent all Instability (requires 1) for a barrier worth 20% maximum health for 3 rounds. Costs no power.", cost: 1, skill: "stabilize" },
      { id: "reclamation", name: "Reclamation", description: "Arcane Release restores 2 power per stack vented.", cost: 2, requires: ["efficientFlow"], excludes: ["overload"] },
      { id: "overload", name: "Overload", description: "Arcane Release gains another +25% damage per stack vented.", cost: 2, requires: ["fracturingFrost"], excludes: ["reclamation"] },
    ],
  },
  Duelist: {
    name: "Duelist",
    description: "Prepare a riposte stance to guarantee a parry of the next ordinary hit before your next turn. It grants 2 Tempo; passive parries grant 1 (maximum 2). Your next melee action spends all Tempo for +35% damage per point. Committed group telegraphs cannot be parried.",
    signature: { key: "riposteStance", name: "Riposte Stance", description: "Spend an Action preparing a guaranteed parry and 60% melee counter. A missed read forfeits the attack opportunity." },
    nodes: [
      { id: "measuredRiposte", name: "Measured Riposte", description: "Prepared parry counters deal 90% melee damage instead of 60%.", cost: 1 },
      { id: "exposingBackstab", name: "Exposing Backstab", description: "Backstab also applies Vulnerable (+20% damage taken) for 3 rounds.", cost: 1 },
      { id: "tempoThrust", name: "Tempo Thrust", description: "Unlock Tempo Thrust: requires 2 Tempo, deals 180% melee damage plus your Tempo bonus and ignores 30% defense. Costs 3 power.", cost: 1, skill: "tempoThrust" },
      { id: "secondWind", name: "Second Wind", description: "A prepared parry heals 8% of your maximum health.", cost: 2, requires: ["measuredRiposte"], excludes: ["perfectTempo"] },
      { id: "perfectTempo", name: "Perfect Tempo", description: "Tempo adds 60% damage per point instead of 35%.", cost: 2, requires: ["exposingBackstab"], excludes: ["secondWind"] },
    ],
  },
  Trickster: {
    name: "Trickster",
    description: "Each damaging attack prepares 1 Trick (maximum 3), once per action regardless of targets hit. Bank Tricks for a finisher against your chosen enemy, or spend them on Sabotage.",
    signature: { key: "cashOut", name: "Cash Out", description: "Spend all prepared Tricks (requires 1) for 100% of your stronger attack plus 50% per Trick, delivered as magic damage." },
    nodes: [
      { id: "loadedVenom", name: "Loaded Venom", description: "Venom Strike prepares 2 Tricks instead of 1.", cost: 1 },
      { id: "cruelTricks", name: "Cruel Tricks", description: "Cash Out also applies Vulnerable (+20% damage taken) for 3 rounds.", cost: 1 },
      { id: "sabotage", name: "Sabotage", description: "Unlock Sabotage: spend 1 Trick and 2 power for 70% magic damage, weakening the enemy by 30% for 3 rounds. Does not prepare Tricks.", cost: 1, skill: "sabotage" },
      { id: "salvage", name: "Salvage", description: "Cash Out refunds 1 Trick when at least 2 were spent.", cost: 2, requires: ["loadedVenom"], excludes: ["grandFinale"] },
      { id: "grandFinale", name: "Grand Finale", description: "Cash Out gains +75% damage.", cost: 2, requires: ["cruelTricks"], excludes: ["salvage"] },
    ],
  },
  Specialist: {
    name: "Specialist",
    description: "Your first role and each role change grant 1 Adaptation (maximum 3). Roles are offense (melee/magic), protection (Defend/Guard), and support. Changing attack types alone is not a role change.",
    signature: { key: "improvise", name: "Improvise", description: "Spend 2 Adaptation for 170% of your stronger attack, delivered as melee damage, and heal yourself for 10% maximum health. Does not build Adaptation." },
    nodes: [
      { id: "resourceful", name: "Resourceful", description: "Role changes restore 1 power (not the first role).", cost: 1 },
      { id: "rallyingHymn", name: "Rallying Hymn", description: "Battle Hymn also shields each affected ally for 10% of their maximum health for 3 rounds.", cost: 1 },
      { id: "fieldMending", name: "Field Mending", description: "Unlock Field Mending: heal an ally (yourself in solo combat) for 20% of their maximum health. Costs 3 power and counts as support.", cost: 1, skill: "fieldMending" },
      { id: "versatileRecovery", name: "Versatile Recovery", description: "Improvise heals 20% maximum health instead of 10%.", cost: 2, requires: ["resourceful"], excludes: ["contingency"] },
      { id: "contingency", name: "Contingency", description: "Improvise also grants a barrier worth 15% maximum health for 3 rounds.", cost: 2, requires: ["rallyingHymn"], excludes: ["versatileRecovery"] },
    ],
  },
};

export const CLASS_SKILLS = {
  resolveStrike: {
    name: "Resolve Strike",
    description: CLASS_TREES.Swordsman.signature.description,
    type: "melee", target: "enemy", powerCost: 0, multiplier: 1.5, perLevel: 0, maxLevel: 1,
    signature: true, className: "Swordsman",
    describe: () => ["Swordsman signature: costs 2 Resolve (maximum 3).", "Always uses a normal action, even with Quick Reflexes."],
  },
  fusionStrike: {
    name: "Fusion Strike",
    description: CLASS_TREES.Spellblade.signature.description,
    type: "melee", target: "enemy", powerCost: 0, multiplier: 1.8, perLevel: 0, maxLevel: 1,
    signature: true, className: "Spellblade",
    describe: () => ["Spellblade signature: costs 2 Weave (maximum 2).", "Always uses a normal action, even with Quick Reflexes."],
  },
  shieldBash: {
    name: "Shield Bash",
    description: "A Swordsman mastery technique that staggers the enemy with a shield strike.",
    type: "melee", target: "enemy", powerCost: 3, multiplier: 0.9, perLevel: 0, maxLevel: 1,
    className: "Swordsman", masteryNode: "shieldBash",
    onHit: (ctx) => ctx.applyStatus("weaken", { turns: 2, power: 0.2 }),
    describe: () => ["Requires the Shield Bash mastery node in your active Swordsman tree.", "Weakens the enemy (-20% damage) for 2 rounds."],
  },
  runicGuard: {
    name: "Runic Guard",
    description: "A Spellblade mastery technique that weaves a protective rune around yourself.",
    type: "support", target: "self", powerCost: 3, maxLevel: 1,
    className: "Spellblade", masteryNode: "runicGuard",
    support: (ctx) => ctx.applyStatus(ctx.target, "barrier", {
      turns: 3, power: Math.round(ctx.target.stats.maxHealth * 0.15),
    }),
    describe: () => ["Requires the Runic Guard mastery node in your active Spellblade tree.", "Costs 1 Weave and 3 power. Grants a barrier absorbing 15% of your maximum health for 3 rounds."],
  },
  precisionStrike: {
    name: "Precision Strike", description: CLASS_TREES.Tactician.signature.description,
    type: "melee", target: "enemy", powerCost: 0, multiplier: 1.7, perLevel: 0, maxLevel: 1,
    signature: true, className: "Tactician", ignoreDefense: () => 0.5,
    describe: () => ["Requires 2 Advantage. Always uses a normal Action."],
  },
  arcaneRelease: {
    name: "Arcane Release", description: CLASS_TREES.Spellcaster.signature.description,
    type: "magic", target: "enemy", powerCost: 0, multiplier: 1, perLevel: 0, maxLevel: 1,
    signature: true, className: "Spellcaster",
    describe: () => ["Requires at least 1 Instability. Always uses a normal Action."],
  },
  riposteStance: {
    name: "Riposte Stance", description: CLASS_TREES.Duelist.signature.description,
    type: "support", target: "self", powerCost: 0, maxLevel: 1,
    signature: true, className: "Duelist", support: () => {},
    describe: () => ["Lasts until your next turn or the first parry. Cannot parry committed group telegraphs.", "Always uses a normal Action."],
  },
  cashOut: {
    name: "Cash Out", description: CLASS_TREES.Trickster.signature.description,
    type: "magic", target: "enemy", powerCost: 0, multiplier: 1, perLevel: 0, maxLevel: 1,
    signature: true, className: "Trickster", strongerAttack: true,
    describe: () => ["Requires at least 1 Trick. Always uses a normal Action."],
  },
  improvise: {
    name: "Improvise", description: CLASS_TREES.Specialist.signature.description,
    type: "melee", target: "enemy", powerCost: 0, multiplier: 1.7, perLevel: 0, maxLevel: 1,
    signature: true, className: "Specialist", strongerAttack: true,
    describe: () => ["Requires 2 Adaptation. Always uses a normal Action."],
  },
  feint: {
    name: "Feint", description: "Create a deliberate opening for your next attack.",
    type: "melee", target: "enemy", powerCost: 2, multiplier: 0.7, perLevel: 0, maxLevel: 1,
    className: "Tactician", masteryNode: "feint",
    onHit: (ctx) => ctx.applyStatus("vulnerable", { turns: 3, power: 0.2 }),
    describe: () => ["Applies Vulnerable (+20% damage taken) for 3 rounds."],
  },
  stabilize: {
    name: "Stabilize", description: "Vent your Instability into a protective barrier.",
    type: "support", target: "self", powerCost: 0, maxLevel: 1,
    className: "Spellcaster", masteryNode: "stabilize",
    support: (ctx) => ctx.applyStatus(ctx.target, "barrier", { turns: 3, power: Math.round(ctx.target.stats.maxHealth * 0.2) }),
    describe: () => ["Requires and vents all Instability. Barrier absorbs 20% maximum health for 3 rounds."],
  },
  tempoThrust: {
    name: "Tempo Thrust", description: "Turn a successful read into a piercing follow-up.",
    type: "melee", target: "enemy", powerCost: 3, multiplier: 1.8, perLevel: 0, maxLevel: 1,
    className: "Duelist", masteryNode: "tempoThrust", ignoreDefense: () => 0.3,
    describe: () => ["Requires 2 Tempo. Consumes Tempo for its normal bonus and ignores 30% defense."],
  },
  sabotage: {
    name: "Sabotage", description: "Trade a prepared Trick for reliable control.",
    type: "magic", target: "enemy", powerCost: 2, multiplier: 0.7, perLevel: 0, maxLevel: 1,
    className: "Trickster", masteryNode: "sabotage",
    onHit: (ctx) => ctx.applyStatus("weaken", { turns: 3, power: 0.3 }),
    describe: () => ["Costs 1 Trick. Weakens the enemy by 30% for 3 rounds. Does not prepare Tricks."],
  },
  fieldMending: {
    name: "Field Mending", description: "Adapt to the party's need for immediate recovery.",
    type: "support", target: "ally", powerCost: 3, maxLevel: 1,
    className: "Specialist", masteryNode: "fieldMending",
    support: (ctx) => ctx.heal(ctx.target, Math.round(ctx.target.stats.maxHealth * 0.2)),
    describe: () => ["Heal an ally for 20% of their maximum health. Counts as the support role."],
  },
};

export const MAX_EQUIPPED = 3;
export const MAX_EQUIPPED_ULTIMATE = 1;
export const ULTIMATE_UNLOCK_LEVEL = 25;
export const maxRegularSkills = (player) =>
  hasPassive(player, "skillful") ? PASSIVE_TUNING.skillful.slots : MAX_EQUIPPED;

// Availability metadata stays pure so stat recalculation never imports player or combat state.
export const SHARED_SKILL_KEYS = [
  "backstab", "cleave", "execute", "venomStrike", "fireball", "frostLance", "soulSiphon",
  "offhandStrike", "whirlwind", "chainLightning", "meteor", "dimensionalSlash",
  "mendingLight", "renewal", "battleHymn", "aegis", "purify", "provoke",
];
export const ULTIMATE_SKILL_KEYS = ["meteor", "dimensionalSlash"];

export function validateClassLoadout(player) {
  const equipped = [];
  const nodes = getClassNodes(player);
  let regular = 0;
  let ultimates = 0;
  for (const key of Array.isArray(player?.equippedSkills) ? player.equippedSkills : []) {
    if (equipped.includes(key)) continue;
    const skill = CLASS_SKILLS[key];
    if (skill) {
      if (skill.signature || skill.className !== player?.class || !nodes.includes(skill.masteryNode)) continue;
    } else if (!SHARED_SKILL_KEYS.includes(key) || !(player?.skills?.[key] > 0)) continue;
    if (ULTIMATE_SKILL_KEYS.includes(key)) {
      if ((player?.level || 1) < ULTIMATE_UNLOCK_LEVEL || ultimates >= MAX_EQUIPPED_ULTIMATE) continue;
      ultimates += 1;
    } else {
      if (regular >= maxRegularSkills(player)) continue;
      regular += 1;
    }
    equipped.push(key);
  }
  return equipped;
}

export const masteryBudget = (player) => {
  const level = Number.isFinite(player?.level) ? Math.max(1, player.level) : 1;
  return 1 + Math.floor((level - 1) / 5);
};

export function getClassNodes(player, cls = player?.class) {
  const tree = CLASS_TREES[cls];
  const saved = player?.classMastery?.[cls];
  if (!tree || !Array.isArray(saved)) return [];
  const active = [];
  let spent = 0;
  const budget = masteryBudget(player);
  for (const id of saved) {
    const node = tree.nodes.find((entry) => entry.id === id);
    if (!node || active.includes(id) || spent + node.cost > budget) continue;
    if (node.requires?.some((key) => !active.includes(key))) continue;
    if (node.excludes?.some((key) => active.includes(key))) continue;
    if (tree.nodes.some((entry) => active.includes(entry.id) && entry.excludes?.includes(id))) continue;
    active.push(id);
    spent += node.cost;
  }
  return active;
}

export const hasClassNode = (playerOrNodes, key) =>
  (Array.isArray(playerOrNodes) ? playerOrNodes : getClassNodes(playerOrNodes)).includes(key);

export const classMasterySpent = (player, cls = player?.class) =>
  getClassNodes(player, cls).reduce((spent, id) =>
    spent + CLASS_TREES[cls].nodes.find((node) => node.id === id).cost, 0);

export const getClassStateLabel = (state) => {
  if (state?.cls === "Swordsman") return `Resolve ${state.resolve || 0}/3`;
  if (state?.cls === "Spellblade")
    return `Weave ${state.weave || 0}/2${state.lastWeaveType ? ` · Last: ${state.lastWeaveType}` : ""}`;
  if (state?.cls === "Tactician") return `Advantage ${state.advantage || 0}/3 · Survey or exploit defense, recovery, or debuffs`;
  if (state?.cls === "Spellcaster") return `Instability ${state.instability || 0}/3 · +${(state.instability || 0) * 10}% magic damage · +${Math.max(0, (state.instability || 0) - (hasClassNode(state.classNodes || [], "efficientFlow") ? 1 : 0))} spell power cost`;
  if (state?.cls === "Duelist") return `Tempo ${state.tempo || 0}/2 · ${state.riposteReady ? "Riposte prepared" : "No prepared riposte"}`;
  if (state?.cls === "Trickster") return `Tricks ${state.tricks || 0}/3`;
  if (state?.cls === "Specialist") return `Adaptation ${state.adaptation || 0}/3 · Last role: ${state.lastRole || "none"}`;
  return "";
};
