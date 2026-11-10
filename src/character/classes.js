/*
 Class information, shown in tooltips and on the progression screen.
 A class is chosen at character creation and recalculated as core stats change.
*/
export const CLASSES = {
  Swordsman: {
    bonus: {
      name: "Bulwark & Resolve",
      description: "Defend to block and counter; build Resolve to power a melee strike.",
      effects: [
        "Defend blocks 70% damage and counters for 50% melee damage.",
        "Defend grants 1 Resolve; blocking can grant 1 more per round (max 3).",
        "Spend 2 Resolve on Resolve Strike (150% melee damage).",
      ],
    },
    glossary: "swordsman",
    subtitle: "Melee Fighter",
    description: "Durable melee fighter.",
    requirement: "When Strength is at least 60% of your total core stats.",
  },
  Tactician: {
    bonus: {
      name: "Rhythm & Advantage",
      description: "Exploit openings to build Advantage and critical chance.",
      effects: [
        "Defend, or exploit a: defending, recovering, or debuffed enemy to gain Advantage (max 3).",
        "Spend 2 Advantage on Precision Strike (170% melee damage; ignores 50% defense).",
        "Attacks build 4% critical chance each (max +20%); taking damage resets the bonus.",
      ],
    },
    glossary: "tactician",
    subtitle: "Precision Fighter",
    description: "Fast, evasive fighter.",
    requirement: "When Dexterity is at least 60% of your total core stats.",
  },
  Spellcaster: {
    bonus: {
      name: "Arcane Flow & Instability",
      description: "Build Instability for stronger magic, then release it in a burst.",
      effects: [
        "Magic attacks build Instability (max 3); each stack adds 10% magic damage and 3 power to spell costs.",
        "Basic magic attack stays free; recover 1 power each round.",
        "Arcane Release vents all stacks for 100% magic damage plus 40% per stack.",
      ],
    },
    glossary: "spellcaster",
    subtitle: "Magic Fighter",
    description: "Magic specialist.",
    requirement: "When Intelligence is at least 60% of your total core stats.",
  },
  Duelist: {
    bonus: {
      name: "Parry & Tempo",
      description: "Parry attacks to build Tempo and empower your next melee strike.",
      effects: [
        "Riposte Stance guarantees a parry and 60% melee counter.",
        "Riposte grants 2 Tempo; passive parries have a 15% chance to grant 1 (max 2).",
        "Your next melee action spends Tempo for +35% damage per point.",
      ],
    },
    glossary: "duelist",
    subtitle: "Precise Melee Fighter",
    description: "Precise melee fighter combining strength and dexterity.",
    requirement: "When Strength and Dexterity are each at least 40% of your total core stats.",
  },
  Spellblade: {
    bonus: {
      name: "Arcane Weave",
      description: "Alternate melee and magic attacks to build Weave and amplify damage.",
      effects: [
        "Your first attack builds 1 Weave; alternating melee and magic adds another (max 2).",
        "Alternating attack types deals 25% more damage.",
        "Spend 2 Weave on Fusion Strike (180% of your stronger attack, as melee damage).",
      ],
    },
    glossary: "spellblade",
    subtitle: "Magic Melee Fighter",
    description: "Hybrid melee-and-magic fighter that rewards alternating attacks.",
    requirement: "When Strength and Intelligence are each at least 40% of your total core stats.",
  },
  Trickster: {
    bonus: {
      name: "Prepared Tricks",
      description: "Build Tricks with damaging actions and spend them on a finisher or control.",
      effects: [
        "Each damaging action builds 1 Trick (max 3).",
        "Cash Out spends all Tricks for 100% of whichever is higher melee or magic attack plus 50% per Trick, as magic damage.",
        "Attacks have a 20% chance to apply Weakened or Vulnerable for 2 rounds.",
      ],
    },
    glossary: "trickster",
    subtitle: "Cunning Fighter",
    description: "Agile fighter who mixes dexterity and magic.",
    requirement: "When Dexterity and Intelligence are each at least 40% of your total core stats.",
  },
  Specialist: {
    bonus: {
      name: "Adaptation",
      description: "Switch between offense, protection, and support to build Adaptation.",
      effects: [
        "Your first role and each role change grant 1 Adaptation (max 3).",
        "Spend 2 Adaptation on Improvise (170% of whichever is higher melee or magic attack as melee damage; heal 10% max health).",
        "Different attacks add 5% damage each (max +20%); changing attack type alone is not a role change.",
      ],
    },
    glossary: "specialist",
    subtitle: "Balanced Fighter",
    description: "Flexible fighter with balanced stats and adaptable roles.",
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
    description: [c.description, c.bonus.name, ...(c.bonus.effects || [c.bonus.description])],
    footer: c.requirement,
  };
};
