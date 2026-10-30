import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { getPlayer, setPlayer } from "../../character/player";
import { createLabyrinth, getNextLabyrinthReset, isLabyrinthActive } from "../../world/labyrinth";
import { getVisibleOptions, scenes } from "../../world/gameLogic";
import LabyrinthExpeditionScreen from "../../ui/LabyrinthExpeditionScreen";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(),
  setPlayer: jest.fn(),
}));

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

test.each([false, true])("leaving a restored Labyrinth scene restores normal controls (completed: %s)", (completed) => {
  let player = {
    level: 30,
    stats: { health: 100, maxHealth: 100, stamina: 30, maxStamina: 30 },
  };
  player.labyrinth = {
    ...createLabyrinth(player),
    started: true,
    active: !completed,
    completed,
    returnToLabyrinth: completed,
  };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => {
    player = { ...player, ...patch };
  });
  const savedFloor = player.labyrinth.currentFloor;
  const savedCheckpoint = player.labyrinth.floors[savedFloor].checkpoint;

  function RestoredGame() {
    const [sceneId, setSceneId] = useState(() => isLabyrinthActive() ? "labyrinth" : "menu");
    return (
      <>
        {sceneId === "labyrinth" && (
          <LabyrinthExpeditionScreen player={player} goToScene={setSceneId} />
        )}
        {getVisibleOptions(scenes[sceneId]).map((option) => (
          <button key={option.label}>{option.label}</button>
        ))}
      </>
    );
  }
  render(<RestoredGame />);
  expect(screen.queryByRole("button", { name: "Travel" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /return to (the )?gate/i }));

  for (const label of ["Travel", "Town", "Portal"]) {
    expect(screen.getByRole("button", { name: label })).toBeTruthy();
  }
  expect(isLabyrinthActive()).toBe(false);
  expect(player.labyrinth.currentFloor).toBe(savedFloor);
  expect(player.labyrinth.floors[savedFloor].position).toEqual(savedCheckpoint);
  expect(player.labyrinth.completed).toBe(completed);
});
