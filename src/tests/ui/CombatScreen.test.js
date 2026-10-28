import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SCREENS } from "../../ui/screens";

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
