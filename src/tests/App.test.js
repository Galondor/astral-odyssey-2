import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../App";
import { getPlayer, getSaveStatus, loadPlayer, unloadPlayer } from "../character/player";
import { signOut } from "firebase/auth";
import { getEnemy } from "../combat/combat";
import { createCharacter, deleteCharacter, loadCharacters } from "../character/characters";
import { isAdmin } from "../world/inbox";
import { getInputMode, getVisibleOptions, processButton, scenes } from "../world/gameLogic";

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (_, callback) => {
    callback({ uid: "test-player" });
    return () => {};
  },
  signOut: jest.fn(),
}));
jest.mock("../firebase", () => ({ auth: {} }));
jest.mock("../ui/AuthScreen", () => () => null);
jest.mock("../ui/GameForm", () => () => null);
jest.mock("../ui/Tooltip", () => ({ children }) => children);
jest.mock("../character/player", () => ({
  getPlayer: jest.fn(),
  getCharacterIdentity: () => "character-1",
  loadPlayer: jest.fn(),
  unloadPlayer: jest.fn(),
  getSaveStatus: jest.fn(() => ({})),
  subscribeSaveStatus: () => () => {},
}));
jest.mock("../character/characters", () => ({
  createCharacter: jest.fn(),
  deleteCharacter: jest.fn(),
  loadCharacters: jest.fn(),
}));
jest.mock("../world/blackjack", () => ({ clearBlackjack: jest.fn() }));
jest.mock("../world/quests", () => ({ getRep: () => 0, getRepRank: () => "Neutral" }));
jest.mock("../world/events", () => ({ getRegion: () => "test", REGIONS: { test: { name: "Test region" } } }));
jest.mock("../combat/combat", () => ({ getEnemy: jest.fn(() => null), endCombat: jest.fn() }));
jest.mock("../world/dungeons", () => ({ expireIfNeeded: () => false, isInDungeon: () => false }));
jest.mock("../world/inbox", () => ({ isAdmin: jest.fn(() => false), startInbox: () => () => {} }));
jest.mock("../ui/screens", () => ({
  DEFAULT_SCREEN: "adventure",
  SCREENS: {
    adventure: { label: "Adventure", sidebarGroup: "adventure", link: true, component: () => <h1>Adventure screen</h1> },
    dungeons: { label: "Dungeons", sidebarGroup: "adventure", link: true, component: () => null },
    arena: { label: "Arena", sidebarGroup: "adventure", link: true, component: () => <h1>Arena screen</h1> },
    character: {
      label: "Character", sidebarGroup: "character", link: true, badge: () => 2,
      notification: (p) => ["gear", "consumables", "gemstones"].some((category) => p.unseenInventoryItems?.[category]?.length),
      component: () => <h1>Character screen</h1>,
    },
    locked: { label: "Locked", sidebarGroup: "character", link: true, minLevel: 10, component: () => null },
    leaderboards: { label: "Leaderboards", sidebarGroup: "community", link: true, component: () => null },
    admin: { label: "Admin", adminOnly: true, component: () => null },
    combat: { label: "Combat", hideUnlessActive: true, component: () => null },
    gearTrader: { label: "Gear Trader", hideUnlessActive: true, component: () => <h1>Gear Trader screen</h1> },
  },
}));
jest.mock("../world/gameLogic", () => ({
  INPUT_MODES: ["buttons", "text", "both", "form"],
  getInputMode: jest.fn(() => "none"),
  getVisibleOptions: jest.fn(() => []),
  initialMessages: () => [],
  processButton: jest.fn(() => ({ sceneId: "menu", replies: [] })),
  scenes: { menu: { screen: "adventure" } },
}));

beforeEach(() => {
  jest.clearAllMocks();
  window.matchMedia = jest.fn(() => ({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
  loadCharacters.mockResolvedValue({
    characters: [{ id: "character-1", player: { name: "Nova", level: 5, stats: {} } }],
    limit: 3,
  });
  loadPlayer.mockResolvedValue();
  getSaveStatus.mockReturnValue({});
  getEnemy.mockReturnValue(null);
  getInputMode.mockReturnValue("none");
  getVisibleOptions.mockReturnValue([]);
  processButton.mockReturnValue({ sceneId: "menu", replies: [] });
  getPlayer.mockReturnValue({
    name: "Nova", class: "Warrior", level: 5, region: "test", astra: 10,
    stats: {
      health: 80, maxHealth: 100, stamina: 30, maxStamina: 50, power: 4, maxPower: 10,
      exp: 12, expToLevel: 60, attackMin: 5, attackMax: 8, magicAttackMin: 1, magicAttackMax: 2,
      strength: 10, dexterity: 4, intelligence: 3, defense: 6, vitality: 7, agility: 2,
      resilience: 1, luck: 2, speed: 8, gearScore: 25,
    },
  });
  isAdmin.mockReturnValue(false);
  scenes.menu.screen = "adventure";
});

const enterGame = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Play as Nova" }));
};

test("numbers each gameplay control button in its displayed order", async () => {
  getInputMode.mockReturnValue("buttons");
  getVisibleOptions.mockReturnValue([{ label: "Explore" }, { label: "Inventory" }]);

  render(<App />);
  await enterGame();

  expect(await screen.findByRole("button", { name: "1. Explore" })).toBeTruthy();
  expect(await screen.findByRole("button", { name: "2. Inventory" })).toBeTruthy();
});

test("mobile menu overlays the screen, makes the background inert and traps focus until closed", async () => {
  window.matchMedia.mockReturnValue({
    matches: true,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
  render(<App />);
  await enterGame();
  const toggle = await screen.findByRole("button", { name: "Menu: Adventure" });
  const header = screen.getByRole("banner");
  const content = document.querySelector(".game-content");
  expect(header.hasAttribute("inert")).toBe(false);
  fireEvent.click(toggle);

  const dialog = screen.getByRole("dialog", { name: "Game menu" });
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  expect(header.hasAttribute("inert")).toBe(true);
  expect(content.hasAttribute("inert")).toBe(true);
  expect(document.querySelector(".sidebar").classList.contains("sidebar-open")).toBe(true);
  expect(document.activeElement).toBe(toggle);

  fireEvent.keyDown(toggle, { key: "Tab", shiftKey: true });
  const last = within(dialog).getByRole("button", { name: "Leaderboards" });
  expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last, { key: "Tab" });
  expect(document.activeElement).toBe(toggle);
  within(header).getByRole("button", { name: "Character profile" }).focus();
  expect(document.activeElement).toBe(toggle);

  fireEvent.click(document.querySelector(".sidebar-backdrop"));
  expect(screen.queryByRole("dialog", { name: "Game menu" })).toBeNull();
  expect(header.hasAttribute("inert")).toBe(false);
  expect(content.hasAttribute("inert")).toBe(false);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");

  fireEvent.click(toggle);
  fireEvent.click(within(dialog).getByRole("button", { name: "Character 2" }));
  expect(screen.getByRole("heading", { name: "Character screen" })).toBeTruthy();
  expect(content.hasAttribute("inert")).toBe(false);
});

test("number keys activate visible button options from left to right", async () => {
  getInputMode.mockReturnValue("buttons");
  getVisibleOptions.mockReturnValue([{ label: "First option" }, { label: "Second option" }]);
  render(<App />);
  await enterGame();
  await screen.findByRole("button", { name: "Menu: Adventure" });

  fireEvent.keyDown(window, { key: "2" });
  expect(processButton).toHaveBeenCalledWith("menu", "Second option");

  fireEvent.keyDown(window, { key: "1" });
  expect(processButton).toHaveBeenLastCalledWith("menu", "First option");
});

test("number shortcuts do not interfere with text entry or unavailable options", async () => {
  getInputMode.mockReturnValue("both");
  getVisibleOptions.mockReturnValue([{ label: "First option" }]);
  render(<App />);
  await enterGame();
  await screen.findByRole("button", { name: "Menu: Adventure" });

  fireEvent.keyDown(screen.getByPlaceholderText("Type your action..."), { key: "1" });
  fireEvent.keyDown(window, { key: "2" });
  fireEvent.keyDown(window, { key: "1", ctrlKey: true });
  expect(processButton).not.toHaveBeenCalled();
});

test("resizing to desktop dismisses the mobile overlay and releases the background", async () => {
  const query = { matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() };
  window.matchMedia.mockReturnValue(query);
  render(<App />);
  await enterGame();
  fireEvent.click(await screen.findByRole("button", { name: "Menu: Adventure" }));
  const resize = query.addEventListener.mock.calls[0][1];
  act(() => resize({ matches: false }));
  expect(screen.queryByRole("dialog", { name: "Game menu" })).toBeNull();
  expect(screen.getByRole("banner").hasAttribute("inert")).toBe(false);
  expect(document.querySelector(".sidebar-backdrop")).toBeNull();
});

test("confirmed deletion refreshes the roster without entering gameplay", async () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  deleteCharacter.mockResolvedValueOnce();
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Delete Nova" }));
  loadCharacters.mockResolvedValueOnce({ characters: [], limit: 3 });
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Nova" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Permanently delete character" }));
  expect(await screen.findByText("0 / 3 character slots used")).toBeTruthy();
  expect(deleteCharacter).toHaveBeenCalledWith("test-player", "character-1", "Nova");
  expect(loadPlayer).not.toHaveBeenCalled();
});

test("Arena follows Dungeons and opens from the sidebar with group dividers", async () => {
  render(<App />);
  await enterGame();
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
  await enterGame();
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
  await enterGame();
  const toggle = await screen.findByRole("button", { name: "Menu: Adventure" });
  const navigation = await screen.findByRole("navigation", { name: "Game navigation" });
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

test("Character navigation displays a notification dot for unread inventory", async () => {
  getPlayer.mockReturnValue({
    ...getPlayer(),
    unseenInventoryItems: { gemstones: ["ruby"] },
  });
  render(<App />);
  await enterGame();

  const navigation = await screen.findByRole("navigation", { name: "Game navigation" });
  const character = within(navigation).getByRole("button", { name: /Character/ });
  expect(character.querySelector(".sidebar-notification-dot")).toBeTruthy();
  expect(character.querySelector(".sidebar-badge").textContent).toBe("2");
});

test("Escape closes navigation and restores focus to the visible toggle", async () => {
  render(<App />);
  await enterGame();
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
  await enterGame();
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
  await enterGame();
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByRole("navigation")).toBeNull();
});

test("sign-in opens the character menu without loading gameplay or exposing keys", async () => {
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Main menu" })).toBeTruthy();
  expect(screen.getByText("1 / 3 character slots used")).toBeTruthy();
  expect(loadPlayer).not.toHaveBeenCalled();
  expect(screen.queryByRole("navigation")).toBeNull();
  expect(screen.queryByText(/test-player|character-1/)).toBeNull();
  await enterGame();
  await screen.findByRole("navigation");
  expect(loadPlayer).toHaveBeenCalledWith("test-player", "character-1");
});

test("creating a character reserves a slot and opens character creation", async () => {
  createCharacter.mockResolvedValueOnce("character-2");
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Create character" }));
  await screen.findByRole("navigation");
  expect(createCharacter).toHaveBeenCalledWith("test-player");
  expect(loadPlayer).toHaveBeenCalledWith("test-player", "character-2");
});

test("all three slots disable character creation", async () => {
  loadCharacters.mockResolvedValueOnce({
    characters: [1, 2, 3].map((id) => ({ id: String(id), player: { name: `Hero${id}`, stats: {} } })),
    limit: 3,
  });
  render(<App />);
  const button = await screen.findByRole("button", { name: "Create character" });
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(createCharacter).not.toHaveBeenCalled();
});

test("returning to the main menu flushes the character before switching", async () => {
  render(<App />);
  await enterGame();
  fireEvent.click(await screen.findByRole("button", { name: "Character profile" }));
  fireEvent.click(await screen.findByRole("button", { name: "Main menu" }));
  await screen.findByRole("heading", { name: "Main menu" });
  expect(unloadPlayer).toHaveBeenCalledTimes(1);
  expect(loadCharacters).toHaveBeenCalledTimes(2);
});

test("failed saves prevent switching characters", async () => {
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  unloadPlayer.mockRejectedValueOnce(new Error("conflict"));
  render(<App />);
  await enterGame();
  fireEvent.click(await screen.findByRole("button", { name: "Character profile" }));
  fireEvent.click(await screen.findByRole("button", { name: "Main menu" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(loadCharacters).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "Create character" })).toBeNull();
  error.mockRestore();
});

test("the portrait opens a profile with character details and account actions, not inline nav information", async () => {
  getSaveStatus.mockReturnValue({ saving: true, notice: "Saving progress" });
  render(<App />);
  await enterGame();
  const header = await screen.findByRole("banner");
  const toggle = within(header).getByRole("button", { name: "Character profile" });
  expect(within(header).getAllByRole("button")).toHaveLength(1);
  expect(toggle.querySelector("img").getAttribute("src")).toBeTruthy();
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(within(header).queryByText(/Nova|Saving|Health|Test region|astra/)).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();

  fireEvent.click(toggle);
  const popup = screen.getByRole("dialog", { name: "Character profile" });
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(within(popup).getByRole("heading", { name: "Nova the Warrior, Level 5" })).toBeTruthy();
  expect(within(popup).getByText("Experience 12/60")).toBeTruthy();
  ["Health", "Stamina", "Power", "Attack", "Magic attack", "Defense", "Strength", "Dexterity",
    "Intelligence", "Vitality", "Agility", "Resilience", "Luck", "Speed", "Critical chance",
    "Critical damage", "Evasion", "Gear score", "Test region", "Astra", "Neutral (0)"].forEach((text) => {
    expect(within(popup).getByText(text)).toBeTruthy();
  });
  expect(within(popup).getByRole("button", { name: "Main menu" }).disabled).toBe(false);
  fireEvent.click(within(popup).getByRole("button", { name: "Log out" }));
  await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  expect(unloadPlayer).toHaveBeenCalledTimes(1);
  expect(signOut).toHaveBeenCalledTimes(1);
});

test("profile closes on Escape, close button, portrait toggle, outside click and focus leaving", async () => {
  render(<App />);
  await enterGame();
  const toggle = await screen.findByRole("button", { name: "Character profile" });
  fireEvent.click(toggle);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close character profile" }));
  fireEvent.keyDown(document.activeElement, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(toggle);

  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole("button", { name: "Close character profile" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(toggle);

  fireEvent.click(toggle);
  fireEvent.click(toggle);
  expect(screen.queryByRole("dialog")).toBeNull();

  fireEvent.click(toggle);
  fireEvent.pointerDown(screen.getByRole("heading", { name: "Adventure screen" }));
  expect(screen.queryByRole("dialog")).toBeNull();

  fireEvent.click(toggle);
  fireEvent.blur(screen.getByRole("button", { name: "Close character profile" }), {
    relatedTarget: screen.getByRole("button", { name: "Adventure" }),
  });
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("profile keeps main menu disabled during combat but allows logout", async () => {
  scenes.menu.screen = "combat";
  render(<App />);
  await enterGame();
  const toggle = await screen.findByRole("button", { name: "Character profile" });
  getEnemy.mockReturnValue({ name: "Enemy" });
  fireEvent.click(screen.getByRole("button", { name: "Menu: Combat" }));
  fireEvent.click(toggle);
  const popup = screen.getByRole("dialog");
  expect(within(popup).getByRole("button", { name: "Main menu" }).disabled).toBe(true);
  expect(within(popup).getByRole("button", { name: "Log out" }).disabled).toBe(false);
});
