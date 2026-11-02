import { addStatus } from "../../combat/statuses";

afterEach(() => jest.restoreAllMocks());

test.each(["burn", "poison", "bleed", "stun", "weaken", "vulnerable", "doom", "corruption", "temporalRot", "soulLink"])(
  "status resistance blocks %s without adding or refreshing it",
  (id) => {
    jest.spyOn(Math, "random").mockReturnValue(0.699);
    const list = [];
    expect(addStatus(list, id, { resistance: 1 })).toBeNull();
    expect(list).toEqual([]);
    Math.random.mockReturnValue(0.7);
    expect(addStatus(list, id, { resistance: 1, turns: 2 })).not.toBeNull();
    Math.random.mockReturnValue(0.1);
    expect(addStatus(list, id, { resistance: 0.7, turns: 5 })).toBeNull();
    expect(list[0].turns).toBe(2);
  },
);

test("resistance never blocks buffs or consumes randomness for zero resistance", () => {
  const random = jest.spyOn(Math, "random").mockReturnValue(0);
  expect(addStatus([], "fortify", { resistance: 0.7 })).not.toBeNull();
  expect(addStatus([], "burn", { resistance: 0 })).not.toBeNull();
  expect(random).not.toHaveBeenCalled();
  expect(addStatus([{ id: "warded", turns: 2, power: 0, stacks: 1 }], "burn")).toBeNull();
});

test("stun effects have a finite power so live combat state can be saved to Firebase", () => {
  const statuses = [];
  addStatus(statuses, "stun");
  expect(statuses).toEqual([{ id: "stun", turns: 1, power: 0, stacks: 1 }]);
  addStatus(statuses, "stun");
  expect(statuses).toEqual([{ id: "stun", turns: 1, power: 0, stacks: 1 }]);
});