import { get, onValue, ref, runTransaction, set } from "firebase/database";
import { getCharacterIdentity, getPlayer } from "../character/player";
import { db } from "../firebase";
import { RUNE_OF_UNPREDICTABILITY_DROP_CHANCE } from "../items/consumables";
import { MATERIALS } from "../items/materials";
import { TITLES } from "../character/titles";
import { isAdmin } from "./inbox";

export const WORLD_BOSS_HEALTH = 1_000_000;
export const WORLD_BOSS_SPAWN_INTERVAL_MS = 72 * 60 * 60 * 1000;
export const WORLD_BOSS_DAILY_ATTEMPTS = 3;
export const WORLD_BOSS_MAX_ROUNDS = 10;
export const WORLD_BOSS_REWARD_THRESHOLD = WORLD_BOSS_HEALTH * 0.01;
export const WORLD_BOSS_UNIQUE_ID = "astralColossusHeart";

const DAY_MS = 24 * 60 * 60 * 1000;
const bossErrors = new Set();
const errorListeners = new Set();

const notifyError = (error) => {
  const message = error?.message || "The World Boss could not be updated. Please try again.";
  bossErrors.add(message);
  errorListeners.forEach((listener) => listener(message));
  console.error("World Boss operation failed", error);
};

export const subscribeWorldBossError = (listener) => {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
};

export const reportWorldBossError = notifyError;
export const clearWorldBossError = () => {
  bossErrors.clear();
  errorListeners.forEach((listener) => listener(""));
};
export const getWorldBossError = () => Array.from(bossErrors).pop() || "";

const cycleStartAt = (now, forcedSpawnAt) => {
  const anchor = Number(forcedSpawnAt) || 0;
  return anchor > 0
    ? anchor + Math.max(0, Math.floor((now - anchor) / WORLD_BOSS_SPAWN_INTERVAL_MS)) * WORLD_BOSS_SPAWN_INTERVAL_MS
    : Math.floor(now / WORLD_BOSS_SPAWN_INTERVAL_MS) * WORLD_BOSS_SPAWN_INTERVAL_MS;
};

export const getWorldBossCycleId = (now = Date.now(), forcedSpawnAt = 0) =>
  String(cycleStartAt(now, forcedSpawnAt));

export const summarizeWorldBoss = (participants = {}) => {
  const fighters = Object.entries(participants)
    .map(([uid, entry]) => ({ uid, ...entry, damage: Math.max(0, Number(entry?.damage) || 0) }))
    .filter((entry) => entry.damage > 0 || entry.activeUntil > Date.now() || entry.attemptsTotal > 0)
    .sort((a, b) => b.damage - a.damage || (a.name || "").localeCompare(b.name || ""));
  const totalDamage = Object.values(participants).reduce(
    (total, entry) => total + Math.max(0, Number(entry?.damage) || 0),
    0,
  );
  return {
    fighters,
    totalDamage,
    health: Math.max(0, WORLD_BOSS_HEALTH - totalDamage),
    defeated: totalDamage >= WORLD_BOSS_HEALTH,
  };
};

export const subscribeWorldBoss = (onChange, onError = notifyError) => {
  let stopParticipants = () => {};
  let stopTotalDamage = () => {};
  let participants = {};
  let totalDamage = 0;
  let currentCycle = "";
  let forcedSpawnAt = 0;
  const publish = () => {
    const summary = summarizeWorldBoss(participants);
    const currentDamage = Math.max(summary.totalDamage, totalDamage);
    onChange({
      cycle: currentCycle,
      participants,
      ...summary,
      totalDamage: currentDamage,
      health: Math.max(0, WORLD_BOSS_HEALTH - currentDamage),
      defeated: currentDamage >= WORLD_BOSS_HEALTH,
      nextSpawnAt: Number(currentCycle) + WORLD_BOSS_SPAWN_INTERVAL_MS,
    });
    if (summary.defeated) deliverWorldBossRewards(currentCycle, participants).catch(onError);
  };
  const refreshCycle = () => {
    const cycle = getWorldBossCycleId(Date.now(), forcedSpawnAt);
    if (cycle !== currentCycle) {
      const previousCycle = currentCycle;
      stopParticipants();
      stopTotalDamage();
      currentCycle = cycle;
      participants = {};
      totalDamage = 0;
      stopParticipants = onValue(
        ref(db, `worldBoss/cycles/${cycle}/players`),
        (playersSnapshot) => {
          participants = playersSnapshot.val() || {};
          publish();
        },
        onError,
      );
      stopTotalDamage = onValue(
        ref(db, `worldBoss/cycles/${cycle}/totalDamage`),
        (damageSnapshot) => {
          totalDamage = Number(damageSnapshot.val()) || 0;
          publish();
        },
        onError,
      );
      if (previousCycle)
        deliverWorldBossResetNotice(previousCycle).catch(onError);
      return;
    }
    publish();
  };
  const stopConfig = onValue(ref(db, "worldBoss/forcedSpawnAt"), (snapshot) => {
    forcedSpawnAt = Number(snapshot.val()) || 0;
    refreshCycle();
  }, onError);
  const cycleTimer = setInterval(refreshCycle, 30_000);
  return () => {
    clearInterval(cycleTimer);
    stopConfig();
    stopParticipants();
    stopTotalDamage();
  };
};

export const getWorldBossSnapshot = async () => {
  const config = await get(ref(db, "worldBoss/forcedSpawnAt"));
  const cycle = getWorldBossCycleId(Date.now(), config.val());
  const [playerSnapshot, totalSnapshot] = await Promise.all([
    get(ref(db, `worldBoss/cycles/${cycle}/players`)),
    get(ref(db, `worldBoss/cycles/${cycle}/totalDamage`)),
  ]);
  const participants = playerSnapshot.val() || {};
  const summary = summarizeWorldBoss(participants);
  const totalDamage = Math.max(summary.totalDamage, Number(totalSnapshot.val()) || 0);
  return {
    cycle,
    participants,
    ...summary,
    totalDamage,
    health: Math.max(0, WORLD_BOSS_HEALTH - totalDamage),
    defeated: totalDamage >= WORLD_BOSS_HEALTH,
    nextSpawnAt: Number(cycle) + WORLD_BOSS_SPAWN_INTERVAL_MS,
  };
};

const playerRecordRef = (cycle, uid) => ref(db, `worldBoss/cycles/${cycle}/players/${uid}`);
const dailyWindow = (now) => Math.floor(now / DAY_MS) * DAY_MS;
let heartbeat = null;
let activeAttempt = null;

const updateParticipant = async (cycle, uid, player, updateRecord) => {
  const now = Date.now();
  const day = dailyWindow(now);
  const result = await runTransaction(playerRecordRef(cycle, uid), (current) => {
    const record = current || {
      name: player.name,
      damage: 0,
      attemptsDay: day,
      attemptsUsed: 0,
      attemptsTotal: 0,
      activeUntil: 0,
    };
    const attemptsUsed = record.attemptsDay === day ? Number(record.attemptsUsed) || 0 : 0;
    return updateRecord({
      ...record,
      name: player.name,
      attemptsDay: day,
      attemptsUsed,
      attemptsTotal: Number(record.attemptsTotal) || 0,
    }, now);
  }, { applyLocally: false });
  return result;
};

export const startWorldBossAttempt = async (player = getPlayer()) => {
  if (!player?.name || !player.stats) return { ok: false, message: "Create a character before fighting the World Boss." };
  if ((player.level || 1) < 35) return { ok: false, message: "The World Boss unlocks at level 35." };
  if (activeAttempt) return { ok: false, message: "You already have an active World Boss attempt." };

  const uid = getCharacterIdentity();
  if (!uid) return { ok: false, message: "Your character identity is unavailable. Reload and try again." };
  const snapshot = await get(ref(db, "worldBoss/forcedSpawnAt"));
  const cycle = getWorldBossCycleId(Date.now(), snapshot.val());
  const [playerSnapshot, damageSnapshot] = await Promise.all([
    get(ref(db, `worldBoss/cycles/${cycle}/players`)),
    get(ref(db, `worldBoss/cycles/${cycle}/totalDamage`)),
  ]);
  const participants = playerSnapshot.val() || {};
  const summary = summarizeWorldBoss(participants);
  if (Math.max(summary.totalDamage, Number(damageSnapshot.val()) || 0) >= WORLD_BOSS_HEALTH)
    return { ok: false, message: "The World Boss has been defeated. The next one will arrive in 72 hours." };
  const remainingHealth = Math.max(0, WORLD_BOSS_HEALTH - Math.max(summary.totalDamage, Number(damageSnapshot.val()) || 0));

  const now = Date.now();
  const attempt = await updateParticipant(cycle, uid, player, (record) => {
    if (record.activeUntil > now) return undefined;
    if (record.attemptsUsed >= WORLD_BOSS_DAILY_ATTEMPTS) return undefined;
    return {
      ...record,
      attemptsUsed: record.attemptsUsed + 1,
      attemptsTotal: (Number(record.attemptsTotal) || 0) + 1,
      activeUntil: now + 90_000,
    };
  });
  if (!attempt.committed) {
    const current = attempt.snapshot.val();
    const message = current?.activeUntil > now
      ? "You already have an active World Boss attempt."
      : `You have used all ${WORLD_BOSS_DAILY_ATTEMPTS} attempts for today.`;
    return { ok: false, message };
  }

  activeAttempt = { cycle, uid, player };
  clearInterval(heartbeat);
  heartbeat = setInterval(() => {
    const current = activeAttempt;
    if (!current) return;
    updateParticipant(current.cycle, current.uid, current.player, (record, timestamp) => ({
      ...record,
      activeUntil: timestamp + 90_000,
    })).catch(notifyError);
  }, 30_000);

  const level = Math.max(35, (player.level || 1) * 2);
  const enemy = {
    id: "worldBossAstralColossus",
    name: "The Astral Colossus",
    tier: "boss",
    level,
    maxHp: remainingHealth,
    maxRounds: WORLD_BOSS_MAX_ROUNDS,
    attack: [Math.round(level * 1.6), Math.round(level * 2.4)],
    defense: Math.round(level * 1.4),
    speed: Math.round(level * 1.1),
    critical: 0.35,
    astra: 0,
    exp: 0,
    dropChance: 0,
    abilities: [
      { name: "Starfall", power: 1.4, hits: 2, ignoreDefense: 0.25, cooldown: 3 },
      { name: "Gravitic Crush", power: 2.1, status: { id: "stun", chance: 0.25 }, cooldown: 4 },
      { name: "Voidfire", power: 1.1, status: { id: "burn", power: 0.07, turns: 3 }, cooldown: 3 },
      { name: "Celestial Renewal", power: 0, heal: 0.025, self: { id: "fortify", power: 0.25, turns: 2 }, cooldown: 5 },
    ],
    phases: [
      { below: 0.7, text: "The Colossus fractures the stars and surges with power.", self: { id: "enrage", turns: 99, power: 0.25 } },
      { below: 0.35, text: "A black sun forms in the Colossus's chest.", self: { id: "enrage", turns: 99, power: 0.4 } },
    ],
    stunResist: 1,
    dotResist: 0.7,
    worldBossCycle: cycle,
    worldBossStartHealth: summary.health,
    onDefeat: () => {},
    onPlayerDefeat: (_p, stats) => {
      stats.health = stats.maxHealth;
      stats.stamina = stats.maxStamina;
      stats.power = stats.maxPower;
    },
  };
  return { ok: true, cycle, enemy, remainingAttempts: WORLD_BOSS_DAILY_ATTEMPTS - attempt.snapshot.val().attemptsUsed };
};

export const finishWorldBossAttempt = async (enemy) => {
  if (!enemy?.worldBossCycle || !activeAttempt || activeAttempt.cycle !== enemy.worldBossCycle) return;
  const attempt = activeAttempt;
  attempt.damageDealt ??= Math.max(0, Math.floor(enemy.worldBossDamageDealt || 0));
  if (attempt.reservedDamage === undefined) {
    let acceptedDamage = 0;
    await runTransaction(ref(db, `worldBoss/cycles/${attempt.cycle}/totalDamage`), (current) => {
      const total = Math.max(0, Number(current) || 0);
      acceptedDamage = Math.min(attempt.damageDealt, Math.max(0, WORLD_BOSS_HEALTH - total));
      return acceptedDamage ? total + acceptedDamage : undefined;
    }, { applyLocally: false });
    attempt.reservedDamage = acceptedDamage;
  }
  if (!attempt.participantRecorded) {
    await updateParticipant(attempt.cycle, attempt.uid, attempt.player, (record) => ({
      ...record,
      damage: Math.min(WORLD_BOSS_HEALTH, (Number(record.damage) || 0) + attempt.reservedDamage),
      activeUntil: 0,
    }));
    attempt.participantRecorded = true;
  }
  activeAttempt = null;
  clearInterval(heartbeat);
  heartbeat = null;
  const updated = await get(ref(db, `worldBoss/cycles/${attempt.cycle}/players`));
  const participants = updated.val() || {};
  if (summarizeWorldBoss(participants).defeated)
    await deliverWorldBossRewards(attempt.cycle, participants);
  return attempt.reservedDamage;
};

export const hasPendingWorldBossAttempt = () => activeAttempt?.damageDealt !== undefined;

export const retryWorldBossAttempt = async () => {
  if (!activeAttempt || activeAttempt.damageDealt === undefined)
    return { ok: false, message: "There is no World Boss damage waiting to be saved." };
  const enemy = {
    worldBossCycle: activeAttempt.cycle,
    worldBossDamageDealt: activeAttempt.damageDealt,
  };
  await finishWorldBossAttempt(enemy);
  return { ok: true };
};

export const forceWorldBossRespawn = async () => {
  if (!isAdmin()) throw new Error("Admin access is required.");
  await set(ref(db, "worldBoss/forcedSpawnAt"), Date.now());
};

export const deliverWorldBossResetNotice = async (cycle) => {
  const uid = getCharacterIdentity();
  if (!uid) return;
  const [playerSnapshot, totalSnapshot] = await Promise.all([
    get(ref(db, `worldBoss/cycles/${cycle}/players/${uid}`)),
    get(ref(db, `worldBoss/cycles/${cycle}/totalDamage`)),
  ]);
  const participant = playerSnapshot.val();
  const damage = Math.max(0, Number(participant?.damage) || 0);
  if (!damage) return;
  const playersSnapshot = await get(ref(db, `worldBoss/cycles/${cycle}/players`));
  const summary = summarizeWorldBoss(playersSnapshot.val() || {});
  const totalDamage = Math.max(summary.totalDamage, Number(totalSnapshot.val()) || 0);
  if (totalDamage >= WORLD_BOSS_HEALTH) return;

  const message = {
    subject: "The Astral Colossus has withdrawn",
    body: `You dealt ${damage.toLocaleString()} damage, but the Astral Colossus was reset before it could be defeated. Your attempt ended in defeat, and no victory rewards were issued.`,
    from: "World Boss",
    sentAt: Date.now(),
    attachments: { astra: 0 },
    cycle,
  };
  await runTransaction(ref(db, `worldBossMail/${uid}/${cycle}`), (existing) =>
    existing === null ? message : undefined,
  { applyLocally: false });
};

export const getWorldBossTentativeRewards = (rank, damage = 0) => {
  let placement = rank === 1
    ? "Unique Title, 2 Prismatic Alloy, 3 Architect's Runes, 800,000 Astra"
    : rank === 2
      ? "1 Prismatic Alloy, 2 Architect's Runes, 500,000 Astra"
      : rank === 3
        ? "1 Prismatic Alloy, 1 Architect's Rune, 200,000 Astra"
        : rank <= 10
          ? "100,000 Astra"
          : "";
  if (damage >= WORLD_BOSS_REWARD_THRESHOLD) {
    const gearTier = rank <= 10 ? "T5+" : "T3+";
    placement = [placement, "50,000 bonus Astra", `materials and 3–8 Epic ${gearTier} gear`, "1% Rune of Unpredictability chance"]
      .filter(Boolean)
      .join("; ");
  } else if (rank > 10) {
    placement = "At 1% damage: 50,000 Astra, materials and 3–8 Epic T3+ gear";
  }
  return `${placement}; ${getWorldBossUniqueDropChance(rank).toFixed(1)}% unique item chance`;
};

export const getWorldBossUniqueDropChance = (rank) =>
  Math.min(15, 1 + Math.max(0, 11 - rank) * 1.4);

const buildRewardMail = (cycle, entry, rank, total, ownsGiantSlayer) => {
  const damage = Math.max(0, Number(entry.damage) || 0);
  if (damage < WORLD_BOSS_REWARD_THRESHOLD && rank > 10) return null;
  const attachments = {};
  const summary = [];
  const qualifiesForContributionReward = damage >= WORLD_BOSS_REWARD_THRESHOLD;
  if (qualifiesForContributionReward) {
    attachments.materials = {
      glacier_core: 1,
      rimebound_plate: 4,
      war_hardened_insignia: 3,
    };
    attachments.gear = [{
      slot: "weapon",
      minRarity: 3,
      minTier: rank <= 10 ? 5 : 3,
      count: 3 + Math.floor(Math.random() * 6),
    }];
    summary.push(`1% contribution reward: 50,000 Astra, materials and 3–8 Epic T${rank <= 10 ? "5+" : "3+"} gear`);
    if (Math.random() < RUNE_OF_UNPREDICTABILITY_DROP_CHANCE) {
      attachments.consumables = { ...(attachments.consumables || {}), runeOfUnpredictability: 1 };
      summary.push("1 Rune of Unpredictability");
    }
  }
  let placementAstra = 0;
  if (rank === 1) {
    placementAstra = 800_000;
    attachments.consumables = { ...attachments.consumables, prismaticAlloy: 2, architectsRune: 3 };
    if (!ownsGiantSlayer) attachments.titles = ["giantSlayer"];
  } else if (rank === 2) {
    placementAstra = 500_000;
    attachments.consumables = { ...attachments.consumables, prismaticAlloy: 1, architectsRune: 2 };
  } else if (rank === 3) {
    placementAstra = 200_000;
    attachments.consumables = { ...attachments.consumables, prismaticAlloy: 1, architectsRune: 1 };
  } else if (rank <= 10) {
    placementAstra = 100_000;
  }
  const totalAstra = placementAstra + (qualifiesForContributionReward ? 50_000 : 0);
  if (totalAstra > 0) attachments.astra = totalAstra;
  const chance = getWorldBossUniqueDropChance(rank);
  if (Math.random() * 100 < chance)
    attachments.uniques = [{ id: WORLD_BOSS_UNIQUE_ID, count: 1 }];
  const rewardNames = [
    ...(attachments.astra ? [`${attachments.astra.toLocaleString()} Astra`] : []),
    ...(attachments.consumables?.prismaticAlloy ? [`${attachments.consumables.prismaticAlloy} Prismatic Alloy`] : []),
    ...(attachments.consumables?.architectsRune ? [`${attachments.consumables.architectsRune} Architect's Rune${attachments.consumables.architectsRune === 1 ? "" : "s"}`] : []),
    ...(attachments.consumables?.runeOfUnpredictability ? [`${attachments.consumables.runeOfUnpredictability} Rune of Unpredictability`] : []),
    ...(attachments.titles || []).map((id) => TITLES[id].name),
    ...(attachments.uniques || []).map(() => "Astral Colossus Heart"),
  ];
  if (rewardNames.length) summary.push(`Rank #${rank} reward: ${rewardNames.join(", ")}`);
  return {
    subject: "The Astral Colossus has fallen!",
    body: `Your contribution: ${(damage / total * 100).toFixed(2)}% (#${rank}). ${summary.join(". ")}. The unique relic had a ${chance.toFixed(1)}% drop chance.`,
    from: "World Boss",
    sentAt: Date.now(),
    attachments,
    cycle,
  };
};

export const deliverWorldBossRewards = async (cycle, participants) => {
  const summary = summarizeWorldBoss(participants);
  if (!summary.defeated) return;
  const ranked = summary.fighters
    .filter((entry) => entry.damage > 0)
    .sort((a, b) => b.damage - a.damage || (a.name || "").localeCompare(b.name || ""));
  const uid = getCharacterIdentity();
  const entry = ranked.find((player) => player.uid === uid);
  if (!entry) return;
  const firstPlaceAward = await get(ref(db, `worldBoss/titleAwards/${uid}`));
  const ownsGiantSlayer = firstPlaceAward.val() === true || getPlayer()?.titles?.includes("giantSlayer");
  const rank = ranked.indexOf(entry) + 1;
  const message = buildRewardMail(cycle, entry, rank, summary.totalDamage, ownsGiantSlayer);
  if (!message) return;
  const result = await runTransaction(ref(db, `worldBossMail/${uid}/${cycle}`), (existing) =>
    existing === null ? message : undefined,
  { applyLocally: false });
  if (rank === 1 && result.snapshot.val()?.attachments?.titles?.includes("giantSlayer"))
    await set(ref(db, `worldBoss/titleAwards/${uid}`), true);
};

export const getWorldBossRewardThresholdLabel = () =>
  `${(WORLD_BOSS_REWARD_THRESHOLD / WORLD_BOSS_HEALTH * 100).toFixed(0)}% (${WORLD_BOSS_REWARD_THRESHOLD.toLocaleString()} damage)`;

export const getWorldBossMaterialNames = () =>
  ["glacier_core", "rimebound_plate", "war_hardened_insignia"]
    .filter((key) => MATERIALS[key])
    .map((key) => MATERIALS[key].name);
