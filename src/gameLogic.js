import { Player, getPlayer, setPlayer } from "./player";
import { runTravelEvent } from "./events";
import { attackRound, getEnemy } from "./combat";

// Crafting recipes shown on the crafting screen. `apply` mutates a copy of the player's stats.
const RECIPES = [
  { name: "Iron Dagger", cost: 10, description: "+1 maximum attack.", apply: (s) => { s.attackMax += 1; } },
  { name: "Padded Vest", cost: 15, description: "+1 defense.", apply: (s) => { s.defense += 1; } },
];

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
   screen: "adventure" (default) | "combat" | "crafting" | any key of SCREENS in screens.js
   screenData: () => object   - optional live data passed to that screen
   clearLog: true             - optional; clears the log whenever the player enters this scene
*/
export const scenes = {
  start: {
    input: INPUT_MODES[1],
    match: INPUT_MATCHING[1],
    filter: INPUT_TYPE[1],
    text: "Welcome to Astral Odyssey 2, what is your name traveler?",
    options: [
      { label: "", keywords: [], next: "createCharacter" },
    ],
  },
  createCharacter: {
    input: INPUT_MODES[3],
    clearLog: true,
    text: () => `Where do you excel most at, ${getPlayer().name}?` +
    `\n{{Strength|strength}} {{Dexterity|dexterity}} {{Intelligence|intelligence}}`+
    `\nThese core stats define your overall class` +
    `\n{{Swordsman|swordsman}}`+
    `\n{{Tactician|tactician}}`+
    `\n{{Spellcaster|spellcaster}}`+
    `\n{{Duelist|duelist}}`+
    `\n{{Spellblade|spellblade}}`+
    `\n{{Trickster|trickster}}`+
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
        let playerClass;
        if (strength > dexterity && strength > intelligence) {
            playerClass = "Swordsman";
        } else if (dexterity > strength && dexterity > intelligence) {
            playerClass = "Tactician";
        } else if (intelligence > strength && intelligence > dexterity) {
            playerClass = "Spellcaster";
        } else if (strength === dexterity && strength > intelligence) {
            playerClass = "Duelist"; // Strength/Dexterity
        } else if (strength === intelligence && strength > dexterity) {
            playerClass = "Spellblade"; // Strength/Intelligence
        } else if (dexterity === intelligence && dexterity > strength) {
            playerClass = "Trickster"; // Dexterity/Intelligence
        } else if (strength === dexterity && strength === intelligence) {
            playerClass = "Specialist"; // Strength/Dexterity/Intelligence
        }

        let exp = 0;
        let expToLevel = 100;
        let vitality = 1 + Math.floor(strength / 2); // Every point increases max health by 10
        let resilience = 1; // Every point increases defense by 1
        let agility = 1 + Math.floor(dexterity / 2); // Every point increases speed by 3
        let luck = 1; // Every point increases critical hit chance by 1% and drop rates.
        let attackMin = 1;
        let attackMax = 5;
        let defense = resilience;
        let speed = (agility * 3);
        let criticalHitChance = 0.05 + (luck * 0.01);
        let criticalDamageBonus = 1.5;
        let maxHealth = 90 + (vitality * 10);
        let health = maxHealth;
        let maxStamina = 8 + Math.floor((vitality + agility) / 2); // The average between vitality, and agility
        let stamina = maxStamina;
        let maxPower = 5 + Math.floor(intelligence / 2);
        let power = maxPower;

        const derivedStats = {
          strength,
          dexterity,
          intelligence,
          exp,
          expToLevel,
          vitality,
          resilience,
          agility,
          luck,
          attackMin,
          attackMax,
          defense,
          speed,
          criticalHitChance,
          criticalDamageBonus,
          maxHealth,
          health,
          maxStamina,
          stamina,
          maxPower,
          power
        };

        setPlayer({ 
          level: 1,
          class: playerClass, 
          astra: 0,
          region: "Meadowlands", 
          stats: derivedStats,
        });
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
          return { title: "Travel", subtitle: `${p ? p.region : "Unknown"}`, description: "Venture out and face random events." };
        },
        keywords: ["travel", "2"],
        next: "travel"
      },
      {
        label: "Town",
        tooltip: () => {
          const p = getPlayer();
          return { title: "Town", description: "Visit the town to access various services." };
        },
        keywords: ["town", "3"],
        next: "town"
      }
    ]
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
        onSelect: ({ player, setPlayer }) => runTravelEvent({ player, setPlayer })
      }
    ]
  },
  town: {
    input: INPUT_MODES[2],
    clearLog: true,
    text: () => {
      const p = getPlayer();
      return `You have arrived in town.`;
    },
    options: [
      {
        label: "Leave",
        keywords: ["leave", "1"],
        next: "menu"
      },
      {
        label: "General Store",
        keywords: ["general store", "2"]
      },
      {
        label: "Lodging",
        keywords: ["lodging", "3"]
      },
      {
        label: "Blacksmith",
        keywords: ["blacksmith", "4"],
        next: "crafting"
      },
      {
        label: "Bank",
        keywords: ["bank", "5"]
      }
    ],
  },
  crafting: {
    screen: "crafting",
    clearLog: true,
    input: INPUT_MODES[0],
    text: "The blacksmith nods toward the forge. What would you like to craft?",
    screenData: () => ({ recipes: RECIPES, astra: getPlayer()?.astra || 0 }),
    options: [
      {
        label: "Leave forge",
        keywords: ["leave", "1"],
        next: "town"
      },
      ...RECIPES.map((r, i) => ({
        label: `Craft ${r.name}`,
        keywords: [r.name.toLowerCase(), String(i + 2)],
        tooltip: { title: r.name, description: r.description, stats: [{ label: "Cost", value: `${r.cost} astra` }] },
        onSelect: ({ player, setPlayer }) => {
          if ((player.astra || 0) < r.cost) return { reply: `You need ${r.cost} {{astra|astra}} to craft the ${r.name}.` };
          const stats = { ...player.stats };
          r.apply(stats);
          setPlayer({ astra: player.astra - r.cost, stats });
          return { reply: `The blacksmith hands you a ${r.name}. ${r.description}` };
        },
      })),
    ],
  },
  combat: {
    screen: "combat",
    clearLog: true,
    input: INPUT_MODES[0],
    text: () => (getEnemy() ? `A ${getEnemy().name} blocks your path!` : "There is nothing to fight."),
    screenData: () => ({ enemy: getEnemy(), stats: getPlayer()?.stats }),
    options: [
      {
        label: "Attack",
        keywords: ["attack", "1"],
        onSelect: () => {
          if (!getEnemy()) return { next: "menu" };
          const { replies, over } = attackRound();
          return over ? { reply: replies, next: "menu" } : { reply: replies };
        },
      },
    ],
  },
};

// Scene text may be a string or a function evaluated when the scene is shown.
const sceneText = (id) => {
  const t = scenes[id].text;
  return typeof t === "function" ? t() : t;
};

export const getVisibleOptions = (scene) =>
  (scene.options || []).filter((o) => !o.when || o.when());

export const initialMessages = () => [
  { sender: "game", text: sceneText("start") },
];

// Shared navigation: applies a handler result ({ next, reply, clearLog }) and builds the replies.
// The returned `clearLog` is true when the handler asked for it or the destination scene has `clearLog: true`.
function navigate(sceneId, result, fallbackNext) {
  const replies = [].concat(result.reply || []);
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
  const next = result.next || fallbackNext;
  if (next && scenes[next]) {
    replies.push(sceneText(next));
    return { sceneId: next, replies, clearLog: clearLog || !!scenes[next].clearLog };
  }
  // Stay in the current scene; re-show its text if there was no custom reply.
  if (replies.length === 0) replies.push(sceneText(sceneId));
  return { sceneId, replies, clearLog };
}

// Runs a chosen option and returns { sceneId, replies: string[] }.
export function selectOption(sceneId, option) {
  const scene = scenes[sceneId];
  const result =
    (option.onSelect &&
      option.onSelect({ player: getPlayer() || {}, setPlayer, option, scene })) ||
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
const fieldMin = (f) => (f.min ?? 0);
const isPooled = (form, f) =>
  !!form.pool && (f.type || "number") === "number" && f.pooled !== false;

export const getFormDefaults = (form) =>
  Object.fromEntries(
    form.fields.map((f) => [
      f.key,
      f.default ?? ((f.type || "number") === "number" ? fieldMin(f) : f.type === "select" ? f.options[0] : ""),
    ])
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
      if (v === "" || !Number.isInteger(n)) return `${f.label} must be a whole number.`;
      if (n < fieldMin(f)) return `${f.label} must be at least ${fieldMin(f)}.`;
      if (f.max !== undefined && n > f.max) return `${f.label} can't be more than ${f.max}.`;
    } else if (type === "select") {
      if (!f.options.includes(v)) return `Choose a valid ${f.label}.`;
    } else if ((f.required || f.required === undefined) && !String(v).trim()) {
      return `${f.label} is required.`;
    }
  }
  if (sceneId === "createCharacter") return null;
  if (form.pool) {
    const left = getPointsRemaining(form, values);
    if (left < 0) return `You've used ${-left} too many ${form.pool.label.toLowerCase()}.`;
    if (left > 0) return `You still have ${left} ${form.pool.label.toLowerCase()} to spend.`;
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
      (f.type || "number") === "number" ? Number(values[f.key]) : String(values[f.key]).trim(),
    ])
  );
  const summary = form.fields.map((f) => `${f.label}: ${clean[f.key]}`).join(", ");
  const result =
    (form.onSubmit && form.onSubmit(clean, { player: getPlayer() || {}, setPlayer, scene })) || {};
  return { ...navigate(sceneId, result, form.next), summary };
}

// Button presses go straight to the option that was clicked.
export function processButton(sceneId, label) {
  const option = getVisibleOptions(scenes[sceneId]).find((o) => o.label === label);
  if (!option) return { sceneId, replies: [`Unknown choice "${label}".`] };
  return selectOption(sceneId, option);
}

// Reads typed input and decides the next scene. Returns { sceneId, replies }.
export function processInput(sceneId, input) {
  const scene = scenes[sceneId];
  const text = input.trim().toLowerCase();
  if (scene.match === INPUT_MATCHING[0]) {
    const match = getVisibleOptions(scene).find((o) =>
      (o.keywords || []).some((k) => text === k || text.split(/\s+/).includes(k))
    );
    if (!match) {
      return {
        sceneId,
        replies: [`I don't understand "${input.trim()}". Try: ${getVisibleOptions(scene)
          .map((o) => o.label)
          .join(", ")}.`],
      };
    }
    return selectOption(sceneId, match);
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
          return { sceneId, replies: ["Please enter letters or numbers only."] };
        }
        break;
      default:
        break;
    }
  }
  if (sceneId === "start") {
    // Replace any existing player data with the new name
    localStorage.removeItem("Player");
    setPlayer({ name: input.trim() });
  }
  return selectOption(sceneId, scene.options[0]);
}
