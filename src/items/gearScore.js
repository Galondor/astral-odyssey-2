/*
 Gear score: a single number for the power of an item (and the sum for everything equipped).
   itemScore = round( Σ(statValue × STAT_WEIGHTS[stat]) × RARITY_MULT[rarity] × (twoHanded ? 1.5 : 1) ) + (ability ? 25 : 0)
 Both the main stat and the substats count. Percent stats (fractional values) are weighted per 1.00, so 1% = weight / 100.
*/
export const GEAR_SCORE_STAT_WEIGHTS = {
  strength: 2,
  dexterity: 2,
  intelligence: 2,
  vitality: 3,
  resilience: 3,
  agility: 3,
  luck: 3.5,
  attackMin: 4.5,
  attackMax: 4.5,
  magicAttackMin: 4.5,
  magicAttackMax: 4.5,
  attack: 4.5,
  magicAttack: 4.5,
  maxPower: 3.5,
  defense: 4,
  speed: 4,
  criticalDamage: 500,
  criticalHitChance: 500,
  evasion: 500,
};

export const GEAR_SCORE_TWO_HANDED_MULT = 2.0;
export const GEAR_SCORE_ABILITY_BONUS = 25;

export const getItemGearScore = (item) => {
  if (!item || item.twoHandedOf) return 0;
  const weight = (stat) => GEAR_SCORE_STAT_WEIGHTS[stat] || 0;
  let raw = 0;
  if (item.gemstone)
    raw += item.gemstone.value * weight(item.gemstone.stat);
  if (item.mainStat) raw += item.mainStat.value * weight(item.mainStat.stat);
  for (const [k, v] of Object.entries(item.subStats || {})) raw += v * weight(k);
  const mult = (item.twoHanded ? GEAR_SCORE_TWO_HANDED_MULT : 1);
  return Math.max(0, Math.round(raw * mult)) + (item.ability ? GEAR_SCORE_ABILITY_BONUS : 0);
};

export const getTotalGearScore = (equipment = {}) =>
  Object.values(equipment).reduce((sum, item) => sum + getItemGearScore(item), 0);
