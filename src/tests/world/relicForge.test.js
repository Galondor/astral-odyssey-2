import { craftRelicItem, getRelicCraftCost, RELIC_CONDITION_COSTS } from "../../world/relicForge";
import { getCustomSubStatTiers, itemTooltip } from "../../items/items";

jest.mock("../../firebase", () => ({ db: {} }));

const playerWithRelic = (extra = {}) => ({
  level: 30,
  materials: { relicFragments: 500, sealedRelic: 1 },
  consumables: {},
  inventory: [],
  ...extra,
});

test("custom relic crafting charges selected rarity, ability, and substat tier costs", () => {
  const player = playerWithRelic();
  const attackMinTier = getCustomSubStatTiers("attackMin", 30).slice(-1)[0];
  const maxPowerTier = getCustomSubStatTiers("maxPower", 30).slice(-1)[0];
  const selection = {
    slot: "weapon",
    rarity: "Epic",
    name: "Nova's Edge",
    condition: "Perfect",
    ability: "Empowered",
    subStats: [
      { stat: "attackMin", tier: attackMinTier },
      { stat: "maxPower", tier: maxPowerTier },
    ],
  };
  const result = craftRelicItem(player, selection);

  expect(result.ok).toBe(true);
  expect(result.cost).toBe(25 + 18 + RELIC_CONDITION_COSTS.Perfect + (attackMinTier + 1) ** 2 + (maxPowerTier + 1) ** 2);
  expect(result.item.name).toBe("Nova's Edge");
  expect(result.item.condition).toBe("Perfect");
  expect(result.item.slot).toBe("weapon");
  expect(result.item.rarity).toBe("Epic");
  expect(result.item.crafted).toBe(true);
  expect(itemTooltip(result.item).tags).toContain("Crafted");
  expect(result.item.subStats).toHaveProperty("attackMin");
  expect(Object.keys(result.item.subStats)).toHaveLength(4);
  expect(result.patch.inventory).toHaveLength(1);
  expect(result.patch.materials).toEqual({ relicFragments: 500 - result.cost });
  expect(getRelicCraftCost("Epic", [{ stat: "random", tier: 7 }], "")).toBe(25);
});

test("custom item names cost nothing and condition costs increase with quality", () => {
  const player = playerWithRelic({ materials: { relicFragments: 100, sealedRelic: 1 } });
  const result = craftRelicItem(player, {
    name: "Named at no cost",
    slot: "weapon",
    rarity: "Common",
    condition: "random",
  });
  expect(result.ok).toBe(true);
  expect(result.cost).toBe(0);
  expect(result.item.name).toBe("Named at no cost");

  const conditionChoice = craftRelicItem(player, {
    name: "Polished Edge",
    slot: "weapon",
    rarity: "Common",
    condition: "Perfect",
  });
  expect(conditionChoice.cost).toBe(RELIC_CONDITION_COSTS.Perfect);
  expect(conditionChoice.item.condition).toBe("Perfect");
  expect(RELIC_CONDITION_COSTS).toEqual({
    Broken: 0,
    Poor: 0,
    Average: 10,
    Pristine: 20,
    Flawless: 30,
    Perfect: 40,
  });
  expect(getRelicCraftCost("Common", [], "", "random")).toBe(0);
});

test("relic crafting rejects slot-incompatible substats without consuming materials", () => {
  const player = playerWithRelic();
  const result = craftRelicItem(player, {
    slot: "helmet",
    rarity: "Common",
    subStats: [{ stat: "attackMin", tier: 2 }],
  });

  expect(result).toMatchObject({ ok: false });
  expect(result.message).toMatch(/available for this slot/);
  expect(player.materials.relicFragments).toBe(500);
  expect(player.materials.sealedRelic).toBe(1);
});

test("relic crafting requires both a relic and enough fragments", () => {
  expect(craftRelicItem(playerWithRelic({ materials: { relicFragments: 500, sealedRelic: 0 } }), {
    slot: "weapon",
    rarity: "Common",
  }).message).toMatch(/Sealed Relic/);
  expect(craftRelicItem(playerWithRelic({ materials: { relicFragments: 1, sealedRelic: 1 } }), {
    slot: "weapon",
    rarity: "Legendary",
  }).message).toMatch(/Relic Fragments/);
});

test.each(["Unique", "Mythic"])("relic crafting rejects %s rarity", (rarity) => {
  const result = craftRelicItem(playerWithRelic(), { slot: "weapon", rarity });
  expect(result).toMatchObject({ ok: false });
  expect(result.message).toMatch(/valid item slot and rarity/);
});
