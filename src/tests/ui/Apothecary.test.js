import { fireEvent, render, screen, within } from "@testing-library/react";
import { getPlayer, setPlayer } from "../../character/player";
import { SCREENS } from "../../ui/screens";
import { scenes } from "../../world/gameLogic";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../ui/changelogFiles", () => ({ changelogFiles: [] }));
jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(), setPlayer: jest.fn(),
  getInventoryItemKey: (item) => item?.id,
}));

let player;
beforeEach(() => {
  jest.clearAllMocks();
  player = { astra: 7000, consumables: { healthPotion: 2 } };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
});

const renderShop = () => {
  const Shop = SCREENS.apothecary.component;
  const onChange = jest.fn(() => result.rerender(<Shop player={player} onChange={onChange} />));
  const result = render(<Shop player={player} onChange={onChange} />);
  return onChange;
};
const openPotion = (name = "Health Potion") => {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name} `) }));
  return screen.getByRole("dialog", { name: `${name} details` });
};

test("Apothecary routes to potion cards and leaves only navigation in the controls", () => {
  expect(scenes.apothecary.screen).toBe("apothecary");
  expect(scenes.apothecary.options.map((option) => option.label)).toEqual(["Leave"]);
  renderShop();
  expect(screen.getByRole("button", { name: /^Stamina Potion / })).toBeTruthy();
  expect(screen.getByRole("button", { name: /^Cleansing Potion / })).toBeTruthy();
  const popup = openPotion();
  expect(within(popup).getByText("Restores 50% health.")).toBeTruthy();
  expect(within(popup).getByLabelText("Quantity").value).toBe("1");
  expect(within(popup).getByText("Total: 70 astra")).toBeTruthy();
  expect(setPlayer).not.toHaveBeenCalled();
});

test("buying any affordable quantity updates astra and owned count without closing the popup", () => {
  const onChange = renderShop();
  const popup = openPotion();
  fireEvent.change(within(popup).getByLabelText("Quantity"), { target: { value: "100" } });
  expect(within(popup).getByText("Total: 7000 astra")).toBeTruthy();
  fireEvent.click(within(popup).getByRole("button", { name: "Buy" }));
  expect(player).toEqual({ astra: 0, consumables: { healthPotion: 102 } });
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(within(popup).getByText(/102 available/)).toBeTruthy();
  expect(within(popup).getByRole("status").textContent).toContain("100 x Health Potion");
  fireEvent.click(within(popup).getByRole("button", { name: "Buy" }));
  expect(setPlayer).toHaveBeenCalledTimes(1);
  expect(within(popup).getByRole("status").textContent).toContain("enough astra");
});

test.each(["", "0", "-1", "1.5", "101", "9007199254740991"])("quantity %s is rejected with feedback and no purchase", (value) => {
  renderShop();
  const popup = openPotion();
  fireEvent.change(within(popup).getByLabelText("Quantity"), { target: { value } });
  fireEvent.click(within(popup).getByRole("button", { name: "Buy" }));
  expect(within(popup).getByRole("status").textContent).toBeTruthy();
  expect(setPlayer).not.toHaveBeenCalled();
});

test.each(["Escape", "backdrop", "Close"])("%s closes the popup without buying, and the next selection defaults to one", (method) => {
  renderShop();
  const popup = openPotion();
  fireEvent.change(within(popup).getByLabelText("Quantity"), { target: { value: "7" } });
  if (method === "Escape") fireEvent.keyDown(window, { key: "Escape" });
  else if (method === "backdrop") fireEvent.mouseDown(popup.parentElement);
  else fireEvent.click(within(popup).getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(setPlayer).not.toHaveBeenCalled();
  expect(within(openPotion("Cleansing Potion")).getByLabelText("Quantity").value).toBe("1");
});
