import { Player, getPlayer, savePlayerName, setPlayer } from "../character/player";
import { runTravelEvent } from "./events";
import { expireIfNeeded, getDungeonOptions, getDungeonText, isInDungeon } from "./dungeons";
import { isLabyrinthActive } from "./labyrinth";
import {
  attackRound,
  defendRound,
  getEnemy,
  isPlayerDefending,
  getPlayerStatuses,
  takeOpeningReplies,
  consumeItemRound,
  passRound,
  isPlayerStunned,
} from "../combat/combat";
import { createStarterInventory, getGearTraderStock } from "../items/items";
import {
  CONSUMABLES,
  addConsumable,
  consumableTooltip,
  getConsumables,
  getKeyItemEffect,
} from "../items/consumables";
import { getRegion, REGIONS, rollRegionLimit } from "./events";
import {
  SKILLS,
  getEquippedSkills,
  getSkillLevel,
  skillTooltip,
} from "../character/skills";
import { recalculateStats } from "../character/stats";
import { getClassForStats } from "../character/classes";
import { bankTransaction, getBank } from "./bank";
import { getRep, getRepRank } from "./quests";
import { MARKETPLACE_MIN_LEVEL, isMarketUnlocked } from "./marketplace";
import {
  blackjackHit,
  blackjackStand,
  describeHand,
  startBlackjack,
} from "./blackjack";

export const INPUT_MODES = ["buttons", "text", "both", "form"];
export const INPUT_MATCHING = ["strict", "open"];
export const INPUT_TYPE = ["numbers", "letters", "both"];
const DYNAMIC_SCENE = "dynamic";
export const getInputMode = (scene) => scene.input || INPUT_MODES[0];

/*
 Option fields (buttons and strict text answers):
   label, keywords, next      - basic navigation to scene `next`
   when: () => boolean        - optional; hide the button/answer when false
   onSelect: (ctx) => result  - optional; runs when chosen. ctx = { player, setPlayer, option, scene }
       result (all optional): { next: "sceneId", reply: string | string[], options: [...], input, clearLog }
       `clearLog: true` wipes the log before this result's replies are shown.
       `next` overrides option.next; `reply` messages show before the next scene's text.
       `options` (same shape as option fields) shows a follow-up choice instead of going to `next`;
       option handlers may return `options` again for branching dialogue.
       Returning nothing falls back to option.next; with no next the scene stays.
 Scene fields for the game screen:
   screen: "adventure" (default) | "combat" | "crafting" (Workshop) | any key of SCREENS in screens.js
   screenData: () => object   - optional live data passed to that screen
   clearLog: true             - optional; clears the log whenever the player enters this scene
*/
export const scenes = {
  start: {
    input: INPUT_MODES[1],
    match: INPUT_MATCHING[1],
    filter: INPUT_TYPE[1],
    text: "Welcome to Astral Odyssey 2, what is your name traveler?",
    options: [{ label: "", keywords: [], next: "createCharacter" }],
  },
  createCharacter: {
    input: INPUT_MODES[3],
    clearLog: true,
    text: () =>
      `Where do you excel most at, ${getPlayer().name}?` +
      `\n{{Strength|strength}} {{Dexterity|dexterity}} {{Intelligence|intelligence}}` +
      `\nThese core stats define your overall class` +
      `\n{{Swordsman|swordsman}}` +
      `\n{{Tactician|tactician}}` +
      `\n{{Spellcaster|spellcaster}}` +
      `\n{{Duelist|duelist}}` +
      `\n{{Spellblade|spellblade}}` +
      `\n{{Trickster|trickster}}` +
      `\n{{Specialist|specialist}}`,
    form: {
      pool: { total: 6, label: "Points" },
      submitLabel: "Create character",
      fields: [
        { key: "strength", label: "Strength", min: 1, max: 5 },
        { key: "dexterity", label: "Dexterity", min: 1, max: 5 },
        { key: "intelligence", label: "Intelligence", min: 1, max: 5 },
      ],
      onSubmit: (values, { setPlayer }) => {
        // Determine the player's initial class and stats based on the form values.
        const { strength, dexterity, intelligence } = values;
        const playerClass = getClassForStats({
          strength,
          dexterity,
          intelligence,
        });

        // All derived stats (vitality, attack, health, etc.) are calculated in stats.js
        setPlayer(
          recalculateStats(
            {},
            {
              level: 1,
              class: playerClass,
              astra: 0,
              region: "Meadowlands",
              regionSteps: 0,
              regionLimit: rollRegionLimit(),
              materials: {},
              crafted: {},
              baseStats: { strength, dexterity, intelligence },
              bonusStats: {},
              inventory: createStarterInventory({
                strength,
                dexterity,
                intelligence,
              }),
              equipment: {},
            },
          ),
        );
        return { next: "menu" };
      },
    },
  },
  menu: {
    input: INPUT_MODES[0],
    clearLog: true,
    text: "Where would you like to go?",
    options: [
      {
        label: "Travel",
        tooltip: () => {
          const p = getPlayer();
          return {
            title: "Travel",
            subtitle: p ? REGIONS[getRegion(p)].name : "Unknown",
            description: "Venture out and face random events.",
            footer: "Cost 1 Stamina",
            ...(getKeyItemEffect(p, "compass") && p.regionLimit
              ? {
                  description: `Venture out and face random events. Trips until the region changes: ${Math.max(0, p.regionLimit - (p.regionSteps || 0))}.`,
                }
              : {}),
          };
        },
        keywords: ["travel", "1"],
        onSelect: ({ player, setPlayer }) => {
          const stamina = player.stats.stamina;
          if (stamina < 1) return { reply: "You need 1 stamina to travel." };
          const free = Math.random() < getKeyItemEffect(player, "freeTravel");
          setPlayer({
            ...player,
            stats: { ...player.stats, stamina: free ? stamina : stamina - 1 },
          });
          return free
            ? {
                next: "travel",
                reply:
                  "Your Traveler's Pack lightens the journey. No stamina spent.",
              }
            : { next: "travel" };
        },
      },
      {
        label: "Town",
        tooltip: () => {
          const p = getPlayer();
          return {
            title: "Town",
            description: "Visit the town to access various services.",
          };
        },
        keywords: ["town", "2"],
        next: "town",
      },
      {
        label: "Portal",
        keywords: ["portal", "3"],
        next: "portal",
      },
    ].map((o) => ({ ...o, when: () => !isInDungeon() && !isLabyrinthActive() })),
  },
  dungeon: {
    screen: "dungeonRun",
    input: INPUT_MODES[0],
    clearLog: true,
    text: () => getDungeonText(),
    get options() {
      return getDungeonOptions();
    },
  },
  portal: {
    input: INPUT_MODES[0],
    clearLog: true,
    text: () => {
      const p = getPlayer();
      return `You have arrived at the portal.`;
    },
    options: [
      {
        label: "Leave",
        keywords: ["leave", "1"],
        next: "menu",
      },
      {
        label: "Meadowlands",
        keywords: ["meadow", "2"],
        tooltip: {
          title: "Meadowlands",
          description: `Portal fare: ${25 * (getPlayer()?.level ?? 1)} astra.`,
        },
        onSelect: ({ player, setPlayer }) => {
          const fare = 25 * player.level;
          if ((player.astra || 0) < fare)
            return {
              reply: `You need ${fare} {{astra|astra}} to use the portal.`,
            };
          setPlayer({
            ...player,
            astra: player.astra - fare,
            region: "Meadowlands",
            regionSteps: 0,
            regionLimit: rollRegionLimit(),
          });
          return {
            reply: "You step through the portal to the Meadowlands.",
            next: "menu",
          };
        },
      },
      {
        label: "Darkwood",
        keywords: ["darkwood", "3"],
        tooltip: {
          title: "Darkwood",
          description: `Portal fare: ${35 * (getPlayer()?.level ?? 1)} astra.`,
        },
        onSelect: ({ player, setPlayer }) => {
          const fare = 35 * player.level;
          if ((player.astra || 0) < fare)
            return {
              reply: `You need ${fare} {{astra|astra}} to use the portal.`,
            };
          setPlayer({
            ...player,
            astra: player.astra - fare,
            region: "Darkwood",
            regionSteps: 0,
            regionLimit: rollRegionLimit(),
          });
          return {
            reply: "You step through the portal to Darkwood.",
            next: "menu",
          };
        },
      },
      {
        label: "Ashen Peaks",
        keywords: ["ashen", "4"],
        tooltip: {
          title: "Ashen Peaks",
          description: `Portal fare: ${55 * (getPlayer()?.level ?? 1)} astra.`,
        },
        onSelect: ({ player, setPlayer }) => {
          const fare = 55 * player.level;
          if ((player.astra || 0) < fare)
            return {
              reply: `You need ${fare} {{astra|astra}} to use the portal.`,
            };
          setPlayer({
            ...player,
            astra: player.astra - fare,
            region: "AshenPeaks",
            regionSteps: 0,
            regionLimit: rollRegionLimit(),
          });
          return {
            reply: "You step through the portal to Ashen Peaks.",
            next: "menu",
          };
        },
      },
    ],
  },
  travel: {
    input: INPUT_MODES[0],
    clearLog: true,
    text: () => {
      const p = getPlayer();
      return `You are traveling...`;
    },
    options: [
      {
        label: "Continue",
        keywords: ["continue", "1"],
        onSelect: ({ player, setPlayer }) =>
          runTravelEvent({ player, setPlayer }),
      },
    ],
  },
  town: {
    input: INPUT_MODES[0],
    clearLog: true,
    text: () => {
      const p = getPlayer();
      return `You have arrived in town.`;
    },
    options: [
      {
        label: "Travel",
        keywords: ["travel", "1"],
        next: "travel",
      },
      {
        label: "Leave",
        keywords: ["leave", "2"],
        next: "menu",
      },
      {
        label: "Apothecary",
        keywords: ["apothecary", "3"],
        next: "apothecary",
      },
      {
        label: "Lodging",
        keywords: ["lodging", "4"],
        next: "lodging",
      },
      {
        label: "Workshop",
        keywords: ["workshop", "5"],
        next: "workshop",
      },
      {
        label: "Forge",
        keywords: ["forge", "6"],
        next: "forge",
      },
      {
        label: "Gear Trader",
        keywords: ["gear trader", "7"],
        next: "gearTrader",
      },
      {
        label: "Bank",
        keywords: ["bank", "8"],
        next: "bank",
      },
      {
        label: "Tavern",
        keywords: ["tavern", "9"],
        next: "tavern",
      },
      {
        label: "Marketplace",
        keywords: ["marketplace", "10"],
        tooltip: () => ({
          title: "Marketplace",
          description: `Buy and sell gear with other players. 10% tax on sales.${isMarketUnlocked() ? "" : `\nRequires level ${MARKETPLACE_MIN_LEVEL}.`}`,
        }),
        onSelect: () =>
          isMarketUnlocked()
            ? { next: "marketplace" }
            : { reply: `The marketplace guards wave you off. Come back at level ${MARKETPLACE_MIN_LEVEL}.` },
      },
    ],
  },
  marketplace: {
    screen: "marketplace",
    input: INPUT_MODES[0],
    clearLog: true,
    text: "The marketplace bustles with adventurers trading gear. Browse listings, or put up your own spare gear for sale.",
    options: [
      { label: "Leave", keywords: ["leave", "1"], next: "town" },
    ],
  },
  tavern: {
    input: INPUT_MODES[0],
    clearLog: true,
    text: () => {
      const rep = getRep();
      return `The tavern is loud and warm. Your reputation in town: ${getRepRank(rep)} (${rep}).`;
    },
    options: [
      { label: "Leave", keywords: ["leave", "1"], next: "town" },
      {
        label: "Quest Board",
        keywords: ["quests", "quest board", "2"],
        next: "questBoard",
      },
      { label: "Blackjack", keywords: ["blackjack", "3"], next: "blackjack" },
    ],
  },
  questBoard: {
    screen: "questBoard",
    input: INPUT_MODES[0],
    clearLog: true,
    text: "The quest board is crowded with notices. Accept work, or hand in what you have finished.",
    options: [
      { label: "Leave Quest Board", keywords: ["leave", "1"], next: "tavern" },
    ],
  },
  blackjack: {
    input: INPUT_MODES[2],
    match: INPUT_MATCHING[0],
    clearLog: true,
    text: () =>
      `A dealer waves you to the blackjack table. You have ${getPlayer()?.astra || 0} {{astra|astra}}.` +
      `\nBlackjack pays 3:2 and the dealer stands on 17.` +
      `\nType "bet <amount>" or "bet all" (shorthand: "b 50", "b50", "b a").`,
    options: [
      { label: "Leave Table", keywords: ["leave"], next: "tavern" },
      {
        label: "Bet",
        keywords: ["bet", "b"],
        tooltip: {
          title: "Bet",
          description: 'Type "bet <amount>" or "bet all".',
        },
        onSelect: ({ input }) => {
          const result = startBlackjack(input);
          if (result.error) return { reply: result.error };
          return {
            reply: result.reply,
            next: result.over ? "blackjack" : "blackjackHand",
            keepLog: true,
          };
        },
      },
    ],
  },
  blackjackHand: {
    input: INPUT_MODES[0],
    text: () => describeHand(),
    get options() {
      const act = (play) => () => {
        const result = play();
        return {
          reply: result.reply,
          next: result.over ? "blackjack" : "blackjackHand",
          keepLog: true,
        };
      };
      return [
        { label: "Hit", keywords: ["hit"], onSelect: act(blackjackHit) },
        { label: "Stand", keywords: ["stand"], onSelect: act(blackjackStand) },
      ];
    },
  },
  bank: {
    input: INPUT_MODES[2],
    match: INPUT_MATCHING[0],
    clearLog: true,
    text: () =>
      `Welcome to the Bank. Your account holds ${getBank().balance} {{astra|astra}}, earning 2% interest every hour.` +
      `\nType "deposit <amount>" or "withdraw <amount>" ("all" works too). Shorthand: "d 100", "d100", "w a".`,
    options: [
      { label: "Leave", keywords: ["leave", "1"], next: "town" },
      {
        label: "Deposit All",
        keywords: ["deposit all", "d all"],
        onSelect: ({ input }) => ({ reply: bankTransaction("deposit", "all") }),
      },
      {
        label: "Withdraw All",
        keywords: ["withdraw all", "w all"],
        onSelect: ({ input }) => ({
          reply: bankTransaction("withdraw", "all"),
        }),
      },
      {
        hidden: true,
        keywords: ["deposit", "d"],
        onSelect: ({ input }) => ({ reply: bankTransaction("deposit", input) }),
      },
      {
        hidden: true,
        keywords: ["withdraw", "w"],
        onSelect: ({ input }) => ({
          reply: bankTransaction("withdraw", input),
        }),
      },
    ],
  },
  apothecary: {
    input: INPUT_MODES[0],
    clearLog: true,
    text: "Welcome to the Apothecary. Potions and supplies, fresh on the shelf.",
    get options() {
      return [
        { label: "Leave", keywords: ["leave", "1"], next: "town" },
        ...Object.entries(CONSUMABLES)
          .filter(([, c]) => c.price)
          .map(([key, c]) => ({
            label: `Buy ${c.name}`,
            keywords: [c.name.toLowerCase()],
            tooltip: () => {
              const owned = getPlayer()?.consumables?.[key] || 0;
              return {
                ...consumableTooltip(key),
                footer: `Cost: ${c.price} astra. Owned: ${owned}`,
              };
            },
            onSelect: ({ player }) => {
              if ((player.astra || 0) < c.price)
                return {
                  reply: `You need ${c.price} {{astra|astra}} to buy a ${c.name}.`,
                };
              setPlayer({ astra: player.astra - c.price });
              addConsumable(key);
              return {
                reply: `You buy a ${c.name} for ${c.price} {{astra|astra}}.`,
              };
            },
          })),
      ];
    },
  },
  gearTrader: {
    screen: "gearTrader",
    input: INPUT_MODES[0],
    clearLog: true,
    text: () => {
      getGearTraderStock();
      return "Welcome to the Gear Trader. Sell your spare gear or gems for astra.";
    },
    options: [{ label: "Leave", keywords: ["leave", "1"], next: "town" }],
  },
  lodging: {
    input: INPUT_MODES[2],
    clearLog: true,
    text: () => {
      const p = getPlayer();
      return `Welcome to the Inn. Rest and recover your strength.`;
    },
    options: [
      {
        label: "Leave",
        keywords: ["leave", "1"],
        next: "town",
      },
      {
        label: "Rest",
        keywords: ["rest", "2"],
        onSelect: ({ player, setPlayer }) => {
          const cost = player.level * 10;
          if ((player.astra || 0) < cost)
            return { reply: `You need ${cost} {{astra|astra}} to rest.` };
          const stats = player.stats;
          setPlayer({
            ...player,
            astra: player.astra - cost,
            stats: {
              ...stats,
              stamina: stats.maxStamina,
              health: stats.maxHealth,
              power: stats.maxPower,
            },
          });
          return {
            reply:
              "You rest at the Inn and recover your health, stamina, and power.",
          };
        },
        tooltip: () => {
          const p = getPlayer();
          return { title: "Rest", description: `Cost: ${p.level * 10} astra` };
        },
      },
    ],
  },
  workshop: {
    screen: "crafting",
    clearLog: true,
    input: INPUT_MODES[0],
    text: "The Workshop hums with activity. Bring materials and astra, and the craftsmen will make something lasting.",
    screenData: () => ({ player: getPlayer() }),
    options: [
      { label: "Leave Workshop", keywords: ["leave", "1"], next: "town" },
    ],
  },
  forge: {
    screen: "forge",
    clearLog: true,
    input: INPUT_MODES[0],
    text: "The Forge's star-forged anvils are ready. Shape a relic into a custom item.",
    options: [
      { label: "Leave Forge", keywords: ["leave", "1"], next: "town" },
    ],
  },
  labyrinth: {
    screen: "dungeons",
    clearLog: true,
    input: INPUT_MODES[0],
    text: "You continue your Labyrinth expedition.",
    options: [],
  },
  combat: {
    screen: "combat",
    clearLog: true,
    input: INPUT_MODES[0],
    text: () => {
      const opening = takeOpeningReplies();
      const first = getEnemy()
        ? `A ${getEnemy().name} blocks your path!`
        : "There is nothing to fight.";
      return [first, ...opening].join("\n");
    },
    screenData: () => ({
      enemy: getEnemy(),
      stats: getPlayer()?.stats,
      defending: isPlayerDefending(),
      playerStatuses: getPlayerStatuses(),
    }),
    options: [
      {
        label: "Melee Attack",
        keywords: ["attack", "1"],
        tooltip: () => {
          const s = getPlayer().stats;
          return {
            title: "Melee Attack",
            subtitle: `Critical Hit Chance: ${Math.round((s.criticalHitChance || 0) * 100)}%`,
            description: `Damage: ${s.attackMin} - ${s.attackMax}`,
          };
        },
        onSelect: () => {
          if (!getEnemy()) return { next: "menu" };
          const { replies, over } = attackRound("melee");
          return over ? { reply: replies, next: "menu" } : { reply: replies };
        },
      },
      {
        label: "Magic Attack",
        keywords: ["magic", "2"],
        tooltip: () => {
          const s = getPlayer().stats;
          return {
            title: "Magic Attack",
            subtitle: `Critical Hit Chance: ${Math.round((s.criticalHitChance || 0) * 100)}%`,
            description: `Damage: ${s.magicAttackMin} - ${s.magicAttackMax}`,
          };
        },
        onSelect: () => {
          if (!getEnemy()) return { next: "menu" };
          const { replies, over } = attackRound("magic");
          return over ? { reply: replies, next: "menu" } : { reply: replies };
        },
      },
      {
        label: "Defend",
        keywords: ["defend", "3"],
        tooltip: {
          title: "Defend",
          description:
            "Brace yourself, taking half damage from the next attack.",
          footer: "Takes your turn",
        },
        onSelect: () => {
          if (!getEnemy()) return { next: "menu" };
          const { replies, over } = defendRound();
          return over ? { reply: replies, next: "menu" } : { reply: replies };
        },
      },
      {
        label: "Use Item",
        keywords: ["item", "4"],
        tooltip: {
          title: "Use Item",
          description: "Use a consumable such as a potion.",
          footer: "Takes your turn",
        },
        onSelect: () => {
          if (!getEnemy()) return { next: "menu" };
          return { next: "combatItems", keepLog: true };
        },
      },
      {
        label: "Skills",
        keywords: ["skills", "5"],
        tooltip: {
          title: "Skills",
          description: "Use one of your equipped skills. Costs power.",
          footer: "Takes your turn",
        },
        onSelect: () => {
          if (!getEnemy()) return { next: "menu" };
          return { next: "combatSkills", keepLog: true };
        },
      },
      {
        label: "Pass",
        keywords: ["pass", "6"],
        tooltip: {
          title: "Pass",
          description:
            "Skip your turn. While stunned, this is your only action.",
          footer: "Takes your turn",
        },
        onSelect: () => {
          if (!getEnemy()) return { next: "menu" };
          const { replies, over } = passRound();
          return over ? { reply: replies, next: "menu" } : { reply: replies };
        },
      },
    ].map((o) =>
      o.label === "Pass" ? o : { ...o, when: () => !isPlayerStunned() },
    ),
  },
  combatSkills: {
    screen: "combat",
    input: INPUT_MODES[0],
    text: "Choose a skill to use.",
    screenData: () => ({
      enemy: getEnemy(),
      stats: getPlayer()?.stats,
      defending: isPlayerDefending(),
      playerStatuses: getPlayerStatuses(),
    }),
    get options() {
      const player = getPlayer();
      return [
        {
          label: "Back",
          keywords: ["back", "1"],
          onSelect: () => ({ next: "combat", keepLog: true }),
        },
        ...getEquippedSkills(player).map((key) => ({
          label: SKILLS[key].name,
          keywords: [SKILLS[key].name.toLowerCase()],
          tooltip: () =>
            skillTooltip(
              key,
              getSkillLevel(getPlayer(), key),
              "Takes your turn",
            ),
          onSelect: () => {
            if (!getEnemy()) return { next: "menu" };
            const { replies, over, used } = attackRound(null, key);
            if (!used) return { reply: replies };
            return over
              ? { reply: replies, next: "menu" }
              : { reply: replies, next: "combat", keepLog: true };
          },
        })),
      ];
    },
  },
  combatItems: {
    screen: "combat",
    input: INPUT_MODES[0],
    text: "Choose an item to use.",
    screenData: () => ({
      enemy: getEnemy(),
      stats: getPlayer()?.stats,
      defending: isPlayerDefending(),
      playerStatuses: getPlayerStatuses(),
    }),
    get options() {
      return [
        {
          label: "Back",
          keywords: ["back", "1"],
          onSelect: () => ({ next: "combat", keepLog: true }),
        },
        ...getConsumables().filter((c) => c.heal || c.power).map((c) => ({
          label: `${c.name} x${c.count}`,
          keywords: [c.name.toLowerCase()],
          tooltip: () => consumableTooltip(c.key, "Takes your turn"),
          onSelect: () => {
            if (!getEnemy()) return { next: "menu" };
            const { replies, over, used } = consumeItemRound(c.key);
            if (!used) return { reply: replies };
            return over
              ? { reply: replies, next: "menu" }
              : { reply: replies, next: "combat", keepLog: true };
          },
        })),
      ];
    },
  },
};

// Scene text may be a string or a function evaluated when the scene is shown.
const sceneText = (id) => {
  const t = scenes[id].text;
  return typeof t === "function" ? t() : t;
};

export const getVisibleOptions = (scene) =>
  (scene.options || []).filter((o) => !o.hidden && (!o.when || o.when()));

export const initialMessages = (sceneId = "start") => [
  { sender: "game", text: sceneText(sceneId) },
];

// Shared navigation: applies a handler result ({ next, reply, clearLog }) and builds the replies.
// The returned `clearLog` is true when the handler asked for it or the destination scene has `clearLog: true`.
function navigate(sceneId, result, fallbackNext) {
  const replies = [].concat(result.reply || []);
  const keepLog = !!result.keepLog;
  const clearLog = !!result.clearLog;
  // `options` in a result builds a temporary scene so any handler can ask a follow-up question.
  if (result.options && result.options.length) {
    const input = result.input || INPUT_MODES[0];
    scenes[DYNAMIC_SCENE] = {
      input,
      match: INPUT_MATCHING[0],
      text: replies[replies.length - 1] || "What do you do?",
      options: result.options,
    };
    if (replies.length === 0) replies.push(scenes[DYNAMIC_SCENE].text);
    return { sceneId: DYNAMIC_SCENE, replies, clearLog };
  }
  let next = result.next || fallbackNext;
  // Inside a dungeon the town menu is locked, so every road back leads to the dungeon
  if (next === "menu" && isLabyrinthActive()) next = "labyrinth";
  else if (next === "menu" && isInDungeon()) next = "dungeon";
  if (next && scenes[next]) {
    // keepLog moves between scenes of one screen (e.g. combat menus) without wiping or repeating the log
    if (!keepLog) replies.push(sceneText(next));
    return {
      sceneId: next,
      replies,
      clearLog: keepLog ? false : clearLog || !!scenes[next].clearLog,
    };
  }
  // Stay in the current scene; re-show its text if there was no custom reply.
  if (replies.length === 0) replies.push(sceneText(sceneId));
  return { sceneId, replies, clearLog };
}

// Runs a chosen option and returns { sceneId, replies: string[] }.
export function selectOption(sceneId, option, input = "") {
  const scene = scenes[sceneId];
  const result =
    (option.onSelect &&
      option.onSelect({
        player: getPlayer() || {},
        setPlayer,
        option,
        scene,
        input,
      })) ||
    {};
  return navigate(sceneId, result, option.next);
}

/*
 Form scenes (input: "form") collect many values at once:
   form: {
     fields: [{ key, label, type?: "number" | "text" | "select", min?, max?, step?,
                default?, options?: [..] (select), required?, maxLength?, pooled?: boolean }],
     pool?: { total, label }   - number fields with pooled !== false share `total` points,
                                 counted as (value - min) summed across them
     submitLabel?: string,
     onSubmit: (values, ctx) => { next, reply }   - ctx like onSelect
   }
*/
const fieldMin = (f) => f.min ?? 0;
const isPooled = (form, f) =>
  !!form.pool && (f.type || "number") === "number" && f.pooled !== false;

export const getFormDefaults = (form) =>
  Object.fromEntries(
    form.fields.map((f) => [
      f.key,
      f.default ??
        ((f.type || "number") === "number"
          ? fieldMin(f)
          : f.type === "select"
            ? f.options[0]
            : ""),
    ]),
  );

export const getPointsSpent = (form, values) =>
  form.fields
    .filter((f) => isPooled(form, f))
    .reduce((sum, f) => sum + (Number(values[f.key]) - fieldMin(f)), 0);

export const getPointsRemaining = (form, values) =>
  form.pool ? form.pool.total - getPointsSpent(form, values) : 0;

// Returns an error message, or null if the values are valid.
export function validateForm(form, values, sceneId) {
  for (const f of form.fields) {
    const v = values[f.key];
    const type = f.type || "number";
    if (type === "number") {
      const n = Number(v);
      if (v === "" || !Number.isInteger(n))
        return `${f.label} must be a whole number.`;
      if (n < fieldMin(f)) return `${f.label} must be at least ${fieldMin(f)}.`;
      if (f.max !== undefined && n > f.max)
        return `${f.label} can't be more than ${f.max}.`;
    } else if (type === "select") {
      if (!f.options.includes(v)) return `Choose a valid ${f.label}.`;
    } else if ((f.required || f.required === undefined) && !String(v).trim()) {
      return `${f.label} is required.`;
    }
  }
  if (sceneId === "createCharacter") return null;
  if (form.pool) {
    const left = getPointsRemaining(form, values);
    if (left < 0)
      return `You've used ${-left} too many ${form.pool.label.toLowerCase()}.`;
    if (left > 0)
      return `You still have ${left} ${form.pool.label.toLowerCase()} to spend.`;
  }
  return null;
}

// Validates and submits a form. Returns { sceneId, replies, summary?, error? }.
export function processForm(sceneId, values) {
  const scene = scenes[sceneId];
  const form = scene.form;
  const error = validateForm(form, values, sceneId);
  if (error) return { sceneId, replies: [error], error: true };
  const clean = Object.fromEntries(
    form.fields.map((f) => [
      f.key,
      (f.type || "number") === "number"
        ? Number(values[f.key])
        : String(values[f.key]).trim(),
    ]),
  );
  const summary = form.fields
    .map((f) => `${f.label}: ${clean[f.key]}`)
    .join(", ");
  const result =
    (form.onSubmit &&
      form.onSubmit(clean, { player: getPlayer() || {}, setPlayer, scene })) ||
    {};
  return { ...navigate(sceneId, result, form.next), summary };
}

// Button presses go straight to the option that was clicked.
export function processButton(sceneId, label) {
  const expired = expireIfNeeded();
  if (expired) return { sceneId: "menu", replies: [expired, sceneText("menu")], clearLog: true };
  const option = getVisibleOptions(scenes[sceneId]).find(
    (o) => o.label === label,
  );
  if (!option) return { sceneId, replies: [`Unknown choice "${label}".`] };
  return selectOption(sceneId, option);
}

// Reads typed input and decides the next scene. Returns { sceneId, replies }.
export function processInput(sceneId, input) {
  const expired = expireIfNeeded();
  if (expired) return { sceneId: "menu", replies: [expired, sceneText("menu")], clearLog: true };
  const scene = scenes[sceneId];
  // "d100" is read as "d 100" so shorthand works without a space
  const text = input
    .trim()
    .toLowerCase()
    .replace(/([a-z])(\d)/g, "$1 $2");
  if (scene.match === INPUT_MATCHING[0]) {
    const match = (scene.options || [])
      .filter((o) => !o.when || o.when())
      .find((o) =>
        (o.keywords || []).some(
          (k) => text === k || text.split(/\s+/).includes(k),
        ),
      );
    if (!match) {
      return {
        sceneId,
        replies: [
          `I don't understand "${input.trim()}". Try: ${getVisibleOptions(scene)
            .map((o) => o.label)
            .join(", ")}.`,
        ],
      };
    }
    return selectOption(sceneId, match, text);
  } else {
    // Make sure the input is valid
    switch (scene.filter) {
      case INPUT_TYPE[0]: // numbers
        if (!/^\d+$/.test(text)) {
          return { sceneId, replies: ["Please enter numbers only."] };
        }
        break;
      case INPUT_TYPE[1]: // letters
        if (!/^[a-zA-Z]+$/.test(text)) {
          return { sceneId, replies: ["Please enter letters only."] };
        }
        break;
      case INPUT_TYPE[2]: // both
        if (!/^[a-zA-Z0-9]+$/.test(text)) {
          return {
            sceneId,
            replies: ["Please enter letters or numbers only."],
          };
        }
        break;
      default:
        break;
    }
  }
  if (sceneId === "start") {
    return savePlayerName(input).then((result) =>
      result.ok
        ? navigate(sceneId, { next: getPlayer()?.stats ? "menu" : "createCharacter", reply: result.message })
        : { sceneId, replies: [result.message] },
    );
  }
  return selectOption(sceneId, scene.options[0], input.trim());
}
