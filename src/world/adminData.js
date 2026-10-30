import { get, ref, update } from "firebase/database";
import { auth, db } from "../firebase";
import { createDirectoryEntry, createPublicProfile } from "../character/profiles";

export const GAME_DATA_PATHS = [
  "contestPresence", "contest", "groupPresence", "groupMembership", "groupInvites",
  "friendRequests", "friends", "groupLfg", "groupParties", "leaderboardEntries",
  "worldBoss", "worldBossMail", "bugReports", "directory", "publicProfiles",
  "inbox", "marketplace", "broadcasts", "inboxState",
];

const readData = async () => {
  const uid = auth.currentUser?.uid;
  if (!uid || (await get(ref(db, `admins/${uid}`))).val() !== true)
    throw new Error("Admin access is required.");
  return (await get(ref(db))).val() || {};
};

const bumpRevision = (writes, accountId, account) => {
  const revision = account.saveRevision ?? 0;
  if (!Number.isSafeInteger(revision) || revision < 0 || !Number.isSafeInteger(revision + 1))
    throw new Error("The player's save revision is invalid.");
  writes[`users/${accountId}/saveRevision`] = revision + 1;
};

const resetCharacter = (writes, path, identity, player, ignoredTitles = []) => {
  if (!player) return;
  const fresh = {
    ...(player.name ? { name: player.name } : {}),
    ...(player.needsNameChange ? { needsNameChange: true } : {}),
    publicProfile: player.publicProfile !== false,
    level: 1,
    astra: 0,
    resetPending: true,
    ...(ignoredTitles.length ? { ignoredAccountWideTitles: ignoredTitles } : {}),
  };
  writes[path] = fresh;
  writes[`directory/${identity}`] = fresh.name ? createDirectoryEntry(fresh) : null;
  writes[`publicProfiles/${identity}`] = fresh.name && fresh.publicProfile
    ? createPublicProfile(fresh) : null;
};

export const resetPlayerData = async (identity, confirmation) => {
  if (typeof identity !== "string" || !identity || /[.#$[\]/]/.test(identity))
    throw new Error("Select a player.");
  const data = await readData();
  const owner = data.characterOwners?.[identity];
  const accountId = owner?.accountId || identity;
  const account = data.users?.[accountId];
  const character = owner ? account?.characters?.[owner.characterId] : null;
  const player = owner ? character?.player : account?.player;
  if (!player?.name || character?.deletedAt || (owner && character?.externalId !== identity))
    throw new Error("This character no longer exists. Reload the player list.");
  if (confirmation !== player.name)
    throw new Error("Type the character's exact name to confirm the reset.");

  const writes = {};
  bumpRevision(writes, accountId, account);
  resetCharacter(writes, owner
    ? `users/${accountId}/characters/${owner.characterId}/player`
    : `users/${accountId}/player`, identity, player, Object.keys(account.accountWideTitles || {}));
  if (!owner || account.legacyCharacterId === owner.characterId)
    writes[`users/${accountId}/legacyBackup`] = null;
  for (const path of ["inbox", "inboxState", "worldBossMail", "leaderboardEntries", "groupPresence", "contestPresence", "groupInvites", "groupMembership", "friends", "friendRequests"])
    writes[`${path}/${identity}`] = null;
  // Old broadcasts must not become claimable again after the reset.
  writes[`inboxState/${identity}`] = Object.fromEntries(
    Object.keys(data.broadcasts || {}).map((id) => [id, { read: true, claimed: true, deleted: true }]),
  );
  for (const [id, listing] of Object.entries(data.marketplace || {}))
    if (listing.sellerUid === identity) writes[`marketplace/${id}`] = null;
  for (const [id, report] of Object.entries(data.bugReports || {}))
    if (report.uid === identity) writes[`bugReports/${id}`] = null;
  for (const path of ["friends", "friendRequests"])
    for (const [other, entries] of Object.entries(data[path] || {}))
      if (other !== identity && entries[identity]) writes[`${path}/${other}/${identity}`] = null;
  for (const [cycle, state] of Object.entries(data.worldBoss?.cycles || {}))
    if (state.players?.[identity]) writes[`worldBoss/cycles/${cycle}/players/${identity}`] = null;
  writes[`worldBoss/titleAwards/${identity}`] = null;

  writes[`contest/entries/${identity}`] = null;
  for (const [id, match] of Object.entries(data.contest?.matches || {})) {
    if (match.host !== identity && match.guest !== identity) continue;
    writes[`contest/matches/${id}`] = null;
    for (const participant of [match.host, match.guest])
      if (data.contest.entries?.[participant]?.matchId === id)
        writes[`contest/entries/${participant}`] = null;
  }
  // Dissolve affected parties rather than leave a run holding a pre-reset fighter.
  for (const [id, party] of Object.entries(data.groupParties || {})) {
    if (party.leader !== identity && !party.members?.[identity]) continue;
    writes[`groupParties/${id}`] = null;
    writes[`groupLfg/${id}`] = null;
    for (const [member, partyId] of Object.entries(data.groupMembership || {}))
      if (member !== identity && partyId === id) writes[`groupMembership/${member}`] = null;
    for (const [recipient, invites] of Object.entries(data.groupInvites || {}))
      if (recipient !== identity && invites[id]) writes[`groupInvites/${recipient}/${id}`] = null;
  }
  await update(ref(db), writes);
};

export const resetServerData = async (confirmation) => {
  if (confirmation !== "RESET SERVER")
    throw new Error('Type "RESET SERVER" exactly to confirm the server reset.');
  const data = await readData();
  const writes = Object.fromEntries(GAME_DATA_PATHS
    .filter((path) => !["directory", "publicProfiles"].includes(path))
    .map((path) => [path, null]));
  const directory = {};
  const profiles = {};
  let count = 0;
  for (const [accountId, account] of Object.entries(data.users || {})) {
    bumpRevision(writes, accountId, account);
    writes[`users/${accountId}/legacyBackup`] = null;
    writes[`users/${accountId}/accountWideTitles`] = null;
    const characters = account.characters
      ? Object.entries(account.characters).filter(([, character]) => !character.deletedAt)
        .map(([id, character]) => ({
          path: `users/${accountId}/characters/${id}/player`,
          identity: character.externalId, player: character.player,
        }))
      : [{ path: `users/${accountId}/player`, identity: accountId, player: account.player }];
    for (const { path, identity, player } of characters) {
      if (!player) continue;
      if (!identity) throw new Error("A character's ownership record is missing. No data has been reset.");
      const characterWrites = {};
      resetCharacter(characterWrites, path, identity, player);
      writes[path] = characterWrites[path];
      if (characterWrites[`directory/${identity}`]) directory[identity] = characterWrites[`directory/${identity}`];
      if (characterWrites[`publicProfiles/${identity}`]) profiles[identity] = characterWrites[`publicProfiles/${identity}`];
      count += 1;
    }
  }
  writes.directory = directory;
  writes.publicProfiles = profiles;
  // Every account revision is checked by rules in this single atomic write.
  await update(ref(db), writes);
  return count;
};
