import { fireEvent, render, screen } from "@testing-library/react";
import { getPlayer, setPlayer } from "../../character/player";
import { SCREENS } from "../../ui/screens";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../character/player", () => ({
  ...jest.requireActual("../../character/player"),
  getPlayer: jest.fn(),
  setPlayer: jest.fn(),
}));
jest.mock("../../ui/ChangelogScreen", () => () => null);
jest.mock("../../ui/LeaderboardScreen", () => () => null);
jest.mock("../../ui/InboxScreen", () => () => null);
jest.mock("../../ui/MarketplaceScreen", () => () => null);
jest.mock("../../ui/AdminScreen", () => () => null);
jest.mock("../../ui/BugReportScreen", () => () => null);

test("Forge accepts a free custom name and charges for a fixed condition", () => {
  getPlayer.mockReturnValue({
    level: 30,
    materials: { relicFragments: 50 },
    consumables: { relic: 1 },
    inventory: [],
  });
  const onChange = jest.fn();
  const ForgeScreen = SCREENS.forge.component;
  render(<ForgeScreen onChange={onChange} />);
  const rarityOptions = Array.from(screen.getByLabelText("Rarity").options).map((option) => option.value);
  expect(rarityOptions).not.toContain("Unique");
  expect(rarityOptions).not.toContain("Mythic");
  expect(rarityOptions).toEqual(["Common", "Uncommon", "Rare", "Epic", "Legendary"]);

  fireEvent.change(screen.getByPlaceholderText("Random name"), {
    target: { value: "The Chosen Path" },
  });
  fireEvent.change(screen.getByLabelText("Rarity"), {
    target: { value: "Common" },
  });
  fireEvent.change(screen.getByLabelText("Condition"), {
    target: { value: "Perfect" },
  });
  expect(screen.getByText("10 / 50 fragments")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Forge Custom Item" }));

  expect(setPlayer).toHaveBeenCalledWith(expect.objectContaining({
    materials: { relicFragments: 40 },
    consumables: { relic: 0 },
    inventory: [expect.objectContaining({
      name: "The Chosen Path",
      condition: "Perfect",
      rarity: "Common",
    })],
  }));
  expect(onChange).toHaveBeenCalled();
});
