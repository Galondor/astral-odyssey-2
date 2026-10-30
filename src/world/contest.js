import { get, onDisconnect, onValue, ref, set, update } from "firebase/database";
import { auth, db } from "../firebase";
import { commitPlayerChange, flushPlayer, getCharacterIdentity, getPlayer, setPlayer } from "../character/player";
import { createContestFighter, getEnemy, playContestAction } from "../combat/combat";
import { getColosseumRun } from "./colosseum";
import { isInDungeon } from "./dungeons";
import { isLabyrinthActive } from "./labyrinth";
import { isInGroupDungeon } from "./groupState";
import { updateRecords } from "../character/records";

export const CONTEST_TURN_MS = 60_000;
export const CONTEST_QUEUE_TTL_MS = 90_000;
export const CONTEST_MIN_LEVEL = 25;
let lobby = null;
let ready = false;
let presenceReady = false;
let serverOffset = 0;
let saving = false;
let errorMessage = "";
const listeners = new Set();
let deferredLobby;
let hasDeferredLobby = false;
let acceptLobby = null;
const now = () => Date.now() + serverOffset;
const publish = () => listeners.forEach((listener) => listener());
const reportError = (error) => {
  console.error("Contest operation failed", error);
  errorMessage = error.message || "Contest could not be updated. Please try again.";
  publish();
};

export const subscribeContest = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getContestStatus = () => {
  const uid = getCharacterIdentity();
  const entry = lobby?.entries?.[uid];
  const match = entry?.matchId ? lobby?.matches?.[entry.matchId] : null;
  return {
    uid, entry, match, ready: ready && presenceReady, saving, error: errorMessage,
    locked: saving || commandPending || entry?.status === "waiting" || entry?.status === "playing",
    waiting: entry?.status === "waiting",
    playing: entry?.status === "playing",
    yourTurn: !!match && !match.winner && match.turn === uid,
    remainingMs: match ? Math.max(0, match.deadline - now()) : 0,
  };
};

const combatPlayer = (player) => {
  const snapshot = JSON.parse(JSON.stringify({
    name: player.name, level: player.level, class: player.class,
    stats: player.stats, equipment: player.equipment || {},
    skills: player.skills || {}, equippedSkills: player.equippedSkills || [],
    consumables: player.consumables || {}, keyItems: player.keyItems || [],
  }));
  snapshot.stats.health = snapshot.stats.maxHealth;
  snapshot.stats.power = snapshot.stats.maxPower;
  snapshot.stats.stamina = snapshot.stats.maxStamina;
  return snapshot;
};

const completeMatch = (state, match, winner, reason) => {
  match.winner = winner;
  match.reason = reason;
  for (const id of [match.host, match.guest]) {
    const entry = state.entries[id];
    entry.status = "idle";
    if (id === winner) entry.kills = (entry.kills || 0) + 1;
    else entry.deaths = (entry.deaths || 0) + 1;
  }
};

// Pure reducer: concurrent writes may be retried, so never spend items or save locally here.
export const reduceContest = (current, actor, accountId, command, timestamp) => {
  const state = JSON.parse(JSON.stringify(current || { revision: 0, entries: {}, matches: {} }));
  state.entries ||= {};
  state.matches ||= {};
  const entry = state.entries[actor];
  if (command.type === "queue") {
    if (entry?.status === "playing") throw new Error("Finish your current Contest first.");
    if (entry?.status === "waiting" && entry.expiresAt > timestamp)
      throw new Error("You are already queued for Contest.");
    state.entries[actor] = {
      ...entry, accountId, status: "waiting", queuedAt: timestamp,
      expiresAt: timestamp + CONTEST_QUEUE_TTL_MS,
      fighter: createContestFighter(combatPlayer(command.player)),
      matchId: null,
    };
  } else if (command.type === "cancel") {
    if (entry?.status !== "waiting") throw new Error("The queue changed. Check your Contest before leaving.");
    entry.status = "idle";
  } else if (command.type === "heartbeat") {
    if (entry?.status !== "waiting") return undefined;
    // An expired ticket must be explicitly rejoined, not resurrected by a delayed client.
    if (entry.expiresAt <= timestamp) entry.status = "idle";
    else entry.expiresAt = timestamp + CONTEST_QUEUE_TTL_MS;
  } else {
    const match = entry?.matchId && state.matches[entry.matchId];
    if (!match || match.winner) throw new Error("This Contest has already ended.");
    if (command.matchId !== entry.matchId || command.revision !== match.revision)
      throw new Error("The Contest changed. Wait for the latest turn.");
    if (command.type === "timeout") {
      if (timestamp < match.deadline) return undefined;
      completeMatch(state, match, match.turn === match.host ? match.guest : match.host, "timeout");
    } else if (command.type === "forfeit") {
      completeMatch(state, match, actor === match.host ? match.guest : match.host, "forfeit");
    } else if (command.type === "action") {
      if (match.turn !== actor) throw new Error("Wait for your opponent's turn.");
      if (timestamp >= match.deadline) throw new Error("Your turn has expired.");
      const opponent = actor === match.host ? match.guest : match.host;
      const before = match.fighters[actor];
      const { attacker, defender, replies } = playContestAction(before, match.fighters[opponent], command.action);
      match.fighters[actor] = attacker;
      match.fighters[opponent] = defender;
      for (const [key, count] of Object.entries(before.player.consumables || {})) {
        const spent = count - (attacker.player.consumables?.[key] || 0);
        if (spent > 0) {
          entry.spent ||= {};
          entry.spent[key] = (entry.spent[key] || 0) + spent;
        }
      }
      match.log = [...(match.log || []), {
        actor: attacker.player.name,
        replies,
      }].slice(-30);
      if (defender.player.stats.health <= 0) completeMatch(state, match, actor, "kill");
      else if (attacker.player.stats.health <= 0) completeMatch(state, match, opponent, "kill");
      else {
        match.turn = opponent;
        match.deadline = timestamp + CONTEST_TURN_MS;
      }
    } else throw new Error("Unknown Contest command.");
    match.revision += 1;
  }
  const waiting = Object.entries(state.entries)
    .filter(([id, ticket]) => command.livePlayers?.[id] === true && ticket.status === "waiting" && ticket.expiresAt > timestamp)
    .sort(([a, first], [b, second]) => first.queuedAt - second.queuedAt || a.localeCompare(b));
  const own = state.entries[actor];
  if (own.status === "waiting" && own.expiresAt > timestamp) {
    const candidate = waiting.find(([id, ticket]) => id !== actor && ticket.accountId !== accountId);
    if (candidate) {
      const [host, hostEntry] = candidate;
      const id = `${host}-${actor}-${state.revision + 1}`;
      const first = hostEntry.fighter.combat;
      const second = own.fighter.combat;
      const hostSpeed = Math.round(hostEntry.fighter.player.stats.speed * (1 + (first.ab?.speedMult || 0)));
      const guestSpeed = Math.round(own.fighter.player.stats.speed * (1 + (second.ab?.speedMult || 0)));
      const turn = hostSpeed >= guestSpeed ? host : actor;
      first.playerActsFirst = turn === host;
      second.playerActsFirst = turn === actor;
      state.matches[id] = {
        host, guest: actor, fighters: { [host]: hostEntry.fighter, [actor]: own.fighter },
        turn, deadline: timestamp + CONTEST_TURN_MS, revision: 0,
      };
      for (const ticket of [hostEntry, own]) {
        ticket.status = "playing";
        ticket.matchId = id;
        delete ticket.fighter;
      }
    }
  }
  state.revision += 1;
  state.actor = actor;
  state.command = command.type;
  for (const [id, match] of Object.entries(state.matches))
    if (match.winner && !Object.values(state.entries).some((ticket) => ticket.matchId === id))
      delete state.matches[id];
  return state;
};

export const reconcileContestProgress = (player, entry) => {
  const progress = player.contestProgress || {};
  const kills = entry.kills || 0;
  const deaths = entry.deaths || 0;
  const wins = kills - (progress.kills || 0);
  const losses = deaths - (progress.deaths || 0);
  if (wins < 0 || losses < 0) throw new Error("Contest results are out of sync. Reload your cloud save.");
  const consumables = { ...player.consumables };
  let spentAny = false;
  for (const [key, total] of Object.entries(entry.spent || {})) {
    const spent = total - (progress.spent?.[key] || 0);
    if (spent < 0 || spent > (consumables[key] || 0))
      throw new Error("Contest items are out of sync. Reload your cloud save.");
    if (spent) {
      spentAny = true;
      consumables[key] -= spent;
      if (!consumables[key]) delete consumables[key];
    }
  }
  if (!wins && !losses && !spentAny) return null;
  return updateRecords(player, {
    consumables,
    materials: { ...player.materials, proof_of_victory: (player.materials?.proof_of_victory || 0) + wins },
    contestProgress: { kills, deaths, spent: entry.spent || {} },
  }, { increments: { playerKills: wins, playerDeaths: losses } });
};

const saveProgress = async (entry, identity = getCharacterIdentity()) => {
  if (!entry || !getPlayer()) return;
  await commitPlayerChange(() => {
    if (identity !== getCharacterIdentity()) throw new Error("Your active character changed during Contest.");
    const patch = reconcileContestProgress(getPlayer(), entry);
    if (patch) setPlayer(patch);
  });
};

let commandPending = false;
export const sendContestCommand = async (command) => {
  if (commandPending) throw new Error("Wait for your Contest action to finish.");
  if (!ready || !presenceReady) throw new Error("Contest is connecting. Please wait.");
  const actor = getCharacterIdentity();
  const accountId = auth.currentUser?.uid;
  if (!actor || !accountId) throw new Error("Sign in before entering Contest.");
  if (command.type === "queue" && (getPlayer()?.level || 1) < CONTEST_MIN_LEVEL)
    throw new Error(`Reach level ${CONTEST_MIN_LEVEL} before entering Contest.`);
  commandPending = true;
  errorMessage = "";
  publish();
  try {
    if (command.type === "queue") {
      if (getEnemy() || getColosseumRun() || isInDungeon() || isLabyrinthActive() || isInGroupDungeon())
        throw new Error("Finish your current battle or adventure before joining Contest.");
      await flushPlayer();
      await saveProgress(lobby?.entries?.[actor]);
      command = { ...command, player: getPlayer() };
      if (!command.player?.name || !command.player.stats || command.player.needsNameChange)
        throw new Error("Create your character before entering Contest.");
    }
    const match = getContestStatus().match;
    const request = { ...command, matchId: match && lobby.entries[actor].matchId, revision: match?.revision };
    // Rules compare-and-swap the lobby revision in the same multi-location write.
    // Child write grants keep unrelated tickets/matches protected (a root transaction
    // would require granting every player permission to replace the entire lobby).
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const current = (await get(ref(db, "contest"))).val();
      if (command.type === "queue" || command.type === "heartbeat")
        request.livePlayers = (await get(ref(db, "contestPresence"))).val() || {};
      const next = reduceContest(current, actor, accountId, request, now());
      if (!next) return;
      const writes = { revision: next.revision, actor: next.actor, command: next.command };
      for (const section of ["entries", "matches"])
        for (const key of new Set([...Object.keys(next[section] || {}), ...Object.keys(current?.[section] || {})])) {
          const value = next[section]?.[key] || null;
          if (JSON.stringify(value) !== JSON.stringify(current?.[section]?.[key]))
            writes[`${section}/${key}`] = value;
        }
      try {
        await update(ref(db, "contest"), writes);
      } catch (failure) {
        if (failure.code !== "PERMISSION_DENIED" || attempt === 4) throw failure;
        continue;
      }
      lobby = next;
      await saveProgress(next.entries[actor], actor);
      publish();
      return;
    }
  } finally {
    commandPending = false;
    if (hasDeferredLobby && acceptLobby) {
      hasDeferredLobby = false;
      acceptLobby(deferredLobby);
    }
    publish();
  }
};

// Lives for the character session, not the Arena tab: reloads and hidden screens still settle results.
export const startContest = () => {
  const identity = getCharacterIdentity();
  let stopped = false;
  let saves = Promise.resolve();
  let outstandingSaves = 0;
  let presenceVersion = 0;
  ready = false;
  presenceReady = false;
  lobby = null;
  errorMessage = "";
  const presence = ref(db, `contestPresence/${identity}`);
  const disconnect = onDisconnect(presence);
  const stopConnection = onValue(ref(db, ".info/connected"), (snapshot) => {
    const version = ++presenceVersion;
    presenceReady = false;
    publish();
    if (snapshot.val() !== true) return;
    disconnect.set(false).then(async () => {
      if (stopped || version !== presenceVersion) return;
      await set(presence, true);
      if (!stopped && version === presenceVersion) {
        presenceReady = true;
        publish();
      }
    }).catch(reportError);
  }, reportError);
  const stopOffset = onValue(ref(db, ".info/serverTimeOffset"), (snapshot) => {
    serverOffset = Number(snapshot.val()) || 0;
  }, reportError);
  const receive = (value) => {
    if (stopped) return;
    lobby = value;
    ready = true;
    const entry = lobby?.entries?.[identity];
    try {
      if (!entry || !getPlayer() || !reconcileContestProgress(getPlayer(), entry)) {
        publish();
        return;
      }
    } catch (failure) {
      reportError(failure);
      return;
    }
    outstandingSaves += 1;
    saving = true;
    publish();
    saves = saves.then(async () => {
      if (!stopped && identity === getCharacterIdentity()) await saveProgress(entry, identity);
    }).catch(reportError).finally(() => {
      outstandingSaves -= 1;
      if (!stopped) {
        saving = outstandingSaves > 0;
        publish();
      }
    });
  };
  acceptLobby = receive;
  const stop = onValue(ref(db, "contest"), (snapshot) => {
    // update() emits optimistic local events. Never award unconfirmed results.
    if (commandPending) {
      deferredLobby = snapshot.val();
      hasDeferredLobby = true;
    } else receive(snapshot.val());
  }, reportError);
  let lastHeartbeat = 0;
  const timer = setInterval(() => {
    const status = getContestStatus();
    if (stopped || commandPending || !ready || !presenceReady || errorMessage) return;
    if (status.playing && status.remainingMs === 0)
      sendContestCommand({ type: "timeout" }).catch(reportError);
    else if (status.waiting && now() - lastHeartbeat >= 25_000) {
      lastHeartbeat = now();
      sendContestCommand({ type: "heartbeat" }).catch(reportError);
    }
  }, 1000);
  return () => {
    stopped = true;
    acceptLobby = null;
    hasDeferredLobby = false;
    stop();
    stopOffset();
    stopConnection();
    set(presence, false).then(() => disconnect.cancel()).catch(reportError);
    clearInterval(timer);
    lobby = null;
    ready = false;
    presenceReady = false;
    saving = false;
  };
};
