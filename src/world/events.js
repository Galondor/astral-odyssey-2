import { startCombat } from "../combat/combat";
import { getRandomEnemy, hasEnemy } from "../combat/enemies";
import { getKeyItemEffect } from "../items/consumables";

/*
 Travel events. Add or remove entries in `travelEvents` to change the pool.

 Event fields:
   id        - unique string
   weight    - relative chance of being picked (default 1)
   minLevel  - optional, lowest player level that can see it
   maxLevel  - optional, highest player level that can see it
   regions   - optional array of region ids; omit for every region
   when      - optional (ctx) => boolean for custom conditions
   run       - (ctx) => { reply?, next?, options? }
               ctx = { player, setPlayer, region }
               `options` is a list of { label, keywords?, when?, next?, onSelect? } shown as
               choices. onSelect receives the same ctx plus { player, setPlayer } and may return
               { reply, next, options } again, so dialogues can branch, teleport
               (setPlayer({ region })), or hand off to another scene such as combat via `next`.
*/
export const REGIONS = {
  Meadowlands: { name: "Meadowlands" },
  Darkwood: { name: "Darkwood" },
  AshenPeaks: { name: "Ashen Peaks" },
};
export const DEFAULT_REGION = "Meadowlands";

export const getRegion = (player) =>
  REGIONS[player?.region] ? player.region : DEFAULT_REGION;

const OPTIONS_RETURN = [
  {
    label: "Return",
    keywords: ["return", "2"],
    next: "menu",
  },
];

const playerLevel = (player) => Math.max(1, Number(player?.level) || 1);

// Builds an encounter event for an enemy tier; boss and elite fights can be fled.
function encounter(id, tier, text, extra) {
  return {
    id,
    when: ({ player, region }) => hasEnemy(tier, region, playerLevel(player)),
    ...extra,
    run: ({ player, region }) => ({
      reply: text,
      options: [
        {
          label: "Fight",
          keywords: ["fight", "1"],
          onSelect: () => {
            const enemy = getRandomEnemy(tier, region, playerLevel(player));
            if (!enemy) return { reply: "There are no enemies in this region.", next: "menu" };
            startCombat(enemy);
            return { next: "combat" };
          },
        },
        ...(tier === "basic" ? [] : [{ label: "Flee", keywords: ["flee", "2"], next: "menu", onSelect: () => ({ reply: "You slip away.", next: "menu" }) }]),
      ],
    }),
  };
}

export const REGION_TRIPS_MIN = 10;
export const REGION_TRIPS_MAX = 20;
export const rollRegionLimit = () =>
  REGION_TRIPS_MIN + Math.floor(Math.random() * (REGION_TRIPS_MAX - REGION_TRIPS_MIN + 1));

export const travelEvents = [
  {
    id: "quietRoad",
    weight: 3,
    run: () => ({
      reply: "The road is quiet. You travel without incident.",
      options: OPTIONS_RETURN,
    }),
  },
  {
    id: "astraShard",
    weight: 2,
    run: ({ player, setPlayer, region }) => {
      const amount = Math.max(1, (player.level || 1) * 2);
      setPlayer({ astra: (player.astra || 0) + amount });
      return {
        reply: `You find a glowing shard and gain +${amount} {{astra|astra}}.`,
        options: OPTIONS_RETURN,
      };
    },
  },
  encounter("enemyEncounter", "basic", "An enemy appears!", { weight: 5 }),
  encounter("eliteEncounter", "elite", "A dangerous elite enemy blocks your path!", {
    minLevel: 3,
    weight: ({ player }) => 1.5 * (1 + getKeyItemEffect(player, "huntBonus")),
  }),
  encounter("bossEncounter", "boss", "A mighty presence looms ahead... a boss approaches!", {
    minLevel: 5,
    weight: ({ player }) => 0.6 * (1 + 2 * getKeyItemEffect(player, "huntBonus")),
  }),
];

export const isEventEligible = (event, ctx) => {
  const level = ctx.player?.level || 1;
  if (event.minLevel !== undefined && level < event.minLevel) return false;
  if (event.maxLevel !== undefined && level > event.maxLevel) return false;
  if (event.regions && !event.regions.includes(ctx.region)) return false;
  return !event.when || event.when(ctx);
};

// Weighted random pick from the eligible events; `rng` is injectable for testing.
export function pickTravelEvent(ctx, pool = travelEvents, rng = Math.random) {
  const eligible = pool.filter((e) => isEventEligible(e, ctx));
  const weightOf = (e) => (typeof e.weight === "function" ? e.weight(ctx) : e.weight ?? 1);
  const total = eligible.reduce((sum, e) => sum + weightOf(e), 0);
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const e of eligible) {
    roll -= weightOf(e);
    if (roll < 0) return e;
  }
  return eligible[eligible.length - 1];
}

export function runTravelEvent({ player, setPlayer }) {
  const region = getRegion(player);
  const steps = (player?.regionSteps || 0) + 1;
  const limit = player?.regionLimit || rollRegionLimit();
  if (steps >= limit) {
    const others = Object.keys(REGIONS).filter((r) => r !== region);
    const next = others[Math.floor(Math.random() * others.length)];
    setPlayer({ region: next, regionSteps: 0, regionLimit: rollRegionLimit() });
    return {
      reply: `After a long journey you arrive in the [gold]${REGIONS[next].name}[/gold]. New dangers await.`,
      options: OPTIONS_RETURN,
    };
  }
  setPlayer({ regionSteps: steps, regionLimit: limit });
  const ctx = { player: player || {}, setPlayer, region };
  const event = pickTravelEvent(ctx);
  return (event && event.run(ctx)) || {};
}
