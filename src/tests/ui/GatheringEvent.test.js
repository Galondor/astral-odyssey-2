import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import GatheringEvent from "../../ui/GatheringEvent";
import { getPlayer, setPlayer } from "../../character/player";
import { forfeitGathering, getGatheringAttempt, getGatheringDuration, offerGathering } from "../../world/gathering";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
jest.mock("../../combat/combat", () => ({ getEnemy: jest.fn(() => null) }));

beforeEach(() => {
  jest.useFakeTimers("modern");
  forfeitGathering();
  jest.clearAllMocks();
  getPlayer.mockReturnValue({});
});
afterEach(() => jest.useRealTimers());

test.each(["mining", "logging"])("%s can start and finish under the app's Strict Mode", (activity) => {
  offerGathering({}, "Meadowlands", activity);
  const name = activity === "mining" ? "Mining" : "Logging";
  render(<StrictMode><GatheringEvent goToScene={jest.fn()} /></StrictMode>);
  expect(getGatheringAttempt().state).toBe("offered");
  fireEvent.pointerDown(screen.getByRole("button", { name: `Start ${name}` }));
  expect(getGatheringAttempt().state).toBe("active");
  act(() => jest.advanceTimersByTime(1100));
  expect(getGatheringAttempt().state).toBe("active");
  expect(screen.queryByRole("alert")).toBeNull();
  act(() => jest.advanceTimersByTime(30000));
  expect(getGatheringAttempt().state).toBe("resolved");
  expect(setPlayer).toHaveBeenCalledTimes(1);
});

test("offers explain resources and do not accept keyboard-generated button clicks", () => {
  offerGathering({}, "Meadowlands", "mining");
  render(<GatheringEvent goToScene={jest.fn()} />);
  expect(screen.getByText(/Maximum material tier 1/)).toBeTruthy();
  const start = screen.getByRole("button", { name: "Start Mining" });
  fireEvent.keyDown(start, { key: "Enter" });
  fireEvent.click(start, { detail: 0 });
  expect(getGatheringAttempt().state).toBe("offered");
  fireEvent.pointerDown(start);
  expect(getGatheringAttempt().state).toBe("active");
  act(() => jest.advanceTimersByTime(1100));
  const strike = screen.getByRole("button", { name: "Strike" });
  fireEvent.click(strike, { detail: 0 });
  expect(getGatheringAttempt().scores[0]).toBeNull();
  fireEvent.pointerDown(strike);
  expect(getGatheringAttempt().scores[0]).not.toBeNull();
});

test("Logging uses pointer input with alternating targets, finishes once and shows practice rewards", () => {
  offerGathering({}, "Darkwood", "logging");
  render(<GatheringEvent goToScene={jest.fn()} onChange={jest.fn()} />);
  fireEvent.pointerDown(screen.getByRole("button", { name: "Start Logging" }));
  const c = getGatheringAttempt().config;
  act(() => jest.advanceTimersByTime(c.countdown + c.interval));
  fireEvent.pointerDown(screen.getByRole("button", { name: "Left chop" }));
  expect(getGatheringAttempt().scores[0]).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "Right chop" }));
  expect(getGatheringAttempt().scores[1]).toBeNull();
  act(() => jest.advanceTimersByTime(getGatheringDuration(c)));
  expect(screen.getByText(/Best combo 1/)).toBeTruthy();
  expect(setPlayer).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(10000));
  expect(setPlayer).toHaveBeenCalledTimes(1);
});

test("leaving or hiding an active QTE forfeits it and cleans up callbacks", () => {
  offerGathering({}, "Meadowlands", "mining");
  const view = render(<StrictMode><GatheringEvent goToScene={jest.fn()} /></StrictMode>);
  fireEvent.pointerDown(screen.getByRole("button", { name: "Start Mining" }));
  view.unmount();
  expect(getGatheringAttempt().state).toBe("forfeited");
  act(() => jest.advanceTimersByTime(30000));
  expect(setPlayer).not.toHaveBeenCalled();
  offerGathering({}, "Meadowlands", "logging");
  render(<GatheringEvent goToScene={jest.fn()} />);
  fireEvent.pointerDown(screen.getByRole("button", { name: "Start Logging" }));
  const hidden = jest.spyOn(document, "hidden", "get").mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange"));
  expect(screen.getByRole("status").textContent).toContain("forfeited");
  expect(setPlayer).not.toHaveBeenCalled();
  hidden.mockRestore();
});
