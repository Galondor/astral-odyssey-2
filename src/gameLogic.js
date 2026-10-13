import { Player, getPlayer, setPlayer } from "./player";

export const INPUT_MODES = ["buttons", "text", "both", "form"];
export const INPUT_MATCHING = ["strict", "open"];
export const INPUT_TYPE = ["numbers", "letters", "both"];
export const getInputMode = (scene) => scene.input || INPUT_MODES[0];

/*
 Option fields (buttons and strict text answers):
   label, keywords, next      - basic navigation to scene `next`
   when: () => boolean        - optional; hide the button/answer when false
   onSelect: (ctx) => result  - optional; runs when chosen. ctx = { player, setPlayer, option, scene }
       result (all optional): { next: "sceneId", reply: string | string[] }
       `next` overrides option.next; `reply` messages show before the next scene's text.
       Returning nothing falls back to option.next; with no next the scene stays.
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
    text: () => `What do you excel at, ${getPlayer().name}?`,
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
        } else if (strength == dexterity && strength > intelligence) {
            playerClass = "Duelist"; // Strength/Dexterity
        } else if (strength == intelligence && strength > dexterity) {
            playerClass = "Spellblade"; // Strength/Intelligence
        } else if (dexterity == intelligence && dexterity > strength) {
            playerClass = "Trickster"; // Dexterity/Intelligence
        } else if (strength == dexterity && strength == intelligence) {
            playerClass = "Specialist"; // Strength/Dexterity/Intelligence
        }

        setPlayer({ class: playerClass, astra: 0, stats: values });
        return { reply: `Ah, you're a ${playerClass}.`, next: "town" };
      },
    },
  },
  town: {
    input: INPUT_MODES[2],
    text: () => {
      const p = getPlayer();
      return `You have arrived in town.`;
    },
    options: [
      {
        label: "Leave",
        keywords: ["leave", "1"]
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
        keywords: ["blacksmith", "4"]
      },
      {
        label: "Bank",
        keywords: ["bank", "5"]
      }
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

// Shared navigation: applies a handler result ({ next, reply }) and builds the replies.
function navigate(sceneId, result, fallbackNext) {
  const next = result.next || fallbackNext;
  const replies = [].concat(result.reply || []);
  if (next && scenes[next]) {
    replies.push(sceneText(next));
    return { sceneId: next, replies };
  }
  // Stay in the current scene; re-show its text if there was no custom reply.
  if (replies.length === 0) replies.push(sceneText(sceneId));
  return { sceneId, replies };
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
export function validateForm(form, values) {
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
  const error = validateForm(form, values);
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
