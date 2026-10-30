import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ContestScreen from "../../ui/ContestScreen";
import ContestCombat, { getContestCombatView } from "../../ui/ContestCombat";
import { getContestStatus, sendContestCommand } from "../../world/contest";

jest.mock("../../world/contest", () => ({
  CONTEST_MIN_LEVEL: 25,
  getContestStatus: jest.fn(), sendContestCommand: jest.fn(),
  subscribeContest: () => () => {},
}));
jest.mock("../../ui/RichText", () => ({ text }) => <span>{text}</span>);
jest.mock("../../ui/CharacterSummary", () => ({ Bar: ({ label, value }) => <div>{label}: {value}</div> }));
jest.mock("../../character/player", () => ({ getPlayer: jest.fn() }));
jest.mock("../../ui/Tooltip", () => ({ children }) => children);

beforeEach(() => {
  jest.clearAllMocks();
  getContestStatus.mockReturnValue({ ready: true });
  sendContestCommand.mockResolvedValue(undefined);
});

test("queue entry and cancellation are exposed", async () => {
  const { rerender } = render(<ContestScreen player={{ level: 25 }} />);
  fireEvent.click(screen.getByRole("button", { name: "Join Contest queue" }));
  await waitFor(() => expect(sendContestCommand).toHaveBeenCalledWith({ type: "queue" }));
  getContestStatus.mockReturnValue({ ready: true, waiting: true });
  rerender(<ContestScreen player={{ level: 25 }} />);
  expect(screen.getByText("Searching for another live player...")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Leave queue" }));
  await waitFor(() => expect(sendContestCommand).toHaveBeenCalledWith({ type: "cancel" }));
});

test("Contest queue is locked until level 25", () => {
  const { rerender } = render(<ContestScreen player={{ level: 24 }} />);
  const button = screen.getByRole("button", { name: "Level 25+" });
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(sendContestCommand).not.toHaveBeenCalled();

  rerender(<ContestScreen player={{ level: 25 }} />);
  expect(screen.getByRole("button", { name: "Join Contest queue" }).disabled).toBe(false);
});

const fighter = (name) => ({
  player: { name, stats: { health: 80, maxHealth: 100, power: 10, maxPower: 10 },
    skills: { fireball: 1 }, equippedSkills: ["fireball"], consumables: { healthPotion: 2 } },
});
test("waiting for the opponent disables actions but still permits forfeiting", () => {
  getContestStatus.mockReturnValue({
    ready: true, playing: true, uid: "alice", yourTurn: false, remainingMs: 45000,
    match: { host: "alice", guest: "bob", fighters: { alice: fighter("Alice"), bob: fighter("Bob") } },
  });
  render(<ContestCombat />);
  expect(screen.getByRole("button", { name: "1. Melee Attack" }).disabled).toBe(true);
  expect(screen.getByRole("button", { name: "7. Forfeit Contest" }).disabled).toBe(false);
  expect(screen.getByText(/Bob's turn.*45 seconds/)).toBeTruthy();
});

test("your turn exposes full PvE actions and reports rejected operations", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  sendContestCommand.mockRejectedValue(new Error("Your turn has expired."));
  getContestStatus.mockReturnValue({
    ready: true, playing: true, uid: "alice", yourTurn: true, remainingMs: 45000,
    match: { host: "alice", guest: "bob", fighters: { alice: fighter("Alice"), bob: fighter("Bob") } },
  });
  render(<ContestCombat />);
  for (const name of ["1. Melee Attack", "2. Magic Attack", "3. Defend", "4. Use Item", "5. Skills", "6. Pass"])
    expect(screen.getByRole("button", { name }).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "5. Skills" }));
  fireEvent.click(screen.getByRole("button", { name: "2. Fireball" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Your turn has expired."));
  expect(sendContestCommand).toHaveBeenCalledWith({ type: "action", action: { type: "skill", key: "fireball" } });
  console.error.mockRestore();
});

test("skill selection, back navigation, and item selection do not spend a turn until submitted", async () => {
  getContestStatus.mockReturnValue({
    ready: true, playing: true, uid: "alice", yourTurn: true, remainingMs: 45000,
    match: { host: "alice", guest: "bob", fighters: { alice: fighter("Alice"), bob: fighter("Bob") } },
  });
  render(<ContestCombat />);
  fireEvent.keyDown(window, { key: "5" });
  expect(screen.getByText("Choose a skill to use.")).toBeTruthy();
  expect(sendContestCommand).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: "1" });
  fireEvent.click(screen.getByRole("button", { name: "4. Use Item" }));
  fireEvent.click(screen.getByRole("button", { name: "2. Health Potion x2" }));
  await waitFor(() => expect(sendContestCommand).toHaveBeenCalledWith({
    type: "action", action: { type: "consume", key: "healthPotion" },
  }));
  expect(await screen.findByRole("button", { name: "5. Skills" })).toBeTruthy();
  fireEvent.keyDown(window, { key: "5" });
  fireEvent.keyDown(window, { key: "2" });
  await waitFor(() => expect(sendContestCommand).toHaveBeenLastCalledWith({
    type: "action", action: { type: "skill", key: "fireball" },
  }));
});

test("skill costs use Contest power and class; unavailable skills are disabled", () => {
  const alice = fighter("Alice");
  alice.player.class = "Spellcaster";
  alice.player.stats.power = 4;
  const status = {
    ready: true, playing: true, uid: "alice", yourTurn: true, remainingMs: 45000,
    match: { host: "alice", guest: "bob", fighters: { alice, bob: fighter("Bob") } },
  };
  getContestStatus.mockReturnValue(status);
  const { rerender } = render(<ContestCombat />);
  fireEvent.click(screen.getByRole("button", { name: "5. Skills" }));
  expect(screen.getByRole("button", { name: "2. Fireball" }).disabled).toBe(false);
  alice.player.stats.power = 3;
  rerender(<ContestCombat />);
  expect(screen.getByRole("button", { name: "2. Fireball" }).disabled).toBe(true);
  fireEvent.keyDown(window, { key: "2" });
  expect(sendContestCommand).not.toHaveBeenCalled();
});

test("normal combat data uses match health, statuses, ward and logs, including the final result", () => {
  const alice = fighter("Alice");
  alice.combat = { ward: 5, wardMax: 20 };
  alice.statuses = [{ id: "burn", turns: 2, power: 0.1 }];
  const view = getContestCombatView({
    uid: "alice",
    match: {
      host: "alice", guest: "bob", revision: 3, winner: "alice", reason: "kill",
      fighters: { alice, bob: fighter("Bob") },
      log: [{ actor: "Alice", replies: ["You use Fireball."] }],
    },
  });
  expect(view.player).toBe(alice.player);
  expect(view.data).toMatchObject({
    enemy: { name: "Bob", hp: 80, maxHp: 100 },
    stats: { health: 80, power: 10 },
    round: 2, marrowWard: { current: 5, max: 20 },
    playerStatuses: alice.statuses,
  });
  expect(view.messages.map((message) => message.text)).toContain("You use Fireball.");
  expect(view.messages.at(-1).text).toContain("Victory! You earned 1 Proof of Victory.");
});

test("completed combat offers Return to Arena instead of more actions", () => {
  const onLeave = jest.fn();
  getContestStatus.mockReturnValue({
    ready: true, uid: "alice",
    match: { host: "alice", guest: "bob", winner: "bob", fighters: { alice: fighter("Alice"), bob: fighter("Bob") } },
  });
  render(<ContestCombat onLeave={onLeave} />);
  expect(screen.queryByRole("button", { name: /Melee Attack/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "1. Return to Arena" }));
  expect(onLeave).toHaveBeenCalledTimes(1);
});
