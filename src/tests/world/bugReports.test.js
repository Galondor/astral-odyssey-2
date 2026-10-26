import { onValue, push, set, update } from "firebase/database";
import { getPlayer } from "../../character/player";
import { resolveBugReport, submitBugReport, subscribeBugReports } from "../../world/bugReports";

jest.mock("../../firebase", () => ({
  auth: { currentUser: { uid: "player-1" } },
  db: {},
}));
jest.mock("../../character/player", () => ({ getPlayer: jest.fn() }));
jest.mock("firebase/database", () => ({
  onValue: jest.fn(),
  push: jest.fn(),
  ref: (_, path) => path,
  set: jest.fn(),
  update: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  getPlayer.mockReturnValue({ name: "Nova" });
  push.mockReturnValue("new-report");
  set.mockResolvedValue();
  update.mockResolvedValue();
});

test("submits a trimmed bug report with the signed-in player's identity", async () => {
  await submitBugReport({ title: "  Stuck in combat  ", description: "  The exit button does nothing.  " });

  expect(push).toHaveBeenCalledWith("bugReports");
  expect(set).toHaveBeenCalledWith("new-report", {
    uid: "player-1",
    playerName: "Nova",
    title: "Stuck in combat",
    description: "The exit button does nothing.",
    createdAt: expect.any(Number),
    status: "open",
  });
});

test.each([
  [{ title: "", description: "Description" }, /title/],
  [{ title: "Title", description: " " }, /description/],
  [{ title: "x".repeat(101), description: "Description" }, /title/],
])("rejects invalid report content", async (report, message) => {
  await expect(submitBugReport(report)).rejects.toThrow(message);
  expect(set).not.toHaveBeenCalled();
});

test("subscribes to reports ordered newest first", () => {
  const onReports = jest.fn();
  onValue.mockImplementation((_, callback) => {
    callback({ val: () => ({
      old: { title: "Old", createdAt: 10 },
      new: { title: "New", createdAt: 20 },
    }) });
    return jest.fn();
  });

  const stop = subscribeBugReports(onReports);

  expect(onReports).toHaveBeenCalledWith([
    { id: "new", title: "New", createdAt: 20 },
    { id: "old", title: "Old", createdAt: 10 },
  ]);
  expect(stop).toEqual(expect.any(Function));
});

test("resolves a report with an update", async () => {
  await resolveBugReport("report-1");

  expect(update).toHaveBeenCalledWith("bugReports/report-1", {
    status: "resolved",
    resolvedAt: expect.any(Number),
  });
});
