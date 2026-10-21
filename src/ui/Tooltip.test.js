import { act, fireEvent, render, screen } from "@testing-library/react";
import Tooltip from "./Tooltip";

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
