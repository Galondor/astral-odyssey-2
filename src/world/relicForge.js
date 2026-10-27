import { ABILITIES } from "../combat/abilities";
import { getPlayer } from "../character/player";
import {
  CONDITION_NAMES,
  createCustomItem,
  getCustomSubStatTiers,
  getSubStatPool,
  GEAR_SLOT_TYPES,
  MAIN_STAT_NAMES,
  STAT_TIERS,
} from "../items/items";
import { spendMaterials } from "../items/materials";

export const RELIC_CRAFT_RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
export const RELIC_RARITY_COSTS = {
  Common: 0,
  Uncommon: 5,
  Rare: 12,
  Epic: 25,
  Legendary: 45,
};
export const RELIC_CONDITION_COST = 10;

const SUBSTAT_COUNTS = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Epic: 4,
  Legendary: 5,
};
const randomItem = (items) => items[Math.floor(Math.random() * items.length)];
const substatTierCost = (tier) => (tier + 1) ** 2;
const randomName = () =>
  `${randomItem(["Astral", "Echoing", "Riftbound", "Labyrinthine", "Starforged"])} ${randomItem(["Vow", "Whisper", "Memory", "Path", "Eternity"])}`;

export function getRelicCraftCost(rarity, subStats = [], ability = "", condition = "random") {
  return (
    (RELIC_RARITY_COSTS[rarity] ?? Infinity) +
    subStats.reduce(
      (total, entry) =>
        total +
        (entry?.stat && entry.stat !== "random" && Number.isInteger(entry.tier)
          ? substatTierCost(entry.tier)
          : 0),
      0,
    ) +
    (ability ? 18 : 0) +
    (condition && condition !== "random" ? RELIC_CONDITION_COST : 0)
  );
}

export function craftRelicItem(player = getPlayer(), selection = {}) {
  if (!player) return { ok: false, message: "No character loaded." };
  if ((player.consumables?.relic || 0) < 1)
    return { ok: false, message: "You need a Sealed Relic to craft an item." };
  const { slot, rarity } = selection;
  if (!GEAR_SLOT_TYPES.includes(slot) || !RELIC_CRAFT_RARITIES.includes(rarity))
    return { ok: false, message: "Choose a valid item slot and rarity." };
  if (selection.name !== undefined && (typeof selection.name !== "string" || selection.name.trim().length > 60))
    return { ok: false, message: "Item names must be 60 characters or fewer." };
  const condition = selection.condition || "random";
  if (condition !== "random" && !CONDITION_NAMES.includes(condition))
    return { ok: false, message: "Choose a valid item condition." };
  const twoHanded = !!selection.twoHanded && slot === "weapon";
  const iLevel = Math.max(1, Math.floor(player.level || 1));
  const pool = getSubStatPool(slot);
  const count = SUBSTAT_COUNTS[rarity];
  if (!count || pool.length < count)
    return { ok: false, message: "That rarity cannot be crafted for this item slot." };
  const requestedSubStats = Array.isArray(selection.subStats) ? selection.subStats : [];
  const chosen = [];
  for (const entry of requestedSubStats) {
    if (!entry?.stat || entry.stat === "random") continue;
    if (!pool.includes(entry.stat) || chosen.some((value) => value.stat === entry.stat))
      return { ok: false, message: "Choose unique substats available for this slot." };
    const tierOptions = getCustomSubStatTiers(entry.stat, iLevel, twoHanded);
    if (!tierOptions.includes(entry.tier))
      return { ok: false, message: `${entry.stat} cannot roll at that tier for this item.` };
    chosen.push({ stat: entry.stat, tier: entry.tier });
  }
  if (chosen.length > count)
    return { ok: false, message: `This rarity supports up to ${count} substats.` };
  const abilityPool = ABILITIES.filter((ability) => ability.slots.includes(slot));
  const requestedAbility = selection.ability || "";
  if (requestedAbility && !abilityPool.some((ability) => ability.name === requestedAbility))
    return { ok: false, message: "Choose an ability available for this item slot." };
  const cost = getRelicCraftCost(rarity, chosen, requestedAbility, condition);
  if (!Number.isFinite(cost) || (player.materials?.relicFragments || 0) < cost)
    return { ok: false, message: `You need ${cost} Relic Fragments for this design.` };

  const available = pool.filter((stat) => !chosen.some((value) => value.stat === stat));
  while (chosen.length < count) {
    const stat = randomItem(available);
    available.splice(available.indexOf(stat), 1);
    const tiers = getCustomSubStatTiers(stat, iLevel, twoHanded);
    if (!tiers.length)
      return { ok: false, message: `${stat} cannot roll at this item level.` };
    chosen.push({ stat, tier: randomItem(tiers) });
  }
  const ability = requestedAbility || randomItem(abilityPool)?.name || "";
  const item = createCustomItem({
    name: selection.name?.trim() || randomName(),
    slot,
    rarity,
    condition: condition === "random" ? randomItem(CONDITION_NAMES) : condition,
    iLevel,
    price: Math.max(0, Math.round(iLevel * (RELIC_RARITY_COSTS[rarity] + 20))),
    mainStat: {
      stat: randomItem(MAIN_STAT_NAMES),
      tier: randomItem(STAT_TIERS),
    },
    subStats: Object.fromEntries(chosen.map(({ stat, tier }) => [stat, tier])),
    ability,
    twoHanded,
  });
  return {
    ok: true,
    item,
    cost,
    message: `${item.name} was forged for ${cost} Relic Fragments.`,
    patch: {
      inventory: [...(player.inventory || []), item],
      consumables: {
        ...(player.consumables || {}),
        relic: player.consumables.relic - 1,
      },
      materials: spendMaterials(player, { relicFragments: cost }),
    },
  };
}
