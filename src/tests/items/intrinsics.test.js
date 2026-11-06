import { calculateStats, getGearBonuses, getStatBreakdown } from "../../character/stats";
import { getPlayer } from "../../character/player";
import { getBlueprintIntrinsicDescription, getBlueprints } from "../../items/craftingBlueprints";
import { CRAFTED_UNIQUES } from "../../items/craftingUniques";
import { getItemGearScore } from "../../items/gearScore";
import { getItemBaseType, getItemIntrinsicBonuses, ITEM_INTRINSICS, UNIQUE_BASE_TYPES } from "../../items/intrinsics";
import {
  applyHolofoilBonuses, createCraftedItem, createMythicItem, createUniqueItem,
  generateRandomItem, getSlotBases, itemComparisonTooltip, itemTooltip,
} from "../../items/items";
import { UNIQUES } from "../../world/dungeonData";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
jest.mock("../../combat/combat", () => ({ getEnemy: jest.fn(() => null) }));

afterEach(() => jest.restoreAllMocks());

test.each(Object.keys(ITEM_INTRINSICS))("%s has a distinct intrinsic for every standard base", (slot) => {
  const bases = getSlotBases(slot);
  expect(Object.keys(ITEM_INTRINSICS[slot]).sort()).toEqual(bases.map((base) => base.name).sort());
  const signatures = new Set();
  for (const base of bases) {
    const item = { slot, baseType: base.name, name: "Renamed gear" };
    const bonuses = getItemIntrinsicBonuses(item);
    expect(getGearBonuses({ item })).toEqual(bonuses);
    signatures.add(JSON.stringify(Object.entries(bonuses).sort()));
    expect(Object.values(bonuses).every((value) => value > 0)).toBe(true);
  }
  expect(signatures.size).toBe(bases.length);
});

test("legacy names resolve by slot and longest matching base, while unknown gear and tools do not gain bonuses", () => {
  expect(getItemBaseType({ name: "Perfect Empowered Oak Battle Staff", slot: "weapon" })).toBe("Battle Staff");
  expect(getItemBaseType({ name: "Perfect Runed Shield", slot: "offhand" })).toBe("Runed Shield");
  expect(getItemIntrinsicBonuses({ name: "Iron Sword", slot: "weapon" })).toEqual({ attackPercent: 0.03 });
  for (const item of [
    { name: "Sword", slot: "helmet" }, { name: "Renamed item", slot: "weapon" },
    { name: "Sword", slot: "hammer" }, { name: "Orb", slot: "precisionTools" },
    { name: "Sword", slot: "weapon", twoHandedOf: "mainHand" }, null,
  ]) expect(getItemIntrinsicBonuses(item)).toEqual({});
});

test("every Unique has the approved mapped base even when renamed or Mythic", () => {
  const definitions = { ...UNIQUES, ...CRAFTED_UNIQUES };
  expect(Object.keys(UNIQUE_BASE_TYPES).sort()).toEqual(Object.keys(definitions).sort());
  for (const def of Object.values(definitions)) {
    const item = createUniqueItem(def, 50);
    const base = UNIQUE_BASE_TYPES[def.id];
    expect(ITEM_INTRINSICS[def.slot][base]).toBeTruthy();
    expect(getItemBaseType({ ...item, name: "Renamed Unique" })).toBe(base);
    expect(getItemIntrinsicBonuses(item)).toEqual(ITEM_INTRINSICS[def.slot][base]);
    expect(getItemIntrinsicBonuses(createMythicItem({ unique: def, iLevel: 50 })))
      .toEqual(getItemIntrinsicBonuses(item));
  }
});

test("drops, crafted and Mythic gear persist their base independently of main stat and display name", () => {
  const drop = generateRandomItem("weapon");
  expect(drop.baseType).toBe(getItemBaseType(drop));
  const spec = { slot: "weapon", baseName: "Dagger", stat: "intelligence", rarity: "Rare", condition: "Average", iLevel: 50 };
  for (const item of [createCraftedItem(spec), createMythicItem(spec)]) {
    expect(item.baseType).toBe("Dagger");
    expect(item.mainStat.stat).toBe("intelligence");
    expect(getItemIntrinsicBonuses({ ...item, name: "Different name" })).toEqual({ criticalHitChance: 0.02 });
  }
});

test("rarity, condition, Holofoil and item level never scale intrinsics", () => {
  const base = { name: "Sword", slot: "weapon", iLevel: 1, subStats: {} };
  const foil = applyHolofoilBonuses({ ...base, rarity: "Legendary", condition: "Perfect", iLevel: 105, holofoil: ["#ff0000", "#0000ff"] });
  expect(getItemIntrinsicBonuses(foil)).toEqual(getItemIntrinsicBonuses(base));
  expect(getItemIntrinsicBonuses({ ...foil, twoHanded: true })).toEqual({ attackPercent: 0.03 });
});

test("intrinsics contribute once to stats, remain separate from rolls, and respect chance caps", () => {
  const sword = { name: "Iron Sword", slot: "weapon", subStats: { attackPercent: 0.1 } };
  const hero = {
    level: 50, baseStats: { strength: 10, dexterity: 10, intelligence: 10 },
    equipment: {
      mainHand: sword,
      offHand: { name: "Iron Sword", slot: "weapon", twoHandedOf: "mainHand" },
      ring1: { name: "Band", slot: "ring", subStats: { criticalHitChance: 0.8, evasion: 0.8 } },
    },
  };
  const stats = calculateStats(hero);
  expect(stats.attackPercent).toBe(0.13);
  expect(stats.criticalHitChance).toBe(0.6);
  expect(stats.evasion).toBe(0.6);
  expect(getStatBreakdown(hero).attackPercent.lines).toContainEqual({ label: "Iron Sword (Intrinsic)", value: 0.03 });
  expect(sword.subStats).toEqual({ attackPercent: 0.1 });
});

test("item and comparison tooltips expose intrinsic bonuses", () => {
  const sword = { name: "Sword", slot: "weapon", iLevel: 10, price: 10 };
  const dagger = { ...sword, name: "Dagger" };
  getPlayer.mockReturnValue({ level: 50, equipment: { mainHand: sword } });
  expect(itemTooltip(sword).description).toContain("Intrinsic (Sword): +3% Increased attack");
  expect(itemTooltip(dagger).description).toContain("Intrinsic (Dagger): +2% Critical Chance");
  expect(itemTooltip({ ...sword, name: "Axe" }).description)
    .toContain("Intrinsic (Axe): +10% Critical Damage");
  expect(itemTooltip({ ...sword, slot: "offhand", name: "Buckler" }).description)
    .toContain("Intrinsic (Buckler): +2% Evasion");
  const changes = itemComparisonTooltip(dagger).sections[0].stats;
  expect(changes).toContainEqual(expect.objectContaining({ label: "Increased attack", value: "-3%" }));
  expect(changes).toContainEqual(expect.objectContaining({ value: "+2%" }));
  expect(itemTooltip({ ...sword, slot: "hammer" }).description).toEqual([]);
});

test("gear score counts intrinsic strength without multiplying the two-handed intrinsic twice", () => {
  expect(getItemGearScore({ name: "Sword", slot: "weapon" })).toBe(8);
  expect(getItemGearScore({ name: "Greatsword", slot: "weapon", twoHanded: true })).toBe(15);
});

test("gear and Unique blueprints describe intrinsics; tools do not", () => {
  for (const profession of ["weaponry", "armor", "jewelry"]) {
    for (const blueprint of getBlueprints(profession)) {
      const description = getBlueprintIntrinsicDescription(blueprint);
      if (blueprint.kind === "tool") expect(description).toBe("");
      else expect(description).toMatch(/^Intrinsic \(/);
    }
  }
});
