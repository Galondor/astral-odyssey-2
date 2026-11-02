import { getPlayer, setPlayer } from "../../character/player";
import { recalculateStats } from "../../character/stats";
import { getEnemy } from "../../combat/combat";
import { applyConsumable, CONSUMABLES, drinkConsumable } from "../../items/consumables";
import { CONDITION_NAMES, getSubStatTier, itemTooltip, SUBSTAT_NAMES } from "../../items/items";
import { getItemSocketCount } from "../../items/sockets";
import { applyRune, canApplyRune } from "../../items/runes";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
jest.mock("../../combat/combat", () => ({ getEnemy: jest.fn() }));

let player;
let item;
beforeEach(() => {
  jest.clearAllMocks();
  getEnemy.mockReturnValue(null);
  item = {
    id: "gear-1", name: "Iron Sword", slot: "weapon", rarity: "Rare", condition: "Average", iLevel: 5,
    mainStat: { stat: "strength", value: 12, tier: 4 },
    subStats: { vitality: 2 }, subTiers: { vitality: 1 },
    gemstone: { type: "ruby", stat: "strength", value: 2 },
    ability: null, price: 300, originalOwner: "Nova",
  };
  player = {
    level: 20, baseStats: { strength: 5, dexterity: 5, intelligence: 5 },
    inventory: [item], equipment: {}, consumables: { architectsRune: 2, healthPotion: 3 },
  };
  player = { ...player, ...recalculateStats(player) };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
});

afterEach(() => jest.restoreAllMocks());

test.each(["dexterity", "intelligence"])("changes the main stat to %s, preserving the item and consuming one rune", (stat) => {
  expect(applyRune("architectsRune", item.id, stat).ok).toBe(true);
  expect(player.inventory[0]).toEqual({
    ...item, mainStat: { ...item.mainStat, stat }, usedRunes: ["Architect's Rune"],
  });
  expect(player.consumables).toEqual({ architectsRune: 1, healthPotion: 3 });
  expect(itemTooltip(player.inventory[0]).tags).toContain("Architect's Rune");
  expect(itemTooltip(player.inventory[0]).tags).not.toContain("Crafted");
  expect(item.mainStat.stat).toBe("strength");
  expect(canApplyRune(player.inventory[0], "architectsRune")).toBe(false);
  expect(canApplyRune(player.inventory[0], "polishingRune")).toBe(true);
  expect(applyRune("architectsRune", item.id, "strength")).toMatchObject({ ok: false, message: "This item has already received Architect's Rune." });
  expect(player.consumables.architectsRune).toBe(1);
});

test("equipped items recalculate stats and keep two-handed placeholders intact", () => {
  const placeholder = { twoHandedOf: "mainHand", name: item.name };
  player = { ...player, ...recalculateStats(player, {
    inventory: [], equipment: { mainHand: { ...item, twoHanded: true }, offHand: placeholder },
    consumables: { architectsRune: 1 },
  }) };
  expect(player.stats.strength).toBe(19);
  expect(applyRune("architectsRune", item.id, "intelligence").ok).toBe(true);
  expect(player.stats).toMatchObject({ strength: 7, intelligence: 17 });
  expect(player.equipment.offHand).toEqual(placeholder);
  expect(player.equipment.mainHand.usedRunes).toEqual(["Architect's Rune"]);
  expect(player.equipment.mainHand.crafted).toBeUndefined();
  expect(player.consumables).toEqual({});
});

test.each(["strength", "luck", "", undefined])("invalid or unchanged stat %s does not spend a rune", (stat) => {
  expect(applyRune("architectsRune", item.id, stat).ok).toBe(false);
  expect(setPlayer).not.toHaveBeenCalled();
});

test("combat, missing items, missing runes, and non-runes cannot modify gear", () => {
  getEnemy.mockReturnValue({});
  expect(applyRune("architectsRune", item.id, "dexterity").ok).toBe(false);
  getEnemy.mockReturnValue(null);
  expect(applyRune("architectsRune", "missing", "dexterity").ok).toBe(false);
  expect(applyRune("healthPotion", item.id, "dexterity").ok).toBe(false);
  player.consumables.architectsRune = 0;
  expect(applyRune("architectsRune", item.id, "dexterity").ok).toBe(false);
  expect(setPlayer).not.toHaveBeenCalled();
});

test("unsupported runes report an error without consuming anything on crafted gear", () => {
  CONSUMABLES.testRune = { name: "Test Rune", rune: true };
  try {
    player.inventory[0] = { ...item, crafted: true };
    player.consumables.testRune = 1;
    expect(applyRune("testRune", item.id)).toMatchObject({
      ok: false, message: "That rune's effect is not supported.",
    });
    expect(setPlayer).not.toHaveBeenCalled();
  } finally {
    delete CONSUMABLES.testRune;
  }
});

test("the unpredictability rune can do nothing while consuming the rune", () => {
  player.consumables.runeOfUnpredictability = 1;
  jest.spyOn(Math, "random").mockReturnValue(0.01);

  const result = applyRune("runeOfUnpredictability", item.id);

  expect(result).toMatchObject({ ok: true, message: expect.stringContaining("nothing happened") });
  expect(player.inventory[0]).toMatchObject({ ...item, usedRunes: ["Rune of Unpredictability"] });
  expect(player.inventory[0].crafted).toBeUndefined();
  expect(player.consumables.runeOfUnpredictability).toBeUndefined();
});

test.each(["weapon", "offhand", "helmet", "chestplate", "gauntlets", "legs", "boots", "ring", "necklace"])(
  "rune resistance additions honor the %s slot restriction",
  (slot) => {
    player.inventory[0] = {
      ...item, slot, iLevel: 100,
      subStats: Object.fromEntries(SUBSTAT_NAMES.filter((stat) =>
        !["criticalResistance", "statusResistance"].includes(stat)).map((stat) => [stat, 1])),
    };
    player.consumables.runeOfUnpredictability = 1;
    jest.spyOn(Math, "random").mockReturnValueOnce(0.76).mockReturnValue(0.99);
    expect(applyRune("runeOfUnpredictability", item.id).ok).toBe(true);
    expect("statusResistance" in player.inventory[0].subStats).toBe(!["weapon", "offhand"].includes(slot));
    Math.random.mockRestore();
  },
);

test("the unpredictability rune changes a substat by one tier", () => {
  player.consumables.runeOfUnpredictability = 1;
  jest.spyOn(Math, "random").mockReturnValue(0.26);

  const result = applyRune("runeOfUnpredictability", item.id);

  expect(result.ok).toBe(true);
  expect(player.inventory[0].subTiers.vitality).toBe(0);
  expect(player.inventory[0].subStats.vitality).toBeLessThan(item.subStats.vitality);
});

test("the unpredictability rune changes a substat to a different stat at the same tier", () => {
  player.consumables.runeOfUnpredictability = 1;
  jest.spyOn(Math, "random").mockReturnValue(0.51);

  const result = applyRune("runeOfUnpredictability", item.id);

  expect(result.ok).toBe(true);
  expect(player.inventory[0].subStats.vitality).toBeUndefined();
  const [newStat] = Object.keys(player.inventory[0].subStats);
  expect(player.inventory[0].subTiers[newStat]).toBe(1);
});

test("the unpredictability rune adds substats outside the item's usual pool", () => {
  player.consumables.runeOfUnpredictability = 1;
  jest.spyOn(Math, "random")
    .mockReturnValueOnce(0.76)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0.01)
    .mockReturnValueOnce(0.5);

  const result = applyRune("runeOfUnpredictability", item.id);

  expect(result.ok).toBe(true);
  expect(player.inventory[0].subStats.defense).toBeDefined();
  expect(player.inventory[0].subTiers.defense).toBeDefined();
  expect(Object.keys(player.inventory[0].subStats)).toHaveLength(2);
});

test("opening rune selection and combat consumable use do not consume runes", () => {
  expect(drinkConsumable("architectsRune")).toMatchObject({ ok: true, requiresRune: true });
  const stats = { ...player.stats };
  expect(applyConsumable(player, "architectsRune", stats).ok).toBe(false);
  expect(stats).toEqual(player.stats);
  expect(setPlayer).not.toHaveBeenCalled();
});

test.each(["Common", "Uncommon", "Rare", "Epic"])("Ascension upgrades %s once and preserves existing item properties", (rarity) => {
  player.inventory[0] = { ...item, rarity, upgrades: 4, crafted: true };
  player.consumables.runeOfAscension = 2;
  jest.spyOn(Math, "random").mockReturnValue(0.5);
  expect(applyRune("runeOfAscension", item.id).ok).toBe(true);
  const upgraded = player.inventory[0];
  expect(upgraded.rarity).toBe({ Common: "Uncommon", Uncommon: "Rare", Rare: "Epic", Epic: "Legendary" }[rarity]);
  expect(upgraded.mainStat.value).toBe(item.mainStat.value + 1);
  expect(upgraded.mainStat.stat).toBe(item.mainStat.stat);
  expect(upgraded.subStats.vitality).toBe(item.subStats.vitality);
  expect(upgraded.subTiers.vitality).toBe(item.subTiers.vitality);
  expect(Object.keys(upgraded.subStats)).toHaveLength(2);
  expect(upgraded.price).toBeGreaterThan(item.price);
  expect(upgraded).toMatchObject({
    id: item.id, name: item.name, gemstone: item.gemstone, originalOwner: item.originalOwner,
    crafted: true, upgrades: 4, usedRunes: ["Rune of Ascension"],
  });
  expect(player.consumables.runeOfAscension).toBe(1);
  expect(itemTooltip(upgraded).tags).toEqual(expect.arrayContaining(["Crafted", "Rune of Ascension"]));
  expect(applyRune("runeOfAscension", item.id).ok).toBe(false);
  expect(player.consumables.runeOfAscension).toBe(1);
});

test.each(["Legendary", "Unique", "Mythic", "Invalid"])("Ascension rejects %s without consuming a rune", (rarity) => {
  player.inventory[0] = { ...item, rarity };
  player.consumables.runeOfAscension = 1;
  expect(canApplyRune(player.inventory[0], "runeOfAscension")).toBe(false);
  expect(applyRune("runeOfAscension", item.id).ok).toBe(false);
  expect(setPlayer).not.toHaveBeenCalled();
});

test.each(CONDITION_NAMES.slice(0, -1))("Polishing upgrades %s and its main stat/value without changing other stats", (condition) => {
  const modifiers = { Broken: -3, Poor: -2, Average: 0, Pristine: 2, Flawless: 3, Perfect: 5 };
  player.inventory[0] = { ...item, condition };
  player.consumables.polishingRune = 2;
  expect(applyRune("polishingRune", item.id).ok).toBe(true);
  const upgraded = player.inventory[0];
  const next = CONDITION_NAMES[CONDITION_NAMES.indexOf(condition) + 1];
  expect(upgraded.condition).toBe(next);
  expect(itemTooltip(upgraded).subtitle).toContain(next);
  expect(upgraded.mainStat.value).toBe(item.mainStat.value + modifiers[next] - modifiers[condition]);
  expect(upgraded.price).toBeGreaterThan(item.price);
  expect(upgraded).toMatchObject({
    rarity: item.rarity, subStats: item.subStats, subTiers: item.subTiers,
    ability: item.ability, gemstone: item.gemstone, usedRunes: ["Polishing Rune"],
  });
  expect(applyRune("polishingRune", item.id).ok).toBe(false);
  expect(player.consumables.polishingRune).toBe(1);
});

test("Perfect gear rejects Polishing without spending it", () => {
  player.inventory[0] = { ...item, condition: "Perfect" };
  player.consumables.polishingRune = 1;
  expect(canApplyRune(player.inventory[0], "polishingRune")).toBe(false);
  expect(applyRune("polishingRune", item.id).ok).toBe(false);
  expect(setPlayer).not.toHaveBeenCalled();
});

test.each(["runeOfAscension", "polishingRune"])("%s rejects invalid item metadata without spending it", (key) => {
  player.consumables[key] = 1;
  for (const patch of [{ iLevel: 0 }, { price: Infinity }, { mainStat: { stat: "strength", value: NaN } }, { condition: "Invalid" }]) {
    player.inventory[0] = { ...item, ...patch };
    expect(applyRune(key, item.id).ok).toBe(false);
  }
  expect(player.consumables[key]).toBe(1);
  expect(setPlayer).not.toHaveBeenCalled();
});

test("all four runes can be used once on the same crafted item", () => {
  player.inventory[0] = { ...item, crafted: true };
  player.consumables = { architectsRune: 2, runeOfUnpredictability: 2, runeOfAscension: 2, polishingRune: 2 };
  jest.spyOn(Math, "random").mockReturnValue(0.01);
  for (const key of Object.keys(player.consumables)) {
    expect(applyRune(key, item.id, "dexterity").ok).toBe(true);
    expect(applyRune(key, item.id, "intelligence").ok).toBe(false);
    expect(player.consumables[key]).toBe(1);
  }
  expect(player.inventory[0].usedRunes).toEqual([
    "Architect's Rune", "Rune of Unpredictability", "Rune of Ascension", "Polishing Rune",
  ]);
  expect(player.inventory[0].crafted).toBe(true);
});

test("Ascension on a two-handed Holofoil preserves gems and bonuses and adds a T5+ substat", () => {
  const holofoil = ["#ff0000", "#00ff00"];
  const ability = { name: "Existing ability", description: "Keep me." };
  player.inventory[0] = {
    ...item, twoHanded: true, holofoil, holofoilBonusVersion: 1, socketCount: 1, ability,
  };
  player.consumables.runeOfAscension = 1;
  jest.spyOn(Math, "random").mockReturnValue(0.99);
  expect(applyRune("runeOfAscension", item.id).ok).toBe(true);
  const upgraded = player.inventory[0];
  expect(upgraded.mainStat.value).toBe(item.mainStat.value + 2);
  expect(upgraded).toMatchObject({ ability, holofoil, holofoilBonusVersion: 1, gemstone: item.gemstone });
  expect(getItemSocketCount(upgraded)).toBe(3);
  const newStat = Object.keys(upgraded.subStats).find((stat) => stat !== "vitality");
  expect(getSubStatTier(newStat, upgraded.subStats[newStat], item.iLevel, true)).toBeGreaterThanOrEqual(5);
});

test("Polishing equipped gear immediately recalculates character stats", () => {
  player = { ...player, ...recalculateStats(player, {
    inventory: [], equipment: { mainHand: item }, consumables: { polishingRune: 1 },
  }) };
  const strength = player.stats.strength;
  expect(applyRune("polishingRune", item.id).ok).toBe(true);
  expect(player.stats.strength).toBe(strength + 2);
  expect(player.equipment.mainHand.condition).toBe("Pristine");
  expect(player.consumables).toEqual({});
});

test("Ascension supports gear without any existing substats at low item levels", () => {
  player.inventory[0] = { ...item, subStats: undefined, subTiers: undefined };
  player.consumables.runeOfAscension = 1;
  jest.spyOn(Math, "random").mockReturnValue(0.01);
  expect(applyRune("runeOfAscension", item.id)).toMatchObject({ ok: true });
});

test("Polishing scales value by the condition and main-stat improvements without losing custom bonuses", () => {
  player.consumables.polishingRune = 1;
  expect(applyRune("polishingRune", item.id).ok).toBe(true);
  const oldBase = 5 + item.iLevel * 2 + item.mainStat.value * 2 + item.subStats.vitality;
  expect(player.inventory[0].price).toBe(Math.round(item.price * (oldBase + 4) / oldBase / 0.75));
});

test.each(["Unique", "Mythic"])("Polishing remains usable on non-Perfect %s gear", (rarity) => {
  player.inventory[0] = { ...item, rarity };
  player.consumables.polishingRune = 1;
  expect(applyRune("polishingRune", item.id).ok).toBe(true);
  expect(player.inventory[0]).toMatchObject({ rarity, condition: "Pristine" });
});
