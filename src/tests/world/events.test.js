import { getPlayer } from "../../character/player";
import {
  getEnemy,
  startCombat,
  takeOpeningReplies,
} from "../../combat/combat";
import { getRandomEnemy } from "../../combat/enemies";
import { travelEvents } from "../../world/events";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn() }));
jest.mock("../../combat/combat", () => ({
  collapse: jest.fn(),
  getEnemy: jest.fn(),
  startCombat: jest.fn(),
  takeOpeningReplies: jest.fn(),
}));
jest.mock("../../combat/enemies", () => ({
  getRandomEnemy: jest.fn(),
  hasEnemy: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  getPlayer.mockReturnValue(null);
  getEnemy.mockReturnValue(null);
});

afterEach(() => jest.restoreAllMocks());

test("a failed flee returns to the menu if the enemy's opening turn ends combat", () => {
  const enemy = { name: "Ambusher" };
  const openingReplies = ["The Ambusher attacks first!", "You collapse."];
  const player = { stats: { speed: 0 } };
  getRandomEnemy.mockReturnValue(enemy);
  takeOpeningReplies.mockReturnValue(openingReplies);
  jest.spyOn(Math, "random").mockReturnValue(0.5);

  const encounter = travelEvents.find(({ id }) => id === "eliteEncounter");
  const result = encounter.run({ player, region: "Meadowlands" })
    .options.find(({ label }) => label === "Flee")
    .onSelect();

  expect(startCombat).toHaveBeenCalledWith(enemy, { enemyFirst: true });
  expect(result).toEqual({
    next: "menu",
    reply: ["You fail to escape!", ...openingReplies],
  });
});
