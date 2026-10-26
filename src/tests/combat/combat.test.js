import { getPlayer, setPlayer } from "../../character/player";
import { attackRound, getEnemy, startCombat } from "../../combat/combat";

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

test("Bloom of Decay can weaken and poison an enemy on a hit", () => {
  jest.spyOn(Math, "random").mockReturnValue(0);

  attackRound("melee");

  expect(getEnemy().statuses.map(({ id }) => id)).toEqual(
    expect.arrayContaining(["weaken", "poison"]),
  );
  expect(setPlayer).toHaveBeenCalled();
});

test("Bloom of Decay does not apply effects when their chance roll fails", () => {
  jest.spyOn(Math, "random").mockReturnValue(0.5);

  attackRound("melee");

  expect(getEnemy().statuses).toEqual([]);
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
  expect(setPlayer.mock.calls.at(-1)[0].consumables).toEqual({ prismaticAlloy: 1 });
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
  expect(replies.some((line) => line.includes("Prismatic Alloy"))).toBe(true);
});

test("Prismatic Alloy drop chance excludes the exact 0.5% threshold", () => {
  getPlayer.mockReturnValue({ ...player, level: 1, inventory: [], equipment: {} });
  startCombat({ name: "Target", maxHp: 1, defense: 0, speed: 1, tier: "basic" });
  jest.spyOn(Math, "random").mockReturnValue(0.005);
  const { replies, over } = attackRound("melee");
  expect(over).toBe(true);
  expect(setPlayer.mock.calls.at(-1)[0].consumables).toBeUndefined();
  expect(replies.some((line) => line.includes("Prismatic Alloy"))).toBe(false);
});
