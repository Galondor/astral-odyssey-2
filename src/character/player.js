import { get, ref, remove, set } from "firebase/database";
import { db } from "../firebase";

const PLAYER_KEY = "Player";
const META_KEY = "PlayerMeta"; // { uid, dirty }
const FLUSH_DELAY_MS = 60000;

let flushTimer = null;
let flushing = null;

const getMeta = () => {
  try {
    return JSON.parse(localStorage.getItem(META_KEY)) || {};
  } catch {
    return {};
  }
};
const setMeta = (meta) => localStorage.setItem(META_KEY, JSON.stringify(meta));

// Gameplay reads/writes only touch localStorage (the buffer).
export const getPlayer = () => {
  const player = localStorage.getItem(PLAYER_KEY);
  return player ? JSON.parse(player) : null;
};

const markDirty = () => {
  const meta = getMeta();
  if (!meta.uid) return;
  setMeta({ ...meta, dirty: true });
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flushPlayer, FLUSH_DELAY_MS);
};

// Merge values into the saved player data.
export const setPlayer = (patch) => {
  localStorage.setItem(PLAYER_KEY, JSON.stringify({ ...getPlayer(), ...patch }));
  markDirty();
};

export const clearPlayer = () => {
  localStorage.removeItem(PLAYER_KEY);
  markDirty();
};

// Push the buffer to the database in a single write, only if something changed.
export const flushPlayer = async () => {
  clearTimeout(flushTimer);
  if (flushing) await flushing;
  const meta = getMeta();
  if (!meta.uid || !meta.dirty) return;
  const player = getPlayer();
  const playerRef = ref(db, `users/${meta.uid}/player`);
  flushing = (player ? set(playerRef, player) : remove(playerRef))
    .then(() => setMeta({ ...getMeta(), dirty: false }))
    .catch(() => markDirty())
    .finally(() => {
      flushing = null;
    });
  await flushing;
};

const pullPlayer = async (uid) => {
  const snap = await get(ref(db, `users/${uid}/player`));
  if (snap.exists()) localStorage.setItem(PLAYER_KEY, JSON.stringify(snap.val()));
  return snap.exists();
};

// One read per login. Unsynced local progress for the same user wins over the server copy.
export const loadPlayer = async (uid) => {
  const meta = getMeta();
  if (meta.uid === uid) {
    if (meta.dirty) await flushPlayer();
    else if (!getPlayer()) await pullPlayer(uid);
    return;
  }
  const legacy = meta.uid ? null : getPlayer(); // pre-account local save
  localStorage.removeItem(PLAYER_KEY);
  setMeta({ uid, dirty: false });
  const found = await pullPlayer(uid);
  if (!found && legacy) {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(legacy));
    markDirty();
    await flushPlayer();
  }
};

export const unloadPlayer = async () => {
  await flushPlayer();
  localStorage.removeItem(PLAYER_KEY);
  localStorage.removeItem(META_KEY);
};

// Best-effort save when the tab is hidden or closed.
window.addEventListener("pagehide", flushPlayer);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushPlayer();
});

// Getters read localStorage each time, so values are never stale.
export const Player = {
  get name() {
    return getPlayer()?.name || "";
  },
};