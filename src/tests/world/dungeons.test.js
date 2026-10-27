import { getPlayer, setPlayer } from "../../character/player";
import { endCombat, startCombat, takeOpeningReplies } from "../../combat/combat";
import { ENEMIES, rollMaterialDrops } from "../../combat/enemies";
import { MATERIALS } from "../../items/materials";
import { DUNGEON_TYPES, DUNGEON_TYPE_IDS } from "../../world/dungeonData";
import {
  expireIfNeeded, getBoard, getBoardSlot, getDungeonOptions, getDungeonText, getRun,
  ARCHITECTS_RUNE_DROP_CHANCE, DUNGEON_REROLL_COST, NAME_ELIXIR_DROP_CHANCE, rerollDungeons, startDungeon,
} from "../../world/dungeons";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
let mockEnemy;
jest.mock("../../combat/combat", () => ({
  applyDeathPenalties: jest.requireActual("../../combat/combat").applyDeathPenalties,
  startCombat: jest.fn((foe) => { mockEnemy = foe; }),
  endCombat: jest.fn(),
  getEnemy: () => mockEnemy,
  takeOpeningReplies: jest.fn(() => []),
}));
jest.mock("../../firebase", () => ({ db: {} }));

const type = DUNGEON_TYPES[DUNGEON_TYPE_IDS[0]];
let player;

beforeEach(() => {
  jest.clearAllMocks();
  mockEnemy = null;
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
});

function enemy(tier = "boss", dungeon = type, templateIndex = 0) {
  const template = (tier === "boss" ? dungeon.bosses : tier === "elite" ? dungeon.elites : dungeon.basics)[templateIndex];
  player = {
    name: "Alice", level: 20, stats: {}, consumables: { elixirOfNameChanging: 2 },
    dungeon: {
      type: dungeon.id, name: dungeon.name, level: 20, index: 0,
      steps: [{ kind: "fight", tier, tpl: template.id }, { kind: "fight", tier: "boss", tpl: dungeon.bosses[0].id }],
    },
  };
  getDungeonOptions()[0].onSelect();
  return startCombat.mock.calls.at(-1)[0];
}

afterEach(() => jest.restoreAllMocks());

test("a lethal opening dungeon attack returns to the dungeon instead of combat", () => {
  enemy("basic");
  const replies = ["The enemy attacks first.", "You collapse inside the dungeon."];
  startCombat.mockImplementationOnce(() => { mockEnemy = null; });
  takeOpeningReplies.mockReturnValueOnce(replies);

  const result = getDungeonOptions()[0].onSelect();

  expect(result).toEqual({ reply: replies, next: "menu" });
});

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

test.each([
  ["basic", 100, 81],
  ["elite", 300, 242],
  ["boss", 700, 564],
])("dungeon %s enemy rewards half astra and exp", (tier, astra, exp) => {
  const foe = enemy(tier);

  expect(foe.astra).toBe(astra);
  expect(foe.exp).toBe(exp);
});

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

const dungeonEnemies = DUNGEON_TYPE_IDS.flatMap((id) =>
  [["basic", "basics"], ["elite", "elites"], ["boss", "bosses"]].flatMap(([tier, group]) =>
    DUNGEON_TYPES[id][group].map((template, index) => [id, tier, index, template])));

test.each(dungeonEnemies)(
  "%s %s enemy %s has substantially reduced material quantities and chances",
  (id, tier, index, template) => {
    const dungeon = DUNGEON_TYPES[id];
    const foe = enemy(tier, dungeon, index);
    jest.spyOn(Math, "random").mockReturnValue(0);
    const drops = rollMaterialDrops(foe);
    const exclusiveKeys = DUNGEON_TYPE_IDS.flatMap((key) => Object.values(DUNGEON_TYPES[key].materials));
    expect(Object.keys(drops).filter((key) => exclusiveKeys.includes(key))).toEqual([dungeon.materials[tier]]);
    expect(drops[dungeon.materials[tier]]).toBe(1);
    expect(foe.materialAmount).toBe(1);
    foe.drops.forEach((drop) => expect(MATERIALS[drop.key]).toBeDefined());
    const ordinary = foe.drops.filter((drop) => !["legendary", "unique"].includes(MATERIALS[drop.key].tier));
    ordinary.forEach((drop) => {
      const base = template.drops?.find((d) => d.key === drop.key) || { chance: 1, max: 2 };
      expect(drop).toMatchObject({ chance: base.chance / 2, min: 1, max: Math.ceil(base.max / 4) });
      Math.random.mockReturnValueOnce(drop.chance);
      expect(rollMaterialDrops({ ...foe, drops: [drop] })).toEqual({});
      Math.random.mockReturnValueOnce(0).mockReturnValueOnce(0.999999);
      expect(rollMaterialDrops({ ...foe, drops: [drop] })).toEqual({ [drop.key]: drop.max });
    });
  },
);

test.each(dungeonEnemies.filter(([, tier]) => tier === "boss"))(
  "%s boss %s %s has fixed legendary and unique material rates and quantities",
  (id, tier, index) => {
    const foe = enemy(tier, DUNGEON_TYPES[id], index);
    const random = jest.spyOn(Math, "random");
    const rareDrops = foe.drops.filter((drop) => ["legendary", "unique"].includes(MATERIALS[drop.key].tier));
    expect(rareDrops.some((drop) => MATERIALS[drop.key].tier === "unique")).toBe(true);
    rareDrops.forEach((drop) => {
      const legendary = MATERIALS[drop.key].tier === "legendary";
      const chance = legendary ? 0.5 : 0.1;
      expect(drop).toMatchObject({ chance, min: 1, max: legendary ? 2 : 1 });
      for (const bonus of [0, 0.75]) {
        for (const roll of [0, chance - 0.000001, chance, 0.999999]) {
          for (const quantityRoll of [0, 0.499999, 0.5, 0.999999]) {
            random.mockReturnValueOnce(roll).mockReturnValueOnce(quantityRoll);
            expect(rollMaterialDrops({ ...foe, drops: [drop] }, bonus)).toEqual(
              roll < chance ? { [drop.key]: legendary && quantityRoll >= 0.5 ? 2 : 1 } : {},
            );
            random.mockReset();
          }
        }
      }
    });
  },
);

test("ordinary dungeon materials and overworld materials retain luck bonuses", () => {
  const random = jest.spyOn(Math, "random").mockReturnValue(0.6);
  const ordinary = { dungeon: true, materialAmount: 1, drops: [{ key: type.materials.basic, chance: 0.5, min: 1, max: 1 }] };
  expect(rollMaterialDrops(ordinary, 0.2)).toEqual({ [type.materials.basic]: 1 });
  const overworld = { materialAmount: 2, drops: [{ key: "wraith_crown", chance: 0.5, min: 1, max: 1 }] };
  expect(rollMaterialDrops(overworld, 0.2)).toEqual({ wraith_crown: 2 });
  random.mockReturnValue(0.7);
  expect(rollMaterialDrops(ordinary, 0.2)).toEqual({});
  expect(rollMaterialDrops(overworld, 0.2)).toEqual({});
});

test.each([12, 20, 50, 100])("boss completion at level %s adds only one essence and preserves kill materials", (level) => {
  const boss = enemy();
  player.dungeon.level = level;
  jest.spyOn(Math, "random").mockReturnValue(0.9);
  const patch = { materials: { [type.materials.boss]: 1, primal_essence: 7 } };
  const replies = [];
  boss.onDefeat(player, {}, patch, replies);
  const completionAstra = Math.round(Math.round(level * 45) / 2);
  expect(patch.astra).toBe(completionAstra);
  expect(patch.materials).toEqual({ [type.materials.boss]: 1, primal_essence: 8 });
  expect(replies.join(" ")).toContain(`Completion bonus: ${completionAstra}`);
  expect(replies.join(" ")).toContain("and 1 {{Primal Essence|material:primal_essence}}");
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
  const combat = jest.requireActual("../../combat/combat");
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

test("board offers scale above level 100 with the player's gear score", () => {
  player = { level: 100, stats: { gearScore: 30_000 } };
  jest.spyOn(Math, "random").mockReturnValue(0);

  const board = getBoard();

  expect(board.offers).toHaveLength(3);
  expect(board.offers.every((offer) => offer.level > 100)).toBe(true);
});

test("rerolling the board charges 300,000 astra and generates new offers", () => {
  player = { level: 20, astra: 400_000, stats: {}, dungeonBoard: { slot: getBoardSlot(), generation: 0, offers: [{ id: "old" }] } };
  const result = rerollDungeons();
  expect(result).toEqual({ ok: true });
  expect(player.astra).toBe(400_000 - DUNGEON_REROLL_COST);
  expect(player.dungeonBoard.generation).toBe(1);
  expect(player.dungeonBoard.offers).toHaveLength(3);
  expect(player.dungeonBoard.offers.every((offer) => offer.id !== "old")).toBe(true);
});

test("rerolling is rejected without enough astra or during a dungeon or fight", () => {
  player = { level: 20, astra: DUNGEON_REROLL_COST - 1, stats: {}, dungeonBoard: { slot: getBoardSlot(), offers: [] } };
  expect(rerollDungeons()).toMatchObject({ ok: false, message: expect.stringContaining("300,000 astra") });
  expect(player.astra).toBe(DUNGEON_REROLL_COST - 1);

  player.astra = DUNGEON_REROLL_COST;
  player.dungeon = { name: "Active dungeon" };
  expect(rerollDungeons()).toMatchObject({ ok: false });
  player.dungeon = null;
  mockEnemy = { name: "Enemy" };
  expect(rerollDungeons()).toMatchObject({ ok: false, message: "Finish your fight first." });
  expect(player.astra).toBe(DUNGEON_REROLL_COST);
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
  expect(player.astra).toBe(1225);
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
    expect(getDungeonText()).toContain(`[green]${route[0] + 1}:O[/green]`);
    choose("Step back");
    expect(player.dungeon.pz.visited).toEqual([]);
    expect(getDungeonText()).not.toContain("[green]");
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
  expect(player.astra).toBe(1150);
});

test.each(["scales", "path", "pairs"])("%s restores empty arrays removed by Firebase", (kind) => {
  puzzle(kind);
  const fields = { scales: ["selected"], path: ["visited"], pairs: ["open", "matched"] }[kind];
  fields.forEach((field) => { delete player.dungeon.pz[field]; });
  fields.forEach((field) => expect(getRun().pz[field]).toEqual([]));
  expect(getDungeonOptions().length).toBeGreaterThan(0);
  expect(getDungeonText()).not.toContain("undefined");
});
