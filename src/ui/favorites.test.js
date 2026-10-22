import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { getPlayer, setPlayer } from "../character/player";
import { recalculateStats } from "../character/stats";
import { CONSUMABLES, KEY_ITEMS } from "../items/consumables";
import { MATERIALS } from "../items/materials";
import { getHolofoilStyle } from "../items/holofoil";
import { listItem, subscribeListings } from "../world/marketplace";
import MarketplaceScreen from "./MarketplaceScreen";
import { SCREENS } from "./screens";

jest.mock("../firebase", () => ({ db: {}, auth: { currentUser: { uid: "alice" } } }));
jest.mock("./changelogFiles", () => ({ changelogFiles: [] }));
jest.mock("../character/player", () => ({
  getPlayer: jest.fn(), setPlayer: jest.fn(), savePlayerName: jest.fn(),
  getInventoryItemKey: (item) => item?.id || JSON.stringify(item),
  markInventoryItemViewed: jest.fn(),
}));
jest.mock("../world/marketplace", () => ({
  ...jest.requireActual("../world/marketplace"),
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
  expect(player.equipment.mainHand.holofoil).toEqual(foil.holofoil);
  expect(screen.getByRole("button", { name: `Main Hand ${sword.name}` }).style.getPropertyValue("--holofoil-background")).toBe(gradient);
});

test("marketplace renders the saved equipment holofoil gradient", () => {
  const foil = { ...sword, holofoil: ["#ff0000", "#0000ff"] };
  player.inventory = [foil];
  render(<MarketplaceScreen />);
  fireEvent.click(screen.getByRole("tab", { name: "Sell" }));
  const card = screen.getByRole("button", { name: new RegExp(sword.name) });
  expect(card.style.getPropertyValue("--holofoil-background")).toBe(getHolofoilStyle(foil)["--holofoil-background"]);
  expect(card).toHaveTextContent("Holofoil");
});

test("right-click favorites gear without equipping; favorites override sorting and preserve equip indices", () => {
  renderCharacter();
  const target = screen.getByRole("button", { name: helmet.name });
  expect(fireEvent.contextMenu(target)).toBe(false);
  expect(player.equipment).toEqual({});
  expect(player.inventory).toEqual([sword, helmet]);
  expect(cards()[0]).toHaveTextContent(helmet.name);
  expect(cards()[0]).toHaveClass("favorite-item");
  fireEvent.change(screen.getByRole("combobox", { name: "Sort gear" }), { target: { value: "nameAsc" } });
  expect(cards()[0]).toHaveTextContent(helmet.name);
  filter("favorites");
  expect(cards()).toHaveLength(1);
  filter("nonFavorites");
  expect(cards()).toHaveLength(1);
  expect(cards()[0]).toHaveTextContent(sword.name);
  filter("");
  fireEvent.click(screen.getByRole("button", { name: helmet.name }));
  expect(player.equipment.helmet.id).toBe("helmet");
  expect(player.inventory).toEqual([sword]);
});

test.each([
  ["Consumables", "consumables"],
  ["Gemstones", "gemstones"],
  ["Materials", "materials"],
  ["Key Items", "keyItems"],
])("%s support favorite ordering, both filters, and right-click unfavorite", (label, category) => {
  renderCharacter();
  fireEvent.click(screen.getByRole("tab", { name: new RegExp(label) }));
  const original = cards().map((card) => card.textContent);
  expect(original).toHaveLength(2);
  fireEvent.contextMenu(cards()[1]);
  expect(cards()[0].textContent).toBe(original[1]);
  expect(cards()[0]).toHaveClass("favorite-item");
  expect(player.favoriteInventoryItems[category]).toHaveLength(1);
  filter("nonFavorites");
  expect(cards().map((card) => card.textContent)).toEqual([original[0]]);
  filter("favorites");
  expect(cards()).toHaveLength(1);
  fireEvent.contextMenu(cards()[0]);
  expect(cards()).toHaveLength(0);
  expect(screen.getByText("No items match this favorites filter.")).toBeInTheDocument();
  filter("");
  expect(cards().map((card) => card.textContent)).toEqual(original);
});

test("favorites and their borders survive remounting the character", () => {
  const Character = SCREENS.character.component;
  const { unmount } = render(<Character player={player} />);
  fireEvent.contextMenu(screen.getByRole("button", { name: helmet.name }));
  unmount();
  renderCharacter();
  expect(cards()[0]).toHaveTextContent(helmet.name);
  expect(cards()[0]).toHaveClass("favorite-item");
  fireEvent.contextMenu(cards()[0]);
  expect(cards()[0]).toHaveTextContent(sword.name);
  expect(document.querySelector(".favorite-item")).toBeNull();
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

test("trader displays protected gear and gemstones and refuses clicks", () => {
  player.favoriteInventoryItems = { gear: [sword.id], gemstones: [ruby.id] };
  const Trader = SCREENS.gearTrader.component;
  render(<Trader />);
  const card = screen.getByRole("button", { name: /Alpha Sword/ });
  expect(card).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(card);
  expect(screen.getByText("Unfavorite that item in your inventory before selling it.")).toBeInTheDocument();
  expect(player.inventory).toEqual([sword, helmet]);
  fireEvent.click(screen.getByRole("tab", { name: "Sell Gems" }));
  const gem = screen.getByRole("button", { name: /Rare Ruby/ });
  expect(within(gem).getByText("Favorite - cannot sell")).toBeInTheDocument();
  fireEvent.click(gem);
  expect(player.gemstones).toEqual([ruby, sapphire]);
  expect(player.astra).toBe(1000);
});
