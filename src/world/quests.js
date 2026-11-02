import { getPlayer, setPlayer } from "../character/player";
import { ENEMIES, TIERS, getEnemyCandidates } from "../combat/enemies";
import { MATERIALS, getMaterialCount, spendMaterials } from "../items/materials";
import { generateRandomSlotItem } from "../items/items";
import { CONSUMABLES } from "../items/consumables";
import { RARITY_COLORS } from "../items/rarities";
import { expForLevel, gainExp } from "../character/stats";
import { DUNGEON_TYPES } from "./dungeonData";
import { GROUP_DUNGEONS } from "./groupDungeonData";
import { REGIONS, REGION_ORDER, canEnterRegion, clampToRegion } from "./regions";

/*
 Quests and town reputation.
 The player saves:
   rep         - town reputation (earned by completing quests; it no longer locks any quest)
   questBoard  - { hour, version, quests } the tavern's current offers (a new board every 10 minutes)
   quests      - accepted quests, newest last. status: "active" | "completed" | "abandoned"
 A quest is { id, tier, kind: "hunt" | "gather", title, description, level, count, target, progress,
              reqLevel, reward: { astra, exp, rep, minRarity?, minTier?, potion?, rune? }, status }
   hunt   - defeat `count` enemies of target.tier (in target.region) after accepting; progress is tracked on kills.
            target.enemyId requires a specific enemy (region bosses, dungeon bosses, and group dungeon bosses).
   gather - hand in `count` of target.material from the player's materials
 Offers only use regions the player can enter and that suit their level (see regions.js). The quest tier is a
 rarity that describes the work: Common basic hunts and fetches, up to Legendary region bosses and huge hauls,
 and Unique quests that only target solo and group dungeon bosses. Gathering pays less than hunting, and boss
 hunts pay the most. Potion and rune rewards are rolled when the quest is offered (see QUEST_POTIONS and
 QUEST_RUNES): pricier potions are rarer and only appear on harder quests, and runes are a rare bonus from Epic up.
*/
export const QUEST_TIERS = [
  { key: "Common", color: RARITY_COLORS.Common, minLevel: 1, rep: 5, mult: 1, weight: 30, minRarity: null },
  { key: "Uncommon", color: RARITY_COLORS.Uncommon, minLevel: 3, rep: 10, mult: 1.6, weight: 25, minRarity: null },
  { key: "Rare", color: RARITY_COLORS.Rare, minLevel: 4, rep: 25, mult: 2.6, weight: 18, minRarity: 1, minTier: 1 },
  { key: "Epic", color: RARITY_COLORS.Epic, minLevel: 7, rep: 60, mult: 4, weight: 12, minRarity: 2, minTier: 2 },
  { key: "Legendary", color: RARITY_COLORS.Legendary, minLevel: 5, rep: 140, mult: 6.5, weight: 8, minRarity: 3, minTier: 3 },
  { key: "Unique", color: RARITY_COLORS.Unique, minLevel: 12, rep: 300, mult: 10, weight: 5, minRarity: 4, minTier: 4 },
];
// Potion rewards per quest rarity: `chance` of any potion, then weighted picks. Pricier potions are rarer
// and only show up on harder quests. Common and Uncommon quests always grant a potion since they give no gear.
export const QUEST_POTIONS = {
  Common: { chance: 1, weights: { minorPotion: 60, healthPotion: 30, minorPowerPotion: 10 } },
  Uncommon: { chance: 1, weights: { minorPotion: 30, healthPotion: 35, greaterPotion: 15, minorPowerPotion: 15, greaterPowerPotion: 5 } },
  Rare: { chance: 0.4, weights: { healthPotion: 30, greaterPotion: 25, minorPowerPotion: 20, greaterPowerPotion: 15, staminaPotion: 7, cleansingPotion: 3 } },
  Epic: { chance: 0.5, weights: { healthPotion: 15, greaterPotion: 30, minorPowerPotion: 15, greaterPowerPotion: 22, staminaPotion: 12, cleansingPotion: 6 } },
  Legendary: { chance: 0.6, weights: { greaterPotion: 30, minorPowerPotion: 15, greaterPowerPotion: 28, staminaPotion: 17, cleansingPotion: 10 } },
  Unique: { chance: 0.75, weights: { greaterPotion: 25, greaterPowerPotion: 30, staminaPotion: 25, cleansingPotion: 20 } },
};

// A very small chance of a rune on harder quests; the most powerful runes are the rarest.
export const QUEST_RUNE_CHANCE = { Epic: 0.02, Legendary: 0.04, Unique: 0.06 };
export const QUEST_RUNES = { runeOfUnpredictability: 40, polishingRune: 35, architectsRune: 15, runeOfAscension: 10 };

// Quests from before the rarity revamp keep working under their matching rarity.
const LEGACY_TIERS = { D: "Common", C: "Uncommon", B: "Rare", A: "Epic", S: "Legendary", "S+": "Unique" };

// Reward multiplier by objective: gathering pays less than hunting; bosses pay the most.
const KIND_REWARD = { gather: 0.7, hunt: 1, boss: 1.3 };

const TITLES = {
  hunt: { Common: "Pest Control", Uncommon: "Wilderness Patrol", Rare: "Elite Hunt", Epic: "Champion's Challenge", Legendary: "Slay the Beast", Unique: "Legend Slayer" },
  gather: { Common: "Supply Run", Uncommon: "Bulk Order", Rare: "Crafter's Request", Epic: "Master's Commission", Legendary: "Grand Procurement" },
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
const DUNGEON_MIN_LEVEL = 12;
const LABYRINTH_MIN_LEVEL = 22;
// Regions more than this many levels below the player stop offering quests.
const OUTLEVELED_MARGIN = 5;

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const vary = (n) => Math.max(1, Math.round(n * (0.8 + Math.random() * 0.4)));
const weightedPick = (weights) => {
  const entries = Object.entries(weights);
  let r = Math.random() * entries.reduce((sum, [, w]) => sum + w, 0);
  return (entries.find(([, w]) => (r -= w) < 0) || entries[entries.length - 1])[0];
};
const rollPotion = (tierKey) => {
  const table = QUEST_POTIONS[tierKey];
  return table && Math.random() < table.chance ? weightedPick(table.weights) : null;
};
const rollRune = (tierKey) => (Math.random() < (QUEST_RUNE_CHANCE[tierKey] || 0) ? weightedPick(QUEST_RUNES) : null);
const tierOf = (key) => QUEST_TIERS.find((t) => t.key === (LEGACY_TIERS[key] || key));
const questId = () => `quest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const regionName = (id) => REGIONS[id]?.name || id.replace(/([a-z])([A-Z])/g, "$1 $2");
const groupBossId = (dungeonId) => `group:${dungeonId}`;
const groupBoss = (dungeon) => Object.values(dungeon.enemies || {}).find((e) => e.tier === "boss");

export const getRep = (player = getPlayer()) => player?.rep || 0;
export const getRepRank = (rep) => [...REP_RANKS].reverse().find((r) => rep >= r.min).name;

export const getQuestTier = tierOf;

// Regions the player can enter whose level range suits them; the furthest one they can reach is always included.
export const getQuestRegions = (playerLevel) => {
  const player = { level: playerLevel };
  const open = REGION_ORDER.filter((id) => canEnterRegion(player, id));
  const suited = open.filter((id) => REGIONS[id].maxLevel + OUTLEVELED_MARGIN >= playerLevel);
  return suited.length ? suited : open.slice(-1);
};

// Materials dropped in `region` by enemies a player of `level` can meet, filtered by material tier.
const regionMaterials = (region, level, tiers) => {
  const keys = ENEMIES.filter((e) => !e.eventOnly && e.regions.includes(region) && e.level <= clampToRegion(level + 2, region))
    .flatMap((e) => (e.drops || []).map((d) => d.key))
    .filter((key) => MATERIALS[key] && tiers.includes(MATERIALS[key].tier));
  return [...new Set(keys)];
};

const huntPlan = (region, level, enemyTier, count) => {
  if (!getEnemyCandidates(enemyTier, region, level).length) return null;
  return {
    kind: "hunt",
    count,
    target: { tier: enemyTier, region },
    description: `Defeat ${count} ${TIERS[enemyTier].label.toLowerCase()} enemies in the ${regionName(region)}.`,
  };
};

const gatherPlan = (region, level, tiers, count) => {
  const options = regionMaterials(region, level, tiers);
  if (!options.length) return null;
  const material = pick(options);
  return {
    kind: "gather",
    count,
    target: { material },
    description: `Hand in ${count} ${MATERIALS[material].name} from the ${regionName(region)}.`,
  };
};

const regionBossPlan = (region, level) => {
  const bosses = getEnemyCandidates("boss", region, level);
  if (!bosses.length) return null;
  const boss = pick(bosses);
  return {
    kind: "hunt",
    boss: true,
    count: 1,
    target: { tier: "boss", region, enemyId: boss.id },
    description: `Defeat the ${boss.name}, a boss of the ${regionName(region)}.`,
  };
};

const LABYRINTH_MATERIALS = [
  "labyrinth_etched_fang", "labyrinth_echo_silk", "labyrinth_etched_stone",
  "labyrinth_rune_shard", "labyrinth_thorned_horn", "labyrinth_void_ichor",
];

const labyrinthPlan = (level) => {
  if (level < LABYRINTH_MIN_LEVEL) return null;
  const material = pick(LABYRINTH_MATERIALS);
  const count = vary(MATERIALS[material].tier === "rare" ? 3 : 6);
  return {
    kind: "gather",
    dungeon: true,
    count,
    reqLevel: LABYRINTH_MIN_LEVEL,
    target: { material },
    description: `Hand in ${count} ${MATERIALS[material].name} from the Labyrinth.`,
  };
};

const dungeonPlan = (tierKey, level) => {
  if (level < DUNGEON_MIN_LEVEL) return null;
  if (tierKey === "Epic" && Math.random() < 0.4) {
    const labyrinth = labyrinthPlan(level);
    if (labyrinth) return labyrinth;
  }
  const dungeon = pick(Object.values(DUNGEON_TYPES));
  if (tierKey === "Unique") {
    const boss = pick(dungeon.bosses);
    return {
      kind: "hunt",
      boss: true,
      count: 1,
      reqLevel: DUNGEON_MIN_LEVEL,
      target: { tier: "boss", region: "Dungeon", enemyId: boss.id },
      description: `Defeat ${boss.name} in the ${dungeon.name}.`,
    };
  }
  const materialTier = tierKey === "Rare" ? "basic" : "elite";
  const material = dungeon.materials[materialTier];
  const count = vary(tierKey === "Rare" ? 5 : 3);
  return {
    kind: "gather",
    dungeon: true,
    reqLevel: DUNGEON_MIN_LEVEL,
    count,
    target: { material },
    description: `Hand in ${count} ${MATERIALS[material].name} from the ${dungeon.name}.`,
  };
};

const groupDungeonPlan = (level) => {
  const open = Object.values(GROUP_DUNGEONS).filter((d) => level >= d.level && groupBoss(d));
  if (!open.length) return null;
  const dungeon = pick(open);
  return {
    kind: "hunt",
    boss: true,
    count: 1,
    reqLevel: dungeon.level,
    target: { tier: "boss", region: "GroupDungeon", enemyId: groupBossId(dungeon.id) },
    description: `Defeat ${groupBoss(dungeon).name} by clearing ${dungeon.name} with a party.`,
  };
};

// Builds the objective for a quest tier, or null when nothing of that tier suits the region and level.
const planQuest = (tierKey, region, level, playerLevel) => {
  const hunt = Math.random() < 0.55;
  switch (tierKey) {
    case "Common":
      return (hunt && huntPlan(region, level, "basic", vary(5))) || gatherPlan(region, level, ["common"], vary(5));
    case "Uncommon":
      return (hunt && huntPlan(region, level, "basic", vary(10)))
        || gatherPlan(region, level, ["common", "uncommon"], vary(8));
    case "Rare":
    case "Epic": {
      const count = tierKey === "Rare" ? 3 : 6;
      if (!hunt && Math.random() < 0.3) {
        const dungeon = dungeonPlan(tierKey, playerLevel);
        if (dungeon) return dungeon;
      }
      return (hunt && huntPlan(region, level, "elite", vary(count)))
        || gatherPlan(region, level, ["uncommon", "rare"], vary(count));
    }
    case "Legendary":
      return (hunt && regionBossPlan(region, level)) || gatherPlan(region, level, ["common", "uncommon"], randInt(25, 40));
    case "Unique":
      return (Math.random() < 0.5 && groupDungeonPlan(playerLevel)) || dungeonPlan(tierKey, playerLevel);
    default:
      return null;
  }
};

const buildQuest = (tier, plan, level, region, regionMult = REGIONS[region]?.reward || 1) => {
  const variance = 0.9 + Math.random() * 0.2;
  const kindMult = KIND_REWARD[plan.boss ? "boss" : plan.kind];
  const { boss, reqLevel, dungeon, ...objective } = plan;
  const potion = rollPotion(tier.key);
  const rune = rollRune(tier.key);
  return {
    id: questId(),
    tier: tier.key,
    title: TITLES[plan.kind][tier.key] || TITLES.hunt[tier.key],
    ...objective,
    level,
    region,
    progress: 0,
    reqLevel: reqLevel || REGIONS[region]?.entryLevel || 1,
    reward: {
      astra: Math.round((25 + level * 10) * tier.mult * kindMult * regionMult * variance),
      exp: Math.round(expForLevel(level) * 0.04 * tier.mult * kindMult * variance),
      rep: tier.rep,
      ...(tier.minRarity !== null ? { minRarity: tier.minRarity } : {}),
      ...(tier.minTier !== undefined ? { minTier: tier.minTier } : {}),
      ...(potion ? { potion } : {}),
      ...(rune ? { rune } : {}),
    },
    status: "active",
  };
};

// Generates one quest of `tier` for a player of `playerLevel`, or null when the tier has nothing suitable.
export const generateQuest = (tier, playerLevel) => {
  const regions = getQuestRegions(playerLevel);
  // The furthest suitable region is offered twice as often as the others.
  const region = pick([...regions, regions[regions.length - 1]]);
  const level = clampToRegion(Math.max(1, playerLevel + randInt(-1, 1)), region);
  const plan = planQuest(tier.key, region, Math.min(playerLevel, REGIONS[region].maxLevel), playerLevel);
  if (!plan) return null;
  if (!plan.dungeon && !["Dungeon", "GroupDungeon"].includes(plan.target.region)) return buildQuest(tier, plan, level, region);
  // Dungeon quests scale with the player and pay like the furthest region they have reached.
  return buildQuest(tier, plan, playerLevel, null, REGIONS[regions[regions.length - 1]].reward);
};

const BOARD_REFRESH_MS = 10 * 60 * 1000;
const BOARD_VERSION = 4;
const getBoardHour = () => Math.floor(Date.now() / BOARD_REFRESH_MS);
export const getQuestBoardRefreshMs = () => (getBoardHour() + 1) * BOARD_REFRESH_MS - Date.now();

export const getAvailableQuestTiers = (playerLevel) => QUEST_TIERS.filter((t) => playerLevel >= t.minLevel);

// The tavern's offers for the current 10-minute window, all suited to the player's level and reachable regions.
export const getQuestBoard = (player = getPlayer()) => {
  const hour = getBoardHour();
  if (player?.questBoard?.version === BOARD_VERSION && player.questBoard.hour === hour && Array.isArray(player.questBoard.quests))
    return player.questBoard.quests;
  const level = Math.max(1, Number(player?.level) || 1);
  const tiers = getAvailableQuestTiers(level);
  const total = tiers.reduce((sum, t) => sum + t.weight, 0);
  const rollTier = () => {
    let r = Math.random() * total;
    return tiers.find((t) => (r -= t.weight) < 0) || tiers[0];
  };
  const quests = [];
  for (let attempts = 0; quests.length < BOARD_SIZE && attempts < BOARD_SIZE * 10; attempts += 1) {
    const quest = generateQuest(rollTier(), level);
    if (quest) quests.push(quest);
  }
  if (player) setPlayer({ questBoard: { hour, version: BOARD_VERSION, quests } });
  return quests;
};

export const getQuests = (player = getPlayer()) => player?.quests || [];
export const getActiveQuests = (player = getPlayer()) => getQuests(player).filter((q) => q.status === "active");

// { progress, count, done, held? } for a quest right now; gather quests also report how many materials are held.
export const getObjective = (quest, player = getPlayer()) => {
  const held = quest.kind === "gather" ? getMaterialCount(player, quest.target.material) : undefined;
  const progress = Math.min(quest.count, quest.kind === "gather" ? held : quest.progress || 0);
  return { progress, count: quest.count, done: progress >= quest.count, ...(held !== undefined ? { held } : {}) };
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
  if ((player?.level || 1) < (quest.reqLevel || 1)) missing.push(`level ${quest.reqLevel}`);
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
    reward.rune && CONSUMABLES[reward.rune]?.name,
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
  for (const key of [reward.potion, reward.rune].filter((k) => CONSUMABLES[k])) {
    patch.consumables = { ...(patch.consumables || player.consumables || {}) };
    patch.consumables[key] = (patch.consumables[key] || 0) + 1;
    messages.push(`Reward: {{${CONSUMABLES[key].name}|consumable:${key}}}.`);
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
