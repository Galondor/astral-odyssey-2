/*
 Class information, shown in tooltips and on the progression screen.
 A class is chosen at character creation from the highest core stat(s) (see createCharacter in gameLogic.js).
*/
export const CLASSES = {
  Swordsman: {
    bonus: { name: "Bulwark", description: "Defending blocks 70% of incoming damage instead of 50%, when blocking a hit you counterattack for 50% of a melee attack." },
    glossary: "swordsman",
    subtitle: "Melee Fighter",
    description: "A front-line brawler. Strength raises melee damage and vitality, making for a durable, hard-hitting fighter.",
    requirement: "When Strength is the highest stat.",
  },
  Tactician: {
    bonus: { name: "Rhythm", description: "Each attack you make builds momentum: +4% critical chance per attack (up to +20%). Taking damage breaks your rhythm." },
    glossary: "tactician",
    subtitle: "Precision Fighter",
    description: "A swift, precise fighter. Dexterity raises melee damage and agility, improving speed and evasion.",
    requirement: "When Dexterity is the highest stat.",
  },
  Spellcaster: {
    bonus: { name: "Arcane Flow", description: "Recover 1 power at the end of every round, and your spell skills cost 1 less power (minimum 1)." },
    glossary: "spellcaster",
    subtitle: "Magic Fighter",
    description: "A master of magic. Intelligence raises magic damage.",
    requirement: "When Intelligence is the highest stat.",
  },
  Duelist: {
    bonus: { name: "Parry", description: "15% chance to parry an incoming hit, negating it entirely and riposting for 60% of a melee attack." },
    glossary: "duelist",
    subtitle: "Precise Melee Fighter",
    description: "Blends strength and finesse for strong, fast melee damage.",
    requirement: "When Strength and Dexterity are tied for highest.",
  },
  Spellblade: {
    bonus: { name: "Spellstrike", description: "Using a skill infuses your blade: your next basic attack deals 50% more damage." },
    glossary: "spellblade",
    subtitle: "Magic Melee Fighter",
    description: "Pairs heavy melee strikes with magical power.",
    requirement: "When Strength and Intelligence are tied for highest.",
  },
  Trickster: {
    bonus: { name: "Hexing Tricks", description: "Your damaging attacks have a 20% chance to hex the enemy, making them Weakened or Vulnerable for 2 rounds." },
    glossary: "trickster",
    subtitle: "Cunning Fighter",
    description: "Quick and clever, mixing agility with magic.",
    requirement: "When Dexterity and Intelligence are tied for highest.",
  },
  Specialist: {
    bonus: { name: "Adaptable", description: "Deal 5% more damage for each different kind of attack used this combat (melee, magic, and each skill), up to +20%." },
    glossary: "specialist",
    subtitle: "Balanced Fighter",
    description: "A well-rounded adventurer with no weak point.",
    requirement: "When Strength, Dexterity, and Intelligence are all equal.",
  },
};

export const getClassForStats = ({ strength, dexterity, intelligence }) => {
  if (strength === dexterity && strength === intelligence) return "Specialist";
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
