import { getPlayer, setPlayer } from "../character/player";
import { RARITY_NAMES } from "../items/items";
import { DUNGEON_TYPES } from "./dungeonData";
import {
  acceptQuest, getObjective, getQuestBoard, QUEST_TIERS,
  recordQuestKill, rewardText, turnInQuest,
} from "./quests";

jest.mock("../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
jest.mock("../combat/combat", () => ({ getEnemy: () => null }));
jest.mock("../character/stats", () => ({
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

function sampleQuests() {
  return Array.from({ length: 500 }, () => getQuestBoard({ level: 100 })).flat();
}

test("S+ offers only named dungeon boss hunts and can target every boss", () => {
  const quests = sampleQuests().filter((q) => q.tier === "S+");
  const bosses = Object.values(DUNGEON_TYPES).flatMap((dungeon) => dungeon.bosses);
  expect(new Set(quests.map((q) => q.target.enemyId))).toEqual(new Set(bosses.map((boss) => boss.id)));
  quests.forEach((quest) => {
    const dungeon = Object.values(DUNGEON_TYPES).find((d) => d.bosses.some((boss) => boss.id === quest.target.enemyId));
    const boss = dungeon.bosses.find((b) => b.id === quest.target.enemyId);
    expect(quest.kind).toBe("hunt");
    expect(quest.target).toEqual({ tier: "boss", region: "Dungeon", enemyId: boss.id });
    expect(quest.description).toContain(boss.name);
    expect(quest.description).toContain(dungeon.name);
    expect(quest.count).toBe(2);
  });
});

test("B through S gather offers include all appropriate dungeon materials and retain overworld requests", () => {
  const quests = sampleQuests();
  const dungeonKeys = Object.values(DUNGEON_TYPES).flatMap((d) => Object.values(d.materials));
  for (const [rank, enemyTier] of [["B", "basic"], ["A", "elite"], ["S", "boss"]]) {
    const gathers = quests.filter((q) => q.tier === rank && q.kind === "gather");
    const dungeonGathers = gathers.filter((q) => dungeonKeys.includes(q.target.material));
    expect(new Set(dungeonGathers.map((q) => q.target.material))).toEqual(
      new Set(Object.values(DUNGEON_TYPES).map((d) => d.materials[enemyTier])),
    );
    expect(gathers.some((q) => !dungeonKeys.includes(q.target.material))).toBe(true);
    dungeonGathers.forEach((q) => {
      const dungeon = Object.values(DUNGEON_TYPES).find((d) => d.materials[enemyTier] === q.target.material);
      expect(q.description).toContain(dungeon.name);
    });
  }
  const lowGathers = quests.filter((q) => ["D", "C"].includes(q.tier) && q.kind === "gather");
  expect(lowGathers.length).toBeGreaterThan(0);
  lowGathers.forEach((q) => expect(dungeonKeys).not.toContain(q.target.material));
});

test("only matching boss kills advance a named hunt; legacy hunts still work", () => {
  const quest = sampleQuests().find((q) => q.tier === "S+");
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

test("dungeon material hand-ins require and consume the exact material once", () => {
  const quest = sampleQuests().find((q) => q.kind === "gather" && q.target.material === DUNGEON_TYPES.crypt.materials.basic);
  player.quests = [quest];
  player.materials = { [quest.target.material]: quest.count - 1, beast_fang: 99 };
  expect(getObjective(quest).done).toBe(false);
  expect(turnInQuest(quest.id)).toEqual({ ok: false });
  player.materials[quest.target.material] += 3;
  expect(getObjective(quest)).toEqual({ progress: quest.count, count: quest.count, done: true });
  expect(turnInQuest(quest.id).ok).toBe(true);
  expect(player.materials).toEqual({ [quest.target.material]: 2, beast_fang: 99 });
  expect(player.quests[0].status).toBe("completed");
  expect(player.inventory).toHaveLength(1);
  expect(turnInQuest(quest.id)).toEqual({ ok: false });
  expect(player.inventory).toHaveLength(1);
});

test.each(["B", "A", "S", "S+"])("%s reward gear guarantees ascending rarity and stat floors, including legacy quests", (rank) => {
  const tier = QUEST_TIERS.find((t) => t.key === rank);
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
});

test("new rewards advertise stat floors without changing potion-only low ranks", () => {
  sampleQuests().forEach((quest) => {
    const tier = QUEST_TIERS.find((t) => t.key === quest.tier);
    expect(quest.reward.minTier).toBe(tier.minTier);
    if (tier.minTier) expect(rewardText(quest.reward)).toContain(`T${tier.minTier}+ gear stats`);
    else {
      expect(quest.reward.minRarity).toBeUndefined();
      expect(quest.reward.potion).toBe(tier.potion);
    }
  });
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
