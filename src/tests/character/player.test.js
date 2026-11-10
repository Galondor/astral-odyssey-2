let get, runTransaction, set, update;
let getPlayer, loadPlayer, savePlayerName, setPlayer, flushPlayer, getSaveStatus, commitPlayerChange;

jest.mock("../../firebase", () => ({ db: {} }));
jest.mock("../../world/leaderboards", () => ({ publishLeaderboardEntry: jest.fn() }));
jest.mock("firebase/database", () => ({
  ref: (_, path) => path,
  query: (path, order, name) => ({ path, name }),
  equalTo: (name) => name,
  orderByChild: (key) => key,
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  runTransaction: jest.fn(),
  onValue: jest.fn(() => () => {}),
}));

let records;
const snapshot = (value) => ({ val: () => value, exists: () => value != null });

beforeEach(() => {
  jest.resetModules();
  ({ get, runTransaction, set, update } = require("firebase/database"));
  ({ getPlayer, loadPlayer, savePlayerName, setPlayer, flushPlayer, getSaveStatus, commitPlayerChange } = require("../../character/player"));
  jest.useFakeTimers();
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("PlayerMeta", JSON.stringify({ uid: "alice", dirty: false }));
  records = {};
  get.mockImplementation(async (path) => snapshot(
    typeof path === "object"
      ? Object.fromEntries(Object.entries(records.directory || {}).filter(([, p]) => p.name === path.name))
      : records[path] ?? null,
  ));
  set.mockResolvedValue();
  update.mockImplementation(async (_, writes) => {
    Object.assign(records, writes);
    if ("users/alice/saveRevision" in writes) records["users/alice"] = {
      player: writes["users/alice/player"], saveRevision: writes["users/alice/saveRevision"],
    };
  });
  runTransaction.mockImplementation(async (path, change) => {
    const value = change(records[path] ?? null);
    if (value === undefined) return { committed: false, snapshot: snapshot(records[path]) };
    records[path] = value;
    return { committed: true, snapshot: snapshot(value) };
  });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

const existingPlayer = () => {
  const player = {
    name: "Alice", level: 25, astra: 300, workshopVersion: 2,
    stats: { health: 100, maxHealth: 100 },
    inventory: [], equipment: {},
    consumables: { elixirOfNameChanging: 2, healthPotion: 4 },
  };
  localStorage.setItem("Player", JSON.stringify(player));
  records["users/alice"] = { player, saveRevision: 1 };
  records["characterNames/Alice"] = "alice";
  return player;
};

test.each([true, false])("loading persists workshop refunds once without counting income, power already migrated: %s", async (powerMigrated) => {
  const player = existingPlayer();
  delete player.workshopVersion;
  player.level = 30;
  player.baseStats = { strength: 2, dexterity: 2, intelligence: 2 };
  player.powerLevelVersion = powerMigrated ? 1 : 0;
  player.bonusStats = {
    attackMax: 13, maxHealth: 310, maxStamina: 15,
    maxPower: 11 + (powerMigrated ? 0 : 29),
  };
  player.crafted = { sharpeningStone: 2, vitalityTonic: 1, essenceVessel: 2, enduranceCharm: 1, analyzer: 1 };
  player.keyItems = ["analyzer"];
  player.materials = { slime_gel: 3 };
  player.records = { totalAstraGained: 123 };
  player.stats = { ...player.stats, maxPower: 100, power: 100, stamina: 100 };
  records["users/alice"] = { player, saveRevision: 1 };
  await loadPlayer("alice");
  const refunded = getPlayer();
  expect(refunded).toMatchObject({
    workshopVersion: 2, astra: 1225,
    workshopRefund: {
      upgrades: 6, astra: 925,
      materials: { goblin_scrap: 15, slime_gel: 10, wraith_essence: 15, obsidian_shard: 8, beast_fang: 7, primal_essence: 1 },
    },
    bonusStats: { attackMax: 3, maxHealth: 290, maxPower: 7, maxStamina: 14 },
    crafted: { analyzer: 1 }, keyItems: ["analyzer"],
    records: { totalAstraGained: 123 },
  });
  expect(refunded.crafted.sharpeningStone).toBeUndefined();
  expect(refunded.stats.power).toBe(refunded.stats.maxPower);
  expect(refunded.stats.stamina).toBe(refunded.stats.maxStamina);
  expect(refunded.materials.slime_gel).toBe(13);
  expect(records["users/alice"].player).toEqual(refunded);
  expect(records["publicProfiles/alice"].crafted).toEqual({ analyzer: 1 });
  expect(JSON.parse(localStorage.getItem("Player")).workshopVersion).toBe(2);
  await loadPlayer("alice");
  expect(getPlayer()).toEqual(refunded);
  expect(records["users/alice"].player).toEqual(refunded);
});

test("previous regional workshop refunds persist removed upgrades and preserve non-workshop bonuses", async () => {
  const player = existingPlayer();
  player.workshopVersion = 1;
  player.powerLevelVersion = 1;
  player.baseStats = { strength: 2, dexterity: 2, intelligence: 2 };
  player.bonusStats = { strength: 8, vitality: 9, resilience: 5, agility: 7, maxHealth: 290 };
  player.crafted = { powerBracers: 2, lifeweave: 2, ironboneBrace: 1, windstepSoles: 3, analyzer: 1 };
  player.keyItems = ["analyzer"];
  player.materials = { slime_gel: 3 };
  player.records = { totalAstraGained: 100 };
  player.workshopRefund = { upgrades: 1, astra: 50, materials: { goblin_scrap: 6 } };
  records["users/alice"] = { player, saveRevision: 1 };
  await loadPlayer("alice");
  const refunded = getPlayer();
  expect(refunded).toMatchObject({
    workshopVersion: 2, astra: 1400,
    bonusStats: { strength: 6, vitality: 5, resilience: 3, agility: 1, maxHealth: 290 },
    crafted: { analyzer: 1 }, keyItems: ["analyzer"],
    workshopRefund: { upgrades: 8, astra: 1100 },
    records: { totalAstraGained: 100 },
  });
  expect(refunded.crafted).toEqual({ analyzer: 1 });
  expect(refunded.stats.strength).toBe(8);
  expect(refunded.materials.slime_gel).toBe(19);
  expect(records["publicProfiles/alice"].crafted).toEqual({ analyzer: 1 });
  expect(records["users/alice"].player).toEqual(refunded);
  await loadPlayer("alice");
  expect(getPlayer()).toEqual(refunded);
});

test.each([undefined, 1])("workshop refunds survive a failed save and retry without duplication, version: %s", async (version) => {
  const player = existingPlayer();
  if (version) player.workshopVersion = version;
  else delete player.workshopVersion;
  player.baseStats = { strength: 2, dexterity: 2, intelligence: 2 };
  player.bonusStats = { attackMax: version ? 20 : 10 };
  player.crafted = { sharpeningStone: 2 };
  records["users/alice"] = { player, saveRevision: 1 };
  const save = update.getMockImplementation();
  update.mockImplementationOnce(async () => { throw new Error("Offline"); });
  const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
  try {
    await expect(loadPlayer("alice")).rejects.toThrow("Offline");
    expect(getSaveStatus().error).toMatch(/save could not be confirmed/);
    expect(records["users/alice"].player.workshopVersion).toBe(version);
    const astra = version ? 225 : 125;
    expect(getPlayer().astra).toBe(300 + astra);
    update.mockImplementation(save);
    await loadPlayer("alice");
    expect(getPlayer()).toMatchObject({
      workshopVersion: 2, astra: 300 + astra, crafted: {},
      materials: { goblin_scrap: version ? 16 : 15 },
      workshopRefund: { upgrades: 2, astra },
    });
    expect(records["users/alice"].player).toEqual(getPlayer());
  } finally {
    warning.mockRestore();
  }
});

test.each([true, false])("loading legacy holofoils persists bonuses once with saved base stats: %s", async (hasBaseStats) => {
  const player = existingPlayer();
  const baseStats = { strength: 2, dexterity: 2, intelligence: 2 };
  if (hasBaseStats) player.baseStats = baseStats;
  player.stats = { ...player.stats, strength: 3, dexterity: 2, intelligence: 2 };
  player.powerLevelVersion = 1;
  const foil = {
    id: "legacy-foil", name: "Legacy Foil", rarity: "Legendary", slot: "weapon",
    iLevel: 25, socketCount: 2, price: 100, holofoil: ["#123456", "#abcdef"],
    mainStat: { stat: "strength", value: 1 }, subStats: { speed: 1 },
  };
  player.inventory = [{ ...foil, id: "inventory-foil" }];
  player.equipment = { mainHand: foil };
  player.gearTraderStock = { hour: 123, items: [{ ...foil, id: "stock-foil" }] };
  player.gearTraderBuyback = [{ item: { ...foil, id: "buyback-foil" }, price: 100 }];
  records["users/alice"] = { player, saveRevision: 1 };
  await loadPlayer("alice");
  const upgraded = getPlayer();
  expect(upgraded.equipment.mainHand.price).toBe(200);
  expect(upgraded.equipment.mainHand.mainStat.tier).toBeGreaterThanOrEqual(5);
  expect(upgraded.stats.strength).toBe(2 + upgraded.equipment.mainHand.mainStat.value);
  expect(upgraded.inventory[0].price).toBe(200);
  expect(upgraded.gearTraderStock.items[0].price).toBe(200);
  expect(upgraded.gearTraderBuyback[0].item.price).toBe(200);
  expect(records["users/alice"].player.equipment.mainHand).toEqual(upgraded.equipment.mainHand);
  await loadPlayer("alice");
  expect(getPlayer().equipment.mainHand).toEqual(upgraded.equipment.mainHand);
  expect(getPlayer().stats.strength).toBe(upgraded.stats.strength);
  expect(getPlayer().baseStats).toEqual(baseStats);
});

test.each([true, false])("loading persists fixed gear Power once with saved base stats: %s", async (hasBaseStats) => {
  const player = existingPlayer();
  const baseStats = { strength: 2, dexterity: 2, intelligence: 2 };
  if (hasBaseStats) player.baseStats = baseStats;
  player.powerLevelVersion = 1;
  player.stats = {
    ...player.stats, strength: 2, dexterity: 2, intelligence: 2,
    maxPower: 32, power: 32,
  };
  const gear = {
    id: "power", name: "Power Sword", rarity: "Rare", slot: "weapon",
    iLevel: 100, price: 100, subStats: { maxPower: 15 }, subTiers: { maxPower: 7 },
  };
  player.inventory = [{ ...gear, id: "inventory-power" }];
  player.equipment = { mainHand: gear };
  records["users/alice"] = { player, saveRevision: 1 };
  await loadPlayer("alice");
  const migrated = getPlayer();
  expect(migrated.equipment.mainHand.subStats.maxPower).toBe(7);
  expect(migrated.inventory[0].subStats.maxPower).toBe(7);
  expect(migrated.equipment.mainHand.subTiers.maxPower).toBe(7);
  expect(migrated.stats.maxPower).toBe(24);
  expect(migrated.stats.power).toBeLessThanOrEqual(24);
  expect(records["users/alice"].player.equipment.mainHand).toEqual(migrated.equipment.mainHand);
  await loadPlayer("alice");
  expect(getPlayer().equipment.mainHand).toEqual(migrated.equipment.mainHand);
  expect(getPlayer().stats.maxPower).toBe(24);
  expect(getPlayer().baseStats).toEqual(baseStats);
});

test("a new name is reserved and saved immediately before allocating stats", async () => {
  expect(await savePlayerName("  Nova  ")).toMatchObject({ ok: true });
  expect(records["characterNames/Nova"]).toBe("alice");
  expect(records["users/alice/player"]).toEqual({ name: "Nova", needsNameChange: false });
  expect(records["directory/alice"]).toEqual({ name: "Nova", level: 1 });
  expect(getPlayer().name).toBe("Nova");
  expect(JSON.parse(localStorage.getItem("PlayerMeta")).dirty).toBe(false);
});

test("player saves track Astra gained without counting spending or bank transfers", () => {
  existingPlayer();

  setPlayer({ astra: 500 });
  expect(getPlayer().records.totalAstraGained).toBe(200);

  setPlayer({ astra: 350 });
  setPlayer({ astra: 450 }, { countAstraGain: false });
  expect(getPlayer().records.totalAstraGained).toBe(200);
});

test("renaming preserves progress, spends exactly one elixir, and releases the old name", async () => {
  const player = existingPlayer();
  records["leaderboardEntries/alice/name"] = "Alice";
  expect(await savePlayerName("Nova")).toMatchObject({ ok: true });
  expect(getPlayer()).toMatchObject({
    ...player, name: "Nova", consumables: { elixirOfNameChanging: 1, healthPotion: 4 },
  });
  expect(records["users/alice/player"]).toEqual(getPlayer());
  expect(records["characterNames/Alice"]).toBeNull();
  expect(records["directory/alice"].name).toBe("Nova");
  expect(records["leaderboardEntries/alice/name"]).toBe("Nova");
});

test("atomic reservations reject collisions without changing progress or spending an elixir", async () => {
  const player = existingPlayer();
  records["characterNames/Nova"] = "bob";
  expect(await savePlayerName("Nova")).toMatchObject({ ok: false, message: expect.stringContaining("taken") });
  expect(getPlayer()).toEqual(player);
  expect(update).not.toHaveBeenCalled();
});

test("names of offline legacy players are protected by the directory", async () => {
  records.directory = { bob: { name: "Nova", level: 20 } };
  expect(await savePlayerName("Nova")).toMatchObject({ ok: false });
  expect(runTransaction).not.toHaveBeenCalled();
});

test("names are exact and case-sensitive", async () => {
  records["characterNames/Nova"] = "bob";
  records.directory = { bob: { name: "Nova" } };
  expect(await savePlayerName("nova")).toMatchObject({ ok: true });
});

test.each(["", "123", "Two Names", "a".repeat(65)])("invalid name %s is not saved", async (name) => {
  expect(await savePlayerName(name)).toMatchObject({ ok: false });
  expect(runTransaction).not.toHaveBeenCalled();
});

test.each(["Fuck", "Fucking", "Nigger", "Bitch"])(
  "inappropriate character name %s is rejected before reservation or payment", async (name) => {
    const player = existingPlayer();
    expect(await savePlayerName(name)).toEqual({ ok: false, message: "Please choose an appropriate name." });
    expect(getPlayer()).toEqual(player);
    expect(runTransaction).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  },
);

test("inappropriate names are rejected for new characters too", async () => {
  expect(await savePlayerName("Fuck")).toMatchObject({ ok: false });
  expect(runTransaction).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});

test("renaming releases an old inappropriate name reservation", async () => {
  const player = existingPlayer();
  localStorage.setItem("Player", JSON.stringify({ ...player, name: "Fuck" }));
  records["characterNames/Fuck"] = "alice";
  expect(await savePlayerName("Nova")).toMatchObject({ ok: true });
  expect(records["characterNames/Fuck"]).toBeNull();
});

test("a certificate rename and its cost persist together to the player save", async () => {
  const { renameItem } = require("../../items/certificates");
  const player = existingPlayer();
  const item = { id: "sword", slot: "weapon", name: "Iron Sword", originalOwner: "Alice" };
  localStorage.setItem("Player", JSON.stringify({
    ...player, inventory: [item], consumables: { itemCertificate: 1, healthPotion: 4 },
  }));
  expect(renameItem("sword", "Alice Blade 42")).toMatchObject({ ok: true });
  await flushPlayer();
  expect(records["users/alice/player"].inventory).toEqual([{ ...item, baseType: "Sword", name: "Alice Blade 42" }]);
  expect(records["users/alice/player"].consumables).toEqual({ healthPotion: 4 });
  expect(JSON.parse(localStorage.getItem("Player")).inventory[0].name).toBe("Alice Blade 42");
});

test("existing players cannot rename without an elixir or reuse their own name", async () => {
  const player = existingPlayer();
  expect(await savePlayerName("Alice")).toMatchObject({ ok: false });
  localStorage.setItem("Player", JSON.stringify({ ...player, consumables: {} }));
  expect(await savePlayerName("Nova")).toMatchObject({ ok: false });
  expect(update).not.toHaveBeenCalled();
});

test("failed saves preserve the old name and elixir and release the unused reservation", async () => {
  const player = existingPlayer();
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  update.mockRejectedValueOnce(new Error("offline"));
  expect(await savePlayerName("Nova")).toMatchObject({ ok: false });
  expect(getPlayer()).toEqual(player);
  expect(records["characterNames/Nova"]).toBeNull();
  warn.mockRestore();
});

test("a legacy duplicate gets a free rename without losing progress", async () => {
  const player = existingPlayer();
  records.directory = { aardvark: { name: "Alice" }, alice: { name: "Alice" } };
  records["characterNames/Alice"] = "aardvark";
  await loadPlayer("alice");
  expect(getPlayer().needsNameChange).toBe(true);
  expect(await savePlayerName("Nova")).toMatchObject({ ok: true });
  expect(getPlayer()).toMatchObject({ ...player, name: "Nova", needsNameChange: false });
  expect(records["characterNames/Alice"]).toBe("aardvark");
});

test("signed-out players cannot reserve a name", async () => {
  localStorage.removeItem("PlayerMeta");
  expect(await savePlayerName("Nova")).toMatchObject({ ok: false });
  expect(runTransaction).not.toHaveBeenCalled();
});

test("returning browsers always replace a clean local cache with cloud progress", async () => {
  existingPlayer();
  records["users/alice"].player = { ...records["users/alice"].player, astra: 900 };
  await loadPlayer("alice");
  expect(getPlayer().astra).toBe(900);
  expect(get).toHaveBeenCalledWith("users/alice");
});

test("loading migrates legacy sealed relic consumables into unique materials", async () => {
  const player = existingPlayer();
  player.consumables.relic = 2;
  player.materials = { sealedRelic: 3 };
  records["users/alice"].player = player;

  await loadPlayer("alice");

  expect(getPlayer().materials.sealedRelic).toBe(5);
  expect(getPlayer().consumables).not.toHaveProperty("relic");
  expect(records["users/alice"].player.materials.sealedRelic).toBe(5);
  expect(records["users/alice"].player.consumables).not.toHaveProperty("relic");
});

test("loading an existing character migrates level power and recalculates max power", async () => {
  const player = {
    ...existingPlayer(),
    level: 8,
    baseStats: { strength: 1, dexterity: 1, intelligence: 25 },
    bonusStats: { maxPower: 10 },
    stats: { health: 100, maxHealth: 100, power: 20, maxPower: 20 },
  };
  localStorage.setItem("Player", JSON.stringify(player));
  records["users/alice"].player = player;

  await loadPlayer("alice");

  expect(getPlayer()).toMatchObject({
    powerLevelVersion: 1,
    bonusStats: { maxPower: 3 },
    stats: { maxPower: 12, power: 12 },
  });
  expect(records["users/alice"].player).toMatchObject({
    powerLevelVersion: 1,
    bonusStats: { maxPower: 3 },
    stats: { maxPower: 12 },
  });
});

test("stale dirty progress cannot overwrite a newer save and is backed up", async () => {
  const player = existingPlayer();
  localStorage.setItem("PlayerMeta", JSON.stringify({ uid: "alice", revision: 0, dirty: true }));
  await loadPlayer("alice");
  expect(getPlayer()).toEqual(player);
  expect(JSON.parse(localStorage.getItem("PlayerRecovery/alice")).meta.revision).toBe(0);
  expect(update).not.toHaveBeenCalled();
  expect(getSaveStatus().notice).toMatch(/cloud progress/);
});

test("unsynced progress is recovered only against its matching cloud revision", async () => {
  existingPlayer();
  localStorage.setItem("Player", JSON.stringify({ ...getPlayer(), astra: 600 }));
  localStorage.setItem("PlayerMeta", JSON.stringify({ uid: "alice", revision: 1, dirty: true }));
  await loadPlayer("alice");
  expect(records["users/alice"]).toMatchObject({ saveRevision: 2, player: { astra: 600 } });
});

test("a missing cloud character clears the cached character instead of resurrecting it", async () => {
  existingPlayer();
  records["users/alice"] = { saveRevision: 2 };
  await loadPlayer("alice");
  expect(getPlayer()).toBeNull();
});

test("unversioned unsynced progress can be migrated only when no cloud save exists", async () => {
  const player = existingPlayer();
  delete records["users/alice"];
  localStorage.setItem("PlayerMeta", JSON.stringify({ uid: "alice", dirty: true }));
  await loadPlayer("alice");
  expect(records["users/alice"]).toEqual({ player, saveRevision: 1 });
});

test("unversioned dirty caches never overwrite an existing cloud character", async () => {
  existingPlayer();
  records["users/alice"].player.astra = 900;
  localStorage.setItem("PlayerMeta", JSON.stringify({ uid: "alice", dirty: true }));
  await loadPlayer("alice");
  expect(getPlayer().astra).toBe(900);
  expect(update).not.toHaveBeenCalled();
});

test("gameplay schedules a save immediately rather than after an inactivity window", async () => {
  existingPlayer();
  await loadPlayer("alice");
  setPlayer({ astra: 123 });
  jest.runOnlyPendingTimers();
  await flushPlayer();
  expect(records["users/alice"]).toMatchObject({ saveRevision: 2, player: { astra: 123 } });
});

test("gathering progression and crafted tools persist locally and through cloud saves", async () => {
  existingPlayer();
  await loadPlayer("alice");
  const { createToolItem } = require("../../items/tools");
  const pickaxe = createToolItem({ slot: "pickaxe", iLevel: 20, rarity: "Rare" });
  const gathering = {
    mining: { level: 20, exp: 37, attempts: 12 },
    logging: { level: 5, exp: 18, attempts: 7 },
  };
  setPlayer({ gathering, equipment: { pickaxe }, materials: { bog_iron: 4 } });
  expect(JSON.parse(localStorage.getItem("Player")).gathering).toEqual(gathering);
  await flushPlayer();
  expect(records["users/alice"].player).toMatchObject({
    gathering, materials: { bog_iron: 4 },
    equipment: { pickaxe: { mainStat: pickaxe.mainStat, subStats: pickaxe.subStats } },
  });
  await loadPlayer("alice");
  expect(getPlayer().gathering).toEqual(gathering);
  expect(getPlayer().equipment.pickaxe.mainStat.stat).toBe("gatheringPower");
});

test("saves wait for leaderboard publication before completing or writing newer progress", async () => {
  existingPlayer();
  await loadPlayer("alice");
  const { publishLeaderboardEntry } = require("../../world/leaderboards");
  let finishPublication;
  let publicationStarted;
  const started = new Promise((resolve) => { publicationStarted = resolve; });
  publishLeaderboardEntry.mockImplementationOnce(() => {
    publicationStarted();
    return new Promise((resolve) => { finishPublication = resolve; });
  });
  setPlayer({ astra: 123 });
  let finished = false;
  const first = flushPlayer().then(() => { finished = true; });
  await started;
  expect(records["users/alice"].player.astra).toBe(123);
  expect(finished).toBe(false);

  setPlayer({ astra: 456 });
  const second = flushPlayer();
  await Promise.resolve();
  expect(records["users/alice"].player.astra).toBe(123);

  finishPublication();
  await first;
  await second;
  expect(finished).toBe(true);
  expect(records["users/alice"].player.astra).toBe(456);
  expect(publishLeaderboardEntry).toHaveBeenLastCalledWith("alice", expect.objectContaining({ astra: 456 }));
});

test("leaderboard publication failures are reported without failing confirmed progress saves", async () => {
  existingPlayer();
  await loadPlayer("alice");
  const { publishLeaderboardEntry } = require("../../world/leaderboards");
  const error = new Error("Leaderboard unavailable");
  publishLeaderboardEntry.mockRejectedValueOnce(error);
  const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
  try {
    setPlayer({ astra: 123 });
    await flushPlayer();
    expect(records["users/alice"].player.astra).toBe(123);
    expect(getSaveStatus().error).toBeNull();
    expect(warning).toHaveBeenCalledWith("Couldn't update your leaderboard scores", error);
    setPlayer({ astra: 456 });
    await flushPlayer();
    expect(records["users/alice"].player.astra).toBe(456);
  } finally {
    warning.mockRestore();
  }
});

test("leaving a character waits for its saved leaderboard scores", async () => {
  existingPlayer();
  await loadPlayer("alice");
  const { unloadPlayer } = require("../../character/player");
  const { publishLeaderboardEntry } = require("../../world/leaderboards");
  let finishPublication;
  let publicationStarted;
  const started = new Promise((resolve) => { publicationStarted = resolve; });
  publishLeaderboardEntry.mockImplementationOnce(() => {
    publicationStarted();
    return new Promise((resolve) => { finishPublication = resolve; });
  });
  setPlayer({ astra: 123 });
  const leaving = unloadPlayer();
  await started;
  expect(getPlayer()).toMatchObject({ name: "Alice", astra: 123 });
  expect(localStorage.getItem("PlayerMeta")).not.toBeNull();

  finishPublication();
  await leaving;
  expect(getPlayer()).toBeNull();
  expect(localStorage.getItem("PlayerMeta")).toBeNull();
});

test("changes made while saving remain dirty and are saved in the next revision", async () => {
  existingPlayer();
  await loadPlayer("alice");
  let finish;
  update.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  setPlayer({ astra: 123 });
  const first = flushPlayer();
  await Promise.resolve();
  await Promise.resolve();
  setPlayer({ astra: 456 });
  finish();
  await first;
  expect(getSaveStatus().dirty).toBe(true);
  await flushPlayer();
  expect(records["users/alice"]).toMatchObject({ saveRevision: 3, player: { astra: 456 } });
  expect(getSaveStatus().dirty).toBe(false);
});

test("a remote revision stops stale writes and further gameplay", async () => {
  existingPlayer();
  await loadPlayer("alice");
  const { onValue } = require("firebase/database");
  const listener = onValue.mock.calls.find(([path]) => path === "users/alice/saveRevision")[1];
  listener(snapshot(2));
  expect(getSaveStatus().error).toMatch(/another browser/);
  expect(() => setPlayer({ astra: 0 })).toThrow(/another browser/);
  await expect(flushPlayer()).rejects.toThrow(/another browser/);
});

test("tab working copies are not changed by another tab's localStorage writes", async () => {
  existingPlayer();
  await loadPlayer("alice");
  localStorage.setItem("Player", JSON.stringify({ astra: 0 }));
  expect(getPlayer().astra).toBe(300);
  const copy = getPlayer();
  copy.consumables.healthPotion = 100;
  expect(getPlayer().consumables.healthPotion).toBe(4);
});

test("inventory favorites persist locally and remotely without marking gear as new", async () => {
  existingPlayer();
  await loadPlayer("alice");
  const { toggleFavorite, isFavorite } = require("../../items/favorites");
  setPlayer({ inventory: [{ id: "keepsake", name: "Keepsake" }] });
  const unseen = getPlayer().unseenInventoryItems;
  expect(toggleFavorite("gear", "keepsake")).toEqual({ ok: true, favorite: true });
  expect(getPlayer().unseenInventoryItems).toEqual(unseen);
  expect(JSON.parse(localStorage.getItem("Player")).favoriteInventoryItems.gear).toEqual(["keepsake"]);
  await flushPlayer();
  expect(records["users/alice/player"].favoriteInventoryItems.gear).toEqual(["keepsake"]);
  await loadPlayer("alice");
  expect(isFavorite(getPlayer(), "gear", "keepsake")).toBe(true);
  toggleFavorite("gear", "keepsake");
  await flushPlayer();
  await loadPlayer("alice");
  expect(isFavorite(getPlayer(), "gear", "keepsake")).toBe(false);
});

test("failed atomic transfers are never recovered as ordinary unsynced progress", async () => {
  existingPlayer();
  await loadPlayer("alice");
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  update.mockRejectedValueOnce(new Error("conflict"));
  await expect(commitPlayerChange(() => {
    setPlayer({ astra: 999 });
    return { "inboxState/alice/gift/claimed": true };
  })).rejects.toThrow("conflict");
  expect(getSaveStatus().error).toBeTruthy();
  await loadPlayer("alice");
  expect(getPlayer().astra).toBe(300);
  warn.mockRestore();
});

test("character saves use numeric account keys and never overwrite another slot", async () => {
  const first = "0000000001000000000100000000010000000001";
  const second = "0000000002000000000200000000020000000002";
  records["users/alice"] = {
    saveRevision: 4,
    characters: {
      [first]: { externalId: first, player: { name: "Nova", level: 5, astra: 10 } },
      [second]: { externalId: second, player: { name: "Luna", level: 2, astra: 20 } },
    },
  };
  await loadPlayer("alice", first);
  setPlayer({ astra: 99 });
  await flushPlayer();
  expect(records[`users/alice/characters/${first}/player`].astra).toBe(99);
  expect(records[`users/alice/characters/${second}/player`]).toBeUndefined();
  expect(records["users/alice/player"]).toBeUndefined();
  expect(records[`directory/${first}`].name).toBe("Nova");
  expect(records["users/alice/lastCharacterIdentity"]).toBe(first);
});

test("account-wide titles are included in every character's owned titles", async () => {
  records["users/alice"] = {
    saveRevision: 4,
    accountWideTitles: {
      monarchOfTheOdyssey: true,
      unknownTitle: true,
    },
    characters: {
      "123": {
        externalId: "123",
        player: { publicProfile: true, titles: ["characterTitle"] },
      },
    },
  };
  await loadPlayer("alice", "123");
  expect(getPlayer().titles).toEqual(["characterTitle", "monarchOfTheOdyssey"]);
});

test("existing account-wide titles are recorded on the account during load", async () => {
  records["users/alice"] = {
    saveRevision: 4,
    characters: {
      "123": {
        externalId: "123",
        player: { publicProfile: true, titles: ["monarchOfTheOdyssey"] },
      },
    },
  };
  await loadPlayer("alice", "123");
  expect(update.mock.calls.some(([, writes]) =>
    writes["users/alice/accountWideTitles/monarchOfTheOdyssey"] === true,
  )).toBe(true);
});

test("reset characters do not inherit pre-reset account-wide titles again", async () => {
  records["users/alice"] = {
    saveRevision: 8,
    accountWideTitles: { monarchOfTheOdyssey: true },
    characters: {
      "123": { externalId: "123", player: {
        name: "Nova", publicProfile: true, level: 1, astra: 0,
        resetPending: true, ignoredAccountWideTitles: ["monarchOfTheOdyssey"],
      } },
    },
  };
  await loadPlayer("alice", "123");
  expect(getPlayer().titles).toBeUndefined();
  expect(getPlayer().stats).toBeUndefined();
  expect(getPlayer().resetPending).toBe(true);
});

test("a stale dirty cache cannot resurrect progress after an admin reset", async () => {
  const first = "1".repeat(40);
  localStorage.setItem("Player", JSON.stringify({
    name: "Nova", level: 99, astra: 50000, inventory: [{ name: "Sword" }],
  }));
  localStorage.setItem("PlayerMeta", JSON.stringify({
    uid: first, accountId: "alice", characterId: first, revision: 7, dirty: true,
  }));
  records["users/alice"] = {
    saveRevision: 8,
    characters: {
      [first]: { externalId: first, player: {
        name: "Nova", publicProfile: true, level: 1, astra: 0, resetPending: true,
      } },
    },
  };
  await loadPlayer("alice", first);
  expect(getPlayer()).toMatchObject({ name: "Nova", level: 1, astra: 0, resetPending: true });
  expect(getPlayer().inventory).toBeUndefined();
  expect(getSaveStatus().dirty).toBe(false);
  expect(JSON.parse(localStorage.getItem(`PlayerRecovery/alice/${first}`)).player.astra).toBe(50000);
  expect(update.mock.calls.some(([, writes]) => writes[`users/alice/characters/${first}/player`])).toBe(false);
});

test("an admin reset revision pauses an open character before it can save old progress", async () => {
  records["users/alice"] = {
    saveRevision: 7, player: { name: "Nova", publicProfile: true, level: 50, astra: 5000 },
  };
  await loadPlayer("alice");
  const { onValue } = require("firebase/database");
  const listener = onValue.mock.calls.find(([path]) => path === "users/alice/saveRevision")[1];
  listener(snapshot(8));
  expect(getSaveStatus().error).toMatch(/Reload the cloud save/);
  expect(() => setPlayer({ astra: 9999 })).toThrow(/Reload the cloud save/);
  await expect(flushPlayer()).rejects.toThrow(/Reload the cloud save/);
});

test("another character's dirty cache is never recovered into the selected slot", async () => {
  localStorage.setItem("Player", JSON.stringify({ name: "Other", astra: 999 }));
  localStorage.setItem("PlayerMeta", JSON.stringify({
    uid: "111", accountId: "alice", characterId: "111", revision: 4, dirty: true,
  }));
  records["users/alice"] = {
    saveRevision: 4,
    characters: { "222": { externalId: "222", player: { name: "Luna", astra: 20 } } },
  };
  await loadPlayer("alice", "222");
  expect(getPlayer()).toEqual({ name: "Luna", astra: 20 });
  expect(update).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem("PlayerRecovery/alice/111")).player.astra).toBe(999);
});

test("missing character slots fail instead of loading an empty or cached character", async () => {
  records["users/alice"] = { saveRevision: 1, characters: {} };
  await expect(loadPlayer("alice", "missing")).rejects.toThrow("no longer exists");
});
