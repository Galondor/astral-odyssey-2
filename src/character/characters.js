import { equalTo, get, orderByChild, query, ref, runTransaction, update } from "firebase/database";
import { db } from "../firebase";

export const DEFAULT_CHARACTER_LIMIT = 3;

const numericId = () => Array.from(crypto.getRandomValues(new Uint32Array(4)))
  .map((part) => String(part).padStart(10, "0")).join("");

const reserveIdentity = async (accountId, characterId, identity = characterId) => {
  const result = await runTransaction(ref(db, `characterOwners/${identity}`), (owner) =>
    owner === null ? { accountId, characterId } : undefined,
  { applyLocally: false });
  const owner = result.snapshot.val();
  if (owner?.accountId !== accountId) throw new Error("Character identity is already in use. Please try again.");
  return owner.characterId;
};

const reserveCharacterId = async (accountId) => {
  const characterId = numericId();
  await reserveIdentity(accountId, characterId);
  return characterId;
};

const reserveSlot = async (accountId, index, characterId, previousId) => {
  const result = await runTransaction(ref(db, `characterSlots/${accountId}/${index}`), (slot) =>
    slot === null || (previousId && slot.characterId === previousId) ? { characterId, index } : undefined,
  { applyLocally: false });
  return result.snapshot.val()?.characterId === characterId;
};

const readLegacyCache = (accountId, account) => {
  try {
    const meta = JSON.parse(localStorage.getItem("PlayerMeta")) || {};
    const player = JSON.parse(localStorage.getItem("Player"));
    if (!meta.characterId && !meta.unsafe && player &&
        ((!meta.uid && !account.player && !account.saveRevision) ||
         (meta.uid === accountId && meta.dirty &&
          ((meta.revision != null && meta.revision === (account.saveRevision || 0)) ||
           (meta.revision == null && !account.player && !account.saveRevision))))) {
      return player;
    }
  } catch (error) {
    console.warn("Couldn't read the legacy character recovery buffer", error);
  }
  return null;
};

// The legacy service identity stays attached to the original character, preserving
// name reservations, pending marketplace sales, mail, claims, and leaderboard entries.
export const loadCharacters = async (accountId) => {
  let account = (await get(ref(db, `users/${accountId}`))).val() || {};
  const cached = !account.characters && readLegacyCache(accountId, account);
  if (!account.characters && (account.player || cached)) {
    const characterId = await reserveIdentity(accountId, numericId(), accountId);
    if (!await reserveSlot(accountId, 0, characterId))
      throw new Error("Couldn't reserve the original character's slot. Your existing save has not been changed.");
    const result = await runTransaction(ref(db, `users/${accountId}`), (current) => {
      // Firebase may first invoke a transaction with an empty local cache.
      current ||= account;
      if (current.characters) return undefined;
      const recovered = readLegacyCache(accountId, current);
      if (!current.player && !recovered) return undefined;
      return {
        ...current,
        player: null,
        legacyBackup: current.player || recovered,
        legacyCharacterId: characterId,
        saveRevision: (current.saveRevision || 0) + 1,
        characters: {
          [characterId]: { externalId: accountId, slot: 0, createdAt: Date.now(), player: recovered || current.player },
        },
      };
    }, { applyLocally: false });
    account = result.snapshot.val() || {};
    if (!account.characters) throw new Error("Couldn't migrate your existing character. Your original save was not removed.");
  }
  const limit = (await get(ref(db, `characterLimits/${accountId}`))).val() ?? DEFAULT_CHARACTER_LIMIT;
  return {
    characters: Object.entries(account.characters || {}).filter(([, slot]) => !slot.deletedAt).map(([id, slot]) => ({ id, ...slot })),
    limit,
  };
};

export const createCharacter = async (accountId) => {
  const limit = (await get(ref(db, `characterLimits/${accountId}`))).val() ?? DEFAULT_CHARACTER_LIMIT;
  const account = (await get(ref(db, `users/${accountId}`))).val() || {};
  if (account.player) throw new Error("Reload the menu to import your existing character before creating another.");
  let characterId;
  let slotIndex;
  for (let index = 0; index < limit; index++) {
    const reserved = (await get(ref(db, `characterSlots/${accountId}/${index}`))).val();
    const previous = reserved && account.characters?.[reserved.characterId];
    if (previous && !previous.deletedAt) continue;
    const candidate = reserved && !previous?.deletedAt ? reserved.characterId : await reserveCharacterId(accountId);
    if ((reserved && !previous?.deletedAt) || await reserveSlot(accountId, index, candidate, previous?.deletedAt ? reserved.characterId : null)) {
      characterId = candidate;
      slotIndex = index;
      break;
    }
  }
  if (!characterId) throw new Error(`You can create up to ${limit} characters.`);
  const result = await runTransaction(ref(db, `users/${accountId}`), (current) => {
    current ||= {};
    if (current.characters?.[characterId]) return undefined;
    if (current.player || Object.values(current.characters || {}).filter((slot) => !slot.deletedAt).length >= limit) return undefined;
    return {
      ...current,
      saveRevision: (current.saveRevision || 0) + 1,
      characters: {
        ...current.characters,
        [characterId]: { externalId: characterId, slot: slotIndex, createdAt: Date.now() },
      },
    };
  }, { applyLocally: false });
  if (!result.committed && !result.snapshot.val()?.characters?.[characterId])
    throw new Error(`You can create up to ${limit} characters. Refresh the menu to see your characters.`);
  return characterId;
};

export const deleteCharacter = async (accountId, characterId, confirmation) => {
  const account = (await get(ref(db, `users/${accountId}`))).val() || {};
  const character = account.characters?.[characterId];
  if (!character || character.deletedAt) throw new Error("This character no longer exists. Reload the menu.");
  const name = character.player?.name || "New adventurer";
  if (confirmation !== name) throw new Error("Type the character's exact name to confirm deletion.");
  const identity = character.externalId;
  const [listings, reservedName] = await Promise.all([
    get(query(ref(db, "marketplace"), orderByChild("sellerUid"), equalTo(identity))),
    character.player?.name ? get(ref(db, `characterNames/${character.player.name}`)) : Promise.resolve(null),
  ]);
  // Retain only an identity tombstone so stale tabs cannot revive the save and
  // a replacement character never inherits its mail, claims, or marketplace links.
  const writes = {
    [`users/${accountId}/characters/${characterId}`]: {
      externalId: identity, slot: character.slot, createdAt: character.createdAt, deletedAt: Date.now(),
    },
    [`users/${accountId}/saveRevision`]: (account.saveRevision || 0) + 1,
    [`users/${accountId}/lastCharacterIdentity`]: identity,
    [`directory/${identity}`]: null,
    [`publicProfiles/${identity}`]: null,
    [`leaderboardEntries/${identity}`]: null,
    [`inbox/${identity}`]: null,
    [`inboxState/${identity}`]: null,
  };
  if (reservedName?.val() === identity) writes[`characterNames/${character.player.name}`] = null;
  for (const listingId of Object.keys(listings.val() || {})) writes[`marketplace/${listingId}`] = null;
  if (account.legacyCharacterId === characterId) {
    writes[`users/${accountId}/legacyBackup`] = null;
    writes[`users/${accountId}/legacyCharacterId`] = null;
  }
  await update(ref(db), writes);
};
