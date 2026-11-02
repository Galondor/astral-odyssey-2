import {
  ENEMIES,
  getEnemyCandidates,
  getEnemyCriticalChance,
  getRandomEnemy,
  getUndergearFactor,
} from "../../combat/enemies";
import { MATERIALS } from "../../items/materials";
import { REGIONS, REGION_ORDER } from "../../world/regions";

jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(),
  setPlayer: jest.fn(),
}));

const spawnAtTemplateLevel = (template) =>
  getRandomEnemy(
    template.tier,
    template.regions[0],
    template.level,
    template.level * 150,
    template.id,
  );

beforeEach(() => {
  jest.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => jest.restoreAllMocks());

// Stats are written for `statLevel`; above it each level adds a share of the base, below it they shrink proportionally.
const growth = (template, level, k) => {
  const statLevel = template.statLevel ?? template.level;
  return level >= statLevel ? 1 + (level - statLevel) * k : level / statLevel;
};

test("enemy stats scale against the 150 gear-score-per-level target across every template", () => {
  for (const template of ENEMIES) {
    const enemy = spawnAtTemplateLevel(template);
    const tier = {
      basic: { hp: 1.1, attack: 2.4, defense: 5 },
      elite: { hp: 2.2, attack: 3, defense: 6.5 },
      boss: { hp: 4.5, attack: 3.8, defense: 7.5 },
    }[template.tier];
    const danger = REGIONS[template.regions[0]].danger;

    expect(enemy.level).toBe(template.level);
    expect(enemy.maxHp).toBe(Math.round(template.maxHp * growth(template, enemy.level, 0.5) * tier.hp * danger));
    expect(enemy.attack).toEqual(
      template.attack.map((value) => Math.round(value * growth(template, enemy.level, 0.4) * tier.attack * danger)),
    );
    expect(enemy.defense).toBe(Math.round(template.defense * growth(template, enemy.level, 0.3) * tier.defense * danger));
    expect(enemy.maxHp).toBeGreaterThan(0);
  }
});

test("enemy stats grow more strongly above the template level", () => {
  const template = ENEMIES.find((entry) => entry.id === "greenSlime");
  const enemy = getRandomEnemy(
    template.tier,
    template.regions[0],
    10,
    1500,
    template.id,
  );
  const levelDifference = enemy.level - (template.statLevel ?? template.level);
  const tier = { hp: 1.1, attack: 2.4, defense: 5 };

  expect(enemy.level).toBe(9);
  expect(enemy.maxHp).toBe(
    Math.round(template.maxHp * (1 + levelDifference * 0.5) * tier.hp),
  );
  expect(enemy.attack).toEqual(
    template.attack.map((value) =>
      Math.round(value * (1 + levelDifference * 0.4) * tier.attack),
    ),
  );
  expect(enemy.defense).toBe(
    Math.round(
      template.defense * (1 + levelDifference * 0.3) * tier.defense,
    ),
  );
  expect(enemy.speed).toBe(
    Math.round(template.speed * (1 + levelDifference * 0.3)),
  );
});

test("undergeared and well-geared players are scaled against the same gear-score target", () => {
  expect(getUndergearFactor(10, 0)).toBe(0.4);
  expect(getUndergearFactor(10, 1500)).toBe(1);
  expect(getUndergearFactor(10, 3000)).toBe(1);
});

test("each region's entry boss is tougher than the previous region's", () => {
  const entryBosses = REGION_ORDER.map((region) => {
    const boss = ENEMIES.filter((e) => e.tier === "boss" && e.regions.includes(region))
      .sort((a, b) => a.level - b.level)[0];
    return spawnAtTemplateLevel(boss);
  });
  for (let i = 1; i < entryBosses.length; i += 1) {
    expect(entryBosses[i].maxHp).toBeGreaterThan(entryBosses[i - 1].maxHp);
    expect(entryBosses[i].attack[1]).toBeGreaterThan(entryBosses[i - 1].attack[1]);
    expect(entryBosses[i].astra).toBeGreaterThan(entryBosses[i - 1].astra);
  }
});

test("Gelatinous King has reduced stats and a weaker recovery/enrage loop", () => {
  const king = spawnAtTemplateLevel(ENEMIES.find(({ id }) => id === "gelatinousKing"));
  expect(king).toMatchObject({ maxHp: 619, attack: [22, 48], defense: 38, critical: 0.064 });
  expect(king.abilities).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: "Engulf", power: 1.3, status: { id: "poison", turns: 3, power: 0.03, chance: 0.8 } }),
    expect.objectContaining({ name: "Acid Rain", power: 0.8, hits: 2 }),
    expect.objectContaining({ name: "Absorb", heal: 0.1, below: 0.6, cooldown: 4 }),
  ]));
  expect(king.phases[0]).toMatchObject({ self: { power: 0.3 }, heal: 0.08 });
});

test.each([["basic", 0.15, 0.15], ["elite", 0.25, 0.25], ["boss", 0.35, 0.28], ["boss", 0.08, 0.064]])(
  "%s critical chance %s scales to %s",
  (tier, chance, expected) => expect(getEnemyCriticalChance(tier, chance)).toBe(expected),
);

test("all overworld bosses use the reduced critical chance without changing other tiers", () => {
  for (const template of ENEMIES) {
    expect(spawnAtTemplateLevel(template).critical).toBe(
      template.tier === "boss" ? Math.round(template.critical * 800) / 1000 : template.critical,
    );
  }
});

test.each([
  ["SuncleftExpanse", ["duneJackal", "glassbackScorpion", "buriedWyrm", "sandscourNomad", "sunCursedSentinel"]],
  ["TempestReach", ["bilgeRaider", "reefStalker", "leviathan", "drownedDeckhand", "stormHarpy"]],
  ["FrostfallRange", ["frostfang", "rimeSentinel", "avalancheColossus", "snowdriftYeti", "frostWyvern"]],
  ["ShatteredFront", ["trenchScavenger", "frontlineVeteran", "siegeCaptain", "shellshockGunner", "ironcladJuggernaut"]],
])("%s has basic, elite, and boss enemies with unique regional drops", (region, ids) => {
  const roster = ENEMIES.filter((enemy) => enemy.regions.includes(region));

  expect([...new Set(roster.map(({ tier }) => tier))].sort()).toEqual(["basic", "boss", "elite"]);
  expect(roster.map(({ id }) => id).sort()).toEqual([...ids].sort());
  for (const enemy of roster) {
    expect(getEnemyCandidates(enemy.tier, region, enemy.level)).toContain(enemy);
    expect(enemy.drops).toHaveLength(1);
    expect(MATERIALS[enemy.drops[0].key]).toBeDefined();
    expect(MATERIALS[enemy.drops[0].key].tier).toBe(
      { basic: "common", elite: "rare", boss: "legendary" }[enemy.tier],
    );
    expect(getRandomEnemy(enemy.tier, region, enemy.level, enemy.level * 150, enemy.id).id)
      .toBe(enemy.id);
  }
});

test.each(REGION_ORDER)("every %s enemy belongs to that region alone and spawns within its level range", (region) => {
  const { minLevel, maxLevel } = REGIONS[region];
  const roster = ENEMIES.filter((enemy) => enemy.regions.includes(region));
  expect(roster.length).toBeGreaterThan(0);
  for (const enemy of roster) {
    expect(enemy.regions).toEqual([region]);
    expect(enemy.level).toBeGreaterThanOrEqual(minLevel);
    expect(enemy.level).toBeLessThanOrEqual(maxLevel);
  }
  expect(getEnemyCandidates("basic", region, minLevel).length).toBeGreaterThan(0);
  for (const tier of ["elite", "boss"]) {
    expect(getEnemyCandidates(tier, region, maxLevel).length).toBeGreaterThan(0);
  }
});

test("spawn levels are clamped to the region's range", () => {
  const low = getRandomEnemy("basic", "Darkwood", 1, 0);
  expect(low.level).toBe(10);
  jest.spyOn(Math, "random").mockReturnValue(0.99);
  expect(getRandomEnemy("basic", "Meadowlands", 100, 15000).level).toBe(10);
  expect(getRandomEnemy("basic", "ShatteredFront", 100, 15000).level).toBe(100);
});

test("later regions are more dangerous and drop better gear", () => {
  for (let i = 1; i < REGION_ORDER.length; i += 1) {
    const [prev, next] = [REGIONS[REGION_ORDER[i - 1]], REGIONS[REGION_ORDER[i]]];
    expect(next.danger).toBeGreaterThan(prev.danger);
    expect(next.reward).toBeGreaterThan(prev.reward);
  }
  expect(getRandomEnemy("basic", "Meadowlands", 1, 150).minRarity).toBeLessThan(
    getRandomEnemy("basic", "ShatteredFront", 85, 85 * 150).minRarity,
  );
});

test("the Living Scarecrow is an elite Meadowlands enemy with its own material", () => {
  const enemy = ENEMIES.find(({ id }) => id === "livingScarecrow");

  expect(enemy).toEqual(
    expect.objectContaining({
      tier: "elite",
      regions: ["Meadowlands"],
      drops: [{ key: "living_thatch", chance: 0.75, min: 1, max: 2 }],
    }),
  );
  expect(MATERIALS.living_thatch).toBeDefined();
  expect(getEnemyCandidates("elite", "Meadowlands", 5)).toContain(enemy);
});
