export const TUTORIAL_ENEMY = {
  id: "trainingSentinel",
  name: "Training Sentinel",
  tutorial: true,
  tier: "training",
  level: 1,
  maxHp: 100,
  attack: [1, 1],
  defense: 0,
  speed: 0,
  critical: 0,
  abilities: [{
    name: "Training Slam", power: 1, heavy: true,
    warning: "Defend, then End Turn to brace for the slam.",
  }],
};

export const TUTORIAL_STEPS = [
  { type: "attack", title: "Use your Action", text: "Choose Melee Attack or Magic Attack. Each turn you have one Action and one Quick Action." },
  { type: "consume", title: "Use your Quick Action", text: "Your Action is used, but your Quick Action remains. Open Use Item and drink the Health Potion!" },
  { type: "defend", title: "Read the telegraph", text: "The Sentinel is Preparing Training Slam. Choose Defend to spend your Action and reduce the incoming attack. Heavy attacks warn you before striking and cannot randomly critically hit." },
  { type: "pass", title: "End your turn", text: "Your guard stays active. Choose End Turn to forfeit your unused Quick Action." },
  { type: "attack", title: "Exploit Recovery", text: "The Sentinel is Recovering: its next turn has no attack. Strike now with Melee Attack or Magic Attack!" },
  { type: "pass", title: "Allow the recovery turn", text: "Now end your turn, the Sentinel must spend its turn recovering instead of attacking." },
  { type: "attack", title: "Finish your training", text: "Strike once more to finish the Sentinel! Remember that some skills are Quick Actions and others are Actions." },
];

export const tutorialActionError = (step, type, key) => {
  const current = TUTORIAL_STEPS[step];
  if (!current) return null;
  const matches = current.type === "attack"
    ? type === "melee" || type === "magic"
    : current.type === type && (type !== "consume" || key === "healthPotion");
  return matches ? null : `Training: ${current.text}`;
};
