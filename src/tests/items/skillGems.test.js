import { getPlayer, setPlayer } from "../../character/player";
import {
  SKILLS, applySupportSkill, getSkillGemBonus, getSkillLevel, levelUpSkill,
  skillMultiplier,
} from "../../character/skills";
import { respecSkills } from "../../character/progression";
import { getGearBonuses } from "../../character/stats";
import { createGroupMember } from "../../combat/groupCombat";
import {
  canDropSkillGemstone, createSkillGemstone, equipItem, generateRandomGemstone,
  generateRandomSkillGemstone, gemstoneTooltip, isValidGemstone, itemTooltip,
  getGemstoneValue, getGemstoneRemovalCost, removeGemstone, sellGemstone,
  socketGemstone, unequipItem, SKILL_GEM_DROP_CHANCE,
} from "../../items/items";

jest.mock("../../firebase", () => ({ db: {}, auth: {} }));
jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(), setPlayer: jest.fn(),
  getInventoryItemKey: (item) => item?.id || JSON.stringify(item),
}));
jest.mock("../../combat/combat", () => ({ getEnemy: () => null }));

let player;
const gear = (gemstones = []) => ({
  id: "gear", name: "Gem holder", slot: "helmet", rarity: "Legendary",
  socketCount: 2, iLevel: 1, gemstones,
});
beforeEach(() => {
  player = {
    name: "Hero", level: 25, class: "Specialist", astra: 10000, skillPoints: 10,
    baseStats: { strength: 2, dexterity: 2, intelligence: 2 },
    stats: { health: 100, maxHealth: 100, power: 100, maxPower: 100 },
    skills: { meteor: 3, fireball: 1 }, equippedSkills: ["meteor", "fireball"],
    equipment: {}, inventory: [], gemstones: [],
  };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
});
afterEach(() => jest.restoreAllMocks());

test.each([
  ["fireball", 2500, 1500],
  ["meteor", 5000, 3000],
])("%s Skill Gem sells for %i and costs %i to unsocket", (key, value, cost) => {
  const gem = createSkillGemstone(key);
  expect(getGemstoneValue(gem)).toBe(value);
  expect(getGemstoneRemovalCost(gem)).toBe(cost);
  expect(gemstoneTooltip(gem).footer).toBe(`Value: ${value}`);
  player.gemstones = [gem];
  const astra = player.astra;
  expect(sellGemstone(0)).toMatchObject({ ok: true, value });
  expect(player.astra).toBe(astra + value);
  expect(player.gemstones).toEqual([]);

  player.equipment = { helmet: gear([gem]) };
  player.astra = cost - 1;
  const target = { kind: "equipment", slotKey: "helmet" };
  expect(removeGemstone(target)).toEqual({ ok: false, reason: "astra", cost });
  expect(player.equipment.helmet.gemstones).toEqual([gem]);
  expect(player.gemstones).toEqual([]);
  expect(player.astra).toBe(cost - 1);
  player.astra = cost;
  expect(removeGemstone(target)).toMatchObject({ ok: true });
  expect(player.astra).toBe(0);
  expect(player.equipment.helmet.gemstones).toEqual([]);
  expect(player.gemstones).toEqual([gem]);
});

test("ordinary gemstone sale values and unsocket costs remain unchanged", () => {
  for (const [rarity, value, cost] of [
    ["Common", 200, 100], ["Uncommon", 400, 200], ["Rare", 600, 300],
    ["Epic", 800, 400], ["Legendary", 1000, 500], ["Unique", 1200, 600],
  ]) {
    const gem = { type: "ruby", rarity };
    expect(getGemstoneValue(gem)).toBe(value);
    expect(getGemstoneRemovalCost(gem)).toBe(cost);
  }
});

test.each(Object.keys(SKILLS))("%s has an exact +1 gem with the correct rarity", (key) => {
  const gem = createSkillGemstone(key);
  expect(gem).toMatchObject({
    name: `${SKILLS[key].name} Gemstone`, type: "skill", skill: key, value: 1,
    rarity: SKILLS[key].ultimate ? "Unique" : "Legendary",
  });
  expect(isValidGemstone(gem)).toBe(true);
  expect(isValidGemstone({ ...gem, value: 2 })).toBe(false);
  expect(isValidGemstone({ ...gem, rarity: "Rare" })).toBe(false);
  expect(isValidGemstone({ ...gem, skill: "missing" })).toBe(false);
  expect(createSkillGemstone(key).id).not.toBe(gem.id);
});

test.each([[0, true], [0.099999, true], [0.1, false], [0.999999, false]])(
  "rarity is rolled first with a 10%% Unique boundary (%s)", (roll, ultimate) => {
    const random = jest.spyOn(Math, "random").mockReturnValueOnce(roll).mockReturnValue(0.999999);
    const gem = generateRandomSkillGemstone();
    expect(!!SKILLS[gem.skill].ultimate).toBe(ultimate);
    expect(gem.rarity).toBe(ultimate ? "Unique" : "Legendary");
    expect(random).toHaveBeenCalledTimes(2);
  },
);

test("ordinary random gemstones never generate Skill Gems", () => {
  jest.spyOn(Math, "random").mockReturnValue(0);
  expect(generateRandomGemstone().type).toBe("ruby");
  expect(SKILL_GEM_DROP_CHANCE).toBe(0.01);
  Math.random.mockRestore();
  expect(() => createSkillGemstone("missing")).toThrow("Unknown Skill Gem skill.");
});

test.each([
  [{ tier: "boss", dungeon: true, level: 10 }, true],
  [{ tier: "boss", dungeon: true, labyrinth: true }, true],
  [{ tier: "elite", dungeon: true, labyrinth: true }, false],
  [{ tier: "basic", dungeon: true }, false],
  [{ tier: "boss", region: "Forest", level: 49 }, false],
  [{ tier: "boss", region: "Forest", level: 50 }, true],
  [{ tier: "elite", region: "Forest", level: 100 }, false],
  [{ tier: "boss", dungeon: true, colosseum: true }, false],
  [{ tier: "boss", region: "Forest", level: 100, worldBossCycle: "cycle" }, false],
  [{ tier: "boss", level: 100 }, false],
])("only difficult-content bosses qualify: %j", (enemy, allowed) => {
  expect(!!canDropSkillGemstone(enemy)).toBe(allowed);
});

test("five Meteor Gems stack above the ultimate cap, ignoring bags and two-handed placeholders", () => {
  const gems = Array.from({ length: 5 }, () => createSkillGemstone("meteor"));
  player.equipment = {
    mainHand: gear(gems.slice(0, 2)), helmet: gear(gems.slice(2, 4)),
    chestplate: { gemstone: gems[4] },
    offHand: { twoHandedOf: "mainHand", gemstones: gems },
  };
  player.inventory = [gear(gems)];
  player.gemstones = gems;
  expect(getSkillGemBonus(player, "meteor")).toBe(5);
  expect(getSkillLevel(player, "meteor")).toBe(8);
  expect(skillMultiplier("meteor", getSkillLevel(player, "meteor"))).toBe(14.5);
  expect(getGearBonuses(player.equipment)).toEqual({});
  expect(createGroupMember("hero", player).skills.meteor).toBe(8);
  expect(player.skills.meteor).toBe(3);
  player.skills.meteor = 0;
  expect(getSkillLevel(player, "meteor")).toBe(0);
});

test("socketing, equipping, unsocketing and unequipping recompute bonuses without changing learned levels", () => {
  const gem = createSkillGemstone("fireball");
  player.inventory = [gear()];
  player.gemstones = [gem];
  expect(socketGemstone(gem.id, { kind: "inventory", index: 0 }).ok).toBe(true);
  expect(getSkillLevel(player, "fireball")).toBe(1);
  expect(equipItem(0).ok).toBe(true);
  expect(getSkillLevel(player, "fireball")).toBe(2);
  expect(removeGemstone({ kind: "equipment", slotKey: "helmet" }, 0).ok).toBe(true);
  expect(getSkillLevel(player, "fireball")).toBe(1);
  expect(player.gemstones).toEqual([gem]);
  expect(socketGemstone(gem.id, { kind: "equipment", slotKey: "helmet" }).ok).toBe(true);
  expect(getSkillLevel(player, "fireball")).toBe(2);
  expect(unequipItem("helmet").ok).toBe(true);
  expect(getSkillLevel(player, "fireball")).toBe(1);
  expect(player.skills.fireball).toBe(1);
});

test("skill-point upgrades and respecs use learned levels, never gem levels", () => {
  player.skills = { fireball: 4 };
  player.equipment = { helmet: gear([createSkillGemstone("fireball"), createSkillGemstone("fireball")]) };
  expect(getSkillLevel(player, "fireball")).toBe(6);
  expect(levelUpSkill("fireball")).toEqual({ ok: true });
  expect(player.skills.fireball).toBe(5);
  expect(getSkillLevel(player, "fireball")).toBe(7);
  expect(levelUpSkill("fireball")).toMatchObject({ ok: false, reason: "max" });
  respecSkills();
  expect(player.skillPoints).toBe(14);
  expect(getSkillLevel(player, "fireball")).toBe(0);
  expect(player.equipment.helmet.gemstones).toHaveLength(2);
});

test.each(Object.keys(SKILLS).filter((key) => SKILLS[key].type !== "support"))(
  "%s keeps increasing damage after level 5", (key) => {
    expect(skillMultiplier(key, 6)).toBeGreaterThan(skillMultiplier(key, 5));
    expect(skillMultiplier(key, 15)).toBeGreaterThan(skillMultiplier(key, 6));
  },
);

test.each(Object.keys(SKILLS).filter((key) => SKILLS[key].type === "support"))(
  "%s keeps increasing its healing or status power after level 5", (key) => {
    const strength = (level) => {
      const caster = { name: "Hero", stats: { health: 0, maxHealth: 10000, magicAttackMin: 100, magicAttackMax: 100 }, statuses: [] };
      const result = applySupportSkill(key, level, caster, [caster]);
      return result.healed + caster.statuses.reduce((sum, status) => sum + (status.power || 0), 0);
    };
    expect(strength(6)).toBeGreaterThan(strength(5));
    expect(strength(10)).toBeGreaterThan(strength(6));
  },
);

test("gem and gear tooltips describe skill levels rather than undefined stats", () => {
  const gem = createSkillGemstone("meteor");
  expect(gemstoneTooltip(gem)).toMatchObject({
    title: "Meteor Gemstone", subtitle: "Unique Skill Gemstone",
    stats: [expect.objectContaining({ label: "Meteor skill level", value: "+1" })],
  });
  expect(itemTooltip(gear([gem])).stats).toContainEqual(
    expect.objectContaining({ label: "Meteor skill level", value: "+1" }),
  );
});
