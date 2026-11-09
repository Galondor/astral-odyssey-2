import { fireEvent, render, screen, within } from "@testing-library/react";
import { getPlayer, markInventoryItemViewed, savePlayerName, setPlayer } from "../../character/player";
import { recalculateStats } from "../../character/stats";
import { getEnemy } from "../../combat/combat";
import { createSkillGemstone, deleteOwnedItem } from "../../items/items";
import { SCREENS } from "../../ui/screens";
import { cancelClassSwitch } from "../../character/classSwitch";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(), setPlayer: jest.fn(), markInventoryItemViewed: jest.fn(),
  savePlayerName: jest.fn(),
  getInventoryItemKey: (item) => item?.id || JSON.stringify(item),
}));
jest.mock("../../combat/combat", () => ({
  getEnemy: jest.fn(),
}));
jest.mock("../../ui/changelogFiles", () => ({ changelogFiles: [] }));

const sword = {
  id: "sword", name: "Iron Sword", slot: "weapon", rarity: "Rare", iLevel: 5,
  mainStat: { stat: "strength", value: 12 },
};
let player;
beforeEach(() => {
  jest.clearAllMocks();
  cancelClassSwitch();
  getEnemy.mockReturnValue(null);
  player = {
    name: "Nova", level: 20, baseStats: { strength: 5, dexterity: 5, intelligence: 5 },
    consumables: { healthPotion: 2 }, inventory: [sword], equipment: {}, astra: 100,
  };
  player = { ...player, ...recalculateStats(player) };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
});

afterEach(() => jest.restoreAllMocks());

const renderCharacter = (props = {}) => {
  const Character = SCREENS.character.component;
  render(<Character player={player} {...props} />);
};
const openPotion = () => {
  fireEvent.click(screen.getByRole("tab", { name: /Consumables/ }));
  fireEvent.click(screen.getByRole("button", { name: /Health Potion x/ }));
  return screen.getByRole("dialog", { name: "Health Potion details" });
};

test("Skill Gems appear and filter in inventory without undefined stats or sorting errors", () => {
  const gem = createSkillGemstone("meteor");
  player.gemstones = [
    { id: "ruby", name: "Ruby", type: "ruby", stat: "strength", value: 3, rarity: "Rare" },
    gem,
  ];
  renderCharacter();
  fireEvent.click(screen.getByRole("tab", { name: /Gemstones/ }));
  expect(screen.getByText("Meteor Gemstone")).toBeTruthy();
  expect(screen.getByText("Meteor skill level +1")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Sort gemstones"), { target: { value: "statAsc" } });
  fireEvent.change(screen.getByLabelText("Filter gemstones by stat"), { target: { value: "skill" } });
  expect(screen.queryByText("Ruby")).toBeNull();
  expect(screen.getByText("Meteor Gemstone")).toBeTruthy();
});

test("cards open details without consuming; Use heals and updates the popup count", () => {
  player.stats.health = 1;
  renderCharacter();
  const popup = openPotion();
  expect(within(popup).getByText("Restores 50% health.")).toBeTruthy();
  expect(within(popup).getByText(/2 available/)).toBeTruthy();
  expect(markInventoryItemViewed).toHaveBeenCalledWith("consumables", "healthPotion");
  expect(player.consumables.healthPotion).toBe(2);
  expect(player.stats.health).toBe(1);
  fireEvent.click(within(popup).getByRole("button", { name: "Use" }));
  expect(player.stats.health).toBeGreaterThan(1);
  expect(player.consumables.healthPotion).toBe(1);
  expect(within(popup).getByText(/1 available/)).toBeTruthy();
  expect(within(popup).getByRole("status").textContent).toContain("recover");
  fireEvent.click(within(popup).getByRole("button", { name: "Use" }));
  expect(player.consumables.healthPotion).toBeUndefined();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("failed use displays the reason without consuming the potion", () => {
  renderCharacter();
  const popup = openPotion();
  fireEvent.click(within(popup).getByRole("button", { name: "Use" }));
  expect(within(popup).getByRole("status").textContent).toContain("full health");
  expect(player.consumables.healthPotion).toBe(2);
});

test("elixir details lead to the existing name form and saving refreshes the count", async () => {
  player.consumables = { elixirOfNameChanging: 2 };
  renderCharacter();
  fireEvent.click(screen.getByRole("tab", { name: /Consumables/ }));
  const openElixir = () => {
    fireEvent.click(screen.getByRole("button", { name: /Elixir of Name Changing x/ }));
    expect(screen.getByRole("dialog", { name: "Elixir of Name Changing details" })).toBeTruthy();
    expect(screen.queryByLabelText("New character name")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Use" }));
  };
  openElixir();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(player.consumables.elixirOfNameChanging).toBe(2);
  expect(savePlayerName).not.toHaveBeenCalled();
  openElixir();
  savePlayerName.mockImplementation(async (name) => {
    player = { ...player, name, consumables: { elixirOfNameChanging: 1 } };
    return { ok: true, message: "Name saved" };
  });
  fireEvent.change(screen.getByLabelText("New character name"), { target: { value: "Orion" } });
  fireEvent.click(screen.getByRole("button", { name: "Save name" }));
  await screen.findByRole("heading", { name: /Orion/ });
  expect(screen.getByRole("button", { name: "Elixir of Name Changing x1" })).toBeTruthy();
  expect(screen.queryByLabelText("New character name")).toBeNull();
});

test("alloy details lead to the target picker without spending it until applied", () => {
  player.consumables = { prismaticAlloy: 1 };
  renderCharacter();
  fireEvent.click(screen.getByRole("tab", { name: /Consumables/ }));
  fireEvent.click(screen.getByRole("button", { name: "Prismatic Alloy x1" }));
  expect(screen.getByRole("dialog", { name: "Prismatic Alloy details" })).toBeTruthy();
  expect(player.consumables.prismaticAlloy).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "Use" }));
  expect(screen.queryByRole("dialog", { name: "Prismatic Alloy details" })).toBeNull();
  const picker = screen.getByRole("dialog", { name: "Use Prismatic Alloy" });
  fireEvent.click(within(picker).getByRole("button", { name: /Iron Sword/ }));
  jest.spyOn(Math, "random").mockReturnValue(0.5);
  fireEvent.click(within(picker).getByRole("button", { name: "Apply alloy" }));
  expect(player.consumables.prismaticAlloy).toBeUndefined();
  expect(player.inventory[0].holofoil).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("deletion is cancellable and deletes just one consumable after confirmation", () => {
  renderCharacter();
  const popup = openPotion();
  fireEvent.click(within(popup).getByRole("button", { name: "Delete item" }));
  expect(within(popup).getByRole("alert").textContent).toContain("Delete one Health Potion");
  expect(player.consumables.healthPotion).toBe(2);
  fireEvent.click(within(popup).getByRole("button", { name: "Cancel" }));
  expect(within(popup).queryByRole("alert")).toBeNull();
  fireEvent.click(within(popup).getByRole("button", { name: "Delete item" }));
  fireEvent.click(within(popup).getByRole("button", { name: "Confirm delete" }));
  expect(player.consumables.healthPotion).toBe(1);
  expect(player.astra).toBe(100);
  expect(screen.queryByRole("dialog")).toBeNull();
  const nextPopup = openPotion();
  fireEvent.click(within(nextPopup).getByRole("button", { name: "Delete item" }));
  fireEvent.click(within(nextPopup).getByRole("button", { name: "Confirm delete" }));
  expect(player.consumables.healthPotion).toBeUndefined();
  expect(screen.getByText("You have no consumables.")).toBeTruthy();
});

test("favorites protect consumables until unfavorited", () => {
  renderCharacter();
  const popup = openPotion();
  fireEvent.click(within(popup).getByRole("button", { name: "Favorite" }));
  expect(player.favoriteInventoryItems.consumables).toEqual(["healthPotion"]);
  expect(within(popup).getByRole("button", { name: "Delete item" }).disabled).toBe(true);
  expect(deleteOwnedItem({ key: "healthPotion" }, { kind: "consumable" }).ok).toBe(false);
  fireEvent.click(within(popup).getByRole("button", { name: "Unfavorite" }));
  expect(within(popup).getByRole("button", { name: "Delete item" }).disabled).toBe(false);
});

test.each(["Escape", "backdrop", "Close"])("%s dismisses details without consuming", (method) => {
  renderCharacter();
  const popup = openPotion();
  if (method === "Escape") fireEvent.keyDown(window, { key: "Escape" });
  else if (method === "backdrop") fireEvent.mouseDown(popup.parentElement);
  else fireEvent.click(within(popup).getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(player.consumables.healthPotion).toBe(2);
});

test("combat allows inspection but blocks use and deletion", () => {
  renderCharacter({ inCombat: true });
  const popup = openPotion();
  expect(within(popup).getByRole("button", { name: "Use" }).disabled).toBe(true);
  expect(within(popup).getByRole("button", { name: "Delete item" }).disabled).toBe(true);
  getEnemy.mockReturnValue({});
  expect(deleteOwnedItem(sword, { kind: "inventory" }).ok).toBe(false);
  expect(deleteOwnedItem({ key: "healthPotion" }, { kind: "consumable" }).ok).toBe(false);
  expect(setPlayer).not.toHaveBeenCalled();
});

test("pack gear deletion requires confirmation and does not delete another item", () => {
  player.inventory.push({ ...sword, id: "other", name: "Other Sword" });
  renderCharacter();
  fireEvent.click(screen.getByRole("button", { name: "Iron Sword" }));
  const popup = screen.getByRole("dialog");
  fireEvent.click(within(popup).getByRole("button", { name: "Delete item" }));
  expect(within(popup).getByRole("alert").textContent).toContain("socketed gemstones");
  fireEvent.click(within(popup).getByRole("button", { name: "Confirm delete" }));
  expect(player.inventory.map((item) => item.id)).toEqual(["other"]);
  expect(player.astra).toBe(100);
  expect(deleteOwnedItem(sword, { kind: "inventory" }).ok).toBe(false);
  expect(player.inventory).toHaveLength(1);
});

test("deleting equipped two-handed gear clears both slots and recalculates stats", () => {
  player.inventory = [];
  player.equipment = {
    mainHand: { ...sword, twoHanded: true },
    offHand: { twoHandedOf: "mainHand", name: sword.name },
  };
  player = { ...player, ...recalculateStats(player) };
  const strength = player.stats.strength;
  renderCharacter();
  fireEvent.click(screen.getByRole("button", { name: "Off Hand Iron Sword" }));
  const popup = screen.getByRole("dialog");
  fireEvent.click(within(popup).getByRole("button", { name: "Delete item" }));
  fireEvent.click(within(popup).getByRole("button", { name: "Confirm delete" }));
  expect(player.equipment.mainHand).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm class change" }));
  expect(player.equipment).toEqual({});
  expect(player.stats.strength).toBe(strength - 12);
  expect(player.inventory).toEqual([]);
});

test("gear favorites and stale equipped targets cannot be deleted", () => {
  player.favoriteInventoryItems = { gear: ["sword"] };
  expect(deleteOwnedItem(sword, { kind: "inventory" }).message).toContain("Unfavorite");
  player.favoriteInventoryItems = {};
  player.equipment = { mainHand: { ...sword, id: "replacement" } };
  expect(deleteOwnedItem(sword, { kind: "equipment", slotKey: "mainHand" }).ok).toBe(false);
  expect(deleteOwnedItem({ key: "unknown" }, { kind: "consumable" }).ok).toBe(false);
  expect(setPlayer).not.toHaveBeenCalled();
});

test("mobile Character opens Inventory and keeps Equipment and Stats separately accessible", () => {
  window.matchMedia.mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  renderCharacter();
  const sections = screen.getByRole("group", { name: "Character sections" });
  expect(within(sections).getByRole("button", { name: "Inventory" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Iron Sword" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Nova" })).toBeNull();
  fireEvent.click(within(sections).getByRole("button", { name: "Stats" }));
  expect(screen.getByRole("heading", { name: "Nova" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Iron Sword" })).toBeNull();
  fireEvent.click(within(sections).getByRole("button", { name: "Equipment" }));
  expect(screen.queryByRole("heading", { name: "Nova" })).toBeNull();
  expect(screen.getByRole("button", { name: /Main Hand/ })).toBeTruthy();
  const equipmentCategories = screen.getByRole("tablist", { name: "Equipment categories" });
  fireEvent.click(within(equipmentCategories).getByRole("tab", { name: "Crafting & Gathering" }));
  expect(screen.getByRole("button", { name: /Hammer/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Precision Tools/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Main Hand/ })).toBeNull();
  fireEvent.click(within(equipmentCategories).getByRole("tab", { name: "Combat Gear" }));
  expect(screen.getByRole("button", { name: /Main Hand/ })).toBeTruthy();
  fireEvent.click(within(sections).getByRole("button", { name: "Inventory" }));
  const popup = openPotion();
  expect(within(popup).getByRole("button", { name: "Use" })).toBeTruthy();
  expect(player.consumables.healthPotion).toBe(2);
});

test("item details trap keyboard focus and restore the selected card on dismissal", () => {
  renderCharacter();
  fireEvent.click(screen.getByRole("tab", { name: /Consumables/ }));
  const card = screen.getByRole("button", { name: /Health Potion x/ });
  card.focus();
  fireEvent.click(card);
  const popup = screen.getByRole("dialog", { name: "Health Potion details" });
  const first = within(popup).getByRole("button", { name: "Close item details" });
  const last = within(popup).getByRole("button", { name: "Close" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last, { key: "Tab" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(card);
});
