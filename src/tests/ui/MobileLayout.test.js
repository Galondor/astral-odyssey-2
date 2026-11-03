import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Game } from "../../App";
import { recalculateStats } from "../../character/stats";
import { getPlayer, setPlayer } from "../../character/player";
import { endCombat, startCombat } from "../../combat/combat";

jest.mock("../../firebase", () => ({ db: {}, auth: {} }));
jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(), setPlayer: jest.fn(),
  getCharacterIdentity: () => "layout-fixture",
  getSaveStatus: () => ({}), subscribeSaveStatus: () => () => {},
  getInventoryItemKey: (item) => item.id || JSON.stringify(item),
  markInventoryItemViewed: jest.fn(),
}));
jest.mock("../../world/inbox", () => ({
  ...jest.requireActual("../../world/inbox"),
  isAdmin: () => false, startInbox: () => () => {}, getUnreadCount: () => 0,
}));
jest.mock("../../world/social", () => ({
  ...jest.requireActual("../../world/social"),
  startSocial: () => () => {}, hasSocialNotification: () => false,
}));
jest.mock("../../world/groupParty", () => ({
  ...jest.requireActual("../../world/groupParty"),
  startGroupSession: () => () => {}, subscribeGroup: () => () => {},
  getGroupStatus: () => ({}),
}));
jest.mock("../../world/contest", () => ({
  ...jest.requireActual("../../world/contest"),
  startContest: () => () => {}, subscribeContest: () => () => {},
  getContestStatus: () => ({}),
}));
jest.mock("../../world/worldBoss", () => ({
  ...jest.requireActual("../../world/worldBoss"),
  subscribeWorldBoss: () => () => {},
}));
jest.mock("../../ui/changelogFiles", () => ({ changelogFiles: [] }));

let player;
afterEach(() => endCombat());
beforeEach(() => {
  window.matchMedia.mockImplementation((media) => ({
    media, matches: media === "(max-width: 1000px)",
    addEventListener: jest.fn(), removeEventListener: jest.fn(),
  }));
  localStorage.setItem("astralOdyssey2QuickGuideSeen:layout-fixture", "true");
  player = {
    name: "Nova", class: "Warrior", level: 15, astra: 1200, statPoints: 2,
    baseStats: { strength: 5, dexterity: 5, intelligence: 5 },
    inventory: [{
      id: "layout-sword", name: "Iron Sword", slot: "weapon", rarity: "Rare", iLevel: 5,
      mainStat: { stat: "strength", value: 12 },
    }],
    consumables: { healthPotion: 2 }, equipment: {},
  };
  player = { ...player, ...recalculateStats(player) };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
});

function captureLayout(name) {
  if (!process.env.MOBILE_LAYOUT_DIR) return;
  const fs = require("fs");
  const path = require("path");
  const css = ["index.css", "App.css"].map(file =>
    fs.readFileSync(path.join(process.cwd(), "src", file), "utf8")).join("\n");
  const portrait = fs.readFileSync(path.join(process.cwd(), "src", "ui", "profile-placeholder.svg")).toString("base64");
  const body = document.querySelector(".App").outerHTML.replace(/src="profile-placeholder.svg"/g, `src="data:image/svg+xml;base64,${portrait}"`);
  fs.writeFileSync(path.join(process.env.MOBILE_LAYOUT_DIR, `${name}.html`),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${name}</title><style>${css}</style></head><body>${body}</body></html>`);
}

test("real mobile scenes keep the existing labels and run Town through the existing action", () => {
  render(<Game uid="layout-fixture" onLogout={jest.fn()} onMainMenu={jest.fn()} />);
  captureLayout("gameplay");
  const navigation = screen.getByRole("navigation", { name: "Mobile navigation" });
  expect(within(navigation).getByRole("button", { name: "Gameplay" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Travel Cost 1 Stamina" })).toBeTruthy();
  fireEvent.click(within(navigation).getByRole("button", { name: "Town" }));
  expect(screen.getByText("You have arrived in town.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Lodging" })).toBeTruthy();
  expect(player.astra).toBe(1200);
  captureLayout("town");
  fireEvent.click(within(navigation).getByRole("button", { name: "Character" }));
  expect(screen.getByRole("heading", { name: "Inventory" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Lodging" })).toBeNull();
  captureLayout("inventory");
  fireEvent.click(screen.getByRole("button", { name: "Iron Sword" }));
  expect(screen.getByRole("dialog", { name: "Iron Sword details" })).toBeTruthy();
  captureLayout("item-details");
  fireEvent.click(screen.getByRole("button", { name: "Close item details" }));
  fireEvent.click(screen.getByRole("button", { name: "Stats", pressed: false }));
  captureLayout("stats");
  fireEvent.click(within(navigation).getByRole("button", { name: /Menu/ }));
  captureLayout("menu");
  expect(screen.getByRole("dialog", { name: "Game menu" })).toBeTruthy();
});

test("real mobile combat keeps its existing actions and blocks Town", () => {
  startCombat({ name: "Slime", tier: "basic", level: 15, maxHp: 80, speed: 0 });
  render(<Game uid="layout-fixture" onLogout={jest.fn()} onMainMenu={jest.fn()} />);
  ["Melee Attack", "Magic Attack", "Defend", "Use Item", "Skills", "Pass"].forEach(name =>
    expect(screen.getByRole("button", { name })).toBeTruthy());
  const navigation = screen.getByRole("navigation", { name: "Mobile navigation" });
  expect(within(navigation).getByRole("button", { name: "Town" }).disabled).toBe(true);
  captureLayout("combat");
  fireEvent.click(within(navigation).getByRole("button", { name: "Character" }));
  expect(screen.queryByRole("button", { name: "Melee Attack" })).toBeNull();
  expect(within(document.querySelector(".game-content")).getByRole("button", { name: "Combat" })).toBeTruthy();
});

test("resizing the real Character screen to desktop restores the combined layout", () => {
  const listeners = new Set();
  window.matchMedia.mockReturnValue({
    matches: true,
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
  });
  render(<Game uid="layout-fixture" onLogout={jest.fn()} onMainMenu={jest.fn()} />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Mobile navigation" })).getByRole("button", { name: "Character" }));
  expect(screen.getByRole("group", { name: "Character sections" })).toBeTruthy();
  act(() => listeners.forEach(listener => listener({ matches: false })));
  expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).toBeNull();
  expect(screen.queryByRole("group", { name: "Character sections" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Nova" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Equipment" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Inventory" })).toBeTruthy();
  captureLayout("desktop-character");
});
