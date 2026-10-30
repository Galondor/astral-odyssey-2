import { addStatus } from "../../combat/statuses";

test("stun effects have a finite power so live combat state can be saved to Firebase", () => {
  const statuses = [];
  addStatus(statuses, "stun");
  expect(statuses).toEqual([{ id: "stun", turns: 1, power: 0, stacks: 1 }]);
  addStatus(statuses, "stun");
  expect(statuses).toEqual([{ id: "stun", turns: 1, power: 0, stacks: 1 }]);
});