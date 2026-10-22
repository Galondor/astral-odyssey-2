import { getPlayer, setPlayer } from "../character/player";
import { endCombat, startCombat } from "../combat/combat";
import { ENEMIES, rollMaterialDrops } from "../combat/enemies";
import { MATERIALS } from "../items/materials";
import { DUNGEON_TYPES, DUNGEON_TYPE_IDS } from "./dungeonData";
import {
  expireIfNeeded, getBoard, getBoardSlot, getDungeonOptions, getDungeonText, getRun,
  ARCHITECTS_RUNE_DROP_CHANCE, NAME_ELIXIR_DROP_CHANCE, startDungeon,
} from "./dungeons";

jest.mock("../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
jest.mock("../combat/combat", () => ({
  applyDeathPenalties: jest.requireActual("../combat/combat").applyDeathPenalties,
  startCombat: jest.fn(), endCombat: jest.fn(), getEnemy: () => null,
}));
jest.mock("../firebase", () => ({ db: {} }));

const type = DUNGEON_TYPES[DUNGEON_TYPE_IDS[0]];
let player;

beforeEach(() => {
  jest.clearAllMocks();
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
});

function enemy(tier = "boss") {
  const template = tier === "boss" ? type.bosses[0] : tier === "elite" ? type.elites[0] : type.basics[0];
  player = {
    name: "Alice", level: 20, stats: {}, consumables: { elixirOfNameChanging: 2 },
    dungeon: {
      type: type.id, name: type.name, level: 20, index: 0,
      steps: [{ kind: "fight", tier, tpl: template.id }, { kind: "fight", tier: "boss", tpl: type.bosses[0].id }],
    },
  };
  getDungeonOptions()[0].onSelect();
  return startCombat.mock.calls.at(-1)[0];
}

afterEach(() => jest.restoreAllMocks());

test.each([[0, true], [0.049999, true], [0.05, false], [0.999, false]])(
  "boss elixir drop at random=%s is %s",
  (roll, drops) => {
    const boss = enemy();
    jest.spyOn(Math, "random").mockReturnValue(roll);
    const patch = {};
    const replies = [];
    boss.onDefeat(player, {}, patch, replies);
    expect(NAME_ELIXIR_DROP_CHANCE).toBe(0.05);
    expect(patch.consumables?.elixirOfNameChanging ?? 2).toBe(drops ? 3 : 2);
    expect(replies.some((line) => line.includes("Elixir of Name Changing"))).toBe(drops);
  },
);

test.each(["basic", "elite"])("%s enemies never drop the name elixir", (tier) => {
  const foe = enemy(tier);
  jest.spyOn(Math, "random").mockReturnValue(0);
  const patch = {};
  foe.onDefeat(player, {}, patch, []);
  expect(patch.consumables?.elixirOfNameChanging ?? 2).toBe(2);
});

test.each([
  ["elite", 0, true], ["elite", 0.049999, true], ["elite", 0.05, false],
  ["boss", 0, true], ["boss", 0.099999, true], ["boss", 0.1, false],
  ["basic", 0, false],
])("%s rune drop at random=%s is %s", (tier, roll, drops) => {
  const foe = enemy(tier);
  player.consumables.architectsRune = 2;
  jest.spyOn(Math, "random").mockReturnValue(roll);
  const patch = { consumables: { ...player.consumables, healthPotion: 4 } };
  const replies = [];
  foe.onDefeat(player, {}, patch, replies);
  expect(ARCHITECTS_RUNE_DROP_CHANCE).toEqual({ elite: 0.05, boss: 0.1 });
  expect(patch.consumables.architectsRune).toBe(drops ? 3 : 2);
  expect(patch.consumables.healthPotion).toBe(4);
  expect(replies.some((line) => line.includes("Architect's Rune"))).toBe(drops);
});

test("losing to a dungeon boss never grants the elixir", () => {
  const boss = enemy();
  jest.spyOn(Math, "random").mockReturnValue(0);
  const patch = {};
  boss.onPlayerDefeat(player, { maxHealth: 100, maxPower: 100 }, patch, []);
  expect(patch.consumables).toBeUndefined();
});

test.each(["elite", "boss"])("dungeon %s rewards preserve certificates from combat", (tier) => {
  const foe = enemy(tier);
  jest.spyOn(Math, "random").mockReturnValue(0);
  const patch = { consumables: { ...player.consumables, itemCertificate: 3, healthPotion: 4 } };
  foe.onDefeat(player, {}, patch, []);
  expect(patch.consumables.itemCertificate).toBe(3);
  expect(patch.consumables.healthPotion).toBe(4);
  expect(patch.consumables.architectsRune).toBe(1);
  expect(patch.consumables.elixirOfNameChanging).toBe(tier === "boss" ? 3 : 2);
});

function puzzle(kind, typeId = type.id) {
  const dungeon = DUNGEON_TYPES[typeId];
  const offer = {
    id: "test-puzzle", type: typeId, level: 20, name: dungeon.name,
    steps: [
      { kind: "puzzle", puzzle: dungeon.puzzles.findIndex((p) => p.kind === kind) },
      { kind: "fight", tier: "boss", tpl: dungeon.bosses[0].id },
    ],
  };
  player = {
    level: 20, astra: 1000,
    stats: { health: 100, maxHealth: 100, power: 10, maxPower: 100, stamina: 5, maxStamina: 50, exp: 200 },
    dungeonBoard: { slot: getBoardSlot(), offers: [offer] },
  };
  expect(startDungeon(offer.id)).toEqual({ ok: true });
  return player.dungeon.pz;
}

function choose(label) {
  const option = getDungeonOptions().find((o) => o.label === label);
  expect(option).toBeDefined();
  return option.onSelect();
}

test.each(DUNGEON_TYPE_IDS)("%s has eight challenges and three distinct exclusive materials", (id) => {
  const dungeon = DUNGEON_TYPES[id];
  expect(dungeon.puzzles).toHaveLength(8);
  expect(new Set(dungeon.puzzles.map((p) => p.kind)).size).toBe(8);
  expect(dungeon.puzzles.map((p) => p.kind)).toEqual(expect.arrayContaining(["circuit", "scales", "path", "pairs"]));
  expect(Object.values(dungeon.materials)).toHaveLength(3);
  Object.values(dungeon.materials).forEach((key) => expect(MATERIALS[key]).toBeDefined());
});

test("all 18 dungeon materials are unique and do not appear in overworld drops", () => {
  const keys = DUNGEON_TYPE_IDS.flatMap((id) => Object.values(DUNGEON_TYPES[id].materials));
  expect(new Set(keys).size).toBe(18);
  Object.values(ENEMIES).forEach((foe) =>
    (foe.drops || []).forEach((drop) => expect(keys).not.toContain(drop.key)));
});

test.each(DUNGEON_TYPE_IDS.flatMap((id) => ["basic", "elite", "boss"].map((tier) => [id, tier])))(
  "%s %s enemies drop only their own exclusive material, with tier-scaled amounts",
  (id, tier) => {
    const dungeon = DUNGEON_TYPES[id];
    const template = (tier === "basic" ? dungeon.basics : tier === "elite" ? dungeon.elites : dungeon.bosses)[0];
    player = { dungeon: { type: id, level: 20, index: 0, steps: [{ kind: "fight", tier, tpl: template.id }] } };
    choose("Engage");
    const foe = startCombat.mock.calls.at(-1)[0];
    jest.spyOn(Math, "random").mockReturnValue(0);
    const drops = rollMaterialDrops(foe);
    const exclusiveKeys = DUNGEON_TYPE_IDS.flatMap((key) => Object.values(DUNGEON_TYPES[key].materials));
    expect(Object.keys(drops).filter((key) => exclusiveKeys.includes(key))).toEqual([dungeon.materials[tier]]);
    expect(drops[dungeon.materials[tier]]).toBe({ basic: 2, elite: 3, boss: 4 }[tier]);
    foe.drops.forEach((drop) => expect(MATERIALS[drop.key]).toBeDefined());
  },
);

test("boss completion preserves materials already gained from the kill", () => {
  const boss = enemy();
  jest.spyOn(Math, "random").mockReturnValue(0.9);
  const patch = { materials: { [type.materials.boss]: 4, primal_essence: 7 } };
  boss.onDefeat(player, {}, patch, []);
  expect(patch.materials).toEqual({ [type.materials.boss]: 4, primal_essence: 9 });
});

test.each([10, 11, 20])("combat death at level %s applies normal penalties and restores resources", (level) => {
  const boss = enemy();
  const p = { ...player, level, astra: 1000 };
  const s = { health: 0, maxHealth: 100, power: 0, maxPower: 40, stamina: 0, maxStamina: 30, exp: 201 };
  const patch = {};
  const replies = [];
  jest.spyOn(Math, "random").mockReturnValue(0.5);
  boss.onPlayerDefeat(p, s, patch, replies);
  expect(patch).toEqual({ astra: 500, dungeon: null });
  expect(s).toMatchObject({ health: 100, power: 40, stamina: 30, exp: level > 10 ? 101 : 201 });
  expect(replies.join(" ")).toContain("lost 500 astra");
});

test.each(["opening", "round"])("a lethal %s attack saves dungeon defeat penalties and ends combat", (turn) => {
  const foe = enemy();
  player = {
    ...player, astra: 1000, equipment: {},
    stats: { health: 1, maxHealth: 100, power: 0, maxPower: 40, stamina: 0, maxStamina: 30, exp: 200, defense: 0, speed: turn === "round" ? 1000 : 0 },
  };
  const combat = jest.requireActual("../combat/combat");
  jest.spyOn(Math, "random").mockReturnValue(0.5);
  combat.startCombat({ ...foe, abilities: [], phases: [], attack: [100, 100], critical: 0 });
  if (turn === "round") expect(combat.passRound().over).toBe(true);
  else expect(combat.takeOpeningReplies().join(" ")).toContain("lost 500 astra");
  expect(combat.getEnemy()).toBeNull();
  expect(player.dungeon).toBeNull();
  expect(player.astra).toBe(500);
  expect(player.stats).toMatchObject({ health: 100, power: 40, stamina: 30, exp: 100 });
});

test("lethal puzzle damage applies the same death penalties and ends the run", () => {
  puzzle("circuit");
  player.stats.health = 1;
  jest.spyOn(Math, "random").mockReturnValue(0.5);
  const result = choose("Check circuit");
  expect(result.next).toBe("menu");
  expect(player.dungeon).toBeNull();
  expect(player.astra).toBe(500);
  expect(player.stats).toMatchObject({ health: 100, power: 100, stamina: 50, exp: 100 });
  expect(result.reply.join(" ")).toContain("lost 500 astra and 100 exp");
});

test("timeout ends combat and the run without changing resources, currency, or experience", () => {
  puzzle("circuit");
  const stats = { ...player.stats };
  player.dungeon.deadline = Date.now() - 1;
  expect(expireIfNeeded()).toContain("Time is up!");
  expect(endCombat).toHaveBeenCalledTimes(1);
  expect(player.dungeon).toBeNull();
  expect(player.stats).toEqual(stats);
  expect(player.astra).toBe(1000);
});

test("an active run does not expire early", () => {
  puzzle("circuit");
  expect(expireIfNeeded()).toBeNull();
  expect(endCombat).not.toHaveBeenCalled();
  expect(player.dungeon).not.toBeNull();
});

test("board offers keep eight stages and at most three distinct puzzles", () => {
  player = { level: 20, stats: {} };
  const board = getBoard();
  expect(board.offers).toHaveLength(3);
  board.offers.forEach((offer) => {
    expect(offer.steps).toHaveLength(8);
    const puzzles = offer.steps.filter((step) => step.kind === "puzzle");
    expect(puzzles.length).toBeGreaterThanOrEqual(1);
    expect(puzzles.length).toBeLessThanOrEqual(3);
    expect(new Set(puzzles.map((step) => step.puzzle)).size).toBe(puzzles.length);
  });
});

test.each(DUNGEON_TYPE_IDS)("%s generates playable themed versions of all four new puzzles", (id) => {
  for (const kind of ["circuit", "scales", "path", "pairs"]) {
    puzzle(kind, id);
    expect(getDungeonText()).toContain(DUNGEON_TYPES[id].puzzles.find((p) => p.kind === kind).name);
    expect(getDungeonOptions().length).toBeGreaterThan(0);
  }
});

test("circuits toggle only immediate neighbors and can be solved without damage", () => {
  const pz = puzzle("circuit");
  const original = [...pz.runes];
  choose("Toggle rune 1");
  expect(player.dungeon.pz.runes).toEqual(original.map((lit, i) => i < 2 ? !lit : lit));
  choose("Toggle rune 1");
  const solution = Array.from({ length: 32 }, (_, mask) => mask).find((mask) => {
    const runes = [...original];
    for (let i = 0; i < 5; i++) if (mask & (1 << i))
      for (let j = 0; j < 5; j++) if (Math.abs(i - j) <= 1) runes[j] = !runes[j];
    return runes.every(Boolean);
  });
  expect(solution).toBeDefined();
  for (let i = 0; i < 5; i++) if (solution & (1 << i)) choose(`Toggle rune ${i + 1}`);
  choose("Check circuit");
  expect(player.dungeon.index).toBe(1);
  expect(player.astra).toBe(1450);
});

test("an incorrect circuit check preserves the board and increases mistake damage", () => {
  const { runes } = puzzle("circuit");
  choose("Check circuit");
  expect(player.stats.health).toBe(80);
  expect(player.dungeon.pz).toMatchObject({ runes, mistakes: 1 });
  choose("Check circuit");
  expect(player.stats.health).toBe(55);
});

test("scales allow adding and removing weights, and accept any exact balance", () => {
  const { weights, target } = puzzle("scales");
  expect(new Set(weights).size).toBe(6);
  choose(`Add weight ${weights[0]}`);
  choose(`Remove weight ${weights[0]}`);
  expect(player.dungeon.pz.selected).toEqual([]);
  const mask = Array.from({ length: 64 }, (_, i) => i).find((bits) =>
    weights.reduce((sum, n, i) => sum + (bits & (1 << i) ? n : 0), 0) === target);
  expect(mask).toBeDefined();
  weights.forEach((weight, i) => { if (mask & (1 << i)) choose(`Add weight ${weight}`); });
  choose("Check balance");
  expect(player.dungeon.index).toBe(1);
});

test("an incorrect balance hurts but preserves the weights and target", () => {
  const { weights, target } = puzzle("scales");
  choose("Check balance");
  expect(player.stats.health).toBe(80);
  expect(player.dungeon.pz).toMatchObject({ weights, target, mistakes: 1, selected: [] });
});

const findPath = (grid, row, column) => {
  if (row === grid.length) return [];
  for (let c = 0; c < 3; c++) {
    if (Math.abs(c - column) > 1 || !grid[row][c]) continue;
    const rest = findPath(grid, row + 1, c);
    if (rest) return [c, ...rest];
  }
  return null;
};

test("safe paths always have a reachable exit, allow backtracking, and can be solved", () => {
  for (let sample = 0; sample < 30; sample++) {
    const { grid, start, exit } = puzzle("path");
    const route = findPath(grid, 0, start);
    expect(route).not.toBeNull();
    expect(route[route.length - 1]).toBe(exit);
    expect(getDungeonText()).toContain("O = intact, X = trapped");
    choose(`Step to column ${route[0] + 1}`);
    choose("Step back");
    expect(player.dungeon.pz.visited).toEqual([]);
    route.forEach((c) => choose(`Step to column ${c + 1}`));
    expect(player.dungeon.index).toBe(1);
    expect(player.stats.health).toBe(100);
  }
});

test("a trapped path tile hurts and leaves the player in the same position", () => {
  puzzle("path");
  player.dungeon.pz = { ...player.dungeon.pz, start: 1, grid: [[true, false, true], [true, true, true]], visited: [] };
  choose("Step to column 2");
  expect(player.stats.health).toBe(80);
  expect(player.dungeon.pz.visited).toEqual([]);
  expect(player.dungeon.pz.mistakes).toBe(1);
});

test("rune pairs contain four pairs, retain revealed mismatches, and preserve matching progress", () => {
  const { cards } = puzzle("pairs");
  const symbols = [...new Set(cards)];
  expect(symbols).toHaveLength(4);
  symbols.forEach((symbol) => expect(cards.filter((card) => card === symbol)).toHaveLength(2));
  const first = 0;
  const second = cards.findIndex((card) => card !== cards[first]);
  choose(`Reveal rune ${first + 1}`);
  expect(getDungeonOptions().some((o) => o.label === "Reveal rune 1")).toBe(false);
  choose(`Reveal rune ${second + 1}`);
  expect(player.stats.health).toBe(95);
  expect(player.dungeon.pz.open).toEqual([first, second]);
  expect(getDungeonOptions().map((o) => o.label)).toEqual(["Cover unmatched runes"]);
  expect(getDungeonText()).toContain(`Rune 1: ${cards[first]}`);
  choose("Cover unmatched runes");
  expect(player.dungeon.pz.cards).toEqual(cards);
  for (const symbol of symbols) {
    cards.forEach((card, i) => { if (card === symbol) choose(`Reveal rune ${i + 1}`); });
  }
  expect(player.dungeon.index).toBe(1);
  expect(player.astra).toBe(1300);
});

test.each(["scales", "path", "pairs"])("%s restores empty arrays removed by Firebase", (kind) => {
  puzzle(kind);
  const fields = { scales: ["selected"], path: ["visited"], pairs: ["open", "matched"] }[kind];
  fields.forEach((field) => { delete player.dungeon.pz[field]; });
  fields.forEach((field) => expect(getRun().pz[field]).toEqual([]));
  expect(getDungeonOptions().length).toBeGreaterThan(0);
  expect(getDungeonText()).not.toContain("undefined");
});
