/*
 Class information, shown in tooltips and on the progression screen.
 A class is chosen at character creation and recalculated as core stats change.
*/
export const CLASSES = {
  Swordsman: {
    bonus: { name: "Bulwark & Resolve", description: "Defending blocks 70% of incoming damage and counters for 50% of a melee attack. Defend or Guard gains 1 Resolve; blocking gains 1 more once per round (maximum 3). Spend 2 Resolve on Resolve Strike, a 150% melee attack. Develop protection or retaliation in your mastery tree." },
    glossary: "swordsman",
    subtitle: "Melee Fighter",
    description: "A front-line brawler. Strength raises melee damage and vitality, making for a durable, hard-hitting fighter.",
    requirement: "When Strength is at least 60% of your total core stats.",
  },
  Tactician: {
    bonus: { name: "Rhythm & Advantage", description: "Defend or Guard to gain 1 Advantage; attacking a defending, recovering, or debuffed enemy also grants 1 per action (maximum 3). Spend 2 on Precision Strike: 170% melee damage, ignoring 50% defense. Attacks still build +4% critical chance (up to +20%); taking damage breaks that rhythm." },
    glossary: "tactician",
    subtitle: "Precision Fighter",
    description: "A swift, precise fighter. Dexterity raises melee damage and agility, improving speed and evasion.",
    requirement: "When Dexterity is at least 60% of your total core stats.",
  },
  Spellcaster: {
    bonus: { name: "Arcane Flow & Instability", description: "Magic attacks build Instability (maximum 3), adding 10% magic damage and 1 power to spell costs per stack; basic magic stays free. Arcane Release vents all stacks for 100% magic damage plus 40% per stack. Recover 1 power each round; regular spells still receive their 1-power discount." },
    glossary: "spellcaster",
    subtitle: "Magic Fighter",
    description: "A master of magic. Intelligence raises magic damage.",
    requirement: "When Intelligence is at least 60% of your total core stats.",
  },
  Duelist: {
    bonus: { name: "Parry & Tempo", description: "Riposte Stance spends an Action to guarantee a parry of the next ordinary hit before your next turn, countering for 60% melee damage and granting 2 Tempo. Passive parries still have a 15% chance and grant 1 Tempo. Your next melee action spends all Tempo for +35% damage per point (maximum 2). Committed group telegraphs cannot be parried." },
    glossary: "duelist",
    subtitle: "Precise Melee Fighter",
    description: "Blends strength and finesse for strong, fast melee damage.",
    requirement: "When Strength and Dexterity are each at least 40% of your total core stats.",
  },
  Spellblade: {
    bonus: { name: "Arcane Weave", description: "Your first melee or magic attack builds 1 Weave. Alternating attack types adds 1 Weave (maximum 2) and deals 25% more damage. Spend 2 Weave on Fusion Strike: 180% of your stronger attack, delivered as melee damage. Develop defensive weaving or explosive finishers in your mastery tree." },
    glossary: "spellblade",
    subtitle: "Magic Melee Fighter",
    description: "Pairs heavy melee strikes with magical power.",
    requirement: "When Strength and Intelligence are each at least 40% of your total core stats.",
  },
  Trickster: {
    bonus: { name: "Prepared Tricks", description: "Each damaging action prepares 1 Trick (maximum 3). Cash Out spends all Tricks for 100% of your stronger attack plus 50% per Trick, delivered as magic damage. Mastery can trade Tricks for reliable control instead. Your attacks retain their 20% chance to hex an enemy with Weakened or Vulnerable for 2 rounds." },
    glossary: "trickster",
    subtitle: "Cunning Fighter",
    description: "Quick and clever, mixing agility with magic.",
    requirement: "When Dexterity and Intelligence are each at least 40% of your total core stats.",
  },
  Specialist: {
    bonus: { name: "Adaptation", description: "Your first role and each role change grant 1 Adaptation (maximum 3): offense, protection (Defend/Guard), or support. Spend 2 on Improvise: 170% of your stronger attack as melee damage and heal 10% maximum health. Different attacks still add 5% damage each (up to +20%); switching attack types alone does not build Adaptation." },
    glossary: "specialist",
    subtitle: "Balanced Fighter",
    description: "A well-rounded adventurer with no weak point.",
    requirement: "When all three stats are at least 15% of your total core stats and none exceeds 50%.",
  },
};

export const getClassForStats = ({ strength, dexterity, intelligence }) => {
  const total = strength + dexterity + intelligence;

  if (strength * 10 >= total * 6) return "Swordsman";
  if (dexterity * 10 >= total * 6) return "Tactician";
  if (intelligence * 10 >= total * 6) return "Spellcaster";

  if (strength * 5 >= total * 2 && dexterity * 5 >= total * 2) return "Duelist";
  if (strength * 5 >= total * 2 && intelligence * 5 >= total * 2) return "Spellblade";
  if (dexterity * 5 >= total * 2 && intelligence * 5 >= total * 2) return "Trickster";

  if (
    strength * 20 >= total * 3 &&
    dexterity * 20 >= total * 3 &&
    intelligence * 20 >= total * 3 &&
    strength * 2 <= total &&
    dexterity * 2 <= total &&
    intelligence * 2 <= total
  ) {
    return "Specialist";
  }

  if (strength === dexterity && strength > intelligence) return "Duelist";
  if (strength === intelligence && strength > dexterity) return "Spellblade";
  if (dexterity === intelligence && dexterity > strength) return "Trickster";
  if (strength > dexterity && strength > intelligence) return "Swordsman";
  if (dexterity > strength && dexterity > intelligence) return "Tactician";
  return "Spellcaster";
};

export const classTooltip = (name) => {
  const c = CLASSES[name];
  if (!c) return null;
  return {
    title: name,
    subtitle: c.subtitle,
    description: [c.description, `${c.bonus.name}: ${c.bonus.description}`],
    footer: c.requirement,
  };
};
