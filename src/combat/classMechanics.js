import { CLASS_SKILLS, getClassNodes, hasClassNode } from "../character/mastery";
import { STATUSES } from "./statuses";

export const classCombatState = (player) => ({
  cls: player.class || null,
  classNodes: getClassNodes(player),
  resolve: 0,
  resolveBlockRound: null,
  weave: 0,
  lastWeaveType: null,
  emberReady: false,
  advantage: 0,
  instability: 0,
  tempo: 0,
  riposteReady: false,
  tricks: 0,
  adaptation: 0,
  lastRole: null,
});

const node = (state, key) => hasClassNode(state.classNodes || [], key);

export const classActionError = (state, key) => {
  const skill = CLASS_SKILLS[key];
  if (skill && state?.cls !== skill.className) return `This technique requires ${skill.className}.`;
  if (key === "resolveStrike") {
    if (state?.cls !== "Swordsman") return "Resolve Strike requires Swordsman.";
    if ((state.resolve || 0) < 2) return "You need 2 Resolve to use Resolve Strike.";
  }
  if (key === "fusionStrike" || key === "runicGuard") {
    if (state?.cls !== "Spellblade") return "This technique requires Spellblade.";
    const needed = key === "fusionStrike" ? 2 : 1;
    if ((state.weave || 0) < needed) return `You need ${needed} Weave to use this technique.`;
  }
  if (key === "precisionStrike" && (state?.advantage || 0) < 2) return "You need 2 Advantage to use Precision Strike.";
  if (["arcaneRelease", "stabilize"].includes(key) && !(state?.instability > 0)) return "You need at least 1 Instability to vent.";
  if (key === "tempoThrust" && (state?.tempo || 0) < 2) return "You need 2 Tempo to use Tempo Thrust.";
  if (["cashOut", "sabotage"].includes(key) && !(state?.tricks > 0)) return "You need at least 1 Trick to use this technique.";
  if (key === "improvise" && (state?.adaptation || 0) < 2) return "You need 2 Adaptation to use Improvise.";
  if (key === "riposteStance" && state?.riposteReady) return "Your riposte is already prepared.";
  return null;
};

export const beginClassDefense = (state) => {
  if (state.cls === "Swordsman") state.resolve = Math.min(3, (state.resolve || 0) + 1);
  if (state.cls === "Tactician") state.advantage = Math.min(3, (state.advantage || 0) + (node(state, "survey") ? 2 : 1));
  return recordClassRole(state, "protection");
};

export const recordClassRole = (state, role) => {
  if (state.cls !== "Specialist" || state.lastRole === role) return { power: 0 };
  const changed = !!state.lastRole;
  state.adaptation = Math.min(3, (state.adaptation || 0) + 1);
  state.lastRole = role;
  return { power: changed && node(state, "resourceful") ? 1 : 0 };
};

export const classPowerSurcharge = (state, type, key) =>
  state?.cls === "Spellcaster" && type === "magic" && key && key !== "arcaneRelease"
    ? Math.max(0, (state.instability || 0) - (node(state, "efficientFlow") ? 1 : 0)) : 0;

export const recordClassParry = (state, prepared) => {
  state.riposteReady = false;
  state.tempo = Math.min(2, (state.tempo || 0) + (prepared ? 2 : 1));
  return {
    counter: prepared && node(state, "measuredRiposte") ? 0.9 : 0.6,
    heal: prepared && node(state, "secondWind") ? 0.08 : 0,
  };
};

export const classSupportBarrier = (state, key) =>
  state?.cls === "Specialist" && key === "battleHymn" && node(state, "rallyingHymn") ? 0.1 : 0;

export const recordClassBlock = (state, round) => {
  if (state.cls !== "Swordsman" || state.resolveBlockRound === round) return;
  state.resolveBlockRound = round;
  state.resolve = Math.min(3, (state.resolve || 0) + (node(state, "brace") ? 2 : 1));
};

export const spendClassResource = (state, key, type) => {
  if (key === "resolveStrike") state.resolve -= 2;
  if (key === "fusionStrike") {
    state.weave = node(state, "continuity") ? 1 : 0;
    if (!state.weave) state.lastWeaveType = null;
    state.emberReady = false;
  }
  if (key === "runicGuard") {
    state.weave -= 1;
    if (!state.weave) state.lastWeaveType = null;
  }
  if (key === "precisionStrike") state.advantage -= node(state, "strategist") ? 1 : 2;
  if (key === "arcaneRelease" || key === "stabilize") state.instability = 0;
  if (key === "riposteStance") state.riposteReady = true;
  if (state.cls === "Duelist" && type === "melee") state.tempo = 0;
  if (key === "cashOut") state.tricks = node(state, "salvage") && state.tricks >= 2 ? 1 : 0;
  if (key === "sabotage") state.tricks -= 1;
  if (key === "improvise") state.adaptation -= 2;
};

// Called once per action; the resulting bonuses can be applied to every AoE target.
export const prepareClassAttack = (state, type, key, target = {}) => ({
  damageBonus:
    (state.cls === "Spellblade" && ["melee", "magic"].includes(type) &&
      state.lastWeaveType && state.lastWeaveType !== type && key !== "fusionStrike" ? 0.25 : 0) +
    (key === "resolveStrike" && node(state, "executioner") ? 0.5 : 0) +
    (key === "fusionStrike" && node(state, "rupture") ? 0.5 : 0) +
    (key === "precisionStrike" && node(state, "checkmate") ? 0.5 : 0) +
    (state.cls === "Spellcaster" && type === "magic"
      ? (state.instability || 0) * (key === "arcaneRelease" ? (node(state, "overload") ? 0.65 : 0.4) : 0.1) : 0) +
    (state.cls === "Duelist" && type === "melee" ? (state.tempo || 0) * (node(state, "perfectTempo") ? 0.6 : 0.35) : 0) +
    (key === "cashOut" ? (state.tricks || 0) * 0.5 + (node(state, "grandFinale") ? 0.75 : 0) : 0),
  burn: state.cls === "Spellblade" && type === "melee" && !!state.emberReady && key !== "fusionStrike",
  sunder: key === "cleave" && state.cls === "Swordsman" && node(state, "sundering") ? 0.3 :
    ((key === "cleave" && state.cls === "Tactician" && node(state, "exposingCleave")) ||
     (key === "frostLance" && state.cls === "Spellcaster" && node(state, "fracturingFrost")) ||
     (key === "backstab" && state.cls === "Duelist" && node(state, "exposingBackstab")) ||
     (key === "cashOut" && state.cls === "Trickster" && node(state, "cruelTricks"))) ? 0.2 : 0,
  weaken: key === "precisionStrike" && node(state, "checkmate"),
  barrier: (key === "resolveStrike" && node(state, "bastion")) || (key === "improvise" && node(state, "contingency")),
  heal: key === "improvise" ? (node(state, "versatileRecovery") ? 0.2 : 0.1) : 0,
  power: key === "arcaneRelease" && node(state, "reclamation") ? (state.instability || 0) * 2 : 0,
  opening: state.cls === "Tactician" && (!!target.defending || !!target.recovering ||
    (target.statuses || []).some((status) => STATUSES[status.id]?.debuff)),
});

export const finishClassAttack = (state, type, key, target = {}, effect = prepareClassAttack(state, type, key, target)) => {
  if (state.cls === "Tactician" && key !== "precisionStrike" && ["melee", "magic"].includes(type) && effect.opening)
    state.advantage = Math.min(3, (state.advantage || 0) + 1);
  if (state.cls === "Spellcaster" && type === "magic" && key !== "arcaneRelease")
    state.instability = Math.min(3, (state.instability || 0) + 1);
  if (state.cls === "Trickster" && ["melee", "magic"].includes(type) && !["cashOut", "sabotage"].includes(key))
    state.tricks = Math.min(3, (state.tricks || 0) + (key === "venomStrike" && node(state, "loadedVenom") ? 2 : 1));
  if (state.cls === "Specialist" && key !== "improvise")
    return recordClassRole(state, type === "support" ? "support" : "offense");
  if (state.cls !== "Spellblade" || !["melee", "magic"].includes(type) || key === "fusionStrike")
    return { power: 0 };
  const alternating = state.lastWeaveType && state.lastWeaveType !== type;
  if (!state.lastWeaveType || alternating) state.weave = Math.min(2, (state.weave || 0) + 1);
  state.lastWeaveType = type;
  if (type === "melee") state.emberReady = false;
  if (key === "fireball" && node(state, "emberWeave")) state.emberReady = true;
  return { power: alternating && node(state, "flowingWeave") ? 1 : 0 };
};
