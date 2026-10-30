import { calculateStats } from "../../character/stats";
import { getClassForStats } from "../../character/classes";
import { SLOTS, generateRandomItem } from "../../items/items";
import { SKILLS } from "../../character/skills";
import { GROUP_DUNGEONS, GROUP_RUN_MS, GROUP_WIPE_PENALTY_MS } from "../../world/groupDungeonData";
import {
  allIntentsIn,
  buildGroupEnemy,
  createGroupRun,
  failRunOnTimeout,
  markLeft,
  normalizeRun,
  reconcileGroupRun,
  resolveRunRound,
  serializeRun,
} from "../../world/groupDungeons";
import { livingMembers, targetableEnemies } from "../../combat/groupCombat";
import { STATIONS, createPuzzle, puzzleClues, puzzleControls, resolvePuzzle } from "../../world/groupPuzzles";

let mockLevel = 45;
jest.mock("../../character/player", () => ({
  getPlayer: () => ({ level: mockLevel }),
  setPlayer: jest.fn(),
}));

const ARCHETYPES = {
  warrior: { split: { strength: 0.75, dexterity: 0.25, intelligence: 0 }, skills: { cleave: 3, provoke: 3, execute: 3 } },
  mage: { split: { strength: 0.2, dexterity: 0, intelligence: 0.8 }, skills: { fireball: 3, mendingLight: 4, purify: 3 } },
  rogue: { split: { strength: 0.3, dexterity: 0.7, intelligence: 0 }, skills: { backstab: 3, aegis: 3, battleHymn: 2 } },
};

const buildPlayer = (name, level, archetype) => {
  mockLevel = level;
  const { split, skills } = ARCHETYPES[archetype];
  const points = 15 + 3 * (level - 1);
  const baseStats = Object.fromEntries(Object.entries(split).map(([k, f]) => [k, 1 + Math.round(points * f)]));
  const equipment = {};
  for (const slot of SLOTS) {
    if (slot.key === "offHand" && equipment.mainHand?.twoHanded) continue;
    equipment[slot.key] = generateRandomItem(slot.type, 2);
  }
  const player = {
    name, level, baseStats, equipment,
    bonusStats: { maxHealth: 10 * (level - 1), maxStamina: level - 1 },
    skills, equippedSkills: Object.keys(skills),
    consumables: { healthPotion: 3, minorPowerPotion: 2 },
  };
  player.stats = calculateStats(player);
  player.class = getClassForStats(player.stats);
  return player;
};

const solveRings = (offsets, notches) => {
  for (let a = 0; a < notches; a += 1)
    for (let b = 0; b < notches; b += 1)
      for (let c = 0; c < notches; c += 1) {
        const t = [a, b, c];
        if (offsets.every((o, j) => (o + t[j] + t[(j + 2) % 3]) % notches === 0)) return t;
      }
  return [0, 0, 0];
};

// A sensible (not perfect) party AI for the simulation.
const chooseIntents = (run) => {
  const base = { run: run.id, round: run.round, stage: run.stage };
  const ids = run.members.filter((id) => !run.left[id]);
  const intents = {};
  if (run.puzzle) {
    const p = run.puzzle;
    if (p.kind === "stations") ids.forEach((id, i) => { intents[id] = { ...base, type: "station", key: p.order.need[i] || null }; });
    if (p.kind === "dials") ids.forEach((id) => { intents[id] = { ...base, type: "dial", values: { ...p.solution } }; });
    if (p.kind === "rings") {
      const turns = solveRings(p.offsets, p.notches);
      ids.forEach((id) => { intents[id] = { ...base, type: "ring", turns: { ...turns } }; });
    }
    return intents;
  }
  const c = run.combat;
  const living = livingMembers(c);
  const telegraph = c.enemies.some((e) => !e.dead && e.pending);
  let guardTaken = false;
  living.forEach((m, index) => {
    const has = (key) => m.equipped.includes(key) && m.stats.power >= SKILLS[key].powerCost;
    const doomed = living.find((ally) => ally.statuses.some((st) => st.id === "doom") && ally !== m);
    const corrupted = living.find((ally) => ally.statuses.filter((st) => st.id === "corruption" || st.id === "scurvy").reduce((n, st) => n + st.stacks, 0) >= 3);
    const hurt = [...living].sort((a, b) => a.stats.health / a.stats.maxHealth - b.stats.health / b.stats.maxHealth)[0];
    const hurtFrac = hurt.stats.health / hurt.stats.maxHealth;
    if (telegraph) return (intents[m.id] = { ...base, type: "defend" });
    if (doomed && has("purify")) return (intents[m.id] = { ...base, type: "skill", key: "purify", target: doomed.id });
    if (doomed && !guardTaken) {
      guardTaken = true;
      return (intents[m.id] = { ...base, type: "guard", target: doomed.id });
    }
    if (hurtFrac < 0.45 && has("mendingLight")) return (intents[m.id] = { ...base, type: "skill", key: "mendingLight", target: hurt.id });
    if (hurtFrac < 0.3 && (m.consumables.healthPotion || 0) - (m.spent.healthPotion || 0) > 0)
      return (intents[m.id] = { ...base, type: "item", key: "healthPotion", target: hurt.id });
    if (corrupted && has("purify")) return (intents[m.id] = { ...base, type: "skill", key: "purify", target: corrupted.id });
    if (has("provoke") && !m.statuses.some((st) => st.id === "taunt") && c.round % 3 === 1)
      return (intents[m.id] = { ...base, type: "skill", key: "provoke", target: m.id });
    if (has("battleHymn") && !m.statuses.some((st) => st.id === "empower") && c.round % 4 === 1)
      return (intents[m.id] = { ...base, type: "skill", key: "battleHymn" });
    if (has("aegis") && hurtFrac < 0.6) return (intents[m.id] = { ...base, type: "skill", key: "aegis", target: hurt.id });
    const magic = (m.stats.magicAttackMax || 0) > (m.stats.attackMax || 0);
    const kind = magic ? "magic" : "melee";
    let pool = targetableEnemies(c).filter((e) => e.immune !== kind);
    const other = magic ? "melee" : "magic";
    let type = kind;
    if (!pool.length) {
      pool = targetableEnemies(c).filter((e) => e.immune !== other);
      type = other;
    }
    if (!pool.length) return (intents[m.id] = { ...base, type: "defend" });
    const shards = pool.filter((e) => e.linkGroup);
    const hitEstimate = Math.min(...living.map((ally) => Math.max(ally.stats.attackMax || 0, ally.stats.magicAttackMax || 0))) * 0.5;
    const finishShards = shards.length && shards.length <= living.length && shards.every((e) => e.hp <= hitEstimate);
    const target = shards.length
      ? finishShards ? shards[index % shards.length] : [...shards].sort((a, b) => b.hp - a.hp)[0]
      : [...pool].sort((a, b) => a.hp - b.hp)[0];
    const attackSkill = m.equipped.find((key) => SKILLS[key].type === type && has(key));
    intents[m.id] = attackSkill && type === kind
      ? { ...base, type: "skill", key: attackSkill, target: target.uid }
      : { ...base, type, target: target.uid };
  });
  return intents;
};

const simulate = (dungeonId, { roundSeconds = 12, puzzleSeconds = 30 } = {}) => {
  const dungeon = GROUP_DUNGEONS[dungeonId];
  const level = dungeon.level + 5;
  const snapshots = { a: buildPlayer("Ana", level, "warrior"), b: buildPlayer("Bo", level, "mage"), c: buildPlayer("Cy", level, "rogue") };
  let now = 1_000_000;
  let run = createGroupRun({ id: "r", dungeonId, members: ["a", "b", "c"], snapshots, now, actor: "a" });
  if (process.env.GROUP_BALANCE === "2") {
    console.log(dungeonId, Object.values(run.party).map((m) => `${m.name} ${m.cls} hp${m.stats.maxHealth} atk${m.stats.attackMin}-${m.stats.attackMax} mag${m.stats.magicAttackMin}-${m.stats.magicAttackMax} def${m.stats.defense} spd${m.stats.speed}`).join(" | "));
    for (const tpl of Object.keys(GROUP_DUNGEONS[dungeonId].enemies)) {
      const e = buildGroupEnemy(dungeonId, tpl);
      console.log(tpl, e.maxHp, e.attack.join("-"), e.defense, e.speed);
    }
  }
  const stageRounds = [0, 0, 0, 0];
  const stageWipes = [0, 0, 0, 0];
  for (let i = 0; i < 1000 && run.status === "active"; i += 1) {
    const stage = run.stage;
    const wipes = run.wipes;
    now += (run.puzzle ? puzzleSeconds : roundSeconds) * 1000;
    // Round-trip through JSON like the database does
    run = normalizeRun(JSON.parse(JSON.stringify(serializeRun(run))));
    run = resolveRunRound(run, chooseIntents(run), now);
    stageRounds[stage] += 1;
    if (run.wipes > wipes) stageWipes[stage] += 1;
  }
  if (process.env.GROUP_BALANCE === "3" && run.status !== "cleared") console.log(dungeonId, run.log.slice(-70).join("\n"));
  return { status: run.status, wipes: run.wipes, stageRounds, stageWipes, endStage: run.stage, minutes: (now - run.startedAt) / 60000 };
};

const snapshots = () => ({ a: buildPlayer("Ana", 45, "warrior"), b: buildPlayer("Bo", 45, "mage") });

describe("co-op puzzles", () => {
  const members = ["a", "b", "c"];

  test("dials and rings are split between members", () => {
    expect(puzzleControls(members, "b")).toEqual([1]);
    expect(puzzleControls(["a", "b"], "a")).toEqual([0, 2]);
    expect(puzzleControls(["a"], "a")).toEqual([0, 1, 2]);
    const dials = createPuzzle("dials", members);
    expect(puzzleClues(dials, members, "a")).toHaveLength(1);
    expect(puzzleClues(dials, ["a"], "a")).toHaveLength(3);
  });

  test("stations succeed only when exactly the ordered stations are manned", () => {
    const p = createPuzzle("stations", members);
    let outcome = null;
    for (let i = 0; i < 5; i += 1) {
      const intents = Object.fromEntries(members.map((id, index) => [id, { type: "station", key: p.order.need[index] || null }]));
      outcome = resolvePuzzle(p, intents, members).outcome;
    }
    expect(outcome).toBe("solved");

    const q = createPuzzle("stations", members);
    for (let i = 0; i < 3; i += 1) {
      const stray = Object.keys(STATIONS).find((key) => !q.order.need.includes(key));
      const intents = { a: { type: "station", key: stray || null } };
      outcome = resolvePuzzle(q, intents, members).outcome;
    }
    expect(outcome).toBe("failed");
  });

  test("dials need every member's dial right in the same round", () => {
    const p = createPuzzle("dials", members);
    const set = (values) => Object.fromEntries(members.map((id) => [id, { type: "dial", values }]));
    const wrong = p.solution.map((v) => (v + 1) % 6);
    for (let i = 0; i < 5; i += 1) expect(resolvePuzzle(p, set({ ...wrong }), members).outcome).toBeNull();
    expect(p.last).toBe(0);
    expect(resolvePuzzle(p, set({ ...p.solution }), members).outcome).toBe("solved");
    const q = createPuzzle("dials", members);
    for (let i = 0; i < 5; i += 1) resolvePuzzle(q, set({ ...q.solution.map((v) => (v + 1) % 6) }), members);
    expect(resolvePuzzle(q, {}, members).outcome).toBe("failed");
  });

  test("ring turns drag the next ring and can always be solved", () => {
    const p = createPuzzle("rings", members);
    p.offsets = [3, 0, 0];
    // Turning ring I by 5 sets I to 0 but drags ring II by 5; ring II turns 3 more to reach 0 and drags ring III.
    resolvePuzzle(p, { a: { type: "ring", turns: { 0: 5 } } }, members);
    expect(p.offsets).toEqual([0, 5, 0]);
    const q = createPuzzle("rings", members);
    const turns = solveRings(q.offsets, q.notches);
    const intents = Object.fromEntries(members.map((id) => [id, { type: "ring", turns: { ...turns } }]));
    expect(resolvePuzzle(q, intents, members).outcome).toBe("solved");
    const r = createPuzzle("rings", members);
    let outcome = null;
    for (let i = 0; i < 6; i += 1) outcome = resolvePuzzle(r, {}, members).outcome;
    expect(outcome).toBe("failed");
  });
});

describe("group dungeon runs", () => {

  test("a run starts at stage 1 with a 15 minute deadline", () => {
    const run = createGroupRun({ id: "r1", dungeonId: "tidewrack", members: ["a", "b"], snapshots: snapshots(), now: 0, actor: "a" });
    expect(run.deadline).toBe(GROUP_RUN_MS);
    expect(run.stage).toBe(0);
    expect(run.combat.enemies.length).toBeGreaterThan(0);
    expect(run.party.a.stats.health).toBe(run.party.a.stats.maxHealth);
  });

  test("intents are only counted for the current round and stage", () => {
    const run = createGroupRun({ id: "r1", dungeonId: "tidewrack", members: ["a", "b"], snapshots: snapshots(), now: 0, actor: "a" });
    const base = { run: "r1", round: 1, stage: 0, type: "defend" };
    expect(allIntentsIn(run, { a: base })).toBe(false);
    expect(allIntentsIn(run, { a: base, b: { ...base, round: 2 } })).toBe(false);
    expect(allIntentsIn(run, { a: base, b: base })).toBe(true);
  });

  test("a wipe respawns the party at the checkpoint and costs 2 minutes", () => {
    const run = createGroupRun({ id: "r1", dungeonId: "tidewrack", members: ["a", "b"], snapshots: snapshots(), now: 0, actor: "a" });
    for (const m of Object.values(run.party)) m.stats.health = 1;
    for (const e of run.combat.enemies) e.attack = [100000, 100000];
    const spy = jest.spyOn(Math, "random").mockReturnValue(0.99);
    resolveRunRound(run, {}, 1000);
    spy.mockRestore();
    expect(run.wipes).toBe(1);
    expect(run.deadline).toBe(GROUP_RUN_MS - GROUP_WIPE_PENALTY_MS);
    expect(run.stage).toBe(0);
    expect(Object.values(run.party).every((m) => !m.downed && m.stats.health === m.stats.maxHealth)).toBe(true);
    expect(run.log[0]).toContain("The whole party has fallen");
    expect(run.log.some((line) => line.includes("enters"))).toBe(false);
  });

  test("clearing a stage moves to the next and revives the fallen at half health", () => {
    const run = createGroupRun({ id: "r1", dungeonId: "tidewrack", members: ["a", "b"], snapshots: snapshots(), now: 0, actor: "a" });
    run.party.b.downed = true;
    run.party.b.stats.health = 0;
    run.combat.waves = [run.combat.waves[0]];
    for (const e of run.combat.enemies) e.hp = 1;
    const target = run.combat.enemies[0].uid;
    const base = { run: "r1", round: 1, stage: 0 };
    resolveRunRound(run, { a: { ...base, type: "melee", target } }, 1000);
    if (run.stage === 0) resolveRunRound(run, { a: { ...base, round: 2, type: "melee", target: run.combat.enemies.find((e) => !e.dead)?.uid } }, 2000);
    expect(run.stage).toBe(1);
    expect(run.puzzle.kind).toBe("stations");
    expect(run.party.b.downed).toBe(false);
    expect(run.party.b.stats.health).toBe(Math.round(run.party.b.stats.maxHealth * 0.5));
    expect(run.log[0]).toContain("Stage 1 cleared");
    expect(run.log.some((line) => line.includes("enters") || line.startsWith("— Round"))).toBe(false);
  });

  test("the run fails when the timer runs out", () => {
    const run = createGroupRun({ id: "r1", dungeonId: "chronoforge", members: ["a"], snapshots: snapshots(), now: 0, actor: "a" });
    expect(failRunOnTimeout(run, GROUP_RUN_MS - 1)).toBeNull();
    failRunOnTimeout(run, GROUP_RUN_MS);
    expect(run.status).toBe("failed");
    expect(run.reason).toBe("timeout");
  });

  test("the run is abandoned when every member leaves", () => {
    const run = createGroupRun({ id: "r1", dungeonId: "starless", members: ["a", "b"], snapshots: snapshots(), now: 0, actor: "a" });
    markLeft(run, ["b"], 5);
    expect(run.status).toBe("active");
    expect(run.party.b.downed).toBe(true);
    markLeft(run, ["a"], 6);
    expect(run.status).toBe("failed");
  });

  test("rewards are claimed once and consumables used in the run are deducted", () => {
    const players = snapshots();
    const run = createGroupRun({ id: "r1", dungeonId: "tidewrack", members: ["a", "b"], snapshots: players, now: 0, actor: "a" });
    run.party.a.spent = { healthPotion: 2 };
    run.status = "cleared";
    run.stagesCleared = 4;
    run.endedAt = 10;
    const claim = reconcileGroupRun(players.a, run, "a");
    expect(claim.patch.consumables.healthPotion).toBe(1);
    expect(claim.patch.astra).toBeGreaterThan(0);
    expect(claim.patch.inventory.length).toBeGreaterThanOrEqual(2);
    expect(claim.patch.records.groupDungeonsCleared).toBe(1);
    expect(claim.patch.groupDungeonClaims.r1).toBe(10);
    expect(reconcileGroupRun({ ...players.a, ...claim.patch }, run, "a")).toBeNull();
  });

  test("a failed run only deducts items and gives partial exp", () => {
    const players = snapshots();
    const run = createGroupRun({ id: "r2", dungeonId: "tidewrack", members: ["a"], snapshots: players, now: 0, actor: "a" });
    run.status = "failed";
    run.stagesCleared = 1;
    const claim = reconcileGroupRun(players.a, run, "a");
    expect(claim.patch.inventory).toBeUndefined();
    expect(claim.patch.astra).toBe(Math.round(40 * 450 * 0.15));
  });

  test("the puzzle stage is resolved through member intents", () => {
    const run = createGroupRun({ id: "r1", dungeonId: "chronoforge", members: ["a", "b"], snapshots: snapshots(), now: 0, actor: "a" });
    run.stage = 1;
    run.combat = null;
    run.puzzle = { kind: "dials", solution: [1, 2, 3], values: [0, 0, 0], clues: ["x", "y", "z"], attempts: 0, maxAttempts: 6 };
    const base = { run: "r1", round: run.round, stage: 1, type: "dial" };
    // a controls dials I and III, b controls dial II
    resolveRunRound(run, { a: { ...base, values: { 0: 1, 2: 3 } }, b: { ...base, values: { 1: 2 } } }, 1000);
    expect(run.stage).toBe(2);
    expect(run.combat.enemies[0].name).toBe("Paradox Twin");
    expect(Object.values(run.party).every((m) => m.statuses.some((st) => st.id === "temporalRot"))).toBe(true);
  });
});

describe("group dungeon balance (trio 5 levels above the dungeon)", () => {
  const RUNS = 12;
  for (const dungeonId of Object.keys(GROUP_DUNGEONS)) {
    test(`${dungeonId} is beatable within the timer`, () => {
      const results = Array.from({ length: RUNS }, () => simulate(dungeonId));
      const cleared = results.filter((r) => r.status === "cleared").length;
      const avg = (f) => Math.round((results.reduce((s, r) => s + f(r), 0) / RUNS) * 10) / 10;
      const summary = {
        cleared: `${cleared}/${RUNS}`,
        wipes: avg((r) => r.wipes),
        rounds: [0, 1, 2, 3].map((i) => avg((r) => r.stageRounds[i])),
        stageWipes: [0, 1, 2, 3].map((i) => avg((r) => r.stageWipes[i])),
        minutes: avg((r) => r.minutes),
        failedAt: results.filter((r) => r.status !== "cleared").map((r) => r.endStage + 1),
      };
      if (process.env.GROUP_BALANCE) console.log(dungeonId, JSON.stringify(summary));
      // A competent trio should usually clear, but the dungeon should still be able to wipe them.
      expect(cleared).toBeGreaterThanOrEqual(Math.ceil(RUNS * 0.5));
      expect(summary.rounds[3]).toBeGreaterThanOrEqual(6);
    });
  }
});
