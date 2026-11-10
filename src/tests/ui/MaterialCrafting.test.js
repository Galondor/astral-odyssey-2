import { fireEvent, render, screen, within } from "@testing-library/react";
import { getPlayer, setPlayer } from "../../character/player";
import { CRAFTING_MATERIALS, describeEffect } from "../../items/craftingMaterials";
import { MATERIALS } from "../../items/materials";
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

const chooseMaterial = (slot, name) => {
  fireEvent.click(screen.getByRole("button", { name: slot }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: new RegExp(name) }));
  if (slot.startsWith("Reagent")) fireEvent.click(screen.getByRole("button", { name: "Select reagent" }));
};

const openBlueprints = () => {
  fireEvent.click(screen.getByRole("button", { name: "Blueprint slot" }));
  return screen.getByRole("region", { name: "Blueprints" });
};

const chooseBlueprint = (name = /^Sword/) => {
  fireEvent.click(within(openBlueprints()).getByRole("button", { name }));
};

test("a single blueprint slot opens a searchable picker and restores focus on selection or dismissal", () => {
  openCrafting();
  const slot = screen.getByRole("button", { name: "Blueprint slot" });
  expect(screen.queryByRole("region", { name: "Blueprints" })).toBeNull();
  expect(screen.queryByRole("searchbox", { name: "Search blueprints" })).toBeNull();
  slot.focus();
  openBlueprints();
  let picker = screen.getByRole("dialog", { name: "Choose blueprint" });
  fireEvent.change(within(picker).getByLabelText("Filter blueprints"), { target: { value: "usable" } });
  expect(within(picker).queryByRole("button", { name: /^Greatsword/ })).toBeNull();
  fireEvent.change(within(picker).getByRole("searchbox"), { target: { value: "no matching blueprint" } });
  expect(within(picker).getByText(/No matching blueprints/)).toBeTruthy();
  fireEvent.change(within(picker).getByRole("searchbox"), { target: { value: "sword" } });
  fireEvent.click(within(picker).getByRole("button", { name: /^Sword/ }));
  expect(slot.textContent).toContain("Sword");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(slot);
  chooseMaterial("Base material slot", "Metal Scraps");
  chooseMaterial("Reagent slot 1", "Slime Gel");
  openBlueprints();
  picker = screen.getByRole("dialog", { name: "Choose blueprint" });
  expect(within(picker).getByRole("button", { name: /^Sword/ }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(within(picker).getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("button", { name: "Base material slot" }).textContent).toContain("Metal Scraps");
  expect(screen.getByRole("button", { name: "Reagent slot 1" }).textContent).toContain("Slime Gel");
  openBlueprints();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(slot);
  expect(setPlayer).not.toHaveBeenCalled();
});

test("changing blueprints preserves compatible materials and clears incompatible bases or part reagents", () => {
  player.professions.weaponry.level = 10;
  openCrafting();
  chooseBlueprint();
  chooseMaterial("Base material slot", "Metal Scraps");
  chooseMaterial("Reagent slot 1", "Slime Gel");
  chooseBlueprint(/^Dagger/);
  expect(screen.getByRole("button", { name: "Base material slot" }).textContent).toContain("Metal Scraps");
  expect(screen.getByRole("button", { name: "Reagent slot 1" }).textContent).toContain("Slime Gel");
  chooseBlueprint(/^Bow/);
  expect(screen.getByRole("button", { name: "Base material slot" }).textContent).toContain("Choose a base material");
  chooseBlueprint(/^Crude Pickaxe Head Tool Part/);
  chooseBlueprint();
  expect(screen.getByRole("button", { name: "Reagent slot 1" }).textContent).toContain("Empty");
});

test("reagent grid filters, sorts, shows details, and selects without revealing unknown properties", () => {
  player.materials = { slime_gel: 2, primal_essence: 9, frost_diamond: 4, binding_resin: 3 };
  player.craftingBook = { materials: { slime_gel: 1 }, reactions: [] };
  openCrafting();
  chooseBlueprint();
  fireEvent.click(screen.getByRole("button", { name: "Reagent slot 1" }));
  let picker = screen.getByRole("dialog", { name: "Choose reagent 1" });
  const names = () => Array.from(picker.querySelectorAll(".crafting-picker-option strong")).map((entry) => entry.textContent);
  expect(picker.querySelector(".crafting-picker-grid")).toBeTruthy();
  fireEvent.change(within(picker).getByLabelText("Sort reagents"), { target: { value: "amount" } });
  expect(names()).toEqual(["Primal Essence", "Frost Diamond", "Binding Resin", "Slime Gel"]);
  fireEvent.change(within(picker).getByLabelText("Sort reagents"), { target: { value: "name" } });
  expect(names()).toEqual(["Binding Resin", "Frost Diamond", "Primal Essence", "Slime Gel"]);
  fireEvent.change(within(picker).getByLabelText("Filter reagent family"), { target: { value: "gem" } });
  expect(names()).toEqual(["Frost Diamond"]);
  fireEvent.click(within(picker).getByRole("button", { name: /Frost Diamond/ }));
  let details = screen.getByRole("dialog", { name: "Frost Diamond details" });
  expect(within(details).getByRole("button", { name: "Select reagent" }).disabled).toBe(true);
  expect(within(details).getByText(/undiscovered/)).toBeTruthy();
  expect(within(details).queryByText(describeEffect(CRAFTING_MATERIALS.frost_diamond.properties[0]))).toBeNull();
  fireEvent.keyDown(window, { key: "Escape" });
  picker = screen.getByRole("dialog", { name: "Choose reagent 1" });
  expect(within(picker).getByLabelText("Filter reagent family").value).toBe("gem");
  fireEvent.change(within(picker).getByLabelText("Filter reagent family"), { target: { value: "" } });
  fireEvent.change(within(picker).getByLabelText("Filter reagent tier"), { target: { value: "1" } });
  expect(names()).toContain("Slime Gel");
  expect(names()).not.toContain("Frost Diamond");
  fireEvent.change(within(picker).getByLabelText("Filter reagent tier"), { target: { value: "" } });
  fireEvent.change(within(picker).getByLabelText("Filter reagent level"), { target: { value: "usable" } });
  expect(names()).not.toContain("Frost Diamond");
  fireEvent.change(within(picker).getByRole("searchbox"), { target: { value: "slime" } });
  expect(names()).toEqual(["Slime Gel"]);
  fireEvent.click(within(picker).getByRole("button", { name: /Slime Gel/ }));
  details = screen.getByRole("dialog", { name: "Slime Gel details" });
  expect(within(details).getByText(MATERIALS.slime_gel.description)).toBeTruthy();
  expect(within(details).getByText(describeEffect(CRAFTING_MATERIALS.slime_gel.properties[0]))).toBeTruthy();
  fireEvent.click(within(details).getByRole("button", { name: "Select reagent" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("button", { name: "Reagent slot 1" }).textContent).toContain("Slime Gel (own 2)");
  expect(setPlayer).not.toHaveBeenCalled();
});

test("extracted recipes appear as usable blueprints while unknown recipes stay locked", () => {
  player.professions.jewelry = { level: 50 };
  player.craftingBook = { recipes: ["unique:maldrathPhylactery"] };
  openCrafting();
  fireEvent.click(screen.getByRole("tab", { name: "Jewelry" }));
  const blueprints = openBlueprints();
  expect(within(blueprints).getByRole("button", { name: /^Maldrath/ }).disabled).toBe(false);
  expect(within(blueprints).getByRole("button", { name: /^Zug/ }).disabled).toBe(true);
});

test("Material Transmutation displays level and resource gates, crafts, and returns to profession crafting", () => {
  player.professions.jewelry = { level: 8 };
  player.astra = 50;
  const onChange = openCrafting();
  fireEvent.click(screen.getByRole("tab", { name: "Material Transmutation" }));
  const upgrades = screen.getByRole("region", { name: "Material transmutation" });
  expect(within(upgrades).getAllByRole("spinbutton")).toHaveLength(24);
  expect(screen.getByRole("tab", { name: "Weapons & Tools" }).getAttribute("aria-selected")).toBe("false");
  expect(within(upgrades).getByRole("button", { name: "Craft Cinderite Ore" }).disabled).toBe(true);
  fireEvent.click(within(upgrades).getByRole("button", { name: "Craft Bog Iron" }));
  expect(player.astra).toBe(0);
  expect(player.materials).toMatchObject({ metal_scraps: 3, bog_iron: 6, slime_gel: 2 });
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status").textContent).toContain("Converted 3 Metal Scraps into 1 Bog Iron");
  expect(screen.getByRole("button", { name: "Craft Bog Iron" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("tab", { name: "Armor" }));
  expect(screen.getByRole("button", { name: "Blueprint slot" })).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Material transmutation" })).toBeNull();
});

test("bulk transmutation previews totals, uses Max, and refreshes resources without granting experience", () => {
  player.professions.jewelry = { level: 8, exp: 12, crafts: 2 };
  player.astra = 150;
  player.materials.metal_scraps = 12;
  const professions = JSON.stringify(player.professions);
  const onChange = openCrafting();
  fireEvent.click(screen.getByRole("tab", { name: "Material Transmutation" }));
  const card = screen.getByRole("article", { name: "Metal Scraps to Bog Iron" });
  const quantity = within(card).getByRole("spinbutton", { name: "Bog Iron quantity" });
  fireEvent.change(quantity, { target: { value: "2" } });
  expect(within(card).getByText("Total: 6 Metal Scraps + 100 astra → 2 Bog Iron")).toBeTruthy();
  expect(screen.getByRole("spinbutton", { name: "Cinderite Ore quantity" }).value).toBe("1");
  fireEvent.click(within(card).getByRole("button", { name: "Max Bog Iron" }));
  expect(quantity.value).toBe("3");
  fireEvent.click(within(card).getByRole("button", { name: "Craft Bog Iron" }));
  expect(player.astra).toBe(0);
  expect(player.materials).toMatchObject({ metal_scraps: 3, bog_iron: 8, slime_gel: 2 });
  expect(JSON.stringify(player.professions)).toBe(professions);
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status").textContent).toContain("Converted 9 Metal Scraps into 3 Bog Iron");
  expect(within(card).getByText("Owned: 3")).toBeTruthy();
  expect(within(card).getByRole("button", { name: "Craft Bog Iron" }).disabled).toBe(true);
  expect(within(card).getByRole("button", { name: "Max Bog Iron" }).disabled).toBe(true);
});

test.each(["", "0", "-1", "1.5", "3", "9007199254740991"])("transmutation quantity %s is rejected with feedback and no changes", (value) => {
  player.professions.armor = { level: 8 };
  const snapshot = JSON.stringify(player);
  openCrafting();
  fireEvent.click(screen.getByRole("tab", { name: "Material Transmutation" }));
  const card = screen.getByRole("article", { name: "Metal Scraps to Bog Iron" });
  fireEvent.change(within(card).getByRole("spinbutton"), { target: { value } });
  expect(within(card).getByRole("button", { name: "Craft Bog Iron" }).disabled).toBe(true);
  expect(card.querySelector(".transmutation-feedback").textContent).not.toBe("");
  fireEvent.click(within(card).getByRole("button", { name: "Craft Bog Iron" }));
  expect(setPlayer).not.toHaveBeenCalled();
  expect(JSON.stringify(player)).toBe(snapshot);
});

test("the preview groups all material effects and keeps reactions readable as more reagents are added", () => {
  const keys = ["cinderite_ore", "frost_diamond", "stormglass", "venom_sac", "primal_essence", "binding_resin"];
  player.professions.weaponry.level = 50;
  player.materials = Object.fromEntries(keys.map((key) => [key, 10]));
  player.craftingBook = {
    materials: Object.fromEntries(keys.map((key) => [key, CRAFTING_MATERIALS[key].properties.length])),
    reactions: ["thermal_shock", "volatile_mixture"],
  };
  openCrafting();
  chooseBlueprint();
  chooseMaterial("Base material slot", MATERIALS[keys[0]].name);
  keys.slice(1, -1).forEach((key, index) => chooseMaterial(`Reagent slot ${index + 1}`, MATERIALS[key].name));

  const reactions = screen.getByRole("region", { name: "Reactions" });
  const thermalShock = within(reactions).getByText("Thermal Shock").closest("li");
  expect(within(thermalShock).getAllByRole("listitem").map((item) => item.textContent))
    .toEqual(["All substats roll T3 or higher", "+10 craft quality"]);
  expect(within(reactions).getByText("Volatile Mixture").closest("li").classList.contains("crafting-warning")).toBe(true);
  expect(within(reactions).getAllByText(/These materials will react in an unknown way/).length).toBeGreaterThan(0);
  expect(within(reactions).queryByText("Storm Forged")).toBeNull();

  chooseMaterial("Reagent slot 5", MATERIALS.binding_resin.name);
  expect(within(reactions).queryByText("Volatile Mixture")).toBeNull();
  expect(within(reactions).getByText("Volatile Mixture is held in check.")).toBeTruthy();
  const effects = screen.getByRole("region", { name: "Known effects" });
  const cards = effects.querySelectorAll(".crafting-effect-cards > li");
  expect(cards).toHaveLength(keys.length);
  keys.forEach((key, index) => {
    expect(within(cards[index]).getByText(MATERIALS[key].name)).toBeTruthy();
    expect(within(cards[index]).getAllByRole("listitem").map((item) => item.textContent))
      .toEqual(CRAFTING_MATERIALS[key].properties.map(describeEffect));
  });
});

test("locked effects show their requirement separately without revealing undiscovered properties", () => {
  player.materials.living_thatch = 1;
  player.craftingBook = { materials: { living_thatch: 2 }, reactions: [] };
  openCrafting();
  chooseBlueprint();
  chooseMaterial("Base material slot", "Metal Scraps");
  chooseMaterial("Reagent slot 1", "Living Thatch");
  const effects = screen.getByRole("region", { name: "Known effects" });
  const locked = within(effects).getByText("Needs Infusion").closest("li");
  expect(locked.classList.contains("crafting-inactive")).toBe(true);
  expect(locked.firstElementChild.textContent).toBe(describeEffect(CRAFTING_MATERIALS.living_thatch.properties[1]));
  expect(within(effects).getByText("??? (2 undiscovered)")).toBeTruthy();
  CRAFTING_MATERIALS.metal_scraps.properties.forEach((effect) => {
    expect(within(effects).queryByText(describeEffect(effect))).toBeNull();
  });
});

test("Material Crafting is available in the Forge and crafts with chosen materials", () => {
  const onChange = openCrafting();
  expect(within(screen.getByRole("tablist", { name: "Forge" })).getAllByRole("tab").map((tab) => tab.textContent))
    .toEqual(["Material Crafting", "Relic Crafting", "Upgrading"]);
  expect(screen.getByRole("tab", { name: "Material Crafting" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tab", { name: "Weapons & Tools" }).getAttribute("aria-selected")).toBe("true");
  const blueprints = openBlueprints();
  expect(within(blueprints).getByRole("button", { name: /^Greatsword/ }).disabled).toBe(true);
  expect(within(blueprints).getByText("Unlocks at level 14")).toBeTruthy();

  fireEvent.click(within(blueprints).getByRole("button", { name: /^Sword/ }));
  expect(screen.getByText("Next reagent slot: level 5 · 4 locked")).toBeTruthy();
  expect(screen.queryByText("Reagent 2")).toBeNull();
  expect(screen.getByRole("button", { name: "Craft" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Base material slot" }));
  const basePicker = screen.getByRole("dialog", { name: "Choose base material" });
  expect(within(basePicker).queryByText("Leather")).toBeNull();
  expect(within(basePicker).getByRole("button", { name: /Bog Iron/ }).disabled).toBe(true);
  fireEvent.click(within(basePicker).getByRole("button", { name: /Metal Scraps/ }));
  fireEvent.click(screen.getByRole("button", { name: "Reagent slot 1" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Choose reagent 1" })).getByRole("button", { name: /Slime Gel/ }));
  fireEvent.click(screen.getByRole("button", { name: "Select reagent" }));

  const preview = screen.getByRole("region", { name: "Craft preview" });
  expect(within(preview).getByText("Intrinsic (Sword): +3% Increased attack")).toBeTruthy();
  expect(within(preview).getByText("10 - 15")).toBeTruthy();
  expect(within(preview).getAllByText(/\?\?\? \(2 undiscovered\)/)).toHaveLength(2);
  const rarityDetails = within(preview).getByText("Rarity chances").closest("details");
  expect(rarityDetails.open).toBe(false);
  fireEvent.click(within(preview).getByText("Rarity chances"));
  expect(rarityDetails.open).toBe(true);
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

  fireEvent.click(within(book).getByRole("tab", { name: "Blueprints" }));
  fireEvent.change(within(book).getByRole("searchbox", { name: "Search crafting book" }), { target: { value: "signet sovereign" } });
  const recipes = within(book).getByRole("region", { name: "Blueprints entries" });
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
  expect(within(openBlueprints()).getByRole("button", { name: /Precision Tools/ }).disabled).toBe(true);
});

test("Weaponry crafts gathering heads as materials rather than gear", () => {
  player.professions.weaponry.level = 5;
  openCrafting();
  const blueprints = openBlueprints();
  expect(within(blueprints).getByRole("button", { name: /^Pickaxe Crafting/ }).disabled).toBe(false);
  fireEvent.click(within(blueprints).getByRole("button", { name: /^Crude Pickaxe Head Tool Part/ }));
  expect(screen.queryByRole("button", { name: "Reagent slot 1" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Base material slot" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Choose base material" })).getByRole("button", { name: /Metal Scraps/ }));
  expect(screen.getByRole("region", { name: "Craft preview" }).textContent).toContain("1 Crude Pickaxe Head");
  fireEvent.click(screen.getByRole("button", { name: "Craft" }));
  expect(player.inventory).toEqual([]);
  expect(player.materials.pickaxehead_i).toBe(1);
  expect(player.materials.metal_scraps).toBe(3);
  expect(screen.getByRole("dialog", { name: "Crafted tool part" }).textContent).toContain("Crude Pickaxe Head");
});

test.each([
  ["Pickaxe", "pickaxehead_i", "mining"],
  ["Logging Axe", "axehead_i", "logging"],
])("%s preview shows the equip-profession roll range", (name, head, profession) => {
  player.professions.weaponry.level = 15;
  player.gathering = { [profession]: { level: 5 } };
  player.materials = { metal_scraps: 6, [head]: 1, haft_i: 1 };
  openCrafting();
  chooseBlueprint(new RegExp(`^${name} Crafting`));
  chooseMaterial("Base material slot", MATERIALS.metal_scraps.name);
  chooseMaterial("Reagent slot 1", MATERIALS[head].name);
  chooseMaterial("Reagent slot 2", MATERIALS.haft_i.name);
  expect(within(screen.getByRole("region", { name: "Craft preview" })).getByText("1 - 5")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Craft" }).disabled).toBe(false);
});

test("crafting dialogs shrink their scroll area without squeezing material cards or controls", () => {
  player.materials = { ...player.materials, wolf_pelt: 2, primal_essence: 2 };
  player.craftingBook = { materials: { slime_gel: 2, wolf_pelt: 2, primal_essence: 3 }, reactions: [] };
  const fs = require("fs");
  const path = require("path");
  const style = document.createElement("style");
  style.textContent = fs.readFileSync(path.join(process.cwd(), "src", "App.css"), "utf8");
  openCrafting();
  const bookButton = screen.getByRole("button", { name: "Crafting Book" });
  document.head.append(style);
  try {
    fireEvent.click(bookButton);
    const book = document.querySelector('[aria-label="Crafting Book"][role="dialog"]');
    const tabs = book.querySelector('[aria-label="Crafting book sections"]');
    expect(getComputedStyle(tabs).flexShrink).toBe("0");
    expect(getComputedStyle(book.querySelector('input[type="search"]')).flexShrink).toBe("0");
    const entries = book.querySelector('[aria-label="Materials entries"]');
    expect(getComputedStyle(entries).flexShrink).toBe("1");
    expect(getComputedStyle(entries).minHeight).toBe("0");
    expect(getComputedStyle(entries).overflowY).toBe("auto");
    const bookEntry = entries.querySelector(".crafting-book-entry");
    expect(getComputedStyle(bookEntry).flexShrink).toBe("0");
    expect(getComputedStyle(bookEntry).overflowWrap).toBe("anywhere");
    fireEvent.click(book.querySelector('[aria-label="Close Crafting Book"]'));

    openBlueprints();
    const blueprintGrid = document.querySelector('[aria-label="Available blueprints"]');
    expect(blueprintGrid.tabIndex).toBe(0);
    expect(getComputedStyle(blueprintGrid).display).toBe("grid");
    expect(getComputedStyle(blueprintGrid).overflowY).toBe("auto");
    expect(getComputedStyle(document.querySelector('[aria-label="Crafting bench"]')).display).toBe("grid");
    fireEvent.click(within(blueprintGrid).getByRole("button", { name: /^Sword/ }));
    fireEvent.click(document.querySelector('[aria-label="Base material slot"]'));
    const picker = document.querySelector('[aria-label="Choose base material"][role="dialog"]');
    expect(getComputedStyle(picker.querySelector('input[type="search"]')).flexShrink).toBe("0");
    expect(getComputedStyle(picker.querySelector(".item-popup-actions")).flexShrink).toBe("0");
    const options = picker.querySelector(".crafting-picker-list");
    expect(getComputedStyle(options).flexShrink).toBe("1");
    expect(getComputedStyle(options).minHeight).toBe("0");
    expect(getComputedStyle(picker).boxSizing).toBe("border-box");
    fireEvent.click(within(picker).getByText("Metal Scraps").closest("button"));
    const preview = document.querySelector('[aria-label="Craft preview"]');
    expect(getComputedStyle(preview).overflowWrap).toBe("anywhere");
    expect(getComputedStyle(preview.querySelector(".crafting-effect-card > strong")).textAlign).toBe("left");
    expect(getComputedStyle(preview.querySelector(".crafting-effect-list > li")).textAlign).toBe("left");
    expect(getComputedStyle(preview.querySelector(".crafting-stats dd")).textAlign).toBe("right");
    expect(getComputedStyle(preview.querySelector(".crafting-odds-row > :last-child")).textAlign).toBe("right");
    fireEvent.click(document.querySelector('[aria-label="Reagent slot 1"]'));
    const reagents = document.querySelector('[aria-label="Choose reagent 1"][role="dialog"]');
    expect(getComputedStyle(reagents.querySelector(".crafting-picker-list")).display).toBe("grid");
    const reagentOptions = reagents.querySelectorAll(".crafting-picker-option");
    expect(reagentOptions.length).toBeGreaterThan(1);
    reagentOptions.forEach((card) => {
      expect(getComputedStyle(card).flexShrink).toBe("0");
      expect(getComputedStyle(card).overflowWrap).toBe("anywhere");
      Array.from(card.children).forEach((text) => {
        expect(getComputedStyle(text).maxWidth).toBe("100%");
        expect(getComputedStyle(text).textAlign).toBe("left");
      });
    });
  } finally {
    style.remove();
  }
});

test("all crafting profession subtabs remain available when switching disciplines", () => {
  openCrafting();
  const tabs = screen.getByRole("tablist", { name: "Crafting professions" });
  for (const name of ["Armor", "Jewelry", "Weapons & Tools"]) {
    fireEvent.click(within(tabs).getByRole("tab", { name }));
    expect(within(tabs).getByRole("tab", { name }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText(`${name} level 1`)).toBeTruthy();
    for (const label of ["Weapons & Tools", "Armor", "Jewelry"]) {
      expect(within(tabs).getByRole("tab", { name: label })).toBeTruthy();
    }
  }
});
