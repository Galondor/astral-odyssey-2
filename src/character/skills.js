import { getPlayer, setPlayer } from "./player";
import { getEnemy } from "../combat/combat";
import { getItemGemstones, isSkillGemstone } from "../items/sockets";
import { STATUSES, addStatus, cleanseDebuffs, healMult } from "../combat/statuses";
import {
  MAX_EQUIPPED_PASSIVES, PASSIVES, PASSIVE_POINT_COST, PASSIVE_TUNING,
  getEquippedPassives, getLearnedPassives, hasPassive,
} from "./passives";

/*
 Player skills. The player saves `skills` ({ key: level }, 0/missing = not learned) and
 `equippedSkills` (up to MAX_EQUIPPED regular skills and one ultimate).
 Skill points learn or upgrade regular skills; ultimates cost two points per level.
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
export const MAX_EQUIPPED_ULTIMATE = 1;
export const ULTIMATE_UNLOCK_LEVEL = 25;
// Regular skill slots: 3, or 4 with the Skillful passive equipped.
export const maxRegularSkills = (player) =>
  hasPassive(player, "skillful") ? PASSIVE_TUNING.skillful.slots : MAX_EQUIPPED;

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
  offhandStrike: {
    name: "Offhand Strike",
    actionCost: "quick",
    description: "Follow up with a swift strike from your offhand.",
    type: "melee",
    target: "enemy",
    powerCost: 2,
    multiplier: 0.25,
    perLevel: 0.05,
    maxLevel: 5,
  },
  whirlwind: {
    name: "Whirlwind",
    description: "Spin through a sweeping attack that strikes every enemy.",
    type: "melee",
    target: "enemy",
    powerCost: 6,
    multiplier: 0.8,
    perLevel: 0.15,
    maxLevel: 5,
    area: true,
    describe: () => ["Attacks all enemies in the encounter."],
  },
  chainLightning: {
    name: "Chain Lightning",
    description: "Unleash lightning that arcs through every enemy.",
    type: "magic",
    target: "enemy",
    powerCost: 7,
    multiplier: 1,
    perLevel: 0.2,
    maxLevel: 5,
    area: true,
    describe: () => ["Attacks all enemies in the encounter."],
  },
  meteor: {
    name: "Meteor",
    category: "ultimate",
    ultimate: true,
    description: "Call down a devastating meteor after a turn of channeling.",
    type: "magic",
    target: "enemy",
    powerCost: 20,
    multiplier: 4,
    perLevel: 1.5,
    maxLevel: 3,
    charge: true,
    bonus: (ctx) => (ctx.enemy.statuses.some((status) => status.id === "burn") ? 0.5 : 0),
    describe: (lvl) => [
      `Consumes your turn to channel, then strikes on your next turn for ${pct(4 + 1.5 * (lvl - 1))} damage.`,
      "Deals 50% more damage to burning enemies.",
      "Stun interrupts the channel.",
    ],
  },
  dimensionalSlash: {
    name: "Dimensional Slash",
    category: "ultimate",
    ultimate: true,
    description: "Cut through reality with a devastating melee strike.",
    type: "melee",
    target: "enemy",
    powerCost: 20,
    multiplier: 3,
    perLevel: 1,
    maxLevel: 3,
    ignoreDefense: () => 1,
    describe: (lvl) => [
      `Deals ${pct(3 + (lvl - 1))} melee damage, ignoring all enemy defense.`,
    ],
  },
  mendingLight: {
    name: "Mending Light",
    description: "A warm light that closes wounds.",
    type: "support",
    target: "ally",
    powerCost: 4,
    maxLevel: 5,
    support: (ctx) => ctx.heal(ctx.target, Math.round(
      ctx.target.stats.maxHealth * (0.12 + 0.05 * ctx.level) + magicAverage(ctx.caster.stats) * (0.6 + 0.1 * ctx.level),
    )),
    describe: (lvl) => [
      `Heals the target for ${pct(0.12 + 0.05 * lvl)} of their max health plus ${pct(0.6 + 0.1 * lvl)} of your average magic attack.`,
    ],
  },
  renewal: {
    name: "Renewal",
    actionCost: "quick",
    description: "Blesses the target with lingering vitality.",
    type: "support",
    target: "ally",
    powerCost: 3,
    maxLevel: 5,
    support: (ctx) => ctx.applyStatus(ctx.target, "regen", { turns: ctx.level >= 5 ? 4 : 3, power: 0.04 + 0.01 * ctx.level }),
    describe: (lvl) => [`The target regenerates ${pct(0.04 + 0.01 * lvl)} of their max health each round for ${lvl >= 5 ? 4 : 3} rounds.`],
  },
  battleHymn: {
    name: "Battle Hymn",
    description: "A rousing anthem that steels the whole party.",
    type: "support",
    target: "party",
    powerCost: 6,
    maxLevel: 5,
    support: (ctx) => ctx.applyStatus(ctx.target, "empower", { turns: ctx.level >= 5 ? 4 : 3, power: 0.1 + 0.03 * ctx.level }),
    describe: (lvl) => [`Empowers you and every ally: +${pct(0.1 + 0.03 * lvl)} damage dealt for ${lvl >= 5 ? 4 : 3} rounds.`],
  },
  aegis: {
    name: "Aegis",
    description: "Wraps the target in a shimmering barrier.",
    type: "support",
    target: "ally",
    powerCost: 4,
    maxLevel: 5,
    support: (ctx) => ctx.applyStatus(ctx.target, "barrier", {
      turns: ctx.level >= 5 ? 4 : 3,
      power: Math.round(ctx.target.stats.maxHealth * (0.2 + 0.05 * ctx.level) + magicAverage(ctx.caster.stats) * (0.5 + 0.1 * ctx.level)),
    }),
    describe: (lvl) => [
      `Grants a barrier absorbing ${pct(0.2 + 0.05 * lvl)} of the target's max health plus ${pct(0.5 + 0.1 * lvl)} of your average magic attack for ${lvl >= 5 ? 4 : 3} rounds.`,
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
    actionCost: "quick",
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
export function applySupportSkill(key, level, caster, targets, { echo = 0, passives = [] } = {}) {
  const skill = SKILLS[key];
  const lines = [];
  const totals = { healed: 0, threat: 0 };
  // Targets that were healed or given a beneficial status (used by Inspiration).
  const affected = [];
  const touch = (t) => { if (!affected.includes(t)) affected.push(t); };
  const label = echo ? `${skill.name}'s echo` : skill.name;
  const who = (t) => (t === caster ? `${caster.name === "You" ? "you" : caster.name}` : t.name);
  for (const target of targets) {
    if (!target.statuses) target.statuses = [];
    skill.support({
      level,
      caster,
      target,
      heal: (t, amount) => {
        const raw = Math.max(0, Math.floor(amount * (echo || 1) * healMult(t.statuses)));
        const gained = Math.min(raw, Math.max(0, t.stats.maxHealth - t.stats.health));
        t.stats.health += gained;
        totals.healed += gained;
        totals.threat += gained;
        touch(t);
        lines.push(`${label} restores [green]${gained}[/green] health to ${who(t)}.`);
        if (hasPassive(passives, "vitalityOverflow") && raw > gained) {
          const shield = t.statuses.find((st) => st.id === "barrier");
          const room = Math.max(0, t.stats.maxHealth - (shield?.power || 0));
          const extra = Math.min(raw - gained, room);
          if (extra > 0) {
            if (shield) shield.power += extra;
            else addStatus(t.statuses, "barrier", { power: extra });
            totals.threat += extra;
            lines.push(`Vitality Overflow turns ${extra} overhealing into a barrier on ${who(t)}.`);
          }
        }
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
          if (!STATUSES[id].debuff) touch(t);
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
  return { lines, affected, ...totals };
}

// Spellcasters cast spells more cheaply (see CLASSES); Efficiency trims regular skill costs further.
export const computeSkillCost = (key, cls, passives = []) => {
  const s = SKILLS[key];
  if (!s) return 0;
  if (s.ultimate) return s.powerCost;
  const base = cls === "Spellcaster" && s.type === "magic" ? Math.max(1, s.powerCost - 1) : s.powerCost;
  return hasPassive(passives, "efficiency")
    ? Math.max(1, Math.round(base * (1 - PASSIVE_TUNING.efficiency.discount)))
    : base;
};
export const skillCost = (player, key) => computeSkillCost(key, player?.class, getEquippedPassives(player));
export const getLearnedSkillLevel = (player, key) => player?.skills?.[key] || 0;
export const getSkillGemBonus = (player, key) =>
  Object.values(player?.equipment || {}).flatMap(getItemGemstones).filter((gem) =>
    isSkillGemstone(gem) && gem.skill === key && gem.value === 1 &&
    gem.rarity === (SKILLS[key]?.ultimate ? "Unique" : "Legendary"),
  ).length;
export const getSkillLevel = (player, key) => {
  const learned = getLearnedSkillLevel(player, key);
  return learned > 0 ? learned + getSkillGemBonus(player, key) : 0;
};
export const skillPointCost = (key) => SKILLS[key]?.ultimate ? 2 : 1;

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
        { label: "Action cost", value: s.actionCost === "quick" ? "Quick in solo/PvP; Action in group combat" : "Action" },
        { label: "Power cost", value: skillCost(player, key) },
        { label: "Type", value: "Support" },
        { label: "Target", value: TARGET_LABELS[s.target] },
      ],
      footer: extra,
    };
  const stats = [
    { label: "Action cost", value: s.actionCost === "quick" ? "Quick in solo/PvP; Action in group combat" : "Action" },
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
  const level = getLearnedSkillLevel(p, key);
  if (level >= s.maxLevel) return { ok: false, reason: "max" };
  if (s.ultimate && (p.level || 1) < ULTIMATE_UNLOCK_LEVEL) return { ok: false, reason: "level" };
  const cost = skillPointCost(key);
  if ((p.skillPoints || 0) < cost) return { ok: false, reason: "points" };
  setPlayer({ skills: { ...p.skills, [key]: level + 1 }, skillPoints: p.skillPoints - cost });
  return { ok: true };
}

export function equipSkill(key) {
  const p = getPlayer();
  if (!p || !SKILLS[key] || getSkillLevel(p, key) < 1) return { ok: false };
  if (getEnemy()) return { ok: false, reason: "combat" };
  const equipped = p.equippedSkills || [];
  if (equipped.includes(key)) return { ok: false };
  const skill = SKILLS[key];
  if (skill.ultimate) {
    if ((p.level || 1) < ULTIMATE_UNLOCK_LEVEL) return { ok: false, reason: "level" };
    if (equipped.filter((equippedKey) => SKILLS[equippedKey]?.ultimate).length >= MAX_EQUIPPED_ULTIMATE)
      return { ok: false, reason: "ultimate-full" };
  } else if (equipped.filter((equippedKey) => !SKILLS[equippedKey]?.ultimate).length >= maxRegularSkills(p)) {
    return { ok: false, reason: "full" };
  }
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

// Keeps every equipped ultimate and the first `limit` regular skills.
const trimRegularSkills = (equipped, limit) => {
  let regular = 0;
  return equipped.filter((key) => SKILLS[key]?.ultimate || (regular += 1) <= limit);
};

// Spends PASSIVE_POINT_COST skill points to learn a passive.
export function learnPassive(key) {
  const p = getPlayer();
  const passive = PASSIVES[key];
  if (!p || !passive) return { ok: false };
  if (getEnemy()) return { ok: false, reason: "combat" };
  if (getLearnedPassives(p).includes(key)) return { ok: false, reason: "learned" };
  if ((p.level || 1) < passive.level) return { ok: false, reason: "level" };
  if ((p.skillPoints || 0) < PASSIVE_POINT_COST) return { ok: false, reason: "points" };
  setPlayer({ passives: [...getLearnedPassives(p), key], skillPoints: p.skillPoints - PASSIVE_POINT_COST });
  return { ok: true };
}

export function equipPassive(key) {
  const p = getPlayer();
  if (!p || !getLearnedPassives(p).includes(key)) return { ok: false };
  if (getEnemy()) return { ok: false, reason: "combat" };
  const equipped = getEquippedPassives(p);
  if (equipped.includes(key)) return { ok: false };
  if (equipped.length >= MAX_EQUIPPED_PASSIVES) return { ok: false, reason: "full" };
  setPlayer({ equippedPassives: [...equipped, key] });
  return { ok: true };
}

export function unequipPassive(key) {
  const p = getPlayer();
  if (!p) return { ok: false };
  if (getEnemy()) return { ok: false, reason: "combat" };
  const equippedPassives = getEquippedPassives(p).filter((k) => k !== key);
  const changes = { equippedPassives };
  // Losing Skillful drops the extra regular skill slot.
  if (key === "skillful") changes.equippedSkills = trimRegularSkills(p.equippedSkills || [], MAX_EQUIPPED);
  setPlayer(changes);
  return { ok: true };
}
