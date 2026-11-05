import { getPlayer, setPlayer } from "../../character/player";
import {
  attackRound,
  endCombat,
  getCombatActions,
  getEnemy,
  getPlayerStatuses,
  passRound,
  startCombat,
} from "../../combat/combat";

jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(),
  setPlayer: jest.fn(),
}));

let hero;
const makeHero = (passives, stats = {}, extra = {}) => ({
  name: "Hero",
  level: 70,
  class: null,
  stats: {
    speed: 20, attackMin: 100, attackMax: 100, magicAttackMin: 100, magicAttackMax: 100,
    criticalHitChance: 0, criticalDamageBonus: 2, power: 40, maxPower: 40,
    health: 1000, maxHealth: 1000, defense: 0, evasion: 0, exp: 0, ...stats,
  },
  passives, equippedPassives: passives,
  skills: { cleave: 1 }, equippedSkills: ["cleave"],
  ...extra,
});
const fight = (passives, { stats, enemy, extra } = {}) => {
  hero = makeHero(passives, stats, extra);
  startCombat({ name: "Target", maxHp: 10000, defense: 0, speed: 1, attack: [50, 50], critical: 0, abilities: [], ...enemy });
};
// Takes the Action, then ends the turn so the enemy swings back.
const fullRound = (type, key) => {
  const first = attackRound(type, key);
  if (first.over || first.turnEnded) return first;
  return passRound();
};

beforeEach(() => {
  jest.spyOn(Math, "random").mockReturnValue(0.5);
  getPlayer.mockImplementation(() => hero);
  setPlayer.mockImplementation((patch) => { hero = { ...hero, ...patch }; });
});
afterEach(() => {
  endCombat();
  jest.restoreAllMocks();
});

test("Glass Cannon deals 30% more damage and takes 20% more damage", () => {
  fight(["glassCannon"]);
  fullRound("melee");
  expect(getEnemy().hp).toBe(10000 - 130);
  expect(hero.stats.health).toBe(1000 - 60);
});

test("Apex Predator adds 20% damage against enemies below half health", () => {
  fight(["apexPredator"]);
  getEnemy().hp = 4000;
  attackRound("melee");
  expect(getEnemy().hp).toBe(4000 - 120);
});

test("Unbreakable caps hits below 35% health and lowers damage dealt by 20%", () => {
  fight(["unbreakable"], { stats: { health: 300 }, enemy: { attack: [500, 500] } });
  fullRound("melee");
  expect(getEnemy().hp).toBe(10000 - 80);
  expect(hero.stats.health).toBe(300 - 250);
});

test("Last Light saves the player once per combat with a barrier", () => {
  fight(["lastLight"], { stats: { health: 10 } });
  fullRound("melee");
  expect(hero.stats.health).toBe(1);
  expect(getPlayerStatuses()).toContainEqual(expect.objectContaining({ id: "barrier", power: 200 }));
});

test("Revenge turns direct damage taken into a bonus on the next attack", () => {
  fight(["revenge"], { enemy: { attack: [100, 100] } });
  fullRound("melee");
  expect(getEnemy().hp).toBe(10000 - 100);
  attackRound("melee");
  expect(getEnemy().hp).toBe(10000 - 100 - 110);
});

test("Battle Trance restores power and Overcharge lets it overfill for stronger skills", () => {
  fight(["battleTrance", "overcharge"]);
  fullRound("melee");
  expect(hero.stats.power).toBe(44);
  const before = getEnemy().hp;
  attackRound(null, "cleave");
  expect(before - getEnemy().hp).toBe(Math.round(140 * 1.15));
  expect(hero.stats.power).toBe(40);
});

test("Overcharged power drains back to max when combat ends", () => {
  fight(["battleTrance", "overcharge"]);
  fullRound("melee");
  expect(hero.stats.power).toBe(44);
  endCombat();
  expect(hero.stats.power).toBe(40);
});

test("Quick Reflexes makes the first non-ultimate skill a Quick Action", () => {
  fight(["quickReflexes"]);
  expect(getCombatActions().quickSkill).toBe(true);
  attackRound(null, "cleave");
  expect(getCombatActions()).toMatchObject({ actionAvailable: true, quickAvailable: false, quickSkill: false });
});

test("Efficiency lowers skill power costs", () => {
  fight(["efficiency"]);
  attackRound(null, "cleave");
  expect(hero.stats.power).toBe(40 - 3);
});

test("Scavenger restores health and power after a win", () => {
  fight(["scavenger"], { stats: { health: 500, power: 10 }, enemy: { maxHp: 50, exp: 0, astra: 0 } });
  const result = attackRound("melee");
  expect(result.over).toBe(true);
  expect(result.replies).toContain("Scavenger: you recover 100 health and 4 power.");
});
