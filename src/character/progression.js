import { getPlayer, setPlayer } from "./player";
import { getEnemy } from "../combat/combat";
import { getBaseStatPoints, recalculateStats } from "./stats";

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
  setPlayer(recalculateStats(p, { baseStats, statPoints: statPoints - amount }));
  return { ok: true };
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
  setPlayer(recalculateStats(p, { baseStats, statPoints: (p.statPoints || 0) + refund, astra: p.astra - cost }));
  return { ok: true, refund, cost };
}

// All learned skills are forgotten and their points refunded.
export function respecSkills() {
  const p = getPlayer();
  if (!p) return { ok: false };
  if (getEnemy()) return { ok: false, reason: "combat" };
  const refund = Object.values(p.skills || {}).reduce((sum, n) => sum + (n || 0), 0);
  if (!refund) return { ok: false, reason: "nothing" };
  const cost = getRespecCost(p);
  if ((p.astra || 0) < cost) return { ok: false, reason: "astra", cost };
  setPlayer({ skills: {}, equippedSkills: [], skillPoints: (p.skillPoints || 0) + refund, astra: p.astra - cost });
  return { ok: true, refund, cost };
}
