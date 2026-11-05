import { fireEvent, render, screen, within } from "@testing-library/react";
import { getPlayer, setPlayer } from "../../character/player";
import { SCREENS } from "../../ui/screens";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../character/player", () => ({
  ...jest.requireActual("../../character/player"),
  getPlayer: jest.fn(),
  setPlayer: jest.fn(),
}));
jest.mock("../../ui/ChangelogScreen", () => () => null);
jest.mock("../../ui/LeaderboardScreen", () => () => null);
jest.mock("../../ui/InboxScreen", () => () => null);
jest.mock("../../ui/MarketplaceScreen", () => () => null);
jest.mock("../../ui/AdminScreen", () => () => null);
jest.mock("../../ui/BugReportScreen", () => () => null);

beforeEach(() => jest.clearAllMocks());

test("Forge accepts a free custom name and charges for a fixed condition", () => {
  getPlayer.mockReturnValue({
    level: 30,
    materials: { relicFragments: 100, sealedRelic: 1 },
    consumables: {},
    inventory: [],
  });
  const onChange = jest.fn();
  const ForgeScreen = SCREENS.forge.component;
  render(<ForgeScreen onChange={onChange} />);
  const rarityOptions = Array.from(screen.getByLabelText("Rarity").options).map((option) => option.value);
  const conditionOptions = Array.from(screen.getByLabelText("Condition").options).map((option) => option.textContent);
  expect(rarityOptions).not.toContain("Unique");
  expect(rarityOptions).not.toContain("Mythic");
  expect(rarityOptions).toEqual(["Common", "Uncommon", "Rare", "Epic", "Legendary"]);
  expect(conditionOptions).toEqual([
    "Random · Free",
    "Broken · Free",
    "Poor · Free",
    "Average · +10 fragments",
    "Pristine · +20 fragments",
    "Flawless · +30 fragments",
    "Perfect · +40 fragments",
  ]);

  fireEvent.change(screen.getByPlaceholderText("Random name"), {
    target: { value: "The Chosen Path" },
  });
  fireEvent.change(screen.getByLabelText("Rarity"), {
    target: { value: "Common" },
  });
  fireEvent.change(screen.getByLabelText("Condition"), {
    target: { value: "Perfect" },
  });
  expect(screen.getByText("40 / 100 fragments")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Forge Custom Item" }));

  expect(setPlayer).toHaveBeenCalledWith(expect.objectContaining({
    materials: { relicFragments: 60 },
    inventory: [expect.objectContaining({
      name: "The Chosen Path",
      condition: "Perfect",
      rarity: "Common",
    })],
  }));
  expect(onChange).toHaveBeenCalled();
});

const gear = (changes = {}) => ({
  id: "sword", name: "Iron Sword", slot: "weapon", rarity: "Rare", iLevel: 50,
  mainStat: { stat: "strength", value: 7 }, subStats: { speed: 25 }, price: 500,
  ...changes,
});

test("Upgrading only shows inventory gear and refreshes costs and upgrade counts", () => {
  let player = {
    level: 100, astra: 15200, stats: {}, baseStats: { strength: 2, dexterity: 2, intelligence: 2 },
    inventory: [
      gear({ id: "bag", name: "Bag Sword", twoHanded: true }),
      gear({ id: "ring1", name: "First Ring", slot: "ring" }),
      gear({ id: "ring2", name: "Second Ring", slot: "ring", upgrades: 10 }),
      { id: "invalid", name: "Placeholder", twoHandedOf: "mainHand" },
    ],
    equipment: {
      mainHand: gear({ twoHanded: true }),
      offHand: { twoHandedOf: "mainHand", name: "Iron Sword" },
    },
  };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
  const onChange = jest.fn();
  const ForgeScreen = SCREENS.forge.component;
  render(<ForgeScreen onChange={onChange} />);
  fireEvent.click(screen.getByRole("tab", { name: "Upgrading" }));
  expect(screen.getByRole("tab", { name: "Upgrading" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("region", { name: "Gear available to upgrade" }).tabIndex).toBe(0);
  expect(screen.getByText("Bag Sword")).toBeTruthy();
  expect(screen.queryByText("Iron Sword")).toBeNull();
  expect(screen.queryByText("Placeholder")).toBeNull();
  expect(screen.queryByRole("button", { name: "Upgrade Off Hand" })).toBeNull();
  expect(screen.getByRole("button", { name: "Upgrade Second Ring" }).disabled).toBe(true);
  expect(screen.getByText("Maximum upgrades reached (10).")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Upgrade Bag Sword" }));
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(player.inventory[0]).toMatchObject({ iLevel: 51, upgrades: 1 });
  expect(player.equipment.mainHand.iLevel).toBe(50);
  expect(player.astra).toBe(10200);
  expect(screen.getByText("Item Level 51 → 52 · 10200 astra")).toBeTruthy();
  const card = screen.getByRole("region", { name: "Bag Sword upgrade" });
  const count = within(card).getByText("Upgrades: 1");
  expect(count.previousElementSibling.textContent).toContain("Item Level 51");

  fireEvent.click(within(card).getByRole("button", { name: /Bag Sword Rare/ }));
  const popup = screen.getByRole("dialog", { name: "Bag Sword details" });
  expect(within(popup).getByText("Upgrades: 1").previousElementSibling.textContent).toContain("Item Level 51");
  fireEvent.click(within(popup).getByRole("button", { name: "Close" }));

  fireEvent.click(screen.getByRole("button", { name: "Upgrade Bag Sword" }));
  expect(player.astra).toBe(0);
  expect(screen.getByRole("button", { name: "Upgrade Bag Sword" }).disabled).toBe(true);
  expect(screen.getByRole("button", { name: "Upgrade First Ring" }).disabled).toBe(true);
  expect(within(card).getByText("Upgrades: 2")).toBeTruthy();
});

test("Upgrading handles empty inventory and items at the level cap", () => {
  let player = { equipment: { mainHand: gear() }, inventory: [], astra: 1000000 };
  getPlayer.mockImplementation(() => player);
  const ForgeScreen = SCREENS.forge.component;
  const { rerender } = render(<ForgeScreen />);
  fireEvent.click(screen.getByRole("tab", { name: "Upgrading" }));
  expect(screen.getByText("Unequip some gear or add gear to your inventory to upgrade it here.")).toBeTruthy();
  player = { ...player, inventory: [gear({ id: "bag", name: "Bag Sword", iLevel: 100 })] };
  rerender(<ForgeScreen />);
  expect(screen.getByText("Maximum item level reached (100).")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Upgrade Bag Sword" }).disabled).toBe(true);
  expect(setPlayer).not.toHaveBeenCalled();
});

test("equipping a selected item removes it and closes its upgrade popup", () => {
  let player = { inventory: [gear()], equipment: {}, astra: 10000 };
  getPlayer.mockImplementation(() => player);
  const ForgeScreen = SCREENS.forge.component;
  const { rerender } = render(<ForgeScreen />);
  fireEvent.click(screen.getByRole("tab", { name: "Upgrading" }));
  fireEvent.click(within(screen.getByRole("region", { name: "Iron Sword upgrade" })).getByRole("button", { name: /Iron Sword Rare/ }));
  expect(screen.getByRole("dialog", { name: "Iron Sword details" })).toBeTruthy();
  player = { ...player, equipment: { mainHand: player.inventory[0] }, inventory: [] };
  rerender(<ForgeScreen />);
  expect(screen.queryByRole("dialog", { name: "Iron Sword details" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Upgrade Iron Sword" })).toBeNull();
  expect(setPlayer).not.toHaveBeenCalled();
});
