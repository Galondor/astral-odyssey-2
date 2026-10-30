import { fireEvent, render, screen } from "@testing-library/react";
import LeaderboardScreen from "../../ui/LeaderboardScreen";
import { getLeaderboards } from "../../world/leaderboards";

jest.mock("../../firebase", () => ({ db: {}, auth: { currentUser: { uid: "alice" } } }));
jest.mock("../../character/player", () => ({ getCharacterIdentity: () => "alice" }));
jest.mock("../../world/leaderboards", () => ({
  ...jest.requireActual("../../world/leaderboards"),
  getLeaderboards: jest.fn(),
}));

beforeEach(() => {
  getLeaderboards.mockResolvedValue({
    fetchedAt: Date.now(),
    entries: {
      alice: { name: "Alice", level: 5, gearScore: 10, astra: 50, highestClearedColosseumWave: 7 },
    },
  });
});

test("the leaderboard screen includes cleared Colosseum waves", async () => {
  render(<LeaderboardScreen />);
  fireEvent.click(screen.getByRole("tab", { name: /highest colosseum wave/i }));
  expect(await screen.findByText("Alice")).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "Cleared wave" })).toBeTruthy();
  expect(screen.getByRole("cell", { name: "7" })).toBeTruthy();
});

test("the arena leaderboard opens directly on cleared-wave rankings", async () => {
  render(<LeaderboardScreen arenaOnly />);
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.getByRole("heading", { name: "Colosseum leaderboard" })).toBeTruthy();
  expect(await screen.findByRole("cell", { name: "7" })).toBeTruthy();
});
