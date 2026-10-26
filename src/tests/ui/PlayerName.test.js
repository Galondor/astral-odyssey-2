import { render, screen } from "@testing-library/react";
import PlayerName from "../../ui/PlayerName";

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
