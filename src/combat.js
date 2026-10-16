import { getPlayer, setPlayer } from "./player";
import { generateRandomSlotItem } from "./items";
import { gainExp } from "./stats";

const BASE_DROP_CHANCE = 0.25;

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
    const patch = { astra: (p.astra || 0) + enemy.reward };
    replies.push(`The ${enemy.name} falls! You gain ${enemy.reward * 2} exp and ${enemy.reward} {{astra|astra}}.`);
    const leveled = gainExp(p, enemy.reward * 2);
    Object.assign(patch, leveled.patch);
    replies.push(...leveled.messages);
    // Luck improves drop chance by 1% per point
    const dropChance = (enemy.dropChance ?? BASE_DROP_CHANCE) + (s.luck || 0) * 0.01;
    if (Math.random() < dropChance) {
      const item = generateRandomSlotItem();
      if (item) {
        patch.inventory = [...(p.inventory || []), item];
        replies.push(`The ${enemy.name} dropped {{${item.name}|item:${item.id}}}!`);
      }
    }
    setPlayer(patch);
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
