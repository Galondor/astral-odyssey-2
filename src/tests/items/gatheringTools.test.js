import { getPlayer, setPlayer } from "../../character/player";
import { analyzeCraft, craftItem } from "../../items/crafting";
import { BLUEPRINTS } from "../../items/craftingBlueprints";
import { CRAFTING_MATERIALS } from "../../items/craftingMaterials";
import { MATERIALS } from "../../items/materials";
import { canEquip, itemTooltip, restrictItemSubStats, SLOTS } from "../../items/items";
import { CRAFTING_STATS, GATHERING_STATS, getToolSubStats } from "../../items/craftingStats";
import { applyToolHolofoilBonuses, createToolItem, getToolBonuses } from "../../items/tools";
import { getGearBonuses } from "../../character/stats";
import { getItemGearScore } from "../../items/gearScore";
import { getItemSocketCount } from "../../items/sockets";
import { canApplyRune } from "../../items/runes";
import { getTierParts, rollCraftingDrops } from "../../items/craftingDrops";
import { upgradeInventoryItem } from "../../items/upgrades";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(() => null), setPlayer: jest.fn() }));
jest.mock("../../combat/combat", () => ({ getEnemy: jest.fn(() => null) }));
afterEach(() => jest.restoreAllMocks());
const player = (level = 50) => ({
  level: 1, astra: 1000000, professions: { weaponry: { level } },
  gathering: { mining: { level }, logging: { level } },
  materials: { metal_scraps: 100, cinderite_ore: 100, rimesteel_ore: 100,
    pickaxehead_i: 1, pickaxehead_ii: 1, pickaxehead_iii: 1, axehead_i: 1, haft_i: 1, haft_ii: 1, haft_iii: 1 },
});

test.each(["pickaxe", "axe"])("%s has its own stats, requirements, slots and no combat effects", (slot) => {
  const item = createToolItem({ slot, iLevel: 20, rarity: "Legendary" });
  expect(item.mainStat.stat).toBe("gatheringPower");
  expect(Object.keys(item.subStats)).toHaveLength(5);
  expect(Object.keys(item.subStats).every((stat) => getToolSubStats(slot).includes(stat))).toBe(true);
  expect(SLOTS.find((s) => s.type === slot).category).toBe("crafting-gathering");
  expect(canEquip(item, 100, player(19))).toBe(false);
  expect(canEquip(item, 1, player(20))).toBe(true);
  expect(canEquip({ ...item, iLevel: 1 }, 100, player(4))).toBe(false);
  expect(getGearBonuses({ [slot]: item })).toEqual({});
  expect(getItemGearScore(item)).toBe(0);
  expect(getItemSocketCount(item)).toBe(0);
  expect(canApplyRune(item)).toBe(false);
  expect(restrictItemSubStats({ ...item, subStats: { ...item.subStats, craftQuality: 99 } }).subStats).toEqual(item.subStats);
  expect(itemTooltip(item).subtitle).toContain(slot === "pickaxe" ? "Mining 20" : "Logging 20");
  const foil = applyToolHolofoilBonuses({ ...item, holofoil: ["#ff0000", "#00ff00"], holofoilBonusVersion: undefined });
  expect(foil.mainStat.stat).toBe("gatheringPower");
  expect(foil.mainStat.value).toBeLessThanOrEqual(50);
  expect(getToolBonuses({ ...player(), equipment: { [slot]: item } }, "weaponry").tool).toBeNull();
});

test("profession and gathering experience tool stats can reach a 100% bonus", () => {
  expect(CRAFTING_STATS.craftExp.cap * 50).toBe(1);
  expect(GATHERING_STATS.gatheringExp.cap * 50).toBe(1);
});

test("six head recipes unlock at 5/20/35, consume only ore and produce materials", () => {
  for (const type of ["pickaxehead", "axehead"]) {
    ["i", "ii", "iii"].forEach((suffix, index) => {
      const blueprintId = `part:${type}_${suffix}`;
      const level = [5, 20, 35][index];
      const base = ["metal_scraps", "cinderite_ore", "rimesteel_ore"][index];
      expect(BLUEPRINTS[blueprintId].level).toBe(level);
      expect(analyzeCraft(player(level - 1), { blueprintId, base }).ok).toBe(false);
      const p = player(level);
      const analysis = analyzeCraft(p, { blueprintId, base });
      expect(analysis.ok).toBe(true);
      expect(analysis.cost).toEqual({ [base]: [3, 5, 7][index] });
      const result = craftItem(p, { blueprintId, base });
      expect(result.ok).toBe(true);
      expect(result.item).toBeUndefined();
      expect(result.patch.inventory).toBeUndefined();
      expect(result.patch.materials[`${type}_${suffix}`]).toBe((p.materials[`${type}_${suffix}`] || 0) + 1);
      expect(result.patch.astra).toBe(p.astra - analysis.astraCost);
      expect(result.patch.professions.weaponry.crafts).toBe(1);
    });
  }
});

test.each([
  ["pickaxehead", "Pickaxe Head"],
  ["axehead", "Axe Head"],
])("%s names match their blueprint quality", (type, headName) => {
  ["Crude", "Tempered", "Masterwork"].forEach((quality, index) => {
    const output = `${type}_${["i", "ii", "iii"][index]}`;
    expect(MATERIALS[output].name).toBe(`${quality} ${headName}`);
    expect(BLUEPRINTS[`part:${output}`].name).toBe(MATERIALS[output].name);
  });
});

test("shared Hafts constrain caps and grant only matching tool effects", () => {
  const selection = { blueprintId: "tool:pickaxe", base: "metal_scraps", reagents: ["pickaxehead_iii", "haft_i"] };
  expect(analyzeCraft(player(), selection)).toMatchObject({ ok: true, iLevel: 1, maxILevel: 20 });
  const bonusPlayer = { ...player(), materials: { ...player().materials, ember_core: 1 } };
  expect(analyzeCraft(bonusPlayer, { ...selection, reagents: [...selection.reagents, "ember_core"] }))
    .toMatchObject({ ok: true, iLevel: 1, maxILevel: 20 });
  const high = analyzeCraft(player(), { ...selection, reagents: ["pickaxehead_iii", "haft_iii"] });
  expect(high).toMatchObject({ ok: true, iLevel: 1, maxILevel: 50 });
  expect(high.toolGuaranteed).toContain("gatheringRarity");
  expect(high.toolGuaranteed).not.toContain("craftExp");
  expect(craftItem(player(5), { ...selection, reagents: ["pickaxehead_i", "haft_i"] }).ok).toBe(true);
  expect(analyzeCraft(player(), { ...selection, reagents: ["axehead_i", "haft_i"] }).ok).toBe(false);
  const hammerPlayer = { ...player(), materials: { ...player().materials, hammerhead_i: 1 } };
  const hammer = analyzeCraft(hammerPlayer, { blueprintId: "tool:hammer", base: "metal_scraps", reagents: ["hammerhead_i", "haft_i"] });
  expect(hammer.toolGuaranteed).toContain("materialPreservation");
  expect(hammer.toolGuaranteed).not.toContain("gatheringTiming");
});

test("heads never drop and new regional ore/wood is absent from generic combat rewards", () => {
  for (let tier = 1; tier <= 7; tier++) expect(getTierParts(tier).every((key) => !CRAFTING_MATERIALS[key].craftOnly)).toBe(true);
  jest.spyOn(Math, "random").mockReturnValue(0);
  const drops = rollCraftingDrops({ tier: "boss", level: 100, region: "ShatteredFront" });
  expect(Object.keys(drops).some((key) => ["ore", "wood"].includes(CRAFTING_MATERIALS[key].family))).toBe(false);
});

test("gathering tool upgrades preserve pools and improve acquisition power", () => {
  const item = createToolItem({ slot: "pickaxe", iLevel: 20 });
  getPlayer.mockReturnValue({ ...player(), inventory: [item] });
  setPlayer.mockClear();
  const result = upgradeInventoryItem(item.id);
  expect(result.ok).toBe(true);
  const upgraded = setPlayer.mock.calls[0][0].inventory[0];
  expect(upgraded.mainStat.value).toBe(item.mainStat.value + 1);
  expect(upgraded.iLevel).toBe(21);
  expect(Object.keys(upgraded.subStats)).toEqual(Object.keys(item.subStats));
});
