import { getPlayer, setPlayer } from "../../character/player";
import { ENEMIES } from "../../combat/enemies";
import { RARITY_NAMES } from "../../items/items";
import { MATERIALS } from "../../items/materials";
import { CONSUMABLES } from "../../items/consumables";
import { DUNGEON_TYPES } from "../../world/dungeonData";
import { GROUP_DUNGEONS } from "../../world/groupDungeonData";
import {
  acceptQuest, getObjective, getQuestBoard, getQuestRegions, getQuestTier, getRequirementProblem,
  QUEST_POTIONS, QUEST_RUNE_CHANCE, QUEST_RUNES, QUEST_TIERS, recordQuestKill, rewardText, turnInQuest,
} from "../../world/quests";
import { REGIONS, canEnterRegion } from "../../world/regions";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
jest.mock("../../combat/combat", () => ({ getEnemy: () => null }));
jest.mock("../../character/stats", () => ({
  expForLevel: () => 1000,
  gainExp: () => ({ patch: {}, messages: [] }),
}));

let player;
beforeEach(() => {
  jest.clearAllMocks();
  player = { level: 100, rep: 2000, astra: 100, inventory: [], quests: [], materials: {} };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
  jest.spyOn(Date, "now").mockReturnValue(60000000);
  let seed = 12345;
  jest.spyOn(Math, "random").mockImplementation(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  });
});
afterEach(() => jest.restoreAllMocks());

function sampleQuests(level = 100, boards = 500) {
  return Array.from({ length: boards }, () => getQuestBoard({ level })).flat();
}

const soloBosses = Object.values(DUNGEON_TYPES).flatMap((dungeon) => dungeon.bosses);
const groupBossIds = Object.keys(GROUP_DUNGEONS).map((id) => `group:${id}`);
const overworld = (quest) => Boolean(quest.region);

// What a Unique quest should look like for its boss: { description parts, reqLevel, target }.
const uniqueExpectation = (quest) => {
  if (quest.target.region === "GroupDungeon") {
    const dungeon = GROUP_DUNGEONS[quest.target.enemyId.slice("group:".length)];
    return { names: [dungeon.name], reqLevel: dungeon.level, target: quest.target };
  }
  const dungeon = Object.values(DUNGEON_TYPES).find((d) => d.bosses.some((b) => b.id === quest.target.enemyId));
  const boss = dungeon.bosses.find((b) => b.id === quest.target.enemyId);
  return { names: [boss.name, dungeon.name], reqLevel: 12, target: { tier: "boss", region: "Dungeon", enemyId: boss.id } };
};

test("Unique offers only target solo and group dungeon bosses, covering every one", () => {
  const quests = sampleQuests().filter((q) => q.tier === "Unique");
  expect(new Set(quests.map((q) => q.target.enemyId))).toEqual(
    new Set([...soloBosses.map((boss) => boss.id), ...groupBossIds]),
  );
  quests.forEach((quest) => {
    const expected = uniqueExpectation(quest);
    expect(quest).toMatchObject({ kind: "hunt", count: 1, reqLevel: expected.reqLevel, target: expected.target });
    expected.names.forEach((name) => expect(quest.description).toContain(name));
  });
  expect(sampleQuests(39, 200).some((q) => q.target.region === "GroupDungeon")).toBe(false);
  expect(sampleQuests(11, 200).some((q) => q.tier === "Unique")).toBe(false);
});

test.each([1, 5, 12, 25, 45, 60, 75, 100])("level %i offers only regions the player can enter and that suit their level", (level) => {
  const regions = getQuestRegions(level);
  const quests = sampleQuests(level, 60);
  expect(quests.length).toBeGreaterThan(0);
  quests.forEach((quest) => expect(getRequirementProblem(quest, { level })).toBeNull());
  for (const quest of quests.filter(overworld)) {
    const region = REGIONS[quest.region];
    expect(regions).toContain(quest.region);
    expect(canEnterRegion({ level }, quest.region)).toBe(true);
    expect(quest.reqLevel).toBe(region.entryLevel);
    expect(quest.level).toBeGreaterThanOrEqual(region.minLevel);
    expect(quest.level).toBeLessThanOrEqual(region.maxLevel);
    expect(quest.description).toContain(region.name);
  }
  quests.filter((q) => overworld(q) && q.kind === "hunt").forEach((q) => expect(q.target.region).toBe(q.region));
  // The furthest region the player can enter always offers quests; long-outgrown ones do not.
  expect(quests.some((q) => q.region === regions[regions.length - 1])).toBe(true);
});

test("quest regions skip outgrown regions and never include locked ones", () => {
  expect(getQuestRegions(1)).toEqual(["Meadowlands"]);
  expect(getQuestRegions(12)).toEqual(["Meadowlands", "Darkwood"]);
  expect(getQuestRegions(25)).toEqual(["Darkwood", "AshenPeaks"]);
  expect(getQuestRegions(100)).toEqual(["ShatteredFront"]);
});

// Returns why a quest does not match what its rarity should ask for, or null when it does.
const rarityProblem = (quest) => {
  const hunt = quest.kind === "hunt";
  const materialTier = hunt ? null : MATERIALS[quest.target.material].tier;
  const regionBoss = hunt && quest.target.tier === "boss" && overworld(quest);
  const boss = regionBoss && ENEMIES.find((e) => e.id === quest.target.enemyId);
  const ok = {
    Common: hunt ? quest.target.tier === "basic" : materialTier === "common",
    Uncommon: hunt ? quest.target.tier === "basic" : ["common", "uncommon"].includes(materialTier),
    Rare: hunt ? quest.target.tier === "elite" : ["uncommon", "rare"].includes(materialTier),
    Epic: hunt ? quest.target.tier === "elite" : ["uncommon", "rare"].includes(materialTier),
    Legendary: hunt
      ? Boolean(boss && boss.tier === "boss" && boss.regions.includes(quest.target.region) && quest.count === 1)
      : quest.count >= 25,
    Unique: ["Dungeon", "GroupDungeon"].includes(quest.target.region),
  }[quest.tier];
  return ok ? null : `${quest.tier} ${quest.kind}: ${quest.description}`;
};

test("each rarity sets what the quest asks for", () => {
  const quests = [12, 25, 45, 60, 75, 100].flatMap((level) => sampleQuests(level, 80));
  expect(quests.map(rarityProblem).filter(Boolean)).toEqual([]);
  const regionBossTiers = quests.filter((q) => q.kind === "hunt" && q.target.tier === "boss" && overworld(q)).map((q) => q.tier);
  expect(new Set(regionBossTiers)).toEqual(new Set(["Legendary"]));
  for (const tier of QUEST_TIERS.map((t) => t.key)) expect(quests.some((q) => q.tier === tier)).toBe(true);
});

test("gathering pays less than hunting, and boss quests pay the most", () => {
  const quests = sampleQuests(100, 400).filter(overworld);
  const avg = (list) => list.reduce((sum, q) => sum + q.reward.astra, 0) / list.length;
  for (const tier of ["Common", "Uncommon", "Rare", "Epic", "Legendary"]) {
    const hunts = quests.filter((q) => q.tier === tier && q.kind === "hunt");
    const gathers = quests.filter((q) => q.tier === tier && q.kind === "gather");
    expect(avg(gathers)).toBeLessThan(avg(hunts));
  }
  const unique = sampleQuests(100, 400).filter((q) => q.tier === "Unique");
  const regionBoss = quests.filter((q) => q.tier === "Legendary" && q.kind === "hunt");
  expect(avg(unique)).toBeGreaterThan(avg(regionBoss));
  expect(avg(regionBoss)).toBeGreaterThan(avg(quests.filter((q) => q.tier === "Epic")));
});

test("hunt offers include enemies from every newer overworld zone", () => {
  const newerRegions = { TempestReach: 45, FrostfallRange: 60, SuncleftExpanse: 75, ShatteredFront: 95 };
  for (const [region, level] of Object.entries(newerRegions)) {
    const regionHunts = sampleQuests(level, 100).filter((quest) => quest.kind === "hunt" && quest.target.region === region);
    expect(regionHunts.length).toBeGreaterThan(0);
    for (const quest of regionHunts) {
      expect(quest.description).toContain(REGIONS[region].name);
      const enemy = quest.target.enemyId
        ? ENEMIES.find((candidate) => candidate.id === quest.target.enemyId)
        : ENEMIES.find((candidate) => candidate.tier === quest.target.tier && candidate.regions.includes(region));
      expect(enemy).toBeDefined();
      expect(recordQuestKill([quest], { ...enemy, region }).quests[0].progress).toBe(1);
    }
  }
});

test("gather offers cover new-zone, solo dungeon, and Labyrinth materials", () => {
  const byMaterial = new Map([25, 45, 60, 75, 100].flatMap((level) => sampleQuests(level, 150))
    .filter((quest) => quest.kind === "gather")
    .map((quest) => [quest.target.material, quest]));
  const expected = [
    "bilge_raider_insignia", "abyssal_scale", "frostfang_pelt", "rimebound_plate",
    "suncleft_scourge_fang", "glassback_chitin", "salvaged_dog_tag", "war_hardened_insignia",
    "labyrinth_etched_fang", "labyrinth_echo_silk", "labyrinth_rune_shard",
    "labyrinth_thorned_horn", "labyrinth_void_ichor", "labyrinth_etched_stone",
    ...Object.values(DUNGEON_TYPES).flatMap((d) => [d.materials.basic, d.materials.elite]),
  ];
  for (const material of expected) {
    expect(byMaterial.has(material)).toBe(true);
    expect(byMaterial.get(material).description).toContain(MATERIALS[material].name);
  }
  expect(byMaterial.get("labyrinth_void_ichor").description).toContain("Labyrinth");
  expect(byMaterial.get(DUNGEON_TYPES.observatory.materials.elite).description).toContain("Void Observatory");
  expect(sampleQuests(21, 300).some((q) => q.target.material?.startsWith("labyrinth_"))).toBe(false);
});

test("only matching boss kills advance a named hunt; legacy hunts still work", () => {
  const quest = { ...sampleQuests().find((q) => q.tier === "Unique" && q.target.region === "Dungeon"), count: 2 };
  const boss = { id: quest.target.enemyId, tier: "boss", region: "Dungeon", dungeon: true };
  for (const wrong of [
    { ...boss, id: "other-boss" },
    { ...boss, tier: "elite" },
    { ...boss, region: "Forest" },
  ]) {
    const quests = [quest];
    expect(recordQuestKill(quests, wrong)).toEqual({ quests, messages: [] });
  }
  const first = recordQuestKill([quest], boss);
  expect(first.quests[0].progress).toBe(1);
  const completed = recordQuestKill(first.quests, boss);
  expect(completed.quests[0].progress).toBe(2);
  expect(completed.messages[0]).toContain("Return to the tavern");
  expect(recordQuestKill(completed.quests, boss).quests).toBe(completed.quests);
  const legacy = { ...quest, target: { tier: "boss", region: "Forest" } };
  expect(recordQuestKill([legacy], { tier: "boss", region: "Forest" }).quests[0].progress).toBe(1);
  expect(recordQuestKill([{ ...quest, status: "abandoned" }], boss).messages).toEqual([]);
});

test("region boss and group dungeon quests only count their own boss", () => {
  const quests = sampleQuests(100, 300);
  const regionBoss = quests.find((q) => q.tier === "Legendary" && q.kind === "hunt");
  const siege = ENEMIES.find((e) => e.id === regionBoss.target.enemyId);
  expect(recordQuestKill([regionBoss], { ...siege, region: "ShatteredFront" }).quests[0].progress).toBe(1);
  expect(recordQuestKill([regionBoss], { id: "someOtherBoss", tier: "boss", region: "ShatteredFront" }).messages).toEqual([]);

  const group = quests.find((q) => q.target.region === "GroupDungeon");
  const kill = { id: group.target.enemyId, tier: "boss", region: "GroupDungeon" };
  expect(recordQuestKill([group], kill).quests[0].progress).toBe(1);
  expect(recordQuestKill([group], { ...kill, id: "group:elsewhere" }).messages).toEqual([]);
});

test("gather quests report how many of the material the player holds", () => {
  const quest = sampleQuests().find((q) => q.kind === "gather");
  player.materials = { [quest.target.material]: quest.count + 7 };
  expect(getObjective(quest, player)).toEqual({ progress: quest.count, count: quest.count, done: true, held: quest.count + 7 });
  player.materials = {};
  expect(getObjective(quest, player)).toEqual({ progress: 0, count: quest.count, done: false, held: 0 });
  const hunt = sampleQuests().find((q) => q.kind === "hunt");
  expect(getObjective(hunt, player)).not.toHaveProperty("held");
});

test("dungeon material hand-ins require and consume the exact material once", () => {
  const quest = sampleQuests().find((q) => q.kind === "gather" && q.target.material === DUNGEON_TYPES.crypt.materials.basic);
  player.quests = [quest];
  player.materials = { [quest.target.material]: quest.count - 1, beast_fang: 99 };
  expect(getObjective(quest).done).toBe(false);
  expect(turnInQuest(quest.id)).toEqual({ ok: false });
  player.materials[quest.target.material] += 3;
  expect(getObjective(quest)).toEqual({ progress: quest.count, count: quest.count, done: true, held: quest.count + 2 });
  expect(turnInQuest(quest.id).ok).toBe(true);
  expect(player.materials).toEqual({ [quest.target.material]: 2, beast_fang: 99 });
  expect(player.quests[0].status).toBe("completed");
  expect(player.inventory).toHaveLength(1);
  expect(turnInQuest(quest.id)).toEqual({ ok: false });
  expect(player.inventory).toHaveLength(1);
});

test("reputation no longer locks quests", () => {
  const quest = { id: "old", tier: "S+", reqLevel: 12, reqRep: 4000 };
  expect(getRequirementProblem(quest, { level: 12, rep: 0 })).toBeNull();
  expect(getRequirementProblem(quest, { level: 11, rep: 9999 })).toBe("Requires level 12");
});

test("legacy rank quests map onto the matching rarity", () => {
  expect(["D", "C", "B", "A", "S", "S+"].map((key) => getQuestTier(key).key))
    .toEqual(["Common", "Uncommon", "Rare", "Epic", "Legendary", "Unique"]);
});

test.each(["Rare", "Epic", "Legendary", "Unique", "B", "A", "S", "S+"])(
  "%s reward gear guarantees ascending rarity and stat floors, including legacy quests",
  (rank) => {
    const tier = getQuestTier(rank);
    for (const random of [0, 0.999999999]) {
      for (const legacy of [false, true]) {
        Math.random.mockReturnValue(random);
        for (let i = 0; i < 20; i++) {
          const reward = { astra: 10, exp: 10, rep: tier.rep, minRarity: tier.minRarity };
          if (!legacy) reward.minTier = tier.minTier;
          player.quests = [{
            id: "reward", tier: rank, kind: "hunt", title: "Test", count: 1,
            progress: 1, status: "active", reward,
          }];
          expect(turnInQuest("reward").ok).toBe(true);
          const item = player.inventory.at(-1);
          expect(RARITY_NAMES.indexOf(item.rarity)).toBeGreaterThanOrEqual(tier.minRarity);
          expect(item.mainStat.tier).toBeGreaterThanOrEqual(tier.minTier);
          Object.values(item.subTiers).forEach((statTier) => expect(statTier).toBeGreaterThanOrEqual(tier.minTier));
        }
      }
    }
  },
);

test("new rewards advertise stat floors, and low rarities always grant a potion", () => {
  sampleQuests().forEach((quest) => {
    const tier = getQuestTier(quest.tier);
    expect(quest.reward.minTier).toBe(tier.minTier);
  });
  const geared = sampleQuests().filter((q) => getQuestTier(q.tier).minTier);
  geared.forEach((q) => expect(rewardText(q.reward)).toContain(`T${q.reward.minTier}+ gear stats`));
  const low = [1, 5, 9].flatMap((level) => sampleQuests(level, 100)).filter((q) => ["Common", "Uncommon"].includes(q.tier));
  expect(low.length).toBeGreaterThan(0);
  expect(low.filter((q) => !q.reward.potion || q.reward.minRarity)).toEqual([]);
});

test("every potion can be a quest reward, with pricier potions rarer and only on harder quests", () => {
  const potionKeys = Object.keys(CONSUMABLES).filter((key) => /Potion$/.test(key));
  const offered = new Set(Object.values(QUEST_POTIONS).flatMap((table) => Object.keys(table.weights)));
  expect(offered).toEqual(new Set(potionKeys));

  const order = QUEST_TIERS.map((t) => t.key);
  const share = (tier, key) => {
    const weights = QUEST_POTIONS[tier].weights;
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    return (weights[key] || 0) / total;
  };
  order.forEach((tier) => {
    const keys = Object.keys(QUEST_POTIONS[tier].weights).sort((x, y) => CONSUMABLES[x].price - CONSUMABLES[y].price);
    expect(share(tier, keys[keys.length - 1])).toBeLessThanOrEqual(share(tier, keys[0]));
  });
  ["staminaPotion", "cleansingPotion"].forEach((key) => {
    expect(share("Common", key)).toBe(0);
    expect(share("Uncommon", key)).toBe(0);
    for (let i = 3; i < order.length; i += 1) {
      expect(share(order[i], key) * QUEST_POTIONS[order[i]].chance)
        .toBeGreaterThan(share(order[i - 1], key) * QUEST_POTIONS[order[i - 1]].chance);
    }
  });

  const rolled = new Set(sampleQuests(100, 500).concat(sampleQuests(5, 200)).map((q) => q.reward.potion));
  potionKeys.forEach((key) => expect(rolled.has(key)).toBe(true));
});

test("runes are a very small chance, only on Epic and harder quests", () => {
  expect(Object.keys(QUEST_RUNE_CHANCE)).toEqual(["Epic", "Legendary", "Unique"]);
  Object.values(QUEST_RUNE_CHANCE).forEach((chance) => expect(chance).toBeLessThanOrEqual(0.1));
  Object.keys(QUEST_RUNES).forEach((key) => expect(CONSUMABLES[key].rune).toBe(true));

  const quests = sampleQuests(100, 1500);
  const withRunes = quests.filter((q) => q.reward.rune);
  expect(withRunes.length).toBeGreaterThan(0);
  expect(withRunes.length / quests.length).toBeLessThan(0.05);
  withRunes.forEach((q) => {
    expect(Object.keys(QUEST_RUNE_CHANCE)).toContain(q.tier);
    expect(rewardText(q.reward)).toContain(CONSUMABLES[q.reward.rune].name);
  });
});

test("turning in a quest grants its potion and rune", () => {
  player.consumables = { staminaPotion: 2 };
  player.quests = [{
    id: "loot", tier: "Common", kind: "hunt", title: "Loot", count: 1, progress: 1, status: "active",
    reward: { astra: 1, exp: 1, rep: 1, potion: "staminaPotion", rune: "polishingRune" },
  }];
  const result = turnInQuest("loot");
  expect(result.ok).toBe(true);
  expect(player.consumables).toEqual({ staminaPotion: 3, polishingRune: 1 });
  expect(result.messages.join(" ")).toContain("polishingRune");
});

test("old offers refresh immediately, new offers cache, and accepted quests survive", () => {
  const accepted = { id: "accepted", status: "active" };
  player.quests = [accepted];
  player.questBoard = { hour: 100, quests: [{ id: "old-offer" }] };
  const board = getQuestBoard();
  expect(board).toHaveLength(8);
  expect(board.some((q) => q.id === "old-offer")).toBe(false);
  expect(getQuestBoard()).toBe(board);
  expect(player.quests).toEqual([accepted]);
  expect(acceptQuest(board[0].id).ok).toBe(true);
  expect(player.quests).toHaveLength(2);
  expect(getQuestBoard()).toHaveLength(7);
});
