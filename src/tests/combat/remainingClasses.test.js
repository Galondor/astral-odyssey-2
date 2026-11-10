import {
  classCombatState, classActionError, beginClassDefense, prepareClassAttack,
  finishClassAttack, spendClassResource, recordClassParry, classPowerSurcharge,
} from "../../combat/classMechanics";
import { CLASS_TREES, CLASS_SKILLS, getClassStateLabel } from "../../character/mastery";

const state = (cls, nodes = []) => classCombatState({
  class: cls, level: 50, classMastery: { [cls]: nodes },
});
const hit = (s, type, key, target = {}) => {
  const effect = prepareClassAttack(s, type, key, target);
  spendClassResource(s, key, type);
  finishClassAttack(s, type, key, target);
  return effect;
};

test.each(["Tactician", "Spellcaster", "Duelist", "Trickster", "Specialist"])(
  "%s has an immediate signature, a six-node tree, and a visible combat state",
  (cls) => {
    const tree = CLASS_TREES[cls];
    expect(tree.nodes).toHaveLength(6);
    expect(CLASS_SKILLS[tree.signature.key]).toMatchObject({ signature: true, className: cls });
    expect(tree.nodes.filter((n) => n.skill)).toHaveLength(1);
    expect(getClassStateLabel(state(cls))).not.toBe("");
  },
);

test("Tactician surveys safely or exploits an existing opening, rather than farming basic attacks", () => {
  const s = state("Tactician");
  hit(s, "melee");
  expect(s.advantage).toBe(0);
  beginClassDefense(s);
  hit(s, "melee", null, { statuses: [{ id: "weaken" }] });
  expect(s.advantage).toBe(2);
  expect(classActionError(s, "precisionStrike")).toBeNull();
  hit(s, "melee", "precisionStrike", { defending: true });
  expect(s.advantage).toBe(0);
});

test("Spellcaster chooses escalating power costs or a controlled release", () => {
  const s = state("Spellcaster");
  expect(classActionError(s, "arcaneRelease")).toMatch(/Instability/);
  hit(s, "magic");
  expect(s.instability).toBe(1);
  expect(classPowerSurcharge(s, "magic", "fireball")).toBe(3);
  expect(prepareClassAttack(s, "magic", "fireball").damageBonus).toBeCloseTo(0.1);
  expect(getClassStateLabel(s)).toContain("+3 spell power cost");
  hit(s, "magic"); hit(s, "magic"); hit(s, "magic");
  expect(s.instability).toBe(3);
  expect(prepareClassAttack(s, "magic", "arcaneRelease").damageBonus).toBeCloseTo(1.2);
  hit(s, "magic", "arcaneRelease");
  expect(s.instability).toBe(0);
  expect(classPowerSurcharge(s, "magic", null)).toBe(0);
});

test("Duelist banks Tempo from a deliberate parry, then consumes it on one melee action", () => {
  const s = state("Duelist");
  spendClassResource(s, "riposteStance", "support");
  expect(s.riposteReady).toBe(true);
  recordClassParry(s, true);
  expect(s.riposteReady).toBe(false);
  expect(s.tempo).toBe(2);
  expect(hit(s, "magic").damageBonus).toBe(0);
  expect(s.tempo).toBe(2);
  expect(hit(s, "melee").damageBonus).toBeCloseTo(0.7);
  expect(s.tempo).toBe(0);
});

test("Trickster cashes out only prepared Tricks; sabotage trades burst for control", () => {
  const s = state("Trickster", ["loadedVenom"]);
  expect(classActionError(s, "cashOut")).toMatch(/Trick/);
  hit(s, "melee", "venomStrike");
  expect(s.tricks).toBe(2);
  expect(hit(s, "magic", "cashOut").damageBonus).toBe(1);
  expect(s.tricks).toBe(0);
  hit(s, "magic");
  hit(s, "magic", "sabotage");
  expect(s.tricks).toBe(0);
});

test("Specialist gains Adaptation by changing roles, not by spamming different attacks", () => {
  const s = state("Specialist");
  hit(s, "melee"); hit(s, "magic"); hit(s, "magic", "fireball");
  expect(s.adaptation).toBe(1);
  beginClassDefense(s);
  expect(s.adaptation).toBe(2);
  finishClassAttack(s, "support", "mendingLight");
  expect(s.adaptation).toBe(3);
  expect(classActionError(s, "improvise")).toBeNull();
  hit(s, "melee", "improvise");
  expect(s.adaptation).toBe(1);
});

test("capstones alter resource retention and cannot grant another class its signature", () => {
  const tact = state("Tactician", ["survey", "strategist"]);
  beginClassDefense(tact);
  expect(tact.advantage).toBe(2);
  hit(tact, "melee", "precisionStrike");
  expect(tact.advantage).toBe(1);
  const trick = state("Trickster", ["loadedVenom", "salvage"]);
  hit(trick, "melee", "venomStrike");
  hit(trick, "magic", "cashOut");
  expect(trick.tricks).toBe(1);
  expect(classActionError(trick, "arcaneRelease")).toMatch(/Spellcaster/);
});

test("the alternative capstones change burst, efficiency, recovery and protection", () => {
  const tact = state("Tactician", ["exposingCleave", "checkmate"]);
  tact.advantage = 2;
  expect(prepareClassAttack(tact, "melee", "precisionStrike")).toMatchObject({ damageBonus: 0.5, weaken: true });
  const caster = state("Spellcaster", ["efficientFlow", "reclamation"]);
  caster.instability = 3;
  expect(classPowerSurcharge(caster, "magic", "fireball")).toBe(8);
  expect(prepareClassAttack(caster, "magic", "arcaneRelease").power).toBe(6);
  const overload = state("Spellcaster", ["fracturingFrost", "overload"]);
  overload.instability = 3;
  expect(prepareClassAttack(overload, "magic", "arcaneRelease").damageBonus).toBeCloseTo(1.95);
  const duelist = state("Duelist", ["measuredRiposte", "secondWind"]);
  expect(recordClassParry(duelist, true)).toEqual({ counter: 0.9, heal: 0.08 });
  const tempo = state("Duelist", ["exposingBackstab", "perfectTempo"]);
  tempo.tempo = 2;
  expect(hit(tempo, "melee").damageBonus).toBe(1.2);
  const trick = state("Trickster", ["cruelTricks", "grandFinale"]);
  trick.tricks = 3;
  expect(hit(trick, "magic", "cashOut")).toMatchObject({ damageBonus: 2.25, sunder: 0.2 });
  const recovery = state("Specialist", ["resourceful", "versatileRecovery"]);
  expect(prepareClassAttack(recovery, "melee", "improvise").heal).toBe(0.2);
  const contingency = state("Specialist", ["rallyingHymn", "contingency"]);
  expect(prepareClassAttack(contingency, "melee", "improvise")).toMatchObject({ heal: 0.1, barrier: true });
  hit(recovery, "melee");
  expect(beginClassDefense(recovery).power).toBe(1);
  expect(beginClassDefense(recovery).power).toBe(0);
});

test("new mastery branches provide distinct class builds", () => {
  const swordsman = state("Swordsman", ["shieldBash", "retribution"]);
  expect(prepareClassAttack(swordsman, "melee", "resolveStrike").weaken).toBe(true);

  const spellblade = state("Spellblade", ["runicGuard", "searingWeave"]);
  finishClassAttack(spellblade, "magic", "fireball");
  const searingStrike = prepareClassAttack(spellblade, "melee", "backstab");
  expect(searingStrike.burn).toBe(true);

  const tactician = state("Tactician", ["feint", "openingGambit"]);
  expect(prepareClassAttack(tactician, "melee", "precisionStrike", { defending: true }).damageBonus).toBe(0.3);
  expect(prepareClassAttack(tactician, "melee", "precisionStrike").damageBonus).toBe(0);

  const caster = state("Spellcaster", ["stabilize", "arcaneAegis"]);
  expect(prepareClassAttack(caster, "magic", "arcaneRelease").barrier).toBe(true);

  const duelist = state("Duelist", ["tempoThrust", "riposteMastery"]);
  expect(recordClassParry(duelist, true).counter).toBe(1.2);

  const trickster = state("Trickster", ["sabotage", "misdirection"]);
  expect(prepareClassAttack(trickster, "magic", "sabotage").sunder).toBe(0.2);

  const specialist = state("Specialist", ["fieldMending", "adaptableCare"]);
  expect(prepareClassAttack(specialist, "support", "improvise").heal).toBe(0.3);
});
