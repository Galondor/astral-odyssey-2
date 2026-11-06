import { getInventoryItemKey, getPlayer, setPlayer } from "../character/player";
import { recalculateStats } from "../character/stats";
import { getGatheringTier } from "../character/gathering";
import { getEnemy } from "../combat/combat";
import { CRAFTING_MATERIALS, REGION_TIERS } from "./craftingMaterials";
import { isToolItem } from "./craftingStats";
import { isFavorite } from "./favorites";
import { getItemBaseType } from "./intrinsics";
import { getSlotBases, RARITY_NAMES, SLOTS } from "./items";
import { MATERIALS } from "./materials";
import { REGIONS } from "../world/regions";

const FAMILY_BY_MATERIAL = { metal: "ore", wood: "wood", leather: "hide", cloth: "cloth", jewelry: "precious" };

export function getDismantleResources(item) {
  if (!item || item.twoHandedOf || !SLOTS.some(({ type }) => type === item.slot)) return null;
  const tool = isToolItem(item);
  const jewelry = ["ring", "necklace", "precisionTools"].includes(item.slot);
  const base = getSlotBases(item.slot).find(({ name }) => name === getItemBaseType(item));
  const family = jewelry ? "precious" : tool ? "ore" : FAMILY_BY_MATERIAL[base?.material] ||
    (item.mainStat?.stat === "intelligence" && !["weapon", "offhand"].includes(item.slot) ? "cloth" :
      item.mainStat?.stat === "dexterity" && !["weapon", "offhand"].includes(item.slot) ? "hide" : "ore");
  const level = Math.max(1, item.iLevel || 1);
  const tier = tool ? getGatheringTier(level) :
    REGION_TIERS.filter((region) => level >= REGIONS[region].minLevel).length;
  const key = Object.keys(CRAFTING_MATERIALS).find((key) =>
    CRAFTING_MATERIALS[key].family === family && CRAFTING_MATERIALS[key].tier === tier);
  const rarity = Math.max(0, RARITY_NAMES.indexOf(item.rarity));
  const min = 1 + Math.floor(rarity / 2);
  return { key, min, max: min + 1 + Math.floor(rarity / 2) + Number(!!item.twoHanded) };
}

export function dismantleOwnedItem(item, rng = Math.random) {
  const player = getPlayer();
  if (getEnemy()) return { ok: false, message: "You can't dismantle items during combat." };
  if (!player || !item) return { ok: false, message: "That item is no longer owned." };
  const key = getInventoryItemKey(item);
  const inventory = [...(player.inventory || [])];
  const index = inventory.findIndex((owned) => getInventoryItemKey(owned) === key);
  const slot = Object.keys(player.equipment || {}).find((slot) => {
    const owned = player.equipment[slot];
    return owned && !owned.twoHandedOf && getInventoryItemKey(owned) === key;
  });
  const owned = index >= 0 ? inventory[index] : player.equipment?.[slot];
  if (!owned) return { ok: false, message: "That item is no longer owned." };
  if (isFavorite(player, "gear", owned))
    return { ok: false, message: "Unfavorite this item before dismantling it." };
  const resources = getDismantleResources(owned);
  if (!resources?.key) return { ok: false, message: "That item can't be dismantled." };
  const count = resources.min + Math.floor(rng() * (resources.max - resources.min + 1));
  const materials = { ...(player.materials || {}) };
  materials[resources.key] = (materials[resources.key] || 0) + count;
  let patch;
  if (index >= 0) {
    inventory.splice(index, 1);
    patch = { inventory, materials };
  } else {
    const equipment = { ...player.equipment };
    delete equipment[slot];
    if (owned.twoHanded) delete equipment.offHand;
    patch = recalculateStats(player, { equipment, materials });
  }
  const unseenInventoryItems = { ...(player.unseenInventoryItems || {}) };
  if (unseenInventoryItems.gear) {
    unseenInventoryItems.gear = unseenInventoryItems.gear.filter((entry) => entry !== key);
    if (!unseenInventoryItems.gear.length) delete unseenInventoryItems.gear;
  }
  setPlayer({ ...patch, unseenInventoryItems });
  return {
    ok: true, materials: { [resources.key]: count },
    message: `Dismantled ${owned.name}: ${count} ${MATERIALS[resources.key].name}.`,
  };
}
