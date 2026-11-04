import { SKILLS } from "../character/skills";

export const freshActions = () => ({
  actionAvailable: true,
  quickAvailable: true,
  usedSkills: [],
});

export const getActionCost = (type, key, mode = "solo") =>
  mode !== "group" && (type === "consume" || (type === "skill" && SKILLS[key]?.actionCost === "quick"))
    ? "quick" : "action";

export const getActionAvailability = (state, type, key) => {
  const actions = state || freshActions();
  if (type === "skill" && (actions.usedSkills || []).includes(key))
    return { ok: false, message: "You can use each skill only once per turn." };
  const cost = getActionCost(type, key);
  const slot = cost === "quick" && actions.quickAvailable ? "quickAvailable" : "actionAvailable";
  if (!actions[slot])
    return { ok: false, message: cost === "quick" ? "You have no Action or Quick Action remaining. End your turn." : "Your Action is already used. Choose a Quick Action or End Turn." };
  return { ok: true, slot };
};

export const actionCostLabel = (type, key, mode = "solo", state) => {
  if (getActionCost(type, key, mode) === "action") return "Action";
  return state && !state.quickAvailable
    ? "Uses Action (Quick Action already used)" : "Quick Action";
};
