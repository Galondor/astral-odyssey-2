import { getPlayer, setPlayer } from "../character/player";
import { getEnemy } from "../combat/combat";
import { validateItemName } from "../shared/names";

export const canRenameItem = (item) => !!item?.id && !!item.slot && !item.twoHandedOf;

export function renameItem(itemId, input) {
  const player = getPlayer();
  if (!player) return { ok: false, message: "No character loaded." };
  if (getEnemy()) return { ok: false, message: "You can't rename items during combat." };
  if (!(player.consumables?.itemCertificate > 0))
    return { ok: false, message: "You don't have an Item Certificate." };
  const name = typeof input === "string" ? input.trim() : "";
  const error = validateItemName(name);
  if (error) return { ok: false, message: error };
  const inventory = [...(player.inventory || [])];
  const equipment = { ...(player.equipment || {}) };
  const index = inventory.findIndex((item) => item.id === itemId);
  const slot = Object.keys(equipment).find((key) =>
    !equipment[key]?.twoHandedOf && equipment[key]?.id === itemId);
  const item = index >= 0 ? inventory[index] : equipment[slot];
  if (!canRenameItem(item))
    return { ok: false, message: "Choose an equipment item to rename." };
  if (item.name === name) return { ok: false, message: "Choose a different item name." };

  const renamed = { ...item, name };
  const consumables = { ...player.consumables, itemCertificate: player.consumables.itemCertificate - 1 };
  if (!consumables.itemCertificate) delete consumables.itemCertificate;
  const patch = { consumables };
  if (index >= 0) {
    inventory[index] = renamed;
    patch.inventory = inventory;
  } else {
    equipment[slot] = renamed;
    for (const key of Object.keys(equipment)) {
      if (equipment[key]?.twoHandedOf === slot)
        equipment[key] = { ...equipment[key], name };
    }
    patch.equipment = equipment;
  }
  setPlayer(patch);
  return { ok: true, message: `You use an Item Certificate. ${item.name} is now named ${name}.` };
}
