import { act, fireEvent, render, screen } from "@testing-library/react";
import Tooltip from "./Tooltip";
import { itemTooltip } from "../items/items";
import { getHolofoilStyle } from "../items/holofoil";

jest.mock("../character/player", () => ({ getPlayer: () => ({ level: 1 }) }));

afterEach(() => {
  jest.useRealTimers();
});

test("opens on click when enabled for touch interaction", () => {
  jest.useFakeTimers();
  render(
    <Tooltip content={{ title: "Unavailable gear" }} openOnClick>
      <button type='button'>Inspect gear</button>
    </Tooltip>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Inspect gear" }));
  act(() => jest.advanceTimersByTime(150));

  expect(screen.getByRole("tooltip").textContent).toContain("Unavailable gear");
});

test("equipment tooltip renders its saved holofoil gradient and label", () => {
  jest.useFakeTimers();
  const item = { name: "Foil helmet", rarity: "Rare", slot: "helmet", iLevel: 1, price: 10, holofoil: ["#ff0000", "#0000ff"] };
  render(
    <Tooltip content={itemTooltip(item)} delay={0}>
      <button type='button'>Inspect holofoil</button>
    </Tooltip>,
  );
  fireEvent.focus(screen.getByRole("button", { name: "Inspect holofoil" }));
  act(() => jest.runOnlyPendingTimers());
  expect(screen.getByRole("tooltip").style.getPropertyValue("--holofoil-background")).toBe(getHolofoilStyle(item)["--holofoil-background"]);
  expect(screen.getByRole("tooltip").textContent).toContain("Holofoil Rare");
});
