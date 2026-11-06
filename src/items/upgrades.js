import { getPlayer, setPlayer } from "../character/player";
import { getEnemy } from "../combat/combat";
import { getItemStatTierCap, getSubStatTier, SLOTS } from "./items";
import { isGatheringToolSlot, isToolItem, TOOL_MAX_ITEM_LEVEL } from "./craftingStats";
import { getToolSubStatTier } from "./tools";

export const MAX_ITEM_UPGRADES = 10;
export const MAX_UPGRADE_ITEM_LEVEL = 100;

const maxLevelFor = (item) => (isToolItem(item) ? TOOL_MAX_ITEM_LEVEL : MAX_UPGRADE_ITEM_LEVEL);

export function getItemUpgradeStatus(item) {
  if (!item?.id || !SLOTS.some((slot) => slot.type === item.slot) || item.twoHandedOf)
    return { ok: false, message: "Choose an unequipped gear item." };
  if (!Number.isSafeInteger(item.iLevel) || item.iLevel < 1 ||
      !Number.isSafeInteger(item.upgrades ?? 0) || (item.upgrades ?? 0) < 0)
    return { ok: false, message: "This item's upgrade data is invalid." };
  if (item.iLevel >= maxLevelFor(item))
    return { ok: false, message: `Maximum item level reached (${maxLevelFor(item)}).` };
  if ((item.upgrades ?? 0) >= MAX_ITEM_UPGRADES)
    return { ok: false, message: "Maximum upgrades reached (10)." };
  const cost = item.iLevel * 100 * ((item.upgrades ?? 0) + 1);
  if (!Number.isFinite(item.price) || item.price < 0 || !Number.isFinite(item.price + cost))
    return { ok: false, message: "This item's value is invalid." };
  return {
    ok: true,
    cost,
    nextLevel: item.iLevel + 1,
  };
}

export function upgradeInventoryItem(itemId) {
  const player = getPlayer();
  if (!player) return { ok: false, message: "No character loaded." };
  if (getEnemy()) return { ok: false, message: "You can't upgrade gear during combat." };
  if (!itemId || Object.values(player.equipment || {}).some((item) => item?.id === itemId))
    return { ok: false, message: "Unequip this item before upgrading it." };
  const inventory = [...(player.inventory || [])];
  const index = inventory.findIndex((item) => item?.id === itemId);
  const item = inventory[index];
  const status = getItemUpgradeStatus(item);
  if (!status.ok) return status;
  if (!Number.isFinite(player.astra) || player.astra < status.cost)
    return { ok: false, message: `You need ${status.cost} astra to upgrade this item.` };
  if (Object.values(item.subStats || {}).some((value) => !Number.isFinite(value)))
    return { ok: false, message: "This item's substats are invalid." };

  const subStats = {};
  const subTiers = { ...item.subTiers };
  const maxStatTier = getItemStatTierCap(item);
  const scaleUp = (value) => Math.round(value * status.nextLevel / item.iLevel * 1e6) / 1e6;
  for (const [stat, value] of Object.entries(item.subStats || {})) {
    // Keep fractional gains so rounding cannot strand low rolls across repeated upgrades.
    subStats[stat] = scaleUp(value);
    const tier = isToolItem(item)
      ? getToolSubStatTier(stat, subStats[stat], status.nextLevel)
      : getSubStatTier(stat, subStats[stat], status.nextLevel, item.twoHanded, maxStatTier);
    if (tier !== null) subTiers[stat] = tier;
  }
  const upgraded = {
    ...item,
    iLevel: status.nextLevel,
    upgrades: (item.upgrades ?? 0) + 1,
    price: item.price + status.cost,
    subStats,
    subTiers,
    ...(isGatheringToolSlot(item.slot) && item.mainStat?.stat === "gatheringPower"
      ? { mainStat: { ...item.mainStat, value: Math.min(50, item.mainStat.value + 1) } } : {}),
  };
  if (item.mythicSubStat && Number.isFinite(item.mythicSubStat.value)) {
    const value = scaleUp(item.mythicSubStat.value);
    const tier = getSubStatTier(item.mythicSubStat.stat, value, status.nextLevel, item.twoHanded, maxStatTier);
    upgraded.mythicSubStat = { ...item.mythicSubStat, value, ...(tier !== null ? { tier } : {}) };
  }
  inventory[index] = upgraded;
  setPlayer({
    inventory,
    astra: player.astra - status.cost,
  });
  return { ok: true, message: `${item.name} upgraded to item level ${upgraded.iLevel} for ${status.cost} astra.` };
}
