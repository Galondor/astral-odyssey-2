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
  meadowlands: { name: "Meadowlands" },
  darkwood: { name: "Darkwood" },
  ashen_peaks: { name: "Ashen Peaks" },
};
export const DEFAULT_REGION = "Meadowlands";

export const getRegion = (player) =>
  REGIONS[player?.region] ? player.region : DEFAULT_REGION;

const OPTIONS_RETURN = [
  {
    label: "Return",
    keywords: ["return", "2"],
    next: "menu"
  }
];

export const travelEvents = [
  {
    id: "quietRoad",
    weight: 5,
    run: () => ({ reply: "The road is quiet. You travel without incident.", options: OPTIONS_RETURN }),
  },
  {
    id: "wanderingMerchant",
    weight: 2,
    maxLevel: 10,
    regions: ["Meadowlands"],
    run: () => ({ reply: "A wandering merchant waves as you pass, but has nothing you need." }),
  },
  {
    id: "astraShard",
    weight: 2,
    run: ({ player, setPlayer, region }) => {
      const amount = Math.max(1, (player.level || 1) * 2);
      setPlayer({ astra: (player.astra || 0) + amount });
      return { reply: `You find a glowing shard in the ${REGIONS[region].name}: +${amount} astra.` };
    },
  },
  {
    id: "strangePortal",
    weight: 1,
    minLevel: 3,
    run: () => ({
      reply: "A shimmering portal hangs in the air ahead of you.",
      options: [
        {
          label: "Step through",
          keywords: ["step", "enter", "1"],
          onSelect: ({ setPlayer }) => {
            setPlayer({ region: "Ashen Peaks" });
            return { reply: "The world lurches. You arrive in the Ashen Peaks.", next: "travel" };
          },
        },
        {
          label: "Inspect it",
          keywords: ["inspect", "2"],
          onSelect: () => ({
            reply: "Something moves inside the light.",
            options: [
              { label: "Walk away", keywords: ["walk", "1"], next: "travel", onSelect: () => ({ reply: "You leave it behind." }) },
            ],
          }),
        },
        { label: "Ignore it", keywords: ["ignore", "3"], next: "travel" },
      ],
    }),
  },
  {
    id: "wolfPack",
    weight: 3,
    minLevel: 2,
    regions: ["Darkwood"],
    run: () => ({ reply: "A pack of wolves stalks you through the trees, then loses interest." }),
  },
  {
    id: "rockSlide",
    weight: 3,
    minLevel: 5,
    regions: ["Ashen Peaks"],
    run: () => ({ reply: "A rockslide forces you to take a long detour." }),
  },
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
  const total = eligible.reduce((sum, e) => sum + (e.weight ?? 1), 0);
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const e of eligible) {
    roll -= e.weight ?? 1;
    if (roll < 0) return e;
  }
  return eligible[eligible.length - 1];
}

export function runTravelEvent({ player, setPlayer }) {
  const ctx = { player: player || {}, setPlayer, region: getRegion(player) };
  const event = pickTravelEvent(ctx);
  return (event && event.run(ctx)) || {};
}
