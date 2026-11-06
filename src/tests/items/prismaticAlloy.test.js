import { getPlayer, setPlayer } from "../../character/player";
import { getEnemy } from "../../combat/combat";
import { applyPrismaticAlloy, canApplyPrismaticAlloy } from "../../items/prismaticAlloy";
import { drinkConsumable } from "../../items/consumables";
import { HOLOFOIL_EFFECTS, MYTHIC_HOLOFOIL_EFFECTS, MYTHIC_HOLOFOIL_PALETTES } from "../../items/holofoil";
import { getItemSocketCount } from "../../items/sockets";
import { getSubStatTier } from "../../items/items";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
jest.mock("../../combat/combat", () => ({ getEnemy: jest.fn() }));

let player;
const item = {
  id: "sword", name: "Iron Sword", slot: "weapon", rarity: "Rare",
};

beforeEach(() => {
  jest.clearAllMocks();
  player = { inventory: [{ ...item }], equipment: {}, consumables: { prismaticAlloy: 1 } };
  getPlayer.mockImplementation(() => player);
  setPlayer.mockImplementation((patch) => { player = { ...player, ...patch }; });
  getEnemy.mockReturnValue(null);
  jest.spyOn(Math, "random").mockReturnValue(0.5);
});

afterEach(() => jest.restoreAllMocks());

test("using an alloy opens a selection flow without consuming it", () => {
  expect(drinkConsumable("prismaticAlloy")).toMatchObject({
    ok: true, requiresHolofoilReroll: true,
  });
  expect(player.consumables.prismaticAlloy).toBe(1);
  expect(setPlayer).not.toHaveBeenCalled();
});

test("applies a random foil to a non-Holofoil item", () => {
  expect(applyPrismaticAlloy("sword").ok).toBe(true);
  expect(player.inventory[0]).toMatchObject({
    ...item,
    holofoil: ["#800000", "#800000"],
    holofoilEffect: HOLOFOIL_EFFECTS[Math.floor(0.5 * HOLOFOIL_EFFECTS.length)],
    prismatic: true,
  });
  expect(player.consumables).toEqual({});
});

test("rerolls an existing Holofoil and leaves its other item data unchanged", () => {
  player.inventory[0] = { ...item, holofoil: ["#123456", "#abcdef"], holofoilEffect: "nebula" };
  expect(applyPrismaticAlloy("sword").ok).toBe(true);
  expect(player.inventory[0]).toMatchObject({
    ...item,
    holofoil: ["#800000", "#800000"],
    holofoilEffect: HOLOFOIL_EFFECTS[Math.floor(0.5 * HOLOFOIL_EFFECTS.length)],
    prismatic: true,
  });
  expect(player.consumables).toEqual({});
});

test("applies foils to equipped gear but rejects missing items, placeholders, and combat use", () => {
  player.inventory = [];
  player.equipment = {
    mainHand: { ...item, twoHanded: true },
    offHand: { twoHandedOf: "mainHand", name: item.name },
  };
  expect(canApplyPrismaticAlloy(player.equipment.mainHand)).toBe(true);
  expect(canApplyPrismaticAlloy(player.equipment.offHand)).toBe(false);
  expect(applyPrismaticAlloy("missing").ok).toBe(false);
  expect(player.consumables.prismaticAlloy).toBe(1);
  getEnemy.mockReturnValue({ name: "Enemy" });
  expect(applyPrismaticAlloy("sword").ok).toBe(false);
  expect(player.consumables.prismaticAlloy).toBe(1);
  expect(setPlayer).not.toHaveBeenCalled();
});

test.each(["inventory", "equipment"])("Mythic Alloy rerolls in %s keep the exclusive pool and do not stack bonuses", location => {
  const mythic = {
    ...item, rarity: "Mythic", holofoil: ["#123456", "#abcdef"],
    holofoilEffect: "event-horizon", holofoilBonusVersion: 1, price: 1000,
  };
  player.inventory = location === "inventory" ? [mythic] : [];
  player.equipment = location === "equipment" ? { mainHand: mythic } : {};
  const effect = MYTHIC_HOLOFOIL_EFFECTS[2];
  expect(applyPrismaticAlloy("sword").ok).toBe(true);
  const result = location === "inventory" ? player.inventory[0] : player.equipment.mainHand;
  expect(result.holofoilEffect).toBe(effect);
  expect(result.holofoil).toEqual(MYTHIC_HOLOFOIL_PALETTES[effect][1]);
  expect(result.price).toBe(1000);
  expect(result.rarity).toBe("Mythic");
  expect(player.consumables).toEqual({});
});

test("Alloy grants bonuses once and immediately recalculates equipped stats", () => {
  player = {
    level: 25, stats: {}, baseStats: { strength: 2, dexterity: 2, intelligence: 2 },
    inventory: [], equipment: {
      mainHand: {
        ...item, rarity: "Epic", socketCount: 2, iLevel: 25, price: 500,
        mainStat: { stat: "strength", value: 1 }, subStats: { speed: 1 },
      },
    },
    consumables: { prismaticAlloy: 2 },
  };
  expect(applyPrismaticAlloy("sword").ok).toBe(true);
  const upgraded = player.equipment.mainHand;
  expect(upgraded.price).toBe(1000);
  expect(upgraded.mainStat.tier).toBeGreaterThanOrEqual(5);
  expect(getSubStatTier("speed", upgraded.subStats.speed, 25)).toBeGreaterThanOrEqual(5);
  expect(getItemSocketCount(upgraded)).toBe(3);
  expect(player.stats.strength).toBe(2 + upgraded.mainStat.value);
  expect(applyPrismaticAlloy("sword").ok).toBe(true);
  expect(player.equipment.mainHand.price).toBe(1000);
  expect(player.equipment.mainHand.mainStat).toEqual(upgraded.mainStat);
  expect(player.equipment.mainHand.subStats).toEqual(upgraded.subStats);
  expect(getItemSocketCount(player.equipment.mainHand)).toBe(3);
  expect(player.consumables).toEqual({});
});
