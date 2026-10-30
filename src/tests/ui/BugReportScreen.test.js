import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BugReportScreen from "../../ui/BugReportScreen";
import { submitBugReport } from "../../world/bugReports";

jest.mock("../../world/bugReports", () => ({
  MAX_BUG_TITLE_LENGTH: 100,
  MAX_BUG_DESCRIPTION_LENGTH: 2000,
  submitBugReport: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

test("submits a bug report and confirms success", async () => {
  submitBugReport.mockResolvedValue();
  render(<BugReportScreen />);

  expect(screen.getByLabelText("Message type").value).toBe("bug");
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Quest cannot complete" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "The final objective never updates." } });
  fireEvent.click(screen.getByRole("button", { name: "Submit message" }));

  await waitFor(() => expect(submitBugReport).toHaveBeenCalledWith({
    type: "bug",
    title: "Quest cannot complete",
    description: "The final objective never updates.",
  }));
  expect((await screen.findByRole("status")).textContent).toContain("Thanks! Your bug report has been sent.");
});

test("players can submit game feedback", async () => {
  submitBugReport.mockResolvedValue();
  render(<BugReportScreen />);

  fireEvent.change(screen.getByLabelText("Message type"), { target: { value: "feedback" } });
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "More quests" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "I'd enjoy more side quests." } });
  fireEvent.click(screen.getByRole("button", { name: "Submit message" }));

  await waitFor(() => expect(submitBugReport).toHaveBeenCalledWith({
    type: "feedback",
    title: "More quests",
    description: "I'd enjoy more side quests.",
  }));
  expect((await screen.findByRole("status")).textContent).toContain("Thanks! Your feedback has been sent.");
});

test("shows an error when a report cannot be saved", async () => {
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  submitBugReport.mockRejectedValue(new Error("Database unavailable"));
  render(<BugReportScreen />);
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "A bug" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "It failed." } });
  fireEvent.click(screen.getByRole("button", { name: "Submit message" }));

  expect((await screen.findByRole("alert")).textContent).toContain("Database unavailable");
  error.mockRestore();
});
