import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SCREENS } from "../../ui/screens";
import { getContestCombatView } from "../../ui/ContestCombat";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../ui/ChangelogScreen", () => () => null);
jest.mock("../../ui/LeaderboardScreen", () => () => null);
jest.mock("../../ui/InboxScreen", () => () => null);
jest.mock("../../ui/MarketplaceScreen", () => () => null);
jest.mock("../../ui/AdminScreen", () => () => null);
jest.mock("../../ui/BugReportScreen", () => () => null);

const CombatScreen = SCREENS.combat.component;

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });
});

test("combat displays remaining Marrow Ward around the player's health", () => {
  render(
    <CombatScreen
      messages={[]}
      player={{}}
      data={{
        stats: {
          health: 80,
          maxHealth: 100,
          stamina: 30,
          maxStamina: 50,
          power: 4,
          maxPower: 10,
        },
        marrowWard: { current: 12, max: 20 },
      }}
    />,
  );

  expect(screen.getByText("Marrow Ward")).toBeInTheDocument();
  expect(screen.getByText("12/20")).toBeInTheDocument();
  expect(screen.getByRole("progressbar", { name: "Marrow Ward" })).toHaveAttribute(
    "aria-valuenow",
    "12",
  );
});

test("combat hides Marrow Ward when it is depleted", () => {
  const { container } = render(
    <CombatScreen
      messages={[]}
      player={{}}
      data={{
        stats: {
          health: 80,
          maxHealth: 100,
          stamina: 30,
          maxStamina: 50,
          power: 4,
          maxPower: 10,
        },
        marrowWard: { current: 0, max: 20 },
      }}
    />,
  );

  expect(screen.queryByText("Marrow Ward")).not.toBeInTheDocument();
  expect(container.querySelector(".combat-health-warded")).toBeNull();
});

test("combat displays the current round", () => {
  render(
    <CombatScreen
      messages={[]}
      player={{}}
      data={{ round: 3 }}
    />,
  );

  expect(screen.getByText("Round 3")).toBeInTheDocument();
});

test("Contest renders through the normal combat layout with live opponent and skill log", () => {
  const fighter = (name, health) => ({
    player: {
      name, level: 10,
      stats: { health, maxHealth: 100, stamina: 10, maxStamina: 10, power: 6, maxPower: 10,
        attackMin: 5, attackMax: 10, defense: 2, speed: 10 },
    },
  });

  const view = getContestCombatView({
    uid: "alice",
    match: {
      host: "alice", guest: "bob", revision: 1,
      fighters: { alice: fighter("Alice", 100), bob: fighter("Bob", 65) },
      log: [{ actor: "Alice", replies: ["You use Frost Lance on Bob."] }],
    },
  });
  const { container } = render(<CombatScreen {...view} />);
  expect(container.querySelector(".combat-arena")).not.toBeNull();
  expect(screen.getByRole("heading", { name: "Bob Level 10" })).toBeInTheDocument();
  expect(screen.getByText("65/100")).toBeInTheDocument();
  expect(screen.getByText("6/10")).toBeInTheDocument();
  expect(screen.getByText("You use Frost Lance on Bob.")).toBeInTheDocument();
});

test.each(["alice", "bob"])("Contest shows both shields from %s's perspective and updates the opponent's effects", (uid) => {
    const fighter = (name, ward, wardMax) => ({
      player: {
        name, level: 10,
        stats: { health: 80, maxHealth: 100, stamina: 10, maxStamina: 10, power: 6, maxPower: 10,
          attackMin: 5, attackMax: 10, defense: 2, speed: 10 },
      },
      combat: { ward, wardMax },
    });
    const match = {
      host: "alice", guest: "bob", revision: 0,
      fighters: { alice: fighter("Alice", 12, 20), bob: fighter("Bob", 30, 40) },
    };
    const opponentId = uid === "alice" ? "bob" : "alice";
    const own = match.fighters[uid];
    const opponent = match.fighters[opponentId];
    const { container, rerender } = render(<CombatScreen {...getContestCombatView({ match, uid })} />);
    const opponentPanel = screen.getByRole("heading", { name: `${opponent.player.name} Level 10` }).closest(".combatant");
    expect(container.querySelectorAll(".combat-health-warded")).toHaveLength(2);
    expect(within(opponentPanel).getByRole("progressbar", { name: "Opponent's Marrow Ward" }))
      .toHaveAttribute("aria-valuenow", String(opponent.combat.ward));
    expect(within(opponentPanel).getByText(`${opponent.combat.ward}/${opponent.combat.wardMax}`)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Marrow Ward" }))
      .toHaveAttribute("aria-valuenow", String(own.combat.ward));

    opponent.combat.ward = 5;
    opponent.defending = true;
    opponent.statuses = [{ id: "burn", turns: 2, power: 0.04, stacks: 1 }];
    rerender(<CombatScreen {...getContestCombatView({ match, uid })} />);
    expect(within(opponentPanel).getByRole("progressbar", { name: "Opponent's Marrow Ward" }))
      .toHaveAttribute("aria-valuenow", "5");
    expect(within(opponentPanel).getByText(`5/${opponent.combat.wardMax}`)).toBeInTheDocument();
    expect(within(opponentPanel).getByRole("heading", { name: /Defending/ })).toBeInTheDocument();
    expect(within(opponentPanel).getByText("Burning (2)")).toBeInTheDocument();

    opponent.combat.ward = 0;
    rerender(<CombatScreen {...getContestCombatView({ match, uid })} />);
    expect(within(opponentPanel).queryByRole("progressbar", { name: "Opponent's Marrow Ward" })).toBeNull();
    expect(opponentPanel.querySelector(".combat-health-warded")).toBeNull();
    expect(screen.getByRole("progressbar", { name: "Marrow Ward" })).toBeInTheDocument();

    delete opponent.combat;
    rerender(<CombatScreen {...getContestCombatView({ match, uid })} />);
    expect(within(opponentPanel).queryByText("Marrow Ward")).toBeNull();
});
