import { get, onDisconnect, onValue, push, ref, set, update } from "firebase/database";
import { db } from "../firebase";
import { commitPlayerChange, flushPlayer, getCharacterIdentity, getPlayer, setPlayer } from "../character/player";
import { getEnemy } from "../combat/combat";
import { getColosseumRun } from "./colosseum";
import { getContestStatus } from "./contest";
import { isInDungeon } from "./dungeons";
import { isLabyrinthActive } from "./labyrinth";
import { setGroupDungeonActive } from "./groupState";
import { GROUP_DUNGEONS } from "./groupDungeonData";
import { filterChatText } from "../shared/names";
import {
  allIntentsIn, createGroupRun, failRunOnTimeout, getGroupDungeon, markLeft, normalizeRun,
  reconcileGroupRun, resolveRunRound, serializeRun,
} from "./groupDungeons";

/*
 Group dungeon networking. The party lives at groupParties/<id>; each character points at its party from
 groupMembership/<identity>. The leader's client is the authority for the run: it resolves rounds once every
 member has locked in an intent (or the round timer expires) and writes the run with revision + 1. When the
 leader goes offline the first online member takes over. Every member claims its own rewards from the finished run.
*/

export const GROUP_MAX_MEMBERS = 3;
export const GROUP_CHAT_LIMIT = 30;
export const GROUP_LEADER_GRACE_MS = 8_000;
export const GROUP_CHAT_MAX = 200;

let identity = null;
let partyId = null;
let party = null;
let invites = {};
let lfg = {};
let presence = {};
let connected = false;
let serverOffset = 0;
let errorMessage = "";
let pending = false;
let writing = false;
let claimLines = [];
let lastRun = null;
let runCache = { key: null, run: null };
const listeners = new Set();
const now = () => Date.now() + serverOffset;
const publish = () => listeners.forEach((listener) => listener());
const clone = (value) => JSON.parse(JSON.stringify(value));
const partyPath = (suffix = "") => `groupParties/${partyId}${suffix ? `/${suffix}` : ""}`;

const reportError = (error) => {
  console.error("Group dungeon operation failed", error);
  errorMessage = error?.message || "The group could not be updated. Please try again.";
  publish();
};

export const subscribeGroup = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const clearGroupError = () => {
  errorMessage = "";
  publish();
};

const currentRun = () => {
  const raw = party?.run;
  if (!raw) return null;
  const key = `${raw.id}:${raw.revision}`;
  if (runCache.key !== key) runCache = { key, run: normalizeRun(clone(raw)) };
  return runCache.run;
};

const memberIds = () => Object.keys(party?.members || {});
const inRun = (run, id = identity) => !!run && run.members.includes(id) && !run.left[id];

// Reason this character can't ready up / join a run right now (null if free).
export const groupBusyReason = () => {
  if (getEnemy()) return "Finish your current battle first.";
  if (getColosseumRun()) return "Finish your Colosseum run first.";
  if (isInDungeon()) return "Finish your current dungeon first.";
  if (isLabyrinthActive()) return "Leave the Labyrinth first.";
  if (getContestStatus().locked) return "Leave the Contest queue first.";
  return null;
};

export const getGroupStatus = () => {
  const run = currentRun();
  const isLeader = !!party && party.leader === identity;
  const members = memberIds().map((id) => ({
    id,
    name: party.members[id].name,
    level: party.members[id].level,
    joinedAt: party.members[id].joinedAt || 0,
    ready: !!party.members[id].ready,
    claimed: party.members[id].claimed || null,
    online: presence[id] === true,
    leader: party.leader === id,
  })).sort((a, b) => (b.leader - a.leader) || a.joinedAt - b.joinedAt || a.name.localeCompare(b.name));
  const intents = party?.intents || {};
  const intentsIn = {};
  if (run) for (const id of run.members) {
    const intent = intents[id];
    intentsIn[id] = !!intent && intent.run === run.id && intent.round === run.round && intent.stage === run.stage;
  }
  const active = run?.status === "active";
  const dungeon = party ? getGroupDungeon(party.dungeon) : null;
  const unclaimed = run && !active
    ? run.members.filter((id) => !run.left[id] && party.members?.[id] && party.members[id].claimed !== run.id)
    : [];
  let startBlocker = null;
  if (!party) startBlocker = "No party.";
  else if (!isLeader) startBlocker = "Only the leader can start the run.";
  else if (active) startBlocker = "A run is already underway.";
  else if (unclaimed.length) startBlocker = "Waiting for everyone to collect the last run's rewards.";
  else if (members.some((m) => !m.ready)) startBlocker = "Everyone must be ready.";
  else if (members.some((m) => m.level < (dungeon?.level || 0))) startBlocker = `Everyone must be at least level ${dungeon.level}.`;
  return {
    identity,
    connected,
    partyId,
    party,
    dungeon,
    isLeader,
    members,
    invites: Object.entries(invites || {}).map(([id, invite]) => ({ id, ...invite })).sort((a, b) => b.at - a.at),
    lfg: Object.entries(lfg || {}).filter(([id]) => id !== partyId)
      .map(([id, listing]) => ({ id, ...listing })).sort((a, b) => b.at - a.at),
    chat: Object.entries(party?.chat || {}).map(([id, msg]) => ({ id, ...msg })).sort((a, b) => a.at - b.at),
    run,
    active,
    inRun: inRun(run),
    intentsIn,
    myIntent: run && intentsIn[identity] ? intents[identity] : null,
    remainingMs: active ? Math.max(0, run.deadline - now()) : 0,
    roundRemainingMs: active ? Math.max(0, run.roundDeadline - now()) : 0,
    startBlocker,
    unclaimed,
    claimLines,
    pending,
    error: errorMessage,
  };
};

// ---- Claiming results ----

let claiming = null;
const claim = (run, { leaving = false } = {}) => {
  if (!run || !run.members.includes(identity) || (run.status === "active" && !leaving)) return Promise.resolve();
  if (claiming) return claiming;
  const owner = identity;
  const claimedParty = partyId;
  claiming = (async () => {
    let lines = null;
    if (!getPlayer()?.groupDungeonClaims?.[run.id])
      await commitPlayerChange(() => {
        if (owner !== getCharacterIdentity()) throw new Error("Your active character changed during the group dungeon.");
        const result = reconcileGroupRun(getPlayer(), run, owner, { leaving });
        if (!result) return;
        setPlayer(result.patch);
        lines = result.lines;
      });
    if (lines?.length) claimLines = lines;
    if (claimedParty && claimedParty === partyId && party?.members?.[owner] && party.members[owner].claimed !== run.id)
      await set(ref(db, `groupParties/${claimedParty}/members/${owner}/claimed`), run.id);
  })().catch(reportError).finally(() => {
    claiming = null;
    publish();
  });
  return claiming;
};

const syncSelf = () => {
  const run = currentRun();
  if (run) lastRun = run;
  setGroupDungeonActive(run?.status === "active" && inRun(run) && !!party?.members?.[identity]);
  if (!run || !party?.members?.[identity]) return;
  if (run.status !== "active" && run.members.includes(identity) && party.members[identity].claimed !== run.id) claim(run);
  // A new run consumed this member's ready snapshot.
  if (run.status === "active" && run.members.includes(identity) && party.members[identity].ready)
    update(ref(db, partyPath(`members/${identity}`)), { ready: false, snapshot: null }).catch(reportError);
};

// ---- Actions ----

const act = async (fn) => {
  if (pending) return false;
  pending = true;
  errorMessage = "";
  publish();
  try {
    await fn();
    return true;
  } catch (failure) {
    reportError(failure);
    return false;
  } finally {
    pending = false;
    publish();
  }
};

const requireIdentity = () => {
  if (!identity || identity !== getCharacterIdentity()) throw new Error("Load your character before forming a group.");
  const player = getPlayer();
  if (!player?.name || !player.stats || player.needsNameChange) throw new Error("Create your character before forming a group.");
  return player;
};
const requireLeader = () => {
  if (!party || party.leader !== identity) throw new Error("Only the party leader can do that.");
};
const memberEntry = (player) => ({ name: player.name, level: player.level || 1, ready: false, joinedAt: now() });

const lfgListing = () => {
  const run = currentRun();
  if (!party?.open || run?.status === "active" || memberIds().length >= GROUP_MAX_MEMBERS) return null;
  const leader = party.members?.[party.leader];
  return { dungeon: party.dungeon, leaderName: leader?.name || "Unknown", size: memberIds().length, at: now() };
};
const syncLfg = async () => {
  if (!partyId || party?.leader !== identity) return;
  const listing = lfgListing();
  const current = lfg?.[partyId] || null;
  if (!listing && !current) return;
  if (listing && current && current.dungeon === listing.dungeon && current.size === listing.size && current.leaderName === listing.leaderName) return;
  await set(ref(db, `groupLfg/${partyId}`), listing);
};

const formParty = async (player, dungeonId) => {
  if (partyId) throw new Error("You are already in a party.");
  const dungeon = getGroupDungeon(dungeonId);
  if (!dungeon) throw new Error("Choose a dungeon.");
  const id = push(ref(db, "groupParties")).key;
  const created = {
    leader: identity, dungeon: dungeonId, open: false, createdAt: now(),
    members: { [identity]: memberEntry(player) },
  };
  await set(ref(db, `groupParties/${id}`), created);
  await set(ref(db, `groupMembership/${identity}`), id);
  partyId = id;
  return created;
};

export const createParty = (dungeonId) => act(() => formParty(requireIdentity(), dungeonId));

export const setPartyDungeon = (dungeonId) => act(async () => {
  requireLeader();
  if (!GROUP_DUNGEONS[dungeonId]) throw new Error("Choose a dungeon.");
  if (currentRun()?.status === "active") throw new Error("You can't change dungeons during a run.");
  await set(ref(db, partyPath("dungeon")), dungeonId);
});

export const setPartyOpen = (open) => act(async () => {
  requireLeader();
  await set(ref(db, partyPath("open")), !!open);
  party = { ...party, open: !!open };
  await syncLfg();
});

export const lookupIdentity = async (name) => {
  const trimmed = String(name || "").trim();
  if (!/^[a-zA-Z]{1,64}$/.test(trimmed)) throw new Error("Enter a character name (letters only).");
  const variants = [trimmed, trimmed[0].toUpperCase() + trimmed.slice(1).toLowerCase()];
  for (const variant of new Set(variants)) {
    const owner = (await get(ref(db, `characterNames/${variant}`))).val();
    if (owner) return { id: owner, name: variant };
  }
  throw new Error(`No character named ${trimmed} was found.`);
};

const sendInvite = async (player, current, name) => {
  if (Object.keys(current.members || {}).length >= GROUP_MAX_MEMBERS) throw new Error("Your party is full.");
  const target = await lookupIdentity(name);
  if (target.id === identity) throw new Error("You can't invite yourself.");
  if (current.members?.[target.id]) throw new Error(`${target.name} is already in your party.`);
  await set(ref(db, `groupInvites/${target.id}/${partyId}`), { from: player.name, dungeon: current.dungeon, at: now() });
  return target;
};

export const invitePlayer = (name) => act(async () => {
  const player = requireIdentity();
  requireLeader();
  await sendInvite(player, party, name);
});

// Invites from outside the lobby (Social tab): forms a party for the hardest unlocked dungeon when needed.
export const inviteToParty = (name) => act(async () => {
  const player = requireIdentity();
  let current = party;
  if (!partyId) {
    const dungeon = Object.values(GROUP_DUNGEONS)
      .filter((entry) => (player.level || 1) >= entry.level)
      .sort((a, b) => b.level - a.level)[0];
    if (!dungeon) throw new Error(`Group dungeons unlock at level ${Math.min(...Object.values(GROUP_DUNGEONS).map((entry) => entry.level))}.`);
    current = await formParty(player, dungeon.id);
  } else {
    requireLeader();
    if (currentRun()?.status === "active") throw new Error("You can't invite players during a run.");
  }
  await sendInvite(player, current, name);
});

const joinExisting = async (id, { invited }) => {
  const player = requireIdentity();
  if (partyId) throw new Error("Leave your current party first.");
  const target = (await get(ref(db, `groupParties/${id}`))).val();
  if (!target) {
    await set(ref(db, invited ? `groupInvites/${identity}/${id}` : `groupLfg/${id}`), null).catch(() => {});
    throw new Error("That party has disbanded.");
  }
  if (!invited && !target.open) throw new Error("That party is no longer open.");
  if (Object.keys(target.members || {}).length >= GROUP_MAX_MEMBERS) throw new Error("That party is full.");
  if (target.run?.status === "active") throw new Error("That party is already inside a dungeon. Try again after their run.");
  await set(ref(db, `groupParties/${id}/members/${identity}`), memberEntry(player));
  await set(ref(db, `groupMembership/${identity}`), id);
  if (invited) await set(ref(db, `groupInvites/${identity}/${id}`), null);
  partyId = id;
};

export const acceptInvite = (id) => act(() => joinExisting(id, { invited: true }));
export const joinParty = (id) => act(() => joinExisting(id, { invited: false }));
export const declineInvite = (id) => act(() => set(ref(db, `groupInvites/${identity}/${id}`), null));

const deleteParty = async () => {
  const id = partyId;
  for (const member of memberIds()) if (member !== identity) await set(ref(db, `groupMembership/${member}`), null);
  await set(ref(db, `groupLfg/${id}`), null);
  await set(ref(db, `groupParties/${id}`), null);
  await set(ref(db, `groupMembership/${identity}`), null);
};

export const leaveParty = () => act(async () => {
  if (!partyId || !party) throw new Error("You are not in a party.");
  const run = currentRun();
  if (run?.status === "active" && inRun(run)) await claim(run, { leaving: true });
  const others = memberIds().filter((id) => id !== identity);
  if (party.leader === identity) {
    if (!others.length) {
      await deleteParty();
      partyId = null;
      party = null;
      setGroupDungeonActive(false);
      return;
    }
    const heir = others.find((id) => presence[id] === true) || others[0];
    await set(ref(db, `groupLfg/${partyId}`), null);
    await set(ref(db, partyPath("leader")), heir);
  }
  await set(ref(db, partyPath(`members/${identity}`)), null);
  await set(ref(db, `groupMembership/${identity}`), null);
  partyId = null;
  party = null;
  setGroupDungeonActive(false);
});

export const disbandParty = () => act(async () => {
  requireLeader();
  const status = getGroupStatus();
  if (status.active) throw new Error("You can't disband during a run. Leave the run instead.");
  if (status.unclaimed.some((id) => id !== identity)) throw new Error("Wait for everyone to collect the last run's rewards.");
  await deleteParty();
  partyId = null;
  party = null;
});

export const kickMember = (id) => act(async () => {
  requireLeader();
  if (id === identity) throw new Error("You can't kick yourself.");
  if (!party.members?.[id]) return;
  await update(ref(db), { [partyPath(`members/${id}`)]: null, [`groupMembership/${id}`]: null });
});

export const promoteMember = (id) => act(async () => {
  requireLeader();
  if (!party.members?.[id]) throw new Error("That character is not in your party.");
  await set(ref(db, `groupLfg/${partyId}`), null);
  await set(ref(db, partyPath("leader")), id);
});

const combatSnapshot = (player) => clone({
  name: player.name, level: player.level || 1, class: player.class || null,
  stats: player.stats, equipment: player.equipment || {},
  skills: player.skills || {}, equippedSkills: player.equippedSkills || [],
  consumables: player.consumables || {}, keyItems: player.keyItems || [],
});

export const setReady = (ready) => act(async () => {
  const player = requireIdentity();
  if (!party?.members?.[identity]) throw new Error("You are not in a party.");
  if (!ready) {
    await update(ref(db, partyPath(`members/${identity}`)), { ready: false, snapshot: null });
    return;
  }
  const dungeon = getGroupDungeon(party.dungeon);
  if ((player.level || 1) < dungeon.level) throw new Error(`Reach level ${dungeon.level} to enter ${dungeon.name}.`);
  const busy = groupBusyReason();
  if (busy) throw new Error(busy);
  if (currentRun()?.status === "active") throw new Error("Your party is already in a run.");
  await flushPlayer();
  const fresh = getPlayer();
  await update(ref(db, partyPath(`members/${identity}`)), {
    name: fresh.name, level: fresh.level || 1, ready: true, snapshot: combatSnapshot(fresh),
  });
});

export const sendChat = (text) => act(async () => {
  const player = requireIdentity();
  if (!party?.members?.[identity]) throw new Error("You are not in a party.");
  const message = filterChatText(String(text || "").trim().slice(0, GROUP_CHAT_MAX));
  if (!message) return;
  await set(push(ref(db, partyPath("chat"))), { from: identity, name: player.name, text: message, at: now() });
});

export const startRun = () => act(async () => {
  requireLeader();
  const status = getGroupStatus();
  if (status.startBlocker) throw new Error(status.startBlocker);
  const ids = memberIds();
  const snapshots = {};
  for (const id of ids) {
    const snapshot = party.members[id].snapshot;
    if (!snapshot?.stats) throw new Error(`${party.members[id].name} is not ready.`);
    snapshots[id] = snapshot;
  }
  const t = now();
  const runId = push(ref(db, partyPath("run"))).key;
  const run = createGroupRun({ id: runId, dungeonId: party.dungeon, members: ids, snapshots, now: t, actor: identity });
  await update(ref(db, partyPath()), { run: serializeRun(run), intents: null });
  await set(ref(db, `groupLfg/${partyId}`), null);
});

export const submitIntent = (intent) => act(async () => {
  const run = currentRun();
  if (run?.status !== "active" || !inRun(run)) throw new Error("You are not in an active run.");
  await set(ref(db, partyPath(`intents/${identity}`)), clone({
    ...intent, run: run.id, round: run.round, stage: run.stage, at: now(),
  }));
});

// ---- Leader duties ----

const leaderTick = async () => {
  if (!party || party.leader !== identity || writing || !connected) return;
  writing = true;
  try {
    const raw = party.run;
    if (raw?.status === "active") {
      const t = now();
      const run = normalizeRun(clone(raw));
      let changed = false;
      let resolved = false;
      if (failRunOnTimeout(run, t)) changed = true;
      else {
        const departed = run.members.filter((id) => !party.members?.[id]);
        if (departed.length && markLeft(run, departed, t)) changed = true;
        if (run.status === "active" && (allIntentsIn(run, party.intents) || t >= run.roundDeadline)) {
          resolveRunRound(run, party.intents || {}, t);
          changed = resolved = true;
        }
      }
      if (changed) {
        run.revision = raw.revision + 1;
        run.actor = identity;
        const writes = { run: serializeRun(run) };
        if (resolved) writes.intents = null;
        try {
          await update(ref(db, partyPath()), writes);
        } catch (failure) {
          // Another leader advanced the run first; the listener will deliver the newer revision.
          if (failure?.code !== "PERMISSION_DENIED") throw failure;
        }
      }
    }
    const chat = Object.entries(party?.chat || {}).sort((a, b) => a[1].at - b[1].at);
    if (chat.length > GROUP_CHAT_LIMIT) {
      const prune = {};
      for (const [key] of chat.slice(0, chat.length - GROUP_CHAT_LIMIT)) prune[`chat/${key}`] = null;
      await update(ref(db, partyPath()), prune);
    }
    await syncLfg();
  } finally {
    writing = false;
  }
};

let leaderMissingSince = null;
const successionTick = async () => {
  if (!party || !party.members?.[identity] || party.leader === identity || !connected) {
    leaderMissingSince = null;
    return;
  }
  const leaderGone = !party.members?.[party.leader] || presence[party.leader] !== true;
  if (!leaderGone) {
    leaderMissingSince = null;
    return;
  }
  leaderMissingSince = leaderMissingSince ?? now();
  if (now() - leaderMissingSince < GROUP_LEADER_GRACE_MS) return;
  const heir = memberIds().filter((id) => id === identity || presence[id] === true).sort()[0];
  if (heir !== identity) return;
  leaderMissingSince = null;
  try {
    await set(ref(db, partyPath("leader")), identity);
  } catch (failure) {
    if (failure?.code !== "PERMISSION_DENIED") throw failure;
  }
};

// ---- Session ----

// Lives for the character session (like Contest), so runs keep resolving and rewards settle when the screen is closed.
export const startGroupSession = () => {
  const me = getCharacterIdentity();
  if (!me) return () => {};
  identity = me;
  partyId = null;
  party = null;
  invites = {};
  lfg = {};
  presence = {};
  connected = false;
  errorMessage = "";
  claimLines = [];
  lastRun = null;
  runCache = { key: null, run: null };
  let stopped = false;
  let followed = null;
  let stopParty = () => {};
  let presenceStops = {};
  let presenceVersion = 0;
  const mine = ref(db, `groupPresence/${me}`);
  const disconnect = onDisconnect(mine);
  const stopConnection = onValue(ref(db, ".info/connected"), (snapshot) => {
    const version = ++presenceVersion;
    connected = false;
    publish();
    if (snapshot.val() !== true) return;
    disconnect.set(false).then(async () => {
      if (stopped || version !== presenceVersion) return;
      await set(mine, true);
      if (!stopped && version === presenceVersion) {
        connected = true;
        publish();
      }
    }).catch(reportError);
  }, reportError);
  const stopOffset = onValue(ref(db, ".info/serverTimeOffset"), (snapshot) => {
    serverOffset = Number(snapshot.val()) || 0;
  }, reportError);

  const watchPresence = () => {
    const ids = new Set(memberIds());
    for (const [id, stop] of Object.entries(presenceStops))
      if (!ids.has(id)) {
        stop();
        delete presenceStops[id];
        delete presence[id];
      }
    for (const id of ids) if (!presenceStops[id]) presenceStops[id] = watchMember(id);
  };
  const watchMember = (id) => onValue(ref(db, `groupPresence/${id}`), (snapshot) => {
    presence[id] = snapshot.val();
    publish();
  }, reportError);

  const lostParty = () => {
    const run = lastRun;
    if (run && run.members.includes(me) && !getPlayer()?.groupDungeonClaims?.[run.id])
      claim(run, { leaving: run.status === "active" });
    setGroupDungeonActive(false);
  };

  const followParty = (id) => {
    stopParty();
    stopParty = () => {};
    followed = id;
    party = null;
    runCache = { key: null, run: null };
    if (!id) {
      watchPresence();
      return;
    }
    stopParty = onValue(ref(db, `groupParties/${id}`), (snapshot) => {
      if (stopped || followed !== id) return;
      party = snapshot.val();
      watchPresence();
      if (!party || !party.members?.[me]) {
        // Disbanded or kicked: settle what we know and drop the stale pointer.
        lostParty();
        party = null;
        partyId = null;
        set(ref(db, `groupMembership/${me}`), null).catch(() => {});
      } else syncSelf();
      publish();
    }, reportError);
  };

  const stopMembership = onValue(ref(db, `groupMembership/${me}`), (snapshot) => {
    if (stopped) return;
    const next = snapshot.val() || null;
    if (next === followed) {
      partyId = next;
      publish();
      return;
    }
    if (!next && followed) lostParty();
    partyId = next;
    followParty(next);
    publish();
  }, reportError);
  const stopInvites = onValue(ref(db, `groupInvites/${me}`), (snapshot) => {
    invites = snapshot.val() || {};
    publish();
  }, reportError);
  const stopLfg = onValue(ref(db, "groupLfg"), (snapshot) => {
    lfg = snapshot.val() || {};
    publish();
  }, reportError);

  const timer = setInterval(() => {
    if (stopped) return;
    leaderTick().catch(reportError);
    successionTick().catch(reportError);
    if (party?.run?.status === "active") publish();
  }, 1000);

  return () => {
    stopped = true;
    clearInterval(timer);
    stopParty();
    for (const stop of Object.values(presenceStops)) stop();
    presenceStops = {};
    stopMembership();
    stopInvites();
    stopLfg();
    stopOffset();
    stopConnection();
    set(mine, false).then(() => disconnect.cancel()).catch(reportError);
    setGroupDungeonActive(false);
    identity = null;
    partyId = null;
    party = null;
    connected = false;
  };
};
