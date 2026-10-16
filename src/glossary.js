/*
 Tooltip entries for highlighted words in game replies.
 In any reply text write {{word|key}} to highlight "word" and show GLOSSARY[key] on hover.
 If `key` is not in the glossary it is used as a plain tooltip string: {{word|Some description}}.
 Entries use the same shape as Tooltip content (string, data object or function).
*/
export const GLOSSARY = {
  astra: { title: "Astra", tags: ["Currency"] },
  strength: { title: "Strength", description: "Increases melee damage and health." },
  dexterity: { title: "Dexterity", description: "Increases melee damage and agility." },
  intelligence: { title: "Intelligence", description: "Increases magic damage and power." },
  vitality: { title: "Vitality", description: "Increases health." },
  resilience: { title: "Resilience", description: "Increases defense." },
  agility: { title: "Agility", description: "Increases speed and evasion." },
  luck: { title: "Luck", description: "Increases critical hit chance and item drop rates." },
  swordsman: { title: "Swordsman", subtitle: "Melee Fighter", description: "Bonuses will go here", footer: "When Strength is the highest stat." },
  tactician: { title: "Tactician", subtitle: "Precision Fighter", description: "Bonuses will go here", footer: "When Dexterity is the highest stat." },
  spellcaster: { title: "Spellcaster", subtitle: "Magic Fighter", description: "Bonuses will go here", footer: "When Intelligence is the highest stat." },
  duelist: { title: "Duelist", subtitle: "Precise Melee Fighter", description: "Bonuses will go here", footer: "When Strength and Dexterity are tied for highest." },
  spellblade: { title: "Spellblade", subtitle: "Magic Melee Fighter", description: "Bonuses will go here", footer: "When Strength and Intelligence are tied for highest." },
  trickster: { title: "Trickster", subtitle: "Cunning Fighter", description: "Bonuses will go here", footer: "When Dexterity and Intelligence are tied for highest." },
  specialist: { title: "Specialist", subtitle: "Balanced Fighter", description: "Bonuses will go here", footer: "When Strength, Dexterity, and Intelligence are all equal." }
};
