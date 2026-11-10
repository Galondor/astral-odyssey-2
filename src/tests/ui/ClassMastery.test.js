import { act, fireEvent, render, screen, within } from "@testing-library/react";
import ClassMastery, { ClassResource } from "../../ui/ClassMastery";
import ClassSwitchPreview from "../../ui/ClassSwitchPreview";
import { getPlayer, setPlayer } from "../../character/player";
import { cancelClassSwitch, commitWithClassPreview } from "../../character/classSwitch";
import { CLASS_TREES } from "../../character/mastery";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
jest.mock("../../combat/combat", () => ({ getEnemy: () => null }));

let player;
beforeEach(() => {
  jest.clearAllMocks();
  cancelClassSwitch();
  player = { class: "Swordsman", level: 25, equippedSkills: [], classMastery: { Swordsman: ["brace"], Spellblade: ["emberWeave"] } };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
});

test("current and inactive mastery trees show independent budgets; inactive editing is disabled", () => {
  render(<ClassMastery player={player} onChange={jest.fn()} />);
  const active = within(screen.getByRole("region", { name: "Swordsman mastery" }));
  const inactiveCard = screen.getByText("Spellblade (inactive, saved)").closest("details");
  expect(inactiveCard.open).toBe(false);
  fireEvent.click(inactiveCard.querySelector("summary"));
  expect(inactiveCard.open).toBe(true);
  const inactive = within(screen.getByRole("region", { name: "Spellblade mastery" }));
  expect(screen.getByRole("status", { name: "Mastery points available" }).textContent).toContain("2 Mastery Points available");
  expect(screen.getAllByText(/1\/3 spent/)).toHaveLength(2);
  expect(inactive.getByRole("button", { name: "Remove Ember Weave" }).disabled).toBe(true);
  fireEvent.click(active.getByRole("button", { name: "Unlock Shield Bash" }));
  expect(player.classMastery.Swordsman).toEqual(["brace", "shieldBash"]);
  expect(player.classMastery.Spellblade).toEqual(["emberWeave"]);
});

test("mastery tree explains locked nodes, prerequisites, conflicts and point costs", () => {
  player.level = 50;
  player.classMastery.Swordsman = ["brace", "bastion", "sundering"];
  const { rerender } = render(<ClassMastery player={player} />);
  expect(screen.getByText("Required by Bastion")).toBeTruthy();
  const executioner = screen.getByRole("button", { name: "Unlock Executioner" }).closest(".mastery-tree-node");
  expect(executioner.textContent).toContain("Bastion");
  expect(executioner.querySelector("button").disabled).toBe(true);
  expect(setPlayer).not.toHaveBeenCalled();
  player = { ...player, level: 1, classMastery: { Swordsman: ["brace"] } };
  rerender(<ClassMastery player={player} />);
  expect(screen.getAllByText("Need 1 more Mastery Point").length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: "Unlock Shield Bash" }).disabled).toBe(true);
});

test("mastery nodes are grouped into prerequisite branches", () => {
  render(<ClassMastery player={player} />);
  const tree = screen.getByRole("region", { name: "Swordsman mastery" }).querySelector(".mastery-tree");
  expect(tree.querySelectorAll(".mastery-tree-row")).toHaveLength(2);
  expect(tree.querySelectorAll(".mastery-tree-row:first-child > .mastery-tree-node")).toHaveLength(3);
  expect(tree.querySelectorAll(".mastery-tree-branch > .mastery-tree-node")).toHaveLength(3);
});

test("free resets remove equipped techniques but preserve inactive mastery, and combat locks editing", () => {
  player.classMastery.Swordsman = ["shieldBash"];
  player.equippedSkills = ["shieldBash"];
  const { rerender } = render(<ClassMastery player={player} />);
  fireEvent.click(screen.getByRole("button", { name: "Reset Swordsman mastery (free)" }));
  expect(player.classMastery.Swordsman).toEqual([]);
  expect(player.classMastery.Spellblade).toEqual(["emberWeave"]);
  expect(player.equippedSkills).toEqual([]);
  rerender(<ClassMastery player={player} inCombat />);
  expect(screen.getByRole("button", { name: "Unlock Brace" }).disabled).toBe(true);
});

test("save failures are visible and do not masquerade as success", () => {
  setPlayer.mockImplementation(() => { throw new Error("Offline save failed"); });
  render(<ClassMastery player={player} />);
  fireEvent.click(screen.getByRole("button", { name: "Unlock Shield Bash" }));
  expect(screen.getByRole("alert").textContent).toBe("Offline save failed");
});

test("resource meters show both caps, last weave type and signature readiness", () => {
  const { rerender } = render(<ClassResource state={{ cls: "Swordsman", resolve: 1 }} />);
  expect(screen.getByRole("status").textContent).toContain("Resolve");
  expect(screen.getByRole("status").textContent).toContain("1/3");
  expect(screen.getByRole("status").textContent).toContain("need 2 Resolve");
  expect(screen.getByRole("status").querySelector(".bar-fill").style.width).toBe("33.33333333333333%");
  rerender(<ClassResource state={{ cls: "Spellblade", weave: 2, lastWeaveType: "magic" }} />);
  expect(screen.getByRole("status").textContent).toContain("Weave");
  expect(screen.getByRole("status").textContent).toContain("2/2");
  expect(screen.getByRole("status").textContent).toContain("Last: magic");
  expect(screen.getByRole("status").textContent).toContain("Ready (Action)");
});

test.each([
  ["Tactician", "advantage", "Advantage"],
  ["Spellcaster", "instability", "Instability"],
  ["Duelist", "tempo", "Tempo"],
  ["Trickster", "tricks", "Tricks"],
  ["Specialist", "adaptation", "Adaptation"],
])("%s exposes editable mastery and its own visible signature state", (cls, resource, label) => {
  player.class = cls;
  const tree = CLASS_TREES[cls];
  const { rerender } = render(<ClassMastery player={player} />);
  const active = within(screen.getByRole("region", { name: `${cls} mastery` }));
  fireEvent.click(active.getByRole("button", { name: `Unlock ${tree.nodes[0].name}` }));
  expect(player.classMastery[cls]).toEqual([tree.nodes[0].id]);
  expect(player.classMastery.Swordsman).toEqual(["brace"]);
  rerender(<ClassResource state={{ cls, [resource]: 2 }} />);
  expect(screen.getByRole("status").textContent).toContain(label);
  expect(screen.getByRole("status").textContent).toContain(`${tree.signature.name}: Ready (Action)`);
});

test("class preview exposes explicit confirmation and cancellation; cancel writes nothing", () => {
  commitWithClassPreview(player, { class: "Spellblade", stats: { intelligence: 12 } });
  const { rerender } = render(<ClassSwitchPreview />);
  expect(screen.getByRole("dialog", { name: "Class change preview" })).toBeTruthy();
  expect(screen.getByText("Swordsman → Spellblade")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(setPlayer).not.toHaveBeenCalled();
  act(() => commitWithClassPreview(player, { class: "Spellblade" }));
  rerender(<ClassSwitchPreview />);
  fireEvent.click(screen.getByRole("button", { name: "Confirm class change" }));
  expect(player.class).toBe("Spellblade");
});

test("class preview traps focus and prevents underlying gameplay keyboard shortcuts", () => {
  commitWithClassPreview(player, { class: "Spellblade" });
  render(<ClassSwitchPreview />);
  const shortcut = jest.fn();
  window.addEventListener("keydown", shortcut);
  const confirm = screen.getByRole("button", { name: "Confirm class change" });
  const cancel = screen.getByRole("button", { name: "Cancel" });
  fireEvent.keyDown(confirm, { key: "1" });
  expect(shortcut).not.toHaveBeenCalled();
  fireEvent.keyDown(confirm, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(cancel);
  fireEvent.keyDown(cancel, { key: "Tab" });
  expect(document.activeElement).toBe(confirm);
  fireEvent.keyDown(confirm, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  window.removeEventListener("keydown", shortcut);
});
