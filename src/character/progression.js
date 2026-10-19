import { getPlayer, setPlayer } from "./player";
import { getEnemy } from "../combat/combat";
import { getBaseStatPoints, recalculateStats } from "./stats";

export const CORE_STAT_KEYS = ["strength", "dexterity", "intelligence"];

// Spends one stat point on a core stat. Not allowed during combat.
export function spendStatPoint(stat) {
  const p = getPlayer();
  if (!p || !CORE_STAT_KEYS.includes(stat)) return { ok: false };
  if (getEnemy()) return { ok: false, reason: "combat" };
  if ((p.statPoints || 0) < 1) return { ok: false, reason: "points" };
  const baseStats = { ...getBaseStatPoints(p) };
  baseStats[stat] += 1;
  setPlayer(recalculateStats(p, { baseStats, statPoints: p.statPoints - 1 }));
  return { ok: true };
}

export const getUnspentPoints = (player) => {
  if (!player) return 0;
  return (player.statPoints || 0) + (player.skillPoints || 0);
};
