/*
 Gear score: a single number for the power of an item (and the sum for everything equipped).
   itemScore = round( Σ(statValue × STAT_WEIGHTS[stat]) × RARITY_MULT[rarity] × (twoHanded ? 1.5 : 1) ) + (ability ? 25 : 0)
 Both the main stat and the substats count. Percent stats (fractional values) are weighted per 1.00, so 1% = weight / 100.
*/
export const GEAR_SCORE_STAT_WEIGHTS = {
  strength: 3,
  dexterity: 3,
  intelligence: 3,
  vitality: 1,
  resilience: 1,
  agility: 1,
  luck: 2.5,
  attackMin: 2.5,
  attackMax: 2.5,
  magicAttackMin: 2.5,
  magicAttackMax: 2.5,
  attack: 2.5,
  magicAttack: 2.5,
  maxPower: 1.5,
  defense: 2.5,
  speed: 2.5,
  criticalDamage: 250,
  criticalHitChance: 250,
  evasion: 250,
  attackPercent: 250,
  magicAttackPercent: 250,
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
