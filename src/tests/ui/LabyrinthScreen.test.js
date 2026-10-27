import { getNextLabyrinthReset } from "../../world/labyrinth";

jest.mock("../../firebase", () => ({ db: {} }));

test("labyrinth resets Friday at 8 AM Eastern before daylight saving time ends", () => {
  const reset = getNextLabyrinthReset(new Date("2026-10-30T11:59:00.000Z"));
  expect(reset.toISOString()).toBe("2026-10-30T12:00:00.000Z");
});

test("labyrinth reset advances to the following Friday after 8 AM Eastern", () => {
  const reset = getNextLabyrinthReset(new Date("2026-10-30T12:01:00.000Z"));
  expect(reset.toISOString()).toBe("2026-11-06T13:00:00.000Z");
});

test("labyrinth reset observes Eastern daylight saving time in spring", () => {
  const reset = getNextLabyrinthReset(new Date("2026-03-08T12:00:00.000Z"));
  expect(reset.toISOString()).toBe("2026-03-13T12:00:00.000Z");
});
