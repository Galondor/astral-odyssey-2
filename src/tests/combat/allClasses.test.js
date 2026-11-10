import { getPlayer, setPlayer } from "../../character/player";
import {
  attackRound, defendRound, passRound, startCombat, endCombat, getEnemy,
  getCombatClassState, getPlayerStatuses, createContestFighter, playContestAction,
} from "../../combat/combat";
import { createGroupCombat, createGroupMember, resolveGroupRound, refreshMembers } from "../../combat/groupCombat";
import { computeSkillCost, applySupportSkill } from "../../character/skills";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));

const hero = (cls, extra = {}) => ({
  name: "Hero", class: cls, level: 50, equipment: {},
  skills: { fireball: 1, frostLance: 1, cleave: 1, backstab: 1, venomStrike: 1, battleHymn: 1, chainLightning: 1, whirlwind: 1 },
  equippedSkills: ["fireball", "frostLance", "cleave"],
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

const kits = [
  ["Tactician", "advantage", "precisionStrike", { Tactician: ["survey"] }, ["defend"]],
  ["Spellcaster", "instability", "arcaneRelease", {}, ["magic", "magic"]],
  ["Duelist", "tempo", null, {}, ["riposteStance"]],
  ["Trickster", "tricks", "cashOut", {}, ["magic", "magic"]],
  ["Specialist", "adaptation", "improvise", {}, ["magic", "defend"]],
];
const soloAction = (action) => {
  const result = action === "defend" ? defendRound() :
    ["magic", "melee"].includes(action) ? attackRound(action) : attackRound(null, action);
  expect(result.used).toBe(true);
  if (!result.turnEnded) passRound();
  return result;
};
const intent = (action, target) => ["defend", "magic", "melee", "pass"].includes(action)
  ? { type: action, target } : { type: "skill", key: action, target };

test.each(kits)("%s builds its resource and cashes it out in solo combat", (cls, resource, signature, classMastery, setup) => {
  saved = hero(cls, { classMastery });
  startCombat(dummy());
  for (const action of setup) soloAction(action);
  expect(getCombatClassState()[resource]).toBe(2);
  const hp = getEnemy().hp;
  const result = soloAction(signature || "melee");
  expect(getCombatClassState()[resource]).toBe(0);
  expect(getEnemy().hp).toBeLessThan(hp - 150);
  expect(result.replies.join(" ")).toMatch(/Advantage|Instability|Tempo|Tricks|Adaptation/);
});

test.each(kits)("%s works in group combat and resets at a fresh encounter", (cls, resource, signature, classMastery, setup) => {
  const c = createGroupCombat({ A: createGroupMember("A", hero(cls, { classMastery })) },
    { enemies: ["dummy"] }, dummy);
  const act = (action) => resolveGroupRound(c, { A: intent(action, c.enemies[0].uid) }, { spawn: dummy });
  for (const action of setup) act(action);
  expect(c.players.A[resource]).toBe(2);
  const hp = c.enemies[0].hp;
  act(signature || "melee");
  expect(c.players.A[resource]).toBe(0);
  expect(c.enemies[0].hp).toBeLessThan(hp - 150);
  for (const action of setup) act(action);
  refreshMembers(c.players);
  expect(c.players.A[resource]).toBe(0);
});

test.each(kits)("%s works with serialized Contest fighters", (cls, resource, signature, classMastery, setup) => {
  let actor = createContestFighter(hero(cls, { classMastery }));
  let opponent = createContestFighter({ ...hero("Swordsman"), name: "Opponent" });
  const act = (action) => {
    let result = playContestAction(actor, opponent, intent(action));
    actor = result.attacker;
    opponent = result.defender;
    if (!result.turnEnded) {
      result = playContestAction(actor, opponent, { type: "pass" });
      actor = result.attacker;
      opponent = result.defender;
    }
    return result;
  };
  for (const action of setup) {
    act(action);
    let reply = playContestAction(opponent, actor, { type: "melee" });
    opponent = reply.attacker; actor = reply.defender;
    if (!reply.turnEnded) {
      reply = playContestAction(opponent, actor, { type: "pass" });
      opponent = reply.attacker; actor = reply.defender;
    }
  }
  expect(actor.combat[resource]).toBe(2);
  const hp = opponent.player.stats.health;
  act(signature || "melee");
  expect(actor.combat[resource]).toBe(0);
  expect(opponent.player.stats.health).toBeLessThan(hp - 150);
});

test("Instability adds 3 Power per stack, rejects unaffordable spells, and venting remains free with Efficiency", () => {
  saved = hero("Spellcaster", { classMastery: { Spellcaster: ["efficientFlow", "stabilize"] }, equippedSkills: ["fireball", "stabilize"] });
  startCombat(dummy());
  soloAction("magic"); soloAction("magic"); soloAction("magic");
  const state = getCombatClassState();
  expect(computeSkillCost("fireball", "Spellcaster", [], state)).toBe(13);
  expect(computeSkillCost("stabilize", "Spellcaster", ["efficiency"], state)).toBe(0);
  saved.stats.power = 12;
  expect(attackRound(null, "fireball")).toMatchObject({ used: false });
  expect(getCombatClassState().instability).toBe(3);
  expect(attackRound(null, "stabilize").used).toBe(true);
  expect(getCombatClassState().instability).toBe(0);
  expect(getPlayerStatuses()).toContainEqual(expect.objectContaining({ id: "barrier", power: 200 }));
});

test.each(["Tactician", "Spellcaster", "Duelist", "Trickster", "Specialist"])(
  "%s keeps its mastery and resources when a solo encounter is restored",
  (cls) => {
    const kit = kits.find((entry) => entry[0] === cls);
    saved = hero(cls, { classMastery: kit[3] });
    startCombat(dummy());
    for (const action of kit[4]) soloAction(action);
    endCombat({ preserveSaved: true });
    saved.class = "Swordsman";
    saved.classMastery = {};
    getEnemy();
    expect(getCombatClassState()).toMatchObject({ cls, [kit[1]]: 2 });
  },
);

test.each(kits)("%s signatures work in legacy solo snapshots and never consume Quick Reflexes", (cls, resource, signature, classMastery, setup) => {
  saved = hero(cls, { classMastery, passives: ["quickReflexes"], equippedPassives: ["quickReflexes"] });
  startCombat(dummy());
  for (const action of setup) soloAction(action);
  endCombat({ preserveSaved: true });
  const key = signature || "riposteStance";
  delete saved.combatState.fight.skillLevels[key];
  getEnemy();
  const result = attackRound(null, key);
  expect(result.used).toBe(true);
  expect(saved.combatState.fight.actions).toMatchObject({ actionAvailable: false, quickAvailable: true, quickSkill: true });
  expect(saved.combatState.fight.quickReflexesReady).toBe(true);
});

test("an unused Contest stance expires at handoff without blocking the next stance", () => {
  let actor = createContestFighter(hero("Duelist"));
  let opponent = createContestFighter({ ...hero("Swordsman"), name: "Opponent" });
  let result = playContestAction(actor, opponent, { type: "skill", key: "riposteStance" });
  result = playContestAction(result.attacker, result.defender, { type: "pass" });
  actor = result.attacker; opponent = result.defender;
  result = playContestAction(opponent, actor, { type: "pass" });
  actor = result.defender; opponent = result.attacker;
  expect(actor.combat.riposteReady).toBe(false);
  expect(playContestAction(actor, opponent, { type: "skill", key: "riposteStance" }).used).toBe(true);
});

test.each(kits)("%s does not spend resources or prepare a stance when stunned", (cls, resource, signature, classMastery, setup) => {
  saved = hero(cls, { classMastery });
  startCombat(dummy());
  for (const action of setup) soloAction(action);
  getPlayerStatuses().push({ id: "stun", turns: 1 });
  expect(attackRound(null, signature || "riposteStance").used).toBe(true);
  expect(getCombatClassState()[resource]).toBe(2);
  expect(getCombatClassState().riposteReady).toBe(false);
});

test.each([
  ["Spellcaster", "instability"], ["Trickster", "tricks"], ["Specialist", "adaptation"],
])("%s keeps its generated resource between ordinary group waves", (cls, resource) => {
  const c = createGroupCombat({ A: createGroupMember("A", hero(cls)) },
    { waves: [["first"], ["second"]] }, () => ({ ...dummy(), maxHp: 100 }));
  resolveGroupRound(c, { A: { type: "magic", target: c.enemies[0].uid } }, { spawn: () => ({ ...dummy(), maxHp: 100 }) });
  expect(c.waveIndex).toBe(1);
  expect(c.players.A[resource]).toBe(1);
});

test("group area attacks build one resource, consume Tempo once, and use the same bonus for every target", () => {
  for (const cls of ["Spellcaster", "Trickster", "Duelist"]) {
    const c = createGroupCombat({ A: createGroupMember("A", hero(cls, { equippedSkills: ["chainLightning", "whirlwind"] })) },
      { enemies: ["a", "b", "c"] }, dummy);
    c.players.A.tempo = 2;
    resolveGroupRound(c, { A: { type: "skill", key: cls === "Duelist" ? "whirlwind" : "chainLightning" } }, { spawn: dummy });
    if (cls === "Duelist") expect(c.players.A.tempo).toBe(0);
    else expect(c.players.A[cls === "Spellcaster" ? "instability" : "tricks"]).toBe(1);
    expect(new Set(c.enemies.map((e) => e.hp)).size).toBe(1);
  }
});

test("a missed Duelist stance expires; a slow group Duelist still prepares before enemy actions", () => {
  saved = hero("Duelist");
  startCombat(dummy());
  getEnemy().statuses.push({ id: "stun", turns: 1 });
  soloAction("riposteStance");
  expect(getCombatClassState()).toMatchObject({ tempo: 0, riposteReady: false });
  endCombat();
  const slow = hero("Duelist");
  slow.stats.speed = 0;
  const c = createGroupCombat({ A: createGroupMember("A", slow) }, { enemies: ["dummy"] }, dummy);
  resolveGroupRound(c, { A: { type: "skill", key: "riposteStance" } }, { spawn: dummy });
  expect(c.players.A).toMatchObject({ tempo: 2, riposteReady: false });
  expect(c.players.A.stats.health).toBe(1000);
});

test("Trickster does not build Tricks from an immune group target", () => {
  const c = createGroupCombat({ A: createGroupMember("A", hero("Trickster")) }, { enemies: ["dummy"] }, dummy);
  c.enemies[0].immune = "magic";
  resolveGroupRound(c, { A: { type: "magic", target: c.enemies[0].uid } }, { spawn: dummy });
  expect(c.players.A.tricks).toBe(0);
});

test.each([
  ["Tactician", "exposingCleave", "cleave"],
  ["Spellcaster", "fracturingFrost", "frostLance"],
  ["Duelist", "exposingBackstab", "backstab"],
])("%s transforms a shared attack without changing its ordinary skill level", (cls, node, key) => {
  saved = hero(cls, { classMastery: { [cls]: [node] }, equippedSkills: [key] });
  startCombat(dummy());
  attackRound(null, key);
  expect(getEnemy().statuses).toContainEqual(expect.objectContaining({ id: "vulnerable", power: 0.2 }));
});

test("Specialist Battle Hymn transformation shields the whole party and a real support technique heals an ally", () => {
  const actor = createGroupMember("A", hero("Specialist", {
    classMastery: { Specialist: ["rallyingHymn", "fieldMending"] },
    equippedSkills: ["battleHymn", "fieldMending"],
  }));
  const ally = createGroupMember("B", { ...hero("Swordsman"), name: "Ally" });
  const hymn = applySupportSkill("battleHymn", 1, actor, [actor, ally]);
  expect(hymn.threat).toBe(200);
  for (const member of [actor, ally])
    expect(member.statuses).toContainEqual(expect.objectContaining({ id: "barrier", power: 100 }));
  ally.stats.health = 500;
  const c = createGroupCombat({ A: actor, B: ally }, { enemies: ["dummy"] }, dummy);
  resolveGroupRound(c, { A: { type: "skill", key: "fieldMending", target: "B" } }, { spawn: dummy });
  expect(c.players.B.stats.health).toBeGreaterThanOrEqual(650);
  expect(c.players.A).toMatchObject({ adaptation: 1, lastRole: "support" });
});
