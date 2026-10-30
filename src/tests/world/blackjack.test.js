import { getPlayer, setPlayer } from "../../character/player";
import { blackjackStand, clearBlackjack, getBlackjackGame, startBlackjack } from "../../world/blackjack";

jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(),
  setPlayer: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  clearBlackjack();
  getPlayer.mockReturnValue({ astra: 100, records: {} });
});

afterEach(() => {
  jest.restoreAllMocks();
  clearBlackjack();
});

test("blackjack losses add the lost stake to character records", () => {
  jest.spyOn(Math, "random").mockReturnValue(0.99);
  expect(startBlackjack("bet 10").over).toBe(false);
  getBlackjackGame().dealer = [
    { rank: "A", suit: "♠" },
    { rank: "K", suit: "♠" },
  ];

  blackjackStand();

  expect(setPlayer).toHaveBeenCalledWith({
    astra: 90,
    records: { totalAstraLostInBlackjack: 10 },
  });
});

test("the b half shortcut bets half the player's current astra", () => {
  jest.spyOn(Math, "random").mockReturnValue(0.99);
  getPlayer.mockReturnValue({ astra: 101, records: {} });

  startBlackjack("b half");

  expect(getBlackjackGame().bet).toBe(50);
});
