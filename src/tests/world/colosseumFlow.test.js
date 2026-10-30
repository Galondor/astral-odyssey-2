import { getPlayer, setPlayer } from "../../character/player";
import {
  attackRound,
  endCombat,
  getEnemy,
  startCombat,
  takeOpeningReplies,
} from "../../combat/combat";
import { endColosseumRun, beginColosseumRun, getColosseumStatus } from "../../world/colosseum";
import { getVisibleOptions, processButton, scenes } from "../../world/gameLogic";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../character/player", () => ({
  Player: jest.fn(),
  getPlayer: jest.fn(),
  savePlayerName: jest.fn(),
  setPlayer: jest.fn(),
}));
jest.mock("../../combat/combat", () => ({
  attackRound: jest.fn(),
  consumeItemRound: jest.fn(),
  defendRound: jest.fn(),
  endCombat: jest.fn(),
  getCombatRound: jest.fn(),
  getEnemy: jest.fn(),
  getMarrowWard: jest.fn(),
  getPlayerStatuses: jest.fn(),
  isPlayerDefending: jest.fn(),
  isPlayerStunned: jest.fn(),
  passRound: jest.fn(),
  startCombat: jest.fn(),
  takeOpeningReplies: jest.fn(),
}));

let player;
let enemy;

beforeEach(() => {
  jest.clearAllMocks();
  endColosseumRun();
  player = {
    level: 5,
    astra: 0,
    stats: { health: 100, maxHealth: 100, attackMin: 5, attackMax: 10, speed: 10 },
  };
  enemy = null;
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => {
    player = { ...player, ...patch };
  });
  getEnemy.mockImplementation(() => enemy);
  takeOpeningReplies.mockReturnValue([]);
  startCombat.mockImplementation((template) => {
    enemy = template;
  });
  attackRound.mockReturnValue({
    replies: ["The gladiator falls."],
    over: true,
    outcome: "victory",
  });
});

afterEach(() => {
  endColosseumRun();
  endCombat();
});

test("victory advances through the pattern and offers a choice after the boss", () => {
  const started = beginColosseumRun(10_000);
  startCombat(started.enemy);

  for (let wave = 1; wave <= 5; wave++) {
    const result = processButton("combat", "Melee Attack");
    if (wave < 5) {
      expect(result.sceneId).toBe("combat");
      expect(enemy.colosseumWave).toBe(wave + 1);
    } else {
      expect(result.sceneId).toBe("dynamic");
      expect(result.replies.join(" ")).toContain("The gladiator falls.");
      expect(getVisibleOptions(scenes.dynamic).map(({ label }) => label)).toEqual(["Continue", "Quit"]);
    }
  }

  const continued = processButton("dynamic", "Continue");
  expect(continued.sceneId).toBe("combat");
  expect(enemy).toMatchObject({ colosseumWave: 6, colosseumWaveType: "basic" });
  expect(player.records?.highestClearedColosseumWave).toBeUndefined();
  expect(getColosseumStatus(player).active).toBe(true);
});

test("leaving a Colosseum battle ends the run without continuing the fight", () => {
  const started = beginColosseumRun(10_000);
  startCombat(started.enemy);

  const result = processButton("combat", "Leave Colosseum");

  expect(result.sceneId).toBe("menu");
  expect(getColosseumStatus(player).active).toBe(false);
  expect(endCombat).toHaveBeenCalled();
});

test("quitting after a boss wave ends the run", () => {
  const started = beginColosseumRun(10_000);
  startCombat(started.enemy);
  let result;
  for (let wave = 1; wave <= 5; wave++)
    result = processButton("combat", "Melee Attack");

  expect(result.sceneId).toBe("dynamic");
  expect(processButton("dynamic", "Quit").sceneId).toBe("menu");
  expect(getColosseumStatus(player).active).toBe(false);
});

test("a player collapse ends the active Colosseum run", () => {
  const started = beginColosseumRun(10_000);
  startCombat(started.enemy);
  attackRound.mockReturnValue({
    replies: ["You Collapse."],
    over: true,
    outcome: "collapse",
  });

  const result = processButton("combat", "Melee Attack");

  expect(result.sceneId).toBe("menu");
  expect(getColosseumStatus(player).active).toBe(false);
  expect(startCombat).toHaveBeenCalledTimes(1);
});
