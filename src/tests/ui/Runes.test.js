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
      { id: "sword", name: "Iron Sword", slot: "weapon", rarity: "Rare", condition: "Average", iLevel: 5, price: 300,
        mainStat: { stat: "strength", value: 12, tier: 4 } },
      { id: "crafted", name: "Crafted Helmet", slot: "helmet", rarity: "Rare", iLevel: 5,
        mainStat: { stat: "strength", value: 12, tier: 4 }, crafted: true },
    ],
  };
  player = { ...player, ...recalculateStats(player) };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
});

afterEach(() => jest.restoreAllMocks());

function openRune() {
  fireEvent.click(screen.getByRole("tab", { name: /Consumables/ }));
  fireEvent.click(screen.getByRole("button", { name: "Architect's Rune x2" }));
  fireEvent.click(screen.getByRole("button", { name: "Use" }));
}

test("selecting and applying a rune tags gear and hides it only from that rune's targets", () => {
  render(<CharacterScreen player={player} />);
  openRune();
  expect(player.consumables.architectsRune).toBe(2);
  screen.getByRole("dialog", { name: "Use Architect's Rune" });
  expect(screen.getByRole("button", { name: /Crafted Helmet/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Iron Sword/ }));
  fireEvent.change(screen.getByLabelText("New main stat"), { target: { value: "intelligence" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(player.inventory[0]).toMatchObject({
    usedRunes: ["Architect's Rune"], mainStat: { stat: "intelligence", value: 12, tier: 4 },
  });
  expect(player.consumables.architectsRune).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "Architect's Rune x1" }));
  fireEvent.click(screen.getByRole("button", { name: "Use" }));
  expect(screen.getByRole("dialog", { name: "Use Architect's Rune" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Iron Sword/ })).toBeNull();
  expect(screen.getByRole("button", { name: /Crafted Helmet/ })).toBeTruthy();
});

test("cancelling does not consume a rune or change an item", () => {
  render(<CharacterScreen player={player} />);
  openRune();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog", { name: "Use Architect's Rune" })).toBeNull();
  expect(player.consumables.architectsRune).toBe(2);
  expect(player.inventory[0].crafted).toBeUndefined();
});

test("item-target popup shows equipment details on focus", async () => {
  render(<CharacterScreen player={player} />);
  openRune();
  fireEvent.focus(screen.getByRole("button", { name: /Iron Sword/ }));

  const tooltip = await screen.findByRole("tooltip");
  expect(tooltip.textContent).toContain("Iron Sword");
  expect(tooltip.textContent).toContain("Strength");
});

test("the unpredictability rune can be applied without choosing a main stat", () => {
  player.consumables.runeOfUnpredictability = 1;
  jest.spyOn(Math, "random").mockReturnValue(0.01);
  render(<CharacterScreen player={player} />);
  fireEvent.click(screen.getByRole("tab", { name: /Consumables/ }));
  fireEvent.click(screen.getByRole("button", { name: "Rune of Unpredictability x1" }));
  fireEvent.click(screen.getByRole("button", { name: "Use" }));
  fireEvent.click(screen.getByRole("button", { name: /Iron Sword/ }));

  expect(screen.queryByLabelText("New main stat")).toBeNull();
  expect(screen.getByRole("button", { name: "Apply" }).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));

  expect(player.inventory[0].usedRunes).toEqual(["Rune of Unpredictability"]);
  expect(player.inventory[0].crafted).toBeUndefined();
  expect(player.consumables.runeOfUnpredictability).toBeUndefined();
  expect(screen.getByRole("status").textContent).toContain("nothing happened");
});

test.each([
  ["runeOfAscension", "Rune of Ascension", { rarity: "Epic" }],
  ["polishingRune", "Polishing Rune", { condition: "Pristine" }],
])("%s can be applied without main-stat selection and respects its quality cap", (key, name, expected) => {
  player.inventory[0].condition = "Average";
  player.inventory[1].condition = "Perfect";
  player.inventory[1].rarity = "Legendary";
  player.consumables[key] = 1;
  render(<CharacterScreen player={player} />);
  fireEvent.click(screen.getByRole("tab", { name: /Consumables/ }));
  fireEvent.click(screen.getByRole("button", { name: `${name} x1` }));
  fireEvent.click(screen.getByRole("button", { name: "Use" }));
  expect(screen.queryByRole("button", { name: /Crafted Helmet/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Iron Sword/ }));
  expect(screen.queryByLabelText("New main stat")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  expect(screen.getByRole("status").textContent).toContain(`Added the ${name} tag`);
  expect(player.inventory[0]).toMatchObject({ ...expected, usedRunes: [name] });
  expect(player.consumables[key]).toBeUndefined();
});

test("combat permits inspecting runes but disables use and deletion", () => {
  render(<CharacterScreen player={player} inCombat />);
  fireEvent.click(screen.getByRole("tab", { name: /Consumables/ }));
  fireEvent.click(screen.getByRole("button", { name: "Architect's Rune x2" }));
  expect(screen.getByRole("dialog", { name: "Architect's Rune details" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Use" }).disabled).toBe(true);
  expect(screen.getByRole("button", { name: "Delete item" }).disabled).toBe(true);
});
