import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "./App";
import { getSaveStatus, loadPlayer } from "./character/player";
import { isAdmin } from "./world/inbox";
import { scenes } from "./world/gameLogic";

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (_, callback) => {
    callback({ uid: "test-player" });
    return () => {};
  },
  signOut: jest.fn(),
}));
jest.mock("./firebase", () => ({ auth: {} }));
jest.mock("./ui/AuthScreen", () => () => null);
jest.mock("./ui/GameForm", () => () => null);
jest.mock("./ui/Tooltip", () => ({ children }) => children);
jest.mock("./character/player", () => ({
  getPlayer: () => ({ name: "Nova", level: 5, region: "test", stats: {}, astra: 10 }),
  loadPlayer: jest.fn(),
  unloadPlayer: jest.fn(),
  getSaveStatus: jest.fn(() => ({})),
  subscribeSaveStatus: () => () => {},
}));
jest.mock("./world/quests", () => ({ getRep: () => 0, getRepRank: () => "Neutral" }));
jest.mock("./world/events", () => ({ getRegion: () => "test", REGIONS: { test: { name: "Test region" } } }));
jest.mock("./combat/combat", () => ({ getEnemy: () => null }));
jest.mock("./world/dungeons", () => ({ expireIfNeeded: () => false, isInDungeon: () => false }));
jest.mock("./world/inbox", () => ({ isAdmin: jest.fn(() => false), startInbox: () => () => {} }));
jest.mock("./ui/screens", () => ({
  DEFAULT_SCREEN: "adventure",
  SCREENS: {
    adventure: { label: "Adventure", sidebarGroup: "adventure", link: true, component: () => <h1>Adventure screen</h1> },
    dungeons: { label: "Dungeons", sidebarGroup: "adventure", link: true, component: () => null },
    arena: { label: "Arena", sidebarGroup: "adventure", link: true, component: () => <h1>Arena screen</h1> },
    character: { label: "Character", sidebarGroup: "character", link: true, badge: () => 2, component: () => <h1>Character screen</h1> },
    locked: { label: "Locked", sidebarGroup: "character", link: true, minLevel: 10, component: () => null },
    leaderboards: { label: "Leaderboards", sidebarGroup: "community", link: true, component: () => null },
    admin: { label: "Admin", adminOnly: true, component: () => null },
    combat: { label: "Combat", hideUnlessActive: true, component: () => null },
    gearTrader: { label: "Gear Trader", hideUnlessActive: true, component: () => <h1>Gear Trader screen</h1> },
  },
}));
jest.mock("./world/gameLogic", () => ({
  INPUT_MODES: ["buttons", "text", "both", "form"],
  getInputMode: () => "none",
  initialMessages: () => [],
  scenes: { menu: { screen: "adventure" } },
}));

beforeEach(() => {
  getSaveStatus.mockReturnValue({});
  isAdmin.mockReturnValue(false);
  scenes.menu.screen = "adventure";
});

test("Arena follows Dungeons and opens from the sidebar with group dividers", async () => {
  render(<App />);
  const navigation = await screen.findByRole("navigation", { name: "Game navigation" });
  const links = document.getElementById("sidebar-links");
  expect(within(navigation).getAllByRole("button").slice(1).map((button) => button.textContent))
    .toEqual(["Adventure", "Dungeons", "Arena", "Character2", "Locked", "Leaderboards"]);
  expect(links.querySelectorAll(".sidebar-divider")).toHaveLength(2);
  expect(Array.from(links.querySelectorAll(".sidebar-divider")).map((divider) => divider.nextElementSibling.textContent))
    .toEqual(["Character2", "Leaderboards"]);

  fireEvent.click(within(navigation).getByRole("button", { name: "Arena" }));
  expect(screen.getByRole("heading", { name: "Arena screen" })).toBeTruthy();
  expect(within(navigation).getByRole("button", { name: "Arena" }).getAttribute("aria-current")).toBe("page");
});

test.each([false, true])("temporary screens occupy the final group with admin access %s", async (admin) => {
  isAdmin.mockReturnValue(admin);
  scenes.menu.screen = "gearTrader";
  render(<App />);
  const navigation = await screen.findByRole("navigation", { name: "Game navigation" });
  const links = document.getElementById("sidebar-links");
  const dividers = links.querySelectorAll(".sidebar-divider");
  expect(dividers).toHaveLength(3);
  const lastDivider = dividers[2];
  expect(lastDivider.nextElementSibling.textContent).toBe(admin ? "Admin" : "Gear Trader");
  const buttons = within(navigation).getAllByRole("button");
  expect(buttons[buttons.length - 1].textContent).toBe("Gear Trader");
  expect(within(navigation).getByRole("button", { name: "Gear Trader" }).classList.contains("highlight")).toBe(true);

  fireEvent.click(within(navigation).getByRole("button", { name: "Adventure" }));
  expect(within(navigation).getByRole("button", { name: "Gear Trader" }).classList.contains("attention")).toBe(true);
});

test("navigation toggles, preserves restrictions and badges, and closes after selection", async () => {
  render(<App />);
  const toggle = await screen.findByRole("button", { name: "Menu: Adventure" });
  const navigation = screen.getByRole("navigation", { name: "Game navigation" });
  const links = document.getElementById(toggle.getAttribute("aria-controls"));
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(links.classList.contains("open")).toBe(false);

  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(links.classList.contains("open")).toBe(true);
  expect(within(navigation).getByRole("button", { name: "Locked" }).disabled).toBe(true);
  expect(within(navigation).queryByRole("button", { name: "Admin" })).toBeNull();
  expect(within(navigation).queryByRole("button", { name: "Combat" })).toBeNull();
  fireEvent.click(within(navigation).getByRole("button", { name: "Character 2" }));

  expect(screen.getByRole("heading", { name: "Character screen" })).toBeTruthy();
  expect(toggle.textContent).toContain("Menu: Character");
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(links.classList.contains("open")).toBe(false);
  expect(within(navigation).getByRole("button", { name: "Character 2" }).getAttribute("aria-current")).toBe("page");

  fireEvent.click(toggle);
  fireEvent.click(within(navigation).getByRole("button", { name: "Adventure" }));
  expect(screen.getByRole("heading", { name: "Adventure screen" })).toBeTruthy();
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
});

test("Escape closes navigation and restores focus to the visible toggle", async () => {
  render(<App />);
  const toggle = await screen.findByRole("button", { name: "Menu: Adventure" });
  const rects = jest.spyOn(toggle, "getClientRects").mockReturnValue([{}]);
  try {
    fireEvent.click(toggle);
    const character = screen.getByRole("button", { name: "Character 2" });
    character.focus();
    fireEvent.keyDown(character, { key: "Escape" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
  } finally {
    rects.mockRestore();
  }
});

test("failed cloud loads never open gameplay with cached or empty player data", async () => {
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  loadPlayer.mockRejectedValueOnce(new Error("offline"));
  render(<App />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByRole("navigation")).toBeNull();
  expect(screen.getByRole("button", { name: "Reload cloud save" })).toBeTruthy();
  error.mockRestore();
});

test.each([
  { error: "Progress changed in another browser or device." },
  { offline: true },
])("gameplay is paused when synchronization is unsafe: %j", async (status) => {
  getSaveStatus.mockReturnValue(status);
  render(<App />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByRole("navigation")).toBeNull();
});
