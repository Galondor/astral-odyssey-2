import { getPlayer, setPlayer } from "../../character/player";
import { attackRound, getCombatRound, getEnemy, getMarrowWard, startCombat } from "../../combat/combat";

jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(),
  setPlayer: jest.fn(),
}));

const player = {
  stats: {
    speed: 20,
    attackMin: 1,
    attackMax: 1,
    magicAttackMin: 1,
    magicAttackMax: 1,
    criticalHitChance: 0,
    criticalDamageBonus: 2,
    power: 0,
    maxPower: 0,
    health: 100,
    maxHealth: 100,
    defense: 0,
  },
  equipment: {
    weapon: { ability: { name: "Bloom of Decay" } },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  getPlayer.mockReturnValue(player);
  startCombat({
    name: "Target",
    maxHp: 1000,
    defense: 0,
    speed: 1,
    abilities: [],
  });
});

afterEach(() => jest.restoreAllMocks());

test("combat rounds start at one and advance after each completed player turn", () => {
  expect(getCombatRound()).toBe(1);

  attackRound("melee");

  expect(getCombatRound()).toBe(2);
});

test("victories record enemy tier kills and the highest single hit", () => {
  startCombat({
    name: "Basic Target",
    tier: "basic",
    maxHp: 1,
    defense: 0,
    speed: 1,
    abilities: [],
  });

  const result = attackRound("melee");

  expect(result.over).toBe(true);
  expect(setPlayer).toHaveBeenCalledWith(
    expect.objectContaining({
      records: expect.objectContaining({
        basicEnemiesKilled: 1,
        mostDamageDealt: 1,
      }),
    }),
  );
});

test("Colosseum victories halve astra and experience and award only their configured material", () => {
  getPlayer.mockReturnValue({
    ...player,
    astra: 100,
    inventory: [],
    stats: { ...player.stats, exp: 0 },
  });
  startCombat({
    name: "Pit Recruit",
    tier: "basic",
    maxHp: 1,
    astra: 11,
    exp: 9,
    attack: [1, 1],
    defense: 0,
    speed: 1,
    abilities: [],
    colosseum: true,
    colosseumWave: 4,
    drops: [{ key: "broken_blade_fragments", chance: 1, min: 1, max: 1 }],
    dropChance: 1,
  });
  jest.spyOn(Math, "random").mockReturnValue(0);

  const result = attackRound("melee");
  const patch = setPlayer.mock.calls.at(-1)[0];

  expect(result.outcome).toBe("victory");
  expect(result.replies.join(" ")).toContain("You gain 4 exp and 5");
  expect(patch.astra).toBe(105);
  expect(patch.records.highestClearedColosseumWave).toBe(4);
  expect(patch.materials).toEqual({ broken_blade_fragments: 1 });
  expect(patch.inventory).toBeUndefined();
  expect(patch.gemstones).toBeUndefined();
});

test("an uncleared Colosseum wave never increases the cleared-wave record", () => {
  getPlayer.mockReturnValue({
    ...player,
    records: { highestClearedColosseumWave: 3 },
  });
  startCombat({
    name: "Pit Recruit",
    maxHp: 1000,
    defense: 0,
    speed: 1,
    colosseum: true,
    colosseumWave: 4,
  });
  attackRound("melee");
  expect(setPlayer.mock.calls.at(-1)[0].records.highestClearedColosseumWave).toBe(3);
});

test("World Boss combat ends after ten completed rounds", () => {
  getPlayer.mockReturnValue({ ...player, equipment: {} });
  startCombat({
    name: "Astral Colossus",
    maxHp: 1_000_000,
    attack: [1, 1],
    defense: 0,
    speed: 1,
    abilities: [],
    worldBossCycle: "cycle",
    maxRounds: 10,
  });

  for (let round = 1; round < 10; round++) {
    const result = attackRound("melee");
    expect(result.over).toBe(false);
    expect(getCombatRound()).toBe(round + 1);
  }

  const result = attackRound("melee");
  expect(result.over).toBe(true);
  expect(result.replies.join(" ")).toContain("forces you from the fight after 10 rounds");
  expect(getEnemy()).toBeNull();
  expect(getCombatRound()).toBeNull();
});

test("Bloom of Decay adds a poison stack on every hit", () => {
  jest.spyOn(Math, "random").mockReturnValue(0);

  attackRound("melee");

  expect(getEnemy().statuses.find(({ id }) => id === "poison").stacks).toBe(1);
  attackRound("melee");
  expect(getEnemy().statuses.find(({ id }) => id === "poison").stacks).toBe(2);
  expect(setPlayer).toHaveBeenCalled();
});

test("Marrow Ward absorbs damage at the start of combat", () => {
  getPlayer.mockReturnValue({
    ...player,
    equipment: { chestplate: { ability: { name: "Marrow Ward" } } },
  });
  startCombat({
    name: "Target",
    maxHp: 1000,
    attack: [10, 10],
    defense: 0,
    speed: 1,
    critical: 0,
    abilities: [],
  });
  jest.spyOn(Math, "random").mockReturnValue(0);

  const { replies } = attackRound("melee");

  expect(replies).toContain("Marrow Ward absorbs 10 damage (10 ward remains).");
  expect(getMarrowWard()).toEqual({ current: 10, max: 20 });
  expect(setPlayer.mock.calls.at(-1)[0].stats.health).toBe(100);
});

test("Frozen Resolve has a chance to stun an enemy that hits the player", () => {
  getPlayer.mockReturnValue({
    ...player,
    stats: { ...player.stats, health: 100 },
    equipment: { helmet: { ability: { name: "Frozen Resolve" } } },
  });
  startCombat({
    name: "Target",
    maxHp: 1000,
    attack: [10, 10],
    defense: 0,
    speed: 1,
    critical: 0,
    abilities: [],
  });
  jest.spyOn(Math, "random").mockReturnValue(0);

  const { replies } = attackRound("melee");

  expect(replies).toContain("Frozen Resolve stuns the attacker!");
  expect(setPlayer.mock.calls.at(-1)[0].stats.health).toBe(90);
  expect(getEnemy().statuses.map(({ id }) => id)).toContain("stun");
});

test("Glacial Edge consumes vulnerability for a shattering strike", () => {
  getPlayer.mockReturnValue({
    ...player,
    stats: { ...player.stats, attackMin: 100, attackMax: 100 },
    equipment: { weapon: { ability: { name: "Glacial Edge" } } },
  });
  startCombat({
    name: "Target",
    maxHp: 1000,
    defense: 0,
    speed: 1,
    abilities: [],
  });
  getEnemy().statuses.push({ id: "vulnerable", turns: 3, power: 0.25, stacks: 1 });
  jest.spyOn(Math, "random").mockReturnValue(0.1);

  const { replies } = attackRound("melee");

  expect(replies.some((reply) => reply.includes("{{169|"))).toBe(true);
  expect(replies).toContain("Glacial Edge shatters the enemy's vulnerability!");
  expect(getEnemy().statuses.some(({ id }) => id === "vulnerable")).toBe(false);
});

test.each([
  ["Fortune's Spark", "Fortune's Spark activates"],
  ["Orbital Focus", "Orbital Focus launches a shard"],
])("%s reports its critical-hit effect when it activates", (ability, expectedReply) => {
  getPlayer.mockReturnValue({
    ...player,
    equipment: { weapon: { ability: { name: ability } } },
    stats: { ...player.stats, criticalHitChance: 1 },
  });
  startCombat({
    name: "Target",
    maxHp: 1000,
    defense: 0,
    speed: 1,
    abilities: [],
  });
  jest.spyOn(Math, "random").mockReturnValue(0);

  const { replies } = attackRound("melee");

  expect(replies).toContain("Critical hit!");
  expect(replies.some((reply) => reply.includes(expectedReply))).toBe(true);
});

test.each([
  [0, 100, 960],
  [0.999, 300, 920],
])("Fortune's Spark rolls %s for a +%s%% damage bonus", (bonusRoll, bonusPercent, expectedHp) => {
  getPlayer.mockReturnValue({
    ...player,
    equipment: { weapon: { ability: { name: "Fortune's Spark" } } },
    stats: { ...player.stats, attackMin: 10, attackMax: 10, criticalHitChance: 1 },
  });
  startCombat({
    name: "Target",
    maxHp: 1000,
    defense: 0,
    speed: 1,
    abilities: [],
  });
  jest.spyOn(Math, "random")
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(bonusRoll);

  const { replies } = attackRound("melee");

  expect(replies).toContain(`Fortune's Spark activates for +${bonusPercent}% damage!`);
  expect(getEnemy().hp).toBe(expectedHp);
});

test("Fortune's Spark does not activate when its chance roll fails", () => {
  getPlayer.mockReturnValue({
    ...player,
    equipment: { weapon: { ability: { name: "Fortune's Spark" } } },
    stats: { ...player.stats, attackMin: 10, attackMax: 10, criticalHitChance: 1 },
  });
  startCombat({
    name: "Target",
    maxHp: 1000,
    defense: 0,
    speed: 1,
    abilities: [],
  });
  jest.spyOn(Math, "random")
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0.25);

  const { replies } = attackRound("melee");

  expect(replies).not.toContain("Fortune's Spark activates for +100% damage!");
  expect(getEnemy().hp).toBe(980);
});

test("Molten Grip detonates twice one burn tick and consumes the burn", () => {
  getPlayer.mockReturnValue({
    ...player,
    equipment: { weapon: { ability: { name: "Molten Grip" } } },
  });
  startCombat({
    name: "Target",
    maxHp: 1000,
    defense: 0,
    speed: 1,
    abilities: [],
  });
  getEnemy().statuses.push({ id: "burn", turns: 3, power: 0.04, stacks: 1 });
  jest.spyOn(Math, "random").mockReturnValue(0.5);

  const { replies } = attackRound("melee");

  expect(replies.some((reply) => reply.includes("{{80|"))).toBe(true);
  expect(getEnemy().hp).toBe(919);
  expect(getEnemy().statuses.some(({ id }) => id === "burn")).toBe(false);
});

test("Unwritten Path doubles every third strike and ignores enemy defense", () => {
  getPlayer.mockReturnValue({
    ...player,
    equipment: { weapon: { ability: { name: "Unwritten Path" } } },
    stats: { ...player.stats, attackMin: 10, attackMax: 10 },
  });
  startCombat({
    name: "Armored Target",
    maxHp: 1000,
    defense: 9,
    speed: 1,
    abilities: [],
  });
  jest.spyOn(Math, "random").mockReturnValue(0);

  const first = attackRound("melee");
  const second = attackRound("melee");
  const third = attackRound("melee");

  expect(first.replies.some((reply) => reply.includes("Unwritten Path"))).toBe(false);
  expect(second.replies.some((reply) => reply.includes("Unwritten Path"))).toBe(false);
  expect(third.replies).toContain(
    "Unwritten Path finds a shortcut, bypassing defense for a doubled strike!",
  );
  expect(third.replies.some((reply) => reply.includes("{{20|"))).toBe(true);
  expect(getEnemy().hp).toBe(978);
});

test("Tempered Steel blocks and counters every second enemy strike", () => {
  getPlayer.mockReturnValue({
    ...player,
    equipment: { chestplate: { ability: { name: "Tempered Steel" } } },
  });
  startCombat({
    name: "Target",
    maxHp: 1000,
    attack: [10, 10],
    defense: 0,
    speed: 1,
    critical: 0,
    abilities: [],
  });
  jest.spyOn(Math, "random").mockReturnValue(0);

  const first = attackRound("melee");
  const second = attackRound("melee");

  expect(first.replies.some((reply) => reply.includes("turns the strike aside"))).toBe(false);
  expect(second.replies).toContain("Tempered Steel turns the strike aside!");
  expect(setPlayer.mock.calls.at(-1)[0].stats.health).toBe(100);
});

test("Star-Charted's aligned strike deals 150% more damage", () => {
  getPlayer.mockReturnValue({
    ...player,
    equipment: { ring: { ability: { name: "Star-Charted" } } },
    skills: { backstab: 1 },
    stats: {
      ...player.stats,
      attackMin: 10,
      attackMax: 10,
      magicAttackMin: 10,
      magicAttackMax: 10,
      power: 10,
      maxPower: 10,
    },
  });
  startCombat({
    name: "Target",
    maxHp: 1000,
    defense: 0,
    speed: 1,
    abilities: [],
  });
  jest.spyOn(Math, "random").mockReturnValue(0.5);

  attackRound("melee");
  attackRound("magic");
  attackRound("melee", "backstab");
  const { replies } = attackRound("melee");

  expect(replies.some((reply) => reply.includes("{{25|"))).toBe(true);
  expect(replies).toContain("The constellation aligns and locks the enemy in place!");
});

test("skill bonuses cannot raise critical chance above 60 percent", () => {
  getPlayer.mockReturnValue({
    ...player,
    class: "Swordsman",
    skills: { backstab: 1 },
    stats: {
      ...player.stats,
      speed: 20,
      criticalHitChance: 0.55,
      power: 3,
    },
  });
  startCombat({
    name: "Target",
    maxHp: 1000,
    defense: 0,
    speed: 1,
    abilities: [],
  });
  jest.spyOn(Math, "random").mockReturnValue(0.65);

  const { replies } = attackRound("melee", "backstab");

  expect(replies).not.toContain("Critical hit!");
});

test("evasion cannot exceed 60 percent during combat", () => {
  getPlayer.mockReturnValue({
    ...player,
    class: "Swordsman",
    stats: { ...player.stats, evasion: 0.8 },
  });
  startCombat({
    name: "Target",
    maxHp: 1000,
    attack: [1, 1],
    defense: 0,
    speed: 1,
    abilities: [],
  });
  jest.spyOn(Math, "random").mockReturnValue(0.65);

  const { replies } = attackRound("melee");

  expect(replies.some((reply) => reply.includes("evade"))).toBe(false);
});

test("Fireball burn reduces enemy healing by 25%", () => {
  getPlayer.mockReturnValue({
    ...player,
    skills: { fireball: 1 },
    stats: {
      ...player.stats,
      magicAttackMin: 300,
      magicAttackMax: 300,
      power: 5,
      maxPower: 5,
    },
  });
  startCombat({
    name: "Target",
    maxHp: 1000,
    defense: 0,
    speed: 1,
    abilities: [],
    phases: [{ below: 1.1, text: "The target recovers.", heal: 0.2 }],
  });

  const { replies } = attackRound("magic", "fireball");

  expect(getEnemy().statuses.map(({ id }) => id)).toContain("burn");
  expect(replies).toContain("The Target recovers 150 health.");
});

test.each([
  [false, "elite", 0.1], [false, "boss", 0.25],
  [true, "elite", 0.15], [true, "boss", 0.3],
])("certificate drops at the exact threshold for dungeon=%s tier=%s", (dungeon, tier, chance) => {
  for (const [roll, drops] of [[0, true], [chance - 0.000001, true], [chance, false], [0.999, false]]) {
    const hero = {
      ...player, level: 1, inventory: [], consumables: { itemCertificate: 2, healthPotion: 4 },
      equipment: {}, stats: { ...player.stats, luck: 300 },
    };
    getPlayer.mockReturnValue(hero);
    startCombat({ name: "Target", maxHp: 1, defense: 0, speed: 1, tier, dungeon, dropChance: 0 });
    jest.spyOn(Math, "random").mockReturnValue(roll);
    const { replies, over } = attackRound("melee");
    expect(over).toBe(true);
    const patch = setPlayer.mock.calls.at(-1)[0];
    expect(patch.consumables?.itemCertificate ?? 2).toBe(drops ? 3 : 2);
    if (drops) expect(patch.consumables.healthPotion).toBe(4);
    expect(replies.some((line) => line.includes("Item Certificate"))).toBe(drops);
    jest.restoreAllMocks();
  }
});

test.each([false, true])("basic enemies never drop certificates (dungeon=%s)", (dungeon) => {
  getPlayer.mockReturnValue({ ...player, level: 1, equipment: {} });
  startCombat({ name: "Target", maxHp: 1, defense: 0, speed: 1, tier: "basic", dungeon });
  jest.spyOn(Math, "random").mockReturnValue(0);
  const { replies } = attackRound("melee");
  expect(setPlayer.mock.calls.at(-1)[0].consumables).toEqual({
    prismaticAlloy: 1,
    ...(!dungeon && { runeOfUnpredictability: 1 }),
  });
  expect(replies.some((line) => line.includes("Item Certificate"))).toBe(false);
});

test("certificates are not awarded before an elite is defeated", () => {
  startCombat({ name: "Target", maxHp: 1000, defense: 0, speed: 1, tier: "elite" });
  jest.spyOn(Math, "random").mockReturnValue(0);
  const { over, replies } = attackRound("melee");
  expect(over).toBe(false);
  expect(setPlayer.mock.calls.at(-1)[0].consumables).toBeUndefined();
  expect(replies.some((line) => line.includes("Item Certificate"))).toBe(false);
});

test.each(["basic", "elite", "boss"])("any defeated %s enemy can drop a Prismatic Alloy", (tier) => {
  getPlayer.mockReturnValue({
    ...player, level: 1, inventory: [], equipment: {}, consumables: { prismaticAlloy: 2 },
  });
  startCombat({ name: "Target", maxHp: 1, defense: 0, speed: 1, tier });
  jest.spyOn(Math, "random").mockReturnValue(0);
  const { replies, over } = attackRound("melee");
  expect(over).toBe(true);
  expect(setPlayer.mock.calls.at(-1)[0].consumables.prismaticAlloy).toBe(3);
  expect(setPlayer.mock.calls.at(-1)[0].consumables.runeOfUnpredictability).toBe(1);
  expect(replies.some((line) => line.includes("Prismatic Alloy"))).toBe(true);
});

test("Prismatic Alloy drop chance excludes the exact 0.5% threshold", () => {
  getPlayer.mockReturnValue({ ...player, level: 1, inventory: [], equipment: {} });
  startCombat({ name: "Target", maxHp: 1, defense: 0, speed: 1, tier: "basic" });
  jest.spyOn(Math, "random").mockReturnValue(0.005);
  const { replies, over } = attackRound("melee");
  expect(over).toBe(true);
  expect(setPlayer.mock.calls.at(-1)[0].consumables).toEqual({ runeOfUnpredictability: 1 });
  expect(replies.some((line) => line.includes("Prismatic Alloy"))).toBe(false);
});

test.each([[0, true], [0.009999, true], [0.01, false]])(
  "adventures drop the Rune of Unpredictability at 1%% (roll=%s)",
  (roll, drops) => {
    getPlayer.mockReturnValue({ ...player, level: 1, inventory: [], equipment: {} });
    startCombat({ name: "Target", maxHp: 1, defense: 0, speed: 1, tier: "basic", dropChance: 0 });
    jest.spyOn(Math, "random").mockReturnValue(roll);

    const { replies, over } = attackRound("melee");

    expect(over).toBe(true);
    expect(setPlayer.mock.calls.at(-1)[0].consumables?.runeOfUnpredictability).toBe(drops ? 1 : undefined);
    expect(replies.some((line) => line.includes("Rune of Unpredictability"))).toBe(drops);
  },
);

const uniquePlayer = (slot, name, stats = {}) => ({
  ...player,
  equipment: { [slot]: { ability: { name } } },
  stats: { ...player.stats, attackMin: 10, attackMax: 10, health: 50, ...stats },
});

test("Saltblood Tide bleeds the enemy and every 4th hit draws out the bleed to heal", () => {
  getPlayer.mockReturnValue(uniquePlayer("weapon", "Saltblood Tide"));
  startCombat({ name: "Target", maxHp: 1000, defense: 0, speed: 1, attack: [1, 1], abilities: [] });
  jest.spyOn(Math, "random").mockReturnValue(0.5);

  const early = [attackRound("melee"), attackRound("melee"), attackRound("melee")];
  expect(getEnemy().statuses.some(({ id }) => id === "bleed")).toBe(true);
  expect(early.some(({ replies }) => replies.some((r) => r.includes("Saltblood Tide breaks")))).toBe(false);

  const { replies } = attackRound("melee");
  expect(replies.some((r) => r.startsWith("Saltblood Tide breaks") && r.includes("{{90|"))).toBe(true);
  expect(replies).toContain("Saltblood Tide: you recover [green]15[/green] health.");
  expect(getEnemy().statuses.some(({ id }) => id === "bleed")).toBe(false);
});

test("Chronal Loop echoes every third action at 30% power", () => {
  getPlayer.mockReturnValue(uniquePlayer("offhand", "Chronal Loop"));
  startCombat({ name: "Target", maxHp: 1000, defense: 0, speed: 1, attack: [1, 1], abilities: [] });
  jest.spyOn(Math, "random").mockReturnValue(0.5);

  const first = attackRound("melee");
  const second = attackRound("melee");
  const third = attackRound("melee");

  const echoed = (result) => result.replies.some((r) => r.startsWith("Chronal Loop"));
  expect(echoed(first) || echoed(second)).toBe(false);
  expect(third.replies.some((r) => r.startsWith("Chronal Loop: your strike echoes") && r.includes("{{3|"))).toBe(true);
  expect(getEnemy().hp).toBe(1000 - 30 - 3);
});

test("Star-Eater's Hunger devours an enemy buff, heals, and stacks damage", () => {
  getPlayer.mockReturnValue(uniquePlayer("helmet", "Star-Eater's Hunger"));
  startCombat({ name: "Target", maxHp: 1000, defense: 0, speed: 1, attack: [1, 1], abilities: [] });
  getEnemy().statuses.push({ id: "enrage", turns: 3, power: 0.5, stacks: 1 });
  jest.spyOn(Math, "random").mockReturnValue(0.5);

  const first = attackRound("melee");
  expect(first.replies.some((r) => r.includes("Star-Eater's Hunger devours the Target's Enraged effect (+15% damage)"))).toBe(true);
  expect(first.replies).toContain("Star-Eater's Hunger: you recover [green]10[/green] health.");
  expect(getEnemy().statuses.some(({ id }) => id === "enrage")).toBe(false);

  const second = attackRound("melee");
  expect(second.replies.some((r) => r.includes("{{12|"))).toBe(true);
});
