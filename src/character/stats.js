import { getClassForStats } from "./classes";
import { getItemGearScore } from "../items/gearScore";

/*
 Central stat calculation. Every derived stat is computed here from:
   - player.baseStats  { strength, dexterity, intelligence }  (the points chosen at character creation)
   - equipped items    (item.mainStat + item.subStats, summed per stat key)
   - player.bonusStats permanent flat bonuses on any final stat key, e.g. { attackMax: 1 } from crafting
 Call recalculateStats(player) after anything that changes those inputs. Current health/stamina/power,
 exp and expToLevel are carried over from player.stats (clamped to the new maximums).

 Each stat is built from a list of { label, value } lines, so the same data that produces the total also
 powers the stat tooltips (see getStatBreakdown / STAT_INFO).
*/
const CORE_STATS = ["strength", "dexterity", "intelligence"];

const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
const line = (label, value) => ({ label, value });

// Per-item contributions by stat key, e.g. { strength: [{ label: "Pristine Iron Sword", value: 3 }] }
const getGearSources = (equipment = {}) => {
  const out = {};
  const add = (key, label, value) => {
    if (!out[key]) out[key] = [];
    out[key].push(line(label, value));
  };
  for (const item of Object.values(equipment)) {
    if (!item) continue;
    if (item.mainStat) add(item.mainStat.stat, item.name, item.mainStat.value);
    for (const [k, v] of Object.entries(item.subStats || {})) add(k, item.name, v);
  }
  return out;
};

// Sums every equipped item's stat values by key (e.g. { strength: 3, attack: 2, criticalDamage: 0.04 })
export const getGearBonuses = (equipment = {}) =>
  Object.fromEntries(
    Object.entries(getGearSources(equipment)).map(([k, lines]) => [k, lines.reduce((sum, l) => sum + l.value, 0)]),
  );

// Saves from before baseStats existed stored totals; remove the gear contribution to recover the base.
const getBaseStats = (player, gear) => {
  if (player.baseStats) return player.baseStats;
  const s = player.stats || {};
  return Object.fromEntries(CORE_STATS.map((k) => [k, Math.max(0, (s[k] || 0) - (gear[k] || 0))]));
};

// Returns { totals, breakdown }. breakdown[key] = { total, lines: [{ label, value }], format }
const compute = (player) => {
  const sources = getGearSources(player.equipment);
  const gear = getGearBonuses(player.equipment);
  const base = getBaseStats(player, gear);
  const bonus = player.bonusStats || {};
  const totals = {};
  const breakdown = {};

  const gearLines = (key) => sources[key] || [];
  const bonusLines = (...keys) => {
    const v = keys.reduce((sum, k) => sum + (bonus[k] || 0), 0);
    return v ? [line("Permanent bonuses", v)] : [];
  };
  const define = (key, lines, format = "number") => {
    const total = round(lines.reduce((sum, l) => sum + l.value, 0));
    totals[key] = total;
    breakdown[key] = { total, lines, format };
    return total;
  };

  const strength = define("strength", [line("Base points", base.strength), ...gearLines("strength"), ...bonusLines("strength")]);
  const dexterity = define("dexterity", [line("Base points", base.dexterity), ...gearLines("dexterity"), ...bonusLines("dexterity")]);
  const intelligence = define("intelligence", [line("Base points", base.intelligence), ...gearLines("intelligence"), ...bonusLines("intelligence")]);

  const vitality = define("vitality", [
    line("Base", 1),
    line(`Strength ${strength} ÷ 2 (rounded down)`, Math.floor(strength / 2)),
    ...gearLines("vitality"),
    ...bonusLines("vitality"),
  ]);
  const resilience = define("resilience", [line("Base", 1), ...gearLines("resilience"), ...bonusLines("resilience")]);
  const agility = define("agility", [
    line("Base", 1),
    line(`Dexterity ${dexterity} ÷ 2 (rounded down)`, Math.floor(dexterity / 2)),
    ...gearLines("agility"),
    ...bonusLines("agility"),
  ]);
  const luck = define("luck", [line("Base", 1), ...gearLines("luck"), ...bonusLines("luck")]);

  // Items roll min and max attack separately; "attack" (both) is kept for items saved before the split.
  const physical = [line(`Strength ${strength} × 1`, strength), line(`Dexterity ${dexterity} × 1`, dexterity)];
  const attackMin = define("attackMin", [line("Base", 1), ...physical, ...gearLines("attack"), ...gearLines("attackMin"), ...bonusLines("attack", "attackMin")]);
  const attackMaxLines = [line("Base", 5), ...physical, ...gearLines("attack"), ...gearLines("attackMax"), ...bonusLines("attack", "attackMax")];
  const magical = [line(`Intelligence ${intelligence} × 1`, intelligence)];
  const magicMin = define("magicAttackMin", [line("Base", 1), ...magical, ...gearLines("magicAttack"), ...gearLines("magicAttackMin"), ...bonusLines("magicAttack", "magicAttackMin")]);
  const magicMaxLines = [line("Base", 5), ...magical, ...gearLines("magicAttack"), ...gearLines("magicAttackMax"), ...bonusLines("magicAttack", "magicAttackMax")];

  // A maximum can never fall below its minimum
  const atLeast = (lines, min) => {
    const total = lines.reduce((sum, l) => sum + l.value, 0);
    return total < min ? [...lines, line("Raised to minimum", min - total)] : lines;
  };
  define("attackMax", atLeast(attackMaxLines, attackMin));
  define("magicAttackMax", atLeast(magicMaxLines, magicMin));

  define("defense", [line(`Resilience ${resilience} ÷ 3 (rounded down)`, Math.floor(resilience / 3)), ...gearLines("defense"), ...bonusLines("defense")]);
  define("evasion", [line("Base", 0.01), line(`Agility ${agility} ÷ 5 × 1% (rounded down)`, Math.floor(agility / 5) * 0.01), ...gearLines("evasion"), ...bonusLines("evasion")], "percent");
  define("speed", [line(`Agility ${agility} ÷ 3 (rounded down)`, Math.floor(agility / 3)), ...gearLines("speed"), ...bonusLines("speed")]);
  define("criticalHitChance", [line("Base", 0.05), line(`Luck ${luck} ÷ 5 × 1% (rounded down)`, Math.floor(luck / 5) * 0.01), ...gearLines("criticalHitChance"), ...bonusLines("criticalHitChance")], "percent");
  define("criticalDamageBonus", [line("Base", 1.5), ...gearLines("criticalDamage"), ...bonusLines("criticalDamage", "criticalDamageBonus")], "percent");

  define("maxHealth", [line("Base", 90), line(`Vitality ${vitality} × 5`, vitality * 5), ...bonusLines("maxHealth")]);
  define("maxStamina", [line("Base", 8), ...bonusLines("maxStamina")]);
  define("maxPower", [line("Base", 5), line(`Intelligence ${intelligence} ÷ 5 (rounded down)`, Math.floor(intelligence / 5)), ...bonusLines("maxPower")]);

  define(
    "gearScore",
    Object.values(player.equipment || {})
      .filter((item) => item && !item.twoHandedOf)
      .map((item) => line(item.name, getItemGearScore(item))),
  );

  return { totals, breakdown };
};

export const MAX_LEVEL = 100;

// Exp needed to go from `level` to the next one: a steady climb (level^1.5), then +12% per level past 80.
export const expForLevel = (level) =>
  Math.round(90 * level ** 1.5 * (level > 80 ? 1.12 ** (level - 80) : 1));

export const LEVEL_UP = { stamina: 1, power: 1, health: 10, statPoints: 3 };

// Current base points in the core stats (also recovers them for old saves)
export const getBaseStatPoints = (player) => getBaseStats(player, getGearBonuses(player.equipment));

// Adds exp and levels up as many times as the exp allows.
// Returns { patch, messages } - patch is for setPlayer, messages are log lines.
export function gainExp(player, amount) {
  let level = player.level || 1;
  let exp = (player.stats?.exp || 0) + amount;
  let statPoints = player.statPoints || 0;
  let skillPoints = player.skillPoints || 0;
  const bonusStats = { ...player.bonusStats };
  const messages = [];
  let gained = 0;
  while (level < MAX_LEVEL && exp >= expForLevel(level)) {
    exp -= expForLevel(level);
    level += 1;
    gained += 1;
    bonusStats.maxHealth = (bonusStats.maxHealth || 0) + LEVEL_UP.health;
    bonusStats.maxStamina = (bonusStats.maxStamina || 0) + LEVEL_UP.stamina;
    bonusStats.maxPower = (bonusStats.maxPower || 0) + LEVEL_UP.power;
    statPoints += LEVEL_UP.statPoints;
    const skill = level % 2 === 0;
    if (skill) skillPoints += 1;
    messages.push(`[gold]Level up![/gold] You reached level ${level}. +${LEVEL_UP.statPoints} stat points${skill ? " and +1 skill point" : ""}.`);
  }
  if (level >= MAX_LEVEL) exp = 0;
  const prev = player.stats || {};
  const stats = calculateStats({ ...player, level, bonusStats, stats: { ...prev, exp } });
  if (gained) {
    stats.health = Math.min(stats.maxHealth, (prev.health ?? 0) + LEVEL_UP.health * gained);
    stats.stamina = Math.min(stats.maxStamina, (prev.stamina ?? 0) + LEVEL_UP.stamina * gained);
    stats.power = Math.min(stats.maxPower, (prev.power ?? 0) + LEVEL_UP.power * gained);
  }
  return { patch: { level, bonusStats, statPoints, skillPoints, stats }, messages };
}

export function calculateStats(player) {
  const { totals: t } = compute(player);
  const prev = player.stats || {};
  const clamp = (value, max) => Math.min(max, value ?? max);
  return {
    ...t,
    exp: prev.exp ?? 0,
    expToLevel: expForLevel(player.level || 1),
    health: clamp(prev.health, t.maxHealth),
    stamina: clamp(prev.stamina, t.maxStamina),
    power: clamp(prev.power, t.maxPower),
  };
}

// Full calculation lines for every stat, for display. Keys match the stat keys in player.stats.
export const getStatBreakdown = (player) => compute(player).breakdown;

// What each stat does and how it is calculated (shown in the character screen tooltips).
export const STAT_INFO = {
  strength: { title: "Strength", description: "Increases melee damage and health.", formula: "+1 Attack per point, +1 Vitality per 2 points." },
  dexterity: { title: "Dexterity", description: "Increases melee damage and agility.", formula: "+1 Attack per point, +1 Agility per 2 points." },
  intelligence: { title: "Intelligence", description: "Increases magic damage and power.", formula: "+1 Magic Attack per point. Every 5 points: +1 Max Power." },
  vitality: { title: "Vitality", description: "Increases maximum health.", formula: "+1 Health per 2 points of Vitality. Each point: +5 Max Health." },
  resilience: { title: "Resilience", description: "Increases defense.", formula: "+1 Defense per 3 points of Resilience." },
  agility: { title: "Agility", description: "Increases speed and evasion.", formula: "+1 Speed per 3 points, +1% Evasion per 5 points." },
  luck: { title: "Luck", description: "Increases critical hit chance and item drop rates.", formula: "+1% Critical Hit Chance per 5 points, +1% Item Drop Chance per 3 points." },
  attackMin: { title: "Minimum attack", description: "The lowest damage of a physical attack.", formula: "1 + Strength + Dexterity + equipment min attack." },
  attackMax: { title: "Maximum attack", description: "The highest damage of a physical attack.", formula: "5 + Strength + Dexterity + equipment max attack." },
  magicAttackMin: { title: "Minimum magic attack", description: "The lowest damage of a magical attack.", formula: "1 + Intelligence + equipment min magic attack." },
  magicAttackMax: { title: "Maximum magic attack", description: "The highest damage of a magical attack.", formula: "5 + Intelligence + equipment max magic attack." },
  defense: { title: "Defense", description: "Reduces the damage taken from each hit.", formula: "1 per 3 Resilience + equipment defense." },
  evasion: { title: "Evasion", description: "Chance to avoid an incoming attack.", formula: "Base + 1% per 5 Agility + equipment." },
  speed: { title: "Speed", description: "How quickly you act.", formula: "Agility ÷ 3 + equipment." },
  criticalHitChance: { title: "Critical chance", description: "Chance for an attack to be a critical hit.", formula: "Base + 1% per 5 Luck + equipment." },
  criticalDamageBonus: { title: "Critical damage", description: "Damage multiplier applied on a critical hit.", formula: "Base + equipment critical damage." },
  maxHealth: { title: "Maximum health", description: "How much damage you can take before collapsing.", formula: "Base + Vitality × 5." },
  maxStamina: { title: "Maximum stamina", description: "Your energy reserve for actions.", formula: "Base + 1 per level." },
  gearScore: { title: "Gear score", description: "The overall power of all equipped gear.", formula: "Per item: stats × weights × 1.5 if two-handed, +25 with an ability." },
  maxPower: { title: "Maximum power", description: "Your reserve for magical abilities.", formula: "Base + 1 per 5 Intelligence." },
};

// Returns a patch for setPlayer: the recalculated stats, plus any changes made to the player (e.g. equipment).
export const recalculateStats = (player, changes = {}) => {
  const next = { ...player, ...changes };
  const stats = calculateStats(next);
  return { ...changes, class: getClassForStats(stats), stats };
};
