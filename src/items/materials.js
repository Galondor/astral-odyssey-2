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
  unique: { label: "Unique", color: "#ff2a2a" },
  mythic: { label: "Mythic", color: "#ff00ff" }
};

export const MATERIALS = {
  proof_of_victory: { name: "Proof of Victory", tier: "rare", description: "Proof of defeating another player in a live Contest." },
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
  broken_blade_fragments: { name: "Broken Blade Fragments", tier: "rare", description: "Rare shards of shattered weapons recovered from Colosseum gladiators." },
  champions_medallion: { name: "Champion's Medallion", tier: "legendary", description: "The singular emblem awarded to a Colosseum champion." },
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
  leather: { name: "Leather", tier: "common", description: "Tanned hide, useful for crafting armor and gear." },
  tidewrack_brine_pearl: { name: "Brine Pearl", tier: "rare", description: "A salt-crusted pearl taken from the crew of Tidewrack Hold." },
  tidewrack_kraken_ink: { name: "Kraken Ink", tier: "epic", description: "Black ink that never dries, carried by Tidewrack Hold elites." },
  tidewrack_doubloon: { name: "Saltblood Doubloon", tier: "unique", description: "Cursed gold from Captain Vareth's own hoard." },
  chrono_mainspring: { name: "Chrono Mainspring", tier: "rare", description: "A coiled spring that still keeps the Spire's time." },
  chrono_paradox_gear: { name: "Paradox Gear", tier: "epic", description: "A gear that turns both ways at once, shed by Chronoforge elites." },
  chrono_heartwatch: { name: "Chronarch's Heartwatch", tier: "unique", description: "The ticking heart of the Chronarch." },
  starless_void_shard: { name: "Void Shard", tier: "rare", description: "A splinter of nothing from the Starless Throne." },
  starless_eclipse_ichor: { name: "Eclipse Ichor", tier: "epic", description: "Dark ichor drained from Starless Throne elites." },
  starless_eater_fang: { name: "Star-Eater's Fang", tier: "unique", description: "A fang that once swallowed a sun. Dropped by Nyx'thara." },

  // Material Crafting: regional base materials (see src/items/craftingMaterials.js for their crafting roles).
  bog_iron: { name: "Bog Iron", tier: "common", description: "Soft, rust-flecked iron dredged from Darkwood mires." },
  cinderite_ore: { name: "Cinderite Ore", tier: "uncommon", description: "Ore that stays warm long after leaving the Ashen Peaks." },
  stormsteel_ore: { name: "Stormsteel Ore", tier: "uncommon", description: "Lightning-veined ore torn from Tempest Reach sea cliffs." },
  rimesteel_ore: { name: "Rimesteel Ore", tier: "rare", description: "Frost-hardened ore mined beneath Frostfall glaciers." },
  sunbronze_ore: { name: "Sunbronze Ore", tier: "rare", description: "Golden ore baked for centuries under the Suncleft sun." },
  warsteel_ingot: { name: "Warsteel Ingot", tier: "epic", description: "Battlefield steel reforged from the wreckage of the Shattered Front." },
  nightstalker_hide: { name: "Nightstalker Hide", tier: "common", description: "Supple dark hide taken from Darkwood prowlers." },
  ashdrake_hide: { name: "Ashdrake Hide", tier: "uncommon", description: "Soot-scaled hide that shrugs off embers." },
  brinehide: { name: "Brinehide", tier: "uncommon", description: "Salt-cured hide from the beasts of Tempest Reach." },
  sandscale_hide: { name: "Sandscale Hide", tier: "rare", description: "Tough, sand-polished hide from the Suncleft dunes." },
  battleworn_leather: { name: "Battleworn Leather", tier: "epic", description: "Leather tempered by a hundred battles on the Shattered Front." },
  meadow_flax: { name: "Meadow Flax", tier: "common", description: "Soft flax fibers gathered across the Meadowlands." },
  emberweave_thread: { name: "Emberweave Thread", tier: "uncommon", description: "Thread spun from ash-silk that glows faintly red." },
  seasilk: { name: "Seasilk", tier: "uncommon", description: "Shimmering silk woven from deep-sea mollusk fibers." },
  frostweave: { name: "Frostweave", tier: "rare", description: "Icy cloth that never quite thaws." },
  sunsilk: { name: "Sunsilk", tier: "rare", description: "Gold-threaded silk that drinks in sunlight." },
  ballistic_weave: { name: "Ballistic Weave", tier: "epic", description: "Densely layered cloth made to stop a crossbow bolt." },
  meadow_oak: { name: "Meadow Oak", tier: "common", description: "Straight-grained oak from the Meadowlands groves." },
  charred_ironwood: { name: "Charred Ironwood", tier: "uncommon", description: "Ironwood hardened by Ashen Peaks wildfires." },
  driftwood: { name: "Storm Driftwood", tier: "uncommon", description: "Sea-bleached wood that bends without breaking." },
  frostpine_log: { name: "Frostpine Log", tier: "rare", description: "Resinous pine from the high Frostfall slopes." },
  petrified_wood: { name: "Petrified Wood", tier: "rare", description: "Ancient wood turned half to stone by the Suncleft sands." },
  scorched_heartwood: { name: "Scorched Heartwood", tier: "epic", description: "The unburnt core of a tree that survived the Shattered Front." },
  copper_nugget: { name: "Copper Nugget", tier: "common", description: "A bright copper nugget, easy to shape." },
  silver_nugget: { name: "Silver Nugget", tier: "common", description: "Tarnished silver found among Darkwood roots." },
  gold_nugget: { name: "Gold Nugget", tier: "uncommon", description: "Gold washed out of Ashen Peaks streams." },
  tidesilver: { name: "Tidesilver", tier: "uncommon", description: "Silver that ripples like water when turned in the light." },
  platinum_nugget: { name: "Platinum Nugget", tier: "rare", description: "Cold, heavy platinum chipped from Frostfall ice." },
  sun_gold: { name: "Sun Gold", tier: "rare", description: "Gold so pure it glows at dusk." },
  mythril_nugget: { name: "Mythril Nugget", tier: "epic", description: "Feather-light mythril salvaged from the Shattered Front." },
  rough_quartz: { name: "Rough Quartz", tier: "common", description: "A cloudy quartz crystal." },
  duskstone: { name: "Duskstone", tier: "uncommon", description: "A violet gem that darkens as night falls." },
  fire_opal: { name: "Fire Opal", tier: "uncommon", description: "An opal with flame trapped inside." },
  stormglass: { name: "Stormglass", tier: "rare", description: "Glass fused by lightning, still crackling." },
  frost_diamond: { name: "Frost Diamond", tier: "rare", description: "A diamond rimed with permanent frost." },
  sunstone: { name: "Sunstone", tier: "epic", description: "A gem that holds the heat of the Suncleft noon." },
  bloodstone: { name: "Bloodstone", tier: "epic", description: "A dark red gem said to form where heroes fell." },

  // Material Crafting: tool parts.
  hammerhead_i: { name: "Crude Hammerhead", tier: "uncommon", description: "A rough iron hammerhead. Tool part for Blacksmith's Hammers (Tier I)." },
  hammerhead_ii: { name: "Tempered Hammerhead", tier: "rare", description: "A balanced, tempered hammerhead. Tool part for Blacksmith's Hammers (Tier II)." },
  hammerhead_iii: { name: "Masterwork Hammerhead", tier: "epic", description: "A flawless hammerhead that rings like a bell. Tool part for Blacksmith's Hammers (Tier III)." },
  haft_i: { name: "Ash Haft", tier: "uncommon", description: "A handle for Hammers, Pickaxes, and Axes. Improves gathering timing (Tier I)." },
  haft_ii: { name: "Ironwood Haft", tier: "rare", description: "A handle for Hammers, Pickaxes, and Axes. Improves gathering yield (Tier II)." },
  haft_iii: { name: "Heartwood Haft", tier: "epic", description: "A handle for Hammers, Pickaxes, and Axes. Improves gathering rarity (Tier III)." },
  pickaxehead_i: { name: "Crude Pickaxe Head", tier: "uncommon", description: "Crafted at Weaponry 5. Supports Pickaxes up to item level 20." },
  pickaxehead_ii: { name: "Tempered Pickaxe Head", tier: "rare", description: "Crafted at Weaponry 20. Supports Pickaxes up to item level 35." },
  pickaxehead_iii: { name: "Masterwork Pickaxe Head", tier: "epic", description: "Crafted at Weaponry 35. Supports Pickaxes up to item level 50." },
  axehead_i: { name: "Crude Axe Head", tier: "uncommon", description: "Crafted at Weaponry 5. Supports Axes up to item level 20." },
  axehead_ii: { name: "Tempered Axe Head", tier: "rare", description: "Crafted at Weaponry 20. Supports Axes up to item level 35." },
  axehead_iii: { name: "Masterwork Axe Head", tier: "epic", description: "Crafted at Weaponry 35. Supports Axes up to item level 50." },
  lens_i: { name: "Rough Lens", tier: "uncommon", description: "A scratched magnifying lens. Tool part for Precision Tools (Tier I)." },
  lens_ii: { name: "Ground Lens", tier: "rare", description: "A carefully ground lens. Tool part for Precision Tools (Tier II)." },
  lens_iii: { name: "Flawless Lens", tier: "epic", description: "A perfect lens that reveals a gem's every facet. Tool part for Precision Tools (Tier III)." },
  calipers_i: { name: "Brass Calipers", tier: "uncommon", description: "Simple brass calipers. Tool part for Precision Tools (Tier I)." },
  calipers_ii: { name: "Silver Calipers", tier: "rare", description: "Finely marked silver calipers. Tool part for Precision Tools (Tier II)." },
  calipers_iii: { name: "Mythril Calipers", tier: "epic", description: "Calipers accurate to a hair's width. Tool part for Precision Tools (Tier III)." },

  // Material Crafting: catalysts (they only matter through reactions).
  binding_resin: { name: "Binding Resin", tier: "rare", description: "A thick resin that keeps unstable materials in check." },
  quicksilver: { name: "Quicksilver", tier: "rare", description: "Liquid metal that intensifies whatever it touches." },
  aether_spark: { name: "Aether Spark", tier: "rare", description: "A captive spark of raw elemental energy." },
  prism_dust: { name: "Prism Dust", tier: "rare", description: "Glittering dust that splits light into colors." },
  void_salt: { name: "Void Salt", tier: "rare", description: "Crystals that seem to swallow the light around them." },
  kindred_ash: { name: "Kindred Ash", tier: "rare", description: "Ash that remembers the shape of whatever burned beside it." },

  // Material Crafting: Mythic shards (very rare boss drops).
  mythos_fragment: { name: "Mythos Fragment", tier: "legendary", description: "A shard of a legend that was never written. Said to coax Mythic items from the forge." },
  primordial_spark: { name: "Primordial Spark", tier: "mythic", description: "A spark older than the stars. Said to coax Mythic items from the forge." }
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
