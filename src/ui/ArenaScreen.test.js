import { fireEvent, render, screen, within } from "@testing-library/react";
import ArenaScreen from "./ArenaScreen";

test("Arena defaults to PvP and shows a coming-soon panel for every tab", () => {
  render(<ArenaScreen />);

  expect(screen.getByRole("heading", { name: "Arena" })).toBeTruthy();
  expect(within(screen.getByRole("tablist", { name: "Arena" })).getAllByRole("tab").map((tab) => tab.textContent))
    .toEqual(["PvP", "PvE", "Boss Rush"]);
  expect(screen.getByRole("tab", { name: "PvP" }).getAttribute("aria-selected")).toBe("true");

  for (const name of ["PvE", "Boss Rush", "PvP"]) {
    const tab = screen.getByRole("tab", { name });
    fireEvent.click(tab);
    expect(tab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getAllByRole("tab").filter((item) => item.getAttribute("aria-selected") === "true")).toHaveLength(1);
    const panel = screen.getByRole("tabpanel", { name });
    expect(tab.getAttribute("aria-controls")).toBe(panel.id);
    expect(within(panel).getByText("Coming soon")).toBeTruthy();
  }
});
