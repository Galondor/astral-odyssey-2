import { fireEvent, render, screen } from "@testing-library/react";
import { SCREENS } from "./screens";
import { getBoard, getRun, startDungeon } from "../world/dungeons";

jest.mock("../firebase", () => ({ db: {} }));
jest.mock("./ChangelogScreen", () => () => null);
jest.mock("./LeaderboardScreen", () => () => null);
jest.mock("./InboxScreen", () => () => null);
jest.mock("./MarketplaceScreen", () => () => null);
jest.mock("./AdminScreen", () => () => null);
jest.mock("./BugReportScreen", () => () => null);
jest.mock("../world/dungeons", () => ({
  ...jest.requireActual("../world/dungeons"),
  getBoard: jest.fn(),
  getRun: jest.fn(),
  startDungeon: jest.fn(),
}));

const DungeonsScreen = SCREENS.dungeons.component;
const offer = {
  id: "crypt-offer", type: "crypt", name: "Sunken Crypt", level: 20,
  boss: "dgCryptLich", elite: "dgCryptKnight",
  steps: [{ kind: "puzzle", puzzle: 0 }], cleared: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  getBoard.mockReturnValue({ offers: [offer] });
  getRun.mockReturnValue(null);
  startDungeon.mockReturnValue({ ok: true });
});

test("available dungeons are playable and navigate into the run", () => {
  const goToScene = jest.fn();
  render(<DungeonsScreen player={{ level: 20 }} goToScene={goToScene} />);
  expect(screen.queryByText(/under construction/i)).toBeNull();
  const button = screen.getByRole("button", { name: "Enter Dungeon" });
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  expect(startDungeon).toHaveBeenCalledWith(offer.id);
  expect(goToScene).toHaveBeenCalledWith("dungeon");
});

test.each(["cleared", "active", "combat", "level"])("entry remains disabled for %s restrictions", (restriction) => {
  if (restriction === "cleared") getBoard.mockReturnValue({ offers: [{ ...offer, cleared: true }] });
  if (restriction === "active") getRun.mockReturnValue({ name: "Sunken Crypt", deadline: Date.now() + 60000 });
  render(<DungeonsScreen player={{ level: restriction === "level" ? 9 : 20 }} goToScene={jest.fn()} inCombat={restriction === "combat"} />);
  const button = screen.getByRole("button", { name: restriction === "cleared" ? "Cleared" : "Enter Dungeon" });
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(startDungeon).not.toHaveBeenCalled();
});

test("failed entry displays the reason without navigating", () => {
  startDungeon.mockReturnValue({ ok: false, message: "That dungeon has collapsed. Check the board again." });
  const goToScene = jest.fn();
  render(<DungeonsScreen player={{ level: 20 }} goToScene={goToScene} />);
  fireEvent.click(screen.getByRole("button", { name: "Enter Dungeon" }));
  expect(screen.getByRole("alert").textContent).toContain("That dungeon has collapsed.");
  expect(goToScene).not.toHaveBeenCalled();
});
