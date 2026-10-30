import {
  addEnemy,
  createGroupCombat,
  createGroupMember,
  livingEnemies,
  resolveGroupRound,
} from "../../combat/groupCombat";

jest.mock("../../character/player", () => ({ getPlayer: () => null, setPlayer: jest.fn() }));

const player = (name, overrides = {}) => ({
  name,
  level: 40,
  class: null,
  stats: {
    maxHealth: 1000, health: 1000, maxPower: 40, power: 40, maxStamina: 10, stamina: 10,
    attackMin: 100, attackMax: 100, magicAttackMin: 100, magicAttackMax: 100,
    defense: 0, evasion: 0, speed: 10, criticalHitChance: 0, criticalDamageBonus: 1.5, luck: 0,
  },
  skills: { mendingLight: 1, purify: 3, provoke: 1, aegis: 1, battleHymn: 1 },
  equippedSkills: ["mendingLight", "purify", "provoke"],
  consumables: { healthPotion: 2 },
  ...overrides,
});

const dummy = (overrides = {}) => ({
  name: "Dummy", tier: "basic", maxHp: 10000, attack: [50, 50], defense: 0, speed: 1, critical: 0,
  stunResist: 0, dotResist: 1, abilities: [], phases: [], ...overrides,
});

const party = (...names) =>
  Object.fromEntries(names.map((name) => [name, createGroupMember(name, player(name))]));

const env = (spawn = () => dummy()) => ({ spawn });

beforeEach(() => jest.spyOn(Math, "random").mockReturnValue(0.5));
afterEach(() => jest.restoreAllMocks());

test("createGroupMember starts at full health and only keeps combat consumables", () => {
  const m = createGroupMember("a", player("A", { stats: { ...player("A").stats, health: 1 }, consumables: { healthPotion: 2, itemCertificate: 4 } }));
  expect(m.stats.health).toBe(1000);
  expect(m.consumables).toEqual({ healthPotion: 2 });
  expect(m.equipped).toEqual(["mendingLight", "purify", "provoke"]);
});

test("players attack enemies and the encounter is won when every enemy dies", () => {
  const c = createGroupCombat(party("A", "B"), { enemies: ["x"] }, () => dummy({ maxHp: 150 }));
  const target = c.enemies[0].uid;
  const { outcome, log } = resolveGroupRound(c, { A: { type: "melee", target }, B: { type: "magic", target } }, env());
  expect(outcome).toBe("victory");
  expect(log.join("\n")).toContain("defeated");
});

test("Guard redirects enemy hits from the protected ally to the guardian", () => {
  const c = createGroupCombat(party("A", "B"), { enemies: ["x"] }, () => dummy());
  c.enemies[0].threat = { B: 1000 };
  const before = { A: c.players.A.stats.health, B: c.players.B.stats.health };
  resolveGroupRound(c, { A: { type: "guard", target: "B" }, B: { type: "pass" } }, env());
  expect(c.players.B.stats.health).toBe(before.B);
  expect(c.players.A.stats.health).toBeLessThan(before.A);
});

test("Provoke taunts every enemy onto the caster", () => {
  const c = createGroupCombat(party("A", "B"), { enemies: ["x", "y"] }, () => dummy());
  for (const e of c.enemies) e.threat = { A: 1000 };
  resolveGroupRound(c, { B: { type: "skill", key: "provoke", target: "B" } }, env());
  expect(c.players.A.stats.health).toBe(1000);
  expect(c.players.B.stats.health).toBeLessThan(1000);
});

test("Mending Light heals an ally and builds a little threat", () => {
  const c = createGroupCombat(party("A", "B"), { enemies: ["x"] }, () => dummy({ attack: [1, 1] }));
  c.players.B.stats.health = 300;
  resolveGroupRound(c, { A: { type: "skill", key: "mendingLight", target: "B" } }, env());
  expect(c.players.B.stats.health).toBeGreaterThan(300);
  expect(c.players.A.stats.power).toBe(36);
  expect(c.players.A.healingDone).toBeGreaterThan(0);
});

test("potions can be used on an ally and are recorded as spent", () => {
  const c = createGroupCombat(party("A", "B"), { enemies: ["x"] }, () => dummy({ attack: [1, 1] }));
  c.players.B.stats.health = 100;
  resolveGroupRound(c, { A: { type: "item", key: "healthPotion", target: "B" } }, env());
  expect(c.players.B.stats.health).toBeGreaterThan(100);
  expect(c.players.A.consumables.healthPotion - c.players.A.spent.healthPotion).toBe(1);
  expect(c.players.A.spent.healthPotion).toBe(1);
});

test("Purify removes cleansable debuffs from an ally but not run-wide afflictions", () => {
  const c = createGroupCombat(party("A", "B"), { enemies: ["x"], startStatus: "temporalRot" }, () => dummy({ attack: [1, 1] }));
  c.players.B.statuses.push({ id: "poison", turns: 3, power: 0.02, stacks: 1 });
  resolveGroupRound(c, { A: { type: "skill", key: "purify", target: "B" } }, env());
  const ids = c.players.B.statuses.map((st) => st.id);
  expect(ids).not.toContain("poison");
  expect(ids).toContain("temporalRot");
});

test("waves advance when every enemy of the current wave dies", () => {
  const c = createGroupCombat(party("A"), { waves: [["x"], ["y", "y"]] }, () => dummy({ maxHp: 50 }));
  const { outcome } = resolveGroupRound(c, { A: { type: "melee", target: c.enemies[0].uid } }, env(() => dummy({ maxHp: 50 })));
  expect(outcome).toBeNull();
  expect(livingEnemies(c)).toHaveLength(2);
  expect(c.waveIndex).toBe(1);
});

test("a survive objective wins after the required rounds even with enemies alive", () => {
  const c = createGroupCombat(party("A"), { enemies: ["x"], survive: 2 }, () => dummy({ attack: [1, 1] }));
  expect(resolveGroupRound(c, {}, env()).outcome).toBeNull();
  expect(resolveGroupRound(c, {}, env()).outcome).toBe("victory");
});

test("the party wipes when every member falls", () => {
  const c = createGroupCombat(party("A"), { enemies: ["x"] }, () => dummy({ attack: [5000, 5000] }));
  expect(resolveGroupRound(c, {}, env()).outcome).toBe("wipe");
});

test("split shards reform unless they all fall within two rounds of each other", () => {
  const c = createGroupCombat(party("A", "B", "C"), { enemies: ["boss"] }, () =>
    dummy({ maxHp: 1000, attack: [1, 1], phases: [{ below: 0.5, mechanic: "split", into: "shard", count: 2, shardHp: 0.1 }] }));
  const boss = c.enemies[0];
  boss.hp = 499;
  resolveGroupRound(c, { A: { type: "melee", target: boss.uid } }, env(() => dummy({ maxHp: 100, attack: [1, 1] })));
  // The hit triggered the split; shards spawned
  const shards = c.enemies.filter((e) => e.linkGroup === boss.uid);
  expect(boss.hidden).toBe(true);
  expect(shards).toHaveLength(2);
  // Kill only one shard: it stays down for one more round, then reforms
  resolveGroupRound(c, { A: { type: "melee", target: shards[0].uid } }, env());
  expect(shards[0].dead).toBe(true);
  resolveGroupRound(c, {}, env());
  expect(shards[0].dead).toBe(false);
  // Kill one, then the other on the following round
  resolveGroupRound(c, { A: { type: "melee", target: shards[0].uid } }, env());
  const { outcome } = resolveGroupRound(c, { B: { type: "melee", target: shards[1].uid } }, env());
  expect(boss.dead).toBe(true);
  expect(outcome).toBe("victory");
});

test("melee attacks glance off an enemy immune to melee", () => {
  const c = createGroupCombat(party("A"), { enemies: ["x"] }, () => dummy({ immune: "melee", attack: [1, 1] }));
  const e = c.enemies[0];
  resolveGroupRound(c, { A: { type: "melee", target: e.uid } }, env());
  expect(e.hp).toBe(e.maxHp);
  resolveGroupRound(c, { A: { type: "magic", target: e.uid } }, env());
  expect(e.hp).toBeLessThan(e.maxHp);
});

test("doom detonates on an unguarded target and splashes the party", () => {
  const c = createGroupCombat(party("A", "B"), { enemies: ["x"] }, () => dummy({ attack: [1, 1] }));
  c.players.A.statuses.push({ id: "doom", turns: 1, power: 0.6, stacks: 1 });
  resolveGroupRound(c, {}, env());
  expect(c.players.A.stats.health).toBeLessThanOrEqual(400);
  expect(c.players.B.stats.health).toBeLessThanOrEqual(800);
});

test("guarding a doomed ally absorbs the detonation", () => {
  const c = createGroupCombat(party("A", "B"), { enemies: ["x"] }, () => dummy({ attack: [1, 1] }));
  c.players.A.statuses.push({ id: "doom", turns: 1, power: 0.6, stacks: 1 });
  resolveGroupRound(c, { B: { type: "guard", target: "A" } }, env());
  expect(c.players.A.stats.health).toBeGreaterThan(900);
  expect(c.players.B.stats.health).toBeGreaterThan(600);
});

test("summoned adds shield a boss that has the shieldWhileAdds mechanic", () => {
  const c = createGroupCombat(party("A"), { enemies: ["boss"] }, () => dummy({ attack: [1, 1] }));
  const boss = c.enemies[0];
  boss.shieldWhileAdds = true;
  addEnemy(c, dummy({ name: "Add", attack: [1, 1] }));
  resolveGroupRound(c, { A: { type: "melee", target: boss.uid } }, env());
  const shielded = boss.maxHp - boss.hp;
  boss.hp = boss.maxHp;
  c.enemies[1].dead = true;
  resolveGroupRound(c, { A: { type: "melee", target: boss.uid } }, env());
  expect(boss.maxHp - boss.hp).toBeGreaterThan(shielded);
});

const withUnique = (c, id, effect) => {
  c.players[id].ab.uniqueEffects = [effect];
  return c.players[id];
};

test("Saltblood Tide bleeds, then every 4th hit draws out the bleed to heal the most wounded ally", () => {
  const c = createGroupCombat(party("A", "B"), { enemies: ["x"] }, () => dummy({ maxHp: 100000, attack: [1, 1] }));
  const a = withUnique(c, "A", "saltbloodTide");
  c.players.B.stats.health = 300;
  const target = c.enemies[0].uid;
  const logs = [];
  for (let i = 0; i < 4; i += 1) logs.push(resolveGroupRound(c, { A: { type: "melee", target } }, env()).log.join("\n"));
  expect(logs.slice(0, 3).some((log) => log.includes("Saltblood Tide breaks"))).toBe(false);
  expect(logs[3]).toContain("A's Saltblood Tide breaks, drawing out the bleed for [red]9000[/red] damage!");
  expect(logs[3]).toContain("Saltblood Tide: B recovers [green]150[/green] health.");
  expect(c.enemies[0].statuses.some((st) => st.id === "bleed")).toBe(false);
  expect(a.tideHits).toBe(0);
});

test("Chronal Loop echoes every third attack and repeats support healing", () => {
  const c = createGroupCombat(party("A", "B"), { enemies: ["x"] }, () => dummy({ maxHp: 100000, attack: [1, 1] }));
  withUnique(c, "A", "temporalEcho");
  const target = c.enemies[0].uid;
  const round = (intent) => resolveGroupRound(c, { A: intent }, env()).log.join("\n");
  expect(round({ type: "melee", target })).not.toContain("Chronal Loop");
  expect(round({ type: "melee", target })).not.toContain("Chronal Loop");
  expect(round({ type: "melee", target })).toContain("Chronal Loop: A's strike echoes into the Dummy for [red]30[/red] damage.");

  c.players.B.stats.health = 100;
  round({ type: "skill", key: "mendingLight", target: "B" });
  round({ type: "skill", key: "mendingLight", target: "B" });
  const third = round({ type: "skill", key: "mendingLight", target: "B" });
  expect(third).toContain("Chronal Loop: Mending Light echoes through time!");
  expect(third).toContain("Mending Light's echo restores");
});

test("Star-Eater's Hunger devours enemy buffs and feeds on kills", () => {
  const c = createGroupCombat(party("A"), { enemies: ["x", "y"] }, () => dummy({ attack: [1, 1] }));
  const a = withUnique(c, "A", "starEaterHunger");
  a.stats.health = 500;
  const [buffed, weak] = c.enemies;
  buffed.statuses.push({ id: "fortify", turns: 3, power: 0.4, stacks: 1 });
  const log = resolveGroupRound(c, { A: { type: "melee", target: buffed.uid } }, env()).log.join("\n");
  expect(log).toContain("A's Star-Eater's Hunger devours the Dummy's Fortified effect (+15% damage)!");
  expect(buffed.statuses.some((st) => st.id === "fortify")).toBe(false);
  expect(a.hunger).toBe(1);
  expect(a.stats.health).toBeGreaterThanOrEqual(598);

  weak.hp = 50;
  resolveGroupRound(c, { A: { type: "melee", target: weak.uid } }, env());
  expect(weak.dead).toBe(true);
  expect(a.hunger).toBe(2);
});
