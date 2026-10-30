import { get, onValue, ref, set, update } from "firebase/database";
import { db } from "../firebase";
import { getCharacterIdentity, getPlayer } from "../character/player";
import { getGroupStatus, lookupIdentity } from "./groupParty";

/*
 Friends. A request lives at friendRequests/<to>/<from>; accepting it writes both friends/<a>/<b> and
 friends/<b>/<a> and deletes the request in one update (the rules only allow a friendship when the request exists).
 Content invites reuse groupInvites from groupParty; both feed the Social tab's notification dot.
*/

const SEEN_KEY = "socialSeen:";
let state = { identity: null, friends: [], requests: [], presence: {}, pending: false, error: "", notice: "" };
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());

export const subscribeSocial = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getSocialStatus = () => ({
  ...state,
  friends: state.friends.map((friend) => ({ ...friend, online: state.presence[friend.id] === true })),
});

const readSeen = (identity) => {
  try {
    return Number(window.localStorage.getItem(SEEN_KEY + identity)) || 0;
  } catch {
    return 0;
  }
};

const unseenItems = () => [...state.requests, ...(getGroupStatus().invites || [])];

export const hasSocialNotification = () => {
  if (!state.identity) return false;
  const seen = readSeen(state.identity);
  return unseenItems().some((item) => (Number(item.at) || 0) > seen);
};

export const markSocialSeen = () => {
  if (!state.identity) return;
  const latest = Math.max(0, ...unseenItems().map((item) => Number(item.at) || 0));
  if (latest <= readSeen(state.identity)) return;
  try {
    window.localStorage.setItem(SEEN_KEY + state.identity, String(latest));
  } catch {}
  emit();
};

const act = async (fn) => {
  if (state.pending) return false;
  state = { ...state, pending: true, error: "", notice: "" };
  emit();
  try {
    const notice = await fn();
    state = { ...state, notice: notice || "" };
    return true;
  } catch (failure) {
    console.error("Social operation failed", failure);
    state = { ...state, error: failure?.message || "That didn't work. Please try again." };
    return false;
  } finally {
    state = { ...state, pending: false };
    emit();
  }
};

const requireCharacter = () => {
  const player = getPlayer();
  if (!state.identity || state.identity !== getCharacterIdentity() || !player?.name || !player.stats || player.needsNameChange)
    throw new Error("Create your character before adding friends.");
  return player;
};

const at = () => Date.now();

const befriend = (me, myName, other, otherName) => update(ref(db), {
  [`friends/${me}/${other}`]: { name: otherName, since: at() },
  [`friends/${other}/${me}`]: { name: myName, since: at() },
  [`friendRequests/${me}/${other}`]: null,
});

export const sendFriendRequest = (name) => act(async () => {
  const player = requireCharacter();
  const target = await lookupIdentity(name);
  if (target.id === state.identity) throw new Error("You can't befriend yourself.");
  if (state.friends.some((friend) => friend.id === target.id)) throw new Error(`${target.name} is already your friend.`);
  const theirs = state.requests.find((request) => request.id === target.id);
  if (theirs) {
    await befriend(state.identity, player.name, target.id, target.name);
    return `You and ${target.name} are now friends.`;
  }
  if ((await get(ref(db, `friendRequests/${target.id}/${state.identity}`))).exists())
    throw new Error(`You already sent ${target.name} a friend request.`);
  await set(ref(db, `friendRequests/${target.id}/${state.identity}`), { name: player.name, at: at() });
  return `Friend request sent to ${target.name}.`;
});

export const acceptFriendRequest = (id) => act(async () => {
  const player = requireCharacter();
  const request = state.requests.find((entry) => entry.id === id);
  if (!request) throw new Error("That request is no longer available.");
  await befriend(state.identity, player.name, id, request.name);
  return `You and ${request.name} are now friends.`;
});

export const declineFriendRequest = (id) => act(async () => {
  await set(ref(db, `friendRequests/${state.identity}/${id}`), null);
});

export const removeFriend = (id) => act(async () => {
  const friend = state.friends.find((entry) => entry.id === id);
  await update(ref(db), { [`friends/${state.identity}/${id}`]: null, [`friends/${id}/${state.identity}`]: null });
  return friend ? `${friend.name} was removed from your friends.` : "";
});

export const clearSocialMessages = () => {
  state = { ...state, error: "", notice: "" };
  emit();
};

// Live friends/requests for the loaded character; returns a cleanup function. `onChange` runs after every update.
export const startSocial = (onChange = () => {}) => {
  const me = getCharacterIdentity();
  state = { identity: me || null, friends: [], requests: [], presence: {}, pending: false, error: "", notice: "" };
  listeners.add(onChange);
  if (!me) return () => listeners.delete(onChange);
  const warn = (error) => console.warn("Social unavailable", error);
  let presenceStops = {};
  const watchPresence = () => {
    const ids = new Set(state.friends.map((friend) => friend.id));
    for (const [id, stop] of Object.entries(presenceStops))
      if (!ids.has(id)) {
        stop();
        delete presenceStops[id];
      }
    for (const id of ids) if (!presenceStops[id]) presenceStops[id] = watchFriend(id);
  };
  const watchFriend = (id) => onValue(ref(db, `groupPresence/${id}`), (snapshot) => {
    state = { ...state, presence: { ...state.presence, [id]: snapshot.val() } };
    emit();
  }, warn);
  const stops = [
    onValue(ref(db, `friends/${me}`), (snapshot) => {
      const friends = Object.entries(snapshot.val() || {})
        .map(([id, entry]) => ({ id, name: entry?.name || "Unknown", since: entry?.since || 0 }))
        .sort((a, b) => a.name.localeCompare(b.name));
      state = { ...state, friends };
      watchPresence();
      emit();
    }, warn),
    onValue(ref(db, `friendRequests/${me}`), (snapshot) => {
      const requests = Object.entries(snapshot.val() || {})
        .map(([id, entry]) => ({ id, name: entry?.name || "Unknown", at: entry?.at || 0 }))
        .sort((a, b) => b.at - a.at);
      state = { ...state, requests };
      emit();
    }, warn),
  ];
  return () => {
    stops.forEach((stop) => stop());
    Object.values(presenceStops).forEach((stop) => stop());
    presenceStops = {};
    listeners.delete(onChange);
    state = { identity: null, friends: [], requests: [], presence: {}, pending: false, error: "", notice: "" };
  };
};
