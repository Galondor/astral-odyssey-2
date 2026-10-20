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
const setMeta = (meta) => {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
  statusListeners.forEach((fn) => fn());
};

const statusListeners = new Set();

// { savedAt (ms timestamp or null), dirty, saving } for the save status indicator.
export const getSaveStatus = () => {
  const meta = getMeta();
  return { savedAt: meta.savedAt || null, dirty: !!meta.dirty, saving: !!flushing };
};

export const subscribeSaveStatus = (fn) => {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
};

// Gameplay reads/writes only touch localStorage (the buffer).
export const getPlayer = () => {
  const player = localStorage.getItem(PLAYER_KEY);
  return player ? JSON.parse(player) : null;
};

export const getInventoryItemKey = (item) => item?.id || JSON.stringify(item);

const getNewInventoryItems = (player, patch) => {
  const additions = {};
  if (Object.prototype.hasOwnProperty.call(patch, "inventory")) {
    const previous = new Map();
    for (const item of player?.inventory || []) {
      const key = getInventoryItemKey(item);
      previous.set(key, (previous.get(key) || 0) + 1);
    }
    const next = new Map();
    for (const item of patch.inventory || []) {
      const key = getInventoryItemKey(item);
      next.set(key, (next.get(key) || 0) + 1);
      if (next.get(key) > (previous.get(key) || 0)) {
        (additions.gear ||= []).push(key);
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, "gemstones")) {
    const previous = new Set((player?.gemstones || []).map(getInventoryItemKey));
    const gemstones = (patch.gemstones || [])
      .map(getInventoryItemKey)
      .filter((key) => !previous.has(key));
    if (gemstones.length) additions.gemstones = gemstones;
  }
  for (const category of ["consumables", "materials"]) {
    if (!Object.prototype.hasOwnProperty.call(patch, category)) continue;
    for (const [key, count] of Object.entries(patch[category] || {})) {
      if (count > (player?.[category]?.[key] || 0)) {
        (additions[category] ||= []).push(key);
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, "keyItems")) {
    const previous = new Set(player?.keyItems || []);
    additions.keyItems = [...new Set(patch.keyItems || [])].filter(
      (key) => !previous.has(key),
    );
  }
  return additions;
};

export const markInventoryItemViewed = (category, key) => {
  const player = getPlayer();
  const items = player?.unseenInventoryItems?.[category] || [];
  if (!items.includes(key)) return;
  const remaining = items.filter((itemKey) => itemKey !== key);
  const unseenInventoryItems = { ...player.unseenInventoryItems };
  if (remaining.length) unseenInventoryItems[category] = remaining;
  else delete unseenInventoryItems[category];
  setPlayer({ unseenInventoryItems });
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
  const player = getPlayer();
  const additions = getNewInventoryItems(player, patch);
  const unseenInventoryItems = { ...(player?.unseenInventoryItems || {}) };
  for (const [category, keys] of Object.entries(additions)) {
    unseenInventoryItems[category] = [
      ...new Set([...(unseenInventoryItems[category] || []), ...keys]),
    ];
  }
  localStorage.setItem(
    PLAYER_KEY,
    JSON.stringify({
      ...player,
      ...patch,
      ...(Object.keys(additions).length ? { unseenInventoryItems } : {}),
    }),
  );
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
    .then(() => {
      setMeta({ ...getMeta(), dirty: false, savedAt: Date.now() });
      // Lets admins find players by name; best effort.
      if (player?.name)
        set(ref(db, `directory/${meta.uid}`), { name: String(player.name), level: player.level || 1 }).catch(() => {});
    })
    .catch(() => markDirty())
    .finally(() => {
      flushing = null;
      statusListeners.forEach((fn) => fn());
    });
  statusListeners.forEach((fn) => fn());
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