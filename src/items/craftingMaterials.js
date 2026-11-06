import { STAT_LABELS } from "./items";
import { MATERIALS } from "./materials";
import { MATERIAL_TIER_LEVELS } from "../character/professions";

/*
 Material Crafting catalog. Every craftable material has:
   family     - ore | hide | cloth | wood | precious (base materials), gem | reagent | part | catalyst | shard
   tier       - regional tier 1 (Meadowlands) to 7 (Shattered Front); also sets the profession level needed
   tags       - elemental/thematic affinities that drive reactions
   properties - effects in discovery order; players learn them one at a time by crafting
   part       - tool parts only: { tool, type, cap } (cap = highest tool item level the part supports)
 Effects (applied by src/items/crafting.js):
   quality, substat, subTier, subTierAll, rarityFloor, rarityBoost, conditionFloor, conditionShift,
   mainStat, mainBoost, ability, socket, holofoil, iLevel, mythic, exp, stabilize, potency, echo, toolSub
*/
export const MATERIAL_FAMILIES = {
  ore: { label: "Ore", base: true },
  hide: { label: "Hide", base: true },
  cloth: { label: "Cloth", base: true },
  wood: { label: "Wood", base: true },
  precious: { label: "Precious Metal", base: true },
  gem: { label: "Gem", base: false },
  reagent: { label: "Reagent", base: false },
  part: { label: "Tool Part", base: false },
  catalyst: { label: "Catalyst", base: false },
  shard: { label: "Mythic Shard", base: false },
};

export const REGION_TIERS = ["Meadowlands", "Darkwood", "AshenPeaks", "TempestReach", "FrostfallRange", "SuncleftExpanse", "ShatteredFront"];

export const MATERIAL_TAGS = {
  fire: "Fire", ice: "Ice", storm: "Storm", sea: "Sea", sun: "Sun", earth: "Earth", life: "Life", venom: "Venom",
  beast: "Beast", spirit: "Spirit", shadow: "Shadow", arcane: "Arcane", void: "Void", time: "Time", war: "War", gold: "Gold",
};

const q = (value) => ({ type: "quality", value });
const sub = (stat) => ({ type: "substat", stat });
const tierOf = (stat, min) => ({ type: "subTier", stat, min });
const tierAll = (min) => ({ type: "subTierAll", min });
const floor = (rarity) => ({ type: "rarityFloor", rarity });
const boost = (value) => ({ type: "rarityBoost", value });
const cond = (condition) => ({ type: "conditionFloor", condition });
const shift = (value) => ({ type: "conditionShift", value });
const main = (stat) => ({ type: "mainStat", stat });
const mainUp = (value) => ({ type: "mainBoost", value });
const abil = (value) => ({ type: "ability", value });
const socket = () => ({ type: "socket" });
const foil = (value) => ({ type: "holofoil", value });
const ilvl = (value) => ({ type: "iLevel", value });
const myth = (value) => ({ type: "mythic", value });
const exp = (value) => ({ type: "exp", value });
const toolSub = (stat, tools) => ({ type: "toolSub", stat, ...(tools ? { tools } : {}) });

const m = (family, tier, tags, properties, extra = {}) => ({ family, tier, tags, properties, ...extra });

export const CRAFTING_MATERIALS = {
  // ---- Base materials: one family per region tier ----
  metal_scraps: m("ore", 1, ["war"], [q(2), sub("defense")]),
  bog_iron: m("ore", 2, ["earth"], [sub("defense"), shift(-1)]),
  cinderite_ore: m("ore", 3, ["fire"], [sub("attackMax"), q(4)]),
  stormsteel_ore: m("ore", 4, ["storm"], [sub("speed"), sub("criticalDamage")]),
  rimesteel_ore: m("ore", 5, ["ice"], [sub("defense"), tierOf("defense", 4)]),
  sunbronze_ore: m("ore", 6, ["sun"], [sub("attackPercent"), boost(10)]),
  warsteel_ingot: m("ore", 7, ["war"], [tierAll(3), cond("Pristine")]),
  leather: m("hide", 1, ["beast"], [q(2), sub("agility")]),
  nightstalker_hide: m("hide", 2, ["shadow", "beast"], [sub("agility"), sub("speed")]),
  ashdrake_hide: m("hide", 3, ["fire"], [sub("resilience"), sub("statusResistance")]),
  brinehide: m("hide", 4, ["sea"], [sub("vitality"), sub("luck")]),
  frostfang_pelt: m("hide", 5, ["ice", "beast"], [sub("criticalResistance"), tierOf("resilience", 4)]),
  sandscale_hide: m("hide", 6, ["sun"], [tierOf("agility", 4), sub("speed")]),
  battleworn_leather: m("hide", 7, ["war"], [tierAll(3), sub("defense")]),
  meadow_flax: m("cloth", 1, ["life"], [q(2), sub("vitality")]),
  spider_silk: m("cloth", 2, ["venom"], [sub("agility"), q(3)]),
  emberweave_thread: m("cloth", 3, ["fire"], [sub("magicAttackPercent"), q(4)]),
  seasilk: m("cloth", 4, ["sea"], [sub("luck"), sub("magicAttackPercent")]),
  frostweave: m("cloth", 5, ["ice"], [sub("statusResistance"), sub("criticalResistance")]),
  sunsilk: m("cloth", 6, ["sun"], [sub("magicAttackPercent"), boost(10)]),
  ballistic_weave: m("cloth", 7, ["war"], [tierAll(3), sub("defense")]),
  meadow_oak: m("wood", 1, ["life"], [q(2), sub("vitality")]),
  rotwood_bark: m("wood", 2, ["shadow", "life"], [sub("vitality"), sub("magicAttackMin")]),
  charred_ironwood: m("wood", 3, ["fire"], [sub("attackMin"), q(4)]),
  driftwood: m("wood", 4, ["sea"], [sub("speed"), sub("luck")]),
  frostpine_log: m("wood", 5, ["ice"], [sub("maxPower"), tierOf("maxPower", 4)]),
  petrified_wood: m("wood", 6, ["earth", "time"], [tierOf("defense", 4), boost(10)]),
  scorched_heartwood: m("wood", 7, ["fire", "war"], [tierAll(3), sub("maxPower")]),
  copper_nugget: m("precious", 1, ["earth"], [q(2), sub("luck")]),
  silver_nugget: m("precious", 2, ["spirit"], [sub("luck"), sub("resilience")]),
  gold_nugget: m("precious", 3, ["gold"], [boost(10), sub("criticalDamage")]),
  tidesilver: m("precious", 4, ["sea"], [sub("speed"), foil(0.005)]),
  platinum_nugget: m("precious", 5, ["ice"], [sub("criticalDamage"), tierOf("criticalDamage", 4)]),
  sun_gold: m("precious", 6, ["sun", "gold"], [boost(20), sub("attackPercent")]),
  mythril_nugget: m("precious", 7, ["arcane"], [tierAll(3), sub("maxPower")]),

  // ---- Gems: jewelry reagents that shape the main stat ----
  rough_quartz: m("gem", 1, ["earth"], [mainUp(1), q(3)]),
  duskstone: m("gem", 2, ["shadow"], [main("dexterity"), sub("agility")]),
  fire_opal: m("gem", 3, ["fire"], [main("strength"), sub("attackMax")]),
  stormglass: m("gem", 4, ["storm", "arcane"], [main("intelligence"), sub("criticalDamage")]),
  frost_diamond: m("gem", 5, ["ice"], [tierAll(2), sub("criticalResistance")]),
  sunstone: m("gem", 6, ["sun"], [mainUp(2), floor("Rare")]),
  bloodstone: m("gem", 7, ["war", "life"], [mainUp(3), abil(0.25)]),

  // ---- Monster parts and dungeon materials ----
  slime_gel: m("reagent", 1, ["life"], [sub("vitality"), q(3)]),
  wolf_pelt: m("reagent", 1, ["beast"], [sub("agility"), sub("speed")]),
  boar_tusk: m("reagent", 1, ["beast", "earth"], [sub("attackMin"), sub("defense")]),
  goblin_scrap: m("reagent", 1, ["war"], [q(3), shift(-1)]),
  living_thatch: m("reagent", 1, ["life", "spirit"], [sub("resilience"), abil(0.15)]),
  gelatinous_core: m("reagent", 1, ["life"], [floor("Rare"), sub("vitality"), q(10)]),
  beast_fang: m("reagent", 2, ["beast"], [sub("attackMax"), tierOf("attackMax", 3)]),
  venom_sac: m("reagent", 2, ["venom"], [abil(0.2), sub("statusResistance"), shift(-1)]),
  wraith_essence: m("reagent", 2, ["spirit", "shadow"], [sub("magicAttackMax"), sub("speed")]),
  primal_essence: m("reagent", 2, ["life", "arcane"], [q(8), boost(8), exp(0.05)]),
  widow_heart: m("reagent", 2, ["venom"], [floor("Rare"), abil(0.4), sub("agility")]),
  wraith_crown: m("reagent", 2, ["spirit", "shadow"], [floor("Rare"), sub("magicAttackMax"), abil(0.3)]),
  proof_of_victory: m("reagent", 2, ["war"], [q(10), sub("attackPercent"), exp(0.1)]),
  crypt_grave_salt: m("reagent", 2, ["shadow"], [sub("resilience"), tierOf("resilience", 4)]),
  crypt_soul_shackle: m("reagent", 2, ["spirit", "shadow"], [abil(0.3), sub("criticalResistance")]),
  crypt_regent_marrow: m("reagent", 2, ["shadow", "life"], [floor("Epic"), sub("vitality"), myth(0.0005)]),
  warren_blasting_powder: m("reagent", 2, ["fire", "war"], [sub("attackMax"), shift(-2), q(10)]),
  warren_hexbone: m("reagent", 2, ["arcane", "war"], [abil(0.3), sub("luck")]),
  warren_hoard_seal: m("reagent", 2, ["gold"], [floor("Epic"), boost(20), myth(0.0005)]),
  obsidian_shard: m("reagent", 3, ["fire", "earth"], [sub("criticalDamage"), q(4)]),
  ember_core: m("reagent", 3, ["fire"], [sub("magicAttackMin"), q(6), ilvl(1)]),
  infernal_heart: m("reagent", 3, ["fire"], [floor("Rare"), sub("attackMax"), q(12)]),
  forge_cinder_flux: m("reagent", 3, ["fire"], [q(8), cond("Average")]),
  forge_tempered_alloy: m("reagent", 3, ["fire", "earth"], [tierAll(3), cond("Pristine")]),
  forge_slagheart: m("reagent", 3, ["fire"], [floor("Epic"), ilvl(3), myth(0.0005)]),
  bilge_raider_insignia: m("reagent", 4, ["sea", "war"], [sub("luck"), q(4)]),
  abyssal_scale: m("reagent", 4, ["sea"], [sub("resilience"), socket()]),
  leviathan_heart: m("reagent", 4, ["sea", "storm"], [floor("Legendary"), abil(0.5), myth(0.001)]),
  broken_blade_fragments: m("reagent", 4, ["war"], [sub("criticalDamage"), tierOf("criticalDamage", 4)]),
  overgrowth_spore_fiber: m("reagent", 4, ["life", "venom"], [sub("vitality"), abil(0.15)]),
  overgrowth_blight_resin: m("reagent", 4, ["venom", "life"], [tierAll(3), shift(-1)]),
  overgrowth_heartseed: m("reagent", 4, ["life"], [floor("Epic"), tierOf("vitality", 6), myth(0.0005)]),
  rimebound_plate: m("reagent", 5, ["ice", "earth"], [sub("defense"), cond("Pristine")]),
  glacier_core: m("reagent", 5, ["ice"], [floor("Legendary"), tierAll(4), myth(0.001)]),
  citadel_rime_shard: m("reagent", 5, ["ice"], [sub("criticalResistance"), q(6)]),
  citadel_pale_sigil: m("reagent", 5, ["ice", "spirit"], [abil(0.3), tierAll(2)]),
  citadel_winter_heart: m("reagent", 5, ["ice"], [floor("Epic"), sub("statusResistance"), myth(0.0005)]),
  labyrinth_etched_fang: m("reagent", 5, ["beast", "arcane"], [sub("agility"), q(6)]),
  labyrinth_echo_silk: m("reagent", 5, ["arcane"], [sub("magicAttackMin"), exp(0.1)]),
  labyrinth_etched_stone: m("reagent", 5, ["earth", "time"], [ilvl(2), cond("Pristine")]),
  suncleft_scourge_fang: m("reagent", 6, ["sun", "beast"], [sub("attackMin"), sub("speed")]),
  glassback_chitin: m("reagent", 6, ["sun", "venom"], [sub("defense"), tierOf("defense", 5)]),
  buried_wyrm_scale: m("reagent", 6, ["sun", "earth"], [floor("Legendary"), tierAll(4), myth(0.001)]),
  observatory_void_dust: m("reagent", 6, ["void"], [sub("magicAttackPercent"), q(6)]),
  observatory_rift_thread: m("reagent", 6, ["void", "arcane"], [socket(), abil(0.3)]),
  observatory_star_core: m("reagent", 6, ["void"], [floor("Epic"), boost(25), myth(0.0005)]),
  champions_medallion: m("reagent", 6, ["war", "gold"], [floor("Legendary"), boost(30), myth(0.001)]),
  labyrinth_rune_shard: m("reagent", 6, ["arcane"], [abil(0.35), tierAll(2)]),
  labyrinth_thorned_horn: m("reagent", 6, ["beast", "life"], [sub("attackMax"), sub("vitality")]),
  labyrinth_void_ichor: m("reagent", 6, ["void"], [tierAll(3), shift(-1)]),
  tidewrack_brine_pearl: m("reagent", 6, ["sea", "gold"], [sub("luck"), foil(0.005)]),
  tidewrack_kraken_ink: m("reagent", 6, ["sea", "shadow"], [tierAll(3), abil(0.3)]),
  tidewrack_doubloon: m("reagent", 6, ["gold", "sea"], [floor("Legendary"), boost(35), myth(0.0015)]),
  salvaged_dog_tag: m("reagent", 7, ["war"], [q(5), exp(0.05)]),
  war_hardened_insignia: m("reagent", 7, ["war"], [sub("attackPercent"), tierOf("attackPercent", 4)]),
  commanders_crest: m("reagent", 7, ["war", "gold"], [floor("Legendary"), cond("Flawless"), myth(0.001)]),
  labyrinth_crown_fragment: m("reagent", 7, ["time", "gold"], [floor("Legendary"), tierAll(5), myth(0.0015)]),
  chrono_mainspring: m("reagent", 7, ["time"], [sub("speed"), q(10)]),
  chrono_paradox_gear: m("reagent", 7, ["time"], [tierAll(4), ilvl(2)]),
  chrono_heartwatch: m("reagent", 7, ["time"], [floor("Legendary"), tierAll(5), myth(0.002)]),
  starless_void_shard: m("reagent", 7, ["void"], [sub("criticalDamage"), tierAll(3)]),
  starless_eclipse_ichor: m("reagent", 7, ["void", "shadow"], [boost(30), shift(-1)]),
  starless_eater_fang: m("reagent", 7, ["void"], [floor("Legendary"), cond("Perfect"), myth(0.002)]),

  // ---- Tool parts ----
  hammerhead_i: m("part", 1, ["earth"], [toolSub("craftQuality"), q(4)], { part: { tool: "hammer", type: "hammerhead", cap: 20 } }),
  hammerhead_ii: m("part", 3, ["fire"], [toolSub("rarityChance"), q(8)], { part: { tool: "hammer", type: "hammerhead", cap: 35 } }),
  hammerhead_iii: m("part", 5, ["war"], [toolSub("mythicChance"), q(12)], { part: { tool: "hammer", type: "hammerhead", cap: 50 } }),
  haft_i: m("part", 1, ["life"], [toolSub("materialPreservation", ["hammer"]), q(2), toolSub("gatheringTiming", ["pickaxe", "axe"])], { part: { tool: "hammer", tools: ["hammer", "pickaxe", "axe"], type: "haft", cap: 20 } }),
  haft_ii: m("part", 3, ["earth"], [toolSub("astraDiscount", ["hammer"]), q(4), toolSub("gatheringYield", ["pickaxe", "axe"])], { part: { tool: "hammer", tools: ["hammer", "pickaxe", "axe"], type: "haft", cap: 35 } }),
  haft_iii: m("part", 5, ["time"], [toolSub("craftExp", ["hammer"]), q(8), toolSub("gatheringRarity", ["pickaxe", "axe"])], { part: { tool: "hammer", tools: ["hammer", "pickaxe", "axe"], type: "haft", cap: 50 } }),
  pickaxehead_i: m("part", 1, ["earth"], [toolSub("gatheringTiming"), q(4)], { craftOnly: true, part: { tool: "pickaxe", type: "pickaxehead", cap: 20 } }),
  pickaxehead_ii: m("part", 3, ["fire"], [toolSub("gatheringYield"), q(8)], { craftOnly: true, part: { tool: "pickaxe", type: "pickaxehead", cap: 35 } }),
  pickaxehead_iii: m("part", 5, ["war"], [toolSub("gatheringRarity"), q(12)], { craftOnly: true, part: { tool: "pickaxe", type: "pickaxehead", cap: 50 } }),
  axehead_i: m("part", 1, ["life"], [toolSub("gatheringPerfect"), q(4)], { craftOnly: true, part: { tool: "axe", type: "axehead", cap: 20 } }),
  axehead_ii: m("part", 3, ["earth"], [toolSub("gatheringYield"), q(8)], { craftOnly: true, part: { tool: "axe", type: "axehead", cap: 35 } }),
  axehead_iii: m("part", 5, ["time"], [toolSub("gatheringRarity"), q(12)], { craftOnly: true, part: { tool: "axe", type: "axehead", cap: 50 } }),
  lens_i: m("part", 1, ["arcane"], [toolSub("discoveryChance"), q(2)], { part: { tool: "precisionTools", type: "lens", cap: 20 } }),
  lens_ii: m("part", 3, ["sea"], [toolSub("rarityChance"), q(4)], { part: { tool: "precisionTools", type: "lens", cap: 35 } }),
  lens_iii: m("part", 5, ["void"], [toolSub("mythicChance"), q(8)], { part: { tool: "precisionTools", type: "lens", cap: 50 } }),
  calipers_i: m("part", 1, ["gold"], [toolSub("craftQuality"), q(4)], { part: { tool: "precisionTools", type: "calipers", cap: 20 } }),
  calipers_ii: m("part", 3, ["storm"], [toolSub("reactionPotency"), q(8)], { part: { tool: "precisionTools", type: "calipers", cap: 35 } }),
  calipers_iii: m("part", 5, ["time"], [toolSub("materialPreservation"), q(12)], { part: { tool: "precisionTools", type: "calipers", cap: 50 } }),

  // ---- Catalysts: little on their own, they enable or change reactions ----
  binding_resin: m("catalyst", 3, [], [{ type: "stabilize" }]),
  quicksilver: m("catalyst", 3, [], [{ type: "potency", value: 0.5 }]),
  aether_spark: m("catalyst", 3, ["storm"], [q(5)]),
  prism_dust: m("catalyst", 3, [], [foil(0.01)]),
  void_salt: m("catalyst", 4, ["void"], [q(5)]),
  kindred_ash: m("catalyst", 4, [], [{ type: "echo" }]),

  // ---- Mythic shards ----
  mythos_fragment: m("shard", 5, ["arcane"], [myth(0.003), q(10)]),
  primordial_spark: m("shard", 6, ["time", "void"], [myth(0.005), boost(20)]),
};

export const isCompatibleToolPart = (part, slot, type) =>
  !!part && part.type === type && (part.tools || [part.tool]).includes(slot);

/*
 Reactions trigger when every selector is matched by a different material in the craft.
 Selectors: "tag:<tag>", "family:<family>", "key:<material key>". Harmful reactions are prevented by stabilizers.
*/
export const REACTIONS = {
  thermal_shock: { name: "Thermal Shock", needs: ["tag:fire", "tag:ice"], effects: [tierAll(3), q(10)], description: "Fire and ice crack the metal into a finer grain." },
  toxic_weave: { name: "Toxic Weave", needs: ["tag:venom", "family:cloth"], effects: [abil(0.5), q(5)], description: "Venom soaks into the weave and lingers." },
  storm_forged: { name: "Storm Forged", needs: ["tag:storm", "family:ore"], effects: [sub("criticalDamage"), q(10)], description: "Lightning temper leaves a vicious edge." },
  feral_bond: { name: "Feral Bond", needs: ["tag:beast", "family:hide"], effects: [sub("agility"), sub("speed")], description: "Beast parts and hide move as one." },
  grave_pact: { name: "Grave Pact", needs: ["tag:shadow", "tag:spirit"], effects: [abil(0.35), boost(15)], description: "A restless spirit binds itself to the work." },
  verdant_pulse: { name: "Verdant Pulse", needs: ["tag:life", "family:wood"], effects: [sub("vitality"), sub("resilience")], description: "The wood takes root and keeps growing." },
  molten_core: { name: "Molten Core", needs: ["tag:fire", "family:ore"], effects: [ilvl(2), q(10)], description: "The ore melts to a perfect pour." },
  tidal_lustre: { name: "Tidal Lustre", needs: ["tag:sea", "family:gem"], effects: [sub("luck"), foil(0.01)], description: "The gem takes on a sea-glass shimmer." },
  sunfire: { name: "Sunfire", needs: ["tag:sun", "tag:fire"], effects: [floor("Rare")], description: "Sunlight and flame refuse to make anything ordinary." },
  warbound: { name: "Warbound", needs: ["tag:war", "family:ore"], effects: [sub("attackPercent"), cond("Pristine")], description: "Battlefield iron remembers how to fight." },
  arcane_resonance: { name: "Arcane Resonance", needs: ["tag:arcane", "family:gem"], effects: [sub("magicAttackPercent"), q(15)], description: "The gem hums with stored magic." },
  eclipse: { name: "Eclipse", needs: ["tag:sun", "tag:void"], effects: [boost(40), myth(0.001)], description: "Light and nothing collide, and something rare remains." },
  clockwork_precision: { name: "Clockwork Precision", needs: ["tag:time", "family:precious"], effects: [tierAll(4)], description: "Every facet is cut to the exact second." },
  golden_touch: { name: "Golden Touch", needs: ["tag:gold", "family:precious"], effects: [boost(25), sub("luck")], description: "Gold calls to gold." },
  beast_heart: { name: "Beast Heart", needs: ["tag:beast", "tag:life"], effects: [sub("vitality"), q(8)], description: "The work beats with a wild pulse." },
  frozen_tide: { name: "Frozen Tide", needs: ["tag:ice", "tag:sea"], effects: [sub("resilience"), cond("Pristine")], description: "Sea ice armors the piece." },
  volatile_mixture: { name: "Volatile Mixture", harmful: true, needs: ["tag:fire", "tag:venom"], effects: [shift(-2)], description: "Venom boils and pits the surface." },
  frostbite_rot: { name: "Frostbite Rot", harmful: true, needs: ["tag:ice", "tag:life"], effects: [q(-25)], description: "Living material freezes and rots." },
  discord: { name: "Discord", harmful: true, needs: ["tag:spirit", "tag:war"], effects: [q(-15), shift(-1)], description: "Restless spirits rebel against the weapons of war." },
  prismatic_bloom: { name: "Prismatic Bloom", needs: ["key:prism_dust", "family:gem"], effects: [foil(0.03), socket()], description: "Light blooms through the gem in every color." },
  aether_surge: { name: "Aether Surge", needs: ["key:aether_spark", "tag:storm"], effects: [abil(1), q(20)], description: "Raw aether arcs through the storm-touched material." },
  void_infusion: { name: "Void Infusion", needs: ["key:void_salt", "tag:void"], effects: [tierAll(5), shift(-1)], description: "The void hollows out every weakness, and some strength." },
  quicksilver_bind: { name: "Quicksilver Bind", needs: ["key:quicksilver", "family:precious"], effects: [q(20)], description: "Quicksilver fuses into the precious metal." },
  primordial_convergence: { name: "Primordial Convergence", needs: ["key:mythos_fragment", "key:primordial_spark"], effects: [myth(0.002), boost(25)], description: "Two legends meet in the crucible." },
};

export const getCraftingMaterial = (key) =>
  Object.prototype.hasOwnProperty.call(CRAFTING_MATERIALS, key) ? CRAFTING_MATERIALS[key] : null;

export const isBaseMaterial = (key) => !!MATERIAL_FAMILIES[getCraftingMaterial(key)?.family]?.base;
export const isReagentMaterial = (key) => !!getCraftingMaterial(key) && !isBaseMaterial(key);
export const getMaterialCraftLevel = (key) => MATERIAL_TIER_LEVELS[(getCraftingMaterial(key)?.tier || 1) - 1];

const matches = (selector, key) => {
  const material = getCraftingMaterial(key);
  if (!material) return false;
  const [kind, value] = selector.split(":");
  if (kind === "key") return key === value;
  if (kind === "family") return material.family === value;
  return material.tags.includes(value);
};

// Each selector must be matched by a different entry of `keys` (duplicates count separately).
export const reactionTriggers = (reaction, keys) => {
  const used = new Set();
  const assign = (index) => {
    if (index >= reaction.needs.length) return true;
    for (let i = 0; i < keys.length; i++) {
      if (used.has(i) || !matches(reaction.needs[index], keys[i])) continue;
      used.add(i);
      if (assign(index + 1)) return true;
      used.delete(i);
    }
    return false;
  };
  return assign(0);
};

export const findReactions = (keys) =>
  Object.entries(REACTIONS).filter(([, reaction]) => reactionTriggers(reaction, keys)).map(([id]) => id);

const pct = (value) => `${Math.round(value * 10000) / 100}%`;
const label = (stat) => STAT_LABELS[stat] || stat;
const signed = (value) => `${value < 0 ? "" : "+"}${value}`;

export const describeEffect = (effect) => {
  switch (effect.type) {
    case "quality": return `${signed(effect.value)} craft quality`;
    case "substat": return `Guarantees a ${label(effect.stat)} substat`;
    case "subTier": return `${label(effect.stat)} substat rolls T${effect.min} or higher`;
    case "subTierAll": return `All substats roll T${effect.min} or higher`;
    case "rarityFloor": return `Guarantees ${effect.rarity} or better`;
    case "rarityBoost": return `${signed(effect.value)} rarity chance`;
    case "conditionFloor": return `Condition is at least ${effect.condition}`;
    case "conditionShift": return `Lowers condition by ${Math.abs(effect.value)} step${Math.abs(effect.value) === 1 ? "" : "s"}`;
    case "mainStat": return `Main stat becomes ${label(effect.stat)} (Attunement)`;
    case "mainBoost": return `+${effect.value} main stat`;
    case "ability": return `+${pct(effect.value)} ability chance (Infusion)`;
    case "socket": return "Epic results gain a second socket";
    case "holofoil": return `+${pct(effect.value)} Holofoil chance`;
    case "iLevel": return `+${effect.value} item level`;
    case "mythic": return `+${pct(effect.value)} Mythic chance`;
    case "exp": return `+${pct(effect.value)} profession exp`;
    case "stabilize": return "Prevents harmful reactions and negative effects";
    case "potency": return `+${pct(effect.value)} reaction potency`;
    case "echo": return "Repeats the effects of the first other reagent";
    case "toolSub": return `${effect.tools ? effect.tools.join("/") : "Tools"}: guarantees a ${label(effect.stat)} substat`;
    default: return effect.type;
  }
};

export const isHarmfulEffect = (effect) =>
  (effect.type === "quality" && effect.value < 0) || (effect.type === "conditionShift" && effect.value < 0);

export const craftingMaterialName = (key) => MATERIALS[key]?.name || key;
