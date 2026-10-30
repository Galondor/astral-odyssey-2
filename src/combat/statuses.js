/*
 Combat status effects, kept in arrays of { id, turns, power, stacks } on each combatant.
 Definition fields:
   name, color, description
   kind: "dot" (damage each round: power = fraction of max health per stack, may stack),
         "skip" (the combatant loses its next action; used up when it happens),
         "outMult" (damage dealt × (1 + sign × power)), "inMult" (damage taken × (1 + sign × power)),
         "regen" (heals power × max health each round), "absorb" (barrier: power = damage it can still soak),
         "taunt" (enemies must target it), "immune" (blocks new debuffs), "doom" (detonates when it expires),
         "link" (shares damage with a linked ally)
   maxStacks, defaultPower, defaultTurns
   healPenalty - fraction of healing negated while active
   debuff      - removable by cleansing skills (unless cleansable: false)
*/
export const STATUSES = {
  burn: {
    name: "Burning",
    color: "#ff8a3d",
    kind: "dot",
    defaultPower: 0.04,
    defaultTurns: 3,
    healPenalty: 0.25,
    debuff: true,
    description: "Takes damage each round and receives 25% less healing.",
  },
  poison: {
    name: "Poisoned",
    color: "#7bd88f",
    kind: "dot",
    defaultPower: 0.03,
    defaultTurns: 4,
    maxStacks: 3,
    debuff: true,
    description: "Takes damage each round, stacking up to 3 times.",
  },
  bleed: {
    name: "Bleeding",
    color: "#e05555",
    kind: "dot",
    defaultPower: 0.04,
    defaultTurns: 3,
    debuff: true,
    description: "Takes damage each round.",
  },
  stun: {
    name: "Stunned",
    color: "#f5d76e",
    kind: "skip",
    defaultPower: 0,
    defaultTurns: 1,
    debuff: true,
    description: "Loses its next action.",
  },
  weaken: {
    name: "Weakened",
    color: "#a89bd8",
    kind: "outMult",
    sign: -1,
    defaultPower: 0.25,
    defaultTurns: 3,
    debuff: true,
    description: "Deals less damage.",
  },
  vulnerable: {
    name: "Vulnerable",
    color: "#ff9fb2",
    kind: "inMult",
    sign: 1,
    defaultPower: 0.25,
    defaultTurns: 3,
    debuff: true,
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
  empower: {
    name: "Empowered",
    color: "#ffd166",
    kind: "outMult",
    sign: 1,
    defaultPower: 0.2,
    defaultTurns: 3,
    description: "Deals more damage.",
  },
  barrier: {
    name: "Shielded",
    color: "#9ad1ff",
    kind: "absorb",
    defaultPower: 0,
    defaultTurns: 3,
    description: "Absorbs incoming damage until it breaks or expires.",
  },
  taunt: {
    name: "Taunting",
    color: "#ff7b54",
    kind: "taunt",
    defaultPower: 0,
    defaultTurns: 2,
    description: "Enemies are forced to attack this combatant.",
  },
  warded: {
    name: "Warded",
    color: "#e8e8ff",
    kind: "immune",
    defaultPower: 0,
    defaultTurns: 2,
    description: "Immune to new debuffs.",
  },
  scurvy: {
    name: "Scurvy",
    color: "#c8b560",
    kind: "dot",
    defaultPower: 0.015,
    defaultTurns: 4,
    maxStacks: 5,
    healPenalty: 0.3,
    debuff: true,
    description: "Takes damage each round and receives 30% less healing. Stacks up to 5 times.",
  },
  temporalRot: {
    name: "Temporal Rot",
    color: "#b28dff",
    kind: "inMult",
    sign: 1,
    defaultPower: 0.15,
    defaultTurns: 99,
    cleansable: false,
    description: "Time frays your body: takes 15% more damage. Only clearing the stage removes it.",
  },
  corruption: {
    name: "Void Corruption",
    color: "#7d3cff",
    kind: "dot",
    defaultPower: 0.02,
    defaultTurns: 5,
    maxStacks: 5,
    healPenalty: 0.3,
    debuff: true,
    description: "Takes damage each round and receives 30% less healing. Stacks up to 5 times; only Purify removes it.",
  },
  doom: {
    name: "Doom",
    color: "#ff3355",
    kind: "doom",
    defaultPower: 0.6,
    defaultTurns: 3,
    debuff: true,
    description: "When this expires, it detonates for heavy damage. An ally can Guard you or Purify it.",
  },
  soulLink: {
    name: "Soul Link",
    color: "#ff8de1",
    kind: "link",
    defaultPower: 0.5,
    defaultTurns: 3,
    cleansable: false,
    description: "Half of the damage taken is shared with the linked ally.",
  },
};

export const isDebuff = (st) => !!STATUSES[st.id]?.debuff && STATUSES[st.id].cleansable !== false;

// Removes cleansable debuffs from `list` (mutated). Returns the removed entries.
export function cleanseDebuffs(list, max = Infinity) {
  const removed = [];
  for (let i = list.length - 1; i >= 0 && removed.length < max; i -= 1) {
    if (isDebuff(list[i])) removed.push(...list.splice(i, 1));
  }
  return removed;
}

// Barriers soak damage before health. Mutates `list`; returns { remaining, absorbed }.
export function absorbDamage(list, amount) {
  let remaining = amount;
  let absorbed = 0;
  for (let i = 0; i < list.length && remaining > 0; i += 1) {
    if (STATUSES[list[i].id]?.kind !== "absorb") continue;
    const soak = Math.min(list[i].power, remaining);
    list[i].power -= soak;
    remaining -= soak;
    absorbed += soak;
  }
  for (let i = list.length - 1; i >= 0; i -= 1)
    if (STATUSES[list[i].id]?.kind === "absorb" && list[i].power <= 0) list.splice(i, 1);
  return { remaining, absorbed };
}

export const hasStatus = (list, id) => list.some((s) => s.id === id);

// Adds or refreshes a status in `list` (mutated). Returns the status entry.
export function addStatus(list, id, { turns, power, stacks = 1 } = {}) {
  const def = STATUSES[id];
  if (def.debuff && list.some((s) => STATUSES[s.id]?.kind === "immune")) return null;
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

const noStrength = (id) => ["skip", "absorb", "taunt", "immune"].includes(STATUSES[id].kind);

export const statusLabel = (s) =>
  `${STATUSES[s.id].name}${STATUSES[s.id].kind === "absorb" ? ` ${Math.round(s.power)}` : ""}${s.stacks > 1 ? ` x${s.stacks}` : ""}${STATUSES[s.id].kind === "skip" ? "" : ` (${s.turns})`}`;

export const statusTooltip = (s) => ({
  title: STATUSES[s.id].name,
  description: STATUSES[s.id].description,
  stats: [
    STATUSES[s.id].kind !== "skip" && { label: "Rounds left", value: s.turns },
    STATUSES[s.id].kind === "absorb" && { label: "Absorbs", value: Math.round(s.power) },
    s.power && !noStrength(s.id) && { label: "Strength", value: `${Math.round(s.power * 100)}%` },
    s.stacks > 1 && { label: "Stacks", value: s.stacks },
  ].filter(Boolean),
});
