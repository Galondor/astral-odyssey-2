import { fireEvent, render, screen } from "@testing-library/react";
import { getPlayer, setPlayer } from "../../character/player";
import { recalculateStats } from "../../character/stats";
import { SCREENS } from "../../ui/screens";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(), setPlayer: jest.fn(), markInventoryItemViewed: jest.fn(),
  getInventoryItemKey: (item) => item.id,
}));
jest.mock("../../ui/ChangelogScreen", () => () => null);
jest.mock("../../ui/LeaderboardScreen", () => () => null);
jest.mock("../../ui/InboxScreen", () => () => null);
jest.mock("../../ui/MarketplaceScreen", () => () => null);
jest.mock("../../ui/AdminScreen", () => () => null);
jest.mock("../../ui/BugReportScreen", () => () => null);

const CharacterScreen = SCREENS.character.component;
let player;
beforeEach(() => {
  player = {
    name: "Nova", level: 20, baseStats: { strength: 5, dexterity: 5, intelligence: 5 },
    consumables: { architectsRune: 2 }, equipment: {},
    inventory: [
      { id: "sword", name: "Iron Sword", slot: "weapon", rarity: "Rare", iLevel: 5,
        mainStat: { stat: "strength", value: 12, tier: 4 } },
      { id: "crafted", name: "Crafted Helmet", slot: "helmet", rarity: "Rare", iLevel: 5,
        mainStat: { stat: "strength", value: 12, tier: 4 }, crafted: true },
    ],
  };
  player = { ...player, ...recalculateStats(player) };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
});

function openRune() {
  fireEvent.click(screen.getByRole("tab", { name: /Consumables/ }));
  fireEvent.click(screen.getByRole("button", { name: "Architect's Rune x2" }));
}

test("selecting and applying a rune persists Crafted gear and hides it from further rune targets", () => {
  render(<CharacterScreen player={player} />);
  openRune();
  expect(player.consumables.architectsRune).toBe(2);
  expect(screen.queryByRole("option", { name: /Crafted Helmet/ })).toBeNull();
  fireEvent.change(screen.getByLabelText("Rune target"), { target: { value: "sword" } });
  expect(screen.queryByRole("option", { name: "Strength" })).toBeNull();
  fireEvent.change(screen.getByLabelText("New main stat"), { target: { value: "intelligence" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply rune" }));
  expect(player.inventory[0]).toMatchObject({
    crafted: true, mainStat: { stat: "intelligence", value: 12, tier: 4 },
  });
  expect(player.consumables.architectsRune).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "Architect's Rune x1" }));
  expect(screen.queryByRole("option", { name: /Iron Sword/ })).toBeNull();
  expect(screen.getByText(/You have no eligible items/)).toBeTruthy();
});

test("cancelling does not consume a rune or change an item", () => {
  render(<CharacterScreen player={player} />);
  openRune();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByLabelText("Rune target")).toBeNull();
  expect(player.consumables.architectsRune).toBe(2);
  expect(player.inventory[0].crafted).toBeUndefined();
});

test("combat disables rune selection", () => {
  render(<CharacterScreen player={player} inCombat />);
  fireEvent.click(screen.getByRole("tab", { name: /Consumables/ }));
  expect(screen.getByRole("button", { name: "Architect's Rune x2" }).disabled).toBe(true);
});
