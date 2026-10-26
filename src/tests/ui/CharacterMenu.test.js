import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import CharacterMenu from "../../ui/CharacterMenu";

const roster = { characters: [{ id: "123", player: { name: "Nova", level: 5, stats: {} } }], limit: 3 };
let onDelete;
const showMenu = (nextRoster = roster) => render(
  <CharacterMenu roster={nextRoster} onDelete={onDelete} onPlay={jest.fn()} onCreate={jest.fn()} onLogout={jest.fn()} />,
);
const openDialog = () => {
  fireEvent.click(screen.getByRole("button", { name: "Delete Nova" }));
  return screen.getByRole("dialog");
};

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
beforeEach(() => { onDelete = jest.fn().mockResolvedValue(); });

test("deletion appears below Play and requires an exact name before submission", async () => {
  showMenu();
  expect(screen.getByRole("button", { name: "Play as Nova" }).nextElementSibling.textContent).toBe("Delete character");
  const dialog = openDialog();
  expect(within(dialog).getByText(/cannot be undone/)).toBeTruthy();
  const input = within(dialog).getByLabelText('Type "Nova" exactly to confirm.');
  const confirm = within(dialog).getByRole("button", { name: "Permanently delete character" });
  expect(confirm.disabled).toBe(true);
  for (const value of ["nova", " Nova", "Nova ", "Other"]) {
    fireEvent.change(input, { target: { value } });
    expect(confirm.disabled).toBe(true);
    fireEvent.submit(confirm.closest("form"));
  }
  expect(onDelete).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "Nova" } });
  expect(confirm.disabled).toBe(false);
  fireEvent.click(confirm);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onDelete).toHaveBeenCalledWith("123", "Nova");
});

test.each(["cancel", "escape"])("%s dismisses the dialog without deleting and restores focus", (method) => {
  showMenu();
  const trigger = screen.getByRole("button", { name: "Delete Nova" });
  const dialog = openDialog();
  if (method === "cancel") fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  else fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(onDelete).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(trigger);
});

test("failed deletion remains in the dialog and displays the error", async () => {
  onDelete.mockRejectedValueOnce(new Error("Couldn't delete. Please reload."));
  showMenu();
  const dialog = openDialog();
  fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Nova" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Permanently delete character" }));
  expect(await within(dialog).findByRole("alert")).toHaveProperty("textContent", "Couldn't delete. Please reload.");
  expect(within(dialog).getByRole("button", { name: "Cancel" }).disabled).toBe(false);
});

test("pending deletion cannot be submitted twice or dismissed", async () => {
  let finish;
  onDelete.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  showMenu();
  const dialog = openDialog();
  fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Nova" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Permanently delete character" }));
  expect(within(dialog).getByRole("button", { name: "Cancel" }).disabled).toBe(true);
  fireEvent.submit(dialog.querySelector("form"));
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(screen.getByRole("dialog")).toBe(dialog);
  expect(onDelete).toHaveBeenCalledTimes(1);
  finish();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("unnamed characters require the displayed New adventurer name", async () => {
  showMenu({ characters: [{ id: "456" }], limit: 3 });
  fireEvent.click(screen.getByRole("button", { name: "Delete New adventurer" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "New adventurer" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Permanently delete character" }));
  await waitFor(() => expect(onDelete).toHaveBeenCalledWith("456", "New adventurer"));
});
