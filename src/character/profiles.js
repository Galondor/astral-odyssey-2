import { get, limitToFirst, orderByChild, query, ref, startAt, endAt } from "firebase/database";
import { db } from "../firebase";

export const createPublicProfile = (player) => ({
  isPublic: true,
  name: player.name,
  ...(player.activeTitle ? { activeTitle: player.activeTitle } : {}),
  level: player.level || 1,
  class: player.class || "Adventurer",
  gearScore: player.stats?.gearScore || 0,
  stats: player.stats || {},
  equipment: player.equipment || {},
  skills: player.skills || {},
  equippedSkills: player.equippedSkills || [],
  skillPoints: player.skillPoints || 0,
  crafted: player.crafted || {},
  keyItems: player.keyItems || [],
  astra: player.astra || 0,
  region: player.region || null,
  rep: player.rep || 0,
});

export const createDirectoryEntry = (player) => ({
  name: String(player.name),
  ...(player.activeTitle ? { activeTitle: player.activeTitle } : {}),
  searchName: String(player.name).toLowerCase(),
  level: player.level || 1,
  class: player.class || "Adventurer",
  gearScore: player.stats?.gearScore || 0,
  publicProfile: player.publicProfile !== false,
});

export const searchCharacters = async (input) => {
  const prefix = input.trim().toLowerCase();
  if (prefix.length < 2) return [];

  const snapshot = await get(query(
    ref(db, "directory"),
    orderByChild("searchName"),
    startAt(prefix),
    endAt(`${prefix}\uf8ff`),
    limitToFirst(15),
  ));
  return Object.entries(snapshot.val() || {}).map(([id, character]) => ({ id, ...character }));
};

export const loadPublicProfile = async (identity) => {
  const snapshot = await get(ref(db, `publicProfiles/${identity}`));
  const profile = snapshot.val();
  if (!profile?.isPublic) throw new Error("This character's profile is no longer public.");
  return profile;
};
