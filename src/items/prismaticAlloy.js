import { getPlayer, setPlayer } from "../character/player";
import { getEnemy } from "../combat/combat";
import { CONSUMABLES } from "./consumables";
import { isHolofoilColors, rollHolofoil } from "./holofoil";

export const canApplyPrismaticAlloy = (item) =>
  !!item?.id && !!item.slot && !item.twoHandedOf;

export function applyPrismaticAlloy(itemId) {
  const player = getPlayer();
  if (!player) return { ok: false, message: "No character loaded." };
  if (getEnemy()) return { ok: false, message: "You can't use Prismatic Alloy during combat." };
  const alloy = CONSUMABLES.prismaticAlloy;
  if (!(player.consumables?.prismaticAlloy > 0))
    return { ok: false, message: "You don't have a Prismatic Alloy." };

  const inventory = [...(player.inventory || [])];
  const equipment = { ...(player.equipment || {}) };
  const index = inventory.findIndex((item) => item.id === itemId);
  const slot = Object.keys(equipment).find((key) =>
    !equipment[key]?.twoHandedOf && equipment[key]?.id === itemId);
  const item = index >= 0 ? inventory[index] : equipment[slot];
  if (!canApplyPrismaticAlloy(item))
    return { ok: false, message: "Choose an equipment item to apply the alloy to." };

  const reroll = isHolofoilColors(item.holofoil);
  const upgraded = { ...item, ...rollHolofoil(true), prismatic: true };
  const consumables = { ...player.consumables, prismaticAlloy: player.consumables.prismaticAlloy - 1 };
  if (!consumables.prismaticAlloy) delete consumables.prismaticAlloy;
  const changes = { consumables };
  if (index >= 0) {
    inventory[index] = upgraded;
    changes.inventory = inventory;
  } else {
    equipment[slot] = upgraded;
    changes.equipment = equipment;
  }
  setPlayer(changes);
  return {
    ok: true,
    message: `You use a ${alloy.name} on ${item.name}. Its Holofoil was ${reroll ? "rerolled" : "applied"}.`,
  };
}
