import {
  collapse,
  getEnemy,
  startCombat,
  takeOpeningReplies,
} from "../combat/combat";
import { getRandomEnemy, hasEnemy } from "../combat/enemies";
import { addConsumable, getKeyItemEffect } from "../items/consumables";
import { MATERIALS, addMaterial, getMaterials, spendMaterials } from "../items/materials";
import { getPlayer, setPlayer as savePlayer } from "../character/player";

/*
 Travel events. Add or remove entries in `travelEvents` to change the pool.

 Event fields:
   id        - unique string
   weight    - relative chance of being picked (default 1)
   minLevel  - optional, lowest player level that can see it
   maxLevel  - optional, highest player level that can see it
   regions   - "all" or an array of region ids (e.g. ["Darkwood"]); required on every event
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
  SuncleftExpanse: { name: "Suncleft Expanse" },
  TempestReach: { name: "Tempest Reach" },
  FrostfallRange: { name: "Frostfall Range" },
  ShatteredFront: { name: "Shattered Front" },
};
export const DEFAULT_REGION = "Meadowlands";

export const getRegion = (player) => {
  const saved = player?.region;
  if (REGIONS[saved]) return saved;
  // Older saves stored the display name (e.g. "Ashen Peaks").
  return Object.keys(REGIONS).find((id) => REGIONS[id].name === saved) || DEFAULT_REGION;
};

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
    regions: "all",
    when: ({ player, region }) => hasEnemy(tier, region, playerLevel(player)),
    ...extra,
    run: (ctx) => ({
      reply: text,
      options: tier === "basic" ? [fightOption(tier, ctx)] : [fightOption(tier, ctx), fleeOption(tier, ctx)],
    }),
  };
}

// ---- Shared helpers for events ----

export const FLEE_BASE = 0.3;
export const FLEE_PER_5_SPEED = 0.01;
export const getFleeChance = (player) =>
  Math.min(1, FLEE_BASE + Math.floor((player?.stats?.speed || 0) / 5) * FLEE_PER_5_SPEED);

const rnd = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const chance = (p) => Math.random() < p;
const percent = (n) => `${Math.round(n * 100)}%`;

// A numbered choice button; keywords are the lowercase label and its position.
const choice = (label, n, onSelect, extra) => ({ label, keywords: [label.toLowerCase(), String(n)], onSelect, ...extra });
const leave = (label, n, reply) => choice(label, n, () => ({ reply, next: "menu" }));

// Starts a fight against an enemy of `tier` from the player's current region.
// `enemyId` forces a specific enemy template; `enemyFirst` makes the enemy take the opening turn.
function startFight(tier, { player, region }, { enemyId, enemyFirst } = {}) {
  const enemy = getRandomEnemy(tier, region, playerLevel(player), player.stats?.gearScore || 0, enemyId);
  if (!enemy) return { reply: "There are no enemies in this region.", next: "menu" };
  startCombat(enemy, { enemyFirst });
  if (!getEnemy()) return { reply: takeOpeningReplies(), next: "menu" };
  return { next: "combat" };
}

const fightOption = (tier, ctx, label = "Fight", n = 1, opts) => choice(label, n, () => startFight(tier, ctx, opts));

// Fleeing succeeds with FLEE_BASE plus 1% per 5 speed; on failure the enemy gets the first move.
const fleeOption = (tier, ctx, label = "Flee", n = 2, opts) =>
  choice(
    label,
    n,
    () => {
      const current = getPlayer() || ctx.player;
      if (chance(getFleeChance(current))) return { reply: "You slip away.", next: "menu" };
      const result = startFight(tier, ctx, { ...opts, enemyFirst: true });
      return {
        ...result,
        reply: ["You fail to escape!", ...[].concat(result.reply || [])],
      };
    },
    {
      tooltip: () => {
        const p = getPlayer() || ctx.player;
        const speed = p?.stats?.speed || 0;
        return {
          title: "Flee",
          description: `Escape chance: ${percent(getFleeChance(p))}\nBase ${percent(FLEE_BASE)} + 1% per 5 speed (${speed} speed: +${Math.floor(speed / 5)}%).`,
          footer: "If you fail, the fight begins and the enemy acts first.",
        };
      },
    },
  );

// Restores a fraction of max health/stamina; returns the amounts actually gained.
function restore({ health = 0, stamina = 0 }) {
  const s = { ...getPlayer().stats };
  const gainedHealth = Math.min(s.maxHealth - s.health, Math.max(health ? 1 : 0, Math.round(s.maxHealth * health)));
  const gainedStamina = Math.min(s.maxStamina - s.stamina, Math.max(stamina ? 1 : 0, Math.round(s.maxStamina * stamina)));
  s.health += gainedHealth;
  s.stamina += gainedStamina;
  savePlayer({ stats: s });
  return { health: gainedHealth, stamina: gainedStamina };
}

// Removes a fraction of max health. Reaching 0 triggers a collapse, same as losing a fight.
// Returns { text, died } where text describes the loss (and the collapse).
function hurt(fraction) {
  const p = getPlayer();
  const s = { ...p.stats };
  const lost = Math.max(1, Math.round(s.maxHealth * fraction));
  s.health -= lost;
  if (s.health > 0) {
    savePlayer({ stats: s });
    return { text: `You lose [red]${lost}[/red] health.`, died: false };
  }
  const replies = [];
  const patch = {};
  collapse(p, s, replies, patch);
  savePlayer({ ...patch, stats: s });
  return { text: `You lose [red]${lost}[/red] health. ${replies.join(" ")}`, died: true };
}

const spendStamina = (n) => {
  const s = { ...getPlayer().stats };
  s.stamina = Math.max(0, s.stamina - n);
  savePlayer({ stats: s });
};
const hasStamina = (n) => (getPlayer()?.stats?.stamina || 0) >= n;

const gainAstra = (amount) => savePlayer({ astra: (getPlayer().astra || 0) + amount });

// Grants `amount` of a random material from `keys` and returns a description of it.
function gainMaterial(keys, min, max = min) {
  const key = pick(keys);
  const amount = rnd(min, max);
  addMaterial(key, amount);
  return `${amount} ${MATERIALS[key].name}`;
}

const restoreText = (r) =>
  [r.health && `[green]${r.health}[/green] health`, r.stamina && `[green]${r.stamina}[/green] stamina`]
    .filter(Boolean)
    .join(" and ") || "nothing, you were already fully rested";

const MEADOW_MATERIALS = ["slime_gel", "wolf_pelt", "boar_tusk", "goblin_scrap"];
const DARKWOOD_MATERIALS = ["rotwood_bark", "spider_silk"];
const PEAKS_MATERIALS = ["obsidian_shard", "ember_core"];

const regionalEvents = [
  // ---- Meadowlands: gentle ----
  {
    id: "wildflowerGlade",
    regions: ["Meadowlands"],
    weight: 1.5,
    run: () => ({
      reply: "You stumble upon a sunlit glade full of wildflowers. It's the perfect place to catch your breath.",
      options: [
        choice("Rest", 1, () => ({
          reply: `You rest among the flowers and recover ${restoreText(restore({ stamina: 0.25 }))}.`,
          next: "menu",
        })),
        choice("Tend wounds", 2, () => ({
          reply: `You bind your wounds with soothing petals and recover ${restoreText(restore({ health: 0.15 }))}.`,
          next: "menu",
        })),
      ],
    }),
  },
  {
    id: "abandonedCart",
    regions: ["Meadowlands"],
    weight: 1.5,
    run: () => ({
      reply: "An abandoned cart sits tilted at the side of the road, its cargo half spilled.",
      options: [
        choice("Quick search", 1, () => ({
          reply: `You rummage through the spilled cargo and find ${gainMaterial(MEADOW_MATERIALS, 1, 2)}.`,
          next: "menu",
        })),
        choice("Thorough search", 2, () => {
          spendStamina(1);
          return { reply: `You spend some effort searching every crate and find ${gainMaterial(MEADOW_MATERIALS, 2, 4)}.`, next: "menu" };
        }, { when: () => hasStamina(1), tooltip: { title: "Thorough search", description: "More materials.", footer: "Cost 1 Stamina" } }),
        leave("Leave", 3, "You leave the cart behind."),
      ],
    }),
  },
  {
    id: "peddlersWager",
    regions: ["Meadowlands"],
    weight: 1.5,
    run: ({ player }) => {
      const cost = Math.max(5, playerLevel(player) * 5);
      return {
        reply: `A cheerful peddler waves you down. "A mystery pouch for just ${cost} {{astra|astra}}! Could be a treasure, could be pebbles!"`,
        options: [
          choice("Buy", 1, () => {
            if ((getPlayer().astra || 0) < cost) return { reply: "You can't afford the pouch.", next: "menu" };
            gainAstra(-cost);
            const roll = Math.random();
            if (roll < 0.4) {
              addConsumable("minorPotion", 1);
              return { reply: "Inside the pouch is a Minor Health Potion!", next: "menu" };
            }
            if (roll < 0.75) return { reply: `Inside the pouch you find ${gainMaterial(MEADOW_MATERIALS, 2, 3)}.`, next: "menu" };
            return { reply: "The pouch is full of pebbles. The peddler is already gone.", next: "menu" };
          }, {
            when: () => (getPlayer().astra || 0) >= cost,
            tooltip: { title: "Mystery pouch", description: "A Minor Health Potion, a few materials, or just pebbles.", footer: `Cost ${cost} Astra` },
          }),
          leave("Decline", 2, "You politely decline and continue on."),
        ],
      };
    },
  },
  {
    id: "scarecrowPrank",
    regions: ["Meadowlands"],
    weight: 1.5,
    when: ({ player, region }) => hasEnemy("elite", region, playerLevel(player)),
    run: (ctx) => ({
      reply: "A scarecrow stands in the middle of a field. As you pass, it twitches, tears free of its post, and lunges at you!",
      options: [
        fightOption("elite", ctx, "Fight", 1, { enemyId: "livingScarecrow" }),
        fleeOption("elite", ctx, "Sneak away", 2, { enemyId: "livingScarecrow" }),
      ],
    }),
  },

  // ---- Darkwood: a step up ----
  {
    id: "hollowStump",
    regions: ["Darkwood"],
    weight: 1.5,
    run: () => {
      const search = (trapChance, trapDamage) => {
        if (chance(trapChance)) {
          return { reply: `A hidden trap snaps shut! ${hurt(trapDamage).text}`, next: "menu" };
        }
        return { reply: `You pull out a hidden cache: ${gainMaterial(DARKWOOD_MATERIALS, 2, 3)}.`, next: "menu" };
      };
      return {
        reply: "A hollow stump holds something glinting inside. It could be trapped.",
        options: [
          choice("Reach in", 1, () => search(0.4, 0.3), { tooltip: { title: "Reach in", description: "40% chance of a trap that deals 30% of your max health." } }),
          choice("Pry carefully", 2, () => {
            spendStamina(1);
            return search(0.15, 0.3);
          }, { when: () => hasStamina(1), tooltip: { title: "Pry carefully", description: "15% chance of a trap that deals 30% of your max health.", footer: "Cost 1 Stamina" } }),
          leave("Leave", 3, "You decide it isn't worth the risk."),
        ],
      };
    },
  },
  {
    id: "glowcapGrove",
    regions: ["Darkwood"],
    weight: 1.5,
    run: () => ({
      reply: "A grove of softly glowing mushrooms fills the air with a sweet smell.",
      options: [
        choice("Eat", 1, () => {
          const roll = Math.random();
          if (roll < 0.4) return { reply: `The glowcaps are delicious and invigorating! You recover ${restoreText(restore({ health: 0.4 }))}.`, next: "menu" };
          if (roll < 0.7) return { reply: `Your stomach lurches. ${hurt(0.1).text}`, next: "menu" };
          return { reply: "The mushrooms taste of nothing at all.", next: "menu" };
        }, { tooltip: { title: "Eat", description: "Might heal you, might make you sick.", footer: "40% heal • 30% sick • 30% nothing" } }),
        leave("Leave", 2, "You leave the glowing grove alone."),
      ],
    }),
  },
  {
    id: "poachersSnare",
    regions: ["Darkwood"],
    weight: 1.5,
    run: (ctx) => {
      const harm = hurt(0.1);
      if (harm.died) return { reply: `You trigger a poacher's snare! ${harm.text}`, next: "menu" };
      const poacher = { enemyId: "poacher" };
      return {
        reply: `You trigger a poacher's snare! ${harm.text} The poacher who set it steps out of the trees, crossbow raised.`,
        options: [fightOption("basic", ctx, "Fight", 1, poacher), fleeOption("basic", ctx, "Flee", 2, poacher)],
      };
    },
  },
  {
    id: "hermitsFire",
    regions: ["Darkwood"],
    weight: 1.5,
    run: () => ({
      reply: 'A hermit tends a small fire. "Share some scraps, and I will share my stew," he rasps.',
      options: [
        choice("Share a meal", 1, () => {
          const owned = getMaterials();
          if (!owned.length) return { reply: "You have nothing to share.", next: "menu" };
          const m = pick(owned);
          savePlayer({ materials: spendMaterials(getPlayer(), { [m.key]: 1 }) });
          return {
            reply: `You hand over 1 ${m.name}. The stew restores ${restoreText(restore({ health: 0.3, stamina: 0.25 }))}.`,
            next: "menu",
          };
        }, {
          when: () => getMaterials().length > 0,
          tooltip: { title: "Share a meal", description: "Give 1 random material to restore 30% health and 25% stamina." },
        }),
        leave("Decline", 2, "You nod to the hermit and move on."),
      ],
    }),
  },

  // ---- Ashen Peaks: much harsher ----
  {
    id: "cinderVent",
    regions: ["AshenPeaks"],
    weight: 1.5,
    run: () => ({
      reply: "A glowing vent spits embers. Heat-forged minerals lie scattered around its rim.",
      options: [
        choice("Loot", 1, () => {
          if (chance(0.4)) return { reply: `The vent erupts! You are scorched. ${hurt(0.25).text}`, next: "menu" };
          return { reply: `You snatch ${gainMaterial(PEAKS_MATERIALS, 2, 3)} from the rim.`, next: "menu" };
        }, { tooltip: { title: "Loot", description: "40% chance the vent erupts for 25% of your max health." } }),
        leave("Back away", 2, "You back away from the heat."),
      ],
    }),
  },
  {
    id: "rockslideLedge",
    regions: ["AshenPeaks"],
    weight: 1.5,
    run: ({ player }) => {
      const reward = Math.max(1, playerLevel(player) * 4);
      return {
        reply: "A narrow ledge is strewn with loose rocks. Pebbles skitter down the cliff above you.",
        options: [
          choice("Cross quickly", 1, () => {
            if (chance(0.5)) {
              return { reply: `The ledge collapses behind you! ${hurt(0.2).text}`, next: "menu" };
            }
            gainAstra(reward);
            return { reply: `You dash across and find ${reward} {{astra|astra}} on the far side.`, next: "menu" };
          }, { tooltip: { title: "Cross quickly", description: "50% chance of a rockslide costing 20% of your max health, otherwise a bonus reward." } }),
          choice("Clear the route", 2, () => {
            spendStamina(1);
            return { reply: `You carefully clear the rocks and gather ${gainMaterial(["obsidian_shard"], 1, 2)}.`, next: "menu" };
          }, { when: () => hasStamina(1), tooltip: { title: "Clear the route", description: "Safe, with a small reward.", footer: "Cost 1 Stamina" } }),
        ],
      };
    },
  },
  {
    id: "fallenExpedition",
    regions: ["AshenPeaks"],
    weight: 1.5,
    run: (ctx) => ({
      reply: "You find the remains of an expedition, their packs still strapped to their bodies.",
      options: [
        choice("Loot packs", 1, () => {
          const lines = [];
          if (chance(0.5)) {
            addConsumable("healthPotion", 1);
            lines.push("You find a Health Potion.");
          } else {
            lines.push(`You find ${gainMaterial(["ember_core", "primal_essence"], 1, 2)}.`);
          }
          if (hasEnemy("elite", ctx.region, playerLevel(ctx.player)) && chance(0.5)) {
            lines.push("A scavenger lurking nearby attacks to claim the spoils!");
            return { reply: lines, options: [fightOption("elite", ctx), fleeOption("elite", ctx)] };
          }
          return { reply: lines, next: "menu" };
        }, { tooltip: { title: "Loot packs", description: "A Health Potion or rare materials, but a scavenger elite may ambush you." } }),
        leave("Leave", 2, "You leave the dead to rest."),
      ],
    }),
  },
  {
    id: "emberShrine",
    regions: ["AshenPeaks"],
    weight: 1.5,
    run: ({ player }) => {
      const reward = Math.max(1, playerLevel(player) * 8);
      return {
        reply: "A blackened shrine glows with an inner fire. An altar waits for an offering of blood.",
        options: [
          choice("Offer blood", 1, () => {
            const harm = hurt(0.3);
            if (harm.died) return { reply: `The shrine takes everything. ${harm.text}`, next: "menu" };
            gainAstra(reward);
            return {
              reply: `${harm.text} The shrine rewards you with ${reward} {{astra|astra}} and ${gainMaterial(["ember_core"], 2)}.`,
              next: "menu",
            };
          }, {
            tooltip: { title: "Offer blood", description: `Lose 30% of your max health for ${reward} Astra and 2 Ember Cores. This can kill you.` },
          }),
          leave("Ignore", 2, "You ignore the shrine and press on."),
        ],
      };
    },
  },
];

const globalEvents = [
  {
    id: "loneCampsite",
    regions: "all",
    weight: 1.5,
    run: () => ({
      reply: "You find a small abandoned campsite with a still-warm fire pit.",
      options: [
        choice("Rest", 1, () => ({
          reply: `You rest by the fire and recover ${restoreText(restore({ stamina: 0.25, health: 0.1 }))}.`,
          next: "menu",
        })),
        leave("Move on", 2, "You don't linger."),
      ],
    }),
  },
  {
    id: "forkInTheRoad",
    regions: "all",
    weight: 1.5,
    run: (ctx) => {
      const level = playerLevel(ctx.player);
      return {
        reply: "The road splits in two. One path is winding but well traveled, the other is short and overgrown.",
        options: [
          choice("Safe path", 1, () => {
            gainAstra(level);
            return { reply: `You take the long way and pick up ${level} {{astra|astra}} along the road.`, next: "menu" };
          }),
          choice("Short path", 2, () => {
            if (chance(0.5) || !hasEnemy("basic", ctx.region, level)) {
              gainAstra(level * 4);
              return { reply: `The shortcut pays off! You find ${level * 4} {{astra|astra}}.`, next: "menu" };
            }
            return { reply: "Something was waiting along the overgrown path!", options: [fightOption("basic", ctx), fleeOption("basic", ctx)] };
          }, { tooltip: { title: "Short path", description: "50% chance of a larger reward, 50% chance of an ambush." } }),
        ],
      };
    },
  },
  {
    id: "shadowTail",
    regions: "all",
    weight: 1.5,
    when: ({ player, region }) => hasEnemy("basic", region, playerLevel(player)),
    run: (ctx) => ({
      reply: "You get the feeling you're being followed. Something keeps pace just out of sight.",
      options: [
        fightOption("basic", ctx, "Turn and fight"),
        choice("Hurry on", 2, () => {
          spendStamina(1);
          return { reply: "You quicken your pace and lose your pursuer, but the effort tires you. (-1 Stamina)", next: "menu" };
        }, { tooltip: { title: "Hurry on", description: "Lose your pursuer without a fight.", footer: "Cost 1 Stamina" } }),
      ],
    }),
  },
  {
    id: "unstableRift",
    regions: "all",
    minLevel: 5,
    weight: 0.75,
    run: ({ player }) => {
      const reward = playerLevel(player) * 20;
      return {
        reply: "A volatile rift tears open beside the trail. Its unstable core could be worth a fortune—or blast you apart.",
        options: [
          choice("Reach into the rift", 1, () => {
            if (chance(0.5)) {
              gainAstra(reward);
              return {
                reply: `You seize the stable core and gain ${reward} {{astra|astra}}!`,
                next: "menu",
              };
            }
            return {
              reply: `The rift detonates! ${hurt(0.4).text}`,
              next: "menu",
            };
          }, {
            tooltip: {
              title: "Reach into the rift",
              description: `50% chance to gain ${reward} Astra; otherwise lose 40% of your max health. This can cause a collapse.`,
            },
          }),
          leave("Seal the rift", 2, "You seal the rift and continue on safely."),
        ],
      };
    },
  },
  {
    id: "sealedWardenVault",
    regions: "all",
    minLevel: 12,
    weight: 0.5,
    when: ({ player, region }) => hasEnemy("boss", region, playerLevel(player)),
    run: (ctx) => {
      const reward = playerLevel(ctx.player) * 10;
      return {
        reply: "An ancient vault cracks open, and a battle-scarred boss rises to defend its hoard. Only the strongest should challenge it.",
        options: [
          choice("Break the seal", 1, () => {
            gainAstra(reward);
            return {
              reply: `The vault's hoard grants you ${reward} {{astra|astra}}, but its guardian strikes first!`,
              ...startFight("boss", ctx, { enemyFirst: true }),
            };
          }, {
            tooltip: {
              title: "Break the seal",
              description: `Gain ${reward} Astra, then face a boss that attacks first. There is no chance to flee once combat begins.`,
            },
          }),
          leave("Back away", 2, "You leave the vault sealed and avoid the guardian."),
        ],
      };
    },
  },

  // ---- Suncleft Expanse: heat, mirages, and buried ruins ----
  {
    id: "mirageOasis",
    regions: ["SuncleftExpanse"],
    weight: 1.5,
    run: () => ({
      reply: "A wavering oasis appears ahead. The heat makes it impossible to tell which pool is real.",
      options: [1, 2, 3].map((n) =>
        choice(`Approach the ${["left", "middle", "right"][n - 1]} pool`, n, () => {
          if (rnd(1, 3) === n) {
            const recovered = restore({ stamina: 0.35 });
            return { reply: `The pool is real. Cool water restores ${restoreText(recovered)}.`, next: "menu" };
          }
          return { reply: `The pool vanishes into a mirage. ${hurt(0.1).text}`, next: "menu" };
        }, { tooltip: { title: "Choose an oasis", description: "1-in-3 chance to restore stamina; otherwise lose 10% of your max health." } }),
      ),
    }),
  },
  {
    id: "quicksandSnare",
    regions: ["SuncleftExpanse"],
    weight: 1.5,
    run: () => ({
      reply: "The sand shifts beneath your feet and starts pulling you under.",
      options: [
        choice("Brace and climb", 1, () => {
          spendStamina(1);
          return { reply: "You brace against a buried stone and climb free.", next: "menu" };
        }, { when: () => hasStamina(1), tooltip: { title: "Brace and climb", description: "Escape without injury.", footer: "Cost 1 Stamina" } }),
        choice("Dig for a foothold", 2, () => {
          if (chance(0.5)) return { reply: "You find a solid foothold and pull yourself free.", next: "menu" };
          return { reply: `The sand gives way and you wrench yourself free at the last moment. ${hurt(0.1).text}`, next: "menu" };
        }, { tooltip: { title: "Dig for a foothold", description: "50% chance to escape cleanly; otherwise lose 10% of your max health." } }),
      ],
    }),
  },
  {
    id: "sealedPyramid",
    regions: ["SuncleftExpanse"],
    weight: 1.5,
    run: ({ player }) => ({
      reply: "A buried pyramid has cracked open, revealing a chamber glittering beneath the sand.",
      options: [
        choice("Search the chamber", 1, () => {
          const reward = Math.max(5, playerLevel(player) * 8);
          gainAstra(reward);
          if (hasEnemy("elite", "SuncleftExpanse", playerLevel(player)) && chance(0.4)) {
            return {
              reply: `You claim ${reward} {{astra|astra}}, but something stirs beneath the sarcophagus.`,
              options: [fightOption("elite", { player, region: "SuncleftExpanse" }), fleeOption("elite", { player, region: "SuncleftExpanse" })],
            };
          }
          return { reply: `You uncover an old offering worth ${reward} {{astra|astra}}.`, next: "menu" };
        }, { tooltip: { title: "Search the chamber", description: "Find Astra, but an elite guardian may awaken." } }),
        leave("Leave the ruins", 2, "You leave the pyramid undisturbed."),
      ],
    }),
  },

  // ---- Tempest Reach: open water and dangerous salvage ----
  {
    id: "pirateSails",
    regions: ["TempestReach"],
    weight: 1.5,
    run: (ctx) => {
      const toll = Math.max(5, playerLevel(ctx.player) * 5);
      return {
        reply: "A pirate vessel cuts across your route. Its crew signals for you to surrender your cargo.",
        options: [
          fightOption("basic", ctx, "Fight the pirates", 1, { enemyId: "bilgeRaider" }),
          choice("Pay the toll", 2, () => {
            gainAstra(-toll);
            return { reply: `The pirates take ${toll} {{astra|astra}} and let you pass.`, next: "menu" };
          }, {
            when: () => (getPlayer()?.astra || 0) >= toll,
            tooltip: { title: "Pay the toll", description: "Avoid a fight by paying the pirates.", footer: `Cost ${toll} Astra` },
          }),
          fleeOption("basic", ctx, "Flee", 3, { enemyId: "bilgeRaider" }),
        ],
      };
    },
  },
  {
    id: "whirlpool",
    regions: ["TempestReach"],
    weight: 1.5,
    run: ({ player }) => ({
      reply: "A whirlpool opens across the sea lane, pulling your vessel toward its center.",
      options: [
        choice("Steer wide", 1, () => {
          spendStamina(1);
          return { reply: "You fight the current and steer around the whirlpool.", next: "menu" };
        }, { when: () => hasStamina(1), tooltip: { title: "Steer wide", description: "Avoid the whirlpool safely.", footer: "Cost 1 Stamina" } }),
        choice("Ride the current", 2, () => {
          if (chance(0.5)) {
            const reward = Math.max(5, playerLevel(player) * 5);
            gainAstra(reward);
            return { reply: `The current carries you past a wreck. You salvage ${reward} {{astra|astra}}.`, next: "menu" };
          }
          return { reply: `A wave throws you against the deck. ${hurt(0.1).text}`, next: "menu" };
        }, { tooltip: { title: "Ride the current", description: "50% chance to salvage Astra; otherwise lose 10% of your max health." } }),
      ],
    }),
  },
  {
    id: "wreckageCache",
    regions: ["TempestReach"],
    weight: 1.5,
    run: (ctx) => ({
      reply: "A broken ship's cargo bobs among the waves. Something moves beneath it.",
      options: [
        choice("Grab nearby cargo", 1, () => {
          const reward = Math.max(5, playerLevel(ctx.player) * 4);
          gainAstra(reward);
          return { reply: `You snatch a floating strongbox containing ${reward} {{astra|astra}}.`, next: "menu" };
        }),
        choice("Search the wreck", 2, () => {
          const reward = Math.max(10, playerLevel(ctx.player) * 8);
          gainAstra(reward);
          const elite = hasEnemy("elite", ctx.region, playerLevel(ctx.player));
          const tier = elite ? "elite" : "basic";
          const enemyId = elite ? "reefStalker" : "bilgeRaider";
          const enemyName = elite ? "reef stalker" : "bilge raider";
          return {
            reply: `You find ${reward} {{astra|astra}} in the hold, but a ${enemyName} rises from the wreck!`,
            options: [fightOption(tier, ctx, "Fight", 1, { enemyId }), fleeOption(tier, ctx, "Flee", 2, { enemyId })],
          };
        }, { tooltip: { title: "Search the wreck", description: "Find a larger haul, then face a regional enemy. The encounter grows with your level." } }),
      ],
    }),
  },

  // ---- Frostfall Range: whiteouts, rockfall, and shelter ----
  {
    id: "avalanchePass",
    regions: ["FrostfallRange"],
    weight: 1.5,
    run: ({ player }) => ({
      reply: "Snow cracks high above the trail. An avalanche is beginning to spill down the pass.",
      options: [
        choice("Take the sheltered path", 1, () => {
          spendStamina(1);
          return { reply: "You push through the sheltered cut and avoid the worst of the slide.", next: "menu" };
        }, { when: () => hasStamina(1), tooltip: { title: "Take the sheltered path", description: "Avoid injury by taking the longer route.", footer: "Cost 1 Stamina" } }),
        choice("Sprint across the slope", 2, () => {
          if (chance(0.5)) {
            const reward = Math.max(5, playerLevel(player) * 5);
            gainAstra(reward);
            return { reply: `You outrun the slide and find ${reward} {{astra|astra}} in a lost pack.`, next: "menu" };
          }
          return { reply: `The snow knocks you off your feet. ${hurt(0.1).text}`, next: "menu" };
        }, { tooltip: { title: "Sprint across the slope", description: "50% chance to find a lost pack; otherwise lose 10% of your max health." } }),
      ],
    }),
  },
  {
    id: "strandedExpedition",
    regions: ["FrostfallRange"],
    weight: 1.5,
    run: (ctx) => ({
      reply: "You find a stranded expedition shelter, half-buried in snow. The supplies are intact, but tracks circle the camp.",
      options: [
        choice("Take a field ration", 1, () => {
          addConsumable("minorPotion", 1);
          return { reply: "You salvage a Minor Health Potion from the supply chest.", next: "menu" };
        }),
        choice("Search the supply cache", 2, () => {
          const reward = Math.max(10, playerLevel(ctx.player) * 7);
          gainAstra(reward);
          const elite = hasEnemy("elite", ctx.region, playerLevel(ctx.player));
          const tier = elite ? "elite" : "basic";
          const enemyId = elite ? "rimeSentinel" : "frostfang";
          const enemyName = elite ? "Rime Sentinel" : "Frostfang";
          return {
            reply: `You take ${reward} {{astra|astra}} from the cache. A ${enemyName} emerges from the whiteout!`,
            options: [fightOption(tier, ctx, "Fight", 1, { enemyId }), fleeOption(tier, ctx, "Flee", 2, { enemyId })],
          };
        }, { tooltip: { title: "Search the supply cache", description: "Find a larger reward, then face a regional enemy. The encounter grows with your level." } }),
      ],
    }),
  },
  {
    id: "thermalSpring",
    regions: ["FrostfallRange"],
    weight: 1.5,
    run: () => ({
      reply: "Steam curls from a sheltered hot spring beneath the ice.",
      options: [
        choice("Rest and recover", 1, () => ({
          reply: `The warmth restores ${restoreText(restore({ health: 0.2, stamina: 0.2 }))}.`,
          next: "menu",
        })),
        leave("Keep moving", 2, "You leave the spring and continue through the snow."),
      ],
    }),
  },

  // ---- Shattered Front: crossfire and contested supplies ----
  {
    id: "crossfire",
    regions: ["ShatteredFront"],
    weight: 1.5,
    run: (ctx) => ({
      reply: "Crossfire erupts between ruined barricades, cutting off the road.",
      options: [
        choice("Crawl through the trench", 1, () => {
          spendStamina(1);
          return { reply: "You keep low and crawl through the trench unseen.", next: "menu" };
        }, { when: () => hasStamina(1), tooltip: { title: "Crawl through the trench", description: "Avoid combat by taking cover.", footer: "Cost 1 Stamina" } }),
        choice("Charge the barricade", 2, () => ({
          reply: "You sprint through the smoke as a trench scavenger moves to intercept you.",
          options: [fightOption("basic", ctx, "Fight", 1, { enemyId: "trenchScavenger" }), fleeOption("basic", ctx, "Flee", 2, { enemyId: "trenchScavenger" })],
        })),
      ],
    }),
  },
  {
    id: "fieldMedic",
    regions: ["ShatteredFront"],
    weight: 1.5,
    run: ({ player }) => {
      const cost = Math.max(5, playerLevel(player) * 4);
      return {
        reply: `A field medic offers treatment for ${cost} {{astra|astra}}.`,
        options: [
          choice("Accept treatment", 1, () => {
            gainAstra(-cost);
            const healed = restore({ health: 0.3 });
            return { reply: `You pay the medic and recover ${restoreText(healed)}.`, next: "menu" };
          }, {
            when: () => (getPlayer()?.astra || 0) >= cost,
            tooltip: { title: "Accept treatment", description: "Recover up to 30% of your max health.", footer: `Cost ${cost} Astra` },
          }),
          leave("Decline", 2, "You thank the medic and continue on."),
        ],
      };
    },
  },
  {
    id: "supplyCache",
    regions: ["ShatteredFront"],
    weight: 1.5,
    run: (ctx) => ({
      reply: "A supply cache sits exposed in the ruins between the front lines.",
      options: [
        choice("Take a small bundle", 1, () => {
          const reward = Math.max(5, playerLevel(ctx.player) * 4);
          gainAstra(reward);
          return { reply: `You take ${reward} {{astra|astra}} worth of supplies and retreat.`, next: "menu" };
        }),
        choice("Search the entire cache", 2, () => {
          const reward = Math.max(10, playerLevel(ctx.player) * 8);
          gainAstra(reward);
          const boss = hasEnemy("boss", ctx.region, playerLevel(ctx.player));
          const elite = !boss && hasEnemy("elite", ctx.region, playerLevel(ctx.player));
          const tier = boss ? "boss" : elite ? "elite" : "basic";
          const enemyId = boss ? "siegeCaptain" : elite ? "frontlineVeteran" : "trenchScavenger";
          const enemyName = boss ? "Siege Captain" : elite ? "Frontline Veteran" : "Trench Scavenger";
          return {
            reply: `You uncover ${reward} {{astra|astra}} in military pay. A ${enemyName} spots you and advances!`,
            options: [fightOption(tier, ctx, "Stand and fight", 1, { enemyId }), fleeOption(tier, ctx, "Retreat", 2, { enemyId })],
          };
        }, { tooltip: { title: "Search the entire cache", description: "Find a larger reward, then face a regional enemy. The encounter grows with your level." } }),
      ],
    }),
  },
];

export const REGION_TRIPS_MIN = 10;
export const REGION_TRIPS_MAX = 20;
export const rollRegionLimit = () =>
  REGION_TRIPS_MIN + Math.floor(Math.random() * (REGION_TRIPS_MAX - REGION_TRIPS_MIN + 1));

export const travelEvents = [
  {
    id: "quietRoad",
    regions: "all",
    weight: 3,
    clearLog: true,
    run: () => ({
      reply: "The road is quiet. You travel without incident.",
      options: OPTIONS_RETURN,
    }),
  },
  {
    id: "astraShard",
    regions: "all",
    weight: 2,
    clearLog: true,
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
  ...globalEvents,
  ...regionalEvents,
];

export const isEventEligible = (event, ctx) => {
  const level = ctx.player?.level || 1;
  if (event.minLevel !== undefined && level < event.minLevel) return false;
  if (event.maxLevel !== undefined && level > event.maxLevel) return false;
  if (Array.isArray(event.regions) && !event.regions.includes(ctx.region)) return false;
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
