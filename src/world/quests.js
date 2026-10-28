import { getPlayer, setPlayer } from "../character/player";
import { ENEMIES, TIERS } from "../combat/enemies";
import { MATERIALS, getMaterialCount, spendMaterials } from "../items/materials";
import { generateRandomSlotItem } from "../items/items";
import { CONSUMABLES } from "../items/consumables";
import { expForLevel, gainExp } from "../character/stats";
import { DUNGEON_TYPES } from "./dungeonData";

/*
 Quests and town reputation.
 The player saves:
   rep         - town reputation (earned by completing quests)
   questBoard  - { hour, version, quests } the tavern's current offers (a new board every 10 minutes)
   quests      - accepted quests, newest last. status: "active" | "completed" | "abandoned"
 A quest is { id, tier, kind: "hunt" | "gather", title, description, level, count, target, progress,
              reqLevel, reqRep, reward: { astra, exp, rep, minRarity?, minTier?, potion? }, status }
   hunt   - defeat `count` enemies of target.tier (in target.region) after accepting; progress is tracked on kills
            S+ hunts require a specific dungeon boss (target.enemyId)
   gather - hand in `count` of target.material from the player's materials
 Quest levels follow the player's level only (never gear score). Harder tiers pay more and need more level and rep.
*/
export const QUEST_TIERS = [
  { key: "D", color: "#b0b0b0", minLevel: 1, minRep: 0, rep: 5, mult: 1, weight: 30, minRarity: null, potion: "minorPotion", hunt: ["basic", 5], gather: [["common"], 5] },
  { key: "C", color: "#1eff00", minLevel: 5, minRep: 20, rep: 10, mult: 1.8, weight: 25, minRarity: null, potion: "healthPotion", hunt: ["basic", 8], gather: [["common"], 8] },
  { key: "B", color: "#0070dd", minLevel: 12, minRep: 80, rep: 25, mult: 3, weight: 20, minRarity: 1, minTier: 1, dungeonMaterialTier: "basic", hunt: ["elite", 3], gather: [["uncommon"], 5] },
  { key: "A", color: "#a335ee", minLevel: 22, minRep: 250, rep: 60, mult: 5, weight: 13, minRarity: 2, minTier: 2, dungeonMaterialTier: "elite", hunt: ["elite", 5], gather: [["uncommon"], 3] },
  { key: "S", color: "#ff8000", minLevel: 35, minRep: 700, rep: 140, mult: 8.5, weight: 8, minRarity: 3, minTier: 3, dungeonMaterialTier: "boss", hunt: ["boss", 1], gather: [["rare"], 2] },
  { key: "S+", color: "#ff4d6d", minLevel: 50, minRep: 1800, rep: 300, mult: 14, weight: 4, minRarity: 4, minTier: 4, hunt: ["boss", 1] },
];

const TITLES = {
  hunt: { D: "Pest Control", C: "Wilderness Patrol", B: "Elite Hunt", A: "Champion's Challenge", S: "Slay the Beast", "S+": "Legend Slayer" },
  gather: { D: "Supply Run", C: "Bulk Order", B: "Crafter's Request", A: "Master's Commission", S: "Rare Procurement", "S+": "Relic Recovery" },
};

export const REP_RANKS = [
  { min: 0, name: "Stranger" },
  { min: 20, name: "Familiar" },
  { min: 80, name: "Friend" },
  { min: 250, name: "Trusted" },
  { min: 700, name: "Guardian" },
  { min: 1800, name: "Champion" },
  { min: 2700, name: "Hero" },
  { min: 4000, name: "Legend" },
];

export const MAX_ACTIVE_QUESTS = 5;
const BOARD_SIZE = 8;
const HISTORY_LIMIT = 30;
const RARITY_NAMES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
const DUNGEON_MATERIALS = new Set(Object.values(DUNGEON_TYPES).flatMap((type) => Object.values(type.materials)));
const MATERIAL_SOURCE_GROUPS = {
  "Suncleft Expanse": ["suncleft_scourge_fang", "glassback_chitin", "buried_wyrm_scale"],
  "Tempest Reach": ["bilge_raider_insignia", "abyssal_scale", "leviathan_heart"],
  "Frostfall Range": ["frostfang_pelt", "rimebound_plate", "glacier_core"],
  "Shattered Front": ["salvaged_dog_tag", "war_hardened_insignia", "commanders_crest"],
  "Verdant Overgrowth": ["overgrowth_spore_fiber", "overgrowth_blight_resin", "overgrowth_heartseed"],
  "Void Observatory": ["observatory_void_dust", "observatory_rift_thread", "observatory_star_core"],
  Labyrinth: [
    "relicFragments",
    "labyrinth_etched_fang",
    "labyrinth_echo_silk",
    "labyrinth_rune_shard",
    "labyrinth_thorned_horn",
    "labyrinth_void_ichor",
    "labyrinth_etched_stone",
    "labyrinth_crown_fragment",
  ],
};
const MATERIAL_SOURCES = new Map(
  Object.entries(MATERIAL_SOURCE_GROUPS).flatMap(([source, materials]) => materials.map((material) => [material, source])),
);
const S_TIER_SPECIAL_MATERIALS = [
  "buried_wyrm_scale",
  "leviathan_heart",
  "glacier_core",
  "commanders_crest",
  "overgrowth_heartseed",
  "observatory_star_core",
  "relicFragments",
  "labyrinth_crown_fragment",
];
const SINGLE_DROP_MATERIALS = new Set([
  "buried_wyrm_scale",
  "leviathan_heart",
  "glacier_core",
  "commanders_crest",
  "overgrowth_heartseed",
  "observatory_star_core",
  "labyrinth_crown_fragment",
]);

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const tierOf = (key) => QUEST_TIERS.find((t) => t.key === key);
const questId = () => `quest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const regionLabel = (r) => r.replace(/([a-z])([A-Z])/g, "$1 $2");

export const getRep = (player = getPlayer()) => player?.rep || 0;
export const getRepRank = (rep) => [...REP_RANKS].reverse().find((r) => rep >= r.min).name;

export const getQuestTier = tierOf;

const generateQuest = (tier, playerLevel) => {
  const level = Math.max(1, playerLevel + randInt(-1, 2));
  const kind = tier.key === "S+" || Math.random() < 0.5 ? "hunt" : "gather";
  const variance = 0.9 + Math.random() * 0.2;
  let target;
  let count;
  let description;
  if (kind === "hunt") {
    const [enemyTier, baseCount] = tier.hunt;
    count = Math.max(1, Math.round(baseCount * (0.8 + Math.random() * 0.4)));
    if (tier.key === "S+") {
      const dungeon = pick(Object.values(DUNGEON_TYPES));
      const boss = pick(dungeon.bosses);
      target = { tier: enemyTier, region: "Dungeon", enemyId: boss.id };
      description = `Defeat ${boss.name} ${count} times in the ${dungeon.name}.`;
    } else {
      const regions = [...new Set(ENEMIES.filter((e) => e.tier === enemyTier).flatMap((e) => e.regions))];
      target = { tier: enemyTier, region: pick(regions) };
      description = `Defeat ${count} ${TIERS[enemyTier].label.toLowerCase()} enemies in ${regionLabel(target.region)}.`;
    }
  } else {
    const [tiers, baseCount] = tier.gather;
    const dungeon = tier.dungeonMaterialTier && Math.random() < 0.5 ? pick(Object.values(DUNGEON_TYPES)) : null;
    const material = dungeon
      ? dungeon.materials[tier.dungeonMaterialTier]
      : pick([
        ...Object.keys(MATERIALS).filter((k) => !DUNGEON_MATERIALS.has(k) && tiers.includes(MATERIALS[k].tier)),
        ...(tier.key === "S" ? S_TIER_SPECIAL_MATERIALS : []),
      ]);
    target = { material };
    count = SINGLE_DROP_MATERIALS.has(material)
      ? 1
      : material === "relicFragments"
        ? 5
        : Math.max(1, Math.round(baseCount * (0.8 + Math.random() * 0.4)));
    const source = dungeon ? dungeon.name : MATERIAL_SOURCES.get(material);
    description = `Hand in ${count} ${MATERIALS[material].name}${source ? ` from the ${source}` : ""}.`;
  }
  return {
    id: questId(),
    tier: tier.key,
    kind,
    title: TITLES[kind][tier.key],
    description,
    level,
    count,
    target,
    progress: 0,
    reqLevel: tier.minLevel,
    reqRep: tier.minRep,
    reward: {
      astra: Math.round((25 + level * 10) * tier.mult * variance),
      exp: Math.round(expForLevel(level) * 0.04 * tier.mult * variance),
      rep: tier.rep,
      ...(tier.minRarity !== null ? { minRarity: tier.minRarity } : {}),
      ...(tier.minTier !== undefined ? { minTier: tier.minTier } : {}),
      ...(tier.potion ? { potion: tier.potion } : {}),
    },
    status: "active",
  };
};

const BOARD_REFRESH_MS = 10 * 60 * 1000;
const BOARD_VERSION = 2;
const getBoardHour = () => Math.floor(Date.now() / BOARD_REFRESH_MS);
export const getQuestBoardRefreshMs = () => (getBoardHour() + 1) * BOARD_REFRESH_MS - Date.now();

// The tavern's offers for the current 10-minute window. Includes quests above the player's tier, shown locked.
export const getQuestBoard = (player = getPlayer()) => {
  const hour = getBoardHour();
  if (player?.questBoard?.version === BOARD_VERSION && player.questBoard.hour === hour && Array.isArray(player.questBoard.quests))
    return player.questBoard.quests;
  const level = Math.max(1, Number(player?.level) || 1);
  const tiers = QUEST_TIERS.filter((t) => t.minLevel <= level + 10);
  const total = tiers.reduce((sum, t) => sum + t.weight, 0);
  const rollTier = () => {
    let r = Math.random() * total;
    return tiers.find((t) => (r -= t.weight) < 0) || tiers[0];
  };
  const quests = Array.from({ length: BOARD_SIZE }, () => generateQuest(rollTier(), level));
  if (player) setPlayer({ questBoard: { hour, version: BOARD_VERSION, quests } });
  return quests;
};

export const getQuests = (player = getPlayer()) => player?.quests || [];
export const getActiveQuests = (player = getPlayer()) => getQuests(player).filter((q) => q.status === "active");

// { progress, count, done } for a quest right now
export const getObjective = (quest, player = getPlayer()) => {
  const progress =
    quest.kind === "gather"
      ? Math.min(quest.count, getMaterialCount(player, quest.target.material))
      : Math.min(quest.count, quest.progress || 0);
  return { progress, count: quest.count, done: progress >= quest.count };
};

export const isQuestReady = (quest, player = getPlayer()) =>
  quest.status === "active" && getObjective(quest, player).done;

export const getReadyQuestCount = (player = getPlayer()) =>
  getActiveQuests(player).filter((q) => isQuestReady(q, player)).length;

export const getQuestStatus = (quest, player = getPlayer()) =>
  quest.status === "active"
    ? isQuestReady(quest, player)
      ? "Ready to turn in"
      : "In progress"
    : quest.status === "completed"
      ? "Completed"
      : "Abandoned";

export const getRequirementProblem = (quest, player = getPlayer()) => {
  const missing = [];
  if ((player?.level || 1) < quest.reqLevel) missing.push(`level ${quest.reqLevel}`);
  if (getRep(player) < quest.reqRep) missing.push(`${quest.reqRep} reputation`);
  return missing.length ? `Requires ${missing.join(" and ")}` : null;
};

export const rewardText = (reward) =>
  [
    `${reward.astra} astra`,
    `${reward.exp} exp`,
    `${reward.rep} reputation`,
    reward.minRarity !== undefined && `${RARITY_NAMES[reward.minRarity]}+ gear`,
    reward.minTier !== undefined && `T${reward.minTier}+ gear stats`,
    reward.potion && CONSUMABLES[reward.potion]?.name,
  ]
    .filter(Boolean)
    .join(", ");

const trimHistory = (quests) => {
  const finished = quests.filter((q) => q.status !== "active");
  const drop = new Set(finished.slice(0, Math.max(0, finished.length - HISTORY_LIMIT)).map((q) => q.id));
  return quests.filter((q) => !drop.has(q.id));
};

export const acceptQuest = (id) => {
  const player = getPlayer();
  const quest = getQuestBoard(player).find((q) => q.id === id);
  if (!player || !quest) return { ok: false, reason: "gone" };
  const problem = getRequirementProblem(quest, player);
  if (problem) return { ok: false, reason: "requirements", message: `${problem}.` };
  if (getActiveQuests(player).length >= MAX_ACTIVE_QUESTS)
    return { ok: false, reason: "full", message: `You can only hold ${MAX_ACTIVE_QUESTS} active quests.` };
  setPlayer({
    quests: [...getQuests(player), { ...quest, acceptedAt: Date.now() }],
    questBoard: { ...player.questBoard, quests: player.questBoard.quests.filter((q) => q.id !== id) },
  });
  return { ok: true, quest };
};

export const abandonQuest = (id) => {
  const player = getPlayer();
  const quest = getActiveQuests(player).find((q) => q.id === id);
  if (!quest) return { ok: false };
  setPlayer({
    quests: getQuests(player).map((q) => (q.id === id ? { ...q, status: "abandoned", finishedAt: Date.now() } : q)),
  });
  return { ok: true, quest };
};

export const turnInQuest = (id) => {
  const player = getPlayer();
  const quest = getActiveQuests(player).find((q) => q.id === id);
  if (!quest || !isQuestReady(quest, player)) return { ok: false };
  const { reward } = quest;
  const messages = [`Quest complete: ${quest.title}!`];
  const patch = {
    astra: (player.astra || 0) + reward.astra,
    rep: getRep(player) + reward.rep,
  };
  if (quest.kind === "gather")
    patch.materials = spendMaterials(player, { [quest.target.material]: quest.count });
  messages.push(`You receive ${reward.astra} astra and ${reward.rep} reputation (${getRepRank(patch.rep)}).`);
  if (reward.minRarity !== undefined) {
    const item = generateRandomSlotItem(reward.minRarity, reward.minTier ?? tierOf(quest.tier)?.minTier ?? 0);
    if (item) {
      patch.inventory = [...(player.inventory || []), item];
      messages.push(`Reward gear: {{${item.name}|item:${item.id}}}.`);
    }
  }
  if (reward.potion) {
    patch.consumables = { ...(player.consumables || {}), [reward.potion]: (player.consumables?.[reward.potion] || 0) + 1 };
    messages.push(`Reward: ${CONSUMABLES[reward.potion].name}.`);
  }
  const leveled = gainExp({ ...player, ...patch }, reward.exp);
  Object.assign(patch, leveled.patch);
  messages.push(`You gain ${reward.exp} exp.`, ...leveled.messages);
  patch.quests = trimHistory(
    getQuests(player).map((q) => (q.id === id ? { ...q, status: "completed", finishedAt: Date.now() } : q)),
  );
  setPlayer(patch);
  return { ok: true, quest, messages };
};

// Counts a defeated enemy towards matching active hunt quests. Returns { quests, messages } (quests is unchanged when nothing matched).
export const recordQuestKill = (quests = [], enemy) => {
  const messages = [];
  const updated = quests.map((q) => {
    if (q.status !== "active" || q.kind !== "hunt" || (q.progress || 0) >= q.count) return q;
    if (q.target.tier !== enemy.tier || (q.target.region && q.target.region !== enemy.region)) return q;
    if (q.target.enemyId && q.target.enemyId !== enemy.id) return q;
    const progress = (q.progress || 0) + 1;
    messages.push(`Quest progress: ${q.title} (${progress}/${q.count})${progress >= q.count ? ". Return to the tavern!" : ""}`);
    return { ...q, progress };
  });
  return { quests: messages.length ? updated : quests, messages };
};
