import { getPlayer, setPlayer } from "../../character/player";
import {
  attackRound, defendRound, endCombat, getCombatActions, getCombatRound, getEnemies, getEnemy,
  getPlayerStatuses, passRound, selectCombatTarget, startCombat, takeOpeningReplies,
} from "../../combat/combat";
import { generateRandomGemstone, generateRandomSlotItem } from "../../items/items";
import { getVisibleOptions, processButton, scenes } from "../../world/gameLogic";
import { skillCost } from "../../character/skills";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
jest.mock("../../items/items", () => ({
  ...jest.requireActual("../../items/items"),
  generateRandomSlotItem: jest.fn(),
  generateRandomGemstone: jest.fn(),
}));

let player;
const foe = (name, extra = {}) => ({
  id: name, name, tier: "basic", region: "Meadowlands", level: 30,
  maxHp: 10, attack: [10, 10], defense: 0, speed: 1, critical: 0,
  exp: 100, astra: 100, dropChance: 0, ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  player = {
    level: 30, astra: 50, baseStats: { strength: 10, dexterity: 10, intelligence: 10 },
    stats: {
      health: 1000, maxHealth: 1000, stamina: 50, maxStamina: 50,
      power: 50, maxPower: 50, speed: 100, defense: 0,
      attackMin: 20, attackMax: 20, magicAttackMin: 20, magicAttackMax: 20,
      criticalHitChance: 0, exp: 0,
    },
    quests: [{ status: "active", kind: "hunt", count: 4, title: "Basics", target: { tier: "basic" } }],
  };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
  jest.spyOn(Math, "random").mockReturnValue(0.5);
});

afterEach(() => {
  endCombat();
  jest.restoreAllMocks();
});

test("every living enemy acts once, while player statuses tick once", () => {
  startCombat([foe("One"), foe("Two"), foe("Three")]);
  getPlayerStatuses().push({ id: "poison", turns: 3, power: 0.01, stacks: 1 });
  passRound();
  expect(player.stats.health).toBe(960);
  expect(getPlayerStatuses()[0].turns).toBe(2);
  expect(getCombatRound()).toBe(2);
});

test.each(["whirlwind", "chainLightning"])("%s hits every living enemy but spends power and its action only once", (skill) => {
  player.skills = { [skill]: 1 };
  player.equippedSkills = [skill];
  startCombat([foe("One", { maxHp: 100 }), foe("Two", { maxHp: 100 }), foe("Fallen")]);
  getEnemies()[2].hp = 0;
  const cost = skillCost(player, skill);
  const result = attackRound(null, skill);
  expect(result.over).toBe(false);
  expect(getEnemies()[0].hp).toBeLessThan(100);
  expect(getEnemies()[1].hp).toBe(getEnemies()[0].hp);
  expect(getEnemies()[2].hp).toBe(0);
  expect(player.stats.power).toBe(50 - cost);
  expect(getCombatActions().usedSkills).toEqual([skill]);
  expect(getCombatActions().actionAvailable).toBe(false);
  expect(getCombatActions().quickAvailable).toBe(true);
});

test("an area skill can win the whole encounter and grants every enemy's reward", () => {
  player.skills = { whirlwind: 1 };
  player.equippedSkills = ["whirlwind"];
  startCombat([foe("One"), foe("Two"), foe("Three")]);
  expect(attackRound(null, "whirlwind").outcome).toBe("victory");
  expect(player.stats.exp).toBe(360);
  expect(player.records.basicEnemiesKilled).toBe(3);
});

test("only faster enemies take opening turns", () => {
  startCombat([foe("Slow"), foe("Fast", { speed: 50 }), foe("Faster", { speed: 60 })]);
  expect(player.stats.health).toBe(980);
  expect(takeOpeningReplies().join(" ")).toMatch(/Fast is faster.*Faster is faster/s);
  expect(getEnemy().name).toBe("Slow");
  expect(getCombatRound()).toBe(1);
});

test("failed fleeing lets all enemies act first and stops immediately on collapse", () => {
  startCombat([foe("One"), foe("Two"), foe("Three")], { enemyFirst: true });
  expect(player.stats.health).toBe(970);
  endCombat();
  player.stats.health = 5;
  startCombat([foe("Lethal"), foe("Unneeded")], { enemyFirst: true });
  const replies = takeOpeningReplies().join(" ");
  expect(replies).toContain("Collapse");
  expect(replies).not.toContain("Unneeded");
  expect(getEnemies()).toEqual([]);
});

test("targeting spends no action; kills auto-target survivors and defer every reward", () => {
  const onDefeat = jest.fn();
  const onEncounterDefeat = jest.fn();
  startCombat([foe("Leader", { onDefeat, onEncounterDefeat }), foe("Ally", { onDefeat })]);
  expect(selectCombatTarget(1)).toEqual({ ok: true });
  expect(getCombatActions().actionAvailable).toBe(true);
  expect(getCombatRound()).toBe(1);
  const first = attackRound("melee");
  expect(first.over).toBe(false);
  expect(first.turnEnded).toBe(false);
  expect(getEnemy().name).toBe("Leader");
  expect(selectCombatTarget(1).ok).toBe(false);
  expect(selectCombatTarget(-1).ok).toBe(false);
  expect(selectCombatTarget(0.5).ok).toBe(false);
  expect(getCombatActions().actionAvailable).toBe(false);
  expect(player.astra).toBe(50);
  expect(player.stats.exp).toBe(0);
  expect(player.quests[0].progress).toBeUndefined();
  expect(onDefeat).not.toHaveBeenCalled();
  passRound();
  expect(player.stats.health).toBe(990);
  const final = attackRound("melee");
  expect(final.over).toBe(true);
  expect(player.astra).toBe(270);
  expect(player.stats.exp).toBe(220);
  expect(player.records.basicEnemiesKilled).toBe(2);
  expect(player.quests[0].progress).toBe(2);
  expect(onDefeat).toHaveBeenCalledTimes(2);
  expect(onEncounterDefeat).toHaveBeenCalledTimes(1);
  expect(getEnemy()).toBeNull();
  expect(player.combatState).toBeNull();
});

test.each([2, 3, 4])("%s enemies award the exact size bonus and retain each enemy's loot", (count) => {
  let id = 0;
  generateRandomSlotItem.mockImplementation(() => ({ id: `item-${++id}`, name: "Gear" }));
  generateRandomGemstone.mockImplementation(() => ({ id: `gem-${++id}`, name: "Gem" }));
  startCombat(Array.from({ length: count }, (_, index) => foe(`Enemy ${index}`, {
    dropChance: 1, drops: [{ key: "primal_essence", chance: 1, min: 1, max: 1 }],
  })));
  Math.random.mockReturnValue(0);
  getEnemies().forEach((enemy) => { enemy.hp = 0; });
  passRound();
  const reward = count * Math.round(100 * (1 + 0.1 * (count - 1)));
  expect(player.astra).toBe(50 + reward);
  expect(player.stats.exp).toBe(reward);
  expect(player.materials.primal_essence).toBe(count);
  expect(player.inventory).toHaveLength(count);
  expect(player.gemstones).toHaveLength(count);
  expect(new Set(player.inventory.map((item) => item.id)).size).toBe(count);
  expect(player.consumables.prismaticAlloy).toBe(count);
});

test("counterattacks can kill one enemy without preventing the other enemies' turns", () => {
  player.class = "Swordsman";
  player.stats.attackMin = 10;
  player.stats.attackMax = 10;
  startCombat([foe("Fragile", { maxHp: 1 }), foe("Durable", { maxHp: 100 })]);
  Math.random.mockReturnValue(0.2);
  defendRound();
  const result = passRound();
  expect(result.over).toBe(false);
  expect(getEnemies()[0].hp).toBe(0);
  expect(getEnemies()[1].hp).toBeLessThan(100);
  expect(getEnemy().name).toBe("Durable");
});

test("independent damage-over-time effects resolve every enemy and tick the player only once", () => {
  startCombat([foe("One", { maxHp: 100 }), foe("Two", { maxHp: 100 })]);
  getEnemies().forEach((enemy) => {
    enemy.statuses.push({ id: "poison", turns: 2, power: 0.2, stacks: 1 });
  });
  passRound();
  expect(getEnemies().map((enemy) => enemy.hp)).toEqual([80, 80]);
  expect(getEnemies().map((enemy) => enemy.statuses[0].turns)).toEqual([1, 1]);
  getEnemies().forEach((enemy) => { enemy.hp = 10; });
  expect(passRound().outcome).toBe("victory");
  expect(player.stats.exp).toBe(220);
});

test("collapsing after a kill grants no partial loot or progression", () => {
  const onDefeat = jest.fn();
  startCombat([foe("Fragile", { onDefeat }), foe("Lethal", { attack: [10000, 10000] })]);
  attackRound("melee");
  expect(passRound().outcome).toBe("collapse");
  expect(onDefeat).not.toHaveBeenCalled();
  expect(player.inventory).toBeUndefined();
  expect(player.stats.exp).toBe(0);
  expect(player.records.basicEnemiesKilled).toBeUndefined();
});

test("saved combat restores the roster, selected target, defeated enemies, and action slots", () => {
  startCombat([foe("One"), foe("Two"), foe("Three")]);
  attackRound("melee");
  selectCombatTarget(2);
  const saved = JSON.parse(JSON.stringify(player.combatState));
  endCombat({ preserveSaved: true });
  player.combatState = saved;
  expect(getEnemies().map((enemy) => enemy.hp)).toEqual([0, 10, 10]);
  expect(getEnemy().name).toBe("Three");
  expect(getCombatActions().actionAvailable).toBe(false);
  passRound();
  attackRound("melee");
  passRound();
  expect(attackRound("melee").outcome).toBe("victory");
  expect(player.stats.exp).toBe(360);
  expect(player.records.basicEnemiesKilled).toBe(3);
});

test("legacy single-enemy saves still restore", () => {
  startCombat(foe("Legacy"));
  const saved = JSON.parse(JSON.stringify(player.combatState));
  delete saved.enemies;
  delete saved.targetIndex;
  endCombat({ preserveSaved: true });
  player.combatState = saved;
  expect(getEnemy().name).toBe("Legacy");
  expect(getEnemies()).toHaveLength(1);
});

test("boss encounters reject additional enemies", () => {
  expect(() => startCombat([foe("Boss", { tier: "boss" }), foe("Ally")])).toThrow("one-on-one");
  startCombat(foe("Boss", { tier: "boss" }));
  expect(attackRound("melee").outcome).toBe("victory");
  expect(player.astra).toBe(150);
});

test.each(["Melee Attack", "Magic Attack"])("%s prompts for a target before spending an action, then attacks the selected enemy", (attack) => {
  startCombat([foe("One"), foe("Two")]);
  expect(getVisibleOptions(scenes.combat).map((option) => option.label)).not.toContain("Choose Target");
  const prompt = processButton("combat", attack);
  expect(prompt.sceneId).toBe("combatTargets");
  expect(scenes.combat.screenData().enemies).toHaveLength(2);
  expect(getCombatActions().actionAvailable).toBe(true);
  expect(getEnemies().map((enemy) => enemy.hp)).toEqual([10, 10]);
  const result = processButton("combatTargets", "2. Two (10/10 HP)");
  expect(result.sceneId).toBe("combat");
  expect(getEnemies().map((enemy) => enemy.hp)).toEqual([10, 0]);
  expect(getCombatActions().actionAvailable).toBe(false);
});

test("backing out of target selection does not spend resources or keep a pending attack", () => {
  startCombat([foe("One"), foe("Two")]);
  processButton("combat", "Melee Attack");
  expect(processButton("combatTargets", "Back").sceneId).toBe("combat");
  expect(getCombatActions().actionAvailable).toBe(true);
  expect(player.stats.power).toBe(50);
  expect(getEnemies().map((enemy) => enemy.hp)).toEqual([10, 10]);
  processButton("combat", "Magic Attack");
  expect(decodeURIComponent(processButton("combatTargets", "1. One (10/10 HP)").replies.join(" "))).toContain("Magic attack roll");
});

test("single-target skills prompt after skill selection and only pay when a target is confirmed", () => {
  player.skills = { offhandStrike: 1 };
  player.equippedSkills = ["offhandStrike"];
  startCombat([foe("One", { maxHp: 100 }), foe("Two", { maxHp: 100 })]);
  expect(processButton("combatSkills", "Offhand Strike").sceneId).toBe("combatTargets");
  expect(player.stats.power).toBe(50);
  expect(getCombatActions().quickAvailable).toBe(true);
  expect(processButton("combatTargets", "Back").sceneId).toBe("combatSkills");
  processButton("combatSkills", "Offhand Strike");
  const result = processButton("combatTargets", "2. Two (100/100 HP)");
  expect(result.sceneId).toBe("combat");
  expect(getEnemies()[0].hp).toBe(100);
  expect(getEnemies()[1].hp).toBeLessThan(100);
  expect(player.stats.power).toBe(50 - skillCost(player, "offhandStrike"));
  expect(getCombatActions().quickAvailable).toBe(false);
});

test.each(["whirlwind", "renewal"])("%s bypasses enemy selection", (skill) => {
  player.skills = { [skill]: 1 };
  player.equippedSkills = [skill];
  startCombat([foe("One", { maxHp: 100 }), foe("Two", { maxHp: 100 })]);
  const option = scenes.combatSkills.options.find((option) => option.keywords.includes(
    skill === "whirlwind" ? "whirlwind" : "renewal",
  ));
  expect(processButton("combatSkills", option.label).sceneId).toBe("combat");
  expect(player.stats.power).toBeLessThan(50);
});

test("only one surviving enemy is attacked directly without a target prompt", () => {
  startCombat([foe("One"), foe("Two")]);
  getEnemies()[1].hp = 0;
  expect(processButton("combat", "Melee Attack").sceneId).toBe("menu");
  expect(getEnemy()).toBeNull();
});
