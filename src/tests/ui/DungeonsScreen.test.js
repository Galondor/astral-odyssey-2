import { fireEvent, render, screen } from "@testing-library/react";
import { SCREENS } from "../../ui/screens";
import { DUNGEON_MIN_LEVEL, getBoard, getRun, rerollDungeons, startDungeon } from "../../world/dungeons";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../ui/ChangelogScreen", () => () => null);
jest.mock("../../ui/LeaderboardScreen", () => () => null);
jest.mock("../../ui/InboxScreen", () => () => null);
jest.mock("../../ui/MarketplaceScreen", () => () => null);
jest.mock("../../ui/AdminScreen", () => () => null);
jest.mock("../../ui/BugReportScreen", () => () => null);
jest.mock("../../ui/WorldBossScreen", () => () => <div data-testid="world-boss-content">World Boss content</div>);
jest.mock("../../world/dungeons", () => ({
  ...jest.requireActual("../../world/dungeons"),
  getBoard: jest.fn(),
  getRun: jest.fn(),
  rerollDungeons: jest.fn(),
  startDungeon: jest.fn(),
}));

const DungeonsScreen = SCREENS.dungeons.component;

test("screen registry keeps permanent navigation grouped before contextual screens", () => {
  expect(SCREENS.dungeons.minLevel).toBe(DUNGEON_MIN_LEVEL);
  expect(SCREENS.dungeons.adminAccess).toBeUndefined();
  const groups = ["adventure", "character", "community", undefined].map((group) =>
    Object.entries(SCREENS).filter(([, definition]) => definition.sidebarGroup === group).map(([key]) => key)
  );
  expect(groups).toEqual([
    ["adventure", "dungeons", "arena"],
    ["character", "progression", "quests", "inbox", "social"],
    ["leaderboards", "changelog", "bugReport"],
    ["admin", "combat", "dungeonRun", "groupRun", "crafting", "gearTrader", "marketplace", "questBoard", "forge"],
  ]);
  expect(Object.keys(SCREENS)).toEqual(groups.flat());
  expect(SCREENS.worldBoss).toBeUndefined();
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
  expect(document.querySelector(".dungeons").classList.contains("dungeons-solo")).toBe(true);
  expect(document.querySelector(".dungeons").classList.contains("adventures-theme-solo")).toBe(true);
  expect(screen.getByRole("heading", { name: "Adventures" })).toBeTruthy();
  const adventureTabs = screen.getAllByRole("button").filter((button) =>
    ["Solo Dungeons", "Level 22+", "Level 35+", "Level 40+", "Raids"].includes(button.textContent)
  );
  expect(adventureTabs.map((button) => button.textContent)).toEqual(["Solo Dungeons", "Level 22+", "Level 35+", "Level 40+", "Raids"]);
  expect(screen.getByRole("button", { name: "Level 35+" }).classList.contains("dungeon-tab-world-boss")).toBe(true);
  expect(screen.getByRole("button", { name: "Level 22+" }).disabled).toBe(true);
  expect(screen.getByRole("button", { name: "Level 35+" }).disabled).toBe(true);
  expect(screen.getByRole("button", { name: "Level 40+" }).classList.contains("dungeon-tab-group")).toBe(true);
  expect(screen.getByRole("button", { name: "Level 40+" }).disabled).toBe(true);
  expect(screen.getByRole("button", { name: "Raids" }).disabled).toBe(true);
  expect(screen.queryByText(/under construction/i)).toBeNull();
  const button = screen.getByRole("button", { name: "Enter Dungeon" });
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  expect(startDungeon).toHaveBeenCalledWith(offer.id);
  expect(goToScene).toHaveBeenCalledWith("dungeon");
});

test("level 40 characters can open the Group Dungeons lobby", () => {
  render(<DungeonsScreen player={{ level: 40 }} goToScene={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Group Dungeons" }));
  expect(screen.getByRole("heading", { name: "Tidewrack Hold" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Looking for Group" })).toBeTruthy();
});

test("World Boss is opened from its tab inside Adventures rather than a sidebar screen", () => {
  render(<DungeonsScreen player={{ level: 35 }} goToScene={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "World Boss" }));
  expect(screen.getByTestId("world-boss-content")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Adventures" })).toBeTruthy();
});

test("level 22 characters can open the Labyrinth expedition", () => {
  render(<DungeonsScreen player={{ level: 22 }} goToScene={jest.fn()} />);
  const labyrinthTab = screen.getByRole("button", { name: "Labyrinth" });
  expect(labyrinthTab.disabled).toBe(false);
  fireEvent.click(labyrinthTab);
  expect(screen.getByRole("heading", { name: "The Labyrinth" })).toBeTruthy();
  expect(document.querySelector(".dungeons").classList.contains("dungeons-solo")).toBe(false);
  expect(document.querySelector(".dungeons").classList.contains("adventures-theme-labyrinth")).toBe(true);
  expect(screen.getByRole("button", { name: "Enter the Labyrinth" })).toBeTruthy();
});

test.each(["cleared", "active", "combat", "level"])("entry remains disabled for %s restrictions", (restriction) => {
  if (restriction === "cleared") getBoard.mockReturnValue({ offers: [{ ...offer, cleared: true }] });
  if (restriction === "active") getRun.mockReturnValue({ name: "Sunken Crypt", deadline: Date.now() + 60000 });
  render(<DungeonsScreen player={{ level: restriction === "level" ? 9 : 20 }} goToScene={jest.fn()} inCombat={restriction === "combat"} />);
  const button = restriction === "level"
    ? document.querySelector(".dungeon-offers button")
    : screen.getByRole("button", { name: restriction === "cleared" ? "Cleared" : "Enter Dungeon" });
  expect(button.disabled).toBe(true);
  if (restriction === "level") {
    expect(button.textContent).toBe("Level 12+");
    expect(document.querySelector(".dungeon-reroll").textContent).toBe("Level 12+");
  }
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
  fireEvent.click(screen.getByRole("button", { name: "Generate New Dungeons (300,000 astra)" }));
  expect(rerollDungeons).toHaveBeenCalled();
  expect(onChange).toHaveBeenCalled();
});

test("failed dungeon reroll displays the reason", () => {
  rerollDungeons.mockReturnValue({ ok: false, message: "You need 300,000 astra to roll new dungeons." });
  render(<DungeonsScreen player={{ level: 20, astra: 100 }} goToScene={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Generate New Dungeons (300,000 astra)" }));
  expect(screen.getByRole("alert").textContent).toContain("You need 300,000 astra");
});
