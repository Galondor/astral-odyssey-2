import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getPlayer, savePlayerName } from "../../character/player";
import { recalculateStats } from "../../character/stats";
import { getBroadcasts, getDirectory, sendMessage } from "../../world/inbox";
import { listItem, subscribeListings } from "../../world/marketplace";
import AdminScreen from "../../ui/AdminScreen";
import MarketplaceScreen from "../../ui/MarketplaceScreen";
import { SCREENS } from "../../ui/screens";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../ui/changelogFiles", () => ({ changelogFiles: [] }));
jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(), setPlayer: jest.fn(), savePlayerName: jest.fn(),
  getInventoryItemKey: (item) => item?.id,
  markInventoryItemViewed: jest.fn(),
}));
jest.mock("../../world/inbox", () => ({
  ...jest.requireActual("../../world/inbox"),
  getDirectory: jest.fn(), getBroadcasts: jest.fn(), sendMessage: jest.fn(),
}));
jest.mock("../../world/marketplace", () => ({
  ...jest.requireActual("../../world/marketplace"),
  getMyUid: () => "alice", subscribeListings: jest.fn(), listItem: jest.fn(),
}));

let player;
beforeEach(() => {
  jest.clearAllMocks();
  player = {
    name: "Alice", class: "Specialist", level: 25, astra: 1000,
    stats: { strength: 2, dexterity: 2, intelligence: 2 },
    consumables: { elixirOfNameChanging: 2 }, inventory: [], equipment: {},
  };
  player = { ...player, ...recalculateStats(player) };
  getPlayer.mockImplementation(() => player);
  getDirectory.mockResolvedValue([{ uid: "alice", name: "Alice" }]);
  getBroadcasts.mockResolvedValue([]);
  sendMessage.mockResolvedValue();
  subscribeListings.mockImplementation((callback) => { callback([]); return () => {}; });
  listItem.mockResolvedValue({ ok: true, message: "Listed" });
});

test("using an elixir opens a cancellable name form; successful saves refresh the character and navbar", async () => {
  const Character = SCREENS.character.component;
  const onChange = jest.fn();
  render(<Character player={player} onChange={onChange} />);
  fireEvent.click(screen.getByRole("tab", { name: /Consumables/ }));
  fireEvent.click(screen.getByRole("button", { name: /Elixir of Name Changing/ }));
  expect(screen.getByRole("textbox", { name: "New character name" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(savePlayerName).not.toHaveBeenCalled();
  expect(player.consumables.elixirOfNameChanging).toBe(2);

  fireEvent.click(screen.getByRole("button", { name: /Elixir of Name Changing/ }));
  savePlayerName.mockImplementation(async (name) => {
    player = { ...player, name, consumables: { elixirOfNameChanging: 1 } };
    return { ok: true, message: "Name saved" };
  });
  onChange.mockClear();
  fireEvent.change(screen.getByRole("textbox", { name: "New character name" }), { target: { value: "Nova" } });
  fireEvent.click(screen.getByRole("button", { name: "Save name" }));
  await screen.findByRole("heading", { name: /Nova the/ });
  expect(screen.queryByRole("textbox", { name: "New character name" })).toBeNull();
  expect(screen.getByRole("button", { name: /Elixir of Name Changing x1/ })).toBeTruthy();
  expect(onChange).toHaveBeenCalled();
});

test("a taken name shows the error and keeps the form and elixir", async () => {
  const Character = SCREENS.character.component;
  render(<Character player={player} />);
  fireEvent.click(screen.getByRole("tab", { name: /Consumables/ }));
  fireEvent.click(screen.getByRole("button", { name: /Elixir of Name Changing/ }));
  savePlayerName.mockResolvedValue({ ok: false, message: "That name is already taken." });
  fireEvent.change(screen.getByRole("textbox", { name: "New character name" }), { target: { value: "Taken" } });
  fireEvent.click(screen.getByRole("button", { name: "Save name" }));
  await screen.findByText("That name is already taken.");
  expect(screen.getByRole("textbox", { name: "New character name" })).toBeTruthy();
  expect(player.consumables.elixirOfNameChanging).toBe(2);
});

test("using Prismatic Alloy opens an item picker and applies a new foil", async () => {
  player.consumables.prismaticAlloy = 1;
  player.inventory = [{ id: "sword", name: "Iron Sword", slot: "weapon" }];
  const Character = SCREENS.character.component;
  render(<Character player={player} />);
  fireEvent.click(screen.getByRole("tab", { name: /Consumables/ }));
  fireEvent.click(screen.getByRole("button", { name: /Prismatic Alloy/ }));
  expect(screen.getByLabelText("Item to apply the alloy to")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Item to apply the alloy to"), { target: { value: "sword" } });
  jest.spyOn(Math, "random").mockReturnValue(0.5);
  fireEvent.click(screen.getByRole("button", { name: "Apply alloy" }));
  await screen.findByText(/Holofoil was applied/);
  expect(setPlayer).toHaveBeenCalledWith(expect.objectContaining({
    consumables: {},
    inventory: [expect.objectContaining({ id: "sword", holofoil: ["#800000", "#800000"] })],
  }));
});

test("consumables can be selected and listed from the marketplace sell tab", async () => {
  render(<MarketplaceScreen />);
  fireEvent.click(screen.getByRole("tab", { name: "Sell" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Item type" }), { target: { value: "consumable" } });
  fireEvent.click(screen.getByRole("button", { name: /Elixir of Name Changing/ }));
  fireEvent.change(screen.getByPlaceholderText("Price"), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: "List item" }));
  await waitFor(() => expect(listItem).toHaveBeenCalledWith("elixirOfNameChanging", "100", 0));
});

test.each(["all", "alice"])("admins can select the elixir and mail it to %s", async (to) => {
  render(<AdminScreen />);
  await waitFor(() => expect(getDirectory).toHaveBeenCalled());
  if (to === "alice") {
    fireEvent.click(screen.getByRole("tab", { name: "Individual Message" }));
    fireEvent.focus(screen.getByRole("combobox", { name: "Player" }));
    fireEvent.mouseDown(await screen.findByRole("option", { name: /Alice/ }));
  }
  fireEvent.change(screen.getByRole("option", { name: "Consumable" }).parentElement, { target: { value: "consumable" } });
  const itemSelect = screen.getByRole("option", { name: "Elixir of Name Changing" }).parentElement;
  fireEvent.change(itemSelect, { target: { value: "elixirOfNameChanging" } });
  fireEvent.click(screen.getByRole("button", { name: "Attach" }));
  fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Name elixir" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "A gift" } });
  fireEvent.click(screen.getByRole("button", { name: /Send/ }));
  await waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
    to, attachments: expect.objectContaining({ consumables: { elixirOfNameChanging: 1 } }),
  })));
});

test("admins can attach Prismatic Alloy to mail", async () => {
  render(<AdminScreen />);
  await waitFor(() => expect(getDirectory).toHaveBeenCalled());
  fireEvent.change(screen.getByRole("option", { name: "Consumable" }).parentElement, { target: { value: "consumable" } });
  const itemSelect = screen.getByRole("option", { name: "Prismatic Alloy" }).parentElement;
  fireEvent.change(itemSelect, { target: { value: "prismaticAlloy" } });
  fireEvent.click(screen.getByRole("button", { name: "Attach" }));
  fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Alloy gift" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "A gift" } });
  fireEvent.click(screen.getByRole("button", { name: /Send to all players/ }));
  await waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
    to: "all", attachments: expect.objectContaining({ consumables: { prismaticAlloy: 1 } }),
  })));
});
