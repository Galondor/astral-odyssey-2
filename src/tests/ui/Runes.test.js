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
  screen.getByRole("dialog", { name: "Use Architect's Rune" });
  expect(screen.queryByRole("button", { name: /Crafted Helmet/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Iron Sword/ }));
  fireEvent.change(screen.getByLabelText("New main stat"), { target: { value: "intelligence" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply rune" }));
  expect(player.inventory[0]).toMatchObject({
    crafted: true, mainStat: { stat: "intelligence", value: 12, tier: 4 },
  });
  expect(player.consumables.architectsRune).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "Architect's Rune x1" }));
  expect(screen.getByRole("dialog", { name: "Use Architect's Rune" })).toBeTruthy();
  expect(screen.getByText(/You have no eligible items/)).toBeTruthy();
});

test("cancelling does not consume a rune or change an item", () => {
  render(<CharacterScreen player={player} />);
  openRune();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog", { name: "Use Architect's Rune" })).toBeNull();
  expect(player.consumables.architectsRune).toBe(2);
  expect(player.inventory[0].crafted).toBeUndefined();
});

test("the unpredictability rune can be applied without choosing a main stat", () => {
  player.consumables.runeOfUnpredictability = 1;
  jest.spyOn(Math, "random").mockReturnValue(0.01);
  render(<CharacterScreen player={player} />);
  fireEvent.click(screen.getByRole("tab", { name: /Consumables/ }));
  fireEvent.click(screen.getByRole("button", { name: "Rune of Unpredictability x1" }));
  fireEvent.click(screen.getByRole("button", { name: /Iron Sword/ }));

  expect(screen.queryByLabelText("New main stat")).toBeNull();
  expect(screen.getByRole("button", { name: "Apply rune" }).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Apply rune" }));

  expect(player.inventory[0].crafted).toBe(true);
  expect(player.consumables.runeOfUnpredictability).toBeUndefined();
  expect(screen.getByRole("status").textContent).toContain("nothing happened");
});

test("combat disables rune selection", () => {
  render(<CharacterScreen player={player} inCombat />);
  fireEvent.click(screen.getByRole("tab", { name: /Consumables/ }));
  expect(screen.getByRole("button", { name: "Architect's Rune x2" }).disabled).toBe(true);
});
