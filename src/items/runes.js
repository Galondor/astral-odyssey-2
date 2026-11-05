import { getPlayer, setPlayer } from "../character/player";
import { recalculateStats } from "../character/stats";
import { getEnemy } from "../combat/combat";
import { CONSUMABLES } from "./consumables";
import {
  getCustomSubStatTiers,
  getSubStatTier,
  getSubStatPool,
  getNextItemQuality,
  upgradeItemQuality,
  rollSubStatAtTier,
  STAT_LABELS,
  SUBSTAT_NAMES,
} from "./items";
import { isToolItem } from "./craftingStats";

export const RUNE_MAIN_STATS = ["strength", "dexterity", "intelligence"];

export const canApplyRune = (item, key) =>
  !!item?.mainStat && !item.twoHandedOf && !isToolItem(item) &&
  (!key || (CONSUMABLES[key]?.rune && !(item.usedRunes || []).includes(CONSUMABLES[key].name))) &&
  (key !== "runeOfAscension" || !!getNextItemQuality(item, "rarity")) &&
  (key !== "polishingRune" || !!getNextItemQuality(item, "condition"));

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
  if ((item?.usedRunes || []).includes(rune.name))
    return { ok: false, message: `This item has already received ${rune.name}.` };
  if (!canApplyRune(item))
    return { ok: false, message: "Choose an equipment item with a main stat." };
  if (!canApplyRune(item, key))
    return { ok: false, message: `This item cannot receive ${rune.name} at its current quality.` };
  if (key === "architectsRune" && (!RUNE_MAIN_STATS.includes(stat) || stat === item.mainStat.stat))
    return { ok: false, message: "Choose a different main stat." };
  if (
    key === "runeOfUnpredictability" &&
    (!Number.isSafeInteger(item.iLevel) || item.iLevel < 1)
  )
    return { ok: false, message: "This item has no valid item level for substat changes." };
  if (!["architectsRune", "runeOfUnpredictability", "runeOfAscension", "polishingRune"].includes(key))
    return { ok: false, message: "That rune's effect is not supported." };

  let updated = item;
  let effectMessage;
  if (key === "architectsRune") {
    updated = { ...item, mainStat: { ...item.mainStat, stat } };
    effectMessage = `its main stat is now ${STAT_LABELS[stat]}`;
  } else if (key === "runeOfAscension" || key === "polishingRune") {
    const field = key === "runeOfAscension" ? "rarity" : "condition";
    const result = upgradeItemQuality(item, field);
    if (!result.ok) return result;
    updated = result.item;
    effectMessage = `its ${field} is now ${updated[field]}`;
  } else {
    const subStats = { ...(item.subStats || {}) };
    const subTiers = { ...(item.subTiers || {}) };
    // Runes can cross normal pools, but resistance stats retain their armor/jewelry restriction.
    const availableStats = SUBSTAT_NAMES.filter((candidate) =>
      !["criticalResistance", "statusResistance"].includes(candidate) || getSubStatPool(item.slot).includes(candidate));
    const effect = Math.floor(Math.random() * 4);
    if (effect === 1 && Object.keys(subStats).length) {
      const currentStat = Object.keys(subStats)[Math.floor(Math.random() * Object.keys(subStats).length)];
      const currentTier = subTiers[currentStat] ?? getSubStatTier(
        currentStat, subStats[currentStat], item.iLevel, item.twoHanded,
      );
      if (currentTier === null)
        return { ok: false, message: `Could not determine the ${STAT_LABELS[currentStat] || currentStat} substat tier.` };
      const tiers = currentTier === 0 ? [1] : currentTier === 7 ? [6] : [currentTier - 1, currentTier + 1];
      const nextTier = tiers[Math.floor(Math.random() * tiers.length)];
      const value = rollSubStatAtTier(currentStat, item.iLevel, nextTier, item.twoHanded);
      if (value === null)
        return { ok: false, message: `Could not roll a ${STAT_LABELS[currentStat] || currentStat} substat at tier ${nextTier}.` };
      subStats[currentStat] = value;
      subTiers[currentStat] = nextTier;
      effectMessage = `${STAT_LABELS[currentStat] || currentStat} changed to T${nextTier}`;
    } else if (effect === 2 && Object.keys(subStats).length) {
      const currentStats = Object.keys(subStats);
      const currentStat = currentStats[Math.floor(Math.random() * currentStats.length)];
      const tier = subTiers[currentStat] ?? getSubStatTier(
        currentStat, subStats[currentStat], item.iLevel, item.twoHanded,
      );
      if (tier === null)
        return { ok: false, message: `Could not determine the ${STAT_LABELS[currentStat] || currentStat} substat tier.` };
      const replacements = availableStats.filter((candidate) => !(candidate in subStats));
      if (replacements.length) {
        const newStat = replacements[Math.floor(Math.random() * replacements.length)];
        const value = rollSubStatAtTier(newStat, item.iLevel, tier, item.twoHanded);
        if (value === null)
          return { ok: false, message: `Could not roll a ${STAT_LABELS[newStat] || newStat} substat at tier ${tier}.` };
        delete subStats[currentStat];
        delete subTiers[currentStat];
        subStats[newStat] = value;
        subTiers[newStat] = tier;
        effectMessage = `${STAT_LABELS[currentStat] || currentStat} became ${STAT_LABELS[newStat] || newStat} at T${tier}`;
      }
    } else if (effect === 3) {
      const additions = availableStats.filter((candidate) => !(candidate in subStats));
      if (additions.length) {
        const newStat = additions[Math.floor(Math.random() * additions.length)];
        const tiers = getCustomSubStatTiers(newStat, item.iLevel, item.twoHanded);
        if (tiers.length) {
          const tier = tiers[Math.floor(Math.random() * tiers.length)];
          subStats[newStat] = rollSubStatAtTier(newStat, item.iLevel, tier, item.twoHanded);
          subTiers[newStat] = tier;
          effectMessage = `added ${STAT_LABELS[newStat] || newStat} at T${tier}`;
        }
      }
    }
    effectMessage ||= "nothing happened";
    updated = { ...item, subStats, subTiers };
  }
  updated = { ...updated, usedRunes: [...(item.usedRunes || []), rune.name] };
  const consumables = { ...player.consumables, [key]: player.consumables[key] - 1 };
  if (consumables[key] === 0) delete consumables[key];
  const changes = { consumables };
  if (index >= 0) {
    inventory[index] = updated;
    changes.inventory = inventory;
  } else {
    equipment[slot] = updated;
    changes.equipment = equipment;
  }
  setPlayer(recalculateStats(player, changes));
  return { ok: true, message: `You use ${rune.name} on ${item.name}: ${effectMessage}. Added the ${rune.name} tag.` };
}
