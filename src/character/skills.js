import { getPlayer, setPlayer } from "./player";
import { getEnemy } from "../combat/combat";
import { STATUSES, addStatus, cleanseDebuffs, healMult } from "../combat/statuses";

/*
 Player skills. The player saves `skills` ({ key: level }, 0/missing = not learned) and
 `equippedSkills` (array of up to MAX_EQUIPPED keys).
 A skill point learns a skill (level 1) or raises it by one level, up to maxLevel.
 Skill fields: name, description, type ("melee" | "magic" | "support"), powerCost, multiplier (damage multiplier at
 level 1), perLevel (added to the multiplier per extra level), maxLevel, and optional effects:
   bonus(ctx)         extra damage fraction (0.5 = +50%) computed from the fight
   critBonus(ctx)     extra critical chance
   ignoreDefense(lvl) fraction of enemy defense ignored
   onHit(ctx)         runs after the hit lands: ctx.applyStatus(id, { turns, power }), ctx.heal(amount), ctx.log(text)
   describe(lvl)      lines describing the effect at that level (for tooltips)
 ctx = { level, stats, enemy, speedAdvantage, dealt, crit, applyStatus, heal, log }
 Support skills deal no damage. They have `target` ("self" | "ally" | "party") and support(ctx) with
 ctx = { level, caster, target, heal(t, amount), applyStatus(t, id, opts), cleanse(t) }; see applySupportSkill.
*/
export const MAX_EQUIPPED = 3;

const pct = (n) => `${Math.round(n * 100)}%`;

export const SKILLS = {
  backstab: {
    name: "Backstab",
    description: "A precise strike from the shadows.",
    type: "melee",
    target: "enemy",
    powerCost: 3,
    multiplier: 1.2,
    perLevel: 0.15,
    maxLevel: 5,
    // Each point of speed above the enemy adds damage; being faster also makes a critical hit more likely.
    bonus: (ctx) => Math.min(1, Math.max(0, ctx.speedAdvantage) * (0.03 + 0.01 * ctx.level)),
    critBonus: (ctx) => (ctx.speedAdvantage > 0 ? 0.15 : 0),
    describe: (lvl) => [
      `+${pct(0.03 + 0.01 * lvl)} damage per point of speed you have over the enemy (max +100%).`,
      "+15% critical chance if you are faster.",
    ],
  },
  cleave: {
    name: "Cleave",
    description: "A wide, armor-rending swing.",
    type: "melee",
    target: "enemy",
    powerCost: 4,
    multiplier: 1.4,
    perLevel: 0.2,
    maxLevel: 5,
    ignoreDefense: (lvl) => 0.3 + 0.05 * lvl,
    onHit: (ctx) => ctx.applyStatus("vulnerable", { turns: 2, power: 0.12 + 0.03 * ctx.level }),
    describe: (lvl) => [
      `Ignores ${pct(0.3 + 0.05 * lvl)} of the enemy's defense.`,
      `Leaves the enemy Vulnerable (+${pct(0.12 + 0.03 * lvl)} damage taken) for 2 rounds.`,
    ],
  },
  execute: {
    name: "Execute",
    description: "A finishing blow that grows deadlier as the enemy weakens.",
    type: "melee",
    target: "enemy",
    powerCost: 5,
    multiplier: 1,
    perLevel: 0.1,
    maxLevel: 5,
    bonus: (ctx) => (1 - ctx.enemy.hp / ctx.enemy.maxHp) * (1 + 0.25 * ctx.level),
    describe: (lvl) => [`Deals up to +${pct(1 + 0.25 * lvl)} damage, scaling with the enemy's missing health.`],
  },
  venomStrike: {
    name: "Venom Strike",
    description: "A poisoned blade that grows more potent with every cut.",
    type: "melee",
    target: "enemy",
    powerCost: 3,
    multiplier: 1,
    perLevel: 0.1,
    maxLevel: 5,
    onHit: (ctx) => ctx.applyStatus("poison", { turns: 4, power: 0.02 + 0.005 * ctx.level }),
    describe: (lvl) => [
      `Poisons the enemy for ${pct(0.02 + 0.005 * lvl)} of their max health per round for 4 rounds.`,
      "Stacks up to 3 times.",
    ],
  },
  fireball: {
    name: "Fireball",
    description: "Hurl a ball of flame that sets the enemy ablaze.",
    type: "magic",
    target: "enemy",
    powerCost: 5,
    multiplier: 1.6,
    perLevel: 0.2,
    maxLevel: 5,
    onHit: (ctx) => ctx.applyStatus("burn", { turns: 3, power: 0.04 + 0.01 * ctx.level }),
    describe: (lvl) => [
      `Burns the enemy for ${pct(0.04 + 0.01 * lvl)} of their max health per round for 3 rounds.`,
      "Burning enemies receive 25% less healing.",
    ],
  },
  frostLance: {
    name: "Frost Lance",
    description: "A shard of ice that numbs and slows its target.",
    type: "magic",
    target: "enemy",
    powerCost: 4,
    multiplier: 1.3,
    perLevel: 0.15,
    maxLevel: 5,
    onHit: (ctx) => {
      ctx.applyStatus("weaken", { turns: 2, power: 0.2 });
      if (Math.random() < 0.2 + 0.025 * ctx.level) ctx.applyStatus("stun");
    },
    describe: (lvl) => [
      "Weakens the enemy (-20% damage) for 2 rounds.",
      `${pct(0.2 + 0.025 * lvl)} chance to stun the enemy.`,
    ],
  },
  soulSiphon: {
    name: "Soul Siphon",
    description: "Tear life from the enemy and make it your own.",
    type: "magic",
    target: "enemy",
    powerCost: 5,
    multiplier: 1.3,
    perLevel: 0.1,
    maxLevel: 5,
    onHit: (ctx) => ctx.heal(Math.round(ctx.dealt * (0.05 + 0.05 * ctx.level))),
    describe: (lvl) => [`Heals you for ${pct(0.05 + 0.05 * lvl)} of the damage dealt.`],
  },
  mendingLight: {
    name: "Mending Light",
    description: "A warm light that closes wounds.",
    type: "support",
    target: "ally",
    powerCost: 4,
    maxLevel: 5,
    support: (ctx) => ctx.heal(ctx.target, Math.round(
      ctx.target.stats.maxHealth * (0.12 + 0.03 * ctx.level) + magicAverage(ctx.caster.stats) * (0.6 + 0.1 * ctx.level),
    )),
    describe: (lvl) => [
      `Heals the target for ${pct(0.12 + 0.03 * lvl)} of their max health plus ${pct(0.6 + 0.1 * lvl)} of your average magic attack.`,
    ],
  },
  renewal: {
    name: "Renewal",
    description: "Blesses the target with lingering vitality.",
    type: "support",
    target: "ally",
    powerCost: 3,
    maxLevel: 5,
    support: (ctx) => ctx.applyStatus(ctx.target, "regen", { turns: 3, power: 0.04 + 0.01 * ctx.level }),
    describe: (lvl) => [`The target regenerates ${pct(0.04 + 0.01 * lvl)} of their max health each round for 3 rounds.`],
  },
  battleHymn: {
    name: "Battle Hymn",
    description: "A rousing anthem that steels the whole party.",
    type: "support",
    target: "party",
    powerCost: 6,
    maxLevel: 5,
    support: (ctx) => ctx.applyStatus(ctx.target, "empower", { turns: 3, power: 0.1 + 0.03 * ctx.level }),
    describe: (lvl) => [`Empowers you and every ally: +${pct(0.1 + 0.03 * lvl)} damage dealt for 3 rounds.`],
  },
  aegis: {
    name: "Aegis",
    description: "Wraps the target in a shimmering barrier.",
    type: "support",
    target: "ally",
    powerCost: 4,
    maxLevel: 5,
    support: (ctx) => ctx.applyStatus(ctx.target, "barrier", {
      turns: 3,
      power: Math.round(ctx.target.stats.maxHealth * (0.12 + 0.03 * ctx.level) + magicAverage(ctx.caster.stats) * 0.5),
    }),
    describe: (lvl) => [
      `Grants a barrier absorbing ${pct(0.12 + 0.03 * lvl)} of the target's max health plus 50% of your average magic attack for 3 rounds.`,
    ],
  },
  purify: {
    name: "Purify",
    description: "Burns away afflictions with cleansing light.",
    type: "support",
    target: "ally",
    powerCost: 3,
    maxLevel: 5,
    support: (ctx) => {
      ctx.cleanse(ctx.target);
      ctx.heal(ctx.target, Math.round(ctx.target.stats.maxHealth * (0.03 + 0.02 * ctx.level)));
      if (ctx.level >= 3) ctx.applyStatus(ctx.target, "warded", { turns: ctx.level >= 5 ? 2 : 1 });
    },
    describe: (lvl) => [
      "Removes every cleansable debuff from the target.",
      `Heals the target for ${pct(0.03 + 0.02 * lvl)} of their max health.`,
      lvl >= 3 ? `Wards the target against new debuffs for ${lvl >= 5 ? 2 : 1} round(s).` : "At level 3: wards the target against new debuffs.",
    ],
  },
  provoke: {
    name: "Provoke",
    description: "Bellow a challenge and brace for the blows.",
    type: "support",
    target: "self",
    powerCost: 2,
    maxLevel: 5,
    support: (ctx) => {
      ctx.applyStatus(ctx.target, "taunt", { turns: 2 });
      ctx.applyStatus(ctx.target, "fortify", { turns: 2, power: 0.15 + 0.04 * ctx.level });
    },
    describe: (lvl) => [
      "Forces enemies to attack you for 2 rounds (in group combat).",
      `Fortifies you: -${pct(0.15 + 0.04 * lvl)} damage taken for 2 rounds.`,
    ],
  },
};

export const isSupportSkill = (key) => SKILLS[key]?.type === "support";
const magicAverage = (stats) => ((stats?.magicAttackMin || 0) + (stats?.magicAttackMax || 0)) / 2;
const TARGET_LABELS = { self: "Yourself", ally: "You or one ally", party: "Your whole party" };

/*
 Runs a support skill. caster/targets are { name, stats, statuses } (mutated in place).
 Returns { lines, healed, threat } where threat is the total healing/shielding done (for aggro).
 echo (0-1): a Chronal Loop repeat that only scales the skill's healing and shielding.
*/
export function applySupportSkill(key, level, caster, targets, { echo = 0 } = {}) {
  const skill = SKILLS[key];
  const lines = [];
  const totals = { healed: 0, threat: 0 };
  const label = echo ? `${skill.name}'s echo` : skill.name;
  const who = (t) => (t === caster ? `${caster.name === "You" ? "you" : caster.name}` : t.name);
  for (const target of targets) {
    if (!target.statuses) target.statuses = [];
    skill.support({
      level,
      caster,
      target,
      heal: (t, amount) => {
        const gained = Math.max(0, Math.min(
          Math.floor(amount * (echo || 1) * healMult(t.statuses)),
          t.stats.maxHealth - t.stats.health,
        ));
        t.stats.health += gained;
        totals.healed += gained;
        totals.threat += gained;
        lines.push(`${label} restores [green]${gained}[/green] health to ${who(t)}.`);
      },
      applyStatus: (t, id, opts) => {
        if (echo) {
          if (id !== "barrier") return;
          const extra = Math.round((opts.power || 0) * echo);
          const shield = t.statuses.find((st) => st.id === "barrier");
          if (shield) shield.power += extra;
          else addStatus(t.statuses, "barrier", { ...opts, power: extra });
          totals.threat += extra;
          lines.push(`${label} adds ${extra} to ${who(t)}'s barrier.`);
          return;
        }
        const entry = addStatus(t.statuses, id, opts);
        if (!entry) lines.push(`${who(t)} resists the effect.`);
        else {
          if (id === "barrier") totals.threat += opts.power;
          lines.push(`${skill.name}: ${who(t)} ${t === caster && caster.name === "You" ? "are" : "is"} now ${STATUSES[id].name.toLowerCase()}.`);
        }
      },
      cleanse: (t) => {
        if (echo) return;
        const removed = cleanseDebuffs(t.statuses);
        totals.threat += removed.length * 10;
        lines.push(removed.length
          ? `${skill.name} cleanses ${removed.map((st) => STATUSES[st.id].name).join(", ")} from ${who(t)}.`
          : `${skill.name} finds nothing to cleanse on ${who(t)}.`);
      },
    });
  }
  return { lines, ...totals };
}

// Spellcasters cast spells more cheaply (see CLASSES).
export const skillCost = (player, key) => {
  const s = SKILLS[key];
  return player?.class === "Spellcaster" && s.type === "magic" ? Math.max(1, s.powerCost - 1) : s.powerCost;
};
export const getSkillLevel = (player, key) => player?.skills?.[key] || 0;

export const skillMultiplier = (key, level) => {
  const s = SKILLS[key];
  if (s.type === "support") return 0;
  return Math.round((s.multiplier + s.perLevel * (Math.max(1, level) - 1)) * 100) / 100;
};

export const getEquippedSkills = (player = getPlayer()) =>
  (player?.equippedSkills || []).filter((k) => SKILLS[k] && getSkillLevel(player, k) > 0);

export const skillTooltip = (key, level, extra, player = getPlayer()) => {
  const s = SKILLS[key];
  if (!s) return null;
  const shown = Math.max(1, level);
  if (s.type === "support")
    return {
      title: s.name,
      subtitle: level > 0 ? `Level ${level}/${s.maxLevel}` : "Not learned",
      description: [s.description, ...s.describe(shown), "Outside group combat, support skills always target yourself."],
      stats: [
        { label: "Power cost", value: skillCost(player, key) },
        { label: "Type", value: "Support" },
        { label: "Target", value: TARGET_LABELS[s.target] },
      ],
      footer: extra,
    };
  const stats = [
    { label: "Power cost", value: skillCost(player, key) },
    { label: "Damage", value: `${Math.round(skillMultiplier(key, level) * 100)}% ${s.type} attack` },
  ];
  if (level > 0 && level < s.maxLevel)
    stats.push({ label: "Next level", value: `${Math.round(skillMultiplier(key, level + 1) * 100)}%`, color: "#7bd88f" });
  return {
    title: s.name,
    subtitle: level > 0 ? `Level ${level}/${s.maxLevel}` : "Not learned",
    description: [s.description, ...(s.describe ? s.describe(shown) : [])],
    stats,
    footer: extra,
  };
};

// Spends a skill point to learn a skill or raise its level.
export function levelUpSkill(key) {
  const p = getPlayer();
  const s = SKILLS[key];
  if (!p || !s) return { ok: false };
  if (getEnemy()) return { ok: false, reason: "combat" };
  const level = getSkillLevel(p, key);
  if (level >= s.maxLevel) return { ok: false, reason: "max" };
  if ((p.skillPoints || 0) < 1) return { ok: false, reason: "points" };
  setPlayer({ skills: { ...p.skills, [key]: level + 1 }, skillPoints: p.skillPoints - 1 });
  return { ok: true };
}

export function equipSkill(key) {
  const p = getPlayer();
  if (!p || !SKILLS[key] || getSkillLevel(p, key) < 1) return { ok: false };
  if (getEnemy()) return { ok: false, reason: "combat" };
  const equipped = p.equippedSkills || [];
  if (equipped.includes(key)) return { ok: false };
  if (equipped.length >= MAX_EQUIPPED) return { ok: false, reason: "full" };
  setPlayer({ equippedSkills: [...equipped, key] });
  return { ok: true };
}

export function unequipSkill(key) {
  const p = getPlayer();
  if (!p) return { ok: false };
  if (getEnemy()) return { ok: false, reason: "combat" };
  setPlayer({ equippedSkills: (p.equippedSkills || []).filter((k) => k !== key) });
  return { ok: true };
}
