export const HOLOFOIL_CHANCE = 0.01;
export const HOLOFOIL_EFFECTS = [
  "aurora",
  "nebula",
  "glow",
  "facets",
  "aurora-animated",
  "nebula-animated",
  "glow-animated",
  "facets-animated",
];

export const isHolofoilColors = (colors) =>
  Array.isArray(colors) && colors.length === 2 &&
  colors.every((color) => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color));

const rollEffect = () =>
  HOLOFOIL_EFFECTS[Math.floor(Math.random() * HOLOFOIL_EFFECTS.length)];

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
  return {
    holofoil: isHolofoilColors(holofoil) ? [...holofoil] : [randomColor(), randomColor()],
    holofoilEffect: rollEffect(),
  };
};

const getEffectStyle = (effect, color1, color2) => {
  switch (effect) {
    case "nebula":
    case "nebula-animated":
      return {
        backgroundSize: "180% 180%, 180% 180%, 100% 100%",
        backgroundImage: `radial-gradient(ellipse at 20% 25%, ${color1}99, transparent 48%), radial-gradient(ellipse at 80% 75%, ${color2}99, transparent 48%), var(--holofoil-background)`,
      };
    case "prism":
      return {
        backgroundImage: `repeating-linear-gradient(135deg, transparent 0 16px, ${color1}66 17px 19px, transparent 20px 34px), var(--holofoil-background)`,
      };
    case "ripple":
      return {
        backgroundImage: `repeating-radial-gradient(ellipse at 25% 35%, transparent 0 12px, ${color1}99 13px 15px, transparent 16px 28px), repeating-radial-gradient(ellipse at 75% 65%, transparent 0 16px, ${color2}99 17px 19px, transparent 20px 36px), var(--holofoil-background)`,
      };
    case "bands":
      return {
        backgroundImage: `repeating-linear-gradient(0deg, ${color1}55 0 3px, transparent 3px 12px), repeating-linear-gradient(90deg, ${color2}44 0 2px, transparent 2px 16px), var(--holofoil-background)`,
      };
    case "facets":
    case "facets-animated":
      return {
        backgroundSize: "180% 180%, 180% 180%, 100% 100%",
        backgroundImage: `conic-gradient(from 30deg at 25% 35%, ${color1}99, transparent 25%, ${color2}88 40%, transparent 60%), conic-gradient(from 210deg at 75% 70%, ${color2}99, transparent 30%, ${color1}77 55%, transparent 75%), var(--holofoil-background)`,
      };
    case "glow":
    case "glow-animated":
      return {
        backgroundSize: "180% 180%, 180% 180%, 100% 100%",
        backgroundImage: `radial-gradient(ellipse at 50% 0%, ${color1}bb, transparent 65%), radial-gradient(ellipse at 50% 100%, ${color2}bb, transparent 65%), var(--holofoil-background)`,
      };
    case "waves":
      return {
        backgroundImage: `repeating-linear-gradient(155deg, transparent 0 12px, ${color1}77 13px 15px, transparent 16px 28px), repeating-linear-gradient(25deg, transparent 0 18px, ${color2}66 19px 21px, transparent 22px 40px), var(--holofoil-background)`,
      };
    default:
      return {
        backgroundImage: `linear-gradient(135deg, ${color1}99, transparent 55%), linear-gradient(315deg, ${color2}99, transparent 55%), var(--holofoil-background)`,
      };
  }
};

export const getHolofoilStyle = (item) => {
  if (!isHolofoilColors(item?.holofoil)) return undefined;
  const [color1, color2] = item.holofoil;
  const effect = item.holofoilEffect || "aurora";
  const baseEffect = effect.replace(/-animated$/, "");
  const isAnimated = effect.endsWith("-animated");
  return {
    "--holofoil-background": `linear-gradient(135deg, ${color1}66, ${color2}66)`,
    ...getEffectStyle(baseEffect === "aurora" ? effect : baseEffect, color1, color2),
    ...(isAnimated
      ? {
        backgroundSize: "180% 180%, 180% 180%, 100% 100%",
        animation: `holofoil-${baseEffect} 8s ease-in-out infinite alternate`,
      }
      : {}),
  };
};
