/*
 Group dungeon definitions. Each dungeon has four stages:
   1 Entry (waves / survival), 2 Teamwork puzzle, 3 Challenge (elite + run-wide debuff), 4 Multi-phase boss.
 Dungeon fields: { id, name, level, scale: { hp, atk } (per-dungeon tuning on top of GROUP_TIER), color, description,
   materials, unique, stages, enemies }.
 Stage fields:
   kind     "fight" | "puzzle"
   name, intro
   fight    { waves: [[tpl ids]] | enemies: [tpl ids], reinforce: { after, tpl }, survive: rounds,
              conveyor: { tpl: [tpl ids], max }, environment: { status, every, power, turns, text }, startStatus }
   puzzle   "stations" | "dials" | "rings" (see groupPuzzles.js)
 Enemy templates: { name, tier: "basic" | "elite" | "boss", mod: { hp, atk, def, spd }, abilities, phases,
   immune, immuneCycle, corruptionReflect } — ability/phase fields are documented in groupCombat.js.
*/

const stun = (chance) => ({ id: "stun", chance });
const dot = (id, power, turns = 3, chance = 1) => ({ id, power, turns, chance });
const debuff = (id, power, turns = 3, chance = 1) => ({ id, power, turns, chance });

export const GROUP_PARTY_SIZE = 3;
export const GROUP_RUN_MS = 15 * 60 * 1000;
export const GROUP_WIPE_PENALTY_MS = 2 * 60 * 1000;

export const GROUP_DUNGEONS = {
  tidewrack: {
    id: "tidewrack",
    name: "Tidewrack Hold",
    level: 40,
    scale: { hp: 0.92, atk: 0.92 },
    color: "#3fa7d6",
    description: "A drowned pirate fortress where Captain Vareth Saltblood still commands a crew that refuses to die.",
    materials: { basic: "tidewrack_brine_pearl", elite: "tidewrack_kraken_ink", boss: "tidewrack_doubloon" },
    unique: "varethCutlass",
    stages: [
      {
        kind: "fight",
        name: "Boarding Action",
        intro: "Grappling hooks bite the rail. The Saltfang crew pours over the side, three waves deep.",
        fight: {
          waves: [
            ["twBoarder", "twBoarder"],
            ["twGunner", "twBoarder", "twGunner"],
            ["twBrute", "twGunner", "twBoarder"],
          ],
          reinforce: { after: 4, tpl: "twDeckhand" },
        },
      },
      {
        kind: "puzzle",
        name: "Capstan & Cannons",
        puzzle: "stations",
        intro: "The gate winch is jammed. The bosun barks orders; each order needs a hand at the right station, in the right order.",
      },
      {
        kind: "fight",
        name: "The Scurvy Hold",
        challenge: true,
        intro: "The hold reeks of rot. Scurvy creeps into everyone who breathes it, and the Drowned Quartermaster guards the stores.",
        fight: {
          enemies: ["twQuartermaster", "twBilgeRat"],
          environment: { status: "scurvy", every: 1, power: 0.015, turns: 4, text: "The rot of the hold seeps into {name}." },
        },
      },
      {
        kind: "fight",
        name: "Captain Vareth Saltblood",
        boss: true,
        intro: "On the flooded quarterdeck, Captain Vareth draws a cutlass that drips seawater. \"Ye'll hang from my yardarm!\"",
        fight: { enemies: ["twVareth"] },
      },
    ],
    enemies: {
      twBoarder: {
        name: "Saltfang Boarder", tier: "basic",
        abilities: [{ name: "Cutlass Slash", power: 1.3, status: dot("bleed", 0.03, 3, 0.5), cooldown: 3 }],
      },
      twGunner: {
        name: "Brinepowder Gunner", tier: "basic", mod: { atk: 1.15, hp: 0.8 },
        abilities: [
          { name: "Pistol Volley", power: 0.6, hits: 2, cooldown: 3 },
          { name: "Smoke Bomb", power: 0.5, aoe: true, status: debuff("weaken", 0.2, 2, 0.4), cooldown: 4 },
        ],
      },
      twBrute: {
        name: "Barnacle Brute", tier: "basic", mod: { hp: 1.4, spd: 0.8 },
        abilities: [{ name: "Anchor Swing", power: 1.6, status: stun(0.3), cooldown: 4 }],
      },
      twDeckhand: {
        name: "Cannon Deckhand", tier: "basic", mod: { hp: 0.8 },
        abilities: [{ name: "Grapeshot", power: 0.6, aoe: true, cooldown: 3 }],
      },
      twBilgeRat: {
        name: "Bilge Rat Swarm", tier: "basic", mod: { hp: 0.6, atk: 0.7, spd: 1.3 },
        abilities: [{ name: "Gnaw", power: 0.5, hits: 3, status: dot("scurvy", 0.015, 4, 0.5), cooldown: 3 }],
      },
      twQuartermaster: {
        name: "Drowned Quartermaster", tier: "elite",
        abilities: [
          { name: "Confiscate", power: 1.1, mechanic: "steal", cooldown: 3, weight: 4 },
          { name: "Bilge Slam", power: 1.5, status: dot("scurvy", 0.015, 4), cooldown: 3 },
          { name: "Ledger of Debts", power: 0.7, aoe: true, status: debuff("vulnerable", 0.25, 2, 0.5), cooldown: 4 },
        ],
        phases: [{ below: 0.4, text: "The Quartermaster tears open a barrel of brine and drinks deep!", self: { id: "enrage", turns: 99, power: 0.3 } }],
      },
      twCrewman: {
        name: "Loyal Crewman", tier: "basic", mod: { hp: 0.7 },
        abilities: [{ name: "Belaying Pin", power: 1.2, cooldown: 2 }],
      },
      twVareth: {
        name: "Captain Vareth Saltblood", tier: "boss", proper: true,
        abilities: [
          { name: "Cutlass Flurry", power: 0.55, hits: 4, cooldown: 3 },
          { name: "Keelhaul", power: 1.7, status: dot("bleed", 0.04, 3), cooldown: 4 },
          { name: "Broadside", power: 2.4, telegraph: true, below: 0.35, cooldown: 4, weight: 6, warning: "The cannons are run out. Defend or Guard an ally next round!" },
        ],
        phases: [
          { below: 0.7, text: "\"All hands! Repel boarders!\" Crewmen leap in to shield their captain. Kill them to break the wall!", summon: ["twCrewman", "twCrewman"], mechanic: "shieldWhileAdds" },
          { below: 0.35, text: "Vareth bellows to his gun crews. The cannons swing around to face you!", self: { id: "enrage", turns: 99, power: 0.25 } },
        ],
      },
    },
  },
  chronoforge: {
    id: "chronoforge",
    name: "The Chronoforge Spire",
    level: 60,
    scale: { hp: 1.6, atk: 1.5 },
    color: "#d6a33f",
    description: "A clockwork tower that forges seconds into weapons. The Chronarch keeps time here and lets no one leave on schedule.",
    materials: { basic: "chrono_mainspring", elite: "chrono_paradox_gear", boss: "chrono_heartwatch" },
    unique: "chronarchEscapement",
    stages: [
      {
        kind: "fight",
        name: "The Assembly Line",
        intro: "The conveyor never stops. Survive 8 rounds while the Spire assembles defenders around you.",
        fight: {
          enemies: ["cfCog", "cfPiston"],
          survive: 8,
          conveyor: { tpl: ["cfCog", "cfTicker", "cfPiston"], max: 4 },
        },
      },
      {
        kind: "puzzle",
        name: "Synchron Locks",
        puzzle: "dials",
        intro: "Three dials guard the lift. Each of you can read only one engraved clue. Talk it through and set every dial in the same round.",
      },
      {
        kind: "fight",
        name: "Temporal Rot",
        challenge: true,
        intro: "Time frays on the upper floor. Temporal Rot sinks into your bones as a Paradox Twin steps out of the moment you just left.",
        fight: { enemies: ["cfTwin"], startStatus: "temporalRot" },
      },
      {
        kind: "fight",
        name: "The Chronarch",
        boss: true,
        intro: "At the heart of the Spire, the Chronarch unfolds from a great clock face. \"You are late.\"",
        fight: { enemies: ["cfChronarch"] },
      },
    ],
    enemies: {
      cfCog: {
        name: "Cogwork Drone", tier: "basic", mod: { hp: 0.6, spd: 1.2 },
        abilities: [{ name: "Gear Toss", power: 1.2, cooldown: 2 }],
      },
      cfPiston: {
        name: "Piston Guard", tier: "basic", mod: { hp: 1.2, def: 1.3 },
        abilities: [
          { name: "Hydraulic Slam", power: 1.5, status: stun(0.3), cooldown: 4 },
          { name: "Overpressure", power: 0, self: { id: "fortify", turns: 2, power: 0.35 }, cooldown: 5 },
        ],
      },
      cfTicker: {
        name: "Ticking Bomb", tier: "basic", mod: { hp: 0.45, spd: 0.6 },
        abilities: [{ name: "Detonate", power: 1.1, aoe: true, cooldown: 3, weight: 5 }],
      },
      cfTwin: {
        name: "Paradox Twin", tier: "elite", mod: { spd: 1.1 },
        abilities: [
          { name: "Mirror Echo", mechanic: "mirror", echo: 0.6, cooldown: 3, weight: 4 },
          { name: "Temporal Lash", power: 1.4, status: debuff("weaken", 0.25, 2), cooldown: 3 },
          { name: "Second Hand", power: 0.7, hits: 2, cooldown: 2 },
        ],
        phases: [{ below: 0.5, text: "The twin flickers between two moments at once!", self: { id: "enrage", turns: 99, power: 0.25 } }],
      },
      cfShard: {
        name: "Chrono Shard", tier: "basic", mod: { spd: 0.9 },
        abilities: [{ name: "Time Bolt", power: 1.1, cooldown: 2 }],
      },
      cfChronarch: {
        name: "Chronarch", tier: "boss",
        abilities: [
          { name: "Gear Strike", power: 0.8, hits: 2, cooldown: 2 },
          { name: "Hour Hand", power: 1.9, ignoreDefense: 0.3, cooldown: 3 },
          { name: "Rewind", mechanic: "rewind", need: 0.05, below: 0.65, cooldown: 5, weight: 5 },
          { name: "Stopped Clock", power: 0.6, aoe: true, status: stun(0.25), cooldown: 4 },
        ],
        phases: [
          { below: 0.65, text: "The Chronarch's dials spin backwards. It can now rewind its own wounds!" },
          { below: 0.3, text: "The Chronarch shatters into its past, present and future!", mechanic: "split", into: "cfShard", count: 3, shardHp: 0.2 },
        ],
      },
    },
  },
  starless: {
    id: "starless",
    name: "The Starless Throne",
    level: 80,
    scale: { hp: 1.7, atk: 1.6 },
    color: "#9b5cff",
    description: "Beyond the last star sits a throne of nothing. Nyx'thara, the Star-Eater, waits there, hungry for the light you carry.",
    materials: { basic: "starless_void_shard", elite: "starless_eclipse_ichor", boss: "starless_eater_fang" },
    unique: "starEaterCrown",
    stages: [
      {
        kind: "fight",
        name: "Riftfall",
        intro: "Rifts tear open around you. The void-touched are warded against blade or spell. Mix your damage to break through.",
        fight: {
          waves: [
            ["stRiftling", "stHusk"],
            ["stPrism", "stHusk", "stRiftling"],
          ],
          reinforce: { after: 6, tpl: "stRiftling" },
        },
      },
      {
        kind: "puzzle",
        name: "Constellation Alignment",
        puzzle: "rings",
        intro: "Three star rings hang over the abyss. Turn them until every star aligns, before the collapse swallows the bridge.",
      },
      {
        kind: "fight",
        name: "Void Corruption",
        challenge: true,
        intro: "The air turns to static. Void Corruption seeps into you each moment, and only Purify can burn it away. The Voidwarden feeds on it.",
        fight: {
          enemies: ["stVoidwarden"],
          environment: { status: "corruption", every: 2, power: 0.02, turns: 5, text: "Void Corruption creeps into {name}." },
        },
      },
      {
        kind: "fight",
        name: "Nyx'thara, the Star-Eater",
        boss: true,
        intro: "The throne unfolds. Nyx'thara rises, a silhouette cut from the night with galaxies for eyes.",
        fight: { enemies: ["stNyx"] },
      },
    ],
    enemies: {
      stRiftling: {
        name: "Riftling", tier: "basic", mod: { hp: 0.6, spd: 1.2 }, immune: "melee",
        abilities: [{ name: "Void Bolt", power: 1.2, cooldown: 2 }],
      },
      stHusk: {
        name: "Starless Husk", tier: "basic", mod: { hp: 0.9, spd: 0.85 }, immune: "magic",
        abilities: [{ name: "Crushing Grasp", power: 1.4, status: stun(0.25), cooldown: 3 }],
      },
      stPrism: {
        name: "Prism Warden", tier: "basic", mod: { hp: 0.7 }, immune: "melee", immuneCycle: 2,
        abilities: [{ name: "Refraction", power: 0.7, aoe: true, cooldown: 3 }],
      },
      stVoidwarden: {
        name: "Voidwarden", tier: "elite", corruptionReflect: true,
        abilities: [
          { name: "Void Lash", power: 1.4, status: dot("corruption", 0.02, 5), cooldown: 2 },
          { name: "Entropy Wave", power: 0.8, aoe: true, status: dot("corruption", 0.02, 5, 0.6), cooldown: 4 },
          { name: "Null Barrier", power: 0, self: { id: "fortify", turns: 2, power: 0.4 }, cooldown: 5 },
        ],
        phases: [{ below: 0.5, text: "The Voidwarden drinks the corruption around it and swells!", self: { id: "enrage", turns: 99, power: 0.3 } }],
      },
      stNyx: {
        name: "Nyx'thara, the Star-Eater", tier: "boss", proper: true,
        abilities: [
          { name: "Star Lance", power: 1.5, cooldown: 2 },
          { name: "Mark of Doom", mechanic: "doom", turns: 3, doomPower: 0.6, cooldown: 4, weight: 4 },
          { name: "Gravity Well", mechanic: "channel", effect: "gravity", rounds: 2, need: 0.06, below: 0.7, cooldown: 6, weight: 5 },
          { name: "Soul Links", mechanic: "soulLink", below: 0.4, cooldown: 5, weight: 4 },
          { name: "Event Horizon", power: 1, aoe: true, below: 0.4, cooldown: 3 },
        ],
        phases: [
          { below: 0.7, text: "Nyx'thara opens its maw. Gravity bends towards it!" },
          { below: 0.4, text: "Threads of starlight lash out, binding your souls together!" },
          { below: 0.15, text: "Nyx'thara devours the last starlight. Reality begins to collapse!", mechanic: "collapse" },
        ],
      },
    },
  },
};

export const GROUP_DUNGEON_IDS = Object.keys(GROUP_DUNGEONS);
