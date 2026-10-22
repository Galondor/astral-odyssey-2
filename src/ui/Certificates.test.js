import { fireEvent, render, screen } from "@testing-library/react";
import { getPlayer, setPlayer } from "../character/player";
import { recalculateStats } from "../character/stats";
import { SCREENS } from "./screens";

jest.mock("../firebase", () => ({ db: {} }));
jest.mock("../character/player", () => ({
  getPlayer: jest.fn(), setPlayer: jest.fn(), markInventoryItemViewed: jest.fn(),
  getInventoryItemKey: (item) => item.id,
}));
jest.mock("./ChangelogScreen", () => () => null);
jest.mock("./LeaderboardScreen", () => () => null);
jest.mock("./InboxScreen", () => () => null);
jest.mock("./MarketplaceScreen", () => () => null);
jest.mock("./AdminScreen", () => () => null);
jest.mock("./BugReportScreen", () => () => null);

const CharacterScreen = SCREENS.character.component;
let player;
beforeEach(() => {
  player = {
    name: "Nova", level: 20, baseStats: { strength: 5, dexterity: 5, intelligence: 5 },
    consumables: { itemCertificate: 2 },
    inventory: [{ id: "sword", name: "Iron Sword", slot: "weapon", rarity: "Rare", iLevel: 5 }],
    equipment: {
      mainHand: { id: "staff", name: "Wooden Staff", slot: "weapon", twoHanded: true, rarity: "Rare", iLevel: 5 },
      offHand: { twoHandedOf: "mainHand", name: "Wooden Staff", rarity: "Rare" },
    },
  };
  player = { ...player, ...recalculateStats(player) };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
});

function openCertificate() {
  fireEvent.click(screen.getByRole("tab", { name: /Consumables/ }));
  fireEvent.click(screen.getByRole("button", { name: "Item Certificate x2" }));
}

test("renames gear through the certificate UI and updates the remaining count", () => {
  render(<CharacterScreen player={player} />);
  openCertificate();
  expect(player.consumables.itemCertificate).toBe(2);
  expect(screen.getAllByRole("option", { name: "Wooden Staff" })).toHaveLength(1);
  fireEvent.change(screen.getByLabelText("Item to rename"), { target: { value: "sword" } });
  fireEvent.change(screen.getByLabelText("New item name"), { target: { value: "Nova Blade 42" } });
  fireEvent.click(screen.getByRole("button", { name: "Rename item" }));
  expect(player.inventory[0].name).toBe("Nova Blade 42");
  expect(screen.getByRole("button", { name: "Item Certificate x1" })).toBeTruthy();
  expect(screen.queryByLabelText("New item name")).toBeNull();
});

test("invalid names display an error without consuming a certificate; cancelling changes nothing", () => {
  render(<CharacterScreen player={player} />);
  openCertificate();
  fireEvent.change(screen.getByLabelText("Item to rename"), { target: { value: "sword" } });
  for (const name of ["Sword!", "F u c k"]) {
    fireEvent.change(screen.getByLabelText("New item name"), { target: { value: name } });
    fireEvent.click(screen.getByRole("button", { name: "Rename item" }));
    expect(player.inventory[0].name).toBe("Iron Sword");
    expect(player.consumables.itemCertificate).toBe(2);
  }
  expect(screen.getByText("Please choose an appropriate name.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByLabelText("New item name")).toBeNull();
  expect(player.consumables.itemCertificate).toBe(2);
});

test("combat prevents opening the certificate flow", () => {
  render(<CharacterScreen player={player} inCombat />);
  fireEvent.click(screen.getByRole("tab", { name: /Consumables/ }));
  expect(screen.getByRole("button", { name: "Item Certificate x2" }).disabled).toBe(true);
});
