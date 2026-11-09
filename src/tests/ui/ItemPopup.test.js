import { fireEvent, render, screen, within } from "@testing-library/react";
import { getPlayer, setPlayer } from "../../character/player";
import { getEnemy } from "../../combat/combat";
import { createUniqueItem } from "../../items/items";
import { UNIQUES } from "../../world/dungeonData";
import ItemPopup from "../../ui/ItemPopup";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../character/player", () => ({
  ...jest.requireActual("../../character/player"),
  getPlayer: jest.fn(), setPlayer: jest.fn(),
}));
jest.mock("../../combat/combat", () => ({ getEnemy: jest.fn(() => null) }));

let item;
let player;
beforeEach(() => {
  jest.clearAllMocks();
  getEnemy.mockReturnValue(null);
  item = createUniqueItem(UNIQUES.maldrathPhylactery, 20);
  player = { inventory: [item], equipment: {}, materials: {} };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
});

test("Extract requires confirmation, supports cancelling, and learns the recipe once", () => {
  const onExtracted = jest.fn();
  const { rerender } = render(<ItemPopup item={item} allowDismantle onClose={() => {}} onExtracted={onExtracted} />);
  fireEvent.click(screen.getByRole("button", { name: "Extract" }));
  expect(screen.getByRole("alert").textContent).toContain("permanently destroy");
  expect(screen.queryByRole("button", { name: "Dismantle" })).toBeNull();
  expect(setPlayer).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Extract" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm extract" }));
  expect(onExtracted).toHaveBeenCalledTimes(1);
  expect(player.inventory).toEqual([]);
  expect(player.craftingBook.recipes).toEqual(["unique:maldrathPhylactery"]);
  expect(screen.getByRole("status").textContent).toContain("now available in the Forge");
  expect(screen.queryByRole("button", { name: "Extract" })).toBeNull();
  expect(setPlayer).toHaveBeenCalledTimes(1);
  rerender(<ItemPopup key='another' item={{ ...item, id: "another" }} allowDismantle onClose={() => {}} />);
  expect(screen.getByRole("button", { name: "Blueprint learned" }).disabled).toBe(true);
});

test.each(["favorite", "combat"])("Extract is disabled for %s items", (reason) => {
  if (reason === "favorite") player.favoriteInventoryItems = { gear: [item.id] };
  else getEnemy.mockReturnValue({});
  render(<ItemPopup item={item} allowDismantle onClose={() => {}} />);
  expect(screen.getByRole("button", { name: "Extract" }).disabled).toBe(true);
  expect(setPlayer).not.toHaveBeenCalled();
});

test("read-only item popups do not offer extraction", () => {
  render(<ItemPopup item={item} onClose={() => {}} />);
  expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "Extract" })).toBeNull();
});

test("a stale extraction confirmation shows an error without destroying another item", () => {
  render(<ItemPopup item={item} allowDismantle onClose={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Extract" }));
  player.inventory = [];
  fireEvent.click(screen.getByRole("button", { name: "Confirm extract" }));
  expect(screen.getByRole("status").textContent).toContain("no longer owned");
  expect(setPlayer).not.toHaveBeenCalled();
});
