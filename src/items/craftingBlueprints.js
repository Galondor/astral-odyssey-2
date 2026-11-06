import { getItemIntrinsicDescription, getSlotBases, SLOTS } from "./items";
import { CRAFTED_UNIQUES } from "./craftingUniques";
import { TOOL_NAMES } from "./tools";

/*
 Blueprints: what each crafting profession can make and the profession level that unlocks it.
   kind     - gear (random roll), tool (Hammer/Precision Tools), unique (crafting-only Unique recipe)
   families - base material families accepted; baseQty - base materials consumed
   parts    - tools only: tool part types that must be placed in reagent slots
   requires - uniques only: extra materials consumed by the recipe
*/
const FAMILY_BY_MATERIAL = { metal: "ore", wood: "wood", leather: "hide", cloth: "cloth", jewelry: "precious" };
const BASE_QTY = { weapon: 3, offhand: 3, helmet: 3, chestplate: 5, gauntlets: 2, legs: 4, boots: 2, ring: 2, necklace: 2 };

const UNLOCKS = {
  weaponry: [
    [1, "weapon", "Sword"], [1, "weapon", "Dagger"], [1, "weapon", "Wand"], [2, "offhand", "Shield"],
    [3, "weapon", "Axe"], [4, "weapon", "Rapier"], [5, "tool", "hammer"], [5, "tool", "pickaxe"], [5, "tool", "axe"], [6, "weapon", "Scepter"],
    [7, "offhand", "Buckler"], [8, "weapon", "Mace"], [9, "weapon", "Bow"], [10, "offhand", "Tome"],
    [11, "weapon", "Katana"], [12, "weapon", "Staff"], [13, "offhand", "Orb"], [14, "weapon", "Greatsword"],
    [15, "weapon", "Crossbow"], [17, "weapon", "Runed Blade"], [18, "offhand", "Parrying Dagger"],
    [20, "weapon", "Warhammer"], [22, "weapon", "Spellbow"], [24, "offhand", "Tower Shield"],
    [26, "weapon", "Greataxe"], [28, "weapon", "Heavy Bow"], [30, "weapon", "Battle Staff"], [32, "offhand", "Runed Shield"],
  ],
  armor: [
    [1, "helmet", "Helm"], [1, "helmet", "Cap"], [1, "helmet", "Hood"], [2, "gauntlets", "Gloves"],
    [3, "boots", "Boots"], [4, "boots", "Sandals"], [5, "legs", "Leggings"], [6, "chestplate", "Vest"],
    [7, "chestplate", "Robe"], [8, "gauntlets", "Gauntlets"], [9, "legs", "Skirt"], [10, "chestplate", "Plate Chestplate"],
    [11, "boots", "Sabatons"], [12, "helmet", "Coif"], [13, "gauntlets", "Mage Gloves"], [14, "legs", "Trousers"],
    [16, "gauntlets", "Bracers"], [18, "legs", "Plate Greaves"], [20, "boots", "Slippers"], [22, "helmet", "Circlet"],
    [24, "chestplate", "Brigandine"], [26, "chestplate", "Hauberk"], [28, "helmet", "Greathelm"], [30, "chestplate", "Spellplate"],
  ],
  jewelry: [
    [1, "ring", "Band"], [1, "necklace", "Pendant"], [3, "ring", "Signet"], [5, "tool", "precisionTools"],
    [7, "necklace", "Amulet"], [10, "ring", "Sigil Ring"], [14, "necklace", "Torc"],
  ],
};

const TOOL_BLUEPRINTS = {
  hammer: { families: ["ore"], baseQty: 3, parts: ["hammerhead", "haft"] },
  precisionTools: { families: ["precious"], baseQty: 2, parts: ["lens", "calipers"] },
  pickaxe: { families: ["ore"], baseQty: 3, parts: ["pickaxehead", "haft"] },
  axe: { families: ["ore"], baseQty: 3, parts: ["axehead", "haft"] },
};

const slotLabel = (slot) => SLOTS.find((entry) => entry.type === slot)?.label.replace(/ \d$/, "") || slot;

const buildBlueprints = () => {
  const out = {};
  for (const [profession, unlocks] of Object.entries(UNLOCKS)) {
    for (const [level, slot, name] of unlocks) {
      if (slot === "tool") {
        out[`tool:${name}`] = {
          id: `tool:${name}`, profession, kind: "tool", slot: name, name: TOOL_NAMES[name], level, ...TOOL_BLUEPRINTS[name],
        };
        continue;
      }
      const base = getSlotBases(slot).find((entry) => entry.name === name);
      if (!base) throw new Error(`Unknown blueprint base ${slot} ${name}.`);
      const family = profession === "jewelry" ? "precious" : FAMILY_BY_MATERIAL[base.material];
      out[`${slot}:${name}`] = {
        id: `${slot}:${name}`, profession, kind: "gear", slot, baseName: name, name, level,
        stat: base.stat, twoHanded: !!base.twoHanded, slotLabel: slotLabel(slot),
        families: [family], baseQty: BASE_QTY[slot] + (base.twoHanded ? 2 : 0),
      };
    }
  }
  for (const unique of Object.values(CRAFTED_UNIQUES)) {
    const { recipe } = unique;
    out[`unique:${unique.id}`] = {
      id: `unique:${unique.id}`, profession: recipe.profession, kind: "unique", slot: unique.slot, name: unique.name,
      level: recipe.level, stat: unique.stat, twoHanded: !!unique.twoHanded, slotLabel: slotLabel(unique.slot),
      families: [recipe.family], minTier: recipe.minTier, baseQty: recipe.baseQty, requires: recipe.requires, unique,
    };
  }
  for (const [type, name] of [["pickaxehead", "Pickaxe Head"], ["axehead", "Axe Head"]]) {
    ["i", "ii", "iii"].forEach((suffix, index) => {
      const output = `${type}_${suffix}`;
      out[`part:${output}`] = {
        id: `part:${output}`, profession: "weaponry", kind: "part",
        name: `${["Crude", "Tempered", "Masterwork"][index]} ${name}`,
        level: [5, 20, 35][index], families: ["ore"], minTier: [1, 3, 5][index],
        baseQty: [3, 5, 7][index], astra: [100, 500, 1500][index], output,
        slotLabel: "Tool Part",
      };
    });
  }
  return out;
};

export const BLUEPRINTS = buildBlueprints();

export const getBlueprintIntrinsicDescription = (blueprint) =>
  blueprint.kind === "part" ? "" : getItemIntrinsicDescription({ slot: blueprint.slot, baseType: blueprint.baseName, unique: blueprint.unique?.id });

export const getBlueprints = (profession) =>
  Object.values(BLUEPRINTS)
    .filter((blueprint) => blueprint.profession === profession)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

export const isBlueprintUnlocked = (blueprint, level) => !!blueprint && level >= blueprint.level;
