import { getPlayer, setPlayer } from "../character/player";

/*
 Consumables and key items.
 The player saves `consumables` ({ key: count }) and `keyItems` (array of KEY_ITEMS keys).
 Add an entry to CONSUMABLES (heal: health restored) or KEY_ITEMS to create a new item;
 consumables with a `price` are sold in the general store.
*/
export const CONSUMABLES = {
  minorPotion: {
    name: "Minor Health Potion",
    description: "Restores 30% health.",
    heal: 0.3,
    price: 40,
  },
  healthPotion: {
    name: "Health Potion",
    description: "Restores 50% health.",
    heal: 0.5,
    price: 70,
  },
  greaterPotion: {
    name: "Greater Health Potion",
    description: "Restores 75% health.",
    heal: 0.75,
    price: 140,
  },
  minorPowerPotion: {
    name: "Power Potion",
    description: "Restores 50% power.",
    power: 0.5,
    price: 120,
  },
  greaterPowerPotion: {
    name: "Greater Power Potion",
    description: "Restores 100% power.",
    power: 1,
    price: 260,
  },
  elixirOfNameChanging: {
    name: "Elixir of Name Changing",
    description: "Allows you to change your character's name.",
  },
};

// Key items: { key: { name, description, effects } }. Effects are summed across owned items.
export const KEY_ITEMS = {
  analyzer: {
    name: "Analyzer",
    description: "Reveals detailed information about enemies.",
    effects: { analyzer: 1 },
  },
  travelersPack: {
    name: "Traveler's Pack",
    description: "20% chance that travelling costs no stamina.",
    effects: { freeTravel: 0.2 },
  },
  scavengersSatchel: {
    name: "Scavenger's Satchel",
    description: "+15% chance for enemies to drop materials.",
    effects: { materialChance: 0.15 },
  },
  huntersHorn: {
    name: "Hunter's Horn",
    description: "Elite and boss encounters are much more common.",
    effects: { huntBonus: 1 },
  },
  wayfindersCompass: {
    name: "Wayfinder's Compass",
    description: "Shows how many trips remain before the region changes.",
    effects: { compass: 1 },
  },
  medicKit: {
    name: "Field Medic's Kit",
    description: "Health potions restore 25% more.",
    effects: { potionBonus: 0.25 },
  },
};

export const getKeyItemEffect = (player, name) =>
  (player?.keyItems || []).reduce(
    (sum, k) => sum + (KEY_ITEMS[k]?.effects?.[name] || 0),
    0,
  );

export const consumableTooltip = (key, extra) => {
  const c = CONSUMABLES[key];
  if (!c) return null;
  return {
    title: c.name,
    subtitle: "Consumable",
    description: c.description,
    footer: [extra, c.price != null && `Value: ${c.price}`].filter(Boolean).join(" • "),
  };
};

export const keyItemTooltip = (key) => {
  const k = KEY_ITEMS[key];
  return k
    ? { title: k.name, subtitle: "Key Item", description: k.description }
    : null;
};

export const getConsumables = (player = getPlayer()) =>
  Object.entries(player?.consumables || {})
    .filter(([key, count]) => CONSUMABLES[key] && count > 0)
    .map(([key, count]) => ({ key, count, ...CONSUMABLES[key] }));

export const getKeyItems = (player = getPlayer()) =>
  (player?.keyItems || [])
    .filter((key) => KEY_ITEMS[key])
    .map((key) => ({ key, ...KEY_ITEMS[key] }));

export const addConsumable = (key, amount = 1) => {
  if (!CONSUMABLES[key]) return;
  const consumables = { ...(getPlayer()?.consumables || {}) };
  consumables[key] = (consumables[key] || 0) + amount;
  setPlayer({ consumables });
};

export const addKeyItem = (key) => {
  const owned = getPlayer()?.keyItems || [];
  if (KEY_ITEMS[key] && !owned.includes(key))
    setPlayer({ keyItems: [...owned, key] });
};

// Applies one consumable to the stats copy `s` (mutated). Returns { ok, message, consumables }; nothing is used when ok is false.
export function applyConsumable(player, key, s, { healScale = 1 } = {}) {
  const c = CONSUMABLES[key];
  const count = player.consumables?.[key] || 0;
  if (!c || count < 1)
    return { ok: false, message: "You don't have that item." };
  if (key === "elixirOfNameChanging")
    return { ok: false, message: "Use this elixir from your inventory outside combat to choose a new name." };
  const canHeal = c.heal && s.health < s.maxHealth;
  const canRestorePower = c.power && s.power < s.maxPower;
  if (c.heal && !canHeal)
    return { ok: false, message: "You're already at full health." };
  if (c.power && !canRestorePower)
    return { ok: false, message: "You're already at full power." };
  const heal =
    (c.heal || 0) * (1 + getKeyItemEffect(player, "potionBonus")) * healScale;
  const healed = Math.min(
    Math.floor(heal * s.maxHealth),
    s.maxHealth - s.health,
  );
  const powerRestored = Math.min(
    Math.floor((c.power || 0) * s.maxPower),
    s.maxPower - s.power,
  );
  s.health += healed;
  s.power += powerRestored;
  const consumables = { ...player.consumables, [key]: count - 1 };
  if (count - 1 <= 0) delete consumables[key];
  const recovery = [
    healed > 0 && `[green]${healed}[/green] health`,
    powerRestored > 0 && `[blue]${powerRestored}[/blue] power`,
  ]
    .filter(Boolean)
    .join(" and ");
  return {
    ok: true,
    message: `You use a ${c.name} and recover ${recovery}.`,
    consumables,
  };
}

// Uses a consumable outside of combat.
export function drinkConsumable(key) {
  const p = getPlayer();
  if (key === "elixirOfNameChanging") {
    return p?.consumables?.[key] > 0
      ? { ok: true, requiresNameChange: true, message: "Choose your new name. The elixir is used only after it is saved." }
      : { ok: false, message: "You don't have that item." };
  }
  const s = { ...p.stats };
  const result = applyConsumable(p, key, s);
  if (result.ok) setPlayer({ stats: s, consumables: result.consumables });
  return result;
}
