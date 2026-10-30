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

const mask = (text) => text.replace(/[a-zA-Z0-9]/g, "*");

/*
 Masks chat words that the character name filter would reject. Runs of single characters
 ("f u c k", "f.u.c.k") are checked together so spacing a word out doesn't slip past.
*/
export function filterChatText(text) {
  const tokens = String(text ?? "").split(/(\s+)/);
  const words = tokens.map((token, index) => ({ token, index })).filter(({ token }) => token && !/^\s+$/.test(token));
  const flagged = new Set(words.filter(({ token }) => hasInappropriateName(token)).map(({ index }) => index));
  const single = (token) => token.replace(/[^a-zA-Z0-9]/g, "").length <= 1;
  for (let start = 0; start < words.length; start += 1) {
    if (!single(words[start].token)) continue;
    let end = start;
    while (end + 1 < words.length && single(words[end + 1].token)) end += 1;
    if (end > start && hasInappropriateName(words.slice(start, end + 1).map(({ token }) => token).join("")))
      for (let i = start; i <= end; i += 1) flagged.add(words[i].index);
    start = end;
  }
  return tokens.map((token, index) => (flagged.has(index) ? mask(token) : token)).join("");
}

export function validateItemName(name) {
  if (typeof name !== "string" || !/[a-zA-Z0-9]/.test(name) || !/^[a-zA-Z0-9 ]+$/.test(name))
    return "Item names must contain only letters, numbers, and spaces.";
  if (name.length > 64) return "Item names must be 64 characters or fewer.";
  if (hasInappropriateName(name)) return "Please choose an appropriate name.";
  return null;
}
