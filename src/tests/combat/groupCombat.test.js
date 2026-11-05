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

const heavy = { name: "Broadside", power: 2, telegraph: true, weight: 100, cooldown: 4 };
const heavyCombat = (overrides = {}, members = party("A")) =>
  createGroupCombat(members, { enemies: ["x"] }, () => dummy({ abilities: [heavy], ...overrides }));

test.each([
  ["whirlwind", "melee", 0.8],
  ["chainLightning", "magic", 1],
])("%s hits every living enemy and spends power once", (key, type, multiplier) => {
  const hero = player("A", {
    skills: { [key]: 1 },
    equippedSkills: [key],
  });
  const combat = createGroupCombat(
    { A: createGroupMember("A", hero) },
    { enemies: ["x", "y"] },
    (name) => dummy({ name }),
  );
  const [first, second] = combat.enemies;
  const power = combat.players.A.stats.power;

  resolveGroupRound(combat, { A: { type: "skill", key, target: first.uid } }, env());

  expect(first.hp).toBe(10000 - 100 * multiplier);
  expect(second.hp).toBe(10000 - 100 * multiplier);
  expect(combat.players.A.stats.power).toBe(power - (type === "magic" ? 7 : 6));
});

test("Meteor charges for a turn, then automatically strikes its target harder if burning", () => {
  const hero = player("A", {
    skills: { meteor: 1 },
    equippedSkills: ["meteor"],
  });
  const combat = createGroupCombat(
    { A: createGroupMember("A", hero) },
    { enemies: ["x"] },
    () => dummy(),
  );
  const enemy = combat.enemies[0];
  const power = combat.players.A.stats.power;

  const charge = resolveGroupRound(
    combat,
    { A: { type: "skill", key: "meteor", target: enemy.uid } },
    env(),
  );
  expect(enemy.hp).toBe(10000);
  expect(charge.log.join("\n")).toContain("begins channeling Meteor");
  expect(combat.players.A.meteorCharge).toEqual({ skillKey: "meteor", target: enemy.uid });
  expect(combat.players.A.stats.power).toBe(power - 20);

  enemy.statuses.push({ id: "burn", turns: 5, power: 0, stacks: 1 });
  const strike = resolveGroupRound(combat, {}, env());
  expect(strike.log.join("\n")).toContain("Meteor crashes down");
  expect(strike.log.join("\n")).toContain("A uses Meteor");
  expect(enemy.hp).toBe(9399);
  expect(combat.players.A.meteorCharge).toBeNull();
  expect(combat.players.A.stats.power).toBe(power - 20);
  expect(combat.players.A.usedUltimates.meteor).toBe(true);
});

test("a charged Meteor strikes before faster allies at the start of the round", () => {
  const combat = createGroupCombat(
    {
      A: createGroupMember("A", player("A", { skills: { meteor: 1 }, equippedSkills: ["meteor"] })),
      B: createGroupMember("B", player("B", { stats: { ...player("B").stats, speed: 99 } })),
    },
    { enemies: ["x"] },
    () => dummy(),
  );
  const enemy = combat.enemies[0];
  resolveGroupRound(combat, { A: { type: "skill", key: "meteor", target: enemy.uid }, B: { type: "pass" } }, env());

  const log = resolveGroupRound(combat, { B: { type: "melee", target: enemy.uid } }, env()).log;
  const meteor = log.findIndex((line) => line.includes("Meteor crashes down"));
  const ally = log.findIndex((line) => line.startsWith("B "));

  expect(meteor).toBeGreaterThan(-1);
  expect(ally).toBeGreaterThan(meteor);
});

test("stun interrupts a charged Meteor in group combat", () => {
  const hero = player("A", {
    skills: { meteor: 1 },
    equippedSkills: ["meteor"],
  });
  const combat = createGroupCombat(
    { A: createGroupMember("A", hero) },
    { enemies: ["x"] },
    () => dummy(),
  );
  const enemy = combat.enemies[0];
  resolveGroupRound(combat, { A: { type: "skill", key: "meteor", target: enemy.uid } }, env());
  combat.players.A.statuses.push({ id: "stun", turns: 1, stacks: 1 });

  const result = resolveGroupRound(combat, {}, env());

  expect(result.log.join("\n")).toContain("Meteor channel is interrupted");
  expect(enemy.hp).toBe(10000);
  expect(combat.players.A.meteorCharge).toBeNull();
});

test("an ultimate can only be used once in a group combat", () => {
  const hero = player("A", {
    skills: { dimensionalSlash: 1 },
    equippedSkills: ["dimensionalSlash"],
  });
  const combat = createGroupCombat(
    { A: createGroupMember("A", hero) },
    { enemies: ["x"] },
    () => dummy(),
  );
  const enemy = combat.enemies[0];
  resolveGroupRound(combat, { A: { type: "skill", key: "dimensionalSlash", target: enemy.uid } }, env());
  const hp = enemy.hp;
  const rejected = resolveGroupRound(combat, { A: { type: "skill", key: "dimensionalSlash", target: enemy.uid } }, env());
  expect(enemy.hp).toBe(hp);
  expect(rejected.log.join("\n")).toContain("already been used in this combat");
});

test("Dimensional Slash ignores all enemy defense", () => {
  const hero = player("A", {
    skills: { dimensionalSlash: 3 },
    equippedSkills: ["dimensionalSlash"],
  });
  const combat = createGroupCombat(
    { A: createGroupMember("A", hero) },
    { enemies: ["x"] },
    () => dummy({ defense: 1000 }),
  );
  const enemy = combat.enemies[0];

  resolveGroupRound(combat, { A: { type: "skill", key: "dimensionalSlash", target: enemy.uid } }, env());

  expect(enemy.hp).toBe(9500);
});

test("telegraphs prepare, release without random criticals, spend a full recovery action, then act again", () => {
  const c = heavyCombat({ critical: 1 });
  const e = c.enemies[0];
  const round = () => resolveGroupRound(c, {}, env()).log.join("\n");
  expect(round()).toContain("prepares Broadside");
  expect(c.players.A.stats.health).toBe(1000);
  expect(e.pending.name).toBe("Broadside");
  const restored = JSON.parse(JSON.stringify(c));
  const release = resolveGroupRound(restored, {}, env()).log.join("\n");
  expect(release).toContain("unleashes Broadside");
  expect(release).not.toContain("Critical!");
  expect(restored.players.A.stats.health).toBe(900);
  expect(restored.enemies[0].pending).toBeNull();
  expect(restored.enemies[0].recovering.name).toBe("Broadside");
  const recovery = resolveGroupRound(restored, {}, env()).log.join("\n");
  expect(recovery).toContain("recovering from Broadside. Ready.");
  expect(restored.players.A.stats.health).toBe(900);
  expect(restored.enemies[0].recovering).toBeNull();
  resolveGroupRound(restored, {}, env());
  expect(restored.players.A.stats.health).toBe(800);
});

test("stun delays a committed release and does not pay for recovery", () => {
  const c = heavyCombat();
  const e = c.enemies[0];
  resolveGroupRound(c, {}, env());
  e.statuses.push({ id: "stun", turns: 1, stacks: 1 });
  expect(resolveGroupRound(c, {}, env()).log.join("\n")).toContain("stunned and loses its turn");
  expect(e.pending.name).toBe("Broadside");
  expect(c.players.A.stats.health).toBe(1000);
  resolveGroupRound(c, {}, env());
  expect(c.players.A.stats.health).toBe(900);
  e.statuses.push({ id: "stun", turns: 1, stacks: 1 });
  resolveGroupRound(c, {}, env());
  expect(e.recovering.name).toBe("Broadside");
  resolveGroupRound(c, {}, env());
  expect(e.recovering).toBeNull();
  expect(c.players.A.stats.health).toBe(900);
});

test("telegraphs retain unavoidable hits and the special Defend and Guard mitigation", () => {
  const c = heavyCombat({}, party("A", "B"));
  c.players.A.stats.evasion = 1;
  c.players.B.stats.evasion = 1;
  resolveGroupRound(c, {}, env());
  resolveGroupRound(c, { A: { type: "defend" }, B: { type: "guard", target: "A" } }, env());
  expect(c.players.A.stats.health).toBe(1000);
  expect(c.players.B.stats.health).toBe(883);
});

test("Defend retains its existing extra telegraph reduction", () => {
  const c = heavyCombat();
  c.players.A.stats.evasion = 1;
  resolveGroupRound(c, {}, env());
  resolveGroupRound(c, { A: { type: "defend" } }, env());
  expect(c.players.A.stats.health).toBe(983);
});

test("ordinary HP buffs wait through release and recovery even when the enemy takes no further damage", () => {
  const c = heavyCombat({
    maxHp: 1000,
    phases: [{ below: 0.95, self: { id: "enrage", turns: 99, power: 1 }, text: "Enraged phase" }],
  });
  const e = c.enemies[0];
  resolveGroupRound(c, {}, env());
  resolveGroupRound(c, { A: { type: "melee", target: e.uid } }, env());
  expect(c.players.A.stats.health).toBe(900);
  expect(e.phasesDone).toEqual([]);
  expect(e.statuses).toEqual([]);
  const recovery = resolveGroupRound(c, {}, env()).log.join("\n");
  expect(recovery).toContain("Enraged phase");
  expect(e.phasesDone).toEqual([0]);
  expect(c.players.A.stats.health).toBe(900);
});

test("recovery consumes only the enemy action, not periodic effects or the environment", () => {
  const c = heavyCombat();
  resolveGroupRound(c, {}, env());
  resolveGroupRound(c, {}, env());
  c.environment = { status: "temporalRot", turns: 4, power: 0.01 };
  c.players.A.statuses.push({ id: "poison", turns: 2, power: 0.01, stacks: 1 });
  c.enemies[0].statuses.push({ id: "burn", turns: 2, power: 0.01, stacks: 1 });
  resolveGroupRound(c, {}, env());
  expect(c.players.A.stats.health).toBe(890);
  expect(c.enemies[0].hp).toBe(9900);
  expect(c.players.A.statuses.some((st) => st.id === "temporalRot")).toBe(true);
  expect(c.enemies[0].recovering).toBeNull();
});

test("mandatory add phases still run but their buffs cannot alter a warned attack", () => {
  const c = heavyCombat({
    maxHp: 1000,
    phases: [{ below: 0.95, summon: ["add"], mechanic: "shieldWhileAdds", self: { id: "enrage", turns: 99, power: 1 } }],
  });
  resolveGroupRound(c, {}, env());
  resolveGroupRound(c, { A: { type: "melee", target: c.enemies[0].uid } }, env());
  expect(c.enemies).toHaveLength(2);
  expect(c.enemies[0].phasesDone).toEqual([0]);
  expect(c.enemies[0].shieldWhileAdds).toBe(true);
  expect(c.players.A.stats.health).toBe(900);
});

test.each(["pending", "recovering"])("death cancels a heavy move during %s", (state) => {
  const c = heavyCombat({ maxHp: 200 });
  const e = c.enemies[0];
  resolveGroupRound(c, {}, env());
  if (state === "recovering") resolveGroupRound(c, {}, env());
  e.hp = 50;
  const health = c.players.A.stats.health;
  const { outcome, log } = resolveGroupRound(c, { A: { type: "melee", target: e.uid } }, env());
  expect(outcome).toBe("victory");
  expect(e.pending).toBeNull();
  expect(e.recovering).toBeNull();
  expect(c.players.A.stats.health).toBe(health);
  expect(log.join("\n")).not.toContain("unleashes");
});

test("mandatory split cancels preparation rather than losing its scripted transition", () => {
  const c = heavyCombat({ maxHp: 1000, phases: [{ below: 0.95, mechanic: "split", into: "shard", count: 2 }] });
  resolveGroupRound(c, {}, env());
  resolveGroupRound(c, { A: { type: "melee", target: c.enemies[0].uid } }, env());
  expect(c.enemies[0].hidden).toBe(true);
  expect(c.enemies[0].pending).toBeNull();
  expect(c.enemies[0].recovering).toBeNull();
  expect(c.enemies.filter((e) => e.linkGroup)).toHaveLength(2);
  expect(c.players.A.stats.health).toBe(1000);
});

test("scripted channels remain interruptible and do not become heavy moves", () => {
  const c = heavyCombat({ abilities: [{ name: "Gravity Well", mechanic: "channel", effect: "gravity", need: 0.005, rounds: 2, weight: 100, cooldown: 6 }] });
  resolveGroupRound(c, {}, env());
  expect(c.enemies[0].channel.name).toBe("Gravity Well");
  expect(c.enemies[0].pending).toBeFalsy();
  resolveGroupRound(c, { A: { type: "melee", target: c.enemies[0].uid } }, env());
  expect(c.enemies[0].channel).toBeNull();
  expect(c.enemies[0].recovering).toBeFalsy();
});

test.each(["provoke", "renewal"])("group %s remains the sole action even with extra quick actions supplied", (key) => {
  const members = party("A");
  members.A.skills[key] = 1;
  members.A.equipped = [key];
  members.A.stats.health = 500;
  const c = heavyCombat({}, members);
  const { log } = resolveGroupRound(c, {
    A: {
      type: "skill", key, target: "A",
      quickAction: { type: "item", key: "healthPotion", target: "A" },
      actions: [{ type: "melee", target: c.enemies[0].uid }],
    },
  }, env());
  expect(c.enemies[0].hp).toBe(c.enemies[0].maxHp);
  expect(c.players.A.spent).toEqual({});
  expect(c.players.A.stats.power).toBeLessThan(40);
  expect(log.join("\n")).not.toContain("strikes");
});

test("a potion remains the whole group action, including in a one-member party", () => {
  const c = heavyCombat();
  c.players.A.stats.health = 100;
  resolveGroupRound(c, { A: { type: "item", key: "healthPotion", target: "A", action: { type: "melee", target: c.enemies[0].uid } } }, env());
  expect(c.players.A.spent.healthPotion).toBe(1);
  expect(c.enemies[0].hp).toBe(c.enemies[0].maxHp);
  expect(c.enemies[0].pending.name).toBe("Broadside");
});

test.each([[0, 900], [0.25, 925], [0.5, 950], [1, 950]])(
  "group critical resistance %s caps at 50%%",
  (resistance, health) => {
    const c = createGroupCombat(party("A"), { enemies: ["x"] }, () => dummy({ critical: 1 }));
    c.players.A.stats.criticalResistance = resistance;
    resolveGroupRound(c, { A: { type: "pass" } }, env());
    expect(c.players.A.stats.health).toBe(health);
  },
);

test("group status resistance blocks enemy statuses and environmental afflictions", () => {
  const c = createGroupCombat(party("A"), { enemies: ["x"], environment: { status: "temporalRot" } }, () => dummy({
    abilities: [{ name: "Curse", power: 1, weight: 100, status: { id: "poison" } }],
  }));
  c.players.A.stats.statusResistance = 0.7;
  const { log } = resolveGroupRound(c, { A: { type: "pass" } }, env());
  expect(c.players.A.statuses).toEqual([]);
  expect(log.join(" ")).toContain("resists being poisoned");
  expect(log.join(" ")).toContain("resists being temporal rot");
});

test("resisting a stun prevents channel interruption", () => {
  const c = createGroupCombat(party("A"), { enemies: ["x"] }, () => dummy({ statusResistance: 0.7 }));
  c.players.A.ab.uniqueEffects.push("rootstride");
  c.enemies[0].channel = { name: "Channel", rounds: 5, need: 10000, dealt: 0 };
  resolveGroupRound(c, { A: { type: "melee" } }, env());
  expect(c.enemies[0].statuses).toEqual([]);
  expect(c.enemies[0].channel).not.toBeNull();
});

test.each(["moltenGrip", "saltbloodTide"])("group world boss is immune to DoTs and %s detonations", (effect) => {
  const c = createGroupCombat(party("A"), { enemies: ["x"] }, () => dummy({
    maxHp: 1000000, worldBossCycle: "cycle", statusResistance: 0,
  }));
  c.players.A.ab.uniqueEffects.push(effect);
  c.enemies[0].statuses = ["burn", "poison", "bleed"].map((id) => ({ id, turns: 99, power: 0.04, stacks: 1 }));
  for (let i = 0; i < 4; i += 1) resolveGroupRound(c, { A: { type: "melee" } }, env());
  expect(c.enemies[0].hp).toBe(999600);
});

test("createGroupMember starts at full health and only keeps combat consumables", () => {
  const m = createGroupMember("a", player("A", { stats: { ...player("A").stats, health: 1 }, consumables: { healthPotion: 2, itemCertificate: 4 } }));
  expect(m.stats.health).toBe(1000);
  expect(m.consumables).toEqual({ healthPotion: 2 });
  expect(m.equipped).toEqual(["mendingLight", "purify", "provoke"]);
});

test("group cleansing potions cleanse an ally without removing buffs or stage effects", () => {
  const members = party("A", "B");
  members.A.consumables = { cleansingPotion: 2 };
  const c = createGroupCombat(members, { enemies: ["x"] }, () => dummy());
  c.players.B.statuses = ["poison", "burn", "corruption", "fortify", "temporalRot"].map((id) => ({ id, turns: 5, power: 0.01, stacks: 1 }));
  resolveGroupRound(c, { A: { type: "item", key: "cleansingPotion", target: "B" }, B: { type: "pass" } }, env());
  expect(c.players.B.statuses.map((st) => st.id)).toEqual(["fortify", "temporalRot"]);
  expect(c.players.A.spent.cleansingPotion).toBe(1);
  resolveGroupRound(c, { A: { type: "item", key: "cleansingPotion", target: "B" }, B: { type: "pass" } }, env());
  expect(c.players.A.spent.cleansingPotion).toBe(1);
});

test("group stamina potions restore an ally and track recovery for settlement", () => {
  const members = party("A", "B");
  members.A.consumables = { staminaPotion: 2 };
  members.B.stats.stamina = 1;
  const c = createGroupCombat(members, { enemies: ["x"] }, () => dummy());
  resolveGroupRound(c, { A: { type: "item", key: "staminaPotion", target: "B" }, B: { type: "pass" } }, env());
  expect(c.players.B.stats.stamina).toBe(10);
  expect(c.players.B.staminaRecovered).toBe(9);
  expect(c.players.A.spent.staminaPotion).toBe(1);
  resolveGroupRound(c, { A: { type: "item", key: "staminaPotion", target: "B" }, B: { type: "pass" } }, env());
  expect(c.players.A.spent.staminaPotion).toBe(1);
});

test("group snapshots include stamina and cleansing potions, not special inventory items", () => {
  const member = createGroupMember("A", player("A", { consumables: { staminaPotion: 1, cleansingPotion: 2, itemCertificate: 3 } }));
  expect(member.consumables).toEqual({ staminaPotion: 1, cleansingPotion: 2 });
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

const passiveMember = (name, passives, overrides = {}) =>
  createGroupMember(name, player(name, { passives, equippedPassives: passives, ...overrides }));

test("Bloodlust stacks on kills and boosts later damage", () => {
  const combat = createGroupCombat(
    { A: passiveMember("A", ["bloodlust"]) },
    { enemies: ["x", "y"] },
    (name) => dummy({ name, maxHp: name === "x" ? 50 : 10000 }),
  );
  const [first, second] = combat.enemies;
  resolveGroupRound(combat, { A: { type: "melee", target: first.uid } }, env());
  expect(combat.players.A.bloodlust).toBe(1);
  resolveGroupRound(combat, { A: { type: "melee", target: second.uid } }, env());
  expect(second.hp).toBe(10000 - 110);
});

test("Protect reduces damage taken by the guarded ally", () => {
  const run = (passives) => {
    const combat = createGroupCombat(
      { A: passiveMember("A", passives), B: passiveMember("B", []) },
      { enemies: ["x"] },
      () => dummy({ attack: [200, 200] }),
    );
    combat.enemies[0].threat = { B: 100000 };
    resolveGroupRound(combat, { A: { type: "guard", target: "B" }, B: { type: "pass" } }, env());
    return combat.players.A.stats.health + combat.players.B.stats.health;
  };
  expect(run(["protect"])).toBeGreaterThan(run([]));
});

test("Vitality Overflow turns overhealing into a barrier", () => {
  const combat = createGroupCombat(
    { A: passiveMember("A", ["vitalityOverflow"]), B: passiveMember("B", []) },
    { enemies: ["x"] },
    () => dummy({ attack: [0, 0] }),
  );
  resolveGroupRound(combat, { A: { type: "skill", key: "mendingLight", target: "B" }, B: { type: "pass" } }, env());
  expect(combat.players.B.statuses).toContainEqual(expect.objectContaining({ id: "barrier" }));
});

test("Inspiration empowers the next attack of a healed ally", () => {
  const combat = createGroupCombat(
    { A: passiveMember("A", ["inspiration"]), B: passiveMember("B", []) },
    { enemies: ["x"] },
    () => dummy({ attack: [0, 0] }),
  );
  const target = combat.enemies[0];
  resolveGroupRound(combat, { A: { type: "skill", key: "mendingLight", target: "B" }, B: { type: "pass" } }, env());
  expect(combat.players.B.inspired).toBe(true);
  resolveGroupRound(combat, { A: { type: "pass" }, B: { type: "melee", target: target.uid } }, env());
  expect(target.hp).toBe(10000 - 110);
  expect(combat.players.B.inspired).toBe(false);
});

test("Last Light from an ally saves a member from a lethal hit once", () => {
  const combat = createGroupCombat(
    { A: passiveMember("A", ["lastLight"]), B: passiveMember("B", []) },
    { enemies: ["x"] },
    () => dummy({ attack: [5000, 5000] }),
  );
  combat.players.B.stats.health = 10;
  combat.players.A.stats.health = 10;
  resolveGroupRound(combat, { A: { type: "pass" }, B: { type: "pass" } }, env());
  const saved = Object.values(combat.players).filter((m) => m.stats.health === 1);
  expect(saved).toHaveLength(1);
});
