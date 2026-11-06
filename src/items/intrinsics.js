// Fixed base-type bonuses are independent of rolls, rarity, condition and Holofoil.
export const ITEM_INTRINSICS = {
  weapon: {
    Sword: { attackPercent: 0.03 },
    Dagger: { criticalHitChance: 0.02 },
    Axe: { criticalDamage: 0.1 },
    Mace: { attackMin: 4 },
    Rapier: { criticalHitChance: 0.02, speed: 2 },
    Katana: { criticalHitChance: 0.01, criticalDamage: 0.05 },
    Wand: { magicAttackPercent: 0.03 },
    Scepter: { magicAttackPercent: 0.02, maxPower: 3 },
    "Runed Blade": { attackPercent: 0.02, magicAttackPercent: 0.02 },
    Greatsword: { attackPercent: 0.06 },
    Warhammer: { attackMin: 8 },
    Greataxe: { criticalDamage: 0.2 },
    "Battle Staff": { attackPercent: 0.04, defense: 4 },
    "Heavy Bow": { attackPercent: 0.04, criticalDamage: 0.1 },
    Bow: { criticalHitChance: 0.04 },
    Crossbow: { criticalHitChance: 0.02, criticalDamage: 0.1 },
    Staff: { magicAttackPercent: 0.06 },
    Spellbow: { magicAttackPercent: 0.03, criticalHitChance: 0.02 },
  },
  offhand: {
    Shield: { defense: 6 },
    "Tower Shield": { defense: 8, vitality: 4 },
    Buckler: { evasion: 0.02 },
    "Parrying Dagger": { criticalHitChance: 0.01, criticalDamage: 0.05 },
    Tome: { maxPower: 6 },
    Orb: { magicAttackPercent: 0.02 },
    "Runed Shield": { defense: 4, maxPower: 2 },
  },
  helmet: {
    Helm: { defense: 4 },
    Greathelm: { defense: 2, criticalResistance: 0.02 },
    Cap: { criticalHitChance: 0.01 },
    Coif: { evasion: 0.01, defense: 2 },
    Hood: { maxPower: 3 },
    Circlet: { magicAttackPercent: 0.01, statusResistance: 0.01 },
  },
  chestplate: {
    "Plate Chestplate": { defense: 8 },
    Hauberk: { defense: 4, criticalResistance: 0.02 },
    Vest: { evasion: 0.02 },
    Brigandine: { defense: 4, evasion: 0.01 },
    Robe: { maxPower: 6 },
    Spellplate: { defense: 4, magicAttackPercent: 0.01 },
  },
  gauntlets: {
    Gauntlets: { attackPercent: 0.02 },
    Gloves: { criticalHitChance: 0.01, speed: 1 },
    Bracers: { defense: 2, speed: 2 },
    "Mage Gloves": { magicAttackPercent: 0.02 },
  },
  legs: {
    "Plate Greaves": { defense: 4, vitality: 4 },
    Leggings: { evasion: 0.01, speed: 2 },
    Trousers: { speed: 2, statusResistance: 0.02 },
    Skirt: { maxPower: 3, statusResistance: 0.02 },
  },
  boots: {
    Sabatons: { defense: 4, criticalResistance: 0.02 },
    Boots: { speed: 4 },
    Sandals: { speed: 2, maxPower: 3 },
    Slippers: { speed: 2, evasion: 0.01 },
  },
  ring: {
    Signet: { attackPercent: 0.02, defense: 2 },
    Band: { criticalHitChance: 0.01, evasion: 0.01 },
    "Sigil Ring": { magicAttackPercent: 0.02, maxPower: 2 },
  },
  necklace: {
    Torc: { vitality: 6, criticalResistance: 0.02 },
    Pendant: { criticalHitChance: 0.02, statusResistance: 0.02 },
    Amulet: { maxPower: 5, statusResistance: 0.02 },
  },
};

export const UNIQUE_BASE_TYPES = {
  emberwroughtBlade: "Sword",
  tidecallerBulwark: "Runed Shield",
  starforgedGreatblade: "Greatsword",
  frostwovenMantle: "Robe",
  sandstriderTreads: "Boots",
  aegisOfTheUnbroken: "Greathelm",
  brinelightPendant: "Amulet",
  venomkissBand: "Band",
  sovereignsSignet: "Signet",
  maldrathPhylactery: "Amulet",
  kessikBulwark: "Plate Chestplate",
  hoardkingAxe: "Greataxe",
  zugRing: "Sigil Ring",
  slagheartGauntlets: "Gauntlets",
  ulduGreaves: "Plate Greaves",
  rimeHelm: "Greathelm",
  ysoldeRapier: "Rapier",
  verdessaBoots: "Boots",
  heartwoodStaff: "Staff",
  valeOrrery: "Orb",
  cartographerSigil: "Band",
  unwrittenPath: "Bow",
  astralColossusHeart: "Pendant",
  varethCutlass: "Sword",
  chronarchEscapement: "Tome",
  starEaterCrown: "Greathelm",
};

export const getItemBaseType = (item) => {
  if (!item || item.twoHandedOf) return null;
  const types = ITEM_INTRINSICS[item.slot];
  if (!types) return null;
  if (item.unique) return types[UNIQUE_BASE_TYPES[item.unique]] ? UNIQUE_BASE_TYPES[item.unique] : null;
  if (item.baseType) return types[item.baseType] ? item.baseType : null;
  // Old saves only have the generated name; longest suffix avoids Staff/Battle Staff collisions.
  return Object.keys(types).sort((a, b) => b.length - a.length)
    .find((type) => item.name === type || item.name?.endsWith(` ${type}`)) || null;
};

export const getItemIntrinsicBonuses = (item) => {
  const type = getItemBaseType(item);
  return type ? { ...ITEM_INTRINSICS[item.slot][type] } : {};
};
