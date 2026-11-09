import {
  addProfessionExp,
  getExpToNextLevel,
  getProfession,
  getProfessionMythicChance,
  getReagentSlots,
  getToolProfessionLevel,
  MAX_PROFESSION_LEVEL,
  MYTHIC_CHANCE_CAP,
} from "../../character/professions";
import { getGearBonuses } from "../../character/stats";
import { findAbility } from "../../combat/abilities";
import { analyzeCraft, craftItem, getCraftingBook, getKnownProperties } from "../../items/crafting";
import { BLUEPRINTS, getBlueprints } from "../../items/craftingBlueprints";
import { CRAFTING_MATERIALS, findReactions, REACTIONS } from "../../items/craftingMaterials";
import { CRAFTED_UNIQUES } from "../../items/craftingUniques";
import { CRAFTING_STATS, TOOL_SUBSTATS } from "../../items/craftingStats";
import { getItemGearScore } from "../../items/gearScore";
import {
  applyHolofoilBonuses,
  canEquip,
  createMythicItem,
  getEquipLevel,
  getCustomSubStatTiers,
  getItemStatTierCap,
  getSubStatPool,
  getSubStatTier,
  itemTooltip,
  restrictItemSubStats,
  SUBSTAT_NAMES,
} from "../../items/items";
import { MATERIALS } from "../../items/materials";
import { getItemSocketCount } from "../../items/sockets";
import { createToolItem, getToolBonuses } from "../../items/tools";
import { getItemUpgradeStatus } from "../../items/upgrades";
import { canApplyRune } from "../../items/runes";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(() => null), setPlayer: jest.fn() }));
jest.mock("../../combat/combat", () => ({ getEnemy: jest.fn(() => null) }));

afterEach(() => jest.restoreAllMocks());

const professions = (weaponry = 1, armor = 1, jewelry = 1) => ({
  weaponry: { level: weaponry, exp: 0, crafts: 0 },
  armor: { level: armor, exp: 0, crafts: 0 },
  jewelry: { level: jewelry, exp: 0, crafts: 0 },
});

const makePlayer = (changes = {}) => ({
  level: 10,
  astra: 1000000,
  inventory: [],
  equipment: {},
  materials: {},
  professions: professions(),
  ...changes,
});

describe("professions", () => {
  test("default to level 1 and cap at level 50 after roughly 1,200 on-level crafts", () => {
    expect(getProfession({}, "weaponry")).toEqual({ id: "weaponry", level: 1, exp: 0, crafts: 0 });
    let total = 0;
    for (let level = 1; level < MAX_PROFESSION_LEVEL; level++) total += getExpToNextLevel(level);
    let crafts = 0;
    let player = {};
    while (getProfession(player, "armor").level < MAX_PROFESSION_LEVEL) {
      const level = getProfession(player, "armor").level;
      const tier = Math.min(7, 1 + Math.floor((level - 1) / 7));
      const gained = addProfessionExp(player, "armor", 20 * [1, 1.5, 2.2, 3.2, 4.6, 6.5, 9][tier - 1]);
      player = { professions: gained.professions };
      crafts++;
    }
    expect(total).toBeGreaterThan(0);
    expect(crafts).toBeGreaterThan(1000);
    expect(crafts).toBeLessThan(1500);
    expect(getProfession(player, "armor")).toMatchObject({ level: 50, exp: 0 });
  });

  test("granted profession experience does not count as a craft", () => {
    const result = addProfessionExp({ professions: { weaponry: { crafts: 4 } } }, "weaponry", 200, { countCraft: false });
    expect(result.professions.weaponry).toEqual({ level: 2, exp: 20, crafts: 4 });
  });

  test("unlock reagent slots and keep the Mythic chance virtually zero before level 30", () => {
    expect([1, 5, 15, 30, 45].map(getReagentSlots)).toEqual([1, 2, 3, 4, 5]);
    expect(getProfessionMythicChance(1)).toBeLessThanOrEqual(0.0001);
    expect(getProfessionMythicChance(29)).toBeLessThanOrEqual(0.0001);
    expect(getProfessionMythicChance(50)).toBeCloseTo(0.015, 5);
  });

  test("Hammers use the higher of Weaponry and Armor; Precision Tools use Jewelry", () => {
    const player = { professions: professions(12, 30, 7) };
    expect(getToolProfessionLevel(player, "hammer")).toBe(30);
    expect(getToolProfessionLevel(player, "precisionTools")).toBe(7);
  });
});

describe("material catalog", () => {
  test("covers every crafting material with valid properties and only known materials", () => {
    for (const [key, material] of Object.entries(CRAFTING_MATERIALS)) {
      expect(MATERIALS[key]).toBeTruthy();
      expect(material.tier).toBeGreaterThanOrEqual(1);
      expect(material.tier).toBeLessThanOrEqual(7);
      expect(material.properties.length).toBeGreaterThan(0);
    }
    const uncatalogued = Object.keys(MATERIALS).filter((key) => !CRAFTING_MATERIALS[key]);
    expect(uncatalogued.sort()).toEqual(["relicFragments", "sealedRelic"]);
  });

  test("every region tier has a full set of base families", () => {
    for (let tier = 1; tier <= 7; tier++) {
      for (const family of ["ore", "hide", "cloth", "wood", "precious", "gem"]) {
        expect(Object.values(CRAFTING_MATERIALS).some((m) => m.tier === tier && m.family === family)).toBe(true);
      }
    }
  });

  test("reactions need a different material for each selector", () => {
    expect(findReactions(["cinderite_ore", "citadel_rime_shard"])).toEqual(["thermal_shock"]);
    expect(findReactions(["cinderite_ore", "ember_core"])).toContain("molten_core");
    expect(findReactions(["obsidian_shard"])).toEqual([]);
    for (const reaction of Object.values(REACTIONS)) expect(reaction.needs.length).toBeGreaterThan(0);
  });
});

describe("blueprints", () => {
  test("each profession has gear, its tool, and three crafting-only Unique recipes", () => {
    expect(getBlueprints("weaponry").some((b) => b.kind === "tool" && b.slot === "hammer")).toBe(true);
    expect(getBlueprints("jewelry").some((b) => b.kind === "tool" && b.slot === "precisionTools")).toBe(true);
    expect(getBlueprints("armor").some((b) => b.kind === "tool")).toBe(false);
    for (const profession of ["weaponry", "armor", "jewelry"]) {
      expect(getBlueprints(profession).filter((b) => b.kind === "unique" && !b.requiresExtraction).map((b) => b.level)).toEqual([20, 35, 50]);
    }
    for (const unique of Object.values(CRAFTED_UNIQUES)) expect(findAbility({ name: unique.ability })?.effects).toBeTruthy();
  });

  test.each([
    ["hammerhead", "ore"],
    ["haft", "wood"],
  ])("%s recipes use the matching base material family and three progression tiers", (type, family) => {
    for (const [index, suffix] of ["i", "ii", "iii"].entries()) {
      const blueprint = BLUEPRINTS[`part:${type}_${suffix}`];
      expect(blueprint).toMatchObject({
        kind: "part",
        profession: "weaponry",
        families: [family],
        level: [5, 20, 35][index],
        minTier: [1, 3, 5][index],
        baseQty: [3, 5, 7][index],
        output: `${type}_${suffix}`,
        name: MATERIALS[`${type}_${suffix}`].name,
      });
    }
  });

  test("crafted unique abilities use the updated effects", () => {
    const abilityEffects = (id) => findAbility({ name: CRAFTED_UNIQUES[id].ability }).effects;
    expect(abilityEffects("starforgedGreatblade")).toEqual({ damageBonus: 0.2, pierce: 0.3 });
    expect(abilityEffects("aegisOfTheUnbroken")).toEqual({ damageReduction: 0.1 });
    expect(abilityEffects("brinelightPendant")).toEqual({ astraBonus: 0.2, surge: 0.3 });
    expect(abilityEffects("sovereignsSignet")).toEqual({ damageBonus: 0.15, lifesteal: 0.06 });
    expect(abilityEffects("tidecallerBulwark")).toEqual({ damageReduction: 0.3 });
  });
});

describe("crafting", () => {
  test.each([0, 1, 2, 3, 4, 5])("gear rolls player level plus %i independently of material tier", (bonus) => {
    jest.spyOn(Math, "random").mockReturnValue(0.9).mockReturnValueOnce((bonus + 0.5) / 6);
    const player = makePlayer({ level: 100, materials: { metal_scraps: 5 } });
    const selection = { blueprintId: "weapon:Sword", base: "metal_scraps" };
    expect(analyzeCraft(player, selection)).toMatchObject({ iLevel: 100, maxILevel: 105 });
    expect(craftItem(player, selection).item.iLevel).toBe(100 + bonus);
  });

  test.each([[98, 103], [100, 105], [105, 105]])("gear respects the player bonus and level-105 cap for a level %i player", (level, expected) => {
    jest.spyOn(Math, "random").mockReturnValue(0.99);
    const player = makePlayer({ level, materials: { metal_scraps: 5 } });
    expect(craftItem(player, { blueprintId: "weapon:Sword", base: "metal_scraps" }).item.iLevel).toBe(expected);
  });

  test("high-tier materials do not raise gear above the player's level range", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.99);
    const player = makePlayer({ professions: professions(50), materials: { warsteel_ingot: 5 } });
    expect(craftItem(player, { blueprintId: "weapon:Sword", base: "warsteel_ingot" }).item.iLevel).toBe(15);
  });

  test("Mythic gear uses the same bonus item-level roll", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.9).mockReturnValueOnce(0.99).mockReturnValueOnce(0);
    const player = makePlayer({ level: 100, materials: { metal_scraps: 5 } });
    expect(craftItem(player, { blueprintId: "weapon:Sword", base: "metal_scraps" }).item)
      .toMatchObject({ rarity: "Mythic", iLevel: 105 });
  });

  test("crafted Unique gear can roll item level 105", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.9);
    const player = makePlayer({
      level: 100, professions: professions(20),
      materials: { cinderite_ore: 5, infernal_heart: 1, ember_core: 5, forge_tempered_alloy: 2 },
    });
    expect(craftItem(player, { blueprintId: "unique:emberwroughtBlade", base: "cinderite_ore" }).item)
      .toMatchObject({ rarity: "Unique", iLevel: 105 });
  });

  test.each([["ember_core", 43], ["forge_slagheart", 45]])("material %s level bonuses raise the minimum without exceeding player level plus five", (reagent, minimum) => {
    jest.spyOn(Math, "random").mockReturnValue(0.99);
    const player = makePlayer({
      level: 40, professions: professions(30),
      materials: { metal_scraps: 5, [reagent]: 1 },
    });
    const selection = { blueprintId: "weapon:Sword", base: "metal_scraps", reagents: [reagent] };
    expect(analyzeCraft(player, selection)).toMatchObject({ iLevel: minimum, maxILevel: 45 });
    expect(craftItem(player, selection).item.iLevel).toBe(45);
  });

  test("crafts gear, spends materials and astra, gains exp and always reveals a first property", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    const player = makePlayer({ materials: { metal_scraps: 5, slime_gel: 2 } });
    const result = craftItem(player, { blueprintId: "weapon:Sword", base: "metal_scraps", reagents: ["slime_gel"] });
    expect(result.ok).toBe(true);
    expect(result.item).toMatchObject({ slot: "weapon", crafted: true, craftedBy: "weaponry" });
    expect(result.patch.materials).toEqual({ metal_scraps: 2, slime_gel: 1 });
    expect(result.patch.astra).toBeLessThan(player.astra);
    expect(result.patch.professions.weaponry.exp).toBeGreaterThan(0);
    expect(result.patch.professions.weaponry.crafts).toBe(1);
    expect(result.patch.craftingBook.materials).toEqual({ metal_scraps: 1, slime_gel: 1 });
    expect(getKnownProperties(getCraftingBook({ craftingBook: result.patch.craftingBook }), "slime_gel")).toHaveLength(1);
  });

  test("rejects locked blueprints, wrong families, missing slots, and missing materials", () => {
    const player = makePlayer({ materials: { metal_scraps: 10, leather: 10, slime_gel: 5, wolf_pelt: 5 } });
    expect(analyzeCraft(player, { blueprintId: "weapon:Greatsword", base: "metal_scraps" }).ok).toBe(false);
    expect(analyzeCraft(player, { blueprintId: "weapon:Sword", base: "leather" }).message).toMatch(/ore/);
    expect(analyzeCraft(player, { blueprintId: "weapon:Sword", base: "metal_scraps", reagents: ["slime_gel", "wolf_pelt"] }).message).toMatch(/1 reagent slot/);
    expect(analyzeCraft(player, { blueprintId: "weapon:Sword", base: "metal_scraps", reagents: ["leather"] }).ok).toBe(false);
    expect(analyzeCraft(player, { blueprintId: "weapon:Sword", base: "bog_iron" }).ok).toBe(false);
    expect(analyzeCraft(makePlayer(), { blueprintId: "weapon:Sword", base: "metal_scraps" }).message).toMatch(/You need more/);
  });

  test("material properties guarantee substats and rarity floors; reactions apply and are discovered", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.99);
    const player = makePlayer({
      level: 30,
      professions: professions(29),
      materials: { cinderite_ore: 10, infernal_heart: 1, citadel_rime_shard: 1 },
    });
    const selection = { blueprintId: "weapon:Sword", base: "cinderite_ore", reagents: ["infernal_heart", "citadel_rime_shard"] };
    const ok = analyzeCraft(player, selection);
    expect(ok.ok).toBe(true);
    expect(ok.reactions).toEqual(expect.arrayContaining(["thermal_shock", "molten_core"]));
    expect(ok.rarityOdds[0].chance).toBe(0);
    expect(ok.rarityOdds[1].chance).toBe(0);
    expect(ok.guaranteed).toEqual(expect.arrayContaining(["attackMax", "criticalResistance"]));
    expect(ok.minTier).toBeGreaterThanOrEqual(3);
    const result = craftItem(player, selection);
    expect(result.item.subStats).toHaveProperty("attackMax");
    expect(Object.values(result.item.subTiers).every((tier) => tier >= 3)).toBe(true);
    expect(result.patch.craftingBook.reactions).toEqual(expect.arrayContaining(["thermal_shock"]));
    expect(result.newReactions).toEqual(expect.arrayContaining(["thermal_shock"]));
  });

  test("stabilizers suppress harmful reactions and negative effects", () => {
    const player = makePlayer({ professions: professions(30), materials: { cinderite_ore: 10, venom_sac: 1, binding_resin: 1 } });
    const unstable = analyzeCraft(player, { blueprintId: "weapon:Sword", base: "cinderite_ore", reagents: ["venom_sac"] });
    expect(unstable.reactions).toContain("volatile_mixture");
    expect(unstable.conditionShift).toBeLessThan(0);
    const stable = analyzeCraft(player, { blueprintId: "weapon:Sword", base: "cinderite_ore", reagents: ["venom_sac", "binding_resin"] });
    expect(stable.reactions).not.toContain("volatile_mixture");
    expect(stable.suppressed).toContain("volatile_mixture");
    expect(stable.conditionShift).toBe(0);
  });

  test("ability and main stat effects only take hold after Infusion and Attunement", () => {
    const materials = { copper_nugget: 10, duskstone: 2, bloodstone: 2 };
    const early = analyzeCraft(makePlayer({ professions: professions(1, 1, 10), materials }), { blueprintId: "ring:Band", base: "copper_nugget", reagents: ["duskstone"] });
    expect(early.mainStat).toBe("dexterity");
    expect(early.inactive.some((entry) => entry.effect.type === "mainStat")).toBe(true);
    const signet = analyzeCraft(makePlayer({ professions: professions(1, 1, 45), materials }), { blueprintId: "ring:Signet", base: "copper_nugget", reagents: ["duskstone", "bloodstone"] });
    expect(signet.mainStat).toBe("dexterity");
    expect(signet.abilityChance).toBeGreaterThan(0);
    expect(signet.mainBoost).toBe(5);
  });

  test("Mythic chance is capped at 5% even with maxed tools and stacked shards", () => {
    const hammer = createToolItem({ slot: "hammer", iLevel: 50, rarity: "Legendary", condition: "Perfect", minTier: 7, guaranteed: ["mythicChance", "craftQuality"] });
    expect(hammer.subStats.mythicChance).toBeGreaterThanOrEqual(0.0225);
    expect(hammer.subStats.mythicChance).toBeLessThanOrEqual(0.025);
    const player = makePlayer({
      level: 100,
      professions: professions(50),
      equipment: { hammer },
      materials: { warsteel_ingot: 20, primordial_spark: 5, mythos_fragment: 5 },
    });
    const analysis = analyzeCraft(player, {
      blueprintId: "weapon:Sword", base: "warsteel_ingot",
      reagents: ["primordial_spark", "primordial_spark", "mythos_fragment", "mythos_fragment", "primordial_spark"],
    });
    expect(analysis.ok).toBe(true);
    expect(analysis.mythicChance).toBeLessThanOrEqual(MYTHIC_CHANCE_CAP);
    expect(analysis.mythicChance).toBeGreaterThan(0.045);
    const fresh = analyzeCraft(makePlayer({ materials: { metal_scraps: 5 } }), { blueprintId: "weapon:Sword", base: "metal_scraps" });
    expect(fresh.mythicChance).toBeLessThanOrEqual(0.0001);
  });

  test("a successful Mythic roll produces a T8-main-stat Holofoil Mythic", () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    const player = makePlayer({ level: 100, professions: professions(50), materials: { warsteel_ingot: 20 } });
    const result = craftItem(player, { blueprintId: "weapon:Sword", base: "warsteel_ingot" });
    expect(result.item.rarity).toBe("Mythic");
    expect(result.item.holofoil).toHaveLength(2);
    expect(result.item.mainStat.tier).toBe(8);
    expect(Object.keys(result.item.subStats)).toHaveLength(6);
    expect(Object.values(result.item.subTiers).every((tier) => tier === 8)).toBe(true);
    expect(result.item.mythicSubStat.tier).toBe(8);
  });

  test("crafts Unique recipes with their extra materials", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.9);
    const player = makePlayer({
      level: 40,
      professions: professions(20),
      materials: { cinderite_ore: 5, infernal_heart: 1, ember_core: 5, forge_tempered_alloy: 2 },
    });
    const result = craftItem(player, { blueprintId: "unique:emberwroughtBlade", base: "cinderite_ore" });
    expect(result.ok).toBe(true);
    expect(result.item).toMatchObject({ rarity: "Unique", unique: "emberwroughtBlade", iLevel: 45, ability: { name: "Forgefire" } });
    expect(result.patch.materials).toEqual({});
    expect(analyzeCraft(player, { blueprintId: "unique:emberwroughtBlade", base: "bog_iron" }).ok).toBe(false);
  });

  test("tools need both parts, cap their item level by parts and profession, and roll crafting stats", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    const materials = { metal_scraps: 6, hammerhead_i: 1, haft_i: 1 };
    const player = makePlayer({ professions: professions(30), materials });
    expect(analyzeCraft(player, { blueprintId: "tool:hammer", base: "metal_scraps", reagents: ["hammerhead_i"] }).message).toMatch(/haft/);
    const result = craftItem(player, { blueprintId: "tool:hammer", base: "metal_scraps", reagents: ["hammerhead_i", "haft_i"] });
    expect(result.ok).toBe(true);
    expect(result.item).toMatchObject({ slot: "hammer", iLevel: 11, socketCount: 0, crafted: true });
    expect(result.item.subStats).toHaveProperty("craftQuality");
    expect(result.item.subStats).toHaveProperty("materialPreservation");
  });

  test.each([
    ["hammerhead_i", "metal_scraps", 5, 3],
    ["hammerhead_ii", "cinderite_ore", 20, 5],
    ["hammerhead_iii", "rimesteel_ore", 35, 7],
    ["haft_i", "meadow_oak", 5, 3],
    ["haft_ii", "charred_ironwood", 20, 5],
    ["haft_iii", "frostpine_log", 35, 7],
  ])("crafts %s from the appropriate base material", (output, base, level, baseCost) => {
    const player = makePlayer({
      professions: professions(level),
      materials: { [base]: 10 },
    });
    const result = craftItem(player, { blueprintId: `part:${output}`, base });

    expect(result.ok).toBe(true);
    expect(result.material).toBe(output);
    expect(result.patch.materials[output]).toBe(1);
    expect(result.patch.materials[base]).toBe(10 - baseCost);
  });

  test.each([
    ["pickaxe", "i", 15, 5, 5],
    ["axe", "i", 15, 5, 5],
    ["pickaxe", "i", 50, 50, 20],
    ["axe", "ii", 50, 50, 35],
    ["pickaxe", "iii", 50, 50, 50],
    ["axe", "iii", 50, 12, 12],
    ["hammer", "i", 5, 30, 20],
    ["hammer", "iii", 50, 10, 50],
    ["precisionTools", "i", 12, 50, 12],
    ["precisionTools", "iii", 50, 5, 50],
  ])("%s with tier %s parts rolls every level from 1 to its equip/part cap", (slot, tier, craftingLevel, equipLevel, cap) => {
    const parts = slot === "precisionTools"
      ? [`lens_${tier}`, `calipers_${tier}`]
      : [`${slot === "hammer" ? "hammerhead" : `${slot}head`}_${tier}`, `haft_${tier}`];
    const base = slot === "precisionTools" ? "copper_nugget" : "metal_scraps";
    const player = makePlayer({
      professions: professions(craftingLevel, equipLevel, craftingLevel),
      gathering: { mining: { level: equipLevel }, logging: { level: equipLevel } },
      materials: { [base]: 100, ...Object.fromEntries(parts.map((key) => [key, 1])) },
    });
    const selection = { blueprintId: `tool:${slot}`, base, reagents: parts };
    expect(analyzeCraft(player, selection)).toMatchObject({ ok: true, iLevel: 1, maxILevel: cap });
    const random = jest.spyOn(Math, "random").mockReturnValue(0.5);
    for (let level = 1; level <= cap; level++) {
      random.mockReturnValueOnce((level - 0.5) / cap);
      const result = craftItem(player, selection);
      expect(result.ok).toBe(true);
      expect(result.item.iLevel).toBe(level);
      expect(canEquip(result.item, player.level, player)).toBe(true);
    }
    random.mockReturnValueOnce(0);
    expect(craftItem(player, selection).item.iLevel).toBe(1);
    random.mockReturnValueOnce(0.999999);
    expect(craftItem(player, selection).item.iLevel).toBe(cap);
  });

  test("gathering tools can still be crafted before the gathering equip unlock", () => {
    const player = makePlayer({
      professions: professions(5),
      materials: { metal_scraps: 3, pickaxehead_i: 1, haft_i: 1 },
    });
    const selection = { blueprintId: "tool:pickaxe", base: "metal_scraps", reagents: ["pickaxehead_i", "haft_i"] };
    expect(analyzeCraft(player, selection)).toMatchObject({ ok: true, iLevel: 1, maxILevel: 1 });
    const result = craftItem(player, selection);
    expect(result.item.iLevel).toBe(1);
    expect(canEquip(result.item, player.level, player)).toBe(false);
  });
});

describe("tools", () => {
  test("never have sockets, even when Holofoil, and add no combat stats or gear score", () => {
    const tool = createToolItem({ slot: "precisionTools", iLevel: 30, rarity: "Legendary", condition: "Perfect", holofoil: true });
    expect(tool.holofoil).toHaveLength(2);
    expect(getItemSocketCount(tool)).toBe(0);
    expect(Object.values(tool.subTiers).every((tier) => tier >= 5)).toBe(true);
    expect(getGearBonuses({ precisionTools: tool })).toEqual({});
    expect(getItemGearScore(tool)).toBe(0);
    for (const stat of Object.keys(tool.subStats)) expect(TOOL_SUBSTATS).toContain(stat);
  });

  test("equip level follows the matching profession", () => {
    const hammer = createToolItem({ slot: "hammer", iLevel: 25 });
    const tools = createToolItem({ slot: "precisionTools", iLevel: 25 });
    const player = { level: 1, professions: professions(10, 25, 24) };
    expect(getEquipLevel(hammer)).toBe(25);
    expect(canEquip(hammer, 100, player)).toBe(true);
    expect(canEquip(tools, 100, player)).toBe(false);
    expect(itemTooltip(hammer).subtitle).toContain("Requires Weaponry or Armor 25");
  });

  test("only apply to their own professions, cap upgrades at item level 50, and survive mail restriction", () => {
    const hammer = createToolItem({ slot: "hammer", iLevel: 50, rarity: "Epic", guaranteed: ["craftQuality"] });
    const player = { professions: professions(50), equipment: { hammer } };
    expect(getToolBonuses(player, "weaponry").craftQuality).toBeGreaterThan(0);
    expect(getToolBonuses(player, "armor").tool).toBe(hammer);
    expect(getToolBonuses(player, "jewelry").tool).toBeNull();
    expect(getItemUpgradeStatus({ ...hammer, upgrades: 0 })).toMatchObject({ ok: false, message: "Maximum item level reached (50)." });
    expect(restrictItemSubStats(hammer).subStats).toEqual(hammer.subStats);
    expect(Object.keys(CRAFTING_STATS)).toContain("craftsmanship");
  });

  test("Prismatic-style Holofoil on tools raises stats to T5+ but never adds sockets; runes can't touch tools", () => {
    const plain = createToolItem({ slot: "hammer", iLevel: 40, rarity: "Legendary", condition: "Average" });
    const foiled = applyHolofoilBonuses({ ...plain, holofoil: ["#111111", "#222222"], holofoilEffect: "glow" });
    expect(foiled.holofoilBonusVersion).toBe(1);
    expect(foiled.price).toBe(plain.price * 2);
    expect(Object.values(foiled.subTiers).every((tier) => tier >= 5)).toBe(true);
    expect(getItemSocketCount(foiled)).toBe(0);
    expect(applyHolofoilBonuses(foiled)).toBe(foiled);
    expect(canApplyRune(foiled)).toBe(false);
  });
});

describe("Mythic items", () => {
  test("guarantee T7 substats with 50% T8 rolls, T8 main stats, and a wildcard substat", () => {
    const tierRolls = [];
    for (let i = 0; i < 100; i++) {
      const item = createMythicItem({ slot: "boots", iLevel: 80 });
      expect(item.rarity).toBe("Mythic");
      expect(item.holofoil).toHaveLength(2);
      expect(item.mainStat.tier).toBe(8);
      expect(itemTooltip(item).stats[0].tier).toBe("T8");
      expect(Object.values(item.subTiers).every((tier) => tier === 7 || tier === 8)).toBe(true);
      expect(SUBSTAT_NAMES).toContain(item.mythicSubStat.stat);
      expect([7, 8]).toContain(item.mythicSubStat.tier);
      expect(getSubStatTier(
        item.mythicSubStat.stat,
        item.mythicSubStat.value,
        item.iLevel,
        item.twoHanded,
        getItemStatTierCap(item),
      )).toBe(item.mythicSubStat.tier);
      for (const [stat, value] of Object.entries(item.subStats))
        expect(getSubStatTier(stat, value, item.iLevel, item.twoHanded, getItemStatTierCap(item))).toBe(item.subTiers[stat]);
      tierRolls.push(...Object.values(item.subTiers), item.mythicSubStat.tier);
      expect(getItemSocketCount(item)).toBe(3);
    }
    const t8Rate = tierRolls.filter((tier) => tier === 8).length / tierRolls.length;
    expect(t8Rate).toBeGreaterThan(0.4);
    expect(t8Rate).toBeLessThan(0.6);

    const item = createMythicItem({ slot: "boots", iLevel: 80 });
    const stat = Object.keys(item.subStats)[0];
    expect(getItemStatTierCap(item)).toBe(8);
    expect(getCustomSubStatTiers(stat, item.iLevel)).not.toContain(8);
    expect(getCustomSubStatTiers(stat, item.iLevel, false, 8)).toContain(8);
    expect(getItemStatTierCap({ rarity: "Artifact" })).toBe(9);
    expect(getCustomSubStatTiers(stat, item.iLevel, false, 9)).toContain(9);
    const wildcards = new Set(Array.from({ length: 300 }, () => createMythicItem({ slot: "boots", iLevel: 50 }).mythicSubStat.stat));
    expect([...wildcards].some((stat) => !getSubStatPool("boots").includes(stat))).toBe(true);
    const duplicates = Array.from({ length: 300 }, () => createMythicItem({ slot: "boots", iLevel: 50 }))
      .filter((item) => item.subStats[item.mythicSubStat.stat] !== undefined);
    expect(duplicates.length).toBeGreaterThan(0);
  });

  test("wildcard stats count toward combat stats, survive restriction, and appear in tooltips", () => {
    const item = createMythicItem({ slot: "weapon", baseName: "Sword", iLevel: 60 });
    const duplicate = { ...item, mythicSubStat: { stat: Object.keys(item.subStats)[0], value: 5, tier: 7 } };
    const bonuses = getGearBonuses({ mainHand: duplicate });
    const key = duplicate.mythicSubStat.stat;
    expect(bonuses[key]).toBeCloseTo(duplicate.subStats[key] + 5, 5);
    expect(restrictItemSubStats(duplicate).mythicSubStat).toEqual(duplicate.mythicSubStat);
    expect(itemTooltip(duplicate).stats.some((line) => line.label.endsWith("(Mythic)"))).toBe(true);
  });

  test("Mythic Unique keeps its fixed ability", () => {
    const item = createMythicItem({ unique: CRAFTED_UNIQUES.venomkissBand, iLevel: 50 });
    expect(item).toMatchObject({ rarity: "Mythic", unique: "venomkissBand", ability: { name: "Venomkiss" }, slot: "ring" });
  });
});

test("every blueprint references a valid profession and base family", () => {
  for (const blueprint of Object.values(BLUEPRINTS)) {
    expect(["weaponry", "armor", "jewelry"]).toContain(blueprint.profession);
    expect(blueprint.families.length).toBeGreaterThan(0);
  }
});
