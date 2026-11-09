import {
  classActionError, classCombatState, beginClassDefense, recordClassBlock,
  prepareClassAttack, finishClassAttack, spendClassResource,
} from "../../combat/classMechanics";

test("Resolve is available in short fights, capped, and blocking grants it only once per round", () => {
  const state = classCombatState({ class: "Swordsman" });
  expect(classActionError(state, "resolveStrike")).toMatch(/2 Resolve/);
  beginClassDefense(state);
  recordClassBlock(state, 1);
  recordClassBlock(state, 1);
  expect(state.resolve).toBe(2);
  expect(classActionError(state, "resolveStrike")).toBeNull();
  beginClassDefense(state);
  expect(state.resolve).toBe(3);
  spendClassResource(state, "resolveStrike");
  expect(state.resolve).toBe(1);
  expect(classCombatState({ class: "Swordsman" }).resolve).toBe(0);
});

test("weaving rewards alternating offense once per action, while repetitions cannot fill the meter", () => {
  const state = classCombatState({ class: "Spellblade" });
  finishClassAttack(state, "magic", "fireball");
  finishClassAttack(state, "magic", "chainLightning");
  expect(state.weave).toBe(1);
  expect(prepareClassAttack(state, "melee").damageBonus).toBe(0.25);
  finishClassAttack(state, "melee");
  expect(state.weave).toBe(2);
  expect(classActionError(state, "fusionStrike")).toBeNull();
  spendClassResource(state, "fusionStrike");
  expect(state.weave).toBe(0);
  expect(state.lastWeaveType).toBeNull();
});

test("signatures cannot be used by another class or without resources", () => {
  const state = classCombatState({ class: "Swordsman" });
  expect(classActionError(state, "fusionStrike")).toMatch(/Spellblade/);
  expect(classActionError(state, "runicGuard")).toMatch(/Spellblade/);
  expect(classActionError(state, "resolveStrike")).toMatch(/2 Resolve/);
});

test("mastery snapshots support transformations and exclusive capstones", () => {
  const state = classCombatState({
    class: "Spellblade", level: 30,
    classMastery: { Spellblade: ["emberWeave", "flowingWeave", "continuity", "runicGuard"] },
  });
  finishClassAttack(state, "magic", "fireball");
  expect(prepareClassAttack(state, "melee").burn).toBe(true);
  expect(finishClassAttack(state, "melee").power).toBe(1);
  expect(state.emberReady).toBe(false);
  spendClassResource(state, "fusionStrike");
  expect(state.weave).toBe(1);
  expect(classActionError(state, "runicGuard")).toBeNull();
  spendClassResource(state, "runicGuard");
  expect(state.weave).toBe(0);
});
