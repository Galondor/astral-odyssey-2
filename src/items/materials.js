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
  legendary: { label: "Legendary", color: "#ff8000" },
  unique: { label: "Unique", color: "#ff2a2a" }
};

export const MATERIALS = {
  slime_gel: { name: "Slime Gel", tier: "common", description: "Sticky, resilient goo." },
  wolf_pelt: { name: "Wolf Pelt", tier: "common", description: "A thick pelt, good for hardy leather." },
  boar_tusk: { name: "Boar Tusk", tier: "common", description: "A sturdy tusk that can be ground into tools." },
  goblin_scrap: { name: "Goblin Scrap", tier: "common", description: "Salvaged iron and fittings." },
  living_thatch: { name: "Living Thatch", tier: "rare", description: "Animated straw still twitching with the scarecrow's strange life." },
  spider_silk: { name: "Spider Silk", tier: "common", description: "Light, strong thread." },
  rotwood_bark: { name: "Rotwood Bark", tier: "common", description: "Dense bark from the Darkwood." },
  obsidian_shard: { name: "Obsidian Shard", tier: "common", description: "A razor-edged volcanic glass." },
  beast_fang: { name: "Beast Fang", tier: "uncommon", description: "A fang still sharp enough to cut." },
  venom_sac: { name: "Venom Sac", tier: "uncommon", description: "Potent and volatile." },
  wraith_essence: { name: "Wraith Essence", tier: "uncommon", description: "A chill, flickering wisp of spirit." },
  ember_core: { name: "Ember Core", tier: "uncommon", description: "A coal that never goes out." },
  primal_essence: { name: "Primal Essence", tier: "rare", description: "Raw vitality, shed only by elite creatures." },
  crypt_grave_salt: { name: "Grave Salt", tier: "uncommon", description: "Drowned salt carried by basic enemies of the Sunken Crypt." },
  crypt_soul_shackle: { name: "Soul Shackle", tier: "rare", description: "A spirit-binding chain taken from Sunken Crypt elites." },
  crypt_regent_marrow: { name: "Regent's Marrow", tier: "unique", description: "Deathless marrow found only in the Sunken Crypt's bosses." },
  warren_blasting_powder: { name: "Warren Blasting Powder", tier: "uncommon", description: "Unstable powder scavenged from basic Goblin Warren enemies." },
  warren_hexbone: { name: "Warren Hexbone", tier: "rare", description: "A carved war charm carried by Goblin Warren elites." },
  warren_hoard_seal: { name: "Hoard Seal", tier: "unique", description: "A royal treasure seal held only by Goblin Warren bosses." },
  forge_cinder_flux: { name: "Cinder Flux", tier: "uncommon", description: "Smoldering residue from basic Infernal Forge enemies." },
  forge_tempered_alloy: { name: "Helltempered Alloy", tier: "rare", description: "Heat-hardened metal recovered from Infernal Forge elites." },
  forge_slagheart: { name: "Slagheart", tier: "unique", description: "A living furnace core taken only from Infernal Forge bosses." },
  citadel_rime_shard: { name: "Rime Shard", tier: "uncommon", description: "Unmelting ice shed by basic Frozen Citadel enemies." },
  citadel_pale_sigil: { name: "Pale Court Sigil", tier: "rare", description: "A frost-bound insignia carried by Frozen Citadel elites." },
  citadel_winter_heart: { name: "Heart of Winter", tier: "unique", description: "Concentrated winter found only within Frozen Citadel bosses." },
  suncleft_scourge_fang: { name: "Sun-Scoured Fang", tier: "common", description: "A sand-worn fang taken from a Suncleft dune jackal." },
  glassback_chitin: { name: "Glassback Chitin", tier: "rare", description: "A razor-edged plate from a Suncleft glassback scorpion." },
  buried_wyrm_scale: { name: "Buried Wyrm Scale", tier: "legendary", description: "A heat-shimmering scale taken from the Buried Wyrm." },
  bilge_raider_insignia: { name: "Bilge Raider Insignia", tier: "common", description: "A salt-stained badge taken from a Tempest Reach bilge raider." },
  abyssal_scale: { name: "Abyssal Scale", tier: "rare", description: "A deep-sea scale shed by a Tempest Reach reef stalker." },
  leviathan_heart: { name: "Leviathan Heart", tier: "legendary", description: "A storm-charged heart taken from the Tempest Reach Leviathan." },
  frostfang_pelt: { name: "Frostfang Pelt", tier: "common", description: "A cold-resistant pelt taken from a Frostfall frostfang." },
  rimebound_plate: { name: "Rimebound Plate", tier: "rare", description: "An ice-encrusted plate taken from a Frostfall rime sentinel." },
  glacier_core: { name: "Glacier Core", tier: "legendary", description: "A core of ancient ice taken from the Avalanche Colossus." },
  salvaged_dog_tag: { name: "Salvaged Dog Tag", tier: "common", description: "A battered tag recovered from a Shattered Front trench scavenger." },
  war_hardened_insignia: { name: "War-Hardened Insignia", tier: "rare", description: "A veteran's insignia recovered from the Shattered Front." },
  commanders_crest: { name: "Commander's Crest", tier: "legendary", description: "The marked crest of the Shattered Front Siege Captain." },
  overgrowth_spore_fiber: { name: "Spore Fiber", tier: "uncommon", description: "Living strands harvested from basic Verdant Overgrowth enemies." },
  overgrowth_blight_resin: { name: "Blight Resin", tier: "rare", description: "Corrupted sap drawn from Verdant Overgrowth elites." },
  overgrowth_heartseed: { name: "Rotting Heartseed", tier: "unique", description: "A seed of hungry life dropped only by Verdant Overgrowth bosses." },
  observatory_void_dust: { name: "Void Dust", tier: "uncommon", description: "Starless motes left by basic Void Observatory enemies." },
  observatory_rift_thread: { name: "Rift Thread", tier: "rare", description: "A strand of folded space taken from Void Observatory elites." },
  observatory_star_core: { name: "Collapsed Star Core", tier: "unique", description: "A captive singularity held only by Void Observatory bosses." },
  relicFragments: { name: "Relic Fragments", tier: "epic", description: "Shards of impossible artifacts found in the weekly Labyrinth. Earn up to 95 from a single expedition." },
  labyrinth_etched_fang: { name: "Maze-Etched Fang", tier: "uncommon", description: "A labyrinth stalker's fang scored with its final route." },
  labyrinth_echo_silk: { name: "Echo Silk", tier: "uncommon", description: "Resonant thread spun by an echo weaver in the shifting halls." },
  labyrinth_rune_shard: { name: "Runebound Shard", tier: "rare", description: "A rune still burning with the memory of a golem's command." },
  labyrinth_thorned_horn: { name: "Thorned Horn", tier: "rare", description: "A minotaur's antler wrapped in living labyrinth briars." },
  labyrinth_void_ichor: { name: "Void Ichor", tier: "rare", description: "Cold, starless blood gathered from a void sentinel." },
  labyrinth_etched_stone: { name: "Waystone", tier: "uncommon", description: "A fragment of the ever-changing stonework hidden in Labyrinth caches." },
  labyrinth_crown_fragment: { name: "Unwritten Crown Fragment", tier: "unique", description: "A piece of the impossible crown worn by the Unwritten King." },
  sealedRelic: { name: "Sealed Relic", tier: "unique", description: "A powerful relic recovered from a completed Labyrinth. Spend it at the Forge to craft a custom item." },
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
