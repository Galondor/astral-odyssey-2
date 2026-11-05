import { isHolofoilColors } from "./holofoil";

export const MAX_ITEM_SOCKETS = 3;

export const isSkillGemstone = (gemstone) => gemstone?.type === "skill";

export const getItemGemstones = (item) => {
  if (!item || item.twoHandedOf) return [];
  return Array.isArray(item.gemstones)
    ? item.gemstones.filter(Boolean)
    : item.gemstone ? [item.gemstone] : [];
};

export const getItemBaseSocketCount = (item) => {
  if (!item || item.twoHandedOf) return 0;
  switch (item.rarity) {
    case "Rare": return 1;
    case "Epic":
      return item.socketCount === 2 ? 2 : 1;
    case "Legendary":
    case "Unique":
    case "Mythic": return 2;
    default: return 0;
  }
};

export const getItemSocketCount = (item) =>
  !item || item.twoHandedOf ? 0 : Math.min(
    MAX_ITEM_SOCKETS,
    getItemBaseSocketCount(item) + (isHolofoilColors(item.holofoil) ? 1 : 0),
  );

export const rollItemSocketCount = (rarity) =>
  rarity === "Epic" ? (Math.random() < 0.5 ? 1 : 2) : getItemBaseSocketCount({ rarity });
