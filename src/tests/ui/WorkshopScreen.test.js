import { fireEvent, render, screen, within } from "@testing-library/react";
import { getPlayer, setPlayer } from "../../character/player";
import { RECIPES, getRecipeCost } from "../../items/workshop";
import { SCREENS } from "../../ui/screens";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../character/player", () => ({
  ...jest.requireActual("../../character/player"),
  getPlayer: jest.fn(), setPlayer: jest.fn(),
}));
jest.mock("../../ui/ChangelogScreen", () => () => null);
jest.mock("../../ui/LeaderboardScreen", () => () => null);
jest.mock("../../ui/InboxScreen", () => () => null);
jest.mock("../../ui/MarketplaceScreen", () => () => null);
jest.mock("../../ui/AdminScreen", () => () => null);
jest.mock("../../ui/BugReportScreen", () => () => null);

let player;
const WorkshopScreen = SCREENS.crafting.component;
beforeEach(() => {
  jest.clearAllMocks();
  player = {
    level: 3, astra: 100000, materials: {}, crafted: {}, workshopVersion: 2,
    baseStats: { strength: 2, dexterity: 2, intelligence: 2 },
    stats: {}, bonusStats: {},
  };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
});

test("workshop purchases update level, materials and level locks without granting free resources", () => {
  const cost = getRecipeCost(player, "sharpeningStone");
  player.materials = cost.materials;
  const onChange = jest.fn();
  const { rerender } = render(<WorkshopScreen onChange={onChange} />);
  const stone = () => screen.getByRole("button", { name: /Sharpening Stone/ });
  expect(screen.getByText("Permanent upgrades have 10 levels. Higher levels require materials from later regions. Existing chance caps still apply.")).toBeTruthy();
  expect(within(stone()).getByText("+10 maximum attack per level.")).toBeTruthy();
  expect(within(stone()).getByText("Available at level 3 - Meadowlands")).toBeTruthy();
  fireEvent.click(stone());
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(player.bonusStats.attackMax).toBe(10);
  expect(screen.getByText(/The Workshop completes your Sharpening Stone \(level 1\/10\)/)).toBeTruthy();
  expect(within(stone()).getByText("Upgrade 1/10")).toBeTruthy();
  expect(within(stone()).getByText("Requires level 5 - Meadowlands")).toBeTruthy();
  expect(stone().disabled).toBe(true);
  fireEvent.click(stone());
  expect(setPlayer).toHaveBeenCalledTimes(1);
  player.level = 5;
  player.materials = getRecipeCost(player, "sharpeningStone").materials;
  rerender(<WorkshopScreen onChange={onChange} />);
  expect(stone().disabled).toBe(false);
  fireEvent.click(stone());
  expect(player.bonusStats.attackMax).toBe(20);
  expect(within(stone()).getByText("Requires level 10 - Darkwood")).toBeTruthy();
  expect(stone().textContent).toContain("Rotwood Bark");
});

test("workshop shows missing-resource failures and separates recipes into scrollable tab panels", () => {
  render(<WorkshopScreen onChange={jest.fn()} />);
  const upgrades = screen.getByRole("tab", { name: "Upgrades" });
  const keyItems = screen.getByRole("tab", { name: "Key Items" });
  const upgradePanel = screen.getByRole("tabpanel", { name: "Upgrades" });
  expect(upgrades.getAttribute("aria-selected")).toBe("true");
  expect(upgradePanel.id).toBe(upgrades.getAttribute("aria-controls"));
  expect(upgradePanel.classList.contains("workshop-tab-panel")).toBe(true);
  expect(upgradePanel.tabIndex).toBe(0);
  expect(within(upgradePanel).getAllByRole("button")).toHaveLength(
    Object.values(RECIPES).filter((recipe) => recipe.type === "upgrade").length,
  );
  expect(screen.queryByRole("button", { name: /Analyzer/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Sharpening Stone/ }));
  expect(screen.getByText("You lack the materials to craft the Sharpening Stone.")).toBeTruthy();
  expect(setPlayer).not.toHaveBeenCalled();
  fireEvent.click(keyItems);
  const keyPanel = screen.getByRole("tabpanel", { name: "Key Items" });
  expect(keyItems.getAttribute("aria-selected")).toBe("true");
  expect(upgrades.getAttribute("aria-selected")).toBe("false");
  expect(keyPanel.id).toBe(keyItems.getAttribute("aria-controls"));
  expect(keyPanel.classList.contains("workshop-tab-panel")).toBe(true);
  expect(keyPanel.tabIndex).toBe(0);
  expect(within(keyPanel).getAllByRole("button")).toHaveLength(
    Object.values(RECIPES).filter((recipe) => recipe.type === "key").length,
  );
  expect(screen.queryByRole("button", { name: /Sharpening Stone/ })).toBeNull();
  expect(screen.queryByText("You lack the materials to craft the Sharpening Stone.")).toBeNull();
  fireEvent.click(upgrades);
  expect(screen.getByRole("button", { name: /Sharpening Stone/ })).toBeTruthy();
});

test("workshop displays the saved refund receipt and keeps maxed ranks and owned keys disabled", () => {
  player = {
    ...player, level: 100, crafted: { sharpeningStone: 10 }, keyItems: ["analyzer"],
    workshopRefund: { upgrades: 2, astra: 125, materials: { goblin_scrap: 15 } },
  };
  render(<WorkshopScreen onChange={jest.fn()} />);
  expect(screen.getByRole("status").textContent).toContain("Your 2 previous stat upgrades were reset.");
  expect(screen.getByRole("status").textContent).toContain("Refunded 125 astra");
  expect(screen.getByRole("status").textContent).toContain("15 Goblin Scrap");
  expect(screen.getByRole("button", { name: /Sharpening Stone/ }).disabled).toBe(true);
  expect(screen.getByText("Maxed")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Key Items" }));
  expect(screen.getByRole("button", { name: /Analyzer/ }).disabled).toBe(true);
  expect(screen.getByText("Owned")).toBeTruthy();
});

test("key items can be crafted from their tab and remain owned after switching tabs", () => {
  const cost = getRecipeCost(player, "analyzer");
  player = { ...player, level: 20, materials: cost.materials };
  const onChange = jest.fn();
  render(<WorkshopScreen onChange={onChange} />);
  fireEvent.click(screen.getByRole("tab", { name: "Key Items" }));
  fireEvent.click(screen.getByRole("button", { name: /Analyzer/ }));
  expect(player.keyItems).toContain("analyzer");
  expect(onChange).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("tab", { name: "Upgrades" }));
  fireEvent.click(screen.getByRole("tab", { name: "Key Items" }));
  expect(screen.getByRole("button", { name: /Analyzer/ }).disabled).toBe(true);
  expect(screen.getByText("Owned")).toBeTruthy();
});
