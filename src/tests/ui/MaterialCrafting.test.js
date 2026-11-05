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

let player;
beforeEach(() => {
  jest.clearAllMocks();
  player = {
    level: 10,
    astra: 10000,
    inventory: [],
    equipment: {},
    consumables: {},
    materials: { metal_scraps: 6, slime_gel: 2, leather: 4, bog_iron: 5 },
    professions: { weaponry: { level: 1, exp: 0, crafts: 0 } },
  };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
});

const openCrafting = () => {
  const ForgeScreen = SCREENS.forge.component;
  const onChange = jest.fn();
  render(<ForgeScreen onChange={onChange} />);
  fireEvent.click(screen.getByRole("tab", { name: "Material Crafting" }));
  return onChange;
};

test("Material Crafting is available in the Forge and crafts with chosen materials", () => {
  const onChange = openCrafting();
  expect(screen.getByRole("tab", { name: "Material Crafting" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tab", { name: "Weaponry" }).getAttribute("aria-selected")).toBe("true");
  const blueprints = screen.getByRole("region", { name: "Blueprints" });
  expect(within(blueprints).getByRole("button", { name: /Greatsword/ }).disabled).toBe(true);
  expect(within(blueprints).getByText("Unlocks at level 14")).toBeTruthy();

  fireEvent.click(within(blueprints).getByRole("button", { name: /^Sword/ }));
  expect(screen.getByText("Reagent 2").parentElement.textContent).toContain("Unlocks at level 5");
  expect(screen.getByRole("button", { name: "Craft" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Base material slot" }));
  const basePicker = screen.getByRole("dialog", { name: "Choose base material" });
  expect(within(basePicker).queryByText("Leather")).toBeNull();
  expect(within(basePicker).getByRole("button", { name: /Bog Iron/ }).disabled).toBe(true);
  fireEvent.click(within(basePicker).getByRole("button", { name: /Metal Scraps/ }));
  fireEvent.click(screen.getByRole("button", { name: "Reagent slot 1" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Choose reagent 1" })).getByRole("button", { name: /Slime Gel/ }));

  const preview = screen.getByRole("region", { name: "Craft preview" });
  expect(within(preview).getAllByText(/\?\?\? \(2 undiscovered\)/)).toHaveLength(2);
  expect(within(preview).getByRole("region", { name: "Craft odds" }).textContent).toContain("Mythic");
  fireEvent.click(screen.getByRole("button", { name: "Craft" }));

  expect(onChange).toHaveBeenCalled();
  expect(player.inventory).toHaveLength(1);
  expect(player.inventory[0]).toMatchObject({ slot: "weapon", crafted: true });
  expect(player.materials).toMatchObject({ metal_scraps: 3, slime_gel: 1 });
  expect(player.professions.weaponry.crafts).toBe(1);
  const result = screen.getByRole("dialog", { name: `${player.inventory[0].name} details` });
  expect(within(result).getByText(/New discovery: Metal Scraps/)).toBeTruthy();
  expect(within(result).getByText(/New discovery: Slime Gel/)).toBeTruthy();
  fireEvent.click(within(result).getByRole("button", { name: "Close" }));
  expect(within(screen.getByRole("region", { name: "Craft preview" })).getAllByText(/\(1 undiscovered\)/)).toHaveLength(2);
});

test("the Crafting Book is searchable and hides undiscovered properties", () => {
  player.craftingBook = { materials: { slime_gel: 1 }, reactions: ["thermal_shock"] };
  openCrafting();
  fireEvent.click(screen.getByRole("button", { name: "Crafting Book" }));
  const book = screen.getByRole("dialog", { name: "Crafting Book" });
  fireEvent.change(within(book).getByRole("searchbox", { name: "Search crafting book" }), { target: { value: "slime" } });
  const entries = within(book).getByRole("region", { name: "Materials entries" });
  expect(entries.querySelectorAll("article")).toHaveLength(1);
  expect(entries.textContent).toContain("Guarantees a Vitality substat");
  expect(entries.textContent).toContain("???");
  fireEvent.change(within(book).getByRole("searchbox", { name: "Search crafting book" }), { target: { value: "vitality" } });
  expect(within(book).getByRole("region", { name: "Materials entries" }).textContent).toContain("Slime Gel");

  fireEvent.click(within(book).getByRole("tab", { name: "Reactions" }));
  fireEvent.change(within(book).getByRole("searchbox", { name: "Search crafting book" }), { target: { value: "" } });
  const reactions = within(book).getByRole("region", { name: "Reactions entries" });
  expect(reactions.textContent).toContain("Thermal Shock");
  expect(reactions.textContent).toContain("??? Undiscovered reaction");

  fireEvent.click(within(book).getByRole("tab", { name: "Recipes" }));
  fireEvent.change(within(book).getByRole("searchbox", { name: "Search crafting book" }), { target: { value: "signet sovereign" } });
  const recipes = within(book).getByRole("region", { name: "Recipes entries" });
  expect(recipes.textContent).toContain("Sovereign's Signet");
  expect(recipes.textContent).toContain("Unlocks at Jewelry level 50.");
  fireEvent.click(within(book).getByRole("button", { name: "Close Crafting Book" }));
  expect(screen.queryByRole("dialog", { name: "Crafting Book" })).toBeNull();
});

test("switching professions resets the bench and shows the tool requirement", () => {
  openCrafting();
  fireEvent.click(screen.getByRole("tab", { name: "Jewelry" }));
  expect(screen.getByText("No Precision Tools equipped")).toBeTruthy();
  expect(screen.getByText("Jewelry level 1")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Precision Tools/ }).disabled).toBe(true);
});
