export const HOLOFOIL_CHANCE = 0.01;

export const isHolofoilColors = (colors) =>
  Array.isArray(colors) && colors.length === 2 &&
  colors.every((color) => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color));

export const validateHolofoil = (holofoil) => {
  if (holofoil !== undefined && holofoil !== true && !isHolofoilColors(holofoil)) {
    throw new Error("Holofoil colors must be two hex codes in #RRGGBB format.");
  }
};

export const rollHolofoil = (holofoil) => {
  validateHolofoil(holofoil);
  if (holofoil === undefined && Math.random() >= HOLOFOIL_CHANCE) return {};
  const randomColor = () =>
    `#${Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, "0")}`;
  return { holofoil: isHolofoilColors(holofoil) ? [...holofoil] : [randomColor(), randomColor()] };
};

export const getHolofoilStyle = (item) =>
  isHolofoilColors(item?.holofoil)
    ? {
      "--holofoil-background": `linear-gradient(135deg, ${item.holofoil[0]}66, ${item.holofoil[1]}66)`,
      backgroundImage: "var(--holofoil-background)",
    }
    : undefined;
