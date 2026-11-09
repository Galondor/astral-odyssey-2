import { getEnemy } from "../combat/combat";
import { getClassNodes } from "./mastery";

// Item mutation modules also load during player-store initialization.
const playerStore = () => require("./player");
let pending = null;
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());
export const getClassSwitchPreview = () => pending?.preview || null;
export const subscribeClassSwitch = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const cancelClassSwitch = () => { pending = null; notify(); };

// Keep costs, rewards and the class transition in one uncommitted patch.
export function commitWithClassPreview(player, patch, result = { ok: true }) {
  const nextClass = patch.class || player?.class;
  if (!player?.class || !nextClass || nextClass === player.class) {
    playerStore().setPlayer(patch);
    return result;
  }
  const preview = {
    from: player.class, to: nextClass,
    before: player.stats || {}, after: patch.stats || player.stats || {},
    outgoingSkills: player.equippedSkills || [],
    incomingSkills: patch.equippedSkills || player.equippedSkills || [],
    mastery: getClassNodes({ ...player, ...patch }, nextClass),
  };
  pending = { snapshot: JSON.stringify(player), patch, result, preview };
  notify();
  return { ok: false, reason: "class-change", message: "Review and confirm the class change before continuing.", preview };
}

export function confirmClassSwitch() {
  if (!pending) return { ok: false, message: "There is no class change to confirm." };
  if (getEnemy()) return { ok: false, message: "You can't change class during combat." };
  if (JSON.stringify(playerStore().getPlayer()) !== pending.snapshot) {
    cancelClassSwitch();
    return { ok: false, message: "Your character changed. Please try the action again to see an updated preview." };
  }
  const { patch, result } = pending;
  try {
    playerStore().setPlayer(patch);
    cancelClassSwitch();
    return result;
  } catch (error) {
    return { ok: false, message: error.message || "Couldn't save the class change. Please try again." };
  }
}
