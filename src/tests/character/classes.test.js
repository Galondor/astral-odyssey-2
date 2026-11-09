import { getClassForStats } from "../../character/classes";

test.each([
  [{ strength: 6, dexterity: 2, intelligence: 2 }, "Swordsman"],
  [{ strength: 2, dexterity: 6, intelligence: 2 }, "Tactician"],
  [{ strength: 2, dexterity: 2, intelligence: 6 }, "Spellcaster"],
])("assigns a single-stat class at 60%% investment: %j", (stats, expected) => {
  expect(getClassForStats(stats)).toBe(expected);
});

test.each([
  [{ strength: 4, dexterity: 4, intelligence: 2 }, "Duelist"],
  [{ strength: 4, dexterity: 2, intelligence: 4 }, "Spellblade"],
  [{ strength: 2, dexterity: 4, intelligence: 4 }, "Trickster"],
])("assigns a dual-stat class when both stats reach 40%%: %j", (stats, expected) => {
  expect(getClassForStats(stats)).toBe(expected);
});

test.each([
  [{ strength: 34, dexterity: 33, intelligence: 33 }, "Specialist"],
  [{ strength: 50, dexterity: 35, intelligence: 15 }, "Specialist"],
  [{ strength: 39, dexterity: 39, intelligence: 22 }, "Specialist"],
])("assigns Specialist to a sufficiently balanced stat spread: %j", (stats, expected) => {
  expect(getClassForStats(stats)).toBe(expected);
});

test("falls back to the highest-stat class when no class threshold qualifies", () => {
  expect(getClassForStats({ strength: 55, dexterity: 25, intelligence: 20 })).toBe("Swordsman");
});
