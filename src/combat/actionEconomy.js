import { SKILLS } from "../character/skills";

export const freshActions = () => ({
  actionAvailable: true,
  quickAvailable: true,
  usedSkills: [],
});

// state.quickSkill (Quick Reflexes) turns the next non-ultimate skill into a Quick Action outside group combat.
export const getActionCost = (type, key, mode = "solo", state) =>
  mode !== "group" && (type === "consume" || (type === "skill" &&
    (SKILLS[key]?.actionCost === "quick" || (state?.quickSkill && SKILLS[key] && !SKILLS[key].ultimate))))
    ? "quick" : "action";

export const getActionAvailability = (state, type, key) => {
  const actions = state || freshActions();
  if (type === "skill" && (actions.usedSkills || []).includes(key))
    return { ok: false, message: "You can use each skill only once per turn." };
  const cost = getActionCost(type, key, "solo", actions);
  const slot = cost === "quick" && actions.quickAvailable ? "quickAvailable" : "actionAvailable";
  if (!actions[slot])
    return { ok: false, message: cost === "quick" ? "You have no Action or Quick Action remaining. End your turn." : "Your Action is already used. Choose a Quick Action or End Turn." };
  return { ok: true, slot };
};

export const actionCostLabel = (type, key, mode = "solo", state) => {
  if (getActionCost(type, key, mode, state) === "action") return "Action";
  const reflexes = type === "skill" && SKILLS[key]?.actionCost !== "quick" ? " (Quick Reflexes)" : "";
  return state && !state.quickAvailable
    ? "Uses Action (Quick Action already used)" : `Quick Action${reflexes}`;
};
