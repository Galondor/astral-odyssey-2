import { getPlayer, setPlayer } from "../../character/player";
import {
  attackRound, defendRound, passRound, startCombat, endCombat,
  getCombatActions, getCombatClassState, getEnemy, getPlayerStatuses,
  createContestFighter, playContestAction,
} from "../../combat/combat";
import { createGroupCombat, createGroupMember, resolveGroupRound, refreshMembers } from "../../combat/groupCombat";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));

const hero = (cls, extra = {}) => ({
  name: "Hero", class: cls, level: 30, equipment: {},
  skills: { fireball: 1, whirlwind: 1, chainLightning: 1 },
  equippedSkills: ["fireball", "whirlwind", "chainLightning"],
  stats: {
    health: 1000, maxHealth: 1000, power: 100, maxPower: 100,
    attackMin: 100, attackMax: 100, magicAttackMin: 150, magicAttackMax: 150,
    criticalHitChance: 0, criticalDamageBonus: 2, defense: 0, speed: 100, evasion: 0,
  },
  ...extra,
});
const dummy = () => ({
  name: "Dummy", maxHp: 10000, defense: 0, speed: 1, attack: [50, 50],
  critical: 0, abilities: [], phases: [],
});
let saved;
beforeEach(() => {
  jest.spyOn(Math, "random").mockReturnValue(0.5);
  getPlayer.mockImplementation(() => saved);
  setPlayer.mockImplementation((patch) => { saved = { ...saved, ...patch }; });
});
afterEach(() => { endCombat(); jest.restoreAllMocks(); });
const begin = (cls, extra) => {
  saved = hero(cls, extra);
  startCombat(dummy());
};
const finish = () => passRound();

test("Swordsman chooses between another defended round and a resource-consuming signature", () => {
  begin("Swordsman");
  expect(attackRound(null, "resolveStrike").used).toBe(false);
  expect(getCombatActions().actionAvailable).toBe(true);
  defendRound();
  expect(getCombatClassState().resolve).toBe(1);
  finish();
  expect(getCombatClassState().resolve).toBe(2);
  const hp = getEnemy().hp;
  expect(attackRound(null, "resolveStrike").used).toBe(true);
  expect(getEnemy().hp).toBe(hp - 150);
  expect(getCombatClassState().resolve).toBe(0);
});

test("Spellblade weaves both basic attacks and uses a signature without equipping it", () => {
  begin("Spellblade");
  attackRound("magic");
  finish();
  expect(getCombatClassState().weave).toBe(1);
  const hp = getEnemy().hp;
  attackRound("melee");
  expect(getEnemy().hp).toBe(hp - 125);
  finish();
  expect(getCombatClassState().weave).toBe(2);
  const before = getEnemy().hp;
  expect(attackRound(null, "fusionStrike").used).toBe(true);
  expect(getEnemy().hp).toBe(before - 270);
  expect(getCombatClassState().weave).toBe(0);
});

test("the existing Spellblade loop still weaves an offensive action parried in Contest", () => {
  Math.random.mockReturnValue(0);
  const actor = createContestFighter(hero("Spellblade"));
  const target = createContestFighter({ ...hero("Duelist"), name: "Opponent" });
  const result = playContestAction(actor, target, { type: "magic" });
  expect(result.defender.player.stats.health).toBe(1000);
  expect(result.attacker.combat.weave).toBe(1);
});

test("AoE builds weave once per action and class changes cannot alter a combat snapshot", () => {
  saved = hero("Spellblade", { classMastery: { Spellblade: ["flowingWeave"] } });
  startCombat([dummy(), dummy(), dummy()]);
  attackRound(null, "chainLightning");
  expect(getCombatClassState().weave).toBe(1);
  finish();
  saved = { ...saved, class: "Swordsman", classMastery: {}, equippedSkills: [] };
  expect(attackRound(null, "whirlwind").used).toBe(true);
  expect(getCombatClassState().weave).toBe(2);
  expect(getCombatClassState().cls).toBe("Spellblade");
});

test("stun consumes no signature resources and signatures never use Quick Reflexes", () => {
  begin("Swordsman", { passives: ["quickReflexes"], equippedPassives: ["quickReflexes"] });
  defendRound(); finish();
  getPlayerStatuses().push({ id: "stun", turns: 1 });
  attackRound(null, "resolveStrike");
  expect(getCombatClassState().resolve).toBe(2);
  attackRound(null, "resolveStrike");
  expect(getCombatActions().actionAvailable).toBe(false);
  expect(getCombatActions().quickAvailable).toBe(true);
});

test("Contest supports signatures and gains defensive Resolve only once per opposing turn", () => {
  const sword = createContestFighter(hero("Swordsman"));
  const mage = createContestFighter(hero("Spellcaster"));
  const guard = playContestAction(sword, mage, { type: "defend" });
  expect(guard.attacker.combat.resolve).toBe(1);
  const handoff = playContestAction(guard.attacker, guard.defender, { type: "pass" });
  const hit = playContestAction(handoff.defender, handoff.attacker, { type: "melee" });
  expect(hit.defender.combat.resolve).toBe(2);
  const strike = playContestAction(hit.defender, hit.attacker, { type: "skill", key: "resolveStrike" });
  expect(strike.attacker.combat.resolve).toBe(0);
});

test("group guard builds Resolve and resource meters reset at encounter refresh", () => {
  const c = createGroupCombat({
    A: createGroupMember("A", hero("Swordsman")),
    B: createGroupMember("B", { ...hero("Spellcaster"), name: "Ally" }),
  }, { enemies: ["dummy"] }, dummy);
  resolveGroupRound(c, { A: { type: "guard", target: "B" }, B: { type: "pass" } }, { spawn: dummy });
  expect(c.players.A.resolve).toBeGreaterThanOrEqual(1);
  c.players.A.resolve = 2;
  const before = c.enemies[0].hp;
  resolveGroupRound(c, { A: { type: "skill", key: "resolveStrike", target: c.enemies[0].uid } }, { spawn: dummy });
  expect(c.enemies[0].hp).toBe(before - 150);
  expect(c.players.A.resolve).toBe(0);
  refreshMembers(c.players);
  expect(c.players.A.resolve).toBe(0);
});

test("group AoE gives one weaving step and a signature spends a full action", () => {
  const c = createGroupCombat({ A: createGroupMember("A", hero("Spellblade")) },
    { enemies: ["a", "b", "c"] }, dummy);
  const act = (key) => resolveGroupRound(c, { A: { type: "skill", key, target: c.enemies[0].uid } }, { spawn: dummy });
  act("chainLightning");
  expect(c.players.A.weave).toBe(1);
  act("whirlwind");
  expect(c.players.A.weave).toBe(2);
  const before = c.enemies[0].hp;
  act("fusionStrike");
  expect(c.enemies[0].hp).toBe(before - 270);
  expect(c.players.A.weave).toBe(0);
});

test("saved combat restores its resource meter and frozen mastery rather than rebuilding from current gear", () => {
  begin("Spellblade", { classMastery: { Spellblade: ["flowingWeave"] } });
  attackRound("magic");
  endCombat({ preserveSaved: true });
  saved.class = "Swordsman";
  saved.classMastery = {};
  getEnemy();
  expect(getCombatClassState()).toMatchObject({
    cls: "Spellblade", weave: 1, classNodes: ["flowingWeave"],
  });
  finish();
  expect(attackRound("melee").used).toBe(true);
  expect(getCombatClassState().weave).toBe(2);
});

test("Runic Guard spends one weave instead of generating offense and occupies a regular skill slot", () => {
  begin("Spellblade", {
    classMastery: { Spellblade: ["runicGuard"] },
    equippedSkills: ["runicGuard"],
  });
  expect(attackRound(null, "runicGuard").used).toBe(false);
  attackRound("magic"); finish();
  expect(attackRound(null, "runicGuard").used).toBe(true);
  expect(getCombatClassState().weave).toBe(0);
  expect(getPlayerStatuses()).toContainEqual(expect.objectContaining({ id: "barrier", power: 150 }));
});

test("brace caps Resolve gain from a multi-hit enemy round, including hits absorbed by a barrier", () => {
  begin("Swordsman", { classMastery: { Swordsman: ["brace"] } });
  getEnemy().abilities = [{ name: "Flurry", hits: 5, power: 1, weight: 100 }];
  getPlayerStatuses().push({ id: "barrier", power: 500, turns: 5, stacks: 1 });
  defendRound(); finish();
  expect(getCombatClassState().resolve).toBe(3);
  expect(saved.stats.health).toBe(1000);
});

test("mastery changes the signature decision: Bastion adds protection and Rupture consumes the weave for burst", () => {
  begin("Swordsman", { classMastery: { Swordsman: ["brace", "bastion"] } });
  defendRound(); finish();
  attackRound(null, "resolveStrike");
  expect(getPlayerStatuses()).toContainEqual(expect.objectContaining({ id: "barrier", power: 150 }));
  endCombat();
  begin("Spellblade", { classMastery: { Spellblade: ["emberWeave", "rupture"] } });
  attackRound("magic"); finish();
  attackRound("melee"); finish();
  const hp = getEnemy().hp;
  attackRound(null, "fusionStrike");
  expect(getEnemy().hp).toBe(hp - 405);
  expect(getCombatClassState().weave).toBe(0);
});

test("a short three-action Spellblade weave has a measurable payoff over repeating one attack type", () => {
  begin("Spellblade");
  attackRound("magic"); finish();
  attackRound("melee"); finish();
  attackRound(null, "fusionStrike");
  expect(10000 - getEnemy().hp).toBe(545);
  endCombat();
  begin("Spellblade");
  attackRound("magic"); finish();
  attackRound("magic"); finish();
  attackRound("magic");
  expect(10000 - getEnemy().hp).toBe(450);
  expect(getCombatClassState().weave).toBe(1);
});
