jest.mock("../../character/player", () => ({
  ...jest.requireActual("../../character/player"),
  getPlayer: jest.fn(),
  setPlayer: jest.fn(),
}));
jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../ui/ChangelogScreen", () => () => null);
jest.mock("../../ui/LeaderboardScreen", () => () => null);
jest.mock("../../ui/InboxScreen", () => () => null);
jest.mock("../../ui/MarketplaceScreen", () => () => null);
jest.mock("../../ui/AdminScreen", () => () => null);
jest.mock("../../ui/BugReportScreen", () => () => null);
jest.mock("../../world/quests", () => ({
  ...jest.requireActual("../../world/quests"),
  turnInQuest: jest.fn(),
}));

import { fireEvent, render, screen } from "@testing-library/react";
import { getPlayer } from "../../character/player";
import { SCREENS } from "../../ui/screens";
import { turnInQuest } from "../../world/quests";

const QuestsScreen = SCREENS.quests.component;
const makeQuest = (progress) => ({
  id: "quest-1",
  tier: "Common",
  kind: "hunt",
  title: "Pest Control",
  description: "Defeat one enemy.",
  count: 1,
  progress,
  status: "active",
  reward: { astra: 10, exp: 5, rep: 1 },
});

let player;
beforeEach(() => {
  jest.clearAllMocks();
  player = { rep: 0, quests: [makeQuest(1)] };
  getPlayer.mockReturnValue(player);
  turnInQuest.mockReturnValue({ ok: true, messages: ["Quest complete: Pest Control!"] });
});

test("ready quests can be turned in from the quest tab", () => {
  const onChange = jest.fn();
  render(<QuestsScreen onChange={onChange} />);

  const button = screen.getByRole("button", { name: "Turn in" });
  expect(button.disabled).toBe(false);
  fireEvent.click(button);

  expect(turnInQuest).toHaveBeenCalledWith("quest-1");
  expect(screen.getByText("Quest complete: Pest Control!")).toBeTruthy();
  expect(onChange).toHaveBeenCalled();
});

test("quests that are not ready cannot be turned in", () => {
  player.quests = [makeQuest(0)];
  render(<QuestsScreen onChange={jest.fn()} />);

  const button = screen.getByRole("button", { name: "Turn in" });
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(turnInQuest).not.toHaveBeenCalled();
});
