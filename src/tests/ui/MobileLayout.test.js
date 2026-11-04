import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Game } from "../../App";
import { recalculateStats } from "../../character/stats";
import { getPlayer, setPlayer } from "../../character/player";
import { endCombat, startCombat } from "../../combat/combat";
import { getGroupStatus } from "../../world/groupParty";
import { createGroupRun } from "../../world/groupDungeons";

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
  getGroupStatus: jest.fn(() => ({})),
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
  getGroupStatus.mockReturnValue({});
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
  const resources = screen.getByRole("region", { name: "Character resources" });
  expect(within(resources).getByText("1200 astra")).toBeTruthy();
  ["Health", "Stamina", "Power"].forEach(name => expect(within(resources).getByText(name)).toBeTruthy());
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

test("desktop navigation displays character resources in the top bar", () => {
  window.matchMedia.mockImplementation((media) => ({
    media, matches: false,
    addEventListener: jest.fn(), removeEventListener: jest.fn(),
  }));
  render(<Game uid="layout-fixture" onLogout={jest.fn()} onMainMenu={jest.fn()} />);
  const resources = screen.getByRole("region", { name: "Character resources" });
  const search = document.querySelector(".player-search-shell");
  const actions = resources.parentElement;
  expect(search.nextElementSibling).toBe(actions);
  expect(resources.nextElementSibling.classList.contains("profile-menu")).toBe(true);
  expect(within(resources).getByText("1200 astra")).toBeTruthy();
  ["Health", "Stamina", "Power"].forEach(name => expect(within(resources).getByText(name)).toBeTruthy());
});

test("mobile item and consumable cards open details without showing hover or focus tooltips", () => {
  jest.useFakeTimers();
  try {
    render(<Game uid="layout-fixture" onLogout={jest.fn()} onMainMenu={jest.fn()} />);
    const navigation = screen.getByRole("navigation", { name: "Mobile navigation" });
    fireEvent.click(within(navigation).getByRole("button", { name: "Character" }));
    const sword = screen.getByRole("button", { name: "Iron Sword" });
    fireEvent.mouseEnter(sword);
    fireEvent.focus(sword);
    act(() => jest.advanceTimersByTime(200));
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.click(sword);
    expect(screen.getByRole("dialog", { name: "Iron Sword details" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close item details" }));
    fireEvent.click(screen.getByRole("tab", { name: /Consumables/ }));
    const potion = screen.getByRole("button", { name: "Health Potion x2" });
    fireEvent.mouseEnter(potion);
    fireEvent.focus(potion);
    act(() => jest.advanceTimersByTime(200));
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.click(potion);
    expect(screen.getByRole("dialog", { name: "Health Potion details" })).toBeTruthy();
    expect(player.consumables.healthPotion).toBe(2);
  } finally {
    jest.useRealTimers();
  }
});

test("mobile group combat renders inside the same screen and controls shell", () => {
  const snapshot = { ...player, level: 45, skills: {}, equippedSkills: [] };
  const run = createGroupRun({
    id: "layout-run", dungeonId: "tidewrack", members: ["layout-fixture", "ally"], now: 1000, actor: "layout-fixture",
    snapshots: { "layout-fixture": snapshot, ally: { ...snapshot, name: "Ally" } },
  });
  run.log = ["Earlier round.", "Latest round."];
  getGroupStatus.mockReturnValue({
    identity: "layout-fixture", partyId: "layout-party", run, active: true, inRun: true,
    connected: true, intentsIn: {}, chat: [], remainingMs: 60000, roundRemainingMs: 20000,
  });
  render(<Game uid="layout-fixture" onLogout={jest.fn()} onMainMenu={jest.fn()} />);
  expect(screen.getByRole("button", { name: "Melee Attack" })).toBeTruthy();
  expect(document.querySelector(".group-player .me")).toBeTruthy();
  captureLayout("group-combat");
  fireEvent.click(screen.getByRole("button", { name: "Chat" }));
  expect(screen.getByRole("dialog", { name: "Party chat" })).toBeTruthy();
  captureLayout("group-chat");
  fireEvent.click(screen.getByRole("button", { name: "Close party chat" }));
  fireEvent.click(screen.getByRole("button", { name: "Leave Run" }));
  expect(screen.getByRole("button", { name: /Confirm: leave run/ })).toBeTruthy();
  captureLayout("group-leave");
});
