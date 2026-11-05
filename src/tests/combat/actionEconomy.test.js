import { freshActions, getActionAvailability, getActionCost, actionCostLabel } from "../../combat/actionEconomy";
jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));

test("quick options use Quick first and can substitute the Action", () => {
  const state = freshActions();
  expect(getActionAvailability(state, "consume", "healthPotion").slot).toBe("quickAvailable");
  state.quickAvailable = false;
  expect(getActionAvailability(state, "skill", "renewal").slot).toBe("actionAvailable");
  expect(actionCostLabel("consume", null, "solo", state)).toContain("Uses Action");
  state.actionAvailable = false;
  expect(getActionAvailability(state, "consume").ok).toBe(false);
});

test("Action cannot use Quick slot and repeated skills are rejected", () => {
  const state = { ...freshActions(), actionAvailable: false, usedSkills: ["renewal"] };
  expect(getActionAvailability(state, "melee").ok).toBe(false);
  expect(getActionAvailability(state, "skill", "renewal").ok).toBe(false);
  expect(getActionAvailability(state, "skill", "provoke").ok).toBe(true);
});

test("group consumables and Quick-classified skills still cost the whole Action", () => {
  expect(getActionCost("consume", "healthPotion", "group")).toBe("action");
  expect(getActionCost("skill", "renewal", "group")).toBe("action");
  expect(getActionCost("skill", "offhandStrike", "group")).toBe("action");
  expect(getActionCost("skill", "offhandStrike")).toBe("quick");
  expect(getActionCost("skill", "provoke")).toBe("quick");
  expect(getActionCost("skill", "fireball")).toBe("action");
});
