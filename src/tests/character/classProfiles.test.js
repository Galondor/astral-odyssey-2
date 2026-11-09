import { createPublicProfile } from "../../character/profiles";
import { getEquippedSkills, getSkillLevel } from "../../character/skills";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../character/player", () => ({ getPlayer: () => null, setPlayer: jest.fn() }));

test("public profiles preserve the mastery needed to display equipped class techniques", () => {
  const player = {
    name: "Hero", level: 25, class: "Spellblade",
    classMastery: { Spellblade: ["runicGuard", "flowingWeave"] },
    equippedSkills: ["runicGuard"], skills: {},
  };
  const profile = createPublicProfile(player);
  expect(profile.classMastery).toEqual(player.classMastery);
  expect(getEquippedSkills(profile)).toEqual(["runicGuard"]);
  expect(getSkillLevel(profile, "runicGuard")).toBe(1);
});
