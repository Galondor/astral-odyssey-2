export const DOUBLE_ELITE_CHANCE = 0.05;
export const GROUP_REWARD_BONUS = 0.1;

const groupSize = () => 1 + Math.floor(Math.random() * 4);

// Factories keep allies in the same region, dungeon, or labyrinth floor.
export function rollEncounter(leader, createEnemy) {
  if (!["basic", "elite"].includes(leader.tier)) return [leader];
  const doubleElite = leader.tier === "elite" && Math.random() < DOUBLE_ELITE_CHANCE;
  const count = doubleElite ? 2 : groupSize();
  const tier = doubleElite ? "elite" : "basic";
  return [leader, ...Array.from({ length: count - 1 }, () => createEnemy(tier))];
}
