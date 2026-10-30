import { get, ref, remove, runTransaction, serverTimestamp, update } from "firebase/database";
import { auth, db } from "../firebase";

export const LEADERBOARD_REFRESH_MS = 30 * 60 * 1000;
const CACHE_KEY = "LeaderboardCacheV2";
const PROFILE_KEY = "LeaderboardPublishedV2:";
let cache = null;
let loading = null;
const publishing = new Map();
const publishedAt = new Map();
const publishedTitle = new Map();

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
  ...(player.activeTitle ? { activeTitle: player.activeTitle } : {}),
  level: player.level || 1,
  gearScore: player.stats?.gearScore || 0,
  astra: (player.astra || 0) + (player.bank?.balance || 0),
  highestClearedColosseumWave: player.records?.highestClearedColosseumWave || 0,
});

// Only compact public scores and their account ownership are shared, never full saves.
export const publishLeaderboardEntry = (uid, player) => {
  if (!player?.name) return Promise.resolve();
  if (publishing.has(uid)) return publishing.get(uid);
  const pending = (async () => {
    const accountId = auth.currentUser?.uid;
    if (!accountId) throw new Error("Sign in before publishing leaderboard scores.");
    const admin = await get(ref(db, `admins/${accountId}`));
    if (admin.val() === true) {
      await remove(ref(db, `leaderboardEntries/${uid}`));
      publishedAt.delete(uid);
      publishedTitle.delete(uid);
      const cached = cache || readStored(CACHE_KEY);
      if (cached?.entries) {
        delete cached.entries[uid];
        cache = cached;
        store(CACHE_KEY, cache);
      }
      return;
    }
    const last = publishedAt.get(uid) ?? readStored(PROFILE_KEY + uid);
    if (isFresh(last) && publishedTitle.get(uid) === player.activeTitle) return;
    const entry = { ...buildLeaderboardEntry(player), accountId };
    const { snapshot } = await runTransaction(ref(db, `leaderboardEntries/${uid}`), (current) => {
      if (current && isFresh(current.updatedAt) && current.activeTitle === entry.activeTitle &&
          Number.isFinite(current.highestClearedColosseumWave) && current.accountId === accountId)
        return undefined;
      return { ...entry, updatedAt: serverTimestamp() };
    }, { applyLocally: false });
    const timestamp = snapshot.val()?.updatedAt;
    if (!Number.isFinite(timestamp)) throw new Error("Leaderboard publication returned no timestamp.");
    publishedAt.set(uid, timestamp);
    publishedTitle.set(uid, snapshot.val()?.activeTitle);
    store(PROFILE_KEY + uid, timestamp);
    const cached = cache || readStored(CACHE_KEY);
    if (cached?.entries?.[uid]) {
      cached.entries[uid] = snapshot.val();
      cache = cached;
      store(CACHE_KEY, cache);
    }
  })()
    .finally(() => publishing.delete(uid));
  publishing.set(uid, pending);
  return pending;
};

const validEntry = (entry) =>
  entry && typeof entry.name === "string" && entry.name.length > 0 &&
  ["level", "gearScore", "astra"].every((key) => Number.isFinite(entry[key]) && entry[key] >= 0);

export const rankLeaderboard = (entries, metric) => {
  const sorted = Object.entries(entries)
    .filter(([, entry]) => validEntry(entry) && entry.isAdmin !== true)
    .map(([uid, entry]) => ({ ...entry, uid, highestClearedColosseumWave: entry.highestClearedColosseumWave || 0 }))
    .filter((entry) => Number.isFinite(entry[metric]) && entry[metric] >= 0 &&
      (metric !== "highestClearedColosseumWave" || entry[metric] > 0))
    .sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name) || a.uid.localeCompare(b.uid));
  let rank = 0;
  return sorted.map((entry, index) => {
    if (index === 0 || entry[metric] !== sorted[index - 1][metric]) rank = index + 1;
    return { ...entry, rank };
  });
};

export const getLeaderboardEligibility = async (entries) => {
  const adminSnapshot = await get(ref(db, "admins"));
  const admins = adminSnapshot.val() || {};
  const eligible = {};
  const excluded = [];
  await Promise.all(Object.entries(entries).map(async ([uid, entry]) => {
    if (!entry || typeof entry !== "object") return;
    const accountId = entry.accountId ||
      (await get(ref(db, `characterOwners/${uid}/accountId`))).val() || uid;
    if (admins[accountId] === true || admins[uid] === true) excluded.push(uid);
    else eligible[uid] = { ...entry, accountId };
  }));
  return { eligible, excluded };
};

// Scores share a cache across tabs, but current admin eligibility is always checked.
export const getLeaderboards = () => {
  if (loading) return loading;
  loading = (async () => {
    const stored = cache || readStored(CACHE_KEY);
    const fresh = stored && isFresh(stored.fetchedAt) && stored.entries && typeof stored.entries === "object";
    const entries = fresh ? stored.entries : (await get(ref(db, "leaderboardEntries"))).val() || {};
    const { eligible, excluded } = await getLeaderboardEligibility(entries);
    if (excluded.length)
      await update(ref(db), Object.fromEntries(excluded.map((uid) => [`leaderboardEntries/${uid}`, null])));
    cache = { fetchedAt: fresh ? stored.fetchedAt : Date.now(), entries: eligible };
    store(CACHE_KEY, cache);
    return cache;
  })()
    .finally(() => { loading = null; });
  return loading;
};