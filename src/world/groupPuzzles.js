/*
 Co-op puzzles for group dungeon stage 2. Pure JSON state; the party leader resolves one round at a time.
 Every member submits an intent each round; dials and rings are split between members, so nobody can solve them alone
 in a full party.
   stations  The bosun calls an order naming 1-3 stations. Exactly those stations must be manned this round
             (one member each is enough; anyone on another station fouls the lines). 5 orders to win, 3 strikes to fail.
             Intent { type: "station", key }.
   dials     Three dials (0-5). Each member reads a different clue about pairs of dials, so the party must share
             them in chat. Members set the dials they control; all three must be right in the same round.
             Intent { type: "dial", values: { [dialIndex]: n } }. 6 attempts.
   rings     Three star rings (0-7 notches off). Turning a ring also drags the next ring by the same amount, so
             everyone's turns interact. All rings must sit at 0 at the end of a round.
             Intent { type: "ring", turns: { [ringIndex]: n } }. 6 rounds before the bridge collapses.
*/

export const PUZZLE_ROUND_MS = 60 * 1000;
export const STATIONS = {
  capstan: "Capstan",
  cannon: "Cannon Deck",
  pump: "Bilge Pump",
};
const STATION_KEYS = Object.keys(STATIONS);
const ORDER_TEXT = {
  capstan: "heave the capstan",
  cannon: "run out the cannons",
  pump: "man the bilge pump",
};
const STATION_GOAL = 5;
const STATION_STRIKES = 3;
const DIAL_MAX = 5;
const DIAL_ATTEMPTS = 6;
const RING_NOTCHES = 8;
const RING_ROUNDS = 6;
export const DIAL_NAMES = ["I", "II", "III"];
export const RING_NAMES = ["Ring of Dawn", "Ring of Dusk", "Ring of Night"];

const rnd = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const shuffle = (list) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const mod = (n, m) => ((n % m) + m) % m;
const listText = (parts) =>
  parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

const makeOrder = (size) => {
  const need = shuffle(STATION_KEYS).slice(0, rnd(1, Math.min(3, size))).sort();
  const text = `"${listText(need.map((key) => ORDER_TEXT[key]))}!"`;
  return { need, text: text.charAt(0) + text.charAt(1).toUpperCase() + text.slice(2) };
};

// Which dial/ring indices a member controls: index i belongs to members[i % members.length].
export const puzzleControls = (members, id) =>
  [0, 1, 2].filter((index) => members[index % members.length] === id);

// Which clue lines a member can read (dials only).
export const puzzleClues = (puzzle, members, id) =>
  puzzle.kind === "dials" ? puzzle.clues.filter((_, index) => members[index % members.length] === id) : [];

export function createPuzzle(kind, members) {
  if (kind === "stations")
    return { kind, step: 0, goal: STATION_GOAL, strikes: 0, maxStrikes: STATION_STRIKES, order: makeOrder(members.length), last: null };
  if (kind === "dials") {
    const solution = [rnd(0, DIAL_MAX), rnd(0, DIAL_MAX), rnd(0, DIAL_MAX)];
    const [a, b, c] = solution;
    return {
      kind,
      solution,
      values: [0, 0, 0],
      clues: shuffle([
        `Dial I + Dial II = ${a + b}`,
        `Dial II + Dial III = ${b + c}`,
        `Dial I + Dial III = ${a + c}`,
      ]),
      attempts: 0,
      maxAttempts: DIAL_ATTEMPTS,
      last: null,
    };
  }
  if (kind === "rings") {
    let offsets = [0, 0, 0];
    while (offsets.every((o) => o === 0)) {
      const turns = [rnd(0, RING_NOTCHES - 1), rnd(0, RING_NOTCHES - 1), rnd(0, RING_NOTCHES - 1)];
      offsets = turns.map((_, j) => mod(-(turns[j] + turns[(j + 2) % 3]), RING_NOTCHES));
    }
    return { kind, offsets, round: 0, maxRounds: RING_ROUNDS, notches: RING_NOTCHES, last: null };
  }
  throw new Error(`Unknown puzzle ${kind}`);
}

/*
 Resolves one puzzle round. `members` is the ordered list of member ids still in the run, `names` maps id -> name.
 Returns { puzzle, log, outcome } with outcome "solved", "failed" or null. Mutates and returns the puzzle.
*/
export function resolvePuzzle(puzzle, intents, members, names = {}) {
  const log = [];
  const name = (id) => names[id] || "Someone";
  if (puzzle.kind === "stations") {
    const manned = {};
    for (const id of members) {
      const key = intents?.[id]?.type === "station" ? intents[id].key : null;
      if (STATIONS[key]) {
        manned[key] = [...(manned[key] || []), id];
        log.push(`${name(id)} mans the ${STATIONS[key]}.`);
      } else log.push(`${name(id)} stands back.`);
    }
    const missing = puzzle.order.need.filter((key) => !manned[key]);
    const stray = Object.keys(manned).filter((key) => !puzzle.order.need.includes(key));
    if (!missing.length && !stray.length) {
      puzzle.step += 1;
      puzzle.last = "success";
      log.push(`[gold]The bosun nods. "Aye, that's the way!" (${puzzle.step}/${puzzle.goal})[/gold]`);
      if (puzzle.step >= puzzle.goal) {
        log.push("[gold]The jammed winch groans free and the gate rises![/gold]");
        return { puzzle, log, outcome: "solved" };
      }
    } else {
      puzzle.strikes += 1;
      puzzle.last = "strike";
      if (missing.length) log.push(`[red]Nobody manned the ${listText(missing.map((key) => STATIONS[key]))}![/red]`);
      if (stray.length) log.push(`[red]Stray hands at the ${listText(stray.map((key) => STATIONS[key]))} foul the lines![/red]`);
      log.push(`[red]The ship lurches. (Strike ${puzzle.strikes}/${puzzle.maxStrikes})[/red]`);
      if (puzzle.strikes >= puzzle.maxStrikes) {
        log.push("[red]The capstan snaps its pawl and the gate slams shut![/red]");
        return { puzzle, log, outcome: "failed" };
      }
    }
    puzzle.order = makeOrder(members.length);
    log.push(`The bosun bellows: ${puzzle.order.text}`);
    return { puzzle, log, outcome: null };
  }

  if (puzzle.kind === "dials") {
    for (const id of members) {
      const intent = intents?.[id];
      if (intent?.type !== "dial") continue;
      for (const index of puzzleControls(members, id)) {
        const value = Number(intent.values?.[index]);
        if (Number.isInteger(value) && value >= 0 && value <= DIAL_MAX) puzzle.values[index] = value;
      }
      log.push(`${name(id)} turns ${puzzleControls(members, id).map((i) => `Dial ${DIAL_NAMES[i]}`).join(" and ")}.`);
    }
    const correct = puzzle.values.filter((value, index) => value === puzzle.solution[index]).length;
    if (correct === 3) {
      puzzle.last = "success";
      log.push("[gold]Every dial clicks into place. The Synchron Lock releases![/gold]");
      return { puzzle, log, outcome: "solved" };
    }
    puzzle.attempts += 1;
    puzzle.last = correct;
    log.push(`[red]The lock buzzes. ${correct} of 3 dials are correct. (Attempt ${puzzle.attempts}/${puzzle.maxAttempts})[/red]`);
    if (puzzle.attempts >= puzzle.maxAttempts) {
      log.push("[red]The lock seizes and the floor drops away beneath you![/red]");
      return { puzzle, log, outcome: "failed" };
    }
    return { puzzle, log, outcome: null };
  }

  if (puzzle.kind === "rings") {
    const turns = [0, 0, 0];
    for (const id of members) {
      const intent = intents?.[id];
      if (intent?.type !== "ring") continue;
      for (const index of puzzleControls(members, id)) {
        const value = Number(intent.turns?.[index]);
        if (Number.isInteger(value) && value > 0 && value < puzzle.notches) {
          turns[index] = value;
          log.push(`${name(id)} turns the ${RING_NAMES[index]} ${value} notch${value === 1 ? "" : "es"}.`);
        }
      }
    }
    puzzle.offsets = puzzle.offsets.map((offset, j) => mod(offset + turns[j] + turns[(j + 2) % 3], puzzle.notches));
    puzzle.round += 1;
    if (puzzle.offsets.every((offset) => offset === 0)) {
      puzzle.last = "success";
      log.push("[gold]The constellation aligns! A bridge of starlight spans the abyss.[/gold]");
      return { puzzle, log, outcome: "solved" };
    }
    puzzle.last = "drift";
    log.push(`[red]The stars are still out of line. The bridge crumbles further. (${puzzle.round}/${puzzle.maxRounds})[/red]`);
    if (puzzle.round >= puzzle.maxRounds) {
      log.push("[red]The bridge collapses into the void![/red]");
      return { puzzle, log, outcome: "failed" };
    }
    return { puzzle, log, outcome: null };
  }
  return { puzzle, log, outcome: null };
}
