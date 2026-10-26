import { fireEvent, render, screen } from "@testing-library/react";
import { SCREENS } from "../../ui/screens";
import { getBoard, getRun, rerollDungeons, startDungeon } from "../../world/dungeons";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../ui/ChangelogScreen", () => () => null);
jest.mock("../../ui/LeaderboardScreen", () => () => null);
jest.mock("../../ui/InboxScreen", () => () => null);
jest.mock("../../ui/MarketplaceScreen", () => () => null);
jest.mock("../../ui/AdminScreen", () => () => null);
jest.mock("../../ui/BugReportScreen", () => () => null);
jest.mock("../../world/dungeons", () => ({
  ...jest.requireActual("../../world/dungeons"),
  getBoard: jest.fn(),
  getRun: jest.fn(),
  rerollDungeons: jest.fn(),
  startDungeon: jest.fn(),
}));

const DungeonsScreen = SCREENS.dungeons.component;

test("screen registry keeps permanent navigation grouped before contextual screens", () => {
  const groups = ["adventure", "character", "community", undefined].map((group) =>
    Object.entries(SCREENS).filter(([, definition]) => definition.sidebarGroup === group).map(([key]) => key)
  );
  expect(groups).toEqual([
    ["adventure", "dungeons", "arena"],
    ["character", "progression", "quests", "inbox"],
    ["leaderboards", "changelog", "bugReport"],
    ["admin", "combat", "dungeonRun", "crafting", "gearTrader", "marketplace", "questBoard"],
  ]);
  expect(Object.keys(SCREENS)).toEqual(groups.flat());
  expect(SCREENS.arena.link).toBe(true);
});

const offer = {
  id: "crypt-offer", type: "crypt", name: "Sunken Crypt", level: 20,
  boss: "dgCryptLich", elite: "dgCryptKnight",
  steps: [{ kind: "puzzle", puzzle: 0 }], cleared: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  getBoard.mockReturnValue({ offers: [offer] });
  getRun.mockReturnValue(null);
  startDungeon.mockReturnValue({ ok: true });
  rerollDungeons.mockReturnValue({ ok: true });
});

test("available dungeons are playable and navigate into the run", () => {
  const goToScene = jest.fn();
  render(<DungeonsScreen player={{ level: 20 }} goToScene={goToScene} />);
  expect(screen.getByRole("heading", { name: "Adventures" })).toBeTruthy();
  const adventureTabs = screen.getAllByRole("button").filter((button) =>
    ["Solo Dungeons", "Labyrinth", "Group Dungeons"].includes(button.textContent)
  );
  expect(adventureTabs.map((button) => button.textContent)).toEqual(["Solo Dungeons", "Labyrinth", "Group Dungeons"]);
  expect(screen.getByRole("button", { name: "Labyrinth" }).disabled).toBe(true);
  expect(screen.getByRole("button", { name: "Raids (Coming Soon)" }).disabled).toBe(true);
  expect(screen.queryByText(/under construction/i)).toBeNull();
  const button = screen.getByRole("button", { name: "Enter Dungeon" });
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  expect(startDungeon).toHaveBeenCalledWith(offer.id);
  expect(goToScene).toHaveBeenCalledWith("dungeon");
});

test.each(["cleared", "active", "combat", "level"])("entry remains disabled for %s restrictions", (restriction) => {
  if (restriction === "cleared") getBoard.mockReturnValue({ offers: [{ ...offer, cleared: true }] });
  if (restriction === "active") getRun.mockReturnValue({ name: "Sunken Crypt", deadline: Date.now() + 60000 });
  render(<DungeonsScreen player={{ level: restriction === "level" ? 9 : 20 }} goToScene={jest.fn()} inCombat={restriction === "combat"} />);
  const button = screen.getByRole("button", { name: restriction === "cleared" ? "Cleared" : "Enter Dungeon" });
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(startDungeon).not.toHaveBeenCalled();
});

test("failed entry displays the reason without navigating", () => {
  startDungeon.mockReturnValue({ ok: false, message: "That dungeon has collapsed. Check the board again." });
  const goToScene = jest.fn();
  render(<DungeonsScreen player={{ level: 20 }} goToScene={goToScene} />);
  fireEvent.click(screen.getByRole("button", { name: "Enter Dungeon" }));
  expect(screen.getByRole("alert").textContent).toContain("That dungeon has collapsed.");
  expect(goToScene).not.toHaveBeenCalled();
});

test("reroll button replaces the offers through the game action and refreshes the screen", () => {
  const onChange = jest.fn();
  render(<DungeonsScreen player={{ level: 20, astra: 300000 }} goToScene={jest.fn()} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Roll New Dungeons (300,000 astra)" }));
  expect(rerollDungeons).toHaveBeenCalled();
  expect(onChange).toHaveBeenCalled();
});

test("failed dungeon reroll displays the reason", () => {
  rerollDungeons.mockReturnValue({ ok: false, message: "You need 300,000 astra to roll new dungeons." });
  render(<DungeonsScreen player={{ level: 20, astra: 100 }} goToScene={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Roll New Dungeons (300,000 astra)" }));
  expect(screen.getByRole("alert").textContent).toContain("You need 300,000 astra");
});
