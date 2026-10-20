import { onValue, push, ref, runTransaction, set, update } from "firebase/database";
import { auth, db } from "../firebase";
import { flushPlayer, getPlayer, setPlayer } from "../character/player";
import { getEnemy } from "../combat/combat";
import { RARITY_NAMES, SLOTS, STAT_LABELS, canEquip } from "../items/items";
import { findAbility } from "../combat/abilities";
import { getItemGearScore } from "../items/gearScore";

/*
 Player marketplace. Listings live in the database so every player sees them:
   marketplace/{listingId} { sellerUid, sellerName, price, listedAt, item }
 Listing removes the item from the seller's inventory. A purchase is one atomic multi-path write that
 deletes the listing and mails both sides from "Marketplace":
   inbox/{buyerUid}/market-{listingId}       the item as an attachment
   inbox/{sellerUid}/market-sale-{listingId} the price minus the 10% tax, in astra
 database.rules.json only accepts those writes together, so a listing can be bought once.
*/
export const MARKETPLACE_MIN_LEVEL = 5;
export const MARKETPLACE_TAX_RATE = 0.1;
export const MAX_LISTINGS = 20;
export const MAX_PRICE = 1000000000;
const SENDER = "Marketplace";

// Integer math keeps this identical to the check in database.rules.json.
export const getTax = (price) => Math.ceil(price / 10);
export const getPayout = (price) => price - getTax(price);

export const isMarketUnlocked = (player = getPlayer()) => (player?.level || 1) >= MARKETPLACE_MIN_LEVEL;

const uid = () => auth.currentUser?.uid || null;
export const getMyUid = uid;

// The database drops empty objects and nulls, so restore the shape items normally have.
const restoreItem = (item) => ({ ...item, subStats: item?.subStats || {}, ability: item?.ability || null });
// The database rejects undefined values.
const cleanItem = (item) => JSON.parse(JSON.stringify(item));

const toListing = (id, v) =>
  v && v.item ? { id, sellerUid: v.sellerUid, sellerName: v.sellerName || "Unknown", price: Number(v.price) || 0, listedAt: v.listedAt || 0, item: restoreItem(v.item) } : null;

// Live listings; returns an unsubscribe function. `onError` runs if the market can't be read.
export const subscribeListings = (onListings, onError) =>
  onValue(
    ref(db, "marketplace"),
    (snap) => onListings(Object.entries(snap.val() || {}).map(([id, v]) => toListing(id, v)).filter(Boolean)),
    (e) => {
      console.warn("Marketplace unavailable", e);
      onError?.(e);
    },
  );

const parsePrice = (value) => {
  const n = Number(String(value).trim());
  return Number.isInteger(n) && n >= 1 && n <= MAX_PRICE ? n : null;
};

const accessProblem = (player) => {
  if (!player) return "No character loaded.";
  if (!uid()) return "You are not signed in.";
  if (!isMarketUnlocked(player)) return `The marketplace opens to adventurers of level ${MARKETPLACE_MIN_LEVEL}.`;
  if (getEnemy()) return "Finish your fight first.";
  return null;
};

// Lists the inventory item at `index` for `priceInput` astra.
export async function listItem(index, priceInput, myListingCount = 0) {
  const player = getPlayer();
  const problem = accessProblem(player);
  if (problem) return { ok: false, message: problem };
  const price = parsePrice(priceInput);
  if (!price) return { ok: false, message: `Enter a whole price between 1 and ${MAX_PRICE.toLocaleString()} astra.` };
  if (myListingCount >= MAX_LISTINGS) return { ok: false, message: `You can only have ${MAX_LISTINGS} listings at a time.` };
  const inventory = [...(player.inventory || [])];
  const item = inventory[index];
  if (!item || item.twoHandedOf) return { ok: false, message: "That item is no longer in your inventory." };

  const listed = cleanItem({ ...item, originalOwner: item.originalOwner || player.name });
  inventory.splice(index, 1);
  // Take the item first so it can't be listed twice; give it back if the listing fails.
  setPlayer({ inventory });
  try {
    await set(push(ref(db, "marketplace")), {
      sellerUid: uid(),
      sellerName: String(player.name),
      price,
      listedAt: Date.now(),
      item: listed,
    });
  } catch (e) {
    console.warn("Listing failed", e);
    setPlayer({ inventory: [...(getPlayer()?.inventory || []), item] });
    return { ok: false, message: "Couldn't reach the marketplace. Try again." };
  }
  await flushPlayer();
  return { ok: true, message: `Listed ${item.name} for ${price} astra. You'll receive ${getPayout(price)} astra after the ${getTax(price)} astra tax when it sells.` };
}

// Takes down one of your listings and returns the item to your inventory.
export async function cancelListing(listing) {
  const player = getPlayer();
  if (!player) return { ok: false, message: "No character loaded." };
  if (getEnemy()) return { ok: false, message: "Finish your fight first." };
  if (!listing || listing.sellerUid !== uid()) return { ok: false, message: "That isn't your listing." };
  let removed = null;
  try {
    await runTransaction(ref(db, `marketplace/${listing.id}`), (cur) => {
      removed = null;
      if (cur === null) return null;
      if (cur.sellerUid !== uid()) return undefined;
      removed = cur;
      return null;
    });
  } catch (e) {
    console.warn("Cancel failed", e);
    return { ok: false, message: "Couldn't reach the marketplace. Try again." };
  }
  if (!removed?.item) return { ok: false, message: "That listing already sold." };
  setPlayer({ inventory: [...(getPlayer()?.inventory || []), restoreItem(removed.item)] });
  await flushPlayer();
  return { ok: true, message: `${removed.item.name} returned to your inventory.` };
}

// Buys a listing: deletes it and mails the item to you and the payout to the seller in one write.
export async function buyListing(listing) {
  const player = getPlayer();
  const problem = accessProblem(player);
  if (problem) return { ok: false, message: problem };
  if (!listing) return { ok: false, message: "That listing is gone." };
  if (listing.sellerUid === uid()) return { ok: false, message: "You can't buy your own listing." };
  const price = listing.price;
  if ((player.astra || 0) < price) return { ok: false, message: `You need ${price} astra to buy ${listing.item.name}.` };

  const now = Date.now();
  const tax = getTax(price);
  const payout = getPayout(price);
  const item = cleanItem(listing.item);
  const buyer = String(player.name);
  const writes = {
    [`marketplace/${listing.id}`]: null,
    [`inbox/${uid()}/market-${listing.id}`]: {
      subject: `Purchased: ${item.name}`,
      body: `You bought ${item.name} from ${listing.sellerName} for ${price} astra. Claim it below.`,
      from: SENDER,
      sentAt: now,
      listingId: listing.id,
      attachments: { items: [item] },
    },
    [`inbox/${listing.sellerUid}/market-sale-${listing.id}`]: {
      subject: `Sold: ${item.name}`,
      body: `${buyer} bought your ${item.name} for ${price} astra.\nMarketplace tax (10%): -${tax} astra.\nYou receive ${payout} astra. Claim it below.`,
      from: SENDER,
      sentAt: now,
      listingId: listing.id,
      attachments: { astra: payout },
    },
  };
  try {
    await update(ref(db), writes);
  } catch (e) {
    console.warn("Purchase failed", e);
    return { ok: false, message: "Someone else bought that first, or the market is unreachable." };
  }
  setPlayer({ astra: (getPlayer()?.astra || 0) - price });
  await flushPlayer();
  return { ok: true, message: `Bought ${item.name} for ${price} astra. It's been mailed to your inbox.` };
}

// ---- Search, filter, sort ----

const RARITY_ORDER = [...RARITY_NAMES, "Unique"];
export const MARKET_RARITIES = RARITY_ORDER;

export const MARKET_SLOTS = SLOTS.filter((s, i, all) => all.findIndex((o) => o.type === s.type) === i).map((s) => ({
  type: s.type,
  label: s.label.replace(/ \d$/, ""),
}));

export const MARKET_STATS = Object.entries(STAT_LABELS).map(([key, label]) => ({ key, label }));

export const SORTS = [
  ["newest", "Newest"],
  ["oldest", "Oldest"],
  ["priceAsc", "Price: low to high"],
  ["priceDesc", "Price: high to low"],
  ["levelDesc", "Item level: high to low"],
  ["levelAsc", "Item level: low to high"],
  ["gearScoreDesc", "Gear score: high to low"],
  ["rarityDesc", "Rarity: best first"],
  ["nameAsc", "Name: A to Z"],
];

export const DEFAULT_FILTERS = {
  query: "",
  slot: "",
  rarity: "",
  stat: "",
  minStat: "",
  ability: "",
  minPrice: "",
  maxPrice: "",
  usable: false,
  sort: "newest",
};

export const getItemStats = (item) => {
  const out = {};
  if (item.mainStat?.stat) out[item.mainStat.stat] = (out[item.mainStat.stat] || 0) + (Number(item.mainStat.value) || 0);
  for (const [k, v] of Object.entries(item.subStats || {})) out[k] = (out[k] || 0) + (Number(v) || 0);
  if (item.gemstone?.stat) out[item.gemstone.stat] = (out[item.gemstone.stat] || 0) + (Number(item.gemstone.value) || 0);
  return out;
};

export const getAbilityNames = (listings) =>
  [...new Set(listings.map((l) => l.item.ability?.name).filter(Boolean))].sort((a, b) => a.localeCompare(b));

const searchText = (listing) => {
  const { item } = listing;
  const slot = MARKET_SLOTS.find((s) => s.type === item.slot)?.label || item.slot;
  return [
    item.name,
    item.rarity,
    item.condition,
    slot,
    item.twoHanded && "two-handed",
    item.ability?.name,
    item.ability && (findAbility(item.ability)?.description || item.ability.description),
    ...Object.keys(getItemStats(item)).map((k) => STAT_LABELS[k] || k),
    item.gemstone?.name,
    listing.sellerName,
    item.originalOwner,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

const num = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));

export const filterListings = (listings, f, level = getPlayer()?.level || 1) => {
  const terms = String(f.query || "").toLowerCase().split(/\s+/).filter(Boolean);
  const minPrice = num(f.minPrice);
  const maxPrice = num(f.maxPrice);
  const minStat = num(f.minStat);
  return listings.filter((l) => {
    const { item } = l;
    if (f.slot && item.slot !== f.slot) return false;
    if (f.rarity && item.rarity !== f.rarity) return false;
    if (minPrice !== null && l.price < minPrice) return false;
    if (maxPrice !== null && l.price > maxPrice) return false;
    if (f.usable && !canEquip(item, level)) return false;
    if (f.ability === "__any" && !item.ability) return false;
    if (f.ability === "__none" && item.ability) return false;
    if (f.ability && !f.ability.startsWith("__") && item.ability?.name !== f.ability) return false;
    if (f.stat) {
      const stats = getItemStats(item);
      if (!(f.stat in stats)) return false;
      if (minStat !== null) {
        // Percent stats are stored as fractions but entered as whole percentages.
        const value = ["criticalDamage", "criticalHitChance", "evasion"].includes(f.stat) ? stats[f.stat] * 100 : stats[f.stat];
        if (value < minStat) return false;
      }
    }
    if (terms.length) {
      const text = searchText(l);
      if (!terms.every((t) => text.includes(t))) return false;
    }
    return true;
  });
};

const rarityRank = (r) => RARITY_ORDER.indexOf(r);

export const sortListings = (listings, sort) => {
  const by = {
    newest: (a, b) => b.listedAt - a.listedAt,
    oldest: (a, b) => a.listedAt - b.listedAt,
    priceAsc: (a, b) => a.price - b.price,
    priceDesc: (a, b) => b.price - a.price,
    levelDesc: (a, b) => (b.item.iLevel || 0) - (a.item.iLevel || 0),
    levelAsc: (a, b) => (a.item.iLevel || 0) - (b.item.iLevel || 0),
    gearScoreDesc: (a, b) => getItemGearScore(b.item) - getItemGearScore(a.item),
    rarityDesc: (a, b) => rarityRank(b.item.rarity) - rarityRank(a.item.rarity),
    nameAsc: (a, b) => String(a.item.name).localeCompare(String(b.item.name)),
  }[sort] || ((a, b) => b.listedAt - a.listedAt);
  return [...listings].sort((a, b) => by(a, b) || b.listedAt - a.listedAt);
};
