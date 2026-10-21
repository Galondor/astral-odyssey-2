import { equalTo, get, onValue, orderByChild, query, ref, remove, runTransaction, update } from "firebase/database";
import { db } from "../firebase";
import { publishLeaderboardEntry } from "../world/leaderboards";

const PLAYER_KEY = "Player";
const META_KEY = "PlayerMeta";
const FLUSH_DELAY_MS = 0;

let flushTimer = null;
let flushing = null;
let naming = false;
let currentPlayer;
let currentMeta = null;
let saveQueue = Promise.resolve();
let stopSync = () => {};
let syncError = null;
let connected = true;
let writingRevision = null;
let notice = null;

export const validatePlayerName = (name) => {
  if (!/^[a-zA-Z]+$/.test(name)) return "Please enter letters only.";
  if (name.length > 64) return "Names must be 64 letters or fewer.";
  return null;
};

const reserveName = async (name, uid, existing = false) => {
  // Protect names saved before the reservation index existed, including offline players.
  const directory = await get(query(ref(db, "directory"), orderByChild("name"), equalTo(name)));
  const owners = Object.keys(directory.val() || {}).filter((owner) => owner !== uid);
  if (owners.length && (!existing || [...owners, uid].sort()[0] !== uid))
    return { committed: false };
  return runTransaction(ref(db, `characterNames/${name}`), (owner) =>
    owner === null || owner === uid ? uid : undefined,
  { applyLocally: false });
};

// Reserve first so concurrent requests for the exact same name cannot both succeed.
export async function savePlayerName(input) {
  const name = input.trim();
  const error = validatePlayerName(name);
  if (error) return { ok: false, message: error };
  const { uid } = getMeta();
  if (!uid) return { ok: false, message: "Sign in before choosing a name." };
  if (naming) return { ok: false, message: "A name is already being saved." };
  const player = getPlayer();
  const consumeElixir = !!player?.stats && !player.needsNameChange;
  if (consumeElixir && name === player.name)
    return { ok: false, message: "Choose a different name." };
  if (consumeElixir && !(player.consumables?.elixirOfNameChanging > 0))
    return { ok: false, message: "You don't have an Elixir of Name Changing." };
  naming = true;
  let reserved = false;
  try {
    // Finish any older save before writing the new name and its item cost together.
    await flushPlayer();
    const result = await reserveName(name, uid);
    if (!result.committed)
      return { ok: false, message: "That name is already taken. Choose another." };
    reserved = true;
    const current = getPlayer();
    const patch = { name, needsNameChange: false };
    if (consumeElixir) {
      const consumables = { ...current.consumables };
      if (!(consumables.elixirOfNameChanging > 0))
        return { ok: false, message: "You no longer have an Elixir of Name Changing." };
      consumables.elixirOfNameChanging -= 1;
      if (!consumables.elixirOfNameChanging) delete consumables.elixirOfNameChanging;
      patch.consumables = consumables;
    }
    const writes = {
      [`directory/${uid}`]: { name, level: current?.level || 1 },
    };
    if (current?.name !== name && !validatePlayerName(current?.name || "")) {
      const old = await get(ref(db, `characterNames/${current.name}`));
      if (old.val() === uid) writes[`characterNames/${current.name}`] = null;
    }
    const leaderboardName = await get(ref(db, `leaderboardEntries/${uid}/name`));
    if (leaderboardName.exists()) writes[`leaderboardEntries/${uid}/name`] = name;
    await commitPlayerChange(() => {
      if (JSON.stringify(getPlayer()) !== JSON.stringify(current))
        throw new Error("Your character changed while choosing a name. Please try again.");
      setPlayer(patch);
      return writes;
    });
    return { ok: true, message: `Your name is now ${name}. Your character has been saved.` };
  } catch (error) {
    console.warn("Couldn't save character name", error);
    return { ok: false, message: "Couldn't save your name. Please try again. No elixir was used." };
  } finally {
    if (reserved && getPlayer()?.name !== name) {
      try {
        await runTransaction(ref(db, `characterNames/${name}`), (owner) =>
          owner === uid ? null : undefined,
        );
      } catch (error) {
        console.warn("Couldn't release the unused character name", error);
      }
    }
    naming = false;
  }
}

const getMeta = () => {
  if (currentMeta) return currentMeta;
  try {
    return JSON.parse(localStorage.getItem(META_KEY)) || {};
  } catch {
    return {};
  }
};
const setMeta = (meta) => {
  currentMeta = meta;
  localStorage.setItem(META_KEY, JSON.stringify(meta));
  statusListeners.forEach((fn) => fn());
};

const statusListeners = new Set();

// { savedAt (ms timestamp or null), dirty, saving } for the save status indicator.
export const getSaveStatus = () => {
  const meta = getMeta();
  return { savedAt: meta.savedAt || null, dirty: !!meta.dirty, saving: !!flushing, error: syncError, offline: !connected, notice };
};

export const subscribeSaveStatus = (fn) => {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
};

// Keep each tab's working copy isolated; localStorage is only a recovery buffer.
export const getPlayer = () => {
  if (currentPlayer !== undefined) return currentPlayer === null ? null : JSON.parse(JSON.stringify(currentPlayer));
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
  flushTimer = setTimeout(() => flushPlayer().catch(() => {}), FLUSH_DELAY_MS);
};

// Gear remembers the first player who owned it; stamped as it enters a player's inventory or equipment.
const stampOwner = (item, owner) =>
  item && typeof item === "object" && !item.twoHandedOf && !item.originalOwner && owner
    ? { ...item, originalOwner: owner }
    : item;

const stampOwnership = (player, patch) => {
  const owner = patch.name || player?.name;
  if (!owner) return patch;
  const out = { ...patch };
  if (Array.isArray(patch.inventory)) out.inventory = patch.inventory.map((i) => stampOwner(i, owner));
  if (patch.equipment && typeof patch.equipment === "object")
    out.equipment = Object.fromEntries(Object.entries(patch.equipment).map(([k, i]) => [k, stampOwner(i, owner)]));
  return out;
};

// Merge values into the saved player data.
export const setPlayer = (patch) => {
  if (syncError) throw new Error(syncError);
  const player = getPlayer();
  patch = stampOwnership(player, patch);
  const additions = getNewInventoryItems(player, patch);
  const unseenInventoryItems = { ...(player?.unseenInventoryItems || {}) };
  for (const [category, keys] of Object.entries(additions)) {
    unseenInventoryItems[category] = [
      ...new Set([...(unseenInventoryItems[category] || []), ...keys]),
    ];
  }
  currentPlayer = {
    ...player,
    ...patch,
    ...(Object.keys(additions).length ? { unseenInventoryItems } : {}),
  };
  localStorage.setItem(PLAYER_KEY, JSON.stringify(currentPlayer));
  markDirty();
};

export const clearPlayer = () => {
  if (syncError) throw new Error(syncError);
  currentPlayer = null;
  localStorage.removeItem(PLAYER_KEY);
  markDirty();
};

const enqueueSave = (work) => {
  const next = saveQueue.then(work);
  // Keep the queue usable after a rejection; callers still receive the original error.
  saveQueue = next.catch(() => {});
  return next;
};

const writePlayer = async (writes = {}) => {
  clearTimeout(flushTimer);
  if (syncError) throw new Error(syncError);
  const meta = getMeta();
  if (!meta.uid || (!meta.dirty && !Object.keys(writes).length)) return;
  const player = getPlayer();
  const serialized = JSON.stringify(player);
  writingRevision = (meta.revision || 0) + 1;
  // The revision and any external effects must pass the rules in the same write.
  flushing = Promise.resolve().then(() => update(ref(db), {
    ...(player?.name ? { [`directory/${meta.uid}`]: { name: String(player.name), level: player.level || 1 } } : {}),
    ...writes,
    [`users/${meta.uid}/player`]: player,
    [`users/${meta.uid}/saveRevision`]: writingRevision,
  }))
    .then(() => {
      setMeta({ ...getMeta(), revision: writingRevision, dirty: JSON.stringify(getPlayer()) !== serialized, savedAt: Date.now() });
      // Public score publication must not delay subsequent progress saves.
      syncLeaderboard(meta.uid, player);
    })
    .catch((error) => {
      console.warn("Couldn't save player data", error);
      if (Object.keys(writes).length) setMeta({ ...getMeta(), unsafe: true });
      syncError = "Your save could not be confirmed. Another browser may have newer progress. Reload the cloud save before continuing.";
      throw error;
    })
    .finally(() => {
      flushing = null;
      writingRevision = null;
      statusListeners.forEach((fn) => fn());
    });
  statusListeners.forEach((fn) => fn());
  await flushing;
};

export const flushPlayer = () => enqueueSave(() => writePlayer());

// Synchronous changes and their database effects are committed together or not at all.
export const commitPlayerChange = (change) => enqueueSave(async () => {
  if (syncError) throw new Error(syncError);
  if (!getMeta().uid) throw new Error("Sign in before saving character changes.");
  const before = getPlayer();
  const wasDirty = getMeta().dirty;
  try {
    const writes = change() || {};
    await writePlayer(writes);
  } catch (error) {
    currentPlayer = before;
    if (before) localStorage.setItem(PLAYER_KEY, JSON.stringify(before));
    else localStorage.removeItem(PLAYER_KEY);
    setMeta({ ...getMeta(), dirty: wasDirty });
    throw error;
  }
});

// Stamps the owner onto gear saved before ownership was tracked.
const backfillOwnership = () => {
  const player = getPlayer();
  if (!player?.name) return;
  const missing = (i) => i && typeof i === "object" && !i.twoHandedOf && !i.originalOwner;
  if ((player.inventory || []).some(missing) || Object.values(player.equipment || {}).some(missing))
    setPlayer({ inventory: player.inventory || [], equipment: player.equipment || {} });
};

// Always read the cloud, including returning sessions in the same browser.
export const loadPlayer = async (uid) => {
  await loadPlayerData(uid);
  const player = getPlayer();
  if (player?.name) {
    const valid = !validatePlayerName(player.name);
    const result = valid ? await reserveName(player.name, uid, true) : null;
    if (!result?.committed) setPlayer({ needsNameChange: true });
  }
  backfillOwnership();
  await flushPlayer();
  await syncLeaderboard(uid, getPlayer());
};

const syncLeaderboard = async (uid, player) => {
  try {
    if (player) await publishLeaderboardEntry(uid, player);
    else await remove(ref(db, `leaderboardEntries/${uid}`));
  } catch (error) {
    console.warn("Couldn't update your leaderboard scores", error);
  }
};

const loadPlayerData = async (uid) => {
  stopSync();
  clearTimeout(flushTimer);
  await saveQueue;
  currentMeta = null;
  currentPlayer = undefined;
  const meta = getMeta();
  const cached = getPlayer();
  const snap = await get(ref(db, `users/${uid}`));
  const cloud = snap.val() || {};
  const revision = cloud.saveRevision || 0;
  const recover = meta.uid === uid && meta.dirty && !meta.unsafe && meta.revision != null && meta.revision === revision;
  const legacy = (!meta.uid || (meta.uid === uid && meta.dirty && meta.revision == null))
    && !cloud.player && !revision && cached;
  notice = null;
  if (meta.uid === uid && meta.dirty && !recover && !legacy) {
    localStorage.setItem(`PlayerRecovery/${uid}`, JSON.stringify({ player: cached, meta }));
    notice = "Loaded newer cloud progress. An older unsynced save was kept on this device for recovery.";
  }
  currentPlayer = recover || legacy ? cached : cloud.player || null;
  if (currentPlayer) localStorage.setItem(PLAYER_KEY, JSON.stringify(currentPlayer));
  else localStorage.removeItem(PLAYER_KEY);
  syncError = null;
  connected = true;
  setMeta({ uid, revision, dirty: false, savedAt: meta.uid === uid ? meta.savedAt : null });
  if (recover || legacy || (cloud.player && !revision)) {
    markDirty();
    await flushPlayer();
  }
  const stops = [
    onValue(ref(db, `users/${uid}/saveRevision`), (s) => {
      const remote = s.val() || 0;
      if (remote !== getMeta().revision && remote !== writingRevision) {
        syncError = "Progress changed in another browser or device. Reload the cloud save before continuing.";
        clearTimeout(flushTimer);
        statusListeners.forEach((fn) => fn());
      }
    }, (error) => {
      console.warn("Save synchronization unavailable", error);
      syncError = "Cloud synchronization is unavailable. Reload before continuing.";
      statusListeners.forEach((fn) => fn());
    }),
    onValue(ref(db, ".info/connected"), (s) => {
      connected = s.val() === true;
      statusListeners.forEach((fn) => fn());
    }),
  ];
  stopSync = () => stops.forEach((stop) => stop());
};

export const unloadPlayer = async () => {
  await flushPlayer();
  stopSync();
  currentPlayer = null;
  currentMeta = null;
  localStorage.removeItem(PLAYER_KEY);
  localStorage.removeItem(META_KEY);
};

// Best-effort save when the tab is hidden or closed.
window.addEventListener("pagehide", () => flushPlayer().catch(() => {}));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushPlayer().catch(() => {});
});

export const Player = {
  get name() {
    return getPlayer()?.name || "";
  },
};