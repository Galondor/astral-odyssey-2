import { act, fireEvent, render, screen } from "@testing-library/react";
import RichText from "./RichText";

jest.mock("../character/player", () => ({ getPlayer: jest.fn() }));

afterEach(() => {
  jest.useRealTimers();
});

test("shows a consumable tooltip for a consumable link", () => {
  jest.useFakeTimers();
  render(<RichText text='The enemy dropped an {{Item Certificate|consumable:itemCertificate}}!' />);

  fireEvent.mouseEnter(screen.getByText("Item Certificate"));
  act(() => jest.advanceTimersByTime(150));

  expect(screen.getByRole("tooltip").textContent).toContain("Item Certificate");
  expect(screen.getByRole("tooltip").textContent).toContain("Allows you to rename an owned item.");
});
