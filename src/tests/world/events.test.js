import { getPlayer, setPlayer } from "../../character/player";
import {
  getEnemy,
  startCombat,
  takeOpeningReplies,
} from "../../combat/combat";
import { getRandomEnemy, hasEnemy } from "../../combat/enemies";
import {
  isEventEligible,
  getGatheringEventWeights,
  pickTravelEvent,
  REGIONS,
  runTravelEvent,
  travelEvents,
} from "../../world/events";
import { REGION_ORDER } from "../../world/regions";
import { getPortalFare, scenes } from "../../world/gameLogic";
import { forfeitGathering, getGatheringAttempt } from "../../world/gathering";

jest.mock("../../firebase", () => ({ auth: {}, db: {} }));
jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(),
  setPlayer: jest.fn(),
}));
jest.mock("../../combat/combat", () => ({
  collapse: jest.fn(),
  getEnemy: jest.fn(),
  getEnemies: () => [],
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

test.each(REGION_ORDER)("gathering has increased travel selection weight in %s", (region) => {
  const ctx = { player: { level: 100 }, region };
  const eligible = travelEvents.filter((event) => isEventEligible(event, ctx));
  const total = eligible.reduce((sum, event) =>
    sum + (typeof event.weight === "function" ? event.weight(ctx) : event.weight ?? 1), 0);
  expect(travelEvents.find(({ id }) => id === "gathering").weight(ctx)).toBe(6);
  expect(pickTravelEvent(ctx, travelEvents, () => 4.5 / total).id).toBe("gathering");
  expect(pickTravelEvent(ctx, travelEvents, () => 6.5 / total).id).toBe("quietRoad");
});

test("one generic gathering event is eligible everywhere and randomly selects either activity", () => {
  const event = travelEvents.find(({ id }) => id === "gathering");
  expect(event.regions).toBe("all");
  const player = { level: 100 };
  for (const region of REGION_ORDER) expect(isEventEligible(event, { player, region })).toBe(true);
  for (const [roll, activity] of [[0, "mining"], [0.99, "logging"]]) {
    forfeitGathering();
    jest.spyOn(Math, "random").mockReturnValue(roll);
    expect(event.run({ player, region: "Meadowlands" })).toEqual({ next: "gathering" });
    expect(getGatheringAttempt().activity).toBe(activity);
  }
  forfeitGathering();
  expect(scenes.gathering).toMatchObject({ input: "pointer", screen: "gathering", options: [] });
});

test("gathering key items double matching weights, stack, and respect disabled toggles", () => {
  const event = travelEvents.find(({ id }) => id === "gathering");
  expect(getGatheringEventWeights({})).toEqual({ mining: 3, logging: 3 });
  expect(getGatheringEventWeights({ keyItems: ["gatherersCompass"] })).toEqual({ mining: 6, logging: 6 });
  expect(getGatheringEventWeights({ keyItems: ["oreDiviner"] })).toEqual({ mining: 6, logging: 3 });
  expect(getGatheringEventWeights({ keyItems: ["forestersMap"] })).toEqual({ mining: 3, logging: 6 });
  const player = { keyItems: ["gatherersCompass", "oreDiviner", "forestersMap"], disabledKeyItems: ["forestersMap"] };
  expect(getGatheringEventWeights(player)).toEqual({ mining: 12, logging: 6 });
  expect(event.weight({ player })).toBe(18);
  jest.spyOn(Math, "random").mockReturnValue(0.6);
  forfeitGathering();
  event.run({ player, region: "Meadowlands" });
  expect(getGatheringAttempt().activity).toBe("mining");
  player.disabledKeyItems.push("oreDiviner");
  forfeitGathering();
  event.run({ player, region: "Meadowlands" });
  expect(getGatheringAttempt().activity).toBe("logging");
  forfeitGathering();
});

test.each([
  ["enemyEncounter", "basic", 0.999, ["basic", "basic", "basic", "basic"]],
  ["eliteEncounter", "elite", 0.999, ["elite", "basic", "basic", "basic"]],
  ["eliteEncounter", "elite", 0.01, ["elite", "elite"]],
  ["bossEncounter", "boss", 0.01, ["boss"]],
])("%s uses shared encounter rules at roll %s", (eventId, tier, roll, expected) => {
  const player = { level: 30, stats: { gearScore: 4500 } };
  const leader = { name: "Leader", tier };
  getRandomEnemy.mockImplementation((allyTier) => ({ name: "Ally", tier: allyTier }));
  getRandomEnemy.mockReturnValueOnce(leader);
  getEnemy.mockReturnValue(leader);
  jest.spyOn(Math, "random").mockReturnValue(roll);
  travelEvents.find(({ id }) => id === eventId).run({ player, region: "Darkwood" })
    .options.find(({ label }) => label === "Fight").onSelect();
  const encounter = startCombat.mock.calls[0][0];
  const roster = Array.isArray(encounter) ? encounter : [encounter];
  expect(roster.map((foe) => foe.tier)).toEqual(expected);
  expect(getRandomEnemy.mock.calls.every((args) => args[1] === "Darkwood" && args[2] === 30 && args[3] === 4500)).toBe(true);
});

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
    level: 90,
    astra: 0,
    stats: { gearScore: 0 },
  };
  const ctx = { player, region: "ShatteredFront" };
  const boss = { name: "Siege Captain" };
  getPlayer.mockReturnValue(player);
  hasEnemy.mockReturnValue(true);
  getRandomEnemy.mockReturnValue(boss);
  getEnemy.mockReturnValue(boss);

  expect(isEventEligible(event, { ...ctx, player: { level: 4 } })).toBe(false);
  expect(isEventEligible(event, ctx)).toBe(true);

  const result = event
    .run(ctx)
    .options.find(({ label }) => label === "Break the seal")
    .onSelect();

  // 10 astra per level, scaled by the Shattered Front's 2x reward.
  expect(setPlayer).toHaveBeenCalledWith({ astra: 1800 });
  expect(getRandomEnemy).toHaveBeenCalledWith("boss", "ShatteredFront", 90, 0, undefined);
  expect(startCombat).toHaveBeenCalledWith(boss, { enemyFirst: true });
  expect(result).toMatchObject({
    next: "combat",
    reply: expect.stringContaining("guardian strikes first"),
  });
});

test.each([
  ["Darkwood", "Darkwood", 10, 500, "darkwood"],
  ["Ashen Peaks", "AshenPeaks", 20, 2000, "ashen"],
  ["Tempest Reach", "TempestReach", 40, 5000, "tempest"],
  ["Frostfall Range", "FrostfallRange", 55, 10000, "frostfall"],
  ["Suncleft Expanse", "SuncleftExpanse", 70, 18000, "suncleft"],
  ["Shattered Front", "ShatteredFront", 85, 30000, "shattered"],
])("the portal can send the player to %s", (label, region, entryLevel, fare, keyword) => {
  const option = scenes.portal.options.find(
    (entry) => entry.label === label && entry.keywords.includes(keyword),
  );
  const player = { level: entryLevel, astra: fare + 10, region: "Meadowlands" };
  const setPlayer = jest.fn();

  expect(getPortalFare(player, region)).toBe(fare);
  const result = option.onSelect({ player, setPlayer });

  expect(result.next).toBe("menu");
  expect(setPlayer).toHaveBeenCalledWith(expect.objectContaining({ astra: 10, region }));
  expect(setPlayer.mock.calls[0][0]).not.toHaveProperty("regionSteps");
});

test("portal fares are static and climb steeply with each region", () => {
  const fares = REGION_ORDER.map((id) => getPortalFare({ level: 100 }, id));
  expect(fares).toEqual([100, 500, 2000, 5000, 10000, 18000, 30000]);
  expect(getPortalFare({ level: 1 }, "ShatteredFront")).toBe(30000);
});

test("traveling never forces a region change, but under-leveled saves retreat to a region they can enter", () => {
  const setPlayer = jest.fn();
  jest.spyOn(Math, "random").mockReturnValue(0.5);
  for (let trip = 0; trip < 30; trip += 1)
    runTravelEvent({ player: { level: 15, region: "Darkwood", stats: { gearScore: 0 } }, setPlayer });
  expect(setPlayer).not.toHaveBeenCalledWith(expect.objectContaining({ region: expect.anything() }));

  const result = runTravelEvent({ player: { level: 25, region: "FrostfallRange" }, setPlayer });
  expect(setPlayer).toHaveBeenCalledWith({ region: "AshenPeaks" });
  expect(result.reply).toContain("Ashen Peaks");
});

test("the portal refuses regions above the player's level without charging", () => {
  const option = scenes.portal.options.find((entry) => entry.label === "Ashen Peaks");
  const setPlayer = jest.fn();

  const result = option.onSelect({ player: { level: 19, astra: 99999, region: "Darkwood" }, setPlayer });

  expect(result.reply).toContain("requires level 20");
  expect(result.next).toBeUndefined();
  expect(setPlayer).not.toHaveBeenCalled();
});

test("the portal does not charge for the current region and needs enough astra", () => {
  const option = scenes.portal.options.find((entry) => entry.label === "Darkwood");
  const setPlayer = jest.fn();

  expect(option.onSelect({ player: { level: 15, astra: 9999, region: "Darkwood" }, setPlayer }).reply)
    .toContain("already in the Darkwood");
  expect(option.onSelect({ player: { level: 15, astra: 499, region: "Meadowlands" }, setPlayer }).reply)
    .toContain("need 500");
  expect(setPlayer).not.toHaveBeenCalled();
});
