import { act, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { getPlayer, setPlayer } from "../../character/player";
import { recalculateStats } from "../../character/stats";
import { CONSUMABLES, KEY_ITEMS } from "../../items/consumables";
import { MATERIALS } from "../../items/materials";
import { getHolofoilStyle } from "../../items/holofoil";
import { listItem, subscribeListings } from "../../world/marketplace";
import MarketplaceScreen from "../../ui/MarketplaceScreen";
import { SCREENS } from "../../ui/screens";

jest.mock("../../firebase", () => ({ db: {}, auth: { currentUser: { uid: "alice" } } }));
jest.mock("../../ui/changelogFiles", () => ({ changelogFiles: [] }));
jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(), setPlayer: jest.fn(), savePlayerName: jest.fn(),
  getInventoryItemKey: (item) => item?.id || JSON.stringify(item),
  markInventoryItemViewed: jest.fn(),
}));
jest.mock("../../world/marketplace", () => ({
  ...jest.requireActual("../../world/marketplace"),
  getMyUid: () => "alice", subscribeListings: jest.fn(), listItem: jest.fn(),
}));

const sword = { id: "sword", name: "Alpha Sword", slot: "weapon", rarity: "Rare", iLevel: 1, price: 100, subStats: {} };
const helmet = { ...sword, id: "helmet", name: "Zeta Helmet", slot: "helmet" };
const ruby = { id: "ruby", name: "Rare Ruby", type: "ruby", stat: "strength", value: 3, rarity: "Rare" };
const sapphire = { ...ruby, id: "sapphire", name: "Rare Sapphire", type: "sapphire" };
let player;
beforeEach(() => {
  jest.clearAllMocks();
  player = {
    name: "Alice", class: "Specialist", level: 25, astra: 1000,
    stats: { strength: 2, dexterity: 2, intelligence: 2 },
    inventory: [sword, helmet], equipment: {}, gemstones: [ruby, sapphire],
    consumables: { healthPotion: 2, greaterPotion: 1 },
    materials: { slime_gel: 3, [Object.keys(MATERIALS).find((key) => key !== "slime_gel")]: 2 },
    keyItems: Object.keys(KEY_ITEMS).slice(0, 2),
  };
  player = { ...player, ...recalculateStats(player) };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
  subscribeListings.mockImplementation((callback) => { callback([]); return () => {}; });
});

const renderCharacter = () => {
  const Character = SCREENS.character.component;
  render(<Character player={player} />);
};
const cards = () => Array.from(document.querySelectorAll(".inventory-panel .inventory-list .inventory-item"));
const filter = (value) => fireEvent.change(screen.getByRole("combobox", { name: "Filter favorites" }), { target: { value } });

test("holofoil gradients appear in inventory and equipment without changing saved colors", () => {
  const foil = { ...sword, holofoil: ["#ff0000", "#0000ff"] };
  player.inventory = [foil];
  renderCharacter();
  const gradient = getHolofoilStyle(foil)["--holofoil-background"];
  expect(screen.getByRole("button", { name: sword.name }).style.getPropertyValue("--holofoil-background")).toBe(gradient);
  fireEvent.click(screen.getByRole("button", { name: sword.name }));
  fireEvent.click(screen.getByRole("button", { name: "Equip" }));
  expect(player.equipment.mainHand.holofoil).toEqual(foil.holofoil);
  expect(screen.getByRole("button", { name: `Main Hand ${sword.name}` }).style.getPropertyValue("--holofoil-background")).toBe(gradient);
});

test("Titles inventory equips an owned title and clicking it again unequips it", () => {
  const titleId = "monarchOfTheOdyssey";
  player.titles = [titleId];
  renderCharacter();
  fireEvent.click(screen.getByRole("tab", { name: /Titles/ }));

  const title = screen.getByRole("button", { name: /Monarch of the Odyssey/ });
  fireEvent.click(title);
  expect(player.activeTitle).toBe(titleId);
  expect(title).toHaveAttribute("aria-pressed", "true");

  fireEvent.click(title);
  expect(player.activeTitle).toBeNull();
  expect(title).toHaveAttribute("aria-pressed", "false");
});

test("Gemstone selection opens a gear popup and equipped gemstones can be removed", () => {
  player.inventory.push({ ...sword, id: "offhand", name: "Offhand Placeholder", twoHandedOf: "sword" });
  player.equipment = { mainHand: { ...helmet, id: "equipped-helmet" } };
  renderCharacter();
  fireEvent.click(screen.getByRole("tab", { name: /Gemstones/ }));

  const rubyCard = screen.getByRole("button", { name: /Rare Ruby/ });
  expect(rubyCard).toHaveTextContent("Strength +3");
  expect(screen.queryByText("Offhand Placeholder")).not.toBeInTheDocument();
  expect(screen.getByText("No equipped gear has a gemstone socketed.")).toBeInTheDocument();

  fireEvent.click(rubyCard);
  const popup = screen.getByRole("dialog", { name: "Socket Rare Ruby" });
  expect(within(popup).getByRole("button", { name: "Socket Rare Ruby into Zeta Helmet (Main Hand)" })).toBeInTheDocument();
  expect(within(popup).queryByRole("button", { name: /Offhand Placeholder/ })).not.toBeInTheDocument();

  fireEvent.click(within(popup).getByRole("button", { name: "Socket Rare Ruby into Zeta Helmet (Main Hand)" }));

  expect(player.gemstones).toEqual([sapphire]);
  expect(player.equipment.mainHand.gemstone).toEqual(ruby);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByText(/Socketed: Rare Ruby · Strength \+3/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove Rare Ruby from Zeta Helmet for 300 astra" }));
  expect(player.gemstones).toEqual([sapphire, ruby]);
  expect(player.equipment.mainHand.gemstone).toBeUndefined();
  expect(player.astra).toBe(700);
});

test("Gemstones can be filtered and sorted without favorite filtering", () => {
  const emerald = { id: "emerald", name: "Epic Emerald", type: "emerald", stat: "dexterity", value: 5, rarity: "Epic" };
  player.gemstones = [ruby, sapphire, emerald];
  player.favoriteInventoryItems = { gemstones: [sapphire.id] };
  renderCharacter();
  fireEvent.click(screen.getByRole("tab", { name: /Gemstones/ }));

  const gemCards = () => Array.from(document.querySelectorAll(".gemstone-inventory .gemstone-item"));
  expect(screen.queryByRole("combobox", { name: "Filter gemstones by favorite" })).not.toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Stat bonus: high to low" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Sort gemstones" }), { target: { value: "rarityDesc" } });
  expect(gemCards()[0]).toHaveTextContent("Epic Emerald");
  fireEvent.change(screen.getByRole("combobox", { name: "Filter gemstones by stat" }), { target: { value: "strength" } });
  expect(gemCards()).toHaveLength(2);
  expect(gemCards().map((card) => card.textContent)).toEqual([
    expect.stringContaining("Rare Ruby"),
    expect.stringContaining("Rare Sapphire"),
  ]);
});

test.each(["gear", "consumables", "gemstones"])(
  "Character tab notification is set for unread %s",
  (category) => {
    expect(
      SCREENS.character.notification({
        unseenInventoryItems: { [category]: ["unseen-item"] },
      }),
    ).toBe(true);
    expect(
      SCREENS.character.notification({
        unseenInventoryItems: { materials: ["unseen-material"] },
      }),
    ).toBe(false);
  },
);

test("marketplace renders the saved equipment holofoil gradient", () => {
  const foil = { ...sword, holofoil: ["#ff0000", "#0000ff"] };
  player.inventory = [foil];
  render(<MarketplaceScreen />);
  fireEvent.click(screen.getByRole("tab", { name: "Sell" }));
  const card = screen.getByRole("button", { name: new RegExp(sword.name) });
  expect(card.style.getPropertyValue("--holofoil-background")).toBe(getHolofoilStyle(foil)["--holofoil-background"]);
  expect(card).toHaveTextContent("Holofoil");
});

test("gear favorites override sorting and right-click does not equip or change favorites", () => {
  player.favoriteInventoryItems = { gear: [helmet.id] };
  renderCharacter();
  const target = screen.getByRole("button", { name: helmet.name });
  fireEvent.contextMenu(target);
  expect(player.equipment).toEqual({});
  expect(player.inventory).toEqual([sword, helmet]);
  expect(cards()[0]).toHaveTextContent(helmet.name);
  expect(cards()[0]).toHaveClass("favorite-item");
  expect(player.favoriteInventoryItems.gear).toEqual([helmet.id]);
  fireEvent.change(screen.getByRole("combobox", { name: "Sort gear" }), { target: { value: "nameAsc" } });
  expect(cards()[0]).toHaveTextContent(helmet.name);
  filter("favorites");
  expect(cards()).toHaveLength(1);
  filter("nonFavorites");
  expect(cards()).toHaveLength(1);
  expect(cards()[0]).toHaveTextContent(sword.name);
  filter("");
  fireEvent.click(screen.getByRole("button", { name: helmet.name }));
  fireEvent.click(screen.getByRole("button", { name: "Equip" }));
  expect(player.equipment.helmet.id).toBe("helmet");
  expect(player.inventory).toEqual([sword]);
});

test.each(["Consumables", "Gemstones", "Materials", "Key Items", "Titles"])(
  "%s inventory does not show the favorites filter",
  (tab) => {
    renderCharacter();
    fireEvent.click(screen.getByRole("tab", { name: new RegExp(tab) }));
    expect(screen.queryByRole("combobox", { name: "Filter favorites" })).not.toBeInTheDocument();
  },
);

test("inventory gear opens a details popup with comparison, favorite, and equip actions", () => {
  const item = {
    ...sword,
    mainStat: { stat: "strength", value: 5 },
    subStats: { speed: 2 },
  };
  player.inventory = [item];
  renderCharacter();
  fireEvent.click(screen.getByRole("button", { name: sword.name }));

  const dialog = screen.getByRole("dialog", { name: `${sword.name} details` });
  expect(within(dialog).getByText("Strength")).toBeInTheDocument();
  expect(within(dialog).getByText("Speed")).toBeInTheDocument();
  expect(within(dialog).queryByText("Nothing equipped")).not.toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Compare" })).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(within(dialog).getByRole("button", { name: "Compare" }));
  expect(within(dialog).getByText("Nothing equipped")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Hide comparison" })).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(within(dialog).getByRole("button", { name: "Hide comparison" }));
  expect(within(dialog).queryByText("Nothing equipped")).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Favorite" }));
  expect(cards()[0]).toHaveClass("favorite-item");
  fireEvent.click(within(dialog).getByRole("button", { name: "Equip" }));
  expect(player.equipment.mainHand).toEqual(item);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("hovering inventory gear shows its item stats without a comparison", () => {
  jest.useFakeTimers();
  const item = {
    ...sword,
    mainStat: { stat: "strength", value: 5 },
    subStats: { speed: 2 },
  };
  player.inventory = [item];
  renderCharacter();
  fireEvent.mouseEnter(screen.getByRole("button", { name: sword.name }), {
    clientX: 10,
    clientY: 10,
  });
  act(() => jest.advanceTimersByTime(150));

  const tooltip = screen.getByRole("tooltip");
  expect(tooltip).toHaveTextContent("Strength");
  expect(tooltip).toHaveTextContent("Speed");
  expect(tooltip).not.toHaveTextContent("If equipped");
  expect(tooltip).not.toHaveTextContent("Nothing equipped");
  jest.useRealTimers();
});

test.each([
  ["Consumables", "consumables"],
  ["Gemstones", "gemstones"],
  ["Materials", "materials"],
  ["Key Items", "keyItems"],
])("%s right-click does not favorite items or change favorite filters", (label, category) => {
  renderCharacter();
  fireEvent.click(screen.getByRole("tab", { name: new RegExp(label) }));
  const original = cards().map((card) => card.textContent);
  expect(original).toHaveLength(2);
  fireEvent.contextMenu(cards()[1]);
  filter("favorites");
  expect(cards()).toHaveLength(0);
  expect(screen.getByText("No items match this favorites filter.")).toBeInTheDocument();
  expect(player.favoriteInventoryItems?.[category]).toBeUndefined();
  filter("");
  expect(cards().map((card) => card.textContent)).toEqual(original);
});

test("favorites survive remounting and right-click does not remove them", () => {
  player.favoriteInventoryItems = { gear: [helmet.id] };
  const Character = SCREENS.character.component;
  const { unmount } = render(<Character player={player} />);
  fireEvent.contextMenu(screen.getByRole("button", { name: helmet.name }));
  unmount();
  renderCharacter();
  expect(cards()[0]).toHaveTextContent(helmet.name);
  expect(cards()[0]).toHaveClass("favorite-item");
  fireEvent.contextMenu(cards()[0]);
  expect(cards()[0]).toHaveTextContent(helmet.name);
  expect(cards()[0]).toHaveClass("favorite-item");
  expect(player.favoriteInventoryItems.gear).toEqual([helmet.id]);
});

test("marketplace marks all favorite item kinds as unavailable and does not offer listing", () => {
  const materialKey = Object.keys(player.materials)[0];
  player.favoriteInventoryItems = {
    gear: [sword.id], consumables: ["healthPotion"],
    gemstones: [ruby.id], materials: [materialKey],
  };
  render(<MarketplaceScreen />);
  fireEvent.click(screen.getByRole("tab", { name: "Sell" }));
  for (const name of [sword.name, CONSUMABLES.healthPotion.name, ruby.name, MATERIALS[materialKey].name]) {
    const card = screen.getByRole("button", { name: (label) => label.startsWith(`${name} `) });
    expect(card).toHaveAttribute("aria-disabled", "true");
    expect(card).toHaveClass("favorite-item");
    fireEvent.click(card);
    expect(screen.queryByRole("button", { name: "List item" })).toBeNull();
  }
  expect(listItem).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: new RegExp(helmet.name) }));
  expect(screen.getByRole("button", { name: "List item" })).toBeInTheDocument();
});

test("trader gear popup protects favorites and allows unfavoriting before selling", () => {
  player.favoriteInventoryItems = { gear: [sword.id], gemstones: [ruby.id] };
  const Trader = SCREENS.gearTrader.component;
  render(<Trader />);
  const card = screen.getByRole("button", { name: /Alpha Sword/ });
  expect(card).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(card);
  const dialog = screen.getByRole("dialog", { name: `${sword.name} details` });
  expect(within(dialog).getByRole("button", { name: "Sell" })).toBeDisabled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Unfavorite" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Sell" }));
  expect(player.inventory).toEqual([helmet]);
  expect(player.astra).toBe(1050);
  fireEvent.click(screen.getByRole("tab", { name: "Sell Gems" }));
  const gem = screen.getByRole("button", { name: /Rare Ruby/ });
  expect(within(gem).getByText("Favorite • cannot sell")).toBeInTheDocument();
  fireEvent.click(gem);
  expect(player.gemstones).toEqual([ruby, sapphire]);
  expect(player.astra).toBe(1050);
});

test("trader can mass-sell selected gear while excluding favorites", () => {
  player.favoriteInventoryItems = { gear: [sword.id] };
  const equippedBoots = { ...sword, id: "equipped-boots", name: "Equipped Boots", slot: "boots" };
  player.equipment = { boots: equippedBoots };
  const Trader = SCREENS.gearTrader.component;
  render(<Trader />);

  fireEvent.click(screen.getByRole("button", { name: "Select all sellable gear" }));
  expect(screen.getByRole("checkbox", { name: `Select ${sword.name} to sell` })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: `Select equipped ${equippedBoots.name} to sell` })).not.toBeChecked();
  expect(screen.getByRole("button", { name: /Sell selected \(1 • 50 astra\)/ })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: /Sell selected/ }));

  expect(player.inventory).toEqual([sword]);
  expect(player.equipment.boots).toEqual(equippedBoots);
  expect(player.astra).toBe(1050);
  expect(screen.getByText("1 gear item sold for 50 astra.")).toBeInTheDocument();
});

test("trader can mass-sell selected gems while leaving favorites untouched", () => {
  player.favoriteInventoryItems = { gemstones: [ruby.id] };
  const Trader = SCREENS.gearTrader.component;
  render(<Trader />);
  fireEvent.click(screen.getByRole("tab", { name: "Sell Gems" }));

  fireEvent.click(screen.getByRole("button", { name: "Select all sellable gems" }));
  expect(screen.getByRole("checkbox", { name: `Select ${ruby.name} to sell` })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Sell selected \(1 • 600 astra\)/ })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: /Sell selected/ }));

  expect(player.gemstones).toEqual([ruby]);
  expect(player.astra).toBe(1600);
  expect(screen.getByText("1 gem sold for 600 astra.")).toBeInTheDocument();
});
