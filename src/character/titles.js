import { RARITY_COLORS } from "../items/rarities";

export const TITLE_RARITIES = ["Rare", "Epic", "Legendary", "Unique"];

export const TITLES = {
  monarchOfTheOdyssey: {
    id: "monarchOfTheOdyssey",
    name: "Monarch of the Odyssey",
    rarity: "Unique",
    color: RARITY_COLORS.Unique,
    criteria: "Reach level 100 before version 0.3.0.0.",
  },
};

export const getTitle = (id) => TITLES[id] || null;
