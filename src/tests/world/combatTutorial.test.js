import { getPlayer, setPlayer } from "../../character/player";
import { getEnemy, endCombat, getCombatTutorial } from "../../combat/combat";
import { runTravelEvent } from "../../world/events";
import { scenes, processButton } from "../../world/gameLogic";

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../character/player", () => ({ getPlayer: jest.fn(), setPlayer: jest.fn() }));
let hero;
beforeEach(() => {
  hero = {
    name: "Veteran", class: "Specialist", level: 50, records: { bossEnemiesKilled: 10 },
    region: "Meadowlands", equipment: {}, consumables: { healthPotion: 8 },
    stats: { health: 80, maxHealth: 100, power: 10, maxPower: 10, stamina: 10, maxStamina: 10,
      speed: 10, attackMin: 9999, attackMax: 9999, magicAttackMin: 9999, magicAttackMax: 9999 },
  };
  getPlayer.mockImplementation(() => JSON.parse(JSON.stringify(hero)));
  setPlayer.mockImplementation((patch) => { hero = { ...hero, ...JSON.parse(JSON.stringify(patch)) }; });
  endCombat();
});
afterEach(() => endCombat());

test("every character gets a fixed next-travel tutorial and guided buttons complete it once", () => {
  expect(runTravelEvent({ player: hero, setPlayer }).next).toBe("combat");
  expect(getEnemy().id).toBe("trainingSentinel");
  expect(processButton("combat", "Defend").replies.join(" ")).toContain("Training");
  processButton("combat", "Melee Attack");
  processButton("combat", "Use Item");
  expect(scenes.combatItems.options.map((o) => o.label)).toContain("Health Potion x1");
  processButton("combatItems", "Health Potion x1");
  expect(getCombatTutorial().title).toBe("Read the telegraph");
  processButton("combat", "Defend");
  processButton("combat", "End Turn");
  expect(getEnemy().recovering).toBe(true);
  processButton("combat", "Magic Attack");
  processButton("combat", "End Turn");
  expect(processButton("combat", "Melee Attack").sceneId).toBe("menu");
  expect(hero.combatTutorialCompleted).toBe(true);
  expect(hero.consumables.healthPotion).toBe(8);
  expect(hero.stats.health).toBe(80);
  expect(hero.records.bossEnemiesKilled).toBe(10);
  expect(getEnemy()).toBeNull();
});
