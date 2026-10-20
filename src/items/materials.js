import { getPlayer, setPlayer } from "../character/player";

/*
 Crafting materials, dropped by enemies and spent at the Workshop.
 The player saves `materials` ({ key: count }).
 Fields: name, description, tier ("common" | "uncommon" | "rare" | "boss")
*/
export const MATERIAL_TIERS = {
  common: { label: "Common", color: "#b0b0b0" },
  uncommon: { label: "Uncommon", color: "#1eff00" },
  rare: { label: "Rare", color: "#0070dd" },
  epic: { label: "Epic", color: "#a335ee" },
  legendary: { label: "Boss", color: "#ff8000" },
};

export const MATERIALS = {
  slime_gel: { name: "Slime Gel", tier: "common", description: "Sticky, resilient goo." },
  wolf_pelt: { name: "Wolf Pelt", tier: "common", description: "A thick pelt, good for hardy leather." },
  boar_tusk: { name: "Boar Tusk", tier: "common", description: "A sturdy tusk that can be ground into tools." },
  goblin_scrap: { name: "Goblin Scrap", tier: "common", description: "Salvaged iron and fittings." },
  spider_silk: { name: "Spider Silk", tier: "common", description: "Light, strong thread." },
  rotwood_bark: { name: "Rotwood Bark", tier: "common", description: "Dense bark from the Darkwood." },
  obsidian_shard: { name: "Obsidian Shard", tier: "common", description: "A razor-edged volcanic glass." },
  beast_fang: { name: "Beast Fang", tier: "uncommon", description: "A fang still sharp enough to cut." },
  venom_sac: { name: "Venom Sac", tier: "uncommon", description: "Potent and volatile." },
  wraith_essence: { name: "Wraith Essence", tier: "uncommon", description: "A chill, flickering wisp of spirit." },
  ember_core: { name: "Ember Core", tier: "uncommon", description: "A coal that never goes out." },
  primal_essence: { name: "Primal Essence", tier: "rare", description: "Raw vitality, shed only by elite creatures." },
  gelatinous_core: { name: "Gelatinous Core", tier: "legendary", description: "The pulsing heart of the Gelatinous King." },
  widow_heart: { name: "Widow's Heart", tier: "legendary", description: "Still twitching. Dropped by the Widow Queen." },
  infernal_heart: { name: "Infernal Heart", tier: "legendary", description: "Burns hot enough to melt steel. Dropped by the Infernal Drake." },
  wraith_crown: { name: "Wraith Crown", tier: "legendary", description: "A cold crown torn from the Wraith King." },
  metal_scraps: { name: "Metal Scraps", tier: "common", description: "Bits of metal salvaged from various sources." },
  leather: { name: "Leather", tier: "common", description: "Tanned hide, useful for crafting armor and gear." }
};

export const getMaterialCount = (player, key) => player?.materials?.[key] || 0;

export const getMaterials = (player = getPlayer()) =>
  Object.entries(player?.materials || {})
    .filter(([key, count]) => MATERIALS[key] && count > 0)
    .map(([key, count]) => ({ key, count, ...MATERIALS[key] }));

export const materialTooltip = (key, owned) => {
  const m = MATERIALS[key];
  if (!m) return null;
  return {
    title: m.name,
    titleColor: MATERIAL_TIERS[m.tier].color,
    subtitle: `${MATERIAL_TIERS[m.tier].label} Material`,
    description: m.description,
    footer: owned !== undefined ? `Owned: ${owned}` : undefined,
  };
};

// Returns a new `materials` object with `drops` ({ key: amount }) added.
export const addToMaterials = (materials = {}, drops) => {
  const out = { ...materials };
  for (const [key, n] of Object.entries(drops)) if (MATERIALS[key] && n > 0) out[key] = (out[key] || 0) + n;
  return out;
};

export const hasMaterials = (player, cost = {}) =>
  Object.entries(cost).every(([key, n]) => getMaterialCount(player, key) >= n);

export const spendMaterials = (player, cost = {}) => {
  const out = { ...(player.materials || {}) };
  for (const [key, n] of Object.entries(cost)) {
    out[key] = (out[key] || 0) - n;
    if (out[key] <= 0) delete out[key];
  }
  return out;
};

export const addMaterial = (key, amount = 1) =>
  setPlayer({ materials: addToMaterials(getPlayer()?.materials, { [key]: amount }) });
