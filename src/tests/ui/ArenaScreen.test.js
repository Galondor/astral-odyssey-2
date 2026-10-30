import { fireEvent, render, screen, within } from "@testing-library/react";
import ArenaScreen from "../../ui/ArenaScreen";

jest.mock("../../ui/LeaderboardScreen", () => ({ arenaOnly }) =>
  <div>{arenaOnly ? "Colosseum leaderboard" : "Leaderboards"}</div>);
jest.mock("../../world/contest", () => ({
  CONTEST_MIN_LEVEL: 25,
  getContestStatus: () => ({ ready: true }),
  subscribeContest: () => () => {},
  sendContestCommand: jest.fn(),
}));
jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(),
  setPlayer: jest.fn(),
}));
jest.mock("../../combat/combat", () => ({
  endCombat: jest.fn(),
  getEnemy: jest.fn(),
  startCombat: jest.fn(),
}));

test("Arena locks Contest and Colosseum tabs below their required levels", () => {
  render(<ArenaScreen player={{ level: 4 }} />);

  expect(screen.getByRole("heading", { name: "Arena" })).toBeTruthy();
  expect(within(screen.getByRole("tablist", { name: "Arena" })).getAllByRole("tab").map((tab) => tab.textContent))
    .toEqual(["Level 25+", "Level 5+", "Boss Rush"]);
  expect(screen.getByRole("tablist", { name: "Arena" }).classList.contains("arena-tabs")).toBe(true);
  expect(screen.getByRole("tab", { name: "Level 25+" }).classList.contains("arena-tab-pvp")).toBe(true);
  expect(screen.getByRole("tab", { name: "Level 25+" }).disabled).toBe(true);
  expect(screen.getByRole("tab", { name: "Level 5+" }).disabled).toBe(true);
});

test("Contest and Colosseum tabs unlock at levels 25 and 5", () => {
  const { rerender } = render(<ArenaScreen player={{ level: 5 }} />);
  expect(screen.getByRole("tab", { name: "Level 25+" }).disabled).toBe(true);
  expect(screen.getByRole("tab", { name: "Colosseum" }).disabled).toBe(false);
  expect(screen.getByRole("tabpanel", { name: "Colosseum" }).querySelector("button").textContent).toBe("Enter Colosseum");

  rerender(<ArenaScreen player={{ level: 25 }} />);
  expect(screen.getByRole("tab", { name: "Contest" }).disabled).toBe(false);
  expect(screen.getByRole("tab", { name: "Colosseum" }).disabled).toBe(false);
});

test("Contest content and Boss Rush remain available after unlocking", () => {
  render(<ArenaScreen player={{ level: 25 }} />);
  expect(screen.getByRole("tab", { name: "Contest" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tab", { name: "Contest" }).classList.contains("arena-tab-pvp")).toBe(true);
  expect(within(screen.getByRole("tabpanel", { name: "Contest" })).getByRole("button", { name: "Join Contest queue" })).toBeTruthy();

  const bossRush = screen.getByRole("tab", { name: "Boss Rush" });
  fireEvent.click(bossRush);
  expect(within(screen.getByRole("tabpanel", { name: "Boss Rush" })).getByText("Coming soon")).toBeTruthy();
});

test("Colosseum entry is disabled during an existing battle", () => {
  render(<ArenaScreen player={{ level: 5 }} inCombat />);

  fireEvent.click(screen.getByRole("tab", { name: "Colosseum" }));

  expect(screen.getByRole("button", { name: "Enter Colosseum" }).disabled).toBe(true);
  expect(screen.getByText("Finish your current battle before entering the Colosseum.")).toBeTruthy();
});

test("Colosseum button shows its proper name once the player reaches level 5", () => {
  render(<ArenaScreen player={{ level: 5 }} />);
  fireEvent.click(screen.getByRole("tab", { name: "Colosseum" }));
  expect(screen.getByRole("button", { name: "Enter Colosseum" }).disabled).toBe(false);
  expect(screen.queryByText(/entry requires level 5/i)).toBeNull();
});

test("Colosseum shows the highest cleared wave and its leaderboard", () => {
  render(<ArenaScreen player={{ level: 5, records: { highestClearedColosseumWave: 12, highestColosseumWave: 20 } }} />);
  fireEvent.click(screen.getByRole("tab", { name: "Colosseum" }));
  expect(screen.getByText("Highest cleared wave: 12")).toBeTruthy();
  expect(screen.getByText("Colosseum leaderboard")).toBeTruthy();
});
