import { get, onValue, push, ref, remove, set, update } from "firebase/database";
import { db } from "../firebase";
import { commitPlayerChange, getPlayer, setPlayer } from "../character/player";
import { gainExp } from "../character/stats";
import { addGemstone, addItem, createUniqueItem, generateRandomGemstone, generateRandomItem, GEAR_SLOT_TYPES, RARITY_NAMES, restrictItemSubStats } from "../items/items";
import { UNIQUES } from "./dungeonData";
import { CONSUMABLES, KEY_ITEMS, addConsumable, addKeyItem } from "../items/consumables";
import { MATERIALS, addToMaterials } from "../items/materials";
import { validateHolofoil } from "../items/holofoil";
import { TITLES } from "../character/titles";

/*
 Inbox. Messages come from the game/admins:
   inbox/{uid}/{id}      personal messages (admin-written)
   broadcasts/{id}       messages for every player (admin-written)
   inboxState/{uid}/{id} this player's { read, claimed, deleted } flags for either kind
 attachments: { astra, exp, materials: { key: n }, consumables: { key: n }, keyItems: { key: true }, gear: [{ slot, minRarity, count }], gemstones: [{ minRarity, count }], gemstoneItems: [gemstone], items: [item] }
 Gear is generated when claimed to match the claiming player's level; gemstones are generated at the selected minimum rarity.
 Gear and unique attachments may include `holofoil: true` for random colors or two #RRGGBB colors to force a holofoil.
 `items` also supports admin-created custom gear, saved at send time and claimed without rerolling.
 Player-written `gemstoneItems` and `items` are restricted to marketplace purchases by database rules.
*/

let state = { uid: null, accountId: null, admin: false, messages: [] };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export const getMessages = () => state.messages;
export const getUnreadCount = () => state.messages.filter((m) => !m.read).length;
export const isAdmin = () => state.admin;

const asList = (v) => (Array.isArray(v) ? v.filter(Boolean) : Object.values(v || {}));

export const normalizeAttachments = (a = {}) => ({
  astra: Math.max(0, Math.floor(Number(a.astra) || 0)),
  exp: Math.max(0, Math.floor(Number(a.exp) || 0)),
  materials: Object.entries({
    ...(a.materials || {}),
    ...(Number(a.consumables?.relic) > 0
      ? { sealedRelic: (Number(a.materials?.sealedRelic) || 0) + Number(a.consumables.relic) }
      : {}),
  }).filter(([k, n]) => MATERIALS[k] && n > 0),
  consumables: Object.entries(a.consumables || {}).filter(([k, n]) => k !== "relic" && CONSUMABLES[k] && n > 0),
  keyItems: Object.keys(a.keyItems || {}).filter((k) => KEY_ITEMS[k]),
  gear: asList(a.gear)
    .filter((g) => GEAR_SLOT_TYPES.includes(g.slot) && Number(g.count) > 0)
    .map((g) => {
      const minTier = Math.max(0, Math.min(10, Math.floor(Number(g.minTier) || 0)));
      return {
        slot: g.slot,
        minRarity: Math.max(0, Math.min(RARITY_NAMES.length - 1, Math.floor(Number(g.minRarity) || 0))),
        ...(minTier ? { minTier } : {}),
        count: Math.floor(Number(g.count)),
        ...(g.holofoil !== undefined ? { holofoil: g.holofoil } : {}),
      };
    }),
  uniques: asList(a.uniques)
    .filter((u) => UNIQUES[u.id] && Math.floor(Number(u.count)) > 0)
    .map((u) => ({ id: u.id, count: Math.floor(Number(u.count)), ...(u.holofoil !== undefined ? { holofoil: u.holofoil } : {}) })),
  gemstones: asList(a.gemstones)
    .filter((g) => Number.isFinite(Number(g.count)) && Math.floor(Number(g.count)) > 0)
    .map((g) => ({
      minRarity: Math.max(0, Math.min(RARITY_NAMES.length - 1, Math.floor(Number(g.minRarity) || 0))),
      count: Math.floor(Number(g.count)),
    })),
  titles: [...new Set(asList(a.titles).filter((id) => TITLES[id]))],
  gemstoneItems: asList(a.gemstoneItems).filter((g) =>
    g && typeof g.id === "string" && typeof g.name === "string" &&
    ["ruby", "emerald", "sapphire"].includes(g.type) &&
    typeof g.stat === "string" && Number.isFinite(Number(g.value)) &&
    RARITY_NAMES.includes(g.rarity),
  ),
  // Exact gear pieces (e.g. marketplace purchases), delivered as-is.
  items: asList(a.items)
    .filter((i) => i && typeof i === "object" && i.name && i.slot)
    .map(restrictItemSubStats),
});

export const hasAttachments = (a) => {
  const n = normalizeAttachments(a);
  return n.astra > 0 || n.exp > 0 || n.materials.length + n.consumables.length + n.keyItems.length + n.gear.length + n.uniques.length + n.gemstones.length + n.gemstoneItems.length + n.items.length + n.titles.length > 0;
};

export const hasUnclaimed = (msg) => !msg.claimed && hasAttachments(msg.attachments);

// Human-readable lines, one per attachment.
export const describeAttachments = (a) => {
  const n = normalizeAttachments(a);
  return [
    ...(n.astra ? [`${n.astra} astra`] : []),
    ...(n.exp ? [`${n.exp} exp`] : []),
    ...n.materials.map(([k, c]) => `${c}× ${MATERIALS[k].name}`),
    ...n.consumables.map(([k, c]) => `${c}× ${CONSUMABLES[k].name}`),
    ...n.keyItems.map((k) => `Key item: ${KEY_ITEMS[k].name}`),
    ...n.gear.map((g) => `${g.count}× random ${g.holofoil ? "Holofoil " : ""}${RARITY_NAMES[g.minRarity || 0]}+${g.minTier ? ` T${g.minTier}+` : ""} ${g.slot}`),
    ...n.uniques.map((u) => `${u.count}× ${u.holofoil ? "Holofoil " : ""}Unique: ${UNIQUES[u.id].name}`),
    ...n.gemstones.map((g) => `${g.count}× random ${RARITY_NAMES[g.minRarity]}+ gemstone${g.count === 1 ? "" : "s"}`),
    ...n.gemstoneItems.map((g) => `${g.rarity} ${g.name}`),
    ...n.items.map((i) => `${i.holofoil ? "Holofoil " : ""}${i.rarity ? `${i.rarity} ` : ""}${i.name}`),
    ...n.titles.map((id) => `${TITLES[id].rarity} title: ${TITLES[id].name} — ${TITLES[id].criteria}`),
  ];
};

const compute = (inbox, broadcasts, worldBossMail, states) => {
  const build = (id, m, source) => {
    const st = states[id] || {};
    return st.deleted
      ? null
      : { id, source, subject: m.subject || "(no subject)", body: m.body || "", from: m.from || "Game", sentAt: m.sentAt || 0, attachments: m.attachments || {}, read: !!st.read, claimed: !!st.claimed };
  };
  state.messages = [
    ...Object.entries(inbox).map(([id, m]) => build(id, m, "inbox")),
    ...Object.entries(broadcasts).map(([id, m]) => build(id, m, "broadcast")),
    ...Object.entries(worldBossMail).map(([id, m]) => build(`world-boss-${id}`, m, "worldBossMail")),
  ]
    .filter(Boolean)
    .sort((a, b) => b.sentAt - a.sentAt);
  emit();
};

// Starts live listeners for the signed-in player; returns a cleanup function. `onChange` runs after every update.
export const startInbox = (uid, onChange, accountId = uid) => {
  let inbox = {};
  let broadcasts = {};
  let worldBossMail = {};
  let states = {};
  const refresh = () => compute(inbox, broadcasts, worldBossMail, states);
  const warn = (e) => console.warn("Inbox unavailable", e);
  state = { uid, accountId, admin: false, messages: [] };
  listeners.add(onChange);
  const stops = [
    onValue(ref(db, `inbox/${uid}`), (s) => { inbox = s.val() || {}; refresh(); }, warn),
    onValue(ref(db, "broadcasts"), (s) => { broadcasts = s.val() || {}; refresh(); }, warn),
    onValue(ref(db, `worldBossMail/${uid}`), (s) => { worldBossMail = s.val() || {}; refresh(); }, warn),
    onValue(ref(db, `inboxState/${uid}`), (s) => { states = s.val() || {}; refresh(); }, warn),
  ];
  get(ref(db, `admins/${accountId}`))
    .then((s) => {
      state.admin = s.val() === true;
      emit();
    })
    .catch(() => {});
  return () => {
    stops.forEach((stop) => stop());
    listeners.delete(onChange);
    state = { uid: null, accountId: null, admin: false, messages: [] };
  };
};

const stateRef = (id) => ref(db, `inboxState/${state.uid}/${id}`);

export const markRead = (id) => update(stateRef(id), { read: true }).catch(() => {});

export const deleteMessage = (id) => update(stateRef(id), { deleted: true });

function grant(a) {
  const n = normalizeAttachments(a);
  [...n.gear, ...n.uniques].forEach((item) => validateHolofoil(item.holofoil));
  const lines = [];
  const p = getPlayer();
  const patch = {};
  if (n.exp) {
    const leveled = gainExp(p, n.exp);
    Object.assign(patch, leveled.patch);
    lines.push(`${n.exp} exp`, ...leveled.messages);
  }
  if (n.astra) {
    patch.astra = (p.astra || 0) + n.astra;
    lines.push(`${n.astra} astra`);
  }
  if (n.materials.length) {
    patch.materials = addToMaterials(p.materials, Object.fromEntries(n.materials));
    n.materials.forEach(([k, c]) => lines.push(`${c}× ${MATERIALS[k].name}`));
  }
  if (n.titles.length) {
    const titles = new Set(Array.isArray(p.titles) ? p.titles : []);
    n.titles.forEach((id) => titles.add(id));
    patch.titles = [...titles];
    patch.activeTitle = p.activeTitle && TITLES[p.activeTitle] ? p.activeTitle : n.titles[0];
    n.titles.forEach((id) => lines.push(TITLES[id].name));
  }
  if (Object.keys(patch).length) setPlayer(patch);
  n.consumables.forEach(([k, c]) => {
    addConsumable(k, c);
    lines.push(`${c}× ${CONSUMABLES[k].name}`);
  });
  n.keyItems.forEach((k) => {
    addKeyItem(k);
    lines.push(KEY_ITEMS[k].name);
  });
  n.gear.forEach((g) => {
    for (let i = 0; i < g.count; i++) {
      const item = generateRandomItem(g.slot, g.minRarity || 0, g.holofoil, g.minTier || 0);
      if (item) {
        addItem(item);
        lines.push(item.name);
      }
    }
  });
  n.uniques.forEach((u) => {
    for (let i = 0; i < u.count; i++) {
      const item = createUniqueItem(UNIQUES[u.id], getPlayer()?.level || 1, u.holofoil);
      if (item) {
        addItem(item);
        lines.push(item.name);
      }
    }
  });
  n.gemstones.forEach((g) => {
    for (let i = 0; i < g.count; i++) {
      const gemstone = generateRandomGemstone(g.minRarity);
      addGemstone(gemstone);
      lines.push(gemstone.name);
    }
  });
  n.gemstoneItems.forEach((gemstone) => {
    addGemstone(gemstone);
    lines.push(`${gemstone.rarity} ${gemstone.name}`);
  });
  n.items.forEach((item) => {
    // The database drops empty objects, so restore the shapes items are expected to have.
    addItem({ ...item, subStats: item.subStats || {}, ability: item.ability || null });
    lines.push(item.name);
  });
  return lines;
}

// Save the attachments and the claim flag together, so closing the page cannot split them.
export async function claimMessage(id) {
  const uid = state.uid;
  const accountId = state.accountId;
  const msg = state.messages.find((m) => m.id === id);
  if (!msg || !hasUnclaimed(msg)) return { ok: false, message: "Nothing to claim." };
  if (!getPlayer()) return { ok: false, message: "No character yet." };
  let lines;
  try {
    await commitPlayerChange(() => {
      lines = grant(msg.attachments);
      const writes = {
        [`inboxState/${uid}/${id}/claimed`]: true,
        [`inboxState/${uid}/${id}/read`]: true,
      };
      normalizeAttachments(msg.attachments).titles
        .filter((titleId) => TITLES[titleId].accountWide)
        .forEach((titleId) => {
          writes[`users/${accountId}/accountWideTitles/${titleId}`] = true;
        });
      return writes;
    });
  } catch (error) {
    console.warn("Couldn't save inbox claim", error);
    return { ok: false, message: "Couldn't claim right now. Try again." };
  }
  return { ok: true, lines };
}

// ---- Admin ----

export const getDirectory = async () => {
  const s = await get(ref(db, "directory"));
  return Object.entries(s.val() || {})
    .map(([uid, v]) => ({ uid, name: v.name, level: v.level, activeTitle: v.activeTitle }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
};

export async function administerPlayerTimer(uid, timer) {
  if (!state.admin) throw new Error("Admin access is required.");
  if (typeof uid !== "string" || !uid || uid.includes("/") || !["dungeons", "labyrinth"].includes(timer))
    throw new Error("Choose a player and a valid timer.");

  const ownerSnapshot = await get(ref(db, `characterOwners/${uid}`));
  const owner = ownerSnapshot.val();
  if (owner && (
    typeof owner.accountId !== "string" || !owner.accountId ||
    typeof owner.characterId !== "string" || !/^[0-9]{40}$/.test(owner.characterId)
  ))
    throw new Error("The player's character ownership record is invalid.");
  const accountId = owner?.accountId || uid;
  const playerPath = owner
    ? `users/${accountId}/characters/${owner.characterId}/player`
    : `users/${accountId}/player`;
  const revisionSnapshot = await get(ref(db, `users/${accountId}/saveRevision`));
  const revision = revisionSnapshot.val() || 0;
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new Error("The player's save revision is invalid.");

  const updates = {
    [`users/${accountId}/saveRevision`]: revision + 1,
  };
  if (timer === "dungeons") updates[`${playerPath}/dungeonBoard/slot`] = -1;
  else updates[`${playerPath}/labyrinth/weekId`] = null;
  await update(ref(db), updates);
}

export const grantLabyrinthAttempt = (uid) => administerPlayerTimer(uid, "labyrinth");

export const getBroadcasts = async () => {
  const s = await get(ref(db, "broadcasts"));
  return Object.entries(s.val() || {})
    .map(([id, m]) => ({ id, ...m }))
    .sort((a, b) => b.sentAt - a.sentAt);
};

export const deleteBroadcast = (id) => remove(ref(db, `broadcasts/${id}`));

// `to` is a player uid or "all". Returns once written.
export async function sendMessage({ to, subject, body, attachments }) {
  const n = normalizeAttachments(attachments);
  [...n.gear, ...n.uniques].forEach((item) => validateHolofoil(item.holofoil));
  const clean = {
    ...(n.astra ? { astra: n.astra } : {}),
    ...(n.exp ? { exp: n.exp } : {}),
    ...(n.materials.length ? { materials: Object.fromEntries(n.materials) } : {}),
    ...(n.consumables.length ? { consumables: Object.fromEntries(n.consumables) } : {}),
    ...(n.keyItems.length ? { keyItems: Object.fromEntries(n.keyItems.map((k) => [k, true])) } : {}),
    ...(n.gear.length ? { gear: n.gear.map((g) => ({ slot: g.slot, minRarity: g.minRarity || 0, ...(g.minTier ? { minTier: g.minTier } : {}), count: g.count, ...(g.holofoil !== undefined ? { holofoil: g.holofoil } : {}) })) } : {}),
    ...(n.uniques.length ? { uniques: n.uniques } : {}),
    ...(n.gemstones.length ? { gemstones: n.gemstones } : {}),
    ...(n.titles.length ? { titles: n.titles } : {}),
    ...(n.items.length ? { items: n.items } : {}),
  };
  const message = { subject: subject.trim(), body: body.trim(), from: "Game Master", sentAt: Date.now(), ...(Object.keys(clean).length ? { attachments: clean } : {}) };
  const target = to === "all" ? push(ref(db, "broadcasts")) : push(ref(db, `inbox/${to}`));
  await set(target, message);
}
