import {
  createLabyrinth,
  LABYRINTH_FLOOR_COUNT,
  moveInLabyrinth,
  solveLabyrinthPuzzle,
} from "../../world/labyrinth";
import { getPlayer, setPlayer } from "../../character/player";
import { startCombat } from "../../combat/combat";
import { rollMaterialDrops } from "../../combat/enemies";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(),
  setPlayer: jest.fn(),
}));
jest.mock("../../combat/combat", () => ({
  applyDeathPenalties: jest.fn(),
  startCombat: jest.fn(),
}));

const reachable = (floor, destination) => {
  const queue = [{ x: 1, y: 1 }];
  const seen = new Set(["1,1"]);
  while (queue.length) {
    const position = queue.shift();
    if (position.x === destination.x && position.y === destination.y) return true;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const x = position.x + dx;
      const y = position.y + dy;
      const key = `${x},${y}`;
      const tile = floor.tiles[y * 9 + x];
      if (tile && tile.type !== "wall" && !seen.has(key)) {
        seen.add(key);
        queue.push({ x, y });
      }
    }
  }
  return false;
};

test("weekly Labyrinth generation creates five connected, progressively scaled floors", () => {
  const labyrinth = createLabyrinth({ level: 30, stats: { gearScore: 200 } }, new Date("2026-03-08T12:00:00Z"));

  expect(labyrinth.floors).toHaveLength(LABYRINTH_FLOOR_COUNT);
  labyrinth.floors.forEach((floor, index) => {
    expect(floor.number).toBe(index + 1);
    expect(floor.level).toBeGreaterThan(0);
    expect(reachable(floor, { x: 5, y: 5 })).toBe(true);
    expect(reachable(floor, { x: 7, y: 7 })).toBe(true);
    expect(floor.tiles.some((tile) => tile.type === "secret")).toBe(true);
  });
  expect(labyrinth.floors[1].level).toBe(labyrinth.floors[0].level + 3);
  expect(labyrinth.floors[4].tiles[7 * 9 + 7]).toMatchObject({ type: "boss", enemyId: "the_unwritten_king" });
});

let player;
beforeEach(() => {
  jest.clearAllMocks();
  player = {
    id: "test-player",
    level: 30,
    stats: { health: 100, maxHealth: 100, stamina: 30, maxStamina: 30, gearScore: 200 },
  };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => {
    player = { ...player, ...patch };
  });
});

test("each Labyrinth move costs five stamina and refuses moves below the cost", () => {
  const state = createLabyrinth(player);
  state.active = true;
  const nextTile = state.floors[0].tiles[1 * 9 + 2];
  nextTile.type = "empty";
  state.floors[0].tiles[1 * 9 + 3].type = "empty";
  player.labyrinth = state;

  expect(moveInLabyrinth(2, 1)).toMatchObject({ ok: true });
  expect(player.stats.stamina).toBe(25);
  player.stats.stamina = 4;
  expect(moveInLabyrinth(3, 1)).toMatchObject({
    ok: false,
    message: "You need 5 stamina to move. Return to a checkpoint to recover.",
  });
  expect(player.stats.stamina).toBe(4);
});

test("a pending puzzle can only be solved from its tile", () => {
  const state = createLabyrinth(player);
  state.active = true;
  const puzzle = state.floors[0].tiles[1 * 9 + 2];
  puzzle.type = "puzzle";
  puzzle.answer = "◆";
  state.pendingEncounter = { kind: "puzzle", floor: 0, x: 2, y: 1 };
  player.labyrinth = state;

  expect(solveLabyrinthPuzzle("◆")).toMatchObject({
    ok: false,
    message: "You must stand on the puzzle tile to solve it.",
  });
  state.floors[0].position = { x: 2, y: 1 };
  expect(solveLabyrinthPuzzle("◆")).toMatchObject({ ok: true });
});

test("Labyrinth combat callbacks persist the full results for the expedition footer", () => {
  const state = createLabyrinth(player);
  state.active = true;
  const enemyTile = state.floors[0].tiles[1 * 9 + 2];
  enemyTile.type = "enemy";
  enemyTile.enemyId = "maze_stalker";
  enemyTile.tier = "basic";
  player.labyrinth = state;

  expect(moveInLabyrinth(2, 1)).toMatchObject({ ok: true, encounter: "combat" });
  const enemy = startCombat.mock.calls[0][0];
  const replies = ["The Maze Stalker falls!", "Materials gained: Maze-Etched Fang."];
  const patch = {};
  enemy.onDefeat(player, player.stats, patch, replies);

  expect(patch.labyrinth.lastCombatResults).toEqual(replies);
  expect(patch.labyrinth.floors[0].tiles[1 * 9 + 2].resolved).toBe(true);
});

test("the final boss guarantees one and drops no more than two Unwritten Crown Fragments", () => {
  const state = createLabyrinth(player);
  state.active = true;
  state.currentFloor = LABYRINTH_FLOOR_COUNT - 1;
  const finalFloor = state.floors[state.currentFloor];
  const bossTile = finalFloor.tiles[1 * 9 + 2];
  bossTile.type = "boss";
  bossTile.enemyId = "the_unwritten_king";
  bossTile.tier = "boss";
  player.labyrinth = state;

  expect(moveInLabyrinth(2, 1)).toMatchObject({ ok: true, encounter: "combat" });
  const boss = startCombat.mock.calls.at(-1)[0];
  const crownDrop = boss.drops.find((drop) => drop.key === "labyrinth_crown_fragment");
  expect(crownDrop).toMatchObject({ chance: 1, min: 1, max: 2 });
  jest.spyOn(Math, "random")
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0.999)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0.999)
    .mockReturnValueOnce(0.999);
  expect(rollMaterialDrops(boss).labyrinth_crown_fragment).toBe(1);
  expect(rollMaterialDrops(boss).labyrinth_crown_fragment).toBe(2);
});
