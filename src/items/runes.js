import { getPlayer, setPlayer } from "../character/player";
import { recalculateStats } from "../character/stats";
import { getEnemy } from "../combat/combat";
import { CONSUMABLES } from "./consumables";

export const RUNE_MAIN_STATS = ["strength", "dexterity", "intelligence"];

export const canApplyRune = (item) =>
  !!item?.mainStat && !item.twoHandedOf && !item.crafted;

// All rune effects go through this entry point so Crafted protection is shared.
export function applyRune(key, itemId, stat) {
  const player = getPlayer();
  if (!player) return { ok: false, message: "No character loaded." };
  if (getEnemy()) return { ok: false, message: "You can't use runes during combat." };
  const rune = CONSUMABLES[key];
  if (!rune?.rune || !(player.consumables?.[key] > 0))
    return { ok: false, message: "You don't have that rune." };
  const inventory = [...(player.inventory || [])];
  const equipment = { ...(player.equipment || {}) };
  const index = inventory.findIndex((item) => item.id === itemId);
  const slot = Object.keys(equipment).find((key) =>
    !equipment[key]?.twoHandedOf && equipment[key]?.id === itemId);
  const item = index >= 0 ? inventory[index] : equipment[slot];
  if (item?.crafted)
    return { ok: false, message: "Crafted items cannot receive runes." };
  if (!canApplyRune(item))
    return { ok: false, message: "Choose an equipment item with a main stat." };
  if (key !== "architectsRune")
    return { ok: false, message: "That rune's effect is not supported." };
  if (!RUNE_MAIN_STATS.includes(stat) || stat === item.mainStat.stat)
    return { ok: false, message: "Choose a different main stat." };

  const crafted = { ...item, mainStat: { ...item.mainStat, stat }, crafted: true };
  const consumables = { ...player.consumables, [key]: player.consumables[key] - 1 };
  if (consumables[key] === 0) delete consumables[key];
  const changes = { consumables };
  if (index >= 0) {
    inventory[index] = crafted;
    changes.inventory = inventory;
  } else {
    equipment[slot] = crafted;
    changes.equipment = equipment;
  }
  setPlayer(recalculateStats(player, changes));
  return { ok: true, message: `You use an ${rune.name} on ${item.name}. It is now Crafted.` };
}
