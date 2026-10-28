import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import WorldBossScreen from "../../ui/WorldBossScreen";
import { formatWorldBossDuration } from "../../ui/WorldBossScreen";
import { startCombat, getEnemy } from "../../combat/combat";
import { finishWorldBossAttempt, startWorldBossAttempt, subscribeWorldBoss } from "../../world/worldBoss";

jest.mock("../../character/player", () => ({
  getCharacterIdentity: () => "alice",
  getPlayer: jest.fn(),
}));
jest.mock("../../combat/combat", () => ({
  getEnemy: jest.fn(() => null),
  startCombat: jest.fn(),
}));
jest.mock("../../world/inbox", () => ({ isAdmin: () => false }));
jest.mock("../../world/worldBoss", () => ({
  clearWorldBossError: jest.fn(),
  finishWorldBossAttempt: jest.fn(() => Promise.resolve()),
  getWorldBossError: () => "",
  getWorldBossTentativeRewards: (rank) => rank === 1 ? "First-place reward" : "Rank reward",
  getWorldBossUniqueDropChance: () => 15,
  hasPendingWorldBossAttempt: () => false,
  retryWorldBossAttempt: jest.fn(),
  startWorldBossAttempt: jest.fn(),
  subscribeWorldBoss: jest.fn(),
  subscribeWorldBossError: () => () => {},
  WORLD_BOSS_DAILY_ATTEMPTS: 3,
  WORLD_BOSS_HEALTH: 1_000_000,
  WORLD_BOSS_REWARD_THRESHOLD: 10_000,
}));

beforeEach(() => {
  jest.clearAllMocks();
  getEnemy.mockReturnValue(null);
  subscribeWorldBoss.mockImplementation((onChange) => {
    onChange({
      cycle: "cycle",
      participants: { alice: { attemptsDay: 0, attemptsUsed: 0 } },
      fighters: [{ uid: "alice", name: "Alice", damage: 25_000, activeUntil: 0 }],
      totalDamage: 25_000,
      health: 975_000,
      defeated: false,
      nextSpawnAt: Date.now() + 72 * 60 * 60 * 1000,
    });
    return () => {};
  });
  finishWorldBossAttempt.mockResolvedValue(undefined);
});

test("world boss timer includes seconds", () => {
  expect(formatWorldBossDuration(72 * 60 * 60 * 1000 + 65_000)).toBe("3d 0h 1m 5s");
  expect(formatWorldBossDuration(999)).toBe("0d 0h 0m 1s");
});

test("shows shared boss health, current rankings, and tentative placement rewards", () => {
  render(<WorldBossScreen player={{ name: "Alice", level: 35, stats: {} }} />);

  expect(screen.getByRole("heading", { name: "World Boss: The Astral Colossus" })).toBeTruthy();
  expect(screen.getByText("975,000 / 1,000,000 health")).toBeTruthy();
  expect(screen.getByRole("row", { name: /#1 Alice 25,000 2.50% First-place reward/ })).toBeTruthy();
  expect(screen.getByText(/three attempts per day/i)).toBeTruthy();
});

test("starting an attempt enters the existing combat screen", async () => {
  const enemy = { id: "boss", worldBossCycle: "cycle" };
  startWorldBossAttempt.mockResolvedValue({ ok: true, enemy, remainingAttempts: 2 });
  const goToScene = jest.fn();
  const onChange = jest.fn();
  render(<WorldBossScreen player={{ name: "Alice", level: 35, stats: {} }} goToScene={goToScene} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Start Attempt" }));

  await waitFor(() => expect(startCombat).toHaveBeenCalledWith(enemy));
  expect(finishWorldBossAttempt).toHaveBeenCalledWith(enemy);
  expect(goToScene).toHaveBeenCalledWith("combat");
  expect(onChange).toHaveBeenCalled();
});
