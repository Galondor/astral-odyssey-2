/*
 Combat status effects, kept in arrays of { id, turns, power, stacks } on each combatant.
 Definition fields:
   name, color, description
   kind: "dot" (damage each round: power = fraction of max health per stack, may stack),
         "skip" (the combatant loses its next action; used up when it happens),
         "outMult" (damage dealt × (1 + sign × power)), "inMult" (damage taken × (1 + sign × power)),
         "regen" (heals power × max health each round)
   maxStacks, defaultPower, defaultTurns
   healPenalty - fraction of healing negated while active
*/
export const STATUSES = {
  burn: {
    name: "Burning",
    color: "#ff8a3d",
    kind: "dot",
    defaultPower: 0.04,
    defaultTurns: 3,
    healPenalty: 0.25,
    description: "Takes damage each round and receives 25% less healing.",
  },
  poison: {
    name: "Poisoned",
    color: "#7bd88f",
    kind: "dot",
    defaultPower: 0.03,
    defaultTurns: 4,
    maxStacks: 3,
    description: "Takes damage each round, stacking up to 3 times.",
  },
  bleed: {
    name: "Bleeding",
    color: "#e05555",
    kind: "dot",
    defaultPower: 0.04,
    defaultTurns: 3,
    description: "Takes damage each round.",
  },
  stun: {
    name: "Stunned",
    color: "#f5d76e",
    kind: "skip",
    defaultTurns: 1,
    description: "Loses its next action.",
  },
  weaken: {
    name: "Weakened",
    color: "#a89bd8",
    kind: "outMult",
    sign: -1,
    defaultPower: 0.25,
    defaultTurns: 3,
    description: "Deals less damage.",
  },
  vulnerable: {
    name: "Vulnerable",
    color: "#ff9fb2",
    kind: "inMult",
    sign: 1,
    defaultPower: 0.25,
    defaultTurns: 3,
    description: "Takes more damage.",
  },
  enrage: {
    name: "Enraged",
    color: "#ff5c33",
    kind: "outMult",
    sign: 1,
    defaultPower: 0.5,
    defaultTurns: 3,
    description: "Deals more damage.",
  },
  fortify: {
    name: "Fortified",
    color: "#8fb8d8",
    kind: "inMult",
    sign: -1,
    defaultPower: 0.4,
    defaultTurns: 3,
    description: "Takes less damage.",
  },
  regen: {
    name: "Regenerating",
    color: "#58d68d",
    kind: "regen",
    defaultPower: 0.05,
    defaultTurns: 3,
    description: "Recovers health each round.",
  },
};

export const hasStatus = (list, id) => list.some((s) => s.id === id);

// Adds or refreshes a status in `list` (mutated). Returns the status entry.
export function addStatus(list, id, { turns, power, stacks = 1 } = {}) {
  const def = STATUSES[id];
  const t = turns ?? def.defaultTurns;
  const p = power ?? def.defaultPower;
  const existing = list.find((s) => s.id === id);
  if (existing) {
    existing.turns = Math.max(existing.turns, t);
    existing.power = Math.max(existing.power, p);
    existing.stacks = Math.min(def.maxStacks || 1, existing.stacks + (def.maxStacks ? stacks : 0));
    return existing;
  }
  const entry = { id, turns: t, power: p, stacks: Math.min(def.maxStacks || 1, stacks) };
  list.push(entry);
  return entry;
}

const product = (list, kind) =>
  list
    .filter((s) => STATUSES[s.id].kind === kind)
    .reduce((m, s) => m * (1 + STATUSES[s.id].sign * s.power), 1);

export const outgoingMult = (list) => product(list, "outMult");
export const incomingMult = (list) => product(list, "inMult");
export const healMult = (list) =>
  list.reduce((m, s) => m * (1 - (STATUSES[s.id].healPenalty || 0)), 1);

export const statusLabel = (s) =>
  `${STATUSES[s.id].name}${s.stacks > 1 ? ` x${s.stacks}` : ""}${STATUSES[s.id].kind === "skip" ? "" : ` (${s.turns})`}`;

export const statusTooltip = (s) => ({
  title: STATUSES[s.id].name,
  description: STATUSES[s.id].description,
  stats: [
    STATUSES[s.id].kind !== "skip" && { label: "Rounds left", value: s.turns },
    s.power && STATUSES[s.id].kind !== "skip" && { label: "Strength", value: `${Math.round(s.power * 100)}%` },
    s.stacks > 1 && { label: "Stacks", value: s.stacks },
  ].filter(Boolean),
});
