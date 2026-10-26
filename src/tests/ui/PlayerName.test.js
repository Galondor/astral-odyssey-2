import { act, fireEvent, render, screen } from "@testing-library/react";
import PlayerName from "../../ui/PlayerName";

afterEach(() => {
  jest.useRealTimers();
});

test("shows the active title beside the player name in its rarity color", () => {
  render(<PlayerName name="Nova" activeTitle="monarchOfTheOdyssey" />);
  const title = screen.getByText(/Monarch of the Odyssey/);
  expect(title.style.color).toBe("rgb(255, 42, 42)");
  expect(title.previousElementSibling.textContent).toBe("Nova");
});

test("does not render unknown titles", () => {
  render(<PlayerName name="Nova" activeTitle="unknown" />);
  expect(screen.queryByText(/Monarch of the Odyssey/)).toBeNull();
});

test("shows the title rarity and acquisition criteria in a tooltip", () => {
  jest.useFakeTimers();
  render(<PlayerName name="Nova" activeTitle="monarchOfTheOdyssey" />);

  fireEvent.mouseEnter(screen.getByText("Monarch of the Odyssey"));
  act(() => jest.advanceTimersByTime(150));

  const tooltip = screen.getByRole("tooltip");
  expect(tooltip.textContent).toContain("Unique title");
  expect(tooltip.textContent).toContain("How to acquire: Reach level 100 before version 0.3.0.0.");
});
