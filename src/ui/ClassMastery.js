import { useState } from "react";
import { getPlayer, setPlayer } from "../character/player";
import { CLASS_TREES, classMasterySpent, getClassNodes, getClassStateLabel, masteryBudget } from "../character/mastery";
import { getEquippedSkills } from "../character/skills";
import { getEnemy } from "../combat/combat";
import { classActionError } from "../combat/classMechanics";

export function ClassResource({ state }) {
  const tree = CLASS_TREES[state?.cls];
  if (!tree) return null;
  const error = classActionError(state, tree.signature.key);
  return <div className='class-resource' role='status' aria-label={`${state.cls} combat resource`}>
    <strong>{getClassStateLabel(state)}</strong>
    {" · "}{tree.signature.name}: {error || "Ready (Action)"}
  </div>;
}

export default function ClassMastery({ player, inCombat, onChange }) {
  const [error, setError] = useState("");
  const save = (cls, ids) => {
    setError("");
    const current = getPlayer();
    if (!current || cls !== current.class || inCombat || getEnemy()) {
      setError("Only your current class can be edited, outside combat.");
      return;
    }
    const tree = CLASS_TREES[cls];
    const selected = tree.nodes.filter((node) => ids.includes(node.id));
    const invalid = selected.find((node) =>
      (node.requires || []).some((id) => !ids.includes(id)) ||
      (node.excludes || []).some((id) => ids.includes(id)));
    if (invalid) {
      setError(`${invalid.name}: requires ${(invalid.requires || []).join(", ") || "no prerequisites"}; cannot combine with ${(invalid.excludes || []).join(", ") || "conflicting nodes"}.`);
      return;
    }
    if (selected.reduce((sum, node) => sum + node.cost, 0) > masteryBudget(current)) {
      setError("Not enough mastery points. Reset your tree for free to try another allocation.");
      return;
    }
    const classMastery = { ...current.classMastery, [cls]: ids };
    const valid = getClassNodes({ ...current, classMastery }, cls);
    if (valid.length !== ids.length) {
      setError("That allocation is invalid. Add prerequisite nodes first.");
      return;
    }
    const techniques = new Set(tree.nodes.map((node) => node.skill).filter(Boolean));
    const learned = new Set(selected.map((node) => node.skill).filter(Boolean));
    const equippedSkills = getEquippedSkills(current).filter((key) => !techniques.has(key) || learned.has(key));
    try {
      setPlayer({
        classMastery, equippedSkills,
        classLoadouts: { ...current.classLoadouts, [cls]: equippedSkills },
      });
      onChange?.();
    } catch (failure) {
      setError(failure.message || "Couldn't save mastery. Please try again.");
    }
  };
  return <section aria-label='Class mastery'>
    <h3>Class mastery</h3>
    <p>Each class has its own {masteryBudget(player)}-point budget (1 point, plus 1 every 5 levels). Only your current class is active. Reset for free outside combat; shared skill respecs never reset mastery.</p>
    {error && <p role='alert'>{error}</p>}
    {Object.entries(CLASS_TREES).map(([cls, tree]) => {
      const ids = getClassNodes(player, cls);
      const active = player.class === cls;
      return <section key={cls} className='class-card' aria-label={`${cls} mastery`}>
        <h4>{tree.name}{active ? " (current)" : " (inactive, saved)"}</h4>
        <p>{tree.description}</p>
        <p><strong>{tree.signature.name}</strong>: {tree.signature.description} Always available without equipping; uses an Action, never Quick Reflexes.</p>
        <p>Mastery: {classMasterySpent(player, cls)}/{masteryBudget(player)} points spent</p>
        <div className='skill-list'>{tree.nodes.map((node) => <div key={node.id} className='skill-card'>
          <strong>{node.name}{ids.includes(node.id) ? " — Allocated" : ""}</strong>
          <span>{node.description}</span>
          <span>Cost: {node.cost}{node.requires?.length ? ` · Requires: ${node.requires.join(", ")}` : ""}{node.excludes?.length ? ` · Exclusive with: ${node.excludes.join(", ")}` : ""}</span>
          <button type='button' className='buttons' disabled={!active || inCombat}
            onClick={() => save(cls, ids.includes(node.id) ? ids.filter((id) => id !== node.id) : [...ids, node.id])}>
            {ids.includes(node.id) ? "Remove" : "Allocate"} {node.name}
          </button>
        </div>)}</div>
        <button type='button' className='buttons' disabled={!active || inCombat || !ids.length} onClick={() => save(cls, [])}>Reset {cls} mastery (free)</button>
      </section>;
    })}
    {!CLASS_TREES[player.class] && <p>Your current class has no mastery tree.</p>}
  </section>;
}
