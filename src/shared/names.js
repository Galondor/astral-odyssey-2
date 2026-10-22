const BLOCKED_WORDS = new Set([
  "ass", "asshole", "bastard", "bitch", "bollocks", "cock", "cocksucker",
  "cunt", "dick", "dildo", "fag", "faggot", "fuck", "fucker", "fucking",
  "motherfucker", "nazi", "nigga", "nigger", "penis", "piss", "porn",
  "pussy", "rape", "rapist", "retard", "retarded", "sex", "shit",
  "slut", "twat", "vagina", "whore",
]);
const LEET_LETTERS = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", 8: "b" };

export function hasInappropriateName(name) {
  const normalized = name.toLowerCase()
    .replace(/[0134578]/g, (digit) => LEET_LETTERS[digit]);
  const words = normalized.split(/[^a-z]+/).filter(Boolean);
  const compact = words.join("");
  // Compact matching catches spaced-out words; distinctive roots also catch compounds.
  return words.some((word) => BLOCKED_WORDS.has(word))
    || BLOCKED_WORDS.has(compact)
    || /asshole|bitch|cocksucker|fuck|shit|nigg(?:er|a)|faggot/.test(compact);
}

export function validateItemName(name) {
  if (typeof name !== "string" || !/[a-zA-Z0-9]/.test(name) || !/^[a-zA-Z0-9 ]+$/.test(name))
    return "Item names must contain only letters, numbers, and spaces.";
  if (name.length > 64) return "Item names must be 64 characters or fewer.";
  if (hasInappropriateName(name)) return "Please choose an appropriate name.";
  return null;
}
