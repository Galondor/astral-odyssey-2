// Dependency-free flag so other activities can refuse to start while this character is inside a group dungeon run
// (kept separate from groupParty.js to avoid import cycles).
let active = false;
const listeners = new Set();

export const isInGroupDungeon = () => active;

export const setGroupDungeonActive = (value) => {
  if (active === !!value) return;
  active = !!value;
  listeners.forEach((listener) => listener(active));
};

export const subscribeGroupDungeonActive = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
