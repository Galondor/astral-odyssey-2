import { getPlayer, setPlayer } from "../../character/player";
import {
  attackRound, consumeItemRound, defendRound, passRound, endCombat,
  getCombatActions, getCombatRound, getCombatTutorial, getEnemy,
  getPlayerStatuses, startCombat,
  createContestFighter, playContestAction,
} from "../../combat/combat";
import { TUTORIAL_ENEMY } from "../../combat/tutorial";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
let hero;
const target = { name: "Target", maxHp: 10000, defense: 0, speed: 0, attack: [10, 10], critical: 0 };
beforeEach(() => {
  hero = {
    class: "Spellblade", level: 1, equipment: {}, skills: { renewal: 1, provoke: 1, cleave: 1 },
    equippedSkills: ["renewal", "provoke", "cleave"], consumables: { healthPotion: 5, minorPowerPotion: 2 },
    stats: { health: 50, maxHealth: 100, power: 20, maxPower: 30, stamina: 5, maxStamina: 10,
      attackMin: 10, attackMax: 10, magicAttackMin: 10, magicAttackMax: 10, defense: 0, speed: 20,
      criticalHitChance: 0, criticalDamageBonus: 2 },
  };
  getPlayer.mockImplementation(() => JSON.parse(JSON.stringify(hero)));
  setPlayer.mockImplementation((patch) => { hero = { ...hero, ...JSON.parse(JSON.stringify(patch)) }; });
  endCombat();
  jest.spyOn(Math, "random").mockReturnValue(0.5);
  startCombat(target);
});
afterEach(() => { endCombat(); jest.restoreAllMocks(); });

test("Action then potion resolves one enemy turn and one round", () => {
  expect(attackRound("melee").turnEnded).toBe(false);
  expect(hero.stats.health).toBe(50);
  expect(getCombatRound()).toBe(1);
  expect(attackRound("melee").used).toBe(false);
  expect(consumeItemRound("healthPotion").turnEnded).toBe(true);
  expect(hero.stats.health).toBe(90);
  expect(hero.consumables.healthPotion).toBe(4);
  expect(getCombatRound()).toBe(2);
});

test("two Quick skills substitute the Action, repeated skill rejected", () => {
  expect(attackRound(null, "renewal").turnEnded).toBe(false);
  const power = hero.stats.power;
  expect(attackRound(null, "renewal").used).toBe(false);
  expect(hero.stats.power).toBe(power);
  expect(attackRound(null, "provoke").turnEnded).toBe(true);
  expect(getCombatRound()).toBe(2);
});

test("Quick skill triggers Spellblade infusion for an attack in the same turn", () => {
  attackRound(null, "renewal");
  const before = getEnemy().hp;
  expect(attackRound("melee").turnEnded).toBe(true);
  expect(before - getEnemy().hp).toBe(15);
});

test("a basic attack before a Quick skill leaves Spellstrike ready for next turn", () => {
  attackRound("melee");
  attackRound(null, "provoke");
  const before = getEnemy().hp;
  attackRound("melee");
  expect(before - getEnemy().hp).toBe(15);
});

test("Spellcaster recovers Power once per completed turn, not per Quick skill", () => {
  hero.class = "Spellcaster";
  startCombat(target);
  attackRound(null, "renewal");
  expect(hero.stats.power).toBe(17);
  attackRound(null, "provoke");
  expect(hero.stats.power).toBe(16);
});

test("guard survives a subsequent Quick potion", () => {
  defendRound();
  consumeItemRound("healthPotion");
  expect(hero.stats.health).toBe(95);
});

test("End Turn ticks statuses only once and preserves unspent items", () => {
  getPlayerStatuses().push({ id: "poison", turns: 3, power: 0.1, stacks: 1 });
  attackRound("melee");
  expect(getPlayerStatuses()[0].turns).toBe(3);
  passRound();
  expect(getPlayerStatuses()[0].turns).toBe(2);
  expect(hero.consumables.healthPotion).toBe(5);
});

test("ineffective potion and unaffordable skill preserve both slots", () => {
  hero.stats.health = 100;
  expect(consumeItemRound("healthPotion").used).toBe(false);
  hero.stats.power = 0;
  expect(attackRound(null, "renewal").used).toBe(false);
  expect(getCombatActions()).toMatchObject({ actionAvailable: true, quickAvailable: true });
});

test("stun forfeits both slots without spending a potion", () => {
  getPlayerStatuses().push({ id: "stun", turns: 1 });
  expect(consumeItemRound("healthPotion").turnEnded).toBe(true);
  expect(hero.consumables.healthPotion).toBe(5);
  expect(getCombatRound()).toBe(2);
});

test("heavy winds up, cannot crit, and spends the following turn recovering", () => {
  startCombat({ ...target, critical: 1, abilities: [{ name: "Heavy", power: 2, heavy: true, weight: 1000, cooldown: 5 }] });
  passRound();
  expect(getEnemy().pending.name).toBe("Heavy");
  expect(hero.stats.health).toBe(50);
  defendRound();
  passRound();
  expect(hero.stats.health).toBe(40);
  expect(getEnemy().recovering).toBe(true);
  passRound();
  expect(hero.stats.health).toBe(40);
  expect(getEnemy().recovering).toBe(false);
});

test("tutorial gates choices, scripts telegraphs, and completes without spending owned resources", () => {
  const original = JSON.parse(JSON.stringify(hero));
  startCombat(TUTORIAL_ENEMY);
  expect(consumeItemRound("healthPotion").used).toBe(false);
  expect(getCombatTutorial().step).toBe(1);
  attackRound("magic");
  consumeItemRound("healthPotion");
  expect(getEnemy().pending.name).toBe("Training Slam");
  defendRound();
  passRound();
  expect(getEnemy().recovering).toBe(true);
  attackRound("melee");
  passRound();
  expect(getEnemy().recovering).toBe(false);
  expect(attackRound("melee").over).toBe(true);
  expect(hero.combatTutorialCompleted).toBe(true);
  expect(hero.stats).toEqual(original.stats);
  expect(hero.consumables).toEqual(original.consumables);
  expect(hero.records?.basicEnemiesKilled || 0).toBe(0);
  expect(getEnemy()).toBeNull();
});

test("a lethal Action finishes immediately without requiring Quick or End Turn", () => {
  startCombat({ ...target, maxHp: 1, tier: "training", dropChance: 0 });
  expect(attackRound("melee").over).toBe(true);
  expect(getEnemy()).toBeNull();
});

test("saved partial turn restores slots, guard, and tutorial step without granting a new turn", () => {
  startCombat(TUTORIAL_ENEMY);
  attackRound("melee");
  expect(hero.combatState.fight.actions.actionAvailable).toBe(false);
  endCombat({ preserveSaved: true });
  expect(getEnemy().id).toBe("trainingSentinel");
  expect(getCombatActions()).toMatchObject({ actionAvailable: false, quickAvailable: true });
  expect(getCombatTutorial().step).toBe(2);
  expect(attackRound("melee").used).toBe(false);
  consumeItemRound("healthPotion");
  expect(getCombatTutorial().step).toBe(3);
});

test("cloud snapshots with omitted empty arrays restore a legal partial turn", () => {
  attackRound("melee");
  delete hero.combatState.enemy.statuses;
  delete hero.combatState.enemy.cooldowns;
  delete hero.combatState.enemy.phasesDone;
  delete hero.combatState.fight.actions.usedSkills;
  endCombat({ preserveSaved: true });
  expect(getEnemy().name).toBe("Target");
  expect(consumeItemRound("healthPotion").turnEnded).toBe(true);
});

test("stun delays a committed heavy and phase changes wait until after recovery", () => {
  startCombat({
    ...target,
    phases: [{ below: 0.9, text: "Phase changed", self: { id: "enrage", turns: 3, power: 1 } }],
    abilities: [{ name: "Heavy", power: 2, heavy: true, weight: 1000, cooldown: 5 }],
  });

  passRound();
  getEnemy().hp = 100;
  getEnemy().statuses.push({ id: "stun", turns: 1 });
  expect(passRound().replies.join(" ")).toContain("stunned");
  expect(getEnemy().pending.name).toBe("Heavy");
  expect(getEnemy().phasesDone).toEqual([]);
  passRound();
  expect(hero.stats.health).toBe(30);
  expect(getEnemy().recovering).toBe(true);
  passRound();
  expect(getEnemy().phasesDone).toEqual([]);
  expect(passRound().replies).toContain("[purple]Phase changed[/purple]");
});

test("inventory-funded mirror PvP remains finite without hidden potion caps", () => {
  const fighter = (name) => createContestFighter({
    ...hero, name, class: "Specialist", consumables: { healthPotion: 10 },
    stats: { ...hero.stats, health: 100, attackMin: 20, attackMax: 20 },
  });
  let actor = fighter("Alpha");
  let targetFighter = fighter("Beta");
  let turns = 0;
  while (actor.player.stats.health > 0 && targetFighter.player.stats.health > 0 && turns < 80) {
    if (actor.player.stats.health < 100 && actor.player.consumables.healthPotion > 0) {
      const drink = playContestAction(actor, targetFighter, { type: "consume", key: "healthPotion" });
      actor = drink.attacker;
      targetFighter = drink.defender;
    }
    let result = playContestAction(actor, targetFighter, { type: "melee" });
    if (!result.turnEnded && result.defender.player.stats.health > 0)
      result = playContestAction(result.attacker, result.defender, { type: "pass" });
    actor = result.defender;
    targetFighter = result.attacker;
    turns += 1;
  }
  expect(turns).toBeLessThan(80);
  expect(Math.min(actor.player.stats.health, targetFighter.player.stats.health)).toBe(0);
  expect((actor.player.consumables.healthPotion || 0) + (targetFighter.player.consumables.healthPotion || 0)).toBe(0);
});
