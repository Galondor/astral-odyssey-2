import { act, fireEvent, render, screen } from "@testing-library/react";
import Tooltip, { TooltipContent } from "../../ui/Tooltip";
import { itemTooltip } from "../../items/items";
import { getHolofoilStyle, MYTHIC_HOLOFOIL_EFFECTS, MYTHIC_HOLOFOIL_PALETTES } from "../../items/holofoil";

jest.mock("../../character/player", () => ({ getPlayer: () => ({ level: 1 }) }));

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

test.each(MYTHIC_HOLOFOIL_EFFECTS)("Mythic tooltip renders the %s finish and reduced-motion image", effect => {
  jest.useFakeTimers();
  const item = {
    name: "Mythic blade", rarity: "Mythic", slot: "weapon", iLevel: 50, price: 1000,
    holofoil: MYTHIC_HOLOFOIL_PALETTES[effect][1], holofoilEffect: effect,
  };
  render(<Tooltip content={itemTooltip(item)} delay={0}><button>Inspect Mythic</button></Tooltip>);
  fireEvent.focus(screen.getByRole("button", { name: "Inspect Mythic" }));
  act(() => jest.runOnlyPendingTimers());
  const tooltip = screen.getByRole("tooltip");
  expect(tooltip.style.getPropertyValue("--holofoil-mythic-still")).toBe(getHolofoilStyle(item)["--holofoil-mythic-still"]);
  expect(tooltip.textContent).toContain("Holofoil Mythic");
});

test("equipment tooltip separates the main stat from its first substat", () => {
  jest.useFakeTimers();
  const item = {
    name: "Test blade",
    rarity: "Rare",
    slot: "weapon",
    iLevel: 1,
    price: 10,
    mainStat: { stat: "strength", value: 5 },
    subStats: { speed: 2, defense: 3 },
  };
  render(
    <Tooltip content={itemTooltip(item)} delay={0}>
      <button type='button'>Inspect blade</button>
    </Tooltip>,
  );
  fireEvent.focus(screen.getByRole("button", { name: "Inspect blade" }));
  act(() => jest.runOnlyPendingTimers());

  const tooltip = screen.getByRole("tooltip");
  expect(tooltip.querySelectorAll(".tooltip-stat-divider")).toHaveLength(1);
  expect(tooltip.querySelector(".tooltip-stat-divider").textContent).toContain("Speed");
});

test.each([undefined, 4])("item upgrade count %s appears immediately below the subtitle", (upgrades) => {
  const details = itemTooltip({
    name: "Test blade", rarity: "Rare", slot: "weapon", iLevel: 50, price: 10, upgrades,
  });
  render(<TooltipContent data={details} />);
  expect(screen.getByText(`Upgrades: ${upgrades ?? 0}`).previousElementSibling.textContent).toBe(details.subtitle);
});

test("non-equipment tooltip content does not show an upgrade count", () => {
  render(<TooltipContent data={{ title: "Ruby", subtitle: "Rare Gemstone" }} />);
  expect(screen.queryByText(/Upgrades:/)).toBeNull();
});

test("item tooltips stay closed on mobile without blocking the item's click handler", () => {
  jest.useFakeTimers();
  window.matchMedia.mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  const click = jest.fn();
  const view = jest.fn();
  render(<Tooltip disableOnMobile openOnClick onView={view} content={{ title: "Iron Sword" }}>
    <button onClick={click}>Item</button>
  </Tooltip>);
  const item = screen.getByRole("button", { name: "Item" });
  fireEvent.mouseEnter(item);
  fireEvent.focus(item);
  fireEvent.click(item);
  act(() => jest.runOnlyPendingTimers());
  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(click).toHaveBeenCalledTimes(1);
  expect(view).not.toHaveBeenCalled();
});

test("disabling mobile item tooltips preserves desktop tooltips and closes them on resize", () => {
  jest.useFakeTimers();
  let resize;
  window.matchMedia.mockReturnValue({
    matches: false,
    addEventListener: (_, listener) => { resize = listener; },
    removeEventListener: jest.fn(),
  });
  render(<Tooltip disableOnMobile content="Iron Sword"><button>Item</button></Tooltip>);
  fireEvent.focus(screen.getByRole("button", { name: "Item" }));
  act(() => jest.advanceTimersByTime(150));
  expect(screen.getByRole("tooltip").textContent).toBe("Iron Sword");
  act(() => resize({ matches: true }));
  expect(screen.queryByRole("tooltip")).toBeNull();
  fireEvent.focus(screen.getByRole("button", { name: "Item" }));
  act(() => jest.advanceTimersByTime(150));
  expect(screen.queryByRole("tooltip")).toBeNull();
});

test("non-item tooltips remain available on mobile", () => {
  jest.useFakeTimers();
  window.matchMedia.mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  render(<Tooltip content="Defend"><button>Action</button></Tooltip>);
  fireEvent.focus(screen.getByRole("button", { name: "Action" }));
  act(() => jest.advanceTimersByTime(150));
  expect(screen.getByRole("tooltip").textContent).toBe("Defend");
});

test("resizing to mobile cancels pending item tooltip timers", () => {
  jest.useFakeTimers();
  let resize;
  window.matchMedia.mockReturnValue({
    matches: false,
    addEventListener: (_, listener) => { resize = listener; },
    removeEventListener: jest.fn(),
  });
  const content = jest.fn(() => "Iron Sword");
  render(<Tooltip disableOnMobile content={content}><button>Item</button></Tooltip>);
  fireEvent.mouseEnter(screen.getByRole("button", { name: "Item" }));
  act(() => resize({ matches: true }));
  act(() => jest.advanceTimersByTime(200));
  expect(content).not.toHaveBeenCalled();
  expect(screen.queryByRole("tooltip")).toBeNull();
});
