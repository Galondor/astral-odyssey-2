import { getPlayer, setPlayer } from "./player";
import { getEnemy } from "../combat/combat";
import { getBaseStatPoints, recalculateStats } from "./stats";
import { SKILLS, skillPointCost } from "./skills";
import { PASSIVE_POINT_COST, getLearnedPassives } from "./passives";
import { CLASS_TREES } from "./mastery";
import { commitWithClassPreview } from "./classSwitch";

export const CORE_STAT_KEYS = ["strength", "dexterity", "intelligence"];

// Spends stat points on a core stat. Not allowed during combat.
export function spendStatPoint(stat, amount = 1) {
  const p = getPlayer();
  if (!p || !CORE_STAT_KEYS.includes(stat)) return { ok: false };
  if (getEnemy()) return { ok: false, reason: "combat" };
  if (!Number.isInteger(amount) || amount < 1) return { ok: false };
  const statPoints = p.statPoints || 0;
  if (statPoints < amount) return { ok: false, reason: "points" };
  const baseStats = { ...getBaseStatPoints(p) };
  baseStats[stat] += amount;
  return commitWithClassPreview(p, recalculateStats(p, { baseStats, statPoints: statPoints - amount }));
}

export const getUnspentPoints = (player) => {
  if (!player) return 0;
  return (player.statPoints || 0) + (player.skillPoints || 0);
};

// Respecs cost astra, scaling with level.
export const RESPEC_COST_PER_LEVEL = 50;
export const getRespecCost = (player) => Math.max(1, Number(player?.level) || 1) * RESPEC_COST_PER_LEVEL;

// Every core stat goes back to 1 and all the points put into them are refunded.
export function respecStatPoints() {
  const p = getPlayer();
  if (!p) return { ok: false };
  if (getEnemy()) return { ok: false, reason: "combat" };
  const base = getBaseStatPoints(p);
  const refund = CORE_STAT_KEYS.reduce((sum, k) => sum + Math.max(0, (base[k] || 0) - 1), 0);
  if (!refund) return { ok: false, reason: "nothing" };
  const cost = getRespecCost(p);
  if ((p.astra || 0) < cost) return { ok: false, reason: "astra", cost };
  const baseStats = Object.fromEntries(CORE_STAT_KEYS.map((k) => [k, Math.min(base[k] || 0, 1)]));
  return commitWithClassPreview(p, recalculateStats(p, { baseStats, statPoints: (p.statPoints || 0) + refund, astra: p.astra - cost }), { ok: true, refund, cost });
}

// All learned skills are forgotten and their points refunded.
export function respecSkills() {
  const p = getPlayer();
  if (!p) return { ok: false };
  if (getEnemy()) return { ok: false, reason: "combat" };
  const classSkills = new Set(Object.values(CLASS_TREES).flatMap((tree) => tree.nodes.map((node) => node.skill).filter(Boolean)));
  const sharedSkills = Object.entries(p.skills || {}).filter(([key]) => !SKILLS[key]?.signature && !classSkills.has(key));
  const refund = sharedSkills.reduce(
    (sum, [key, level]) => sum + (level || 0) * skillPointCost(key),
    0,
  ) + getLearnedPassives(p).length * PASSIVE_POINT_COST;
  if (!refund) return { ok: false, reason: "nothing" };
  const cost = getRespecCost(p);
  if ((p.astra || 0) < cost) return { ok: false, reason: "astra", cost };
  setPlayer({
    skills: Object.fromEntries(Object.entries(p.skills || {}).filter(([key]) => classSkills.has(key))),
    equippedSkills: (p.equippedSkills || []).filter((key) => classSkills.has(key)),
    classLoadouts: Object.fromEntries(Object.entries(p.classLoadouts || {}).map(([cls, keys]) => [cls, keys.filter((key) => classSkills.has(key))])),
    passives: [], equippedPassives: [],
    skillPoints: (p.skillPoints || 0) + refund, astra: p.astra - cost,
  });
  return { ok: true, refund, cost };
}
