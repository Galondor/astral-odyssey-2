import { getPlayer, setPlayer } from "../character/player";
import { updateRecords } from "../character/records";
import { gainExp } from "../character/stats";
import { getEffectiveLevel } from "../combat/enemies";
import { applyDeathPenalties, startCombat } from "../combat/combat";
import { createUniqueItem } from "../items/items";
import { addToMaterials } from "../items/materials";
import { UNIQUES } from "./dungeonData";
import { isInGroupDungeon } from "./groupState";

export const LABYRINTH_MIN_LEVEL = 22;
export const LABYRINTH_FLOOR_COUNT = 5;
export const LABYRINTH_MAX_RELICS = 5;
export const LABYRINTH_MAX_FRAGMENTS_PER_WEEK = 95;
export const LABYRINTH_STAMINA_PER_STEP = 5;

const MAP_SIZE = 9;
const START = { x: 1, y: 1 };
const CHECKPOINT = { x: 5, y: 5 };
const EXIT = { x: 7, y: 7 };
const DIRECTIONS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];
const LABYRINTH_ENEMIES = [
  { id: "maze_stalker", name: "Maze Stalker", material: "labyrinth_etched_fang", secondary: "beast_fang", hp: 3.1, attack: 2.5, defense: 3.5, exp: 85, astra: 28 },
  { id: "echo_weaver", name: "Echo Weaver", material: "labyrinth_echo_silk", secondary: "spider_silk", hp: 2.8, attack: 2.8, defense: 2.8, exp: 90, astra: 32 },
  { id: "rune_golem", name: "Runebound Golem", material: "labyrinth_rune_shard", secondary: "obsidian_shard", hp: 4.2, attack: 2.2, defense: 5, exp: 105, astra: 34 },
  { id: "thorn_minotaur", name: "Thorn-Crowned Minotaur", material: "labyrinth_thorned_horn", secondary: "rotwood_bark", hp: 4, attack: 3.4, defense: 4.1, exp: 120, astra: 38 },
  { id: "void_sentinel", name: "Void Sentinel", material: "labyrinth_void_ichor", secondary: "observatory_void_dust", hp: 3.8, attack: 3.5, defense: 4, exp: 130, astra: 42 },
];
const BOSS = {
  id: "the_unwritten_king",
  name: "The Unwritten King",
  material: "labyrinth_crown_fragment",
  hp: 19,
  attack: 13,
  defense: 16,
  exp: 240,
  astra: 180,
};

const keyOf = ({ x, y }) => `${x},${y}`;
const randomInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
const clone = (value) => JSON.parse(JSON.stringify(value));

export function getNextLabyrinthReset(now = new Date()) {
  const timeZone = "America/New_York";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  });
  const localParts = (date) => Object.fromEntries(
    formatter.formatToParts(date).map(({ type, value }) => [type, value])
  );
  const current = localParts(now);
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let daysUntilFriday = (5 - weekdays[current.weekday] + 7) % 7;
  if (daysUntilFriday === 0 && Number(current.hour) >= 8) daysUntilFriday = 7;
  const localDate = new Date(Date.UTC(Number(current.year), Number(current.month) - 1, Number(current.day) + daysUntilFriday));
  const targetUtc = Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(), 8);
  let resetTime = targetUtc;
  for (let attempt = 0; attempt < 2; attempt++) {
    const resetLocal = localParts(new Date(resetTime));
    const representedAsUtc = Date.UTC(
      Number(resetLocal.year),
      Number(resetLocal.month) - 1,
      Number(resetLocal.day),
      Number(resetLocal.hour),
      Number(resetLocal.minute),
      Number(resetLocal.second),
    );
    resetTime += targetUtc - representedAsUtc;
  }
  return new Date(resetTime);
}

export const getLabyrinthWeekId = (now = new Date()) => getNextLabyrinthReset(now).toISOString();

const seededRandom = (seed) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hashSeed = (value) => {
  let seed = 2166136261;
  for (const char of value) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return seed >>> 0;
};

const shuffle = (values, rng) => {
  const output = [...values];
  for (let i = output.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
};

function generateFloor(floorNumber, rng) {
  const tiles = Array.from({ length: MAP_SIZE * MAP_SIZE }, (_, index) => ({
    x: index % MAP_SIZE,
    y: Math.floor(index / MAP_SIZE),
    type: "wall",
    revealed: false,
    resolved: false,
  }));
  const tileAt = (position) => tiles[position.y * MAP_SIZE + position.x];
  const carve = (position) => { tileAt(position).type = "empty"; };
  const stack = [START];
  carve(START);
  while (stack.length) {
    const current = stack[stack.length - 1];
    const options = shuffle(DIRECTIONS, rng)
      .map((direction) => ({ x: current.x + direction.x * 2, y: current.y + direction.y * 2, direction }))
      .filter((next) =>
        next.x > 0 && next.y > 0 && next.x < MAP_SIZE - 1 && next.y < MAP_SIZE - 1 && tileAt(next).type === "wall"
      );
    if (!options.length) {
      stack.pop();
      continue;
    }
    const next = options[0];
    carve({ x: current.x + next.direction.x, y: current.y + next.direction.y });
    carve(next);
    stack.push({ x: next.x, y: next.y });
  }

  const specialRooms = tiles.filter((tile) =>
    tile.type === "empty" && tile.x % 2 === 1 && tile.y % 2 === 1
    && keyOf(tile) !== keyOf(START) && keyOf(tile) !== keyOf(CHECKPOINT) && keyOf(tile) !== keyOf(EXIT)
  );
  const rooms = shuffle(specialRooms, rng);
  const roomAt = (index) => rooms[index];
  const regularRooms = floorNumber === LABYRINTH_FLOOR_COUNT ? 8 : 9;
  const types = ["secret", "cache", "cache", "trap", "trap", "puzzle", ...Array(regularRooms - 6).fill("enemy")];
  shuffle(types, rng).forEach((type, index) => {
    const tile = roomAt(index);
    tile.type = type;
    if (type === "enemy") {
      const enemy = LABYRINTH_ENEMIES[randomInt(rng, 0, LABYRINTH_ENEMIES.length - 1)];
      tile.enemyId = enemy.id;
      tile.tier = floorNumber >= 4 && rng() < 0.3 ? "elite" : "basic";
    }
    if (type === "secret") tile.relicReward = 1;
    if (type === "cache" || type === "secret" || type === "puzzle") {
      tile.fragmentReward = randomInt(rng, type === "secret" ? 6 : 4, type === "secret" ? 9 : 7);
    }
    if (type === "puzzle") tile.answer = ["■", "◆", "▲"][randomInt(rng, 0, 2)];
  });

  tileAt(START).type = "entrance";
  tileAt(START).revealed = true;
  tileAt(CHECKPOINT).type = "checkpoint";
  tileAt(EXIT).type = floorNumber === LABYRINTH_FLOOR_COUNT ? "boss" : "exit";
  if (floorNumber === LABYRINTH_FLOOR_COUNT) {
    tileAt(EXIT).enemyId = BOSS.id;
    tileAt(EXIT).tier = "boss";
  }

  return {
    number: floorNumber,
    level: 0,
    tiles,
    position: { ...START },
    checkpoint: { ...START },
    discovered: [keyOf(START)],
  };
}

export function createLabyrinth(player, now = new Date()) {
  const weekId = getLabyrinthWeekId(now);
  const seed = hashSeed(`${weekId}:${player?.uid || player?.id || player?.name || "wanderer"}:${Math.random()}`);
  const rng = seededRandom(seed);
  const effectiveLevel = getEffectiveLevel(player?.level || 1, player?.stats?.gearScore || 0);
  const floors = Array.from({ length: LABYRINTH_FLOOR_COUNT }, (_, index) => {
    const floor = generateFloor(index + 1, rng);
    floor.level = effectiveLevel + index * 3;
    return floor;
  });
  return {
    schemaVersion: 1,
    weekId,
    seed,
    floors,
    currentFloor: 0,
    active: false,
    started: false,
    completed: false,
    rewardClaimed: false,
    returnToLabyrinth: false,
    relicsFound: 0,
    fragmentsEarned: 0,
    pendingEncounter: null,
    createdAt: Date.now(),
    completedAt: null,
  };
}

export function getLabyrinthState(player = getPlayer(), now = new Date()) {
  const weekId = getLabyrinthWeekId(now);
  const saved = player?.labyrinth;
  if (saved?.schemaVersion === 1 && saved.weekId === weekId && Array.isArray(saved.floors) && saved.floors.length === LABYRINTH_FLOOR_COUNT) return saved;
  return createLabyrinth(player, now);
}

export const isLabyrinthActive = (player = getPlayer()) =>
  !!player?.labyrinth?.weekId
  && player.labyrinth.weekId === getLabyrinthWeekId()
  && (player.labyrinth.active || player.labyrinth.returnToLabyrinth);

const persist = (patch) => {
  setPlayer(patch);
  return patch;
};

export function enterLabyrinth() {
  const player = getPlayer();
  if (!player) return { ok: false, message: "No character is loaded." };
  if ((player.level || 1) < LABYRINTH_MIN_LEVEL) return { ok: false, message: `The Labyrinth opens at level ${LABYRINTH_MIN_LEVEL}.` };
  if (player.dungeon) return { ok: false, message: "Finish your current dungeon before entering the Labyrinth." };
  if (isInGroupDungeon()) return { ok: false, message: "Finish your group dungeon run before entering the Labyrinth." };
  const state = clone(getLabyrinthState(player));
  if (state.completed) return { ok: false, message: "This week's Labyrinth has already been cleared." };
  const floor = state.floors[state.currentFloor];
  if (!state.started) {
    state.started = true;
    floor.checkpoint = { ...START };
    floor.position = { ...START };
  } else {
    floor.position = { ...floor.checkpoint };
    const stats = { ...player.stats };
    stats.health = stats.maxHealth;
    stats.stamina = stats.maxStamina;
    persist({ stats });
  }
  state.active = true;
  state.returnToLabyrinth = false;
  persist({ labyrinth: state });
  return { ok: true, state };
}

export function leaveLabyrinth() {
  const player = getPlayer();
  if (!player?.labyrinth) return { ok: false, message: "No Labyrinth expedition is active." };
  const state = clone(getLabyrinthState(player));
  const floor = state.floors[state.currentFloor];
  floor.position = { ...floor.checkpoint };
  state.active = false;
  state.returnToLabyrinth = false;
  persist({ labyrinth: state });
  return { ok: true, state };
}

const awardFragments = (state, player, patch, amount) => {
  const actual = Math.max(0, Math.min(amount, LABYRINTH_MAX_FRAGMENTS_PER_WEEK - state.fragmentsEarned));
  if (!actual) return 0;
  state.fragmentsEarned += actual;
  patch.materials = addToMaterials(patch.materials ?? player.materials, { relicFragments: actual });
  return actual;
};

const awardMaterial = (player, patch, key, amount) => {
  patch.materials = addToMaterials(patch.materials ?? player.materials, { [key]: amount });
};

function makeEnemy(player, state, floor, tile) {
  const definition = tile.tier === "boss"
    ? BOSS
    : LABYRINTH_ENEMIES.find((enemy) => enemy.id === tile.enemyId) || LABYRINTH_ENEMIES[0];
  const tier = tile.tier || "basic";
  const tierScale = tier === "boss" ? 1.65 : tier === "elite" ? 1.3 : 1;
  const level = Math.max(1, floor.level);
  const maxHp = Math.round(14 * level * definition.hp * tierScale);
  const attackBase = 1.1 * level * definition.attack * tierScale;
  const defense = Math.round(0.55 * level * definition.defense * tierScale);
  const fragmentReward = tier === "boss" ? 14 : tier === "elite" ? 7 : 4;
  const drops = [
    { key: definition.material, chance: 1, min: tier === "boss" ? 1 : tier === "elite" ? 2 : 1, max: tier === "boss" ? 2 : tier === "elite" ? 4 : 3 },
    { key: definition.secondary || "obsidian_shard", chance: 0.45, min: 1, max: 3 },
  ];

  return {
    id: `labyrinth-${definition.id}`,
    name: definition.name,
    tier,
    level,
    maxHp,
    attack: [Math.max(1, Math.round(attackBase * (tier === "boss" ? 0.8 : 0.65))), Math.max(2, Math.round(attackBase * (tier === "boss" ? 1.25 : 1)))],
    defense,
    speed: Math.max(1, Math.round(4 + level * (tier === "boss" ? 0.12 : 0.025))),
    critical: tier === "boss" ? 0.45 : tier === "elite" ? 0.3 : 0.18,
    astra: Math.round(level * definition.astra * tierScale),
    exp: Math.round(level * definition.exp * tierScale),
    dropChance: tier === "boss" ? 1 : tier === "elite" ? 0.85 : 0.65,
    minRarity: tier === "boss" ? 4 : tier === "elite" ? 2 : 1,
    abilities: [],
    phases: [],
    drops,
    dungeon: true,
    labyrinth: true,
    onDefeat: (p, stats, patch, replies) => {
      resolveLabyrinthFight(p, stats, patch, replies, state, floor.number - 1, tile, fragmentReward);
      const resultState = clone(patch.labyrinth || state);
      resultState.lastCombatResults = [...replies];
      patch.labyrinth = resultState;
    },
    onPlayerDefeat: (p, stats, patch, replies) => {
      applyDeathPenalties(p, stats, replies, patch);
      const nextState = clone(patch.labyrinth || p.labyrinth || state);
      const defeatedFloor = nextState.floors[nextState.currentFloor];
      defeatedFloor.position = { ...defeatedFloor.checkpoint };
      nextState.active = true;
      nextState.pendingEncounter = null;
      patch.labyrinth = nextState;
      replies.push(`The labyrinth's wardens drag you back to the Floor ${defeatedFloor.number} checkpoint.`);
      nextState.lastCombatResults = [...replies];
    },
  };
}

function grantFinalRewards(player, patch, replies, state, floor) {
  if (state.rewardClaimed) return;
  state.rewardClaimed = true;
  state.completed = true;
  state.active = false;
  state.returnToLabyrinth = true;
  state.completedAt = Date.now();
  updateRecords(player, patch, { increments: { labyrinthsCleared: 1 } });
  awardFragments(state, player, patch, 12);
  patch.astra = (patch.astra ?? player.astra ?? 0) + floor.level * 300;
  const leveled = gainExp({ ...player, ...patch, stats: patch.stats || player.stats }, floor.level * 1800);
  Object.assign(patch, leveled.patch);
  replies.push(...leveled.messages);

  const relics = Math.min(LABYRINTH_MAX_RELICS, state.relicsFound);
  if (relics > 0)
    patch.materials = addToMaterials(patch.materials ?? player.materials, { sealedRelic: relics });
  const consumables = { ...(patch.consumables || player.consumables || {}) };
  consumables.healthPotion = (consumables.healthPotion || 0) + 2;
  patch.consumables = consumables;
  replies.push(`The Labyrinth is cleared! You secure ${relics} relic${relics === 1 ? "" : "s"} and two Health Potions.`);

  if (Math.random() < 0.05) {
    const item = createUniqueItem(UNIQUES.unwrittenPath, Math.max(100, floor.level));
    patch.inventory = [...(patch.inventory || player.inventory || []), item];
    replies.push("[gold]The Unwritten Path has been found![/gold]");
  }
}

function resolveLabyrinthFight(player, stats, patch, replies, originalState, floorIndex, tile, fragmentReward) {
  const state = clone(patch.labyrinth || player.labyrinth || originalState);
  const floor = state.floors[floorIndex];
  const target = floor.tiles[tile.y * MAP_SIZE + tile.x];
  if (target.resolved) return;
  target.resolved = true;
  state.pendingEncounter = null;
  awardFragments(state, player, patch, fragmentReward);
  replies.push(`The labyrinth yields ${fragmentReward} Relic Fragments.`);
  if (target.tier === "boss") {
    grantFinalRewards(player, patch, replies, state, floor);
  }
  patch.labyrinth = state;
}

export function moveInLabyrinth(x, y) {
  const player = getPlayer();
  if (!player?.labyrinth || !isLabyrinthActive(player)) return { ok: false, message: "Enter the Labyrinth before exploring." };
  const state = clone(getLabyrinthState(player));
  const floor = state.floors[state.currentFloor];
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) return { ok: false, message: "That tile is outside the maze." };
  const dx = Math.abs(x - floor.position.x);
  const dy = Math.abs(y - floor.position.y);
  if (dx + dy !== 1) return { ok: false, message: "You can only move to an adjacent tile." };
  const tile = floor.tiles[y * MAP_SIZE + x];
  if (tile.type === "wall") return { ok: false, message: "A solid wall blocks that passage." };
  if ((player.stats?.stamina || 0) < LABYRINTH_STAMINA_PER_STEP)
    return { ok: false, message: `You need ${LABYRINTH_STAMINA_PER_STEP} stamina to move. Return to a checkpoint to recover.` };

  floor.position = { x, y };
  tile.revealed = true;
  if (!floor.discovered.includes(keyOf(tile))) floor.discovered.push(keyOf(tile));
  if (!tile.resolved) {
    const patch = { labyrinth: state, stats: { ...player.stats, stamina: player.stats.stamina - LABYRINTH_STAMINA_PER_STEP } };
    if (tile.type === "cache") {
      awardFragments(state, player, patch, tile.fragmentReward);
      awardMaterial(player, patch, "labyrinth_etched_stone", randomInt(seededRandom(hashSeed(`${state.seed}:${x}:${y}`)), 2, 4));
      const consumables = { ...(player.consumables || {}) };
      consumables.healthPotion = (consumables.healthPotion || 0) + 1;
      patch.consumables = consumables;
      tile.resolved = true;
      patch.labyrinth = state;
      persist(patch);
      return { ok: true, message: `You open a cache and find ${tile.fragmentReward} Relic Fragments, etched stone, and a Health Potion.` };
    }
    if (tile.type === "secret") {
      awardFragments(state, player, patch, tile.fragmentReward);
      state.relicsFound = Math.min(LABYRINTH_MAX_RELICS, state.relicsFound + (tile.relicReward || 1));
      tile.resolved = true;
      patch.labyrinth = state;
      persist(patch);
      return { ok: true, message: `Secret found! A sealed relic is held for the final clear. Relics secured: ${state.relicsFound}/${LABYRINTH_MAX_RELICS}.` };
    }
    if (tile.type === "trap") {
      const damage = Math.max(1, Math.round((player.stats?.maxHealth || 1) * 0.35));
      patch.stats.health = Math.max(1, (player.stats?.health ?? player.stats?.maxHealth ?? 1) - damage);
      awardMaterial(player, patch, "labyrinth_etched_stone", 1);
      tile.resolved = true;
      patch.labyrinth = state;
      persist(patch);
      return { ok: true, message: `A hidden blade strikes for ${damage} damage. Salvaged stone fragments lie beneath it.` };
    }
    if (tile.type === "checkpoint") {
      floor.checkpoint = { x, y };
      patch.stats.health = player.stats?.maxHealth || player.stats?.health || 1;
      patch.stats.stamina = player.stats?.maxStamina || player.stats?.stamina || 1;
      tile.resolved = true;
      patch.labyrinth = state;
      persist(patch);
      return { ok: true, message: `Floor ${floor.number} checkpoint attuned. Health and stamina restored.` };
    }
    if (tile.type === "puzzle") {
      state.pendingEncounter = { kind: "puzzle", floor: state.currentFloor, x, y };
      patch.labyrinth = state;
      persist(patch);
      return { ok: true, encounter: "puzzle", answer: tile.answer, message: "An ancient puzzle seals the passage. Choose the rune shown at the entrance." };
    }
    if (tile.type === "exit") {
      tile.resolved = true;
      const nextFloorIndex = state.currentFloor + 1;
      const nextFloor = state.floors[nextFloorIndex];
      nextFloor.position = { ...START };
      nextFloor.checkpoint = { ...START };
      nextFloor.tiles[START.y * MAP_SIZE + START.x].revealed = true;
      nextFloor.discovered = [keyOf(START)];
      state.currentFloor = nextFloorIndex;
      patch.stats.health = player.stats?.maxHealth || player.stats?.health || 1;
      patch.stats.stamina = player.stats?.maxStamina || player.stats?.stamina || 1;
      patch.labyrinth = state;
      persist(patch);
      return { ok: true, message: `You descend to Floor ${nextFloor.number}. The entrance becomes your new checkpoint.` };
    }
    if (tile.type === "enemy" || tile.type === "boss") {
      state.pendingEncounter = { kind: "enemy", floor: state.currentFloor, x, y, enemyId: tile.enemyId };
      state.lastCombatResults = [];
      patch.labyrinth = state;
      persist(patch);
      const enemy = makeEnemy(player, state, floor, tile);
      startCombat(enemy);
      return { ok: true, encounter: "combat", enemy };
    }
    tile.resolved = true;
    patch.labyrinth = state;
    persist(patch);
    return { ok: true, message: "The passage is quiet. Continue exploring." };
  }

  persist({ labyrinth: state, stats: { ...player.stats, stamina: player.stats.stamina - LABYRINTH_STAMINA_PER_STEP } });
  return { ok: true, message: "You retrace your steps through the cleared passage." };
}

export function solveLabyrinthPuzzle(answer) {
  const player = getPlayer();
  if (!player?.labyrinth || !isLabyrinthActive(player)) return { ok: false, message: "No active Labyrinth puzzle." };
  const state = clone(getLabyrinthState(player));
  const pending = state.pendingEncounter;
  if (pending?.kind !== "puzzle") return { ok: false, message: "There is no puzzle to solve." };
  const floor = state.floors[pending.floor];
  if (state.currentFloor !== pending.floor || floor.position.x !== pending.x || floor.position.y !== pending.y)
    return { ok: false, message: "You must stand on the puzzle tile to solve it." };
  const tile = floor.tiles[pending.y * MAP_SIZE + pending.x];
  const patch = { labyrinth: state, stats: { ...player.stats } };
  if (answer !== tile.answer) {
    const damage = Math.max(1, Math.round((player.stats?.maxHealth || 1) * 0.06));
    patch.stats.health = Math.max(1, (player.stats?.health ?? player.stats?.maxHealth ?? 1) - damage);
    persist(patch);
    return { ok: false, message: `The rune rejects your answer. You lose ${damage} health; try again.` };
  }
  awardFragments(state, player, patch, tile.fragmentReward);
  awardMaterial(player, patch, "labyrinth_echo_silk", 2);
  tile.resolved = true;
  state.pendingEncounter = null;
  persist(patch);
  return { ok: true, message: `Puzzle solved! You gain ${tile.fragmentReward} Relic Fragments and two Echo Silk.` };
}

export function returnToLabyrinthCheckpoint() {
  const player = getPlayer();
  if (!player?.labyrinth) return { ok: false, message: "No Labyrinth progress to return to." };
  const state = clone(getLabyrinthState(player));
  const floor = state.floors[state.currentFloor];
  floor.position = { ...floor.checkpoint };
  const stats = {
    ...player.stats,
    health: player.stats?.maxHealth || player.stats?.health || 1,
    stamina: player.stats?.maxStamina || player.stats?.stamina || 1,
  };
  persist({ labyrinth: state, stats });
  return { ok: true, message: "You return to the checkpoint; health and stamina are restored." };
}
