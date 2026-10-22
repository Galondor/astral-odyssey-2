import { getInventoryItemKey, getPlayer, setPlayer } from "../character/player";

const favoriteKey = (item) =>
  typeof item === "string" ? item : item.id || item.key || getInventoryItemKey(item);

export const isFavorite = (player, category, item) =>
  !!item && !!player?.favoriteInventoryItems?.[category]?.includes(favoriteKey(item));

export function toggleFavorite(category, item) {
  const player = getPlayer();
  if (!player || !item) return { ok: false, message: "That item is no longer in your inventory." };
  const key = favoriteKey(item);
  const owned = category === "gear"
    ? [...(player?.inventory || []), ...Object.values(player?.equipment || {})]
      .some((gear) => gear && !gear.twoHandedOf && favoriteKey(gear) === key)
    : category === "gemstones"
      ? (player?.gemstones || []).some((gemstone) => favoriteKey(gemstone) === key)
      : category === "keyItems"
        ? (player?.keyItems || []).includes(key)
        : ["consumables", "materials"].includes(category) && player?.[category]?.[key] > 0;
  if (!owned) return { ok: false, message: "That item is no longer in your inventory." };
  const favorites = player.favoriteInventoryItems?.[category] || [];
  const favorite = !favorites.includes(key);
  setPlayer({
    favoriteInventoryItems: {
      ...player.favoriteInventoryItems,
      [category]: favorite ? [...favorites, key] : favorites.filter((entry) => entry !== key),
    },
  });
  return { ok: true, favorite };
}
