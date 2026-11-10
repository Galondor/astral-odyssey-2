import { useState } from "react";
import { getPlayer, setPlayer } from "../character/player";
import { CLASS_TREES, classMasterySpent, getClassNodes, masteryBudget } from "../character/mastery";
import { getEquippedSkills } from "../character/skills";
import { getEnemy } from "../combat/combat";
import { classActionError } from "../combat/classMechanics";
import { Bar } from "./CharacterSummary";

const CLASS_RESOURCES = {
  Swordsman: { key: "resolve", label: "Resolve", max: 3, color: "#b7791f" },
  Spellblade: { key: "weave", label: "Weave", max: 2, color: "#8a73d6" },
  Tactician: { key: "advantage", label: "Advantage", max: 3, color: "#1e8449" },
  Spellcaster: { key: "instability", label: "Instability", max: 3, color: "#8a73d6" },
  Duelist: { key: "tempo", label: "Tempo", max: 2, color: "#1f5fbf" },
  Trickster: { key: "tricks", label: "Tricks", max: 3, color: "#c0392b" },
  Specialist: { key: "adaptation", label: "Adaptation", max: 3, color: "#1e8449" },
};

export function ClassResource({ state }) {
  const tree = CLASS_TREES[state?.cls];
  const resource = CLASS_RESOURCES[state?.cls];
  if (!tree || !resource) return null;
  const error = classActionError(state, tree.signature.key);
  const value = Math.max(0, state[resource.key] || 0);
  const details = state.cls === "Spellblade" && state.lastWeaveType
    ? `Last: ${state.lastWeaveType}`
    : state.cls === "Spellcaster"
      ? `+${value * 10}% magic damage · +${Math.max(0, value * 3 - ((state.classNodes || []).includes("efficientFlow") ? 1 : 0))} spell power cost`
      : state.cls === "Duelist"
        ? (state.riposteReady ? "Riposte prepared" : "No prepared riposte")
        : "";
  return <div className='class-resource' role='status' aria-label={`${state.cls} combat resource`}>
    <Bar label={resource.label} value={value} max={resource.max} color={resource.color} />
    {details && <div className='class-resource-details'>{details}</div>}
    <div className='class-resource-signature'>{tree.signature.name}: {error || "Ready (Action)"}</div>
  </div>;
}

function getMasteryTreeRows(nodes) {
  const roots = nodes.filter((node) => !node.requires?.length);
  const rootColumns = new Map(roots.map((node, index) => [node.id, index]));
  const childrenByRoot = {};
  nodes.filter((node) => node.requires?.length).forEach((node) => {
    const column = rootColumns.get(node.requires[0]);
    if (column !== undefined) childrenByRoot[column] = [...(childrenByRoot[column] || []), node];
  });
  return { roots, childrenByRoot };
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
  const pointsBudget = masteryBudget(player);
  const activeSpent = classMasterySpent(player, player.class);
  return <section aria-label='Class mastery'>
    <h3>Class mastery</h3>
    <div className='mastery-points' role='status' aria-label='Mastery points available'>
      <strong>{pointsBudget - activeSpent} Mastery Point{pointsBudget - activeSpent === 1 ? "" : "s"} available</strong>
      <span>{activeSpent} / {pointsBudget} spent · Earn 1 point every 10 levels</span>
    </div>
    <p className='mastery-help'>Unlock nodes to gain their effects. Follow the connecting lines to reach advanced nodes. Saved trees remain when you change class; only your current class can be edited.</p>
    {error && <p role='alert'>{error}</p>}
    {Object.entries(CLASS_TREES).map(([cls, tree]) => {
      const ids = getClassNodes(player, cls);
      const active = player.class === cls;
      const spent = classMasterySpent(player, cls);
      const remaining = pointsBudget - spent;
      const { roots, childrenByRoot } = getMasteryTreeRows(tree.nodes);
      const renderNode = (node) => {
        const allocated = ids.includes(node.id);
        const dependents = tree.nodes.filter((candidate) =>
          ids.includes(candidate.id) && candidate.requires?.includes(node.id));
        const missing = (node.requires || [])
          .filter((id) => !ids.includes(id))
          .map((id) => tree.nodes.find((entry) => entry.id === id)?.name || id);
        const conflicts = (node.excludes || [])
          .filter((id) => ids.includes(id))
          .map((id) => tree.nodes.find((entry) => entry.id === id)?.name || id);
        const reverseConflicts = tree.nodes
          .filter((entry) => ids.includes(entry.id) && entry.excludes?.includes(node.id))
          .map((entry) => entry.name);
        const lockedReason = allocated
          ? (dependents.length ? `Required by ${dependents.map((entry) => entry.name).join(", ")}` : "")
          : missing.length
            ? `Requires ${missing.join(", ")}`
            : conflicts.length || reverseConflicts.length
              ? `Conflicts with ${[...conflicts, ...reverseConflicts].join(", ")}`
              : node.cost > remaining
                ? `Need ${node.cost - remaining} more Mastery Point${node.cost - remaining === 1 ? "" : "s"}`
                : "";
        const canEdit = active && !inCombat && !lockedReason;
        return <div key={node.id} className={`mastery-tree-node ${allocated ? "allocated" : ""} ${lockedReason ? "locked" : ""}`}>
          <div className='mastery-node-heading'>
            <strong>{node.name}</strong>
            <span>{allocated ? "Unlocked" : `${node.cost} point${node.cost === 1 ? "" : "s"}`}</span>
          </div>
          <p>{node.description}</p>
          {lockedReason && <span className='mastery-node-requirement'>{lockedReason}</span>}
          <button type='button' className='buttons' disabled={!canEdit}
            onClick={() => save(cls, allocated ? ids.filter((id) => id !== node.id) : [...ids, node.id])}>
            {allocated ? "Remove" : "Unlock"} {node.name}
          </button>
        </div>;
      };
      return <details key={cls} className={`class-card class-mastery-card ${active ? "current" : ""}`} open={active}>
        <summary className='class-mastery-summary'>
          <strong>{tree.name}{active ? " (current)" : " (inactive, saved)"}</strong>
          <span>{remaining} point{remaining === 1 ? "" : "s"} available · {spent}/{pointsBudget} spent</span>
        </summary>
        <section className='class-mastery-details' aria-label={`${cls} mastery`}>
          <p className='mastery-tree-description'>{tree.description}</p>
          <div className='mastery-signature'>
            <strong>{tree.signature.name}</strong>
            <span>{tree.signature.description}</span>
          </div>
          <div className='mastery-tree' role='group' style={{ "--mastery-columns": roots.length }} aria-label={`${cls} mastery skill tree`}>
            <div className='mastery-tree-row'>
              {roots.map((node) => renderNode(node))}
            </div>
            {Object.keys(childrenByRoot).length > 0 && (
              <div className='mastery-tree-row mastery-tree-branches'>
                {roots.map((root, index) => (
                  <div key={root.id} className='mastery-tree-branch'>
                    {(childrenByRoot[index] || []).map(renderNode)}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button type='button' className='buttons mastery-reset' disabled={!active || inCombat || !ids.length} onClick={() => save(cls, [])}>Reset {cls} mastery (free)</button>
        </section>
      </details>;
    })}
    {!CLASS_TREES[player.class] && <p>Your current class has no mastery tree.</p>}
  </section>;
}
