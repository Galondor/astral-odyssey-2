import { getPlayer, setPlayer } from "../../character/player";
import {
  getEnemy,
  startCombat,
  takeOpeningReplies,
} from "../../combat/combat";
import { getRandomEnemy, hasEnemy } from "../../combat/enemies";
import {
  isEventEligible,
  REGIONS,
  travelEvents,
} from "../../world/events";
import { scenes } from "../../world/gameLogic";

jest.mock("../../firebase", () => ({ auth: {}, db: {} }));
jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(),
  setPlayer: jest.fn(),
}));
jest.mock("../../combat/combat", () => ({
  collapse: jest.fn(),
  getEnemy: jest.fn(),
  startCombat: jest.fn(),
  takeOpeningReplies: jest.fn(),
}));
jest.mock("../../combat/enemies", () => ({
  getRandomEnemy: jest.fn(),
  hasEnemy: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  getPlayer.mockReturnValue(null);
  getEnemy.mockReturnValue(null);
});

afterEach(() => jest.restoreAllMocks());

test("a failed flee returns to the menu if the enemy's opening turn ends combat", () => {
  const enemy = { name: "Ambusher" };
  const openingReplies = ["The Ambusher attacks first!", "You collapse."];
  const player = { stats: { speed: 0 } };
  getRandomEnemy.mockReturnValue(enemy);
  takeOpeningReplies.mockReturnValue(openingReplies);
  jest.spyOn(Math, "random").mockReturnValue(0.5);

  const encounter = travelEvents.find(({ id }) => id === "eliteEncounter");
  const result = encounter.run({ player, region: "Meadowlands" })
    .options.find(({ label }) => label === "Flee")
    .onSelect();

  expect(startCombat).toHaveBeenCalledWith(enemy, { enemyFirst: true });
  expect(result).toEqual({
    next: "menu",
    reply: ["You fail to escape!", ...openingReplies],
  });
});

test.each([
  ["SuncleftExpanse", ["mirageOasis", "quicksandSnare", "sealedPyramid"]],
  ["TempestReach", ["pirateSails", "whirlpool", "wreckageCache"]],
  ["FrostfallRange", ["avalanchePass", "strandedExpedition", "thermalSpring"]],
  ["ShatteredFront", ["crossfire", "fieldMedic", "supplyCache"]],
])("%s has its own travel events", (region, eventIds) => {
  expect(REGIONS[region]).toBeDefined();
  const events = travelEvents.filter(
    (event) => Array.isArray(event.regions) && event.regions.includes(region),
  );

  expect(events.map(({ id }) => id).sort()).toEqual([...eventIds].sort());
  expect(
    events.every((event) =>
      isEventEligible(event, { player: { level: 10 }, region }),
    ),
  ).toBe(true);
});

test("the Tempest Reach pirate event can start its region-specific enemy", () => {
  const pirateEvent = travelEvents.find(({ id }) => id === "pirateSails");
  const player = { level: 5, stats: { gearScore: 0 } };
  const enemy = { name: "Bilge Raider" };
  getRandomEnemy.mockReturnValue(enemy);
  getEnemy.mockReturnValue(enemy);

  const fight = pirateEvent
    .run({ player, region: "TempestReach" })
    .options.find(({ label }) => label === "Fight the pirates");
  const result = fight.onSelect();

  expect(getRandomEnemy).toHaveBeenCalledWith(
    "basic",
    "TempestReach",
    5,
    0,
    "bilgeRaider",
  );
  expect(startCombat).toHaveBeenCalledWith(enemy, { enemyFirst: undefined });
  expect(result).toEqual({ next: "combat" });
});

test("the scarecrow prank starts an elite Living Scarecrow encounter", () => {
  const scarecrowEvent = travelEvents.find(({ id }) => id === "scarecrowPrank");
  const player = { level: 5, stats: { gearScore: 0 } };
  const enemy = { name: "Living Scarecrow" };
  getRandomEnemy.mockReturnValue(enemy);
  getEnemy.mockReturnValue(enemy);

  const fight = scarecrowEvent
    .run({ player, region: "Meadowlands" })
    .options.find(({ label }) => label === "Fight");
  const result = fight.onSelect();

  expect(getRandomEnemy).toHaveBeenCalledWith(
    "elite",
    "Meadowlands",
    5,
    0,
    "livingScarecrow",
  );
  expect(startCombat).toHaveBeenCalledWith(enemy, { enemyFirst: undefined });
  expect(result).toEqual({ next: "combat" });
});

test("the unstable rift offers a large reward or a potentially lethal injury", () => {
  const event = travelEvents.find(({ id }) => id === "unstableRift");
  const player = {
    level: 5,
    astra: 10,
    stats: { health: 100, maxHealth: 100 },
  };
  const gamble = event
    .run({ player, region: "Meadowlands" })
    .options.find(({ label }) => label === "Reach into the rift");

  getPlayer.mockReturnValue(player);
  jest.spyOn(Math, "random").mockReturnValue(0.1);
  expect(gamble.onSelect().reply).toContain("gain 100");
  expect(setPlayer).toHaveBeenCalledWith({ astra: 110 });

  setPlayer.mockClear();
  jest.spyOn(Math, "random").mockReturnValue(0.9);
  expect(gamble.onSelect().reply).toContain("lose [red]40[/red] health");
  expect(setPlayer).toHaveBeenCalledWith({
    stats: { health: 60, maxHealth: 100 },
  });
});

test("the sealed vault is level-gated and starts a boss fight with the enemy first", () => {
  const event = travelEvents.find(({ id }) => id === "sealedWardenVault");
  const player = {
    level: 12,
    astra: 0,
    stats: { gearScore: 0 },
  };
  const ctx = { player, region: "ShatteredFront" };
  const boss = { name: "Siege Captain" };
  getPlayer.mockReturnValue(player);
  hasEnemy.mockReturnValue(true);
  getRandomEnemy.mockReturnValue(boss);
  getEnemy.mockReturnValue(boss);

  expect(isEventEligible(event, { ...ctx, player: { level: 11 } })).toBe(false);
  expect(isEventEligible(event, ctx)).toBe(true);

  const result = event
    .run(ctx)
    .options.find(({ label }) => label === "Break the seal")
    .onSelect();

  expect(setPlayer).toHaveBeenCalledWith({ astra: 120 });
  expect(getRandomEnemy).toHaveBeenCalledWith("boss", "ShatteredFront", 12, 0, undefined);
  expect(startCombat).toHaveBeenCalledWith(boss, { enemyFirst: true });
  expect(result).toMatchObject({
    next: "combat",
    reply: expect.stringContaining("guardian strikes first"),
  });
});

test.each([
  ["Suncleft Expanse", "SuncleftExpanse", 65, "suncleft"],
  ["Tempest Reach", "TempestReach", 75, "tempest"],
  ["Frostfall Range", "FrostfallRange", 85, "frostfall"],
  ["Shattered Front", "ShatteredFront", 95, "shattered"],
])("the portal can send the player to %s", (label, region, fareMultiplier, keyword) => {
  const option = scenes.portal.options.find(
    (entry) => entry.label === label && entry.keywords.includes(keyword),
  );
  const player = { level: 2, astra: fareMultiplier * 2 + 10 };
  const setPlayer = jest.fn();

  const result = option.onSelect({ player, setPlayer });

  expect(result.next).toBe("menu");
  expect(setPlayer).toHaveBeenCalledWith(
    expect.objectContaining({
      astra: 10,
      region,
      regionSteps: 0,
      regionLimit: expect.any(Number),
    }),
  );
});
