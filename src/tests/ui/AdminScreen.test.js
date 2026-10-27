import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminScreen from "../../ui/AdminScreen";
import { resolveBugReport, subscribeBugReports } from "../../world/bugReports";
import {
  administerPlayerTimer,
  describeAttachments,
  getBroadcasts,
  getDirectory,
  grantLabyrinthAttempt,
  sendMessage,
} from "../../world/inbox";

jest.mock("../../items/consumables", () => ({
  CONSUMABLES: { architectsRune: { name: "Architect's Rune" } }, KEY_ITEMS: {},
}));
jest.mock("../../character/player", () => ({ getPlayer: jest.fn() }));
jest.mock("../../combat/combat", () => ({ getEnemy: jest.fn() }));
jest.mock("../../items/items", () => ({
  ...jest.requireActual("../../items/items"),
  GEAR_SLOT_TYPES: ["helmet", "weapon"], RARITY_NAMES: ["Common"],
}));
jest.mock("../../items/materials", () => ({ MATERIALS: { relicFragments: { name: "Relic Fragments" } } }));
jest.mock("../../world/dungeonData", () => ({ UNIQUES: {
  testUnique: { name: "Test Unique" },
  unwrittenPath: { name: "The Unwritten Path" },
} }));
jest.mock("../../world/inbox", () => ({
  administerPlayerTimer: jest.fn(),
  deleteBroadcast: jest.fn(),
  describeAttachments: jest.fn(() => []),
  getBroadcasts: jest.fn(),
  getDirectory: jest.fn(),
  grantLabyrinthAttempt: jest.fn(),
  sendMessage: jest.fn(),
}));
jest.mock("../../world/bugReports", () => ({
  resolveBugReport: jest.fn(),
  subscribeBugReports: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  describeAttachments.mockReturnValue(["2x Architect's Rune"]);
  getDirectory.mockResolvedValue([]);
  getBroadcasts.mockResolvedValue([]);
  administerPlayerTimer.mockResolvedValue();
  grantLabyrinthAttempt.mockResolvedValue();
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

test("admins can refresh a selected player's timer and grant a Labyrinth attempt", async () => {
  getDirectory.mockResolvedValue([{ uid: "player-1", name: "Nova", level: 22 }]);
  render(<AdminScreen />);
  fireEvent.click(screen.getByRole("tab", { name: "Timers & Attempts" }));
  fireEvent.change(screen.getByRole("combobox", { name: /player/i }), { target: { value: "Nova" } });
  fireEvent.mouseDown(await screen.findByRole("option", { name: /Nova/ }));

  fireEvent.change(screen.getByLabelText("Timer"), { target: { value: "labyrinth" } });
  fireEvent.click(screen.getByRole("button", { name: "Force refresh timer" }));
  await waitFor(() => expect(administerPlayerTimer).toHaveBeenCalledWith("player-1", "labyrinth"));
  expect((await screen.findByRole("status")).textContent).toContain("Labyrinth timer refreshed.");

  fireEvent.change(screen.getByLabelText("Timer"), { target: { value: "dungeons" } });
  fireEvent.click(screen.getByRole("button", { name: "Force refresh timer" }));
  await waitFor(() => expect(administerPlayerTimer).toHaveBeenCalledWith("player-1", "dungeons"));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Dungeons timer refreshed."));

  fireEvent.click(screen.getByRole("button", { name: "Grant another Labyrinth attempt" }));
  await waitFor(() => expect(grantLabyrinthAttempt).toHaveBeenCalledWith("player-1"));
  expect((await screen.findByRole("status")).textContent).toContain("A fresh Labyrinth attempt has been granted.");
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

test("admins can attach Labyrinth Relic Fragments and the Unwritten Path unique", async () => {
  sendMessage.mockResolvedValue();
  render(<AdminScreen />);
  fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Labyrinth rewards" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "An expedition reward." } });
  const keySelect = () => screen.getByLabelText("Attachment type").closest(".admin-attach").querySelectorAll("select")[1];

  fireEvent.change(screen.getByLabelText("Attachment type"), { target: { value: "material" } });
  expect(screen.getByRole("option", { name: "Relic Fragments" })).toBeTruthy();
  fireEvent.change(keySelect(), { target: { value: "relicFragments" } });
  fireEvent.click(screen.getByRole("button", { name: "Attach" }));

  fireEvent.change(screen.getByLabelText("Attachment type"), { target: { value: "unique" } });
  expect(screen.getByRole("option", { name: "The Unwritten Path" })).toBeTruthy();
  fireEvent.change(keySelect(), { target: { value: "unwrittenPath" } });
  fireEvent.click(screen.getByRole("button", { name: "Attach" }));
  fireEvent.click(screen.getByRole("button", { name: /send/i }));

  await waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
    to: "all",
    attachments: expect.objectContaining({
      materials: { relicFragments: 1 },
      uniques: [{ id: "unwrittenPath", count: 1 }],
    }),
  })));
});

test.each(["broadcast", "individual"])("admins can mail the title by %s", async (mode) => {
  getDirectory.mockResolvedValue([{ uid: "player-1", name: "Nova", level: 100 }]);
  sendMessage.mockResolvedValue();
  render(<AdminScreen />);
  if (mode === "individual") {
    fireEvent.click(screen.getByRole("tab", { name: "Individual Message" }));
    fireEvent.change(screen.getByRole("combobox", { name: /player/i }), { target: { value: "Nova" } });
    fireEvent.mouseDown(await screen.findByRole("option", { name: /Nova/ }));
  }
  fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "A title" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "For your achievement." } });
  fireEvent.change(screen.getByLabelText("Attachment type"), { target: { value: "title" } });
  expect(screen.getByRole("option", { name: /Monarch of the Odyssey.*level 100 before version 0\.3\.0\.0/i })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Attach" }));
  fireEvent.click(screen.getByRole("button", { name: /send/i }));
  await waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
    to: mode === "broadcast" ? "all" : "player-1",
    attachments: expect.objectContaining({ titles: ["monarchOfTheOdyssey"] }),
  })));
});

test.each([
  ["broadcast", "gear", true],
  ["broadcast", "unique", false],
  ["individual", "gear", false],
  ["individual", "unique", true],
])("admins can force holofoil %s %s attachments (custom colors: %s)", async (mode, type, custom) => {
  getDirectory.mockResolvedValue([{ uid: "player-1", name: "Nova", level: 20 }]);
  sendMessage.mockResolvedValue();
  render(<AdminScreen />);
  if (mode === "individual") {
    fireEvent.click(screen.getByRole("tab", { name: "Individual Message" }));
    fireEvent.change(screen.getByRole("combobox", { name: /player/i }), { target: { value: "Nova" } });
    fireEvent.mouseDown(await screen.findByRole("option", { name: /Nova/ }));
  }
  fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Holofoil gift" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Enjoy!" } });
  const kind = screen.getAllByRole("combobox").find((select) =>
    Array.from(select.options || []).some((option) => option.value === "gear"));
  fireEvent.change(kind, { target: { value: type } });
  fireEvent.click(screen.getByLabelText("Force holofoil"));
  if (custom) {
    fireEvent.change(screen.getByLabelText("Holofoil color 1"), { target: { value: "#ABCDEF" } });
    fireEvent.change(screen.getByLabelText("Holofoil color 2"), { target: { value: "#123456" } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Attach" }));
  fireEvent.click(screen.getByRole("button", { name: /send/i }));
  await waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
    to: mode === "broadcast" ? "all" : "player-1",
    attachments: expect.objectContaining({
      [type === "gear" ? "gear" : "uniques"]: [
        expect.objectContaining({ holofoil: custom ? ["#ABCDEF", "#123456"] : true }),
      ],
    }),
  })));
});

test("invalid or incomplete hex colors cannot be attached, and gemstones have no holofoil control", async () => {
  render(<AdminScreen />);
  const kind = screen.getAllByRole("combobox").find((select) =>
    Array.from(select.options || []).some((option) => option.value === "gear"));
  fireEvent.change(kind, { target: { value: "gear" } });
  fireEvent.click(screen.getByLabelText("Force holofoil"));
  fireEvent.change(screen.getByLabelText("Holofoil color 1"), { target: { value: "#123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Attach" }));
  expect(screen.getByText(/Enter both holofoil colors/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Holofoil color 2"), { target: { value: "not hex" } });
  fireEvent.click(screen.getByRole("button", { name: "Attach" }));
  expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  fireEvent.change(kind, { target: { value: "gemstone" } });
  expect(screen.queryByLabelText("Force holofoil")).toBeNull();
  await waitFor(() => expect(getDirectory).toHaveBeenCalled());
});

test.each(["broadcast", "individual"])("admins can build exact custom gear for a %s message", async (mode) => {
  getDirectory.mockResolvedValue([{ uid: "player-1", name: "Nova", level: 20 }]);
  sendMessage.mockResolvedValue();
  render(<AdminScreen />);
  if (mode === "individual") {
    fireEvent.click(screen.getByRole("tab", { name: "Individual Message" }));
    fireEvent.change(screen.getByRole("combobox", { name: /player/i }), { target: { value: "Nova" } });
    fireEvent.mouseDown(await screen.findByRole("option", { name: /Nova/ }));
  }
  fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Custom gift" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Enjoy!" } });
  fireEvent.change(screen.getByLabelText("Attachment type"), { target: { value: "custom" } });
  fireEvent.change(screen.getByLabelText("Item name"), { target: { value: "Nova's Blade" } });
  fireEvent.change(screen.getByLabelText("Item slot"), { target: { value: "weapon" } });
  fireEvent.change(screen.getByLabelText("Rarity"), { target: { value: "Unique" } });
  fireEvent.change(screen.getByLabelText("Condition"), { target: { value: "Perfect" } });
  fireEvent.change(screen.getByLabelText("Item level"), { target: { value: "50" } });
  fireEvent.change(screen.getByLabelText("Item value (astra)"), { target: { value: "1234" } });
  fireEvent.change(screen.getByLabelText("Main stat"), { target: { value: "dexterity" } });
  expect(screen.queryByLabelText("Main stat value")).toBeNull();
  fireEvent.change(screen.getByLabelText("Main stat tier"), { target: { value: "7" } });
  fireEvent.change(screen.getByLabelText("Critical damage"), { target: { value: "4" } });
  fireEvent.change(screen.getByLabelText("Ability"), { target: { value: "Piercing" } });
  fireEvent.click(screen.getByLabelText("Two-handed"));
  fireEvent.click(screen.getByLabelText("Force holofoil"));
  fireEvent.change(screen.getByLabelText("Holofoil color 1"), { target: { value: "#123456" } });
  fireEvent.change(screen.getByLabelText("Holofoil color 2"), { target: { value: "#abcdef" } });
  fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Attach" }));
  // Editing the builder after attachment must not change the attached items.
  fireEvent.change(screen.getByLabelText("Main stat tier"), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: /send/i }));
  await waitFor(() => expect(sendMessage).toHaveBeenCalled());
  const { to, attachments } = sendMessage.mock.calls[0][0];
  expect(to).toBe(mode === "broadcast" ? "all" : "player-1");
  expect(attachments.items).toHaveLength(2);
  expect(attachments.items[0].id).not.toBe(attachments.items[1].id);
  attachments.items.forEach((item) => expect(item).toMatchObject({
    name: "Nova's Blade", slot: "weapon", rarity: "Unique", condition: "Perfect",
    iLevel: 50, price: 1234, mainStat: { stat: "dexterity", tier: 7, value: expect.any(Number) },
    subStats: { criticalDamage: expect.any(Number) }, subTiers: { criticalDamage: 4 },
    ability: { name: "Piercing" }, twoHanded: true,
    holofoil: ["#123456", "#abcdef"],
  }));
  expect(attachments.gear).toEqual([]);
});

test("unavailable substat tiers are disabled and stale choices report an error", async () => {
  render(<AdminScreen />);
  fireEvent.change(screen.getByLabelText("Attachment type"), { target: { value: "custom" } });
  fireEvent.change(screen.getByLabelText("Item slot"), { target: { value: "helmet" } });
  fireEvent.change(screen.getByLabelText("Item name"), { target: { value: "Gift" } });
  const luck = screen.getByLabelText("Luck");
  expect(luck.querySelector('option[value="0"]').disabled).toBe(true);
  expect(luck.querySelector('option[value="7"]').disabled).toBe(false);
  fireEvent.change(screen.getByLabelText("Item level"), { target: { value: "80" } });
  fireEvent.change(luck, { target: { value: "4" } });
  fireEvent.change(screen.getByLabelText("Item level"), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Attach" }));
  expect(screen.getByText(/Luck cannot roll T4/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  await waitFor(() => expect(getDirectory).toHaveBeenCalled());
});

test("invalid custom gear and incomplete holofoil colors are not attached", async () => {
  render(<AdminScreen />);
  fireEvent.change(screen.getByLabelText("Attachment type"), { target: { value: "custom" } });
  fireEvent.click(screen.getByRole("button", { name: "Attach" }));
  expect(screen.getByText("Enter an item name.")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Item name"), { target: { value: "Gift" } });
  fireEvent.click(screen.getByLabelText("Force holofoil"));
  fireEvent.change(screen.getByLabelText("Holofoil color 1"), { target: { value: "#123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Attach" }));
  expect(screen.getByText(/Enter both holofoil colors/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  fireEvent.click(screen.getByLabelText("Force holofoil"));
  fireEvent.click(screen.getByRole("button", { name: "Attach" }));
  expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  await waitFor(() => expect(getDirectory).toHaveBeenCalled());
});

test("blank custom holofoil colors generate a saved color pair for each copy", async () => {
  sendMessage.mockResolvedValue();
  render(<AdminScreen />);
  fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Gift" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Enjoy!" } });
  fireEvent.change(screen.getByLabelText("Attachment type"), { target: { value: "custom" } });
  fireEvent.change(screen.getByLabelText("Item name"), { target: { value: "Foil Gift" } });
  fireEvent.click(screen.getByLabelText("Force holofoil"));
  fireEvent.change(screen.getByLabelText("Holofoil color 1"), { target: { value: "  " } });
  fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Attach" }));
  expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /send/i }));
  await waitFor(() => expect(sendMessage).toHaveBeenCalled());
  const { items } = sendMessage.mock.calls[0][0].attachments;
  expect(items).toHaveLength(2);
  items.forEach((item) => expect(item.holofoil).toEqual([
    expect.stringMatching(/^#[0-9a-f]{6}$/i),
    expect.stringMatching(/^#[0-9a-f]{6}$/i),
  ]));
});
