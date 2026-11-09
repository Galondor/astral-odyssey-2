import { getPlayer, setPlayer } from "../../character/player";
import { getEnemy } from "../../combat/combat";
import { calculateStats, recalculateStats } from "../../character/stats";
import { CLASS_SKILLS, SHARED_SKILL_KEYS, ULTIMATE_SKILL_KEYS } from "../../character/mastery";
import {
  applySupportSkill, computeSkillCost, equipSkill, getEquippedSkills, getSkillLevel,
  learnClassNode, levelUpSkill, resetClassMastery, SKILLS, skillTooltip,
} from "../../character/skills";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
jest.mock("../../combat/combat", () => ({ getEnemy: jest.fn(() => null) }));

let player;
beforeEach(() => {
  player = {
    class: "Swordsman", level: 26, skillPoints: 10,
    baseStats: { strength: 10, dexterity: 1, intelligence: 1 },
    stats: {}, equipment: {},
    skills: { cleave: 1, fireball: 1, backstab: 1, execute: 1, meteor: 1, dimensionalSlash: 1 },
    equippedSkills: ["cleave", "shieldBash"],
    classMastery: { Swordsman: ["shieldBash"], Spellblade: ["runicGuard"] },
  };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
  getEnemy.mockReturnValue(null);
});

test("pure availability metadata stays aligned with the shared skill catalog", () => {
  expect(SHARED_SKILL_KEYS.slice().sort()).toEqual(Object.keys(SKILLS).filter((key) => !CLASS_SKILLS[key]).sort());
  expect(ULTIMATE_SKILL_KEYS.slice().sort()).toEqual(Object.keys(SKILLS).filter((key) => SKILLS[key].ultimate).sort());
});

test("class signatures are innate, not ordinary equipped skills or skill-point upgrades", () => {
  expect(getSkillLevel(player, "resolveStrike")).toBe(1);
  expect(getSkillLevel(player, "fusionStrike")).toBe(0);
  player.skills.resolveStrike = 99;
  expect(getSkillLevel(player, "resolveStrike")).toBe(1);
  expect(equipSkill("resolveStrike").ok).toBe(false);
  expect(levelUpSkill("resolveStrike").ok).toBe(false);
  expect(levelUpSkill("shieldBash").ok).toBe(false);
  expect(computeSkillCost("resolveStrike", "Swordsman", ["efficiency"])).toBe(0);
  expect(getEquippedSkills({ ...player, equippedSkills: ["resolveStrike", "cleave"] })).toEqual(["cleave"]);
});

test("class techniques require current-class mastery, not learned levels or gemstones", () => {
  expect(getSkillLevel(player, "shieldBash")).toBe(1);
  expect(getSkillLevel(player, "runicGuard")).toBe(0);
  player.skills.runicGuard = 5;
  expect(equipSkill("runicGuard").ok).toBe(false);
  player.classMastery.Swordsman = [];
  player.skills.shieldBash = 5;
  expect(getSkillLevel(player, "shieldBash")).toBe(0);
  expect(getEquippedSkills(player)).toEqual(["cleave"]);
});

test("loadout validation enforces duplicate, learned, class, regular-slot and ultimate restrictions", () => {
  player.equippedSkills = [
    "unknown", "resolveStrike", "runicGuard", "soulSiphon",
    "cleave", "cleave", "shieldBash", "fireball", "backstab", "meteor", "dimensionalSlash",
  ];
  expect(getEquippedSkills(player)).toEqual(["cleave", "shieldBash", "fireball", "meteor"]);
  player.level = 24;
  expect(getEquippedSkills(player)).toEqual(["cleave", "shieldBash", "fireball"]);
  player.level = 70;
  player.passives = ["skillful"];
  player.equippedPassives = ["skillful"];
  expect(getEquippedSkills(player)).toEqual(["cleave", "shieldBash", "fireball", "backstab", "meteor"]);
});

test("invalid saved entries do not occupy equip slots", () => {
  player.equippedSkills = ["unknown", "resolveStrike", "runicGuard", "cleave"];
  expect(equipSkill("fireball")).toEqual({ ok: true });
  expect(player.equippedSkills).toEqual(["cleave", "fireball"]);
});

test("class changes save outgoing skills and restore validated incoming preferences without changing gear", () => {
  const preferred = ["runicGuard", "fireball", "shieldBash", "unknown", "meteor", "dimensionalSlash"];
  player.classLoadouts = { Spellblade: preferred };
  const equipment = { weapon: { name: "Sword", subStats: { strength: 1 } } };
  player.equipment = equipment;
  const patch = recalculateStats(player, { baseStats: { strength: 10, dexterity: 1, intelligence: 10 } });
  expect(patch.class).toBe("Spellblade");
  expect(patch.classLoadouts).toEqual({ Swordsman: ["cleave", "shieldBash"], Spellblade: preferred });
  expect(patch.equippedSkills).toEqual(["runicGuard", "fireball", "meteor"]);
  expect(patch).not.toHaveProperty("equipment");
  expect(player.equipment).toBe(equipment);
  expect(player.classLoadouts).toEqual({ Spellblade: preferred });
  const back = recalculateStats({ ...player, ...patch }, { baseStats: player.baseStats });
  expect(back.class).toBe("Swordsman");
  expect(back.equippedSkills).toEqual(["cleave", "shieldBash"]);
  expect(back.classLoadouts.Spellblade).toEqual(preferred);
});

test("first class visit keeps legal shared skills and missing-save recalculation needs no migration", () => {
  player.equippedSkills = ["cleave", "shieldBash", "meteor"];
  const patch = recalculateStats(player, { baseStats: { strength: 10, dexterity: 1, intelligence: 10 } });
  expect(patch.equippedSkills).toEqual(["cleave", "meteor"]);
  const legacy = { ...player, class: undefined, classMastery: undefined, classLoadouts: undefined };
  expect(recalculateStats(legacy).equippedSkills).toEqual(["cleave", "meteor"]);
});

test("same-class recalculation validates active skills but preserves invalid saved preferences", () => {
  player.classLoadouts = { Swordsman: ["shieldBash", "cleave"] };
  player.classMastery.Swordsman = [];
  const patch = recalculateStats(player);
  expect(patch.equippedSkills).toEqual(["cleave"]);
  expect({ ...player, ...patch }.classLoadouts.Swordsman).toEqual(["shieldBash", "cleave"]);
});

test("mastery never contributes to core or derived persistent stats or class inference", () => {
  const before = calculateStats(player);
  player.classMastery.Swordsman = ["brace", "sundering", "bastion", "shieldBash"];
  expect(calculateStats(player)).toEqual(before);
  expect(recalculateStats(player).class).toBe("Swordsman");
  expect(recalculateStats(player, { bonusStats: { intelligence: 10 } }).class).toBe("Spellblade");
});

test("mastery allocations spend each class budget independently and reset freely only outside combat", () => {
  player.level = 1;
  player.classMastery.Swordsman = [];
  expect(learnClassNode("bastion").ok).toBe(false);
  expect(learnClassNode("brace")).toEqual({ ok: true });
  expect(learnClassNode("shieldBash").ok).toBe(false);
  expect(learnClassNode("brace").ok).toBe(false);
  expect(player.skillPoints).toBe(10);
  getEnemy.mockReturnValue({});
  expect(resetClassMastery().ok).toBe(false);
  expect(learnClassNode("sundering").ok).toBe(false);
  getEnemy.mockReturnValue(null);
  expect(resetClassMastery()).toEqual({ ok: true });
  expect(player.classMastery).toEqual({ Swordsman: [], Spellblade: ["runicGuard"] });
  expect(player.equippedSkills).toEqual(["cleave"]);
});

test("class tooltips describe resources and mastery requirements, and Runic Guard grants its barrier", () => {
  expect(skillTooltip("resolveStrike", 1, null, player)).toMatchObject({ subtitle: expect.stringMatching(/signature/i) });
  expect(skillTooltip("resolveStrike", 1, null, player).description.join(" ")).toMatch(/2 Resolve/);
  expect(skillTooltip("fusionStrike", 0, null, player).description.join(" ")).toMatch(/2 [Ww]eave/);
  expect(skillTooltip("shieldBash", 1, null, player).description.join(" ")).toMatch(/[Mm]astery/);
  expect(SKILLS.runicGuard).toMatchObject({ type: "support", powerCost: 3, target: "self" });
  const caster = { name: "You", stats: { health: 100, maxHealth: 200 }, statuses: [] };
  applySupportSkill("runicGuard", 1, caster, [caster]);
  expect(caster.statuses).toContainEqual(expect.objectContaining({ id: "barrier", power: 30 }));
});

test.each([
  ["Tactician", "feint", { strength: 1, dexterity: 10, intelligence: 1 }],
  ["Spellcaster", "stabilize", { strength: 1, dexterity: 1, intelligence: 10 }],
  ["Duelist", "tempoThrust", { strength: 10, dexterity: 10, intelligence: 1 }],
  ["Trickster", "sabotage", { strength: 1, dexterity: 10, intelligence: 10 }],
  ["Specialist", "fieldMending", { strength: 10, dexterity: 10, intelligence: 10 }],
])("%s restores its own mastery technique and shared skill loadout on automatic class changes", (cls, key, baseStats) => {
  player.classMastery[cls] = [key];
  player.classLoadouts = { [cls]: [key, "fireball"] };
  expect(getSkillLevel(player, key)).toBe(0);
  const patch = recalculateStats(player, { baseStats });
  expect(patch.class).toBe(cls);
  expect(patch.equippedSkills).toEqual([key, "fireball"]);
  const switched = { ...player, ...patch };
  expect(getSkillLevel(switched, key)).toBe(1);
  expect(getEquippedSkills({ ...switched, classMastery: {} })).toEqual(["fireball"]);
  expect(recalculateStats(switched, { baseStats: player.baseStats }).equippedSkills).toEqual(["cleave", "shieldBash"]);
});
