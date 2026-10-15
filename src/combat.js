import { getPlayer, setPlayer } from "./player";

// Simple turn-based combat state, shown by the "combat" game screen.
let enemy = null;

export const getEnemy = () => enemy;
export const endCombat = () => { enemy = null; };

export const startCombat = (template) => {
  enemy = { attack: [2, 6], reward: 5, ...template, hp: template.maxHp };
};

const roll = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// Runs one round. Returns { replies, over } and updates the saved player.
export function attackRound() {
  const p = getPlayer();
  const s = { ...p.stats };
  const replies = [];
  const hit = roll(s.attackMin, s.attackMax);
  enemy.hp = Math.max(0, enemy.hp - hit);
  replies.push(`You strike the ${enemy.name} for [red]${hit}[/red] damage.`);

  if (enemy.hp <= 0) {
    s.exp += enemy.reward * 2;
    setPlayer({ stats: s, astra: (p.astra || 0) + enemy.reward });
    replies.push(`The ${enemy.name} falls! You gain ${enemy.reward * 2} exp and ${enemy.reward} {{astra|astra}}.`);
    enemy = null;
    return { replies, over: true };
  }

  const dmg = Math.max(1, roll(...enemy.attack) - s.defense);
  s.health = Math.max(0, s.health - dmg);
  replies.push(`The ${enemy.name} hits you for [red]${dmg}[/red] damage.`);
  if (s.health <= 0) {
    s.health = s.maxHealth;
    setPlayer({ stats: s });
    replies.push("You collapse, and wake up back at safety.");
    enemy = null;
    return { replies, over: true };
  }
  setPlayer({ stats: s });
  return { replies, over: false };
}
