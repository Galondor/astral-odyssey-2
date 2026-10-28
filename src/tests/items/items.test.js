import { getPlayer } from "../../character/player";
import { createCustomItem, createStarterInventory, createUniqueItem, generateRandomItem, getCustomSubStatTiers, getSubStatPool, itemTooltip, STAT_TIERS, SUBSTAT_NAMES } from "../../items/items";
import { UNIQUES } from "../../world/dungeonData";

jest.mock("../../character/player", () => ({ getPlayer: jest.fn() }));

beforeEach(() => {
  getPlayer.mockReturnValue({ level: 1 });
});

test.each([
  [0, 0],
  [7, 2],
  [10, 3],
  [22, 7],
])("main stat value %i displays its tier on the absolute 0–22 scale", (value, tier) => {
  const tooltip = itemTooltip({
    name: "Test item",
    slot: "weapon",
    rarity: "Common",
    iLevel: 1,
    price: 1,
    mainStat: { stat: "strength", value, tier: 0 },
  });

  expect(tooltip.stats[0].tier).toBe(`T${tier}`);
});

test("item tooltip tags gear treated with Prismatic Alloy", () => {
  expect(itemTooltip({
    name: "Prismatic Sword",
    slot: "weapon",
    rarity: "Rare",
    iLevel: 1,
    price: 1,
    prismatic: true,
  }).tags).toContain("Prismatic");
});

test("weapon can roll Power as a substat", () => {
  jest.spyOn(Math, "random").mockReturnValue(0);
  const item = generateRandomItem("weapon");
  Math.random.mockRestore();

  expect(item.subStats.maxPower).toBeGreaterThan(0);
  expect(itemTooltip(item).stats).toContainEqual(
    expect.objectContaining({ label: "Power", value: `+${item.subStats.maxPower}` }),
  );
});

test("unique gear only rolls substats from its slot pool", () => {
  const item = createUniqueItem({
    id: "test-unique",
    name: "Test Unique",
    slot: "weapon",
    stat: "strength",
    ability: "Plunder",
    subStats: ["luck", "maxPower"],
  });

  expect(Object.keys(item.subStats)).toEqual(["maxPower"]);
  expect(Object.keys(item.subStats).every((stat) => getSubStatPool(item.slot).includes(stat))).toBe(true);
});

test("the Astral Colossus Heart rolls all six configured necklace substats", () => {
  const definition = UNIQUES.astralColossusHeart;
  const item = createUniqueItem(definition, 80);

  expect(Object.keys(item.subStats)).toHaveLength(6);
  expect(Object.keys(item.subStats)).toEqual(definition.subStats);
  expect(Object.keys(item.subStats).every((stat) => getSubStatPool(item.slot).includes(stat))).toBe(true);
});

test("every catalog unique rolls all configured substats valid for its slot", () => {
  for (const definition of Object.values(UNIQUES)) {
    const expectedSubStats = definition.subStats.filter((stat) =>
      getSubStatPool(definition.slot).includes(stat),
    );
    const item = createUniqueItem(definition, 80);
    expect(Object.keys(item.subStats)).toEqual(expectedSubStats);
  }
});

test("starter inventory contains seven Average Common items matching the highest core stat", () => {
  getPlayer.mockReturnValue({ level: 50 });
  const inventory = createStarterInventory({
    strength: 4,
    dexterity: 1,
    intelligence: 1,
  });

  expect(inventory.map((item) => item.slot)).toEqual([
    "weapon", "offhand", "helmet", "chestplate", "gauntlets", "legs", "boots",
  ]);
  expect(
    inventory.every(
      (item) =>
        item.rarity === "Common" &&
        item.condition === "Average" &&
        item.iLevel === 1 &&
        item.mainStat.stat === "strength",
    ),
  ).toBe(true);
  expect(inventory[0].twoHanded).toBe(false);
});

test("starter gear may use any of the tied highest core stats", () => {
  const inventory = createStarterInventory({
    strength: 2,
    dexterity: 2,
    intelligence: 1,
  });

  expect(inventory.every((item) => ["strength", "dexterity"].includes(item.mainStat.stat))).toBe(true);
});

test("substat tiers increase with displayed rolls for the same stat and item type", () => {
  let seed = 12345;
  jest.spyOn(Math, "random").mockImplementation(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  });

  const rollsByItemType = new Map();
  const seenStats = new Set();
  for (let i = 0; i < 1200; i++) {
    const item = generateRandomItem("helmet");
    for (const [stat, value] of Object.entries(item.subStats)) {
      seenStats.add(stat);
      const itemType = [
        stat,
        item.rarity,
        item.iLevel,
        item.twoHanded,
      ].join(":");
      const rolls = rollsByItemType.get(itemType) || [];
      rolls.push({ value, tier: item.subTiers[stat] });
      rollsByItemType.set(itemType, rolls);
    }
  }
  Math.random.mockRestore();

  expect([...seenStats]).toEqual(expect.arrayContaining([
    "attackPercent",
    "magicAttackPercent",
    "defense",
    "speed",
  ]));
  for (const rolls of rollsByItemType.values()) {
    rolls.sort((a, b) => a.value - b.value);
    for (let i = 1; i < rolls.length; i++) {
      expect(rolls[i].tier).toBeGreaterThanOrEqual(rolls[i - 1].tier);
    }
  }
});

const customDefinition = {
  name: "  Starforged Blade  ", slot: "weapon", rarity: "Unique", condition: "Perfect",
  iLevel: 80, price: 12345, twoHanded: true,
  mainStat: { stat: "intelligence", tier: 7 },
  subStats: { criticalDamage: 4, maxPower: 5, attackMin: 6 },
  ability: "Undying Hunger", holofoil: ["#123456", "#abcdef"],
};

test("attack percentage substats are available and display as percentages", () => {
  expect(SUBSTAT_NAMES).toEqual(expect.arrayContaining(["attackPercent", "magicAttackPercent"]));
  const item = createCustomItem({
    ...customDefinition,
    iLevel: 80,
    twoHanded: false,
    subStats: { attackPercent: 7, magicAttackPercent: 7 },
  });
  const formatPercent = (value) => `+${Math.round(value * 1000) / 10}%`;

  expect(itemTooltip(item).stats).toEqual(expect.arrayContaining([
    expect.objectContaining({ label: "Increased attack", value: formatPercent(item.subStats.attackPercent) }),
    expect.objectContaining({ label: "Increased magic attack", value: formatPercent(item.subStats.magicAttackPercent) }),
  ]));
});

test("custom gear preserves choices and rolls independent copies inside chosen tiers", () => {
  const random = jest.spyOn(Math, "random").mockReturnValue(0);
  try {
    const first = createCustomItem(customDefinition);
    const second = createCustomItem(customDefinition);
    expect(first).toMatchObject({
      name: "Starforged Blade", slot: "weapon", rarity: "Unique", condition: "Perfect",
      ability: { name: "Undying Hunger" }, mainStat: { tier: 7 },
    });
    expect(first.id).not.toBe(second.id);
    expect(first.subTiers).toEqual(customDefinition.subStats);
    const secondValues = { ...second.subStats };
    const secondMain = second.mainStat.value;
    first.subStats.maxPower = 999;
    first.mainStat.value = 999;
    first.holofoil[0] = "#ffffff";
    expect(second.subStats).toEqual(secondValues);
    expect(second.mainStat.value).toBe(secondMain);
    expect(second.holofoil).toEqual(["#123456", "#abcdef"]);
    expect(random).toHaveBeenCalledTimes(10);
  } finally {
    random.mockRestore();
  }
});

test("custom holofoil can generate random colors instead of requiring explicit colors", () => {
  const random = jest.spyOn(Math, "random").mockReturnValue(0.5);
  try {
    const item = createCustomItem({ ...customDefinition, holofoil: true, subStats: {} });
    expect(item.holofoil).toEqual(["#800000", "#800000"]);
    expect(random).toHaveBeenCalledTimes(4);
  } finally {
    random.mockRestore();
  }
});

test("custom gear without holofoil or an ability never rolls either", () => {
  const random = jest.spyOn(Math, "random").mockReturnValue(0);
  try {
    const item = createCustomItem({ ...customDefinition, ability: "", holofoil: undefined, subStats: {} });
    expect(item).not.toHaveProperty("holofoil");
    expect(item.ability).toBeNull();
    expect(item.subStats).toEqual({});
    expect(random).toHaveBeenCalledTimes(1);
  } finally {
    random.mockRestore();
  }
});

test.each([
  { name: " " }, { slot: "invalid" }, { rarity: "Invalid" }, { condition: "Invalid" },
  { iLevel: 0 }, { iLevel: 1.5 }, { iLevel: Infinity }, { price: -1 }, { price: NaN },
  { mainStat: { stat: "strength", tier: NaN } },
  { mainStat: { stat: "strength", tier: 8 } },
  { mainStat: { stat: "strength", tier: 1.5 } },
  { mainStat: { stat: "invalid", tier: 1 } },
  { subStats: { luck: -1 } }, { subStats: { invalid: 1 } },
  { subStats: { luck: 8 } }, { subStats: { luck: 1.5 } },
  { ability: "invalid" }, { slot: "boots", twoHanded: false, ability: "Vampiric" },
  { slot: "helmet" }, { holofoil: ["", "#ffffff"] }, { holofoil: ["bad", "#ffffff"] },
])("custom gear rejects invalid choices: %j", (patch) => {
  expect(() => createCustomItem({ ...customDefinition, ...patch })).toThrow();
});

test.each([false, true])("all available custom tiers match displayed values (two-handed: %s)", (twoHanded) => {
  const caps = {
    defense: 0.48, speed: 0.77, resilience: 1.44, agility: 0.48, vitality: 2, luck: 0.34,
    attackMin: 1.2, attackMax: 2.4, magicAttackMin: 1.2, magicAttackMax: 2.4,
    maxPower: 0.15, criticalDamage: 0.006, attackPercent: 0.001, magicAttackPercent: 0.001,
  };
  const random = jest.spyOn(Math, "random");
  try {
    for (const level of [1, 2, 5, 25, 80]) {
      for (const tier of STAT_TIERS) {
        for (const rng of [0, 0.5, 0.999999]) {
          random.mockReturnValue(rng);
          const chosen = Object.fromEntries(SUBSTAT_NAMES
            .filter((stat) => getSubStatPool(customDefinition.slot).includes(stat))
            .filter((stat) => getCustomSubStatTiers(stat, level, twoHanded).includes(tier))
            .map((stat) => [stat, tier]));
          const item = createCustomItem({ ...customDefinition, iLevel: level, twoHanded,
            mainStat: { stat: "strength", tier }, subStats: chosen });
          expect(Math.round(item.mainStat.value / 22 * 7)).toBe(tier);
          expect(itemTooltip(item).stats[0].tier).toBe(`T${tier}`);
          const scale = twoHanded ? 1.5 : 1;
          for (const [stat, value] of Object.entries(item.subStats)) {
            const precision = stat === "criticalDamage" ? 100
              : ["attackPercent", "magicAttackPercent"].includes(stat) ? 1000 : 1;
            const scaled = (v) => precision > 1
              ? Math.round(v * scale * precision) / precision
              : Math.round(v * scale);
            const minRoll = stat === "criticalDamage" ? 0.01 : precision > 1 ? 1 / precision : 1;
            const min = scaled(minRoll);
            const maxRoll = Math.max(minRoll, Math.ceil(caps[stat] * level * precision) / precision);
            const max = scaled(maxRoll);
            const actualTier = max <= min ? 7 : Math.round((value - min) / (max - min) * 7);
            expect(value).toBeGreaterThanOrEqual(min);
            expect(value).toBeLessThanOrEqual(max);
            expect(actualTier).toBe(tier);
            expect(item.subTiers[stat]).toBe(actualTier);
          }
        }
      }
    }
  } finally {
    random.mockRestore();
  }
});

test("unrepresentable low-level tiers fail instead of rolling a different tier", () => {
  expect(getCustomSubStatTiers("luck", 1)).toEqual([7]);
  expect(() => createCustomItem({ ...customDefinition, slot: "helmet", twoHanded: false, iLevel: 1, subStats: { luck: 0 } }))
    .toThrow(/cannot roll T0/);
});

test("custom gear rejects substats that are not in its slot pool", () => {
  expect(() => createCustomItem({ ...customDefinition, subStats: { luck: 4 } }))
    .toThrow(/available for this slot/);
});
