import { getPlayer, setPlayer } from "../character/player";
import { cleanseDebuffs, isDebuff } from "../combat/statuses";

/*
 Consumables and key items.
 The player saves `consumables` ({ key: count }), `keyItems` (array of KEY_ITEMS keys),
 and `disabledKeyItems` (array of toggleable key items switched off by the player).
 Add an entry to CONSUMABLES (heal: health restored) or KEY_ITEMS to create a new item;
 consumables with a `price` are sold in the Apothecary. Key items marked
 `toggleable: true` can be switched on and off from the inventory.
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
    description: "Restores all power.",
    power: 1,
    price: 260,
  },
  staminaPotion: {
    name: "Stamina Potion",
    description: "Restores all stamina.",
    stamina: 1,
    price: 1000,
  },
  cleansingPotion: {
    name: "Cleansing Potion",
    description: "Removes all cleansable negative status effects. Preserves buffs and effects that only dungeon mechanics can remove.",
    price: 2000,
    cleanse: true,
  },
  elixirOfNameChanging: {
    name: "Elixir of Name Changing",
    description: "Allows you to change your character's name.",
  },
  architectsRune: {
    name: "Architect's Rune",
    description: "Change an owned item's main stat to Strength, Dexterity, or Intelligence, keeping its value and tier. Usable once per item.",
    rune: true,
  },
  itemCertificate: {
    name: "Item Certificate",
    description: "Allows you to rename an owned item.",
  },
  prismaticAlloy: {
    name: "Prismatic Alloy",
    description: "Adds a Holofoil to an owned item or rerolls its colors. Holofoil grants an extra socket (maximum 3), T5 or better stats, and double value. Color rerolls do not stack these bonuses.",
  },
  runeOfUnpredictability: {
    name: "Rune of Unpredictability",
    description: "Randomly does nothing, changes a substat tier or type, or adds a substat to an owned item. Usable once per item.",
    rune: true,
  },
  runeOfAscension: {
    name: "Rune of Ascension",
    description: "Increases an owned item's rarity by one step, improving stats and value. Cannot be used on Legendary, Unique, or Mythic items. Usable once per item.",
    rune: true,
  },
  polishingRune: {
    name: "Polishing Rune",
    description: "Increases an owned item's condition by one step, improving its main stat and value. Cannot be used on Perfect items. Usable once per item.",
    rune: true,
  }
};

export const PRISMATIC_ALLOY_DROP_CHANCE = 0.005;
export const RUNE_OF_UNPREDICTABILITY_DROP_CHANCE = 0.05;
export const POLISHING_RUNE_DROP_CHANCE = RUNE_OF_UNPREDICTABILITY_DROP_CHANCE;
export const RUNE_OF_ASCENSION_DROP_CHANCE = { elite: 0.05, boss: 0.1 };

export const ITEM_CERTIFICATE_DROP_CHANCE = {
  overworld: { elite: 0.1, boss: 0.25 },
  dungeon: { elite: 0.15, boss: 0.3 },
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
    toggleable: true,
  },
  wayfindersCompass: {
    name: "Wayfinder's Compass",
    description: "Charts shorter portal routes, reducing every portal fare by 25%.",
    effects: { portalDiscount: 0.25 },
  },
  medicKit: {
    name: "Field Medic's Kit",
    description: "Health potions restore 25% more.",
    effects: { potionBonus: 0.25 },
  },
};

export const isKeyItemEnabled = (player, key) =>
  !(player?.disabledKeyItems || []).includes(key);

export const getKeyItemEffect = (player, name) =>
  (player?.keyItems || []).reduce(
    (sum, k) =>
      sum +
      (isKeyItemEnabled(player, k) ? KEY_ITEMS[k]?.effects?.[name] || 0 : 0),
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

export const keyItemTooltip = (key, player) => {
  const k = KEY_ITEMS[key];
  if (!k) return null;
  const tooltip = { title: k.name, subtitle: "Key Item", description: k.description };
  if (k.toggleable && player)
    tooltip.footer = isKeyItemEnabled(player, key)
      ? "Active • Click to disable"
      : "Disabled • Click to enable";
  return tooltip;
};

export const getConsumables = (player = getPlayer()) =>
  Object.entries(player?.consumables || {})
    .filter(([key, count]) => CONSUMABLES[key] && count > 0)
    .map(([key, count]) => ({ key, count, ...CONSUMABLES[key] }));

export const isCombatConsumable = (item) =>
  !!(item?.heal || item?.power || item?.stamina || item?.cleanse);

export function buyConsumable(key, quantity = 1) {
  const item = CONSUMABLES[key];
  if (!item?.price)
    return { ok: false, message: "That item isn't sold here." };
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    return { ok: false, message: "Enter a positive whole number of potions." };
  const player = getPlayer();
  const cost = item.price * quantity;
  if (!Number.isSafeInteger(cost) || cost > (player.astra || 0))
    return { ok: false, message: "You don't have enough astra for that quantity." };
  const count = (player.consumables?.[key] || 0) + quantity;
  if (!Number.isSafeInteger(count))
    return { ok: false, message: "That quantity exceeds the inventory limit." };
  setPlayer({
    astra: player.astra - cost,
    consumables: { ...player.consumables, [key]: count },
  });
  return { ok: true, message: `You buy ${quantity} x ${item.name} for ${cost} astra.` };
}

export const getKeyItems = (player = getPlayer()) =>
  (player?.keyItems || [])
    .filter((key) => KEY_ITEMS[key])
    .map((key) => ({
      key,
      ...KEY_ITEMS[key],
      enabled: isKeyItemEnabled(player, key),
    }));

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

export const toggleKeyItem = (key) => {
  const player = getPlayer();
  if (!KEY_ITEMS[key]?.toggleable || !(player?.keyItems || []).includes(key))
    return { ok: false, message: "That item can't be toggled." };
  const disabled = player?.disabledKeyItems || [];
  const enabling = disabled.includes(key);
  setPlayer({
    disabledKeyItems: enabling
      ? disabled.filter((k) => k !== key)
      : [...disabled, key],
  });
  return {
    ok: true,
    message: `${KEY_ITEMS[key].name} is now ${enabling ? "active" : "disabled"}.`,
  };
};

// Applies one consumable to the stats copy `s` (mutated). Returns { ok, message, consumables }; nothing is used when ok is false.
export function applyConsumable(player, key, s, { healScale = 1, statuses = [] } = {}) {
  const c = CONSUMABLES[key];
  const count = player.consumables?.[key] || 0;
  if (!c || count < 1)
    return { ok: false, message: "You don't have that item." };
  if (key === "elixirOfNameChanging")
    return { ok: false, message: "Use this elixir from your inventory outside combat to choose a new name." };
  if (key === "itemCertificate")
    return { ok: false, message: "Use this certificate from your inventory outside combat to rename an item." };
  if (key === "prismaticAlloy")
    return { ok: false, message: "Use this alloy from your inventory outside combat to apply or reroll a Holofoil." };
  if (c.rune)
    return { ok: false, message: "Use runes from your inventory outside combat to choose an item." };
  const canHeal = c.heal && s.health < s.maxHealth;
  const canRestorePower = c.power && s.power < s.maxPower;
  if (c.heal && !canHeal)
    return { ok: false, message: "You're already at full health." };
  if (c.power && !canRestorePower)
    return { ok: false, message: "You're already at full power." };
  if (c.stamina && !(s.stamina < s.maxStamina))
    return { ok: false, message: "You're already at full stamina." };
  if (c.cleanse && !statuses.some(isDebuff))
    return { ok: false, message: "You have no negative status effects that can be cleansed." };
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
  const staminaRestored = c.stamina
    ? Math.min(Math.floor(c.stamina * s.maxStamina), s.maxStamina - s.stamina)
    : 0;
  if (staminaRestored) s.stamina += staminaRestored;
  const removed = c.cleanse ? cleanseDebuffs(statuses) : [];
  const consumables = { ...player.consumables, [key]: count - 1 };
  if (count - 1 <= 0) delete consumables[key];
  const recovery = [
    healed > 0 && `${healed} health`,
    powerRestored > 0 && `${powerRestored} power`,
    staminaRestored > 0 && `${staminaRestored} stamina`,
  ]
    .filter(Boolean)
    .join(" and ");
  return {
    ok: true,
    message: removed.length
      ? `You use a ${c.name} and remove all cleansable negative status effects.`
      : `You use a ${c.name} and recover ${recovery}.`,
    consumables,
  };
}

// Uses a consumable outside of combat.
export function drinkConsumable(key) {
  const p = getPlayer();
  if (key === "itemCertificate") {
    return p?.consumables?.[key] > 0
      ? { ok: true, requiresItemRename: true, message: "Choose an item and a new name. The certificate is used only when applied." }
      : { ok: false, message: "You don't have that item." };
  }
  if (key === "prismaticAlloy") {
    return p?.consumables?.[key] > 0
      ? { ok: true, requiresHolofoilReroll: true, message: "Choose an item to apply or reroll its Holofoil. The alloy is used only when applied." }
      : { ok: false, message: "You don't have that item." };
  }
  if (CONSUMABLES[key]?.rune) {
    return p?.consumables?.[key] > 0
      ? { ok: true, requiresRune: true, message: key === "architectsRune"
        ? "Choose an item and a different main stat. The rune is used only when applied."
        : `Choose an eligible item. ${CONSUMABLES[key].description} The rune is used only when applied.` }
      : { ok: false, message: "You don't have that item." };
  }
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
