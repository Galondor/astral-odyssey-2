import { act, fireEvent, render, screen, within } from "@testing-library/react";
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

test("multi-enemy combat displays one scrollable column with living enemies and incoming threats", () => {
  const enemies = [
    { name: "Leader", tier: "elite", hp: 100, maxHp: 100, level: 20, statuses: [] },
    { name: "Ally", tier: "basic", hp: 40, maxHp: 80, pending: { name: "Heavy Slash" }, statuses: [] },
    { name: "Fallen", tier: "basic", hp: 0, maxHp: 80, statuses: [] },
  ];
  const { rerender } = render(<CombatScreen messages={[]} player={{}} data={{ enemy: enemies[0], enemies }} />);
  const column = screen.getByRole("region", { name: "Encounter enemies" });
  expect(column).toHaveClass("combat-enemy-column");
  expect(column).toHaveAttribute("tabindex", "0");
  const roster = within(column);
  expect(roster.getByText("Enemies (2/3 remaining)")).toBeInTheDocument();
  expect(roster.getByLabelText("Enemy 1: Leader")).toHaveClass("group-enemy", "tier-elite");
  expect(screen.getAllByRole("heading", { name: /Leader/ })).toHaveLength(1);
  expect(roster.getByLabelText("Enemy 2: Ally")).toHaveTextContent("40/80");
  expect(roster.queryByLabelText("Enemy 3: Fallen")).not.toBeInTheDocument();
  expect(roster.getByRole("status")).toHaveTextContent("Heavy Slash");
  enemies[0].hp = 0;
  rerender(<CombatScreen messages={[]} player={{}} data={{ enemy: enemies[1], enemies }} />);
  expect(roster.queryByLabelText("Enemy 1: Leader")).not.toBeInTheDocument();
  expect(roster.getByLabelText("Enemy 2: Ally")).toBeInTheDocument();
  expect(roster.getByText("Enemies (1/3 remaining)")).toBeInTheDocument();
});

test("combat shows interactive training instructions, remaining slots, and public heavy warnings", () => {
  render(<CombatScreen messages={[]} player={{}} data={{
    actions: { actionAvailable: false, quickAvailable: true },
    tutorial: { step: 2, total: 7, title: "Use your Quick Action", text: "Drink the training potion." },
    enemy: { name: "Training Sentinel", level: 1, pending: { name: "Training Slam", warning: "Defend before ending your turn." } },
  }} />);
  expect(screen.getByLabelText("Combat tutorial")).toHaveTextContent("Drink the training potion.");
  const slots = within(screen.getByRole("group", { name: "Turn actions" }));
  expect(slots.getByRole("button", { name: "Action: Used" })).toHaveClass("action-slot-used");
  const quick = slots.getByRole("button", { name: "Quick Action: Ready" });
  expect(quick).not.toHaveClass("action-slot-used");
  expect(quick).not.toHaveTextContent(/Quick Action/);
  jest.useFakeTimers();
  fireEvent.click(quick);
  act(() => jest.advanceTimersByTime(200));
  expect(screen.getByRole("tooltip")).toHaveTextContent("Quick Action");
  expect(screen.getByRole("tooltip")).toHaveTextContent("Combat items and Quick skills");
  jest.useRealTimers();
  expect(screen.getByRole("status")).toHaveTextContent("Preparing: Training Slam");
});

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

test("mobile combat keeps the latest result visible and earlier rounds in a collapsible log", () => {
  window.matchMedia = () => ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  render(<CombatScreen player={{}} data={{ round: 2 }} messages={[
    { text: "You defend." }, { text: "The enemy attacks." },
  ]} />);
  expect(screen.getByText("The enemy attacks.")).toBeVisible();
  expect(screen.getByText("You defend.")).not.toBeVisible();
  const summary = screen.getByText("Combat log");
  fireEvent.click(summary);
  summary.closest("details").open = true;
  expect(screen.getByText("You defend.")).toBeVisible();
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
