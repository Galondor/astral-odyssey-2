import { get, ref, runTransaction, serverTimestamp } from "firebase/database";
import { db } from "../firebase";

export const LEADERBOARD_REFRESH_MS = 30 * 60 * 1000;
const CACHE_KEY = "LeaderboardCacheV1";
const PROFILE_KEY = "LeaderboardPublishedV1:";
let cache = null;
let loading = null;
const publishing = new Map();
const publishedAt = new Map();

const readStored = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (error) {
    console.warn("Couldn't read the leaderboard cache", error);
    return null;
  }
};

const store = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Couldn't persist the leaderboard cache", error);
  }
};

const isFresh = (timestamp) =>
  Number.isFinite(timestamp) && timestamp <= Date.now() && Date.now() - timestamp < LEADERBOARD_REFRESH_MS;

export const buildLeaderboardEntry = (player) => ({
  name: player.name,
  level: player.level || 1,
  gearScore: player.stats?.gearScore || 0,
  astra: (player.astra || 0) + (player.bank?.balance || 0),
});

// Only compact public scores are shared, never inventories, account details, or full saves.
export const publishLeaderboardEntry = (uid, player) => {
  if (!player?.name) return Promise.resolve();
  if (publishing.has(uid)) return publishing.get(uid);
  const last = publishedAt.get(uid) ?? readStored(PROFILE_KEY + uid);
  if (isFresh(last)) return Promise.resolve();
  const entry = buildLeaderboardEntry(player);
  const pending = runTransaction(ref(db, `leaderboardEntries/${uid}`), (current) => {
    if (current && isFresh(current.updatedAt)) return undefined;
    return { ...entry, updatedAt: serverTimestamp() };
  }, { applyLocally: false })
    .then(({ snapshot }) => {
      const timestamp = snapshot.val()?.updatedAt;
      if (!Number.isFinite(timestamp)) throw new Error("Leaderboard publication returned no timestamp.");
      publishedAt.set(uid, timestamp);
      store(PROFILE_KEY + uid, timestamp);
    })
    .finally(() => publishing.delete(uid));
  publishing.set(uid, pending);
  return pending;
};

const validEntry = (entry) =>
  entry && typeof entry.name === "string" && entry.name.length > 0 &&
  ["level", "gearScore", "astra"].every((key) => Number.isFinite(entry[key]) && entry[key] >= 0);

export const rankLeaderboard = (entries, metric) => {
  const sorted = Object.entries(entries)
    .filter(([, entry]) => validEntry(entry))
    .map(([uid, entry]) => ({ uid, ...entry }))
    .sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name) || a.uid.localeCompare(b.uid));
  let rank = 0;
  return sorted.map((entry, index) => {
    if (index === 0 || entry[metric] !== sorted[index - 1][metric]) rank = index + 1;
    return { ...entry, rank };
  });
};

// One read supplies all tabs. Persisting it also avoids reads on screen remounts and reloads.
export const getLeaderboards = () => {
  const stored = cache || readStored(CACHE_KEY);
  if (stored && isFresh(stored.fetchedAt) && stored.entries && typeof stored.entries === "object") {
    cache = stored;
    return Promise.resolve(cache);
  }
  if (loading) return loading;
  loading = get(ref(db, "leaderboardEntries"))
    .then((snapshot) => {
      cache = { fetchedAt: Date.now(), entries: snapshot.val() || {} };
      store(CACHE_KEY, cache);
      return cache;
    })
    .finally(() => { loading = null; });
  return loading;
};