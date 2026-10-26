import { getPlayer, setPlayer } from "../character/player";
import {
  applyDeathPenalties,
  endCombat,
  getEnemy,
  startCombat,
  takeOpeningReplies,
} from "../combat/combat";
import { createUniqueItem } from "../items/items";
import { MATERIALS, addToMaterials } from "../items/materials";
import { expForLevel } from "../character/stats";
import { getEffectiveLevel } from "../combat/enemies";
import { DUNGEON_TYPES, DUNGEON_TYPE_IDS, TRAP_COUNTERS, UNIQUES, UNIQUE_DROP_CHANCE } from "./dungeonData";

/*
 Solo dungeons.
 Every 30 minutes the board offers 3 new dungeons rated near the player's level (minimum 12). A dungeon is a fixed chain:
   Puzzle/Challenge -> 3 Basic enemies -> Puzzle/Challenge -> Elite -> Puzzle/Challenge -> Boss
 Entering locks the player out of town and travel. They have 5 minutes; dying or running out of time ends the run.
 The saved run lives in player.dungeon, the board in player.dungeonBoard:
   run   = { offerId, type, level, name, steps, index, startedAt, deadline, pz }
   steps = [{ kind: "puzzle", puzzle: index into the type's puzzles } | { kind: "fight", tier, tpl: enemy template id }]
   pz    = state of the current puzzle/challenge (null during a fight)
*/
export const DUNGEON_REFRESH_MS = 30 * 60 * 1000;
export const DUNGEON_TIME_LIMIT_MS = 5 * 60 * 1000;
export const DUNGEON_REROLL_COST = 300_000;
export const DUNGEON_MIN_LEVEL = 12;
export const NAME_ELIXIR_DROP_CHANCE = 0.05;
export const ARCHITECTS_RUNE_DROP_CHANCE = { elite: 0.05, boss: 0.1 };
const OFFER_COUNT = 3;
const BASIC_COUNT = 3;
const SWAP_CHANCE = 0.15;

// Dungeon enemies are built from the dungeon rating rather than the overworld curve, and hit much harder.
const BASE_HP = 14;
const BASE_ATTACK = 1.1;
const BASE_DEFENSE = 0.55;
const BASE_SPEED = 4;
const TIER = {
  basic: { label: "Basic", color: "#0070dd", hp: 4, atk: 3.6, def: 5.5, spd: 1, crit: 0.15, exp: 0.02, astra: 10, dropChance: 0.3, minRarity: 1, stunResist: 0.25, dotResist: 0.8 },
  elite: { label: "Elite", color: "#a335ee", hp: 6, atk: 5, def: 8.5, spd: 1.1, crit: 0.25, exp: 0.06, astra: 30, dropChance: 0.75, minRarity: 2, stunResist: 0.6, dotResist: 0.6 },
  boss: { label: "Boss", color: "#ff2a2a", hp: 10, atk: 7.2, def: 10.5, spd: 1.15, crit: 0.35, exp: 0.14, astra: 70, dropChance: 1, minRarity: 4, stunResist: 1, dotResist: 0.5 },
};
const PUZZLE_ASTRA = 15;
const MISTAKE_DAMAGE = [0.2, 0.25, 0.35, 0.45];
const LOCK_GUESSES = 6;
const LOCK_DIGITS = [1, 2, 3, 4, 5, 6];

const rnd = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const percent = (n) => `${Math.round(n * 100)}%`;
const shuffle = (list) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// ---- Board ----

const findTemplate = (typeId, id) => {
  const type = DUNGEON_TYPES[typeId];
  return [...type.basics, ...type.elites, ...type.bosses].find((t) => t.id === id);
};

const buildOffer = (typeId, level, id) => {
  const type = DUNGEON_TYPES[typeId];
  const puzzles = shuffle(type.puzzles.map((_, i) => i)).slice(0, 3);
  const basics = shuffle(type.basics).slice(0, BASIC_COUNT);
  const puzzle = (n) => ({ kind: "puzzle", puzzle: puzzles[n] });
  const fight = (tier, tpl) => ({ kind: "fight", tier, tpl: tpl.id });
  const elite = pick(type.elites);
  const boss = pick(type.bosses);
  // Sometimes an early puzzle is swapped for an extra elite. The stage before the boss always stays a puzzle.
  const extra = type.elites.find((e) => e.id !== elite.id) || elite;
  const swap = (n) => (Math.random() < SWAP_CHANCE ? fight("elite", extra) : puzzle(n));
  return {
    id,
    type: typeId,
    level,
    name: type.name,
    boss: boss.id,
    elite: elite.id,
    steps: [swap(0), ...basics.map((b) => fight("basic", b)), swap(1), fight("elite", elite), puzzle(2), fight("boss", boss)],
    cleared: false,
  };
};

const generateOffers = (playerLevel, slot, gearScore = 0) => {
  const baseLevel = getEffectiveLevel(playerLevel, gearScore);
  const types = shuffle(DUNGEON_TYPE_IDS).slice(0, OFFER_COUNT);
  return types.map((typeId, i) => {
    const level = Math.max(DUNGEON_MIN_LEVEL, baseLevel + rnd(-3, 5));
    return buildOffer(typeId, level, `${slot}-${i}`);
  });
};

export const getBoardSlot = () => Math.floor(Date.now() / DUNGEON_REFRESH_MS);
export const getBoardRefreshMs = () => (getBoardSlot() + 1) * DUNGEON_REFRESH_MS - Date.now();

export const getBoard = (passed) => {
  // Always read the saved player: a screen re-rendering on its own timer holds a stale copy
  const player = getPlayer() || passed;
  const slot = getBoardSlot();
  const saved = player?.dungeonBoard;
  if (saved?.slot === slot && Array.isArray(saved.offers)) return saved;
  const board = { slot, offers: generateOffers(Math.max(1, player?.level || 1), slot, player?.stats?.gearScore || 0) };
  if (player) setPlayer({ dungeonBoard: board });
  return board;
};

export const rerollDungeons = () => {
  const player = getPlayer();
  if (!player) return { ok: false, message: "No character loaded." };
  if (player.dungeon) return { ok: false, message: "You cannot reroll dungeons while inside one." };
  if ((player.level || 1) < DUNGEON_MIN_LEVEL) return { ok: false, message: `Dungeons unlock at level ${DUNGEON_MIN_LEVEL}.` };
  if (getEnemy()) return { ok: false, message: "Finish your fight first." };
  if ((player.astra || 0) < DUNGEON_REROLL_COST)
    return { ok: false, message: `You need ${DUNGEON_REROLL_COST.toLocaleString()} astra to roll new dungeons.` };

  const currentBoard = getBoard(player);
  const slot = getBoardSlot();
  const generation = (currentBoard.generation || 0) + 1;
  const board = {
    slot,
    generation,
    offers: generateOffers(
      Math.max(1, player.level || 1),
      `${slot}-reroll-${generation}`,
      player.stats?.gearScore || 0,
    ),
  };
  setPlayer({ astra: player.astra - DUNGEON_REROLL_COST, dungeonBoard: board });
  return { ok: true };
};

// ---- Runs ----

// Firebase drops empty arrays when saving, so restore them after a reload.
const withDefaults = (run) => {
  if (!run?.pz) return run;
  const pz = { ...run.pz };
  if (pz.kind === "order") pz.picked = pz.picked || [];
  if (pz.kind === "lock") {
    pz.guesses = pz.guesses || [];
    pz.cur = pz.cur || [];
  }
  if (pz.kind === "scales") pz.selected = pz.selected || [];
  if (pz.kind === "path") pz.visited = pz.visited || [];
  if (pz.kind === "pairs") {
    pz.open = pz.open || [];
    pz.matched = pz.matched || [];
  }
  return { ...run, pz };
};

export const getRun = (player = getPlayer()) => withDefaults(player?.dungeon) || null;
export const isInDungeon = () => !!getRun();
export const getTimeLeftMs = (run = getRun()) => (run ? Math.max(0, run.deadline - Date.now()) : 0);
export const formatTime = (ms) => {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};
const currentStep = (run) => run?.steps?.[run.index] || null;

export const describeStep = (run, step) =>
  step.kind === "puzzle"
    ? DUNGEON_TYPES[run.type].puzzles[step.puzzle].name
    : `${findTemplate(run.type, step.tpl).name} (${TIER[step.tier].label})`;

// What the run looks like at a given stage, for the status panel.
export const getStages = (run) =>
  run.steps.map((step, i) => ({
    label: describeStep(run, step),
    kind: step.kind === "puzzle" ? "Puzzle" : TIER[step.tier].label,
    state: i < run.index ? "done" : i === run.index ? "current" : "todo",
  }));

export const describeOffer = (offer) => {
  const type = DUNGEON_TYPES[offer.type];
  const boss = findTemplate(offer.type, offer.boss);
  return {
    type,
    boss: boss.name,
    elite: findTemplate(offer.type, offer.elite).name,
    unique: UNIQUES[boss.unique],
    challenges: offer.steps.filter((s) => s.kind === "puzzle").map((s) => type.puzzles[s.puzzle].name),
  };
};

export function startDungeon(offerId) {
  const player = getPlayer();
  if (!player) return { ok: false, message: "No character loaded." };
  if (player.dungeon) return { ok: false, message: "You are already inside a dungeon." };
  if ((player.level || 1) < DUNGEON_MIN_LEVEL) return { ok: false, message: `Dungeons unlock at level ${DUNGEON_MIN_LEVEL}.` };
  if (getEnemy()) return { ok: false, message: "Finish your fight first." };
  const offer = getBoard(player).offers.find((o) => o.id === offerId);
  if (!offer) return { ok: false, message: "That dungeon has collapsed. Check the board again." };
  if (offer.cleared) return { ok: false, message: "You have already cleared this dungeon." };
  const now = Date.now();
  const run = prepareStep({
    offerId: offer.id,
    type: offer.type,
    level: offer.level,
    name: offer.name,
    steps: offer.steps,
    index: 0,
    startedAt: now,
    deadline: now + DUNGEON_TIME_LIMIT_MS,
    pz: null,
  });
  setPlayer({ dungeon: run });
  return { ok: true };
}

// Ends the run because the time ran out. Returns a message when that happened, otherwise null.
export function expireIfNeeded() {
  const run = getRun();
  if (!run || Date.now() < run.deadline) return null;
  endCombat();
  setPlayer({ dungeon: null });
  return "[red]Time is up![/red] The dungeon seals itself and the walls shove you out. Your run has failed and must be started again.";
}

// Ends the run after the player's health reached zero outside of combat.
function failRun(message) {
  const p = getPlayer();
  const s = { ...p.stats };
  const patch = { dungeon: null };
  const reply = [message];
  applyDeathPenalties(p, s, reply, patch);
  reply.push("You are dragged out of the dungeon. Your run has failed and must be started again.");
  setPlayer({ ...patch, stats: s });
  return { reply, next: "menu", clearLog: true };
}

// Hurts the player by a fraction of max health. Returns { lost, died }.
function hurt(fraction) {
  const p = getPlayer();
  const s = { ...p.stats };
  const lost = Math.max(1, Math.round(s.maxHealth * fraction));
  s.health -= lost;
  if (s.health > 0) setPlayer({ stats: s });
  return { lost, died: s.health <= 0 };
}

const restore = (healthFraction, powerFraction = 0) => {
  const s = { ...getPlayer().stats };
  const healed = Math.min(s.maxHealth - s.health, Math.round(s.maxHealth * healthFraction));
  s.health += healed;
  s.power = Math.min(s.maxPower, s.power + Math.round(s.maxPower * powerFraction));
  setPlayer({ stats: s });
  return healed;
};

const grantAstra = (amount) => {
  setPlayer({ astra: (getPlayer().astra || 0) + amount });
  return amount;
};

// ---- Enemies ----

const buildEnemy = (run, step) => {
  const template = findTemplate(run.type, step.tpl);
  const t = TIER[step.tier];
  const mod = { hp: 1, atk: 1, def: 1, spd: 1, ...template.mod };
  const level = run.level;
  const attack = BASE_ATTACK * level * t.atk * mod.atk + 3;
  const levelExp = expForLevel(level);
  return {
    id: template.id,
    name: template.name,
    tier: step.tier,
    tierLabel: t.label,
    tierColor: t.color,
    region: "Dungeon",
    level,
    maxHp: Math.round(BASE_HP * level * t.hp * mod.hp),
    attack: [Math.round(attack * 0.75), Math.round(attack * 1.25)],
    defense: Math.round(BASE_DEFENSE * level * t.def * mod.def),
    speed: Math.round((BASE_SPEED + 0.35 * level) * t.spd * mod.spd),
    critical: t.crit,
    astra: Math.round(level * t.astra),
    exp: Math.round(levelExp * t.exp),
    abilities: template.abilities || [],
    phases: template.phases || [],
    drops: [
      ...(template.drops || []),
      { key: DUNGEON_TYPES[run.type].materials[step.tier], chance: 1, min: 1, max: 2 },
    ].map((drop) => {
      const rarity = MATERIALS[drop.key].tier;
      if (rarity === "legendary") return { ...drop, chance: 0.5, min: 1, max: 2 };
      if (rarity === "unique") return { ...drop, chance: 0.1, min: 1, max: 1 };
      return { ...drop, chance: drop.chance / 2, min: 1, max: Math.ceil(drop.max / 4) };
    }),
    dropChance: t.dropChance,
    minRarity: t.minRarity,
    dotResist: t.dotResist,
    stunResist: t.stunResist,
    materialAmount: 1,
    dungeon: true,
    onDefeat: (p, s, patch, replies) => onFightWon(p, s, patch, replies, template),
    onPlayerDefeat: (p, s, patch, replies) => {
      applyDeathPenalties(p, s, replies, patch);
      patch.dungeon = null;
      replies.push(
        "You collapse inside the dungeon and are dragged out. Your run has failed and must be started again.",
      );
    },
  };
};

// Runs when a dungeon enemy dies. `patch` is applied to the player right after.
function onFightWon(p, s, patch, replies, template) {
  const run = p.dungeon;
  if (!run) return;
  const step = currentStep(run);
  const runeChance = ARCHITECTS_RUNE_DROP_CHANCE[step?.tier];
  if (runeChance && Math.random() < runeChance) {
    const consumables = { ...(patch.consumables ?? p.consumables ?? {}) };
    consumables.architectsRune = (consumables.architectsRune || 0) + 1;
    patch.consumables = consumables;
    replies.push(`The ${step.tier} drops an Architect's Rune!`);
  }
  if (step?.tier !== "boss") {
    patch.dungeon = prepareStep({ ...run, index: run.index + 1 });
    return;
  }
  patch.dungeon = null;
  if (Math.random() < NAME_ELIXIR_DROP_CHANCE) {
    const consumables = { ...(patch.consumables ?? p.consumables ?? {}) };
    consumables.elixirOfNameChanging = (consumables.elixirOfNameChanging || 0) + 1;
    patch.consumables = consumables;
    replies.push("The boss drops an Elixir of Name Changing!");
  }
  const astra = Math.round(run.level * 45);
  patch.astra = (patch.astra ?? p.astra ?? 0) + astra;
  const board = p.dungeonBoard;
  if (board?.offers?.some((o) => o.id === run.offerId))
    patch.dungeonBoard = { ...board, offers: board.offers.map((o) => (o.id === run.offerId ? { ...o, cleared: true } : o)) };
  const mats = {};
  for (const [key, n] of Object.entries({ primal_essence: 1 })) if (MATERIALS[key]) mats[key] = n;
  patch.materials = addToMaterials(patch.materials ?? p.materials, mats);
  replies.push(`[gold]Dungeon cleared![/gold] The ${run.name} falls silent. Completion bonus: ${astra} {{astra|astra}} and ${mats.primal_essence} {{Primal Essence|material:primal_essence}}.`);
  const unique = UNIQUES[template.unique];
  if (unique && Math.random() < UNIQUE_DROP_CHANCE) {
    const item = createUniqueItem(unique, run.level);
    if (item) {
      patch.inventory = [...(patch.inventory ?? p.inventory ?? []), item];
      replies.push(`[red]A glint of crimson in the boss's remains...[/red] {{${item.name}|item:${item.id}}} drops, what a miracle!`);
    }
  }
}

// ---- Puzzles ----

const SEQUENCES = [
  () => {
    const a = rnd(2, 12), d = rnd(2, 9);
    return Array.from({ length: 6 }, (_, i) => a + d * i);
  },
  () => {
    const a = rnd(1, 4), r = rnd(2, 3);
    return Array.from({ length: 6 }, (_, i) => a * r ** i);
  },
  () => {
    const n = rnd(1, 4), c = rnd(0, 5);
    return Array.from({ length: 6 }, (_, i) => (n + i) ** 2 + c);
  },
  () => {
    const t = [rnd(1, 4), rnd(2, 6)];
    while (t.length < 6) t.push(t[t.length - 1] + t[t.length - 2]);
    return t;
  },
  () => {
    const a = rnd(1, 6), t = [rnd(1, 5)];
    while (t.length < 6) t.push(t.length % 2 ? t[t.length - 1] + a : t[t.length - 1] * 2);
    return t;
  },
  () => {
    const a = rnd(1, 5), d = rnd(1, 3), t = [rnd(1, 8)];
    while (t.length < 6) t.push(t[t.length - 1] + a + d * (t.length - 1));
    return t;
  },
];

const makeSequence = () => {
  const terms = pick(SEQUENCES)();
  const answer = terms[5];
  const step = terms[5] - terms[4];
  const wrong = new Set();
  const candidates = shuffle([answer + 1, answer - 1, answer + step, answer - step, answer + 2, answer * 2, answer + rnd(3, 9), terms[4] + terms[3]]);
  for (const c of candidates) {
    if (c !== answer && c > 0 && wrong.size < 3) wrong.add(c);
  }
  let pad = 3;
  while (wrong.size < 3) wrong.add(answer + (pad += 2));
  return { terms: terms.slice(0, 5), answer, options: shuffle([answer, ...wrong]) };
};

const DOOR_STATEMENTS = {
  is: { text: (k, d) => `The safe ${d} is number ${k}.`, test: (s, k) => s === k },
  not: { text: (k, d) => `${cap(d)} ${k} is not safe.`, test: (s, k) => s !== k },
  before: { text: (k, d) => `The safe ${d} comes before ${d} ${k}.`, test: (s, k) => s < k },
  after: { text: (k, d) => `The safe ${d} comes after ${d} ${k}.`, test: (s, k) => s > k },
  even: { text: (k, d) => `The safe ${d} has an even number.`, test: (s) => s % 2 === 0 },
  odd: { text: (k, d) => `The safe ${d} has an odd number.`, test: (s) => s % 2 === 1 },
  next: { text: (k, d) => `The safe ${d} is right next to ${d} ${k}.`, test: (s, k) => Math.abs(s - k) === 1 },
};

// Four inscriptions where exactly one is true when the real safe door is chosen, and only one door works that way.
const makeDoors = () => {
  const kinds = Object.keys(DOOR_STATEMENTS);
  for (let attempt = 0; attempt < 2000; attempt++) {
    const specs = Array.from({ length: 4 }, () => ({ t: pick(kinds), k: rnd(1, 4) }));
    const winners = [1, 2, 3, 4].filter((s) => specs.filter((sp) => DOOR_STATEMENTS[sp.t].test(s, sp.k)).length === 1);
    if (winners.length === 1) return { specs, safe: winners[0] };
  }
  return { specs: [{ t: "is", k: 1 }, { t: "is", k: 1 }, { t: "is", k: 1 }, { t: "not", k: 1 }], safe: 4 };
};

const ORDER_CLUES = (a, b, names) => [
  { t: "before", a, b, text: `${names[a]} comes somewhere before ${names[b]}.`, ok: (pos) => pos[a] < pos[b] },
  { t: "after", a, b, text: `${names[a]} comes immediately after ${names[b]}.`, ok: (pos) => pos[a] === pos[b] + 1 },
  { t: "first", a, b, text: `${names[a]} is not first.`, ok: (pos) => pos[a] !== 0 },
  { t: "last", a, b, text: `${names[a]} is not last.`, ok: (pos) => pos[a] !== names.length - 1 },
];

const permutations = (list) =>
  list.length <= 1 ? [list] : list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [x, ...rest]));

// Clues are added until exactly one order fits them all.
const makeOrder = (names) => {
  const indices = names.map((_, i) => i);
  const answer = shuffle(indices);
  const posOf = (order) => Object.fromEntries(order.map((n, i) => [n, i]));
  const truePos = posOf(answer);
  const all = indices.flatMap((a) => indices.filter((b) => b !== a).flatMap((b) => ORDER_CLUES(a, b, names)));
  const candidates = shuffle(all.filter((c) => c.ok(truePos)));
  const everyOrder = permutations(indices);
  const clues = [];
  let fits = everyOrder;
  for (const clue of candidates) {
    const remaining = fits.filter((order) => clue.ok(posOf(order)));
    if (remaining.length === fits.length) continue;
    clues.push(clue.text);
    fits = remaining;
    if (fits.length === 1) break;
  }
  return { names, clues, answer, picked: [] };
};

const makeLock = () => ({ code: shuffle(LOCK_DIGITS).slice(0, 3), guesses: [], cur: [] });

const makeGamble = () => ({ contents: shuffle(["treasure", "snare", "mimic"]), opened: null });

const makeGauntlet = (def) => ({ traps: shuffle(def.traps).slice(0, 3), round: 0, hits: 0 });

const toggleRunes = (runes, index) =>
  runes.map((lit, i) => Math.abs(i - index) <= 1 ? !lit : lit);

const makeCircuit = () => {
  let runes = Array(5).fill(true);
  for (const index of shuffle([0, 1, 2, 3, 4]).slice(0, rnd(1, 4))) runes = toggleRunes(runes, index);
  if (runes.every(Boolean)) runes = toggleRunes(runes, 0);
  return { runes };
};

const makeScales = () => {
  const weights = shuffle(Array.from({ length: 12 }, (_, i) => i + 1)).slice(0, 6);
  const target = shuffle(weights).slice(0, rnd(2, 3)).reduce((sum, n) => sum + n, 0);
  return { weights, target, selected: [] };
};

const pathColumns = (column) => [0, 1, 2].filter((c) => Math.abs(c - column) <= 1);

const makePath = () => {
  const start = rnd(0, 2);
  let column = start;
  const grid = Array.from({ length: 4 }, () => {
    column = pick(pathColumns(column));
    return [0, 1, 2].map((c) => c === column || Math.random() < 0.35);
  });
  // Only one exit is open; the guaranteed route always reaches it.
  grid[grid.length - 1] = [0, 1, 2].map((c) => c === column);
  return { grid, start, exit: column, visited: [] };
};

const makePairs = (def) => ({ cards: shuffle([...def.symbols, ...def.symbols]), open: [], matched: [] });

const PUZZLE_MAKERS = {
  sequence: () => makeSequence(),
  doors: () => makeDoors(),
  order: (def) => makeOrder(def.items),
  lock: () => makeLock(),
  gauntlet: (def) => makeGauntlet(def),
  gamble: () => makeGamble(),
  circuit: () => makeCircuit(),
  scales: () => makeScales(),
  path: () => makePath(),
  pairs: (def) => makePairs(def),
};

// Sets up the state for the step the run is on.
function prepareStep(run) {
  const step = currentStep(run);
  if (step?.kind !== "puzzle") return { ...run, pz: null };
  const def = DUNGEON_TYPES[run.type].puzzles[step.puzzle];
  return { ...run, pz: { kind: def.kind, mistakes: 0, ...PUZZLE_MAKERS[def.kind](def) } };
}

const updatePuzzle = (patch) => {
  const run = getRun();
  const next = { ...run, pz: { ...run.pz, ...patch } };
  setPlayer({ dungeon: next });
  return next;
};

// A wrong move: take trap damage that grows with every mistake and face a freshly generated puzzle.
function mistake(run, message, { regenerate = true, damageFraction } = {}) {
  const pz = run.pz;
  const frac = MISTAKE_DAMAGE[Math.min(pz.mistakes, MISTAKE_DAMAGE.length - 1)];
  const { lost, died } = hurt(damageFraction ?? frac);
  const text = `${message} The dungeon punishes you for [red]${lost}[/red] damage.`;
  if (died) return failRun(`${text} You fall.`);
  const def = DUNGEON_TYPES[run.type].puzzles[currentStep(run).puzzle];
  const fresh = regenerate ? { ...PUZZLE_MAKERS[def.kind](def), mistakes: pz.mistakes + 1 } : { mistakes: pz.mistakes + 1 };
  const next = updatePuzzle(fresh);
  return { reply: [text, ...(regenerate ? ["The mechanism resets with a new arrangement."] : []), ...describeCurrent(next)], clearLog: true };
}

// The puzzle was solved: reward it and move to the next step.
function solved(run, message, { perfect = false, heal = 0.15, power = 0.3 } = {}) {
  const astra = grantAstra(Math.round(run.level * PUZZLE_ASTRA * (perfect ? 1.5 : 1)));
  const healed = restore(heal, power);
  const next = prepareStep({ ...run, index: run.index + 1 });
  setPlayer({ dungeon: next });
  return {
    reply: [`${message} [green]+${astra}[/green] {{astra|astra}}${healed ? `, recovered ${healed} health` : ""}.`, ...describeCurrent(next)],
    clearLog: true,
  };
}

// ---- Describing and acting on the current step ----

const doorText = (run) => DUNGEON_TYPES[run.type].puzzles[currentStep(run).puzzle].door || "door";

const trapApproach = { swing: "Dash", crush: "Brace", rune: "Disarm" };
const approachStat = (s, approach) => (approach === "Dash" ? s.speed || 0 : approach === "Brace" ? s.defense || 0 : Math.max(s.intelligence || 0, (s.luck || 0) * 2));
export const getTrapChance = (player, run, approach, trapType) => {
  const stat = approachStat(player.stats || {}, approach);
  const difficulty = 3 + 0.8 * run.level;
  const base = 0.2 + (0.6 * stat) / (stat + difficulty);
  return Math.min(0.9, Math.max(0.1, base + (trapApproach[trapType] === approach ? 0.2 : 0)));
};

function describeCurrent(run) {
  const step = currentStep(run);
  const header = `[gold]${run.name}[/gold] (Dungeon Level ${run.level}) - stage ${run.index + 1}/${run.steps.length}`;
  if (!step) return [header];
  if (step.kind === "fight") {
    const e = findTemplate(run.type, step.tpl);
    return [header, `Ahead: [red]${e.name}[/red], a Level ${run.level} ${TIER[step.tier].label} enemy. There is no turning back.`];
  }
  const def = DUNGEON_TYPES[run.type].puzzles[step.puzzle];
  const pz = run.pz;
  const lines = [header, `**${def.name}**`, def.intro];
  if (pz.mistakes) lines.push(`Mistakes so far: ${pz.mistakes}. The next one hurts more.`);
  switch (pz.kind) {
    case "sequence":
      lines.push(`The ${def.unit} read: ${pz.terms.join(", ")}, ?`, "Choose the number that comes next.");
      break;
    case "doors":
      lines.push(
        `The safe ${doorText(run)} is the one that makes EXACTLY ONE inscription true.`,
      );
      pz.specs.forEach((sp, i) => lines.push(`${cap(doorText(run))} ${i + 1}: "${DOOR_STATEMENTS[sp.t].text(sp.k, doorText(run))}"`));
      break;
    case "order":
      lines.push("Clues:", ...pz.clues.map((c) => `- ${c}`), pz.picked.length ? `Order so far: ${pz.picked.map((i) => pz.names[i]).join(" -> ")}` : "Choose what comes first.");
      break;
    case "lock":
      lines.push(`The ${def.lock} takes three different digits from 1 to 6. Each wrong code hurts and you have ${LOCK_GUESSES} tries before it resets.`);
      pz.guesses.forEach((g, i) => lines.push(`Try ${i + 1}: ${g.g.join("-")} -> ${g.exact} right place, ${g.partial} wrong place`));
      lines.push(pz.cur.length ? `Entering: ${pz.cur.join("-")}` : "Enter the first digit.");
      break;
    case "gauntlet": {
      const trap = pz.traps[pz.round];
      lines.push(...Object.values(TRAP_COUNTERS).map((c) => `- ${c.label}.`));
      lines.push(`Trap ${pz.round + 1}/${pz.traps.length}: ${trap.text}`);
      break;
    }
    case "gamble":
      lines.push(`Three ${def.chest}s. One holds treasure. The others hold something that bites. You must open one.`);
      break;
    case "circuit":
      lines.push(
        "Light all five runes. Toggling a rune also flips its immediate left and right neighbors. Only checking an unfinished circuit causes damage.",
        pz.runes.map((lit, i) => `${i + 1}: ${lit ? "ON" : "OFF"}`).join(" | "),
      );
      break;
    case "scales": {
      const total = pz.selected.reduce((sum, i) => sum + pz.weights[i], 0);
      lines.push(`Target weight: ${pz.target}. Select any combination of weights, then check the balance. Each weight can be used once.`,
        `Available weights: ${pz.weights.join(", ")}. Selected: ${pz.selected.map((i) => pz.weights[i]).join(" + ") || "none"} (total ${total}).`);
      break;
    }
    case "path":
      lines.push(
        "The map is visible: O = intact, X = trapped. Move forward one row, staying in the same column or shifting one column sideways. You may step back freely. Plan a route to the exit.",
        `Start: column ${pz.start + 1}. Exit: column ${pz.exit + 1}.`,
        ...pz.grid.map((row, i) => `Row ${i + 1}: ${row.map((safe, c) => `${c + 1}:${safe ? "O" : "X"}`).join(" | ")}`),
        pz.visited.length ? `You are at row ${pz.visited.length}, column ${pz.visited[pz.visited.length - 1] + 1}.` : "You are at the start.",
      );
      break;
    case "pairs":
      lines.push(
        "Reveal two runes at a time and match all four pairs. A mismatch causes damage; both runes stay visible until you cover them.",
        ...pz.cards.map((card, i) => `Rune ${i + 1}: ${pz.matched.includes(i) ? `${card} (matched)` : pz.open.includes(i) ? card : "hidden"}`),
      );
      break;
    default:
      break;
  }
  return lines;
}

export const getDungeonText = () => {
  const run = getRun();
  if (!run) return "You are not inside a dungeon.";
  return describeCurrent(run).join("\n");
};

const opt = (label, onSelect, extra) => ({ label, keywords: [label.toLowerCase()], onSelect, ...extra });

function puzzleOptions(run) {
  const pz = run.pz;
  const def = DUNGEON_TYPES[run.type].puzzles[currentStep(run).puzzle];
  switch (pz.kind) {
    case "sequence":
      return pz.options.map((n) =>
        opt(String(n), () => {
          const fresh = getRun();
          return n === fresh.pz.answer
            ? solved(fresh, "The pattern clicks and the way opens.", { perfect: fresh.pz.mistakes === 0 })
            : mistake(fresh, `${n} is wrong. A dart trap fires.`);
        }),
      );
    case "doors":
      return [1, 2, 3, 4].map((n) =>
        opt(`${cap(doorText(run))} ${n}`, () => {
          const fresh = getRun();
          return n === fresh.pz.safe
            ? solved(fresh, `The ${doorText(fresh)} swings open safely.`, { perfect: fresh.pz.mistakes === 0 })
            : mistake(fresh, `${cap(doorText(fresh))} ${n} was trapped!`);
        }),
      );
    case "order": {
      const remaining = pz.names.map((name, i) => ({ name, i })).filter((x) => !pz.picked.includes(x.i));
      const picks = remaining.map(({ name, i }) =>
        opt(name, () => {
          const fresh = getRun();
          const picked = [...fresh.pz.picked, i];
          if (picked.length < fresh.pz.names.length) {
            updatePuzzle({ picked });
            return { reply: [`You set ${name}. Order so far: ${picked.map((n) => fresh.pz.names[n]).join(" -> ")}`] };
          }
          return picked.every((n, k) => n === fresh.pz.answer[k])
            ? solved(fresh, "Every piece slots into place.", { perfect: fresh.pz.mistakes === 0 })
            : mistake(fresh, "The order was wrong and the mechanism lashes out.");
        }),
      );
      if (pz.picked.length) picks.push(opt("Reset order", () => { updatePuzzle({ picked: [] }); return { reply: ["You clear the order and start again."] }; }));
      return picks;
    }
    case "lock": {
      const picks = LOCK_DIGITS.filter((d) => !pz.cur.includes(d)).map((d) =>
        opt(String(d), () => {
          const fresh = getRun();
          const cur = [...fresh.pz.cur, d];
          if (cur.length < 3) {
            updatePuzzle({ cur });
            return { reply: [`Entering: ${cur.join("-")}`] };
          }
          const code = fresh.pz.code;
          const exact = cur.filter((x, i) => x === code[i]).length;
          if (exact === 3)
            return solved(fresh, `The ${def.lock} clicks open.`, { perfect: fresh.pz.guesses.length < 3 });
          const partial = cur.filter((x, i) => x !== code[i] && code.includes(x)).length;
          const guesses = [...fresh.pz.guesses, { g: cur, exact, partial }];
          const frac = 0.04 + 0.01 * guesses.length;
          const { lost, died } = hurt(guesses.length >= LOCK_GUESSES ? 0.25 : frac);
          if (died) return failRun(`${cur.join("-")} is wrong and the ${def.lock} electrocutes you. You fall.`);
          if (guesses.length >= LOCK_GUESSES) {
            const reset = updatePuzzle({ ...makeLock(), mistakes: fresh.pz.mistakes + 1 });
            return { reply: [`The ${def.lock} jams and discharges for [red]${lost}[/red] damage, then resets with a new code.`, ...describeCurrent(reset)], clearLog: true };
          }
          const next = updatePuzzle({ guesses, cur: [] });
          return { reply: [`${cur.join("-")}: ${exact} right place, ${partial} wrong place. A spark costs you [red]${lost}[/red] health.`, ...describeCurrent(next).slice(-2 - guesses.length)], clearLog: true };
        }),
      );
      if (pz.cur.length) picks.push(opt("Clear digits", () => { updatePuzzle({ cur: [] }); return { reply: ["You clear the digits."] }; }));
      return picks;
    }
    case "gauntlet": {
      const trap = pz.traps[pz.round];
      const player = getPlayer();
      return ["Dash", "Brace", "Disarm"].map((approach) => {
        const chance = getTrapChance(player, run, approach, trap.type);
        return opt(approach, () => {
          const fresh = getRun();
          const t = fresh.pz.traps[fresh.pz.round];
          const ok = Math.random() < getTrapChance(getPlayer(), fresh, approach, t.type);
          let note;
          let hits = fresh.pz.hits;
          if (ok) note = `You ${approach.toLowerCase()} through it unharmed.`;
          else {
            hits += 1;
            const { lost, died } = hurt(0.15 + 0.05 * fresh.pz.round);
            if (died) return failRun(`You try to ${approach.toLowerCase()} but the trap catches you for ${lost} damage. You fall.`);
            note = `You try to ${approach.toLowerCase()} but the trap catches you for [red]${lost}[/red] damage.`;
          }
          if (fresh.pz.round + 1 >= fresh.pz.traps.length)
            return solved({ ...fresh, pz: { ...fresh.pz, hits } }, `${note} You cross the last trap.`, { perfect: hits === 0, heal: 0.05, power: 0.15 });
          const next = updatePuzzle({ round: fresh.pz.round + 1, hits });
          return { reply: [note, ...describeCurrent(next).slice(-5)], clearLog: true };
        }, {
          tooltip: { title: approach, description: `Success chance: ${percent(chance)}`, footer: approach === "Dash" ? "Uses speed." : approach === "Brace" ? "Uses defense." : "Uses intelligence or luck (x2)." },
        });
      });
    }
    case "gamble":
      return [1, 2, 3].map((n) =>
        opt(`${cap(def.chest)} ${n}`, () => {
          const fresh = getRun();
          const result = fresh.pz.contents[n - 1];
          if (result === "treasure")
            return solved(fresh, `The ${def.chest} holds a hoard!`, { perfect: true, heal: 0.3, power: 0.5 });
          const { lost, died } = hurt(result === "snare" ? 0.22 : 0.14);
          if (died) return failRun(`The ${def.chest} was ${result === "snare" ? "a snare" : "a mimic"} and it kills you.`);
          const next = prepareStep({ ...fresh, index: fresh.index + 1 });
          setPlayer({ dungeon: next });
          return {
            reply: [`The ${def.chest} was ${result === "snare" ? "a snare" : "a mimic"}! You take [red]${lost}[/red] damage but scramble onward.`, ...describeCurrent(next)],
            clearLog: true,
          };
        }),
      );
    case "circuit":
      return [
        ...pz.runes.map((_, i) => opt(`Toggle rune ${i + 1}`, () => {
          const fresh = getRun();
          const runes = toggleRunes(fresh.pz.runes, i);
          const next = updatePuzzle({ runes });
          return { reply: describeCurrent(next), clearLog: true };
        })),
        opt("Check circuit", () => {
          const fresh = getRun();
          return fresh.pz.runes.every(Boolean)
            ? solved(fresh, "Every rune shines and the circuit opens the way.", { perfect: fresh.pz.mistakes === 0 })
            : mistake(fresh, "The unfinished circuit discharges.", { regenerate: false });
        }),
      ];
    case "scales":
      return [
        ...pz.weights.map((weight, i) => opt(`${pz.selected.includes(i) ? "Remove" : "Add"} weight ${weight}`, () => {
          const fresh = getRun();
          const selected = fresh.pz.selected.includes(i)
            ? fresh.pz.selected.filter((n) => n !== i) : [...fresh.pz.selected, i];
          const next = updatePuzzle({ selected });
          return { reply: describeCurrent(next), clearLog: true };
        })),
        opt("Check balance", () => {
          const fresh = getRun();
          const total = fresh.pz.selected.reduce((sum, i) => sum + fresh.pz.weights[i], 0);
          return total === fresh.pz.target
            ? solved(fresh, "The scales balance and the gate rises.", { perfect: fresh.pz.mistakes === 0 })
            : mistake(fresh, `The offering is too ${total < fresh.pz.target ? "light" : "heavy"}.`, { regenerate: false });
        }),
      ];
    case "path": {
      const column = pz.visited.length ? pz.visited[pz.visited.length - 1] : pz.start;
      const options = pathColumns(column).map((c) => opt(`Step to column ${c + 1}`, () => {
        const fresh = getRun();
        const row = fresh.pz.visited.length;
        if (!fresh.pz.grid[row][c])
          return mistake(fresh, "You step onto a trapped stone and retreat.", { regenerate: false });
        const visited = [...fresh.pz.visited, c];
        if (visited.length === fresh.pz.grid.length)
          return solved(fresh, "You reach the exit safely.", { perfect: fresh.pz.mistakes === 0 });
        const next = updatePuzzle({ visited });
        return { reply: describeCurrent(next), clearLog: true };
      }));
      if (pz.visited.length) options.push(opt("Step back", () => {
        const fresh = getRun();
        const next = updatePuzzle({ visited: fresh.pz.visited.slice(0, -1) });
        return { reply: describeCurrent(next), clearLog: true };
      }));
      return options;
    }
    case "pairs":
      if (pz.open.length === 2) return [opt("Cover unmatched runes", () => {
        const next = updatePuzzle({ open: [] });
        return { reply: describeCurrent(next), clearLog: true };
      })];
      return pz.cards.flatMap((_, i) => pz.matched.includes(i) || pz.open.includes(i) ? [] : [
        opt(`Reveal rune ${i + 1}`, () => {
          const fresh = getRun();
          const open = [...fresh.pz.open, i];
          if (open.length === 1) {
            const next = updatePuzzle({ open });
            return { reply: describeCurrent(next), clearLog: true };
          }
          if (fresh.pz.cards[open[0]] !== fresh.pz.cards[open[1]]) {
            const next = updatePuzzle({ open });
            return mistake(next, "The runes do not match.", {
              regenerate: false, damageFraction: Math.min(0.15, 0.05 + fresh.pz.mistakes * 0.01),
            });
          }
          const matched = [...fresh.pz.matched, ...open];
          if (matched.length === fresh.pz.cards.length)
            return solved(fresh, "All four rune pairs are reunited.", { perfect: fresh.pz.mistakes === 0 });
          const next = updatePuzzle({ matched, open: [] });
          return { reply: ["A matching pair locks into place.", ...describeCurrent(next)], clearLog: true };
        }),
      ]);
    default:
      return [];
  }
}

export function getDungeonOptions() {
  const run = getRun();
  if (!run) return [{ label: "Leave", keywords: ["leave"], next: "menu" }];
  const step = currentStep(run);
  if (!step) return [{ label: "Leave", keywords: ["leave"], next: "menu" }];
  if (step.kind === "fight") {
    return [
      opt("Engage", () => {
        const fresh = getRun();
        if (!fresh) return { next: "menu" };
        startCombat(buildEnemy(fresh, currentStep(fresh)));
        if (!getEnemy()) return { reply: takeOpeningReplies(), next: "menu" };
        return { next: "combat" };
      }),
    ];
  }
  return puzzleOptions(run);
}
