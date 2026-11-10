import {
  CLASS_SKILLS, CLASS_TREES, classMasterySpent, getClassNodes, getClassStateLabel,
  hasClassNode, masteryBudget,
} from "../../character/mastery";

test.each([[undefined, 1], [1, 1], [10, 1], [11, 2], [21, 3], [26, 3]])(
  "level %s has a global mastery budget of %s",
  (level, budget) => expect(masteryBudget({ level })).toBe(budget),
);

test("each saved tree independently spends the global budget without mutating saved preferences", () => {
  const player = {
    level: 21,
    class: "Swordsman",
    classMastery: {
      Swordsman: ["brace", "bastion", "executioner", "unknown", "brace"],
      Spellblade: ["flowingWeave", "continuity"],
    },
  };
  const saved = JSON.stringify(player);
  expect(getClassNodes(player)).toEqual(["brace", "bastion"]);
  expect(classMasterySpent(player)).toBe(3);
  expect(getClassNodes(player, "Spellblade")).toEqual(["flowingWeave", "continuity"]);
  expect(classMasterySpent(player, "Spellblade")).toBe(3);
  expect(hasClassNode(player, "flowingWeave")).toBe(false);
  expect(hasClassNode(player, "brace")).toBe(true);
  expect(hasClassNode(["brace"], "brace")).toBe(true);
  expect(JSON.stringify(player)).toBe(saved);
});

test("allocation validates prerequisites, budget, duplicates and mutually exclusive capstones", () => {
  const player = {
    level: 50, class: "Swordsman",
    classMastery: { Swordsman: ["bastion", "brace", "sundering", "executioner", "shieldBash"] },
  };
  expect(getClassNodes(player)).toEqual(["brace", "sundering", "executioner", "shieldBash"]);
  player.level = 1;
  expect(getClassNodes(player)).toEqual(["brace"]);
  player.classMastery.Swordsman = ["brace", "sundering", "bastion", "executioner"];
  player.level = 50;
  expect(getClassNodes(player)).toEqual(["brace", "sundering", "bastion"]);
});

test("missing and malformed mastery data and foreign nodes have no active nodes", () => {
  expect(getClassNodes({ class: "Swordsman" })).toEqual([]);
  expect(getClassNodes({ class: "Swordsman", classMastery: { Swordsman: {} } })).toEqual([]);
  expect(getClassNodes({ class: "Tactician", classMastery: { Tactician: ["brace"] } })).toEqual([]);
  expect(hasClassNode(null, "brace")).toBe(false);
  expect(Object.keys(CLASS_TREES).sort()).toEqual(["Duelist", "Specialist", "Spellblade", "Spellcaster", "Swordsman", "Tactician", "Trickster"]);
  expect(CLASS_TREES.Swordsman.signature.key).toBe("resolveStrike");
  expect(CLASS_TREES.Spellblade.signature.key).toBe("fusionStrike");
  for (const tree of Object.values(CLASS_TREES)) {
    expect(tree.nodes).toHaveLength(6);
    for (const node of tree.nodes) {
      expect(node).toEqual(expect.objectContaining({
        id: expect.any(String), name: expect.any(String), description: expect.any(String),
        cost: expect.any(Number),
      }));
      expect(node).not.toHaveProperty("stats");
    }
  }
});

test("class state labels report current resources and the previous weave action", () => {
  expect(getClassStateLabel({ cls: "Swordsman", resolve: 2 })).toContain("Resolve 2/3");
  expect(getClassStateLabel({ cls: "Spellblade", weave: 1, lastWeaveType: "magic" })).toContain("Weave 1/2");
  expect(getClassStateLabel({ cls: "Spellblade", weave: 1, lastWeaveType: "magic" })).toMatch(/magic/i);
  expect(getClassStateLabel({ cls: "Tactician" })).toContain("Advantage 0/3");
});

test("pure class skill definitions supply exact signature multipliers and technique effects", () => {
  expect(CLASS_SKILLS.resolveStrike).toMatchObject({
    signature: true, className: "Swordsman", type: "melee", powerCost: 0,
    multiplier: 1.5, perLevel: 0, maxLevel: 1,
  });
  expect(CLASS_SKILLS.fusionStrike).toMatchObject({
    signature: true, className: "Spellblade", type: "melee", powerCost: 0,
    multiplier: 1.8, perLevel: 0, maxLevel: 1,
  });
  const applyStatus = jest.fn();
  CLASS_SKILLS.shieldBash.onHit({ applyStatus });
  expect(applyStatus).toHaveBeenCalledWith("weaken", { turns: 2, power: 0.2 });
  const target = { stats: { maxHealth: 200 } };
  CLASS_SKILLS.runicGuard.support({ target, applyStatus });
  expect(applyStatus).toHaveBeenCalledWith(target, "barrier", expect.objectContaining({ power: 30 }));
});
