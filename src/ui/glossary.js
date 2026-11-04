import { CLASSES, classTooltip } from "../character/classes";

/*
 Tooltip entries for highlighted words in game replies.
 In any reply text write {{word|key}} to highlight "word" and show GLOSSARY[key] on hover.
 If `key` is not in the glossary it is used as a plain tooltip string: {{word|Some description}}.
 Entries use the same shape as Tooltip content (string, data object or function).
*/
export const GLOSSARY = {
  action: { title: "Action", description: "Solo/PvP: one per turn for attacking, most skills, Defend, or a second Quick Action. Group content has just one Action and no Quick Actions." },
  quickAction: { title: "Quick Action", description: "Solo/PvP: one per turn, before or after your Action. Combat consumables, Renewal, and Provoke qualify. Your Action can pay for a second Quick Action. Each skill is usable once per turn." },
  astra: { title: "Astra", tags: ["Currency"] },
  strength: { title: "Strength", description: "Increases melee damage and health." },
  dexterity: { title: "Dexterity", description: "Increases melee damage and agility." },
  intelligence: { title: "Intelligence", description: "Increases magic damage." },
  vitality: { title: "Vitality", description: "Increases health." },
  resilience: { title: "Resilience", description: "Increases defense." },
  agility: { title: "Agility", description: "Increases speed and evasion." },
  luck: { title: "Luck", description: "Increases critical hit chance and item drop rates." },
  ...Object.fromEntries(Object.entries(CLASSES).map(([name, c]) => [c.glossary, classTooltip(name)])),
};
