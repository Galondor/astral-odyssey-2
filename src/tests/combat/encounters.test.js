import { DOUBLE_ELITE_CHANCE, rollEncounter } from "../../combat/encounters";

afterEach(() => jest.restoreAllMocks());

test.each([[0, 1], [0.249999, 1], [0.25, 2], [0.5, 3], [0.75, 4], [0.999999, 4]])(
  "basic roll %s generates %s enemies",
  (roll, count) => {
    jest.spyOn(Math, "random").mockReturnValue(roll);
    const createEnemy = jest.fn((tier) => ({ tier }));
    expect(rollEncounter({ tier: "basic" }, createEnemy)).toHaveLength(count);
    expect(createEnemy).toHaveBeenCalledTimes(count - 1);
    for (const [tier] of createEnemy.mock.calls) expect(tier).toBe("basic");
  },
);

test.each([[0, true], [0.049999, true], [0.05, false], [0.999999, false]])(
  "double elites use the exact 5%% boundary at %s",
  (roll, double) => {
    jest.spyOn(Math, "random").mockReturnValueOnce(roll).mockReturnValue(0.999);
    const roster = rollEncounter({ tier: "elite" }, (tier) => ({ tier }));
    expect(DOUBLE_ELITE_CHANCE).toBe(0.05);
    expect(roster.map((foe) => foe.tier)).toEqual(double
      ? ["elite", "elite"] : ["elite", "basic", "basic", "basic"]);
  },
);

test.each([0, 1, 2, 3])("elite can have %s basic allies", (allies) => {
  jest.spyOn(Math, "random").mockReturnValueOnce(0.5).mockReturnValue(allies / 4);
  expect(rollEncounter({ tier: "elite" }, (tier) => ({ tier })))
    .toEqual([{ tier: "elite" }, ...Array.from({ length: allies }, () => ({ tier: "basic" }))]);
});

test("bosses never roll allies", () => {
  const random = jest.spyOn(Math, "random");
  const createEnemy = jest.fn();
  const boss = { tier: "boss" };
  expect(rollEncounter(boss, createEnemy)).toEqual([boss]);
  expect(random).not.toHaveBeenCalled();
  expect(createEnemy).not.toHaveBeenCalled();
});
