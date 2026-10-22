import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminScreen from "./AdminScreen";
import { resolveBugReport, subscribeBugReports } from "../world/bugReports";
import { describeAttachments, getBroadcasts, getDirectory, sendMessage } from "../world/inbox";

jest.mock("../items/consumables", () => ({
  CONSUMABLES: { architectsRune: { name: "Architect's Rune" } }, KEY_ITEMS: {},
}));
jest.mock("../items/items", () => ({ GEAR_SLOT_TYPES: [], RARITY_NAMES: [] }));
jest.mock("../items/materials", () => ({ MATERIALS: {} }));
jest.mock("../world/dungeonData", () => ({ UNIQUES: {} }));
jest.mock("../world/inbox", () => ({
  deleteBroadcast: jest.fn(),
  describeAttachments: jest.fn(() => []),
  getBroadcasts: jest.fn(),
  getDirectory: jest.fn(),
  sendMessage: jest.fn(),
}));
jest.mock("../world/bugReports", () => ({
  resolveBugReport: jest.fn(),
  subscribeBugReports: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  describeAttachments.mockReturnValue(["2x Architect's Rune"]);
  getDirectory.mockResolvedValue([]);
  getBroadcasts.mockResolvedValue([]);
  resolveBugReport.mockResolvedValue();
  subscribeBugReports.mockImplementation((onReports) => {
    onReports([{
      id: "report-1",
      title: "Quest cannot complete",
      description: "The final objective never updates.",
      playerName: "Nova",
      uid: "player-1",
      createdAt: 1000,
      status: "open",
    }]);
    return jest.fn();
  });
});

test("admins can view player reports and resolve them", async () => {
  render(<AdminScreen />);
  fireEvent.click(screen.getByRole("tab", { name: "Bugs" }));

  expect(await screen.findByText("Quest cannot complete")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Resolve" }));

  await waitFor(() => expect(resolveBugReport).toHaveBeenCalledWith("report-1"));
  expect(await screen.findByRole("status")).toBeTruthy();
});

test.each(["broadcast", "individual"])("admins can attach runes to a %s message", async (mode) => {
  getDirectory.mockResolvedValue([{ uid: "player-1", name: "Nova", level: 20 }]);
  sendMessage.mockResolvedValue();
  render(<AdminScreen />);
  if (mode === "individual") {
    fireEvent.click(screen.getByRole("tab", { name: "Individual Message" }));
    fireEvent.change(screen.getByRole("combobox", { name: /player/i }), { target: { value: "Nova" } });
    fireEvent.mouseDown(await screen.findByRole("option", { name: /Nova/ }));
  }
  fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Rune gift" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Enjoy!" } });
  const kind = screen.getAllByRole("combobox").find((select) =>
    Array.from(select.options || []).some((option) => option.value === "consumable"));
  fireEvent.change(kind, { target: { value: "consumable" } });
  expect(screen.getByRole("option", { name: "Architect's Rune" })).toBeTruthy();
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Attach" }));
  fireEvent.click(screen.getByRole("button", { name: /send/i }));
  await waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
    to: mode === "broadcast" ? "all" : "player-1",
    attachments: expect.objectContaining({ consumables: { architectsRune: 2 } }),
  })));
});
