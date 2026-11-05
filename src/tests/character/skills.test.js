jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
jest.mock("../../combat/combat", () => ({ getEnemy: () => null }));

import { getPlayer, setPlayer } from "../../character/player";
import {
  SKILLS,
  applySupportSkill,
  equipSkill,
  levelUpSkill,
  skillMultiplier,
  skillPointCost,
  skillTooltip,
  computeSkillCost,
  equipPassive,
  learnPassive,
  maxRegularSkills,
  unequipPassive,
} from "../../character/skills";

const actor = (name = "Hero") => ({
  name,
  stats: { health: 0, maxHealth: 1000, magicAttackMin: 100, magicAttackMax: 100 },
  statuses: [],
});

let hero;
beforeEach(() => {
  hero = { level: 25, skillPoints: 10, skills: {}, equippedSkills: [] };
  getPlayer.mockImplementation(() => hero);
  setPlayer.mockImplementation((patch) => { hero = { ...hero, ...patch }; });
});

test("Offhand Strike is a quick melee skill that scales from 25% to 45% damage", () => {
  expect(skillMultiplier("offhandStrike", 1)).toBe(0.25);
  expect(skillMultiplier("offhandStrike", 5)).toBe(0.45);
  expect(skillTooltip("offhandStrike", 1, null, {}).stats).toContainEqual({
    label: "Action cost",
    value: "Quick in solo/PvP; Action in group combat",
  });
  expect(skillTooltip("offhandStrike", 1, null, {}).stats).toContainEqual({
    label: "Power cost",
    value: 2,
  });
});

test.each([
  [1, 240],
  [5, 480],
])("Mending Light level %i uses the increased healing scale", (level, expectedHealing) => {
  const caster = actor();
  const target = actor("Ally");
  target.stats.health = 0;
  const result = applySupportSkill("mendingLight", level, caster, [target]);
  expect(result.healed).toBe(expectedHealing);
});

test.each([
  ["renewal", "regen"],
  ["battleHymn", "empower"],
])("%s lasts 4 rounds at level 5", (skill, status) => {
  const caster = actor();
  const target = actor();
  applySupportSkill(skill, 5, caster, [target]);
  expect(target.statuses.find((entry) => entry.id === status).turns).toBe(4);
});

test("Aegis scales its barrier and lasts 4 rounds at level 5", () => {
  const caster = actor();
  const target = actor();
  applySupportSkill("aegis", 1, caster, [target]);
  expect(target.statuses.find((entry) => entry.id === "barrier")).toMatchObject({
    power: 310,
    turns: 3,
  });

  target.statuses = [];
  applySupportSkill("aegis", 5, caster, [target]);
  expect(target.statuses.find((entry) => entry.id === "barrier")).toMatchObject({
    power: 550,
    turns: 4,
  });
});

test("ultimates unlock at level 25, cap at level 3, and cost two points per level", () => {
  expect(skillPointCost("meteor")).toBe(2);
  expect(skillPointCost("dimensionalSlash")).toBe(2);
  hero.level = 24;
  expect(levelUpSkill("meteor")).toMatchObject({ ok: false, reason: "level" });
  hero.level = 25;
  hero.skillPoints = 1;
  expect(levelUpSkill("meteor")).toMatchObject({ ok: false, reason: "points" });

  hero.skillPoints = 6;
  expect(levelUpSkill("meteor")).toEqual({ ok: true });
  expect(levelUpSkill("meteor")).toEqual({ ok: true });
  expect(levelUpSkill("meteor")).toEqual({ ok: true });
  expect(levelUpSkill("meteor")).toMatchObject({ ok: false, reason: "max" });
  expect(hero.skillPoints).toBe(0);
});

test("one ultimate can be equipped alongside three regular skills, but not a second ultimate", () => {
  hero.skills = { meteor: 1, dimensionalSlash: 1, backstab: 1, cleave: 1, execute: 1 };
  hero.equippedSkills = ["backstab", "cleave", "execute"];
  expect(equipSkill("meteor")).toEqual({ ok: true });
  expect(hero.equippedSkills).toEqual(["backstab", "cleave", "execute", "meteor"]);
  expect(equipSkill("dimensionalSlash")).toMatchObject({ ok: false, reason: "ultimate-full" });
});

test("Meteor and Dimensional Slash are level-3 ultimates with no cooldown", () => {
  expect(skillMultiplier("meteor", 1)).toBe(4);
  expect(skillMultiplier("meteor", 3)).toBe(7);
  expect(skillMultiplier("dimensionalSlash", 1)).toBe(3);
  expect(skillMultiplier("dimensionalSlash", 3)).toBe(5);
  expect(SKILLS.dimensionalSlash.ignoreDefense(3)).toBe(1);
  expect(skillTooltip("dimensionalSlash", 3, null, {}).description.join(" "))
    .toContain("ignoring all enemy defense");
  expect(skillTooltip("meteor", 1, null, {}).stats).not.toContainEqual(
    expect.objectContaining({ label: "Cooldown" }),
  );
});

describe("passives", () => {
  beforeEach(() => {
    hero = { level: 70, skillPoints: 20, skills: { cleave: 1, backstab: 1, fireball: 1, offhandStrike: 1 }, equippedSkills: ["cleave", "backstab", "fireball"], passives: [], equippedPassives: [] };
  });

  test("learning costs 3 points and requires the unlock level", () => {
    hero.level = 14;
    expect(learnPassive("vitalityOverflow").ok).toBe(false);
    hero.level = 15;
    expect(learnPassive("vitalityOverflow").ok).toBe(true);
    expect(hero.skillPoints).toBe(17);
    expect(hero.passives).toEqual(["vitalityOverflow"]);
    expect(learnPassive("vitalityOverflow").ok).toBe(false);
  });

  test("up to 3 passives can be equipped", () => {
    for (const key of ["scavenger", "apexPredator", "protect", "battleTrance"]) learnPassive(key);
    expect(equipPassive("scavenger").ok).toBe(true);
    expect(equipPassive("apexPredator").ok).toBe(true);
    expect(equipPassive("protect").ok).toBe(true);
    expect(equipPassive("battleTrance").ok).toBe(false);
    expect(hero.equippedPassives).toHaveLength(3);
  });

  test("Skillful grants a 4th skill slot and trims back to 3 when removed", () => {
    learnPassive("skillful");
    equipPassive("skillful");
    expect(maxRegularSkills(hero)).toBe(4);
    expect(equipSkill("offhandStrike").ok ?? true).toBeTruthy();
    expect(hero.equippedSkills).toHaveLength(4);
    unequipPassive("skillful");
    expect(maxRegularSkills(hero)).toBe(3);
    expect(hero.equippedSkills).toHaveLength(3);
  });

  test("Efficiency lowers non-ultimate costs by 25%", () => {
    expect(computeSkillCost("fireball", null, ["efficiency"])).toBe(4);
    expect(computeSkillCost("offhandStrike", null, ["efficiency"])).toBe(2);
    expect(computeSkillCost("meteor", null, ["efficiency"])).toBe(computeSkillCost("meteor", null, []));
  });
});
