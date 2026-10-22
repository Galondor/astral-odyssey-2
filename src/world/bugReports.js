import { onValue, push, ref, set, update } from "firebase/database";
import { auth, db } from "../firebase";
import { getPlayer } from "../character/player";

export const MAX_BUG_TITLE_LENGTH = 100;
export const MAX_BUG_DESCRIPTION_LENGTH = 2000;

export async function submitBugReport({ title, description }) {
  const cleanTitle = String(title || "").trim();
  const cleanDescription = String(description || "").trim();
  if (!cleanTitle || cleanTitle.length > MAX_BUG_TITLE_LENGTH)
    throw new Error(`Enter a title of 1-${MAX_BUG_TITLE_LENGTH} characters.`);
  if (!cleanDescription || cleanDescription.length > MAX_BUG_DESCRIPTION_LENGTH)
    throw new Error(`Enter a description of 1-${MAX_BUG_DESCRIPTION_LENGTH} characters.`);

  const uid = auth.currentUser?.uid;
  const player = getPlayer();
  if (!uid || !player) throw new Error("Sign in and create a character before reporting a bug.");

  const report = {
    uid,
    playerName: String(player.name || "Unknown"),
    title: cleanTitle,
    description: cleanDescription,
    createdAt: Date.now(),
    status: "open",
  };
  await set(push(ref(db, "bugReports")), report);
}

export const subscribeBugReports = (onReports, onError) =>
  onValue(
    ref(db, "bugReports"),
    (snapshot) => {
      const reports = Object.entries(snapshot.val() || {})
        .map(([id, report]) => ({ id, ...report }))
        .sort((a, b) => b.createdAt - a.createdAt);
      onReports(reports);
    },
    (error) => {
      console.error("Bug reports unavailable", error);
      onError?.(error);
    },
  );

export const resolveBugReport = (id) =>
  update(ref(db, `bugReports/${id}`), { status: "resolved", resolvedAt: Date.now() });
