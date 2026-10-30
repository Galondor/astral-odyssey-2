import { createUniqueItem, generateRandomSlotItem } from "../items/items";
import { MATERIALS, addToMaterials } from "../items/materials";
import { expForLevel, gainExp } from "../character/stats";
import { updateRecords } from "../character/records";
import { STATUSES } from "../combat/statuses";
import {
  GROUP_ROUND_MS,
  createGroupCombat,
  createGroupMember,
  normalizeCombat,
  refreshMembers,
  resolveGroupRound,
} from "../combat/groupCombat";
import { UNIQUES } from "./dungeonData";
import { GROUP_DUNGEONS, GROUP_RUN_MS, GROUP_WIPE_PENALTY_MS } from "./groupDungeonData";
import { PUZZLE_ROUND_MS, createPuzzle, resolvePuzzle } from "./groupPuzzles";

/*
 Group dungeon runs. Pure functions over the run JSON the party leader stores at groupParties/<id>/run.
 run = {
   id, dungeon, revision, actor, status: "active" | "cleared" | "failed", reason,
   startedAt, deadline (startedAt + 15 min, minus 2 min per wipe), endedAt,
   members: [ids in join order], names: { id: name }, left: { id: true },
   stage (0-3), checkpoint, wipes, stagesCleared,
   round, roundDeadline, party: { id: member } (see groupCombat.createGroupMember),
   combat (fight stages, without its `players`, which live in party), puzzle (puzzle stage), log: [lines]
 }
 Every stage boundary is a checkpoint: a wipe or failed puzzle restarts the current stage at full health and costs
 2 minutes. Clearing a stage revives the fallen at half health. Rewards are claimed by each member's own client
 (reconcileGroupRun), keyed by run id so they are only granted once.
*/

export const GROUP_LOG_LIMIT = 80;
export const GROUP_LEVEL_OFFSET = 5;
export const GROUP_UNIQUE_DROP_CHANCE = 0.05;
export const GROUP_RUNE_CHANCE = 0.3;
const STAGE_REST_HEAL = 0.3;
const CLAIM_HISTORY = 20;

// Enemies are built for a trio GROUP_LEVEL_OFFSET levels above the dungeon.
const BASE_HP = 14;
const BASE_ATTACK = 1.1;
const BASE_DEFENSE = 0.55;
const BASE_SPEED = 4;
// Tuned with the trio balance simulation in src/tests/world/groupDungeons.test.js (Rare gear, 5 levels above).
export const GROUP_TIER = {
  basic: { label: "Basic", color: "#0070dd", hp: 2.6, atk: 2.4, def: 3.2, spd: 1, crit: 0.15, stunResist: 0.25, dotResist: 0.8 },
  elite: { label: "Elite", color: "#a335ee", hp: 12, atk: 4.2, def: 4.5, spd: 1.1, crit: 0.2, stunResist: 0.6, dotResist: 0.6 },
  boss: { label: "Boss", color: "#ff2a2a", hp: 22, atk: 4.8, def: 4.5, spd: 1.15, crit: 0.25, stunResist: 1, dotResist: 0.5 },
};

const rnd = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const clone = (value) => JSON.parse(JSON.stringify(value));
const trimLog = (lines) => lines.slice(-GROUP_LOG_LIMIT);

export const getGroupDungeon = (id) => GROUP_DUNGEONS[id] || null;
export const groupEnemyLevel = (dungeon) => dungeon.level + GROUP_LEVEL_OFFSET;

export function buildGroupEnemy(dungeonId, tplId) {
  const dungeon = GROUP_DUNGEONS[dungeonId];
  const template = dungeon?.enemies[tplId];
  if (!template) throw new Error(`Unknown group enemy ${tplId}`);
  const t = GROUP_TIER[template.tier];
  const m = { hp: 1, atk: 1, def: 1, spd: 1, ...template.mod };
  const scale = { hp: 1, atk: 1, ...dungeon.scale };
  const level = groupEnemyLevel(dungeon);
  const attack = BASE_ATTACK * level * t.atk * m.atk * scale.atk + 3;
  return {
    tpl: tplId,
    name: template.name,
    tier: template.tier,
    tierLabel: t.label,
    tierColor: t.color,
    level,
    maxHp: Math.round(BASE_HP * level * t.hp * m.hp * scale.hp),
    attack: [Math.round(attack * 0.75), Math.round(attack * 1.25)],
    defense: Math.round(BASE_DEFENSE * level * t.def * m.def),
    speed: Math.round((BASE_SPEED + 0.35 * level) * t.spd * m.spd),
    critical: t.crit,
    stunResist: t.stunResist,
    dotResist: t.dotResist,
    abilities: clone(template.abilities || []),
    phases: clone(template.phases || []),
    ...(template.immune ? { immune: template.immune } : {}),
    ...(template.immuneCycle ? { immuneCycle: template.immuneCycle } : {}),
    ...(template.corruptionReflect ? { corruptionReflect: true } : {}),
    ...(template.proper ? { proper: true } : {}),
  };
}

const spawnerFor = (run) => ({ spawn: (tpl) => buildGroupEnemy(run.dungeon, tpl) });

// Firebase drops empty arrays/objects; restore the run's shape and reattach the party to its combat.
export function normalizeRun(run) {
  if (!run) return null;
  run.members = run.members || [];
  run.names = run.names || {};
  run.left = run.left || {};
  run.party = run.party || {};
  run.log = run.log || [];
  normalizeCombat({ players: run.party, enemies: [] });
  if (run.combat) {
    run.combat.players = run.party;
    normalizeCombat(run.combat);
  }
  if (run.puzzle) {
    if (run.puzzle.values) run.puzzle.values = [0, 1, 2].map((i) => run.puzzle.values[i] || 0);
    if (run.puzzle.offsets) run.puzzle.offsets = [0, 1, 2].map((i) => run.puzzle.offsets[i] || 0);
  }
  for (const m of Object.values(run.party)) m.downed = !!m.downed;
  return run;
}

// JSON for the database (the combat's players are the party, so they're stored once).
export function serializeRun(run) {
  const out = { ...run };
  if (run.combat) {
    const { players, ...combat } = run.combat;
    out.combat = combat;
  }
  return clone(out);
}

export const activeMembers = (run) => run.members.filter((id) => !run.left[id]);
export const currentStage = (run) => GROUP_DUNGEONS[run.dungeon].stages[run.stage];
export const roundLength = (run) => (run.puzzle ? PUZZLE_ROUND_MS : GROUP_ROUND_MS);

const keepLeftDown = (run) => {
  for (const id of Object.keys(run.left)) {
    const m = run.party[id];
    if (m) {
      m.downed = true;
      m.stats.health = 0;
    }
  }
};

// `carry` is the log the stage starts with; stage changes pass only the outcome lines so the log clears after each fight.
function startStage(run, index, now, carry = run.log) {
  const dungeon = GROUP_DUNGEONS[run.dungeon];
  const stage = dungeon.stages[index];
  run.stage = index;
  run.checkpoint = index;
  run.round = 1;
  run.roundDeadline = now + (stage.kind === "puzzle" ? PUZZLE_ROUND_MS : GROUP_ROUND_MS);
  run.combat = null;
  run.puzzle = null;
  run.log = trimLog([...carry, `[gold]Stage ${index + 1}: ${stage.name}[/gold]`, stage.intro]);
  if (stage.kind === "puzzle") {
    run.puzzle = createPuzzle(stage.puzzle, activeMembers(run));
    if (run.puzzle.order) run.log = trimLog([...run.log, `The bosun bellows: ${run.puzzle.order.text}`]);
  } else {
    run.combat = createGroupCombat(run.party, stage.fight, spawnerFor(run).spawn);
    run.party = run.combat.players;
    if (stage.fight.startStatus)
      run.log = trimLog([...run.log, `[red]Everyone is afflicted with ${STATUSES[stage.fight.startStatus].name}![/red]`]);
  }
  return run;
}

// snapshots: { id: player } (the saved character of each member when the run starts).
export function createGroupRun({ id, dungeonId, members, snapshots, now, actor }) {
  const dungeon = GROUP_DUNGEONS[dungeonId];
  if (!dungeon) throw new Error("Unknown group dungeon.");
  if (!members.length || members.length > 3) throw new Error("A group needs 1 to 3 members.");
  const party = {};
  const names = {};
  for (const memberId of members) {
    const player = snapshots[memberId];
    if (!player?.stats) throw new Error("A party member is not ready.");
    party[memberId] = createGroupMember(memberId, player);
    names[memberId] = player.name;
  }
  const run = {
    id,
    dungeon: dungeonId,
    revision: 1,
    actor,
    status: "active",
    reason: null,
    startedAt: now,
    deadline: now + GROUP_RUN_MS,
    endedAt: null,
    members: [...members],
    names,
    left: {},
    stage: 0,
    checkpoint: 0,
    wipes: 0,
    stagesCleared: 0,
    round: 1,
    roundDeadline: now,
    party,
    combat: null,
    puzzle: null,
    log: [`[gold]The party enters ${dungeon.name}. You have ${GROUP_RUN_MS / 60000} minutes.[/gold]`],
  };
  return startStage(run, 0, now);
}

const finish = (run, status, reason, now, lines = []) => {
  run.status = status;
  run.reason = reason;
  run.endedAt = now;
  run.roundDeadline = null;
  run.log = trimLog([...run.log, ...lines]);
  for (const m of Object.values(run.party)) {
    m.defending = false;
    m.guarding = null;
  }
  return run;
};

export function failRunOnTimeout(run, now) {
  if (run.status !== "active" || now < run.deadline) return null;
  return finish(run, "failed", "timeout", now, ["[red]The dungeon's time runs out. The instance collapses and the party is cast out![/red]"]);
}

// Members who left the party (or were kicked) count as fallen for the rest of the run.
export function markLeft(run, ids, now) {
  let changed = false;
  for (const id of ids) {
    if (!run.members.includes(id) || run.left[id]) continue;
    run.left[id] = true;
    changed = true;
    run.log = trimLog([...run.log, `${run.names[id] || "A member"} has left the dungeon.`]);
  }
  if (!changed) return false;
  keepLeftDown(run);
  if (!activeMembers(run).length) finish(run, "failed", "abandoned", now, ["[red]Everyone has left. The run is over.[/red]"]);
  return true;
}

function respawn(run, now, lines) {
  run.wipes += 1;
  run.deadline -= GROUP_WIPE_PENALTY_MS;
  const carry = [
    ...lines,
    `[red]The party respawns at the checkpoint (Stage ${run.checkpoint + 1}). The dungeon timer loses 2 minutes.[/red]`,
  ];
  if (now >= run.deadline) {
    run.log = trimLog([...run.log, ...carry]);
    return failRunOnTimeout(run, now);
  }
  refreshMembers(run.party, { revive: true, full: true });
  keepLeftDown(run);
  return startStage(run, run.checkpoint, now, carry);
}

function clearStage(run, now) {
  run.stagesCleared = Math.max(run.stagesCleared, run.stage + 1);
  const dungeon = GROUP_DUNGEONS[run.dungeon];
  if (run.stage >= dungeon.stages.length - 1) {
    run.combat = null;
    run.puzzle = null;
    return finish(run, "cleared", "victory", now, [
      `[gold]${dungeon.name} is cleared! Rewards are sent to every member who stayed to the end.[/gold]`,
    ]);
  }
  const fallen = Object.values(run.party).filter((m) => m.downed && !run.left[m.id]);
  for (const m of Object.values(run.party))
    if (!m.downed) m.stats.health = Math.min(m.stats.maxHealth, m.stats.health + Math.round(m.stats.maxHealth * STAGE_REST_HEAL));
  refreshMembers(run.party, { revive: true, full: false });
  keepLeftDown(run);
  const lines = [`[gold]Stage ${run.stage + 1} cleared! Checkpoint reached.[/gold]`];
  if (fallen.length) lines.push(`${fallen.map((m) => m.name).join(", ")} ${fallen.length === 1 ? "is" : "are"} revived at half health.`);
  return startStage(run, run.stage + 1, now, lines);
}

// True once every member who can act has locked in an intent for this round.
export function allIntentsIn(run, intents) {
  if (run.status !== "active") return false;
  const waiting = activeMembers(run).filter((id) => run.puzzle || !run.party[id]?.downed);
  return waiting.every((id) => {
    const intent = intents?.[id];
    return intent && intent.run === run.id && intent.round === run.round && intent.stage === run.stage;
  });
}

// Resolves the current round of the current stage. Mutates and returns the run.
export function resolveRunRound(run, rawIntents, now) {
  normalizeRun(run);
  if (run.status !== "active") return run;
  if (failRunOnTimeout(run, now)) return run;
  const intents = {};
  for (const id of activeMembers(run)) {
    const intent = rawIntents?.[id];
    if (intent && intent.run === run.id && intent.round === run.round && intent.stage === run.stage) intents[id] = intent;
  }
  if (run.puzzle) {
    const result = resolvePuzzle(run.puzzle, intents, activeMembers(run), run.names);
    run.log = trimLog([...run.log, `— Round ${run.round} —`, ...result.log]);
    if (result.outcome === "solved") return clearStage(run, now);
    if (result.outcome === "failed") return respawn(run, now, ["[red]The puzzle defeats the party.[/red]"]);
    run.round += 1;
    run.roundDeadline = now + PUZZLE_ROUND_MS;
    return run;
  }
  const result = resolveGroupRound(run.combat, intents, spawnerFor(run));
  run.combat = result.combat;
  run.party = run.combat.players;
  run.log = trimLog([...run.log, ...result.log]);
  if (result.outcome === "victory") return clearStage(run, now);
  if (result.outcome === "wipe") return respawn(run, now, ["[red]The whole party has fallen![/red]"]);
  run.round = run.combat.round;
  run.roundDeadline = now + GROUP_ROUND_MS;
  return run;
}

// ---- Rewards ----

export function groupRunRewards(dungeon, level, stagesCleared, cleared) {
  const share = cleared ? 1 : Math.min(0.45, stagesCleared * 0.15);
  return {
    exp: Math.round(expForLevel(level) * 0.4 * share),
    astra: Math.round(dungeon.level * 450 * share),
  };
}

/*
 Claims a finished run for this character: deducts consumables used during the run and grants rewards once.
 Returns { patch, lines } or null when there is nothing to claim. Rolls loot, so call it inside commitPlayerChange.
 { leaving: true } settles a still-active run for a member who quits it: consumables are deducted, no rewards.
*/
export function reconcileGroupRun(player, run, identity, { leaving = false } = {}) {
  if (!player || !run || (run.status === "active" && !leaving) || !run.members?.includes(identity)) return null;
  const claims = player.groupDungeonClaims || {};
  if (claims[run.id]) return null;
  const dungeon = GROUP_DUNGEONS[run.dungeon];
  const member = run.party?.[identity];
  if (!dungeon || !member) return null;
  const lines = [];
  const consumables = { ...(player.consumables || {}) };
  for (const [key, count] of Object.entries(member.spent || {})) {
    const used = Math.min(Math.max(0, Math.floor(count)), consumables[key] || 0);
    if (!used) continue;
    consumables[key] -= used;
    if (!consumables[key]) delete consumables[key];
  }
  const patch = { consumables };
  const stayed = !leaving && !run.left?.[identity];
  const cleared = run.status === "cleared" && stayed;
  const { exp, astra } = stayed ? groupRunRewards(dungeon, player.level || 1, run.stagesCleared || 0, cleared) : { exp: 0, astra: 0 };
  if (exp || astra) {
    patch.astra = (player.astra || 0) + astra;
    const leveled = gainExp({ ...player, ...patch }, exp);
    Object.assign(patch, leveled.patch);
    lines.push(`${cleared ? `[gold]${dungeon.name} cleared![/gold]` : `${dungeon.name} failed.`} You gain ${exp} exp and ${astra} {{astra|astra}}.`, ...leveled.messages);
  }
  if (cleared) {
    const drops = {
      [dungeon.materials.basic]: rnd(3, 5),
      [dungeon.materials.elite]: rnd(1, 2),
      ...(Math.random() < 0.35 ? { [dungeon.materials.boss]: 1 } : {}),
    };
    patch.materials = addToMaterials(player.materials, drops);
    lines.push(`Materials gained: ${Object.entries(drops).map(([k, n]) => `{{${n}x ${MATERIALS[k].name}|material:${k}}}`).join(", ")}.`);
    const inventory = [...(player.inventory || [])];
    for (let i = 0; i < 2; i += 1) {
      const item = generateRandomSlotItem(i === 0 ? 4 : 3);
      if (item) {
        inventory.push(item);
        lines.push(`You receive {{${item.name}|item:${item.id}}}!`);
      }
    }
    for (const rune of ["architectsRune", "runeOfUnpredictability"])
      if (Math.random() < GROUP_RUNE_CHANCE) {
        patch.consumables[rune] = (patch.consumables[rune] || 0) + 1;
        lines.push(`You receive a {{${rune === "architectsRune" ? "Architect's Rune" : "Rune of Unpredictability"}|consumable:${rune}}}!`);
      }
    const unique = UNIQUES[dungeon.unique];
    if (unique && Math.random() < GROUP_UNIQUE_DROP_CHANCE) {
      const item = createUniqueItem(unique, Math.max(dungeon.level, player.level || 1));
      if (item) {
        inventory.push(item);
        lines.push(`[red]A glint of crimson in the boss's remains...[/red] {{${item.name}|item:${item.id}}} drops, what a miracle!`);
      }
    }
    patch.inventory = inventory;
    updateRecords(player, patch, { increments: { groupDungeonsCleared: 1 } });
  }
  const history = Object.entries({ ...claims, [run.id]: run.endedAt || Date.now() })
    .sort((a, b) => b[1] - a[1])
    .slice(0, CLAIM_HISTORY);
  patch.groupDungeonClaims = Object.fromEntries(history);
  return { patch, lines };
}
