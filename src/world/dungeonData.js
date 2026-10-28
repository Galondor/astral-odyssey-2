/*
 Dungeon content. Everything here is data; the rules live in dungeons.js.

 A dungeon type is { id, name, description, color, basics[], elites[], bosses[], puzzles[] }.

 Enemy template (made fresh for each dungeon, scaled by the dungeon rating in dungeons.js):
   id, name
   mod        - optional multipliers on the dungeon tier's stats: { hp, atk, def, spd } (default 1 each)
   abilities  - enemy abilities, same fields as ENEMIES in enemies.js
   phases     - boss/elite phases, same fields as ENEMIES in enemies.js
   drops      - base thematic material drops: [{ key, chance, min, max }]; dungeons.js
                halves ordinary chances and quarters maximum quantities (rounded up), with minimum 1.
                Legendary materials roll at a fixed 50% for 1-2; Unique materials at 10% for 1.
 Dungeon materials: `materials` maps basic, elite and boss to exclusive material keys.
   unique     - bosses only: the Unique item (see UNIQUES) with a 1% chance to drop

 Puzzle / challenge entry: { kind, name, intro, ... } where kind is one of
   sequence  - find the next number in a pattern                 (unit: what the numbers are)
   doors     - exactly one inscription is true, find the safe door (door: noun for a door)
   order     - put the elements in the right order from clues     (items: four names)
   lock      - crack a three digit code from feedback              (lock: noun for the lock)
   gauntlet  - three traps resolved with your stats                (traps: [{ text, type: swing | crush | rune }])
   gamble    - pick one of three containers, one is a snare       (chest: noun for a container)
   circuit   - light every rune by toggling it and its neighbors
   scales    - choose weights to balance a target
   path      - navigate a visible trapped grid to the exit
   pairs     - reveal and remember four matching rune pairs       (symbols: four names)

 Unique items: { id, name, slot, stat, ability, subStats[], twoHanded? }. `ability` is a key of UNIQUE_ABILITIES.
*/

export const UNIQUES = {
  maldrathPhylactery: { 
    id: "maldrathPhylactery",
    name: "Maldrath's Phylactery",
    slot: "necklace",
    stat: "intelligence",
    ability: "Undying Hunger",
    subStats: ["maxPower", "speed", "criticalDamage", "magicAttackPercent", "luck", "agility"]
  },
  kessikBulwark: { 
    id: "kessikBulwark",
    name: "Kessik's Ribcage Bulwark",
    slot: "chestplate",
    stat: "strength",
    ability: "Marrow Ward",
    subStats: ["defense", "resilience", "vitality", "agility", "luck", "attackPercent"]
  },
  hoardkingAxe: { 
    id: "hoardkingAxe",
    name: "Hoardking's Plunderaxe",
    slot: "weapon",
    stat: "strength",
    twoHanded: true,
    ability: "Plunder",
    subStats: ["maxPower", "attackMin", "attackMax", "criticalDamage", "attackPercent", "magicAttackPercent"]
  },
  zugRing: { 
    id: "zugRing",
    name: "Zug's Lucky Sigil",
    slot: "ring",
    stat: "intelligence",
    ability: "Fortune's Spark",
    subStats: ["maxPower", "speed", "criticalDamage", "magicAttackPercent", "luck", "vitality"]
  },
  slagheartGauntlets: { 
    id: "slagheartGauntlets",
    name: "Slagheart Gauntlets",
    slot: "gauntlets",
    stat: "strength",
    ability: "Molten Grip",
    subStats: ["defense", "attackMin", "attackMax", "criticalDamage", "attackPercent", "resilience"]
  },
  ulduGreaves: { 
    id: "ulduGreaves",
    name: "Uldra's Anvilplate Greaves",
    slot: "legs",
    stat: "strength",
    ability: "Tempered Steel",
    subStats: ["resilience", "vitality", "agility", "luck", "attackPercent", "magicAttackPercent"]
  },
  rimeHelm: { 
    id: "rimeHelm",
    name: "Rimebound Greathelm",
    slot: "helmet",
    stat: "strength",
    ability: "Frozen Resolve",
    subStats: ["resilience", "vitality", "agility", "luck", "attackPercent", "magicAttackPercent"]
  },
  ysoldeRapier: { 
    id: "ysoldeRapier",
    name: "Ysolde's Glacial Rapier",
    slot: "weapon",
    stat: "dexterity",
    ability: "Glacial Edge",
    subStats: ["attackMin", "attackMax", "magicAttackMin", "magicAttackMax", "attackPercent", "magicAttackPercent"]
  },
  verdessaBoots: { 
    id: "verdessaBoots",
    name: "Verdessa's Rootstriders",
    slot: "boots",
    stat: "dexterity",
    ability: "Rootstride",
    subStats: ["resilience", "vitality", "agility", "luck", "attackPercent", "magicAttackPercent"]
  },
  heartwoodStaff: { 
    id: "heartwoodStaff",
    name: "Heartwood Staff of Decay",
    slot: "weapon",
    stat: "intelligence",
    twoHanded: true,
    ability: "Bloom of Decay",
    subStats: ["maxPower", "magicAttackMin", "magicAttackMax", "criticalDamage", "attackPercent", "magicAttackPercent"]
  },
  valeOrrery: { 
    id: "valeOrrery",
    name: "Vael's Pocket Orrery",
    slot: "offhand",
    stat: "intelligence",
    ability: "Orbital Focus",
    subStats: ["speed", "resilience", "vitality", "agility", "luck", "magicAttackPercent"]
  },
  cartographerSigil: { 
    id: "cartographerSigil",
    name: "Cartographer's Starbound Band",
    slot: "ring",
    stat: "dexterity",
    ability: "Star-Charted",
    subStats: ["maxPower", "defense", "speed", "criticalDamage", "attackPercent", "magicAttackPercent"]
  },
  unwrittenPath: {
    id: "unwrittenPath",
    name: "The Unwritten Path",
    slot: "weapon",
    stat: "dexterity",
    twoHanded: true,
    ability: "Unwritten Path",
    subStats: ["attackMin", "attackMax", "magicAttackMin", "magicAttackMax", "attackPercent", "magicAttackPercent"],
  },
  astralColossusHeart: {
    id: "astralColossusHeart",
    name: "Heart of the Astral Colossus",
    slot: "necklace",
    stat: "dexterity",
    ability: "Colossus Breaker",
    subStats: ["maxPower", "defense", "speed", "criticalDamage", "attackPercent", "magicAttackPercent"],
  },
};

const stun = (chance) => ({ id: "stun", chance });
const dot = (id, power, turns = 3, chance = 1) => ({ id, power, turns, chance });
const debuff = (id, power, turns = 3, chance = 1) => ({ id, power, turns, chance });

export const DUNGEON_TYPES = {
  crypt: {
    id: "crypt",
    name: "Sunken Crypt",
    color: "#9bb4c9",
    description: "A drowned necropolis where the dead refuse to stay buried.",
    materials: { basic: "crypt_grave_salt", elite: "crypt_soul_shackle", boss: "crypt_regent_marrow" },
    basics: [
      { id: "dgCryptRevenant", name: "Drowned Revenant", mod: { hp: 1.1 }, abilities: [{ name: "Waterlogged Grip", power: 1.1, status: debuff("weaken", 0.2, 2, 0.6), cooldown: 3 }, { name: "Grave Chill", power: 0, status: debuff("vulnerable", 0.2, 3), cooldown: 4, text: "Cold, black water seeps over you." }] },
      { id: "dgCryptBoneArcher", name: "Bone Sentinel", mod: { atk: 1.2, hp: 0.8, spd: 1.2 }, abilities: [{ name: "Volley", power: 0.6, hits: 3, cooldown: 3 }, { name: "Rattling Shot", power: 1.2, status: dot("bleed", 0.04, 3, 0.7) }] },
      { id: "dgCryptGhoul", name: "Crypt Ghoul", mod: { atk: 1.1 }, abilities: [{ name: "Carrion Bite", power: 1.2, leech: 0.5, cooldown: 2 }, { name: "Paralytic Claws", power: 0.9, status: stun(0.3), cooldown: 4 }] },
    ],
    elites: [
      { id: "dgCryptKnight", name: "Entombed Knight", mod: { def: 1.4, hp: 1.1, spd: 0.8 }, abilities: [{ name: "Shield Wall", power: 0, self: { id: "fortify", turns: 3, power: 0.4 }, cooldown: 5, text: "The knight sinks behind a rusted tower shield." }, { name: "Executioner's Cleave", power: 1.7, ignoreDefense: 0.4, cooldown: 3 }, { name: "Dread Command", power: 0, status: debuff("weaken", 0.3, 3), cooldown: 4 }], phases: [{ below: 0.4, text: "The knight's visor glows. It fights without fear.", self: { id: "enrage", turns: 99, power: 0.35 } }], drops: [{ key: "wraith_essence", chance: 1, min: 2, max: 3 }, { key: "primal_essence", chance: 0.5, min: 1, max: 1 }] },
      { id: "dgCryptNecromancer", name: "Tidebound Necromancer", mod: { atk: 1.2, hp: 0.9 }, abilities: [{ name: "Soul Siphon", power: 1.4, leech: 0.8, cooldown: 2 }, { name: "Bone Cage", power: 0.5, status: stun(0.5), cooldown: 4 }, { name: "Rotting Curse", power: 0.8, status: dot("poison", 0.04, 4), cooldown: 3 }], phases: [{ below: 0.5, text: "The necromancer drinks from a skull of black water!", heal: 0.15, self: { id: "regen", turns: 4, power: 0.03 } }], drops: [{ key: "wraith_essence", chance: 1, min: 2, max: 4 }, { key: "primal_essence", chance: 0.6, min: 1, max: 2 }] },
    ],
    bosses: [
      { id: "dgCryptLich", name: "Lich-Regent Maldrath", mod: { atk: 1.1 }, unique: "maldrathPhylactery", abilities: [{ name: "Soul Rend", power: 1.7, leech: 0.7, cooldown: 2 }, { name: "Tomb Silence", power: 0.6, status: stun(0.55), cooldown: 4 }, { name: "Death's Embrace", power: 1.1, status: dot("bleed", 0.06, 3), cooldown: 3 }, { name: "Withering Aura", power: 0, status: debuff("vulnerable", 0.35, 3), cooldown: 5, text: "The Regent's gaze strips the strength from your bones." }], phases: [{ below: 0.7, text: "Maldrath tears open his ribcage. Souls pour out to shield him.", self: { id: "fortify", turns: 4, power: 0.35 } }, { below: 0.4, text: "The Regent screams the names of the dead!", self: { id: "enrage", turns: 99, power: 0.5 } }, { below: 0.2, text: "Maldrath clutches his phylactery and drains the room!", heal: 0.12, self: { id: "regen", turns: 99, power: 0.03 } }], drops: [{ key: "wraith_crown", chance: 0.6, min: 1, max: 1 }, { key: "wraith_essence", chance: 1, min: 6, max: 9 }, { key: "primal_essence", chance: 1, min: 2, max: 4 }] },
      { id: "dgCryptBonewarden", name: "Bonewarden Kessik", mod: { def: 1.3, hp: 1.15, spd: 0.85 }, unique: "kessikBulwark", abilities: [{ name: "Ossuary Slam", power: 1.8, status: stun(0.4), cooldown: 3 }, { name: "Marrow Armor", power: 0, self: { id: "fortify", turns: 3, power: 0.45 }, cooldown: 5, text: "Kessik's bones knit into plates." }, { name: "Skeletal Barrage", power: 0.6, hits: 4, cooldown: 3 }, { name: "Hollow Scream", power: 0, status: debuff("weaken", 0.35, 3), cooldown: 4 }], phases: [{ below: 0.5, text: "Kessik shatters his own ribs, becoming a whirling storm of shards.", self: { id: "enrage", turns: 99, power: 0.45 } }, { below: 0.25, text: "The Bonewarden reassembles, fresh and furious!", heal: 0.1 }], drops: [{ key: "wraith_crown", chance: 0.5, min: 1, max: 1 }, { key: "wraith_essence", chance: 1, min: 5, max: 8 }, { key: "primal_essence", chance: 1, min: 2, max: 3 }] },
    ],
    puzzles: [
      { kind: "order", name: "Tomb of Four Tides", intro: "Four stone basins ring a sarcophagus. Each must be filled in the right order or the crypt floods.", items: ["Tide", "Brine", "Silt", "Foam"] },
      { kind: "doors", name: "Hall of Epitaphs", intro: "Four sealed crypt doors, each with an epitaph. Only ONE epitaph speaks the truth.", door: "crypt door" },
      { kind: "gauntlet", name: "Flooded Corridor", intro: "The corridor is rigged to drown trespassers.", traps: [{ text: "Rusted scythes sweep out of the walls.", type: "swing" }, { text: "The ceiling groans and a slab drops.", type: "crush" }, { text: "Drowned runes flare beneath the water.", type: "rune" }, { text: "A pendulum blade arcs across the passage.", type: "swing" }, { text: "A tomb door slams down.", type: "crush" }] },
      { kind: "lock", name: "Reliquary Lock", intro: "A reliquary seals the way, guarded by a three digit bone dial.", lock: "bone dial" },
      { kind: "circuit", name: "Soul Lanterns", intro: "Five linked soul lanterns must burn together to release the tomb seal." },
      { kind: "scales", name: "Ferryman's Scales", intro: "Balance the ferryman's offering against the weight of a drowned soul." },
      { kind: "path", name: "Ossuary Causeway", intro: "Find a route over the intact burial stones without stepping into the drowned pits." },
      { kind: "pairs", name: "Names of the Drowned", intro: "Reunite the paired grave sigils. False matches awaken the dead.", symbols: ["Skull", "Tide", "Bone", "Soul"] },
    ],
  },

  warren: {
    id: "warren",
    name: "Goblin Warren",
    color: "#7bd88f",
    description: "A sprawling nest of tunnels, rigged with traps and ruled by a greedy king.",
    materials: { basic: "warren_blasting_powder", elite: "warren_hexbone", boss: "warren_hoard_seal" },
    basics: [
      { id: "dgWarrenCutthroat", name: "Warren Cutthroat", mod: { spd: 1.3, hp: 0.8, atk: 1.15 }, abilities: [{ name: "Backstab", power: 1.4, status: dot("bleed", 0.04, 3, 0.8), cooldown: 2 }, { name: "Pocket Sand", power: 0, status: debuff("weaken", 0.25, 2), cooldown: 4, text: "A fistful of grit hits your eyes." }] },
      { id: "dgWarrenBomber", name: "Powder Goblin", mod: { hp: 0.7, atk: 1.3 }, abilities: [{ name: "Blast Charge", power: 1.8, status: dot("burn", 0.05, 3, 0.8), cooldown: 3 }, { name: "Smoke Bomb", power: 0, self: { id: "fortify", turns: 2, power: 0.3 }, cooldown: 5 }] },
      { id: "dgWarrenBrute", name: "Warren Brute", mod: { hp: 1.35, atk: 1.1, spd: 0.7 }, abilities: [{ name: "Bone Club", power: 1.5, status: stun(0.3), cooldown: 3 }, { name: "Bellow", power: 0, self: { id: "enrage", turns: 3, power: 0.3 }, cooldown: 5, text: "The brute bellows and beats its chest." }] },
    ],
    elites: [
      { id: "dgWarrenWarboss", name: "Goblin Warboss", mod: { atk: 1.15, hp: 1.1 }, abilities: [{ name: "Rally Cry", power: 0, self: { id: "enrage", turns: 3, power: 0.4 }, cooldown: 5, text: "\"Kill it! KILL IT!\"" }, { name: "Cleaver Frenzy", power: 0.8, hits: 3, cooldown: 3 }, { name: "Dirty Trick", power: 1, status: debuff("vulnerable", 0.3, 3), cooldown: 4 }], phases: [{ below: 0.4, text: "The warboss quaffs a bubbling potion!", heal: 0.15, self: { id: "regen", turns: 3, power: 0.04 } }], drops: [{ key: "goblin_scrap", chance: 1, min: 4, max: 6 }, { key: "primal_essence", chance: 0.5, min: 1, max: 1 }] },
      { id: "dgWarrenShaman", name: "Hexbone Shaman", mod: { atk: 1.25, hp: 0.85 }, abilities: [{ name: "Hex Bolt", power: 1.5, status: debuff("weaken", 0.3, 3, 0.7), cooldown: 2 }, { name: "Cackling Bind", power: 0.5, status: stun(0.5), cooldown: 4 }, { name: "Blood Offering", power: 0, heal: 0.18, cooldown: 5, text: "The shaman slashes his palm and chants." }], drops: [{ key: "goblin_scrap", chance: 1, min: 4, max: 6 }, { key: "venom_sac", chance: 0.7, min: 1, max: 3 }, { key: "primal_essence", chance: 0.6, min: 1, max: 2 }] },
    ],
    bosses: [
      { id: "dgWarrenKing", name: "Gorbash the Hoard-King", mod: { hp: 1.2, atk: 1.1, def: 1.2 }, unique: "hoardkingAxe", abilities: [{ name: "Hoard Slam", power: 1.9, status: stun(0.4), cooldown: 3 }, { name: "Gold-Fueled Rage", power: 0, self: { id: "enrage", turns: 3, power: 0.45 }, cooldown: 5, text: "Gorbash throws coins into his mouth and roars." }, { name: "Crown Throw", power: 1.2, ignoreDefense: 0.5, cooldown: 3 }, { name: "Greedy Maul", power: 1.3, leech: 0.5, cooldown: 2 }], phases: [{ below: 0.6, text: "Gorbash calls his guard. A wave of goblins buffs him!", self: { id: "fortify", turns: 4, power: 0.3 } }, { below: 0.3, text: "\"MINE! ALL OF IT MINE!\"", self: { id: "enrage", turns: 99, power: 0.5 } }], drops: [{ key: "goblin_scrap", chance: 1, min: 8, max: 12 }, { key: "primal_essence", chance: 1, min: 2, max: 4 }] },
      { id: "dgWarrenMother", name: "Skreeva, Warren Mother", mod: { hp: 1.1, spd: 1.2 }, unique: "zugRing", abilities: [{ name: "Brood Call", power: 0.6, hits: 4, cooldown: 3 }, { name: "Venom Spit", power: 1.2, status: dot("poison", 0.05, 4), cooldown: 2 }, { name: "Nest Defense", power: 0, self: { id: "fortify", turns: 3, power: 0.4 }, cooldown: 5 }, { name: "Devour Runt", power: 0, heal: 0.15, cooldown: 4, text: "Skreeva devours one of her own brood." }], phases: [{ below: 0.5, text: "The Warren Mother shrieks, and the tunnel walls erupt with goblins!", self: { id: "enrage", turns: 99, power: 0.4 } }], drops: [{ key: "goblin_scrap", chance: 1, min: 8, max: 12 }, { key: "venom_sac", chance: 1, min: 3, max: 5 }, { key: "primal_essence", chance: 1, min: 2, max: 3 }] },
    ],
    puzzles: [
      { kind: "gamble", name: "Treasure Hoard", intro: "Heaps of loot fill the chamber. Every goblin knows the biggest prizes are rigged.", chest: "loot chest" },
      { kind: "gauntlet", name: "Booby-Trapped Tunnel", intro: "The tunnel is thick with goblin engineering.", traps: [{ text: "Spiked logs swing across the tunnel.", type: "swing" }, { text: "A rockfall rigged to a tripwire.", type: "crush" }, { text: "A crude tangle of pressure plates and strings.", type: "rune" }, { text: "Whirling saw blades on a rope.", type: "swing" }, { text: "A barrel of rocks tips from above.", type: "crush" }] },
      { kind: "sequence", name: "Tally Sticks", intro: "A goblin accountant's notches count out a pattern. The next notch opens the door.", unit: "notches" },
      { kind: "doors", name: "Warren Crossroads", intro: "Four tunnels. A goblin has scratched a claim above each. Exactly one claim is true.", door: "tunnel" },
      { kind: "circuit", name: "Goblin Fuseboard", intro: "Light all five linked fuse lamps to unlock the blast door." },
      { kind: "scales", name: "Hoardkeeper's Toll", intro: "Choose the right combination of stolen weights to balance the toll." },
      { kind: "path", name: "Tripwire Walkway", intro: "Cross the tunnel floor using intact stones, avoiding the marked tripwires." },
      { kind: "pairs", name: "Smuggler's Marks", intro: "Match the hidden smugglers' signs without triggering their traps.", symbols: ["Coin", "Dagger", "Bomb", "Crown"] },
    ],
  },

  forge: {
    id: "forge",
    name: "Infernal Forge",
    color: "#ff8a3d",
    description: "A volcanic foundry where fire elementals and bound constructs hammer out war.",
    materials: { basic: "forge_cinder_flux", elite: "forge_tempered_alloy", boss: "forge_slagheart" },
    basics: [
      { id: "dgForgeSlagling", name: "Slagling", mod: { hp: 1.15 }, abilities: [{ name: "Molten Spit", power: 1.2, status: dot("burn", 0.05, 3, 0.8), cooldown: 2 }, { name: "Cooling Crust", power: 0, self: { id: "fortify", turns: 2, power: 0.35 }, cooldown: 5 }] },
      { id: "dgForgeAutomaton", name: "Bellows Automaton", mod: { def: 1.3, spd: 0.8 }, abilities: [{ name: "Piston Punch", power: 1.5, status: stun(0.35), cooldown: 3 }, { name: "Overpressure", power: 0, self: { id: "enrage", turns: 3, power: 0.3 }, cooldown: 5, text: "Steam screams from its joints." }] },
      { id: "dgForgeEmberImp", name: "Ember Imp", mod: { spd: 1.4, hp: 0.7, atk: 1.15 }, abilities: [{ name: "Flicker Strike", power: 0.7, hits: 3, cooldown: 3 }, { name: "Cinder Cloud", power: 0.9, status: dot("burn", 0.04, 3, 1), cooldown: 3 }] },
    ],
    elites: [
      { id: "dgForgeSmith", name: "Cinderbound Smith", mod: { atk: 1.2, def: 1.2 }, abilities: [{ name: "Hammer Strike", power: 1.8, ignoreDefense: 0.35, cooldown: 3 }, { name: "Quench", power: 0, heal: 0.15, cooldown: 5 }, { name: "Red-Hot Chain", power: 1, status: stun(0.4), cooldown: 4 }], phases: [{ below: 0.4, text: "The smith drives his hammer into the forge. Sparks rain down!", self: { id: "enrage", turns: 99, power: 0.35 } }], drops: [{ key: "ember_core", chance: 1, min: 3, max: 4 }, { key: "obsidian_shard", chance: 1, min: 3, max: 5 }, { key: "primal_essence", chance: 0.5, min: 1, max: 1 }] },
      { id: "dgForgeHound", name: "Magma Hound", mod: { spd: 1.3, hp: 1.1 }, abilities: [{ name: "Scorching Bite", power: 1.3, status: dot("burn", 0.06, 3), cooldown: 2 }, { name: "Lava Pounce", power: 1.6, status: stun(0.4), cooldown: 4 }, { name: "Heat Haze", power: 0, status: debuff("weaken", 0.3, 3), cooldown: 4 }], drops: [{ key: "ember_core", chance: 1, min: 3, max: 5 }, { key: "beast_fang", chance: 0.7, min: 1, max: 3 }, { key: "primal_essence", chance: 0.6, min: 1, max: 2 }] },
    ],
    bosses: [
      { id: "dgForgeTyrant", name: "Ignarok, the Slag Tyrant", mod: { hp: 1.15, atk: 1.15, def: 1.1 }, unique: "slagheartGauntlets", abilities: [{ name: "Molten Cascade", power: 1.7, status: dot("burn", 0.07, 4), cooldown: 3 }, { name: "Anvil Drop", power: 2, status: stun(0.45), cooldown: 4 }, { name: "Slag Armor", power: 0, self: { id: "fortify", turns: 3, power: 0.45 }, cooldown: 5 }, { name: "Searing Chain", power: 0.7, hits: 3, ignoreDefense: 0.3, cooldown: 3 }], phases: [{ below: 0.65, text: "Ignarok opens a vent. The room becomes an oven!", self: { id: "enrage", turns: 99, power: 0.3 } }, { below: 0.35, text: "The Tyrant melts his own armor into a blade of slag!", self: { id: "enrage", turns: 99, power: 0.4 } }], drops: [{ key: "infernal_heart", chance: 0.6, min: 1, max: 1 }, { key: "ember_core", chance: 1, min: 6, max: 9 }, { key: "primal_essence", chance: 1, min: 2, max: 4 }] },
      { id: "dgForgeMaster", name: "Forgemaster Uldra", mod: { def: 1.4, spd: 0.9 }, unique: "ulduGreaves", abilities: [{ name: "Tempered Blow", power: 1.8, ignoreDefense: 0.4, cooldown: 3 }, { name: "Re-Forge", power: 0, heal: 0.18, cooldown: 6, text: "Uldra hammers dents from her armor." }, { name: "Sparkstorm", power: 0.6, hits: 4, status: dot("burn", 0.04, 3, 0.6), cooldown: 3 }, { name: "Brand", power: 1, status: debuff("vulnerable", 0.35, 3), cooldown: 4 }], phases: [{ below: 0.5, text: "Uldra's forge-golems pour molten metal over her!", self: { id: "fortify", turns: 4, power: 0.4 } }, { below: 0.25, text: "\"Nothing leaves my forge unfinished!\"", self: { id: "enrage", turns: 99, power: 0.5 } }], drops: [{ key: "infernal_heart", chance: 0.5, min: 1, max: 1 }, { key: "obsidian_shard", chance: 1, min: 6, max: 9 }, { key: "primal_essence", chance: 1, min: 2, max: 3 }] },
    ],
    puzzles: [
      { kind: "order", name: "The Four Cauldrons", intro: "Four cauldrons feed the great forge. Light them in the wrong order and the furnace backfires.", items: ["Ember", "Slag", "Cinder", "Ore"] },
      { kind: "lock", name: "Foreman's Vault", intro: "A heavy vault, closed by a three digit gear lock.", lock: "gear lock" },
      { kind: "gauntlet", name: "Foundry Floor", intro: "Machinery roars on every side.", traps: [{ text: "Hammers swing across the walkway.", type: "swing" }, { text: "A crucible tips, pouring a river of fire.", type: "crush" }, { text: "Fire-runes crackle along the pipes.", type: "rune" }, { text: "A spinning blade-press.", type: "swing" }, { text: "A hydraulic press slams down.", type: "crush" }] },
      { kind: "sequence", name: "Furnace Gauge", intro: "A gauge ticks through readings in a strict pattern. Set the dial to the next reading.", unit: "degrees" },
      { kind: "circuit", name: "Ignition Array", intro: "Bring all five linked furnace runes online to open the firebreak." },
      { kind: "scales", name: "Alloy Counterweight", intro: "Balance the forge lift with the correct combination of metal weights." },
      { kind: "path", name: "Slagstone Crossing", intro: "Plan a route across intact stepping stones above the molten slag." },
      { kind: "pairs", name: "Smith's Seals", intro: "Match the hidden foundry stamps. Wrong pairs vent searing steam.", symbols: ["Anvil", "Hammer", "Flame", "Tongs"] },
    ],
  },

  citadel: {
    id: "citadel",
    name: "Frozen Citadel",
    color: "#8fd8ff",
    description: "A fortress sealed in ice, held by frost wraiths and a vengeful pale court.",
    materials: { basic: "citadel_rime_shard", elite: "citadel_pale_sigil", boss: "citadel_winter_heart" },
    basics: [
      { id: "dgCitadelHusk", name: "Frostbitten Husk", mod: { hp: 1.2, spd: 0.8 }, abilities: [{ name: "Numbing Grasp", power: 1.1, status: debuff("weaken", 0.25, 3, 0.8), cooldown: 3 }, { name: "Icy Skin", power: 0, self: { id: "fortify", turns: 2, power: 0.3 }, cooldown: 5 }] },
      { id: "dgCitadelWisp", name: "Rime Wisp", mod: { atk: 1.25, hp: 0.7, spd: 1.3 }, abilities: [{ name: "Shard Barrage", power: 0.6, hits: 3, cooldown: 3 }, { name: "Flash Freeze", power: 0.7, status: stun(0.35), cooldown: 4 }] },
      { id: "dgCitadelSentry", name: "Icebound Sentry", mod: { def: 1.4, atk: 1.1 }, abilities: [{ name: "Glaive Sweep", power: 1.4, status: dot("bleed", 0.04, 3, 0.7), cooldown: 2 }, { name: "Frozen Stance", power: 0, self: { id: "fortify", turns: 3, power: 0.4 }, cooldown: 5 }] },
    ],
    elites: [
      { id: "dgCitadelKnight", name: "Pale Court Knight", mod: { atk: 1.2, def: 1.2 }, abilities: [{ name: "Frostbrand", power: 1.6, status: debuff("vulnerable", 0.3, 3, 0.8), cooldown: 3 }, { name: "Glacial Charge", power: 1.5, status: stun(0.4), cooldown: 4 }, { name: "Ice Armor", power: 0, self: { id: "fortify", turns: 3, power: 0.4 }, cooldown: 5 }], phases: [{ below: 0.4, text: "The knight's helm splits. Ice flows through him like blood.", self: { id: "regen", turns: 99, power: 0.03 } }], drops: [{ key: "wraith_essence", chance: 1, min: 3, max: 4 }, { key: "primal_essence", chance: 0.5, min: 1, max: 2 }] },
      { id: "dgCitadelWitch", name: "Winterbound Witch", mod: { atk: 1.3, hp: 0.85 }, abilities: [{ name: "Blizzard", power: 1.2, hits: 2, status: debuff("weaken", 0.3, 3, 0.6), cooldown: 3 }, { name: "Frostbite Hex", power: 0.9, status: dot("bleed", 0.06, 3), cooldown: 3 }, { name: "Cold Snap", power: 0.5, status: stun(0.5), cooldown: 4 }], drops: [{ key: "wraith_essence", chance: 1, min: 3, max: 5 }, { key: "primal_essence", chance: 0.6, min: 1, max: 2 }] },
    ],
    bosses: [
      { id: "dgCitadelWyrm", name: "Frostmaw, Glacier Wyrm", mod: { hp: 1.3, def: 1.2 }, unique: "rimeHelm", abilities: [{ name: "Glacial Breath", power: 1.9, status: debuff("weaken", 0.35, 3, 0.9), cooldown: 3 }, { name: "Tail Crash", power: 1.5, status: stun(0.4), cooldown: 3 }, { name: "Ice Plate", power: 0, self: { id: "fortify", turns: 3, power: 0.45 }, cooldown: 5 }, { name: "Rending Fangs", power: 0.8, hits: 3, status: dot("bleed", 0.05, 3, 0.7), cooldown: 3 }], phases: [{ below: 0.6, text: "Frostmaw bursts from the ice, shedding glacial armor!", self: { id: "enrage", turns: 99, power: 0.3 } }, { below: 0.3, text: "The air itself freezes around the Wyrm!", self: { id: "enrage", turns: 99, power: 0.45 } }], drops: [{ key: "beast_fang", chance: 1, min: 3, max: 5 }, { key: "primal_essence", chance: 1, min: 2, max: 4 }] },
      { id: "dgCitadelQueen", name: "Queen Ysolde the Pale", mod: { atk: 1.2, spd: 1.2 }, unique: "ysoldeRapier", abilities: [{ name: "Thousand Cuts", power: 0.55, hits: 5, cooldown: 3 }, { name: "Frozen Heart", power: 1.8, leech: 0.7, cooldown: 3 }, { name: "Winter's Decree", power: 0, status: stun(0.55), cooldown: 5, text: "\"Kneel.\"" }, { name: "Mirror of Ice", power: 0, self: { id: "fortify", turns: 3, power: 0.4 }, cooldown: 5 }], phases: [{ below: 0.5, text: "Ysolde sheds her crown. The citadel quakes.", self: { id: "enrage", turns: 99, power: 0.45 } }, { below: 0.25, text: "The Pale Queen turns the room to glass and slow death.", self: { id: "regen", turns: 99, power: 0.03 } }], drops: [{ key: "wraith_crown", chance: 0.6, min: 1, max: 1 }, { key: "wraith_essence", chance: 1, min: 6, max: 8 }, { key: "primal_essence", chance: 1, min: 2, max: 4 }] },
    ],
    puzzles: [
      { kind: "sequence", name: "Frozen Clockwork", intro: "A clock of frozen gears ticks through a sequence. Set the next hand to thaw the door.", unit: "ticks" },
      { kind: "order", name: "Court of Four Seasons", intro: "Four ice statues each hold a season. The throne room opens only in the right order.", items: ["Spring", "Summer", "Autumn", "Winter"] },
      { kind: "gamble", name: "Frozen Vault", intro: "Frozen caskets line the hall. Some hold treasure, some hold a cold surprise.", chest: "frozen casket" },
      { kind: "gauntlet", name: "Icefall Bridge", intro: "The bridge is brittle and booby-trapped.", traps: [{ text: "Icicle blades swing from the arches.", type: "swing" }, { text: "An avalanche rumbles down.", type: "crush" }, { text: "Frost-runes glow beneath the ice.", type: "rune" }, { text: "Whirling shards of ice.", type: "swing" }, { text: "The bridge collapses in slabs.", type: "crush" }] },
      { kind: "circuit", name: "Aurora Ward", intro: "Illuminate all five linked frost sigils to lower the winter ward." },
      { kind: "scales", name: "Icebound Balance", intro: "Select ice weights to balance the frozen court's ceremonial scales." },
      { kind: "path", name: "Crevasse Crossing", intro: "Cross intact ice tiles and avoid the clearly marked cracks." },
      { kind: "pairs", name: "Winter's Reflections", intro: "Match the hidden winter emblems. False reflections bite with frost.", symbols: ["Snowflake", "Icicle", "Wolf", "Moon"] },
    ],
  },

  overgrowth: {
    id: "overgrowth",
    name: "Verdant Overgrowth",
    color: "#58d68d",
    description: "A ruin swallowed by hungry roots, poison spores and a rotting heart.",
    materials: { basic: "overgrowth_spore_fiber", elite: "overgrowth_blight_resin", boss: "overgrowth_heartseed" },
    basics: [
      { id: "dgGrowthSporeling", name: "Sporeling", mod: { hp: 0.9, atk: 1.1 }, abilities: [{ name: "Spore Burst", power: 1, status: dot("poison", 0.04, 4, 1), cooldown: 2 }, { name: "Choking Cloud", power: 0, status: debuff("weaken", 0.25, 3), cooldown: 4 }] },
      { id: "dgGrowthVinewalker", name: "Strangler Vine", mod: { hp: 1.2, spd: 0.8 }, abilities: [{ name: "Constrict", power: 1.2, status: stun(0.4), cooldown: 3 }, { name: "Regrowth", power: 0, heal: 0.12, cooldown: 4 }] },
      { id: "dgGrowthStalker", name: "Thorn Stalker", mod: { spd: 1.3, atk: 1.2, hp: 0.8 }, abilities: [{ name: "Thorn Volley", power: 0.6, hits: 3, status: dot("bleed", 0.03, 3, 0.7), cooldown: 3 }, { name: "Lunge", power: 1.6, cooldown: 3 }] },
    ],
    elites: [
      { id: "dgGrowthTreant", name: "Rotbark Treant", mod: { hp: 1.3, def: 1.3, spd: 0.7 }, abilities: [{ name: "Root Slam", power: 1.7, status: stun(0.4), cooldown: 3 }, { name: "Bark Shell", power: 0, self: { id: "fortify", turns: 3, power: 0.45 }, cooldown: 5 }, { name: "Leeching Roots", power: 1.2, leech: 0.7, cooldown: 3 }], phases: [{ below: 0.4, text: "The treant splits. Fresh shoots race across its trunk.", self: { id: "regen", turns: 99, power: 0.03 } }], drops: [{ key: "rotwood_bark", chance: 1, min: 4, max: 6 }, { key: "venom_sac", chance: 0.8, min: 2, max: 3 }, { key: "primal_essence", chance: 0.5, min: 1, max: 2 }] },
      { id: "dgGrowthDruid", name: "Blighted Druid", mod: { atk: 1.25, hp: 0.9 }, abilities: [{ name: "Wither", power: 1.3, status: dot("poison", 0.05, 4), cooldown: 2 }, { name: "Ensnare", power: 0.5, status: stun(0.5), cooldown: 4 }, { name: "Leaf Mend", power: 0, heal: 0.18, cooldown: 5 }], drops: [{ key: "rotwood_bark", chance: 1, min: 3, max: 5 }, { key: "venom_sac", chance: 1, min: 2, max: 4 }, { key: "primal_essence", chance: 0.6, min: 1, max: 2 }] },
    ],
    bosses: [
      { id: "dgGrowthMother", name: "Thornmother Verdessa", mod: { hp: 1.2, atk: 1.1 }, unique: "verdessaBoots", abilities: [{ name: "Briar Lash", power: 0.7, hits: 4, status: dot("bleed", 0.04, 3, 0.8), cooldown: 3 }, { name: "Strangling Embrace", power: 1.8, status: stun(0.45), cooldown: 4 }, { name: "Spore Bloom", power: 1, status: dot("poison", 0.07, 4, 1), cooldown: 3 }, { name: "Devouring Roots", power: 1.4, leech: 0.8, cooldown: 3 }], phases: [{ below: 0.6, text: "Verdessa's body splits into a thicket of thorns!", self: { id: "fortify", turns: 4, power: 0.35 } }, { below: 0.3, text: "The whole dungeon writhes in answer to her call!", self: { id: "enrage", turns: 99, power: 0.5 } }], drops: [{ key: "rotwood_bark", chance: 1, min: 5, max: 8 }, { key: "venom_sac", chance: 1, min: 5, max: 8 }, { key: "primal_essence", chance: 1, min: 2, max: 4 }] },
      { id: "dgGrowthHeart", name: "The Rotting Heart", mod: { hp: 1.4, def: 1.2, spd: 0.7 }, unique: "heartwoodStaff", abilities: [{ name: "Pulse of Decay", power: 1.6, status: dot("poison", 0.07, 4), cooldown: 2 }, { name: "Overgrowth", power: 0, heal: 0.15, self: { id: "regen", turns: 3, power: 0.04 }, cooldown: 5 }, { name: "Rot Spears", power: 0.8, hits: 3, ignoreDefense: 0.35, cooldown: 3 }, { name: "Miasma", power: 0, status: debuff("vulnerable", 0.35, 3), cooldown: 4 }], phases: [{ below: 0.5, text: "The Heart pounds faster. Spores fill the air!", self: { id: "enrage", turns: 99, power: 0.45 } }, { below: 0.25, text: "The Rotting Heart tears itself free of its roots!", self: { id: "enrage", turns: 99, power: 0.3 } }], drops: [{ key: "rotwood_bark", chance: 1, min: 6, max: 9 }, { key: "venom_sac", chance: 1, min: 6, max: 9 }, { key: "primal_essence", chance: 1, min: 2, max: 3 }] },
    ],
    puzzles: [
      { kind: "doors", name: "Maze of Roots", intro: "Four root-choked passages, each with a carved claim. Exactly one claim is true.", door: "root passage" },
      { kind: "gamble", name: "Fruiting Grove", intro: "Strange fruit hangs everywhere. Some feed you, some poison you, some bite.", chest: "seed pod" },
      { kind: "order", name: "Ritual of the Four Blooms", intro: "Four sacred flowers must bloom in the right order or the grove turns on you.", items: ["Rosebud", "Lotus", "Nightshade", "Fern"] },
      { kind: "lock", name: "Heartwood Gate", intro: "A living gate, twisted shut by a three digit knot of vines.", lock: "vine knot" },
      { kind: "circuit", name: "Bioluminescent Roots", intro: "Light all five linked root nodes to coax the living gate open." },
      { kind: "scales", name: "Offering of the Grove", intro: "Choose seed weights to balance the grove's ancient offering bowl." },
      { kind: "path", name: "Sporebed Passage", intro: "Navigate intact stones without disturbing the marked spore beds." },
      { kind: "pairs", name: "Twin Blooms", intro: "Find matching flower sigils beneath the leaves. Wrong pairs release thorns.", symbols: ["Rose", "Lotus", "Fern", "Thistle"] },
    ],
  },

  observatory: {
    id: "observatory",
    name: "Void Observatory",
    color: "#c39bff",
    description: "A fallen astral temple where stargazers bargain with the void.",
    materials: { basic: "observatory_void_dust", elite: "observatory_rift_thread", boss: "observatory_star_core" },
    basics: [
      { id: "dgVoidMote", name: "Void Mote", mod: { hp: 0.8, atk: 1.2, spd: 1.2 }, abilities: [{ name: "Starprick", power: 0.6, hits: 3, cooldown: 3 }, { name: "Nullspark", power: 1.1, status: debuff("vulnerable", 0.25, 3, 0.7), cooldown: 3 }] },
      { id: "dgVoidAcolyte", name: "Star-Blind Acolyte", mod: { atk: 1.1 }, abilities: [{ name: "Cosmic Chant", power: 1.2, status: debuff("weaken", 0.25, 3, 0.8), cooldown: 3 }, { name: "Gravity Well", power: 0.5, status: stun(0.4), cooldown: 4 }] },
      { id: "dgVoidSentinel", name: "Orrery Sentinel", mod: { def: 1.4, hp: 1.1, spd: 0.8 }, abilities: [{ name: "Orbit Strike", power: 1.4, cooldown: 2, ignoreDefense: 0.2 }, { name: "Eclipse Shield", power: 0, self: { id: "fortify", turns: 3, power: 0.4 }, cooldown: 5 }] },
    ],
    elites: [
      { id: "dgVoidWeaver", name: "Void Weaver", mod: { atk: 1.25, spd: 1.1 }, abilities: [{ name: "Rift Slash", power: 1.7, ignoreDefense: 0.4, cooldown: 3 }, { name: "Collapse", power: 0.6, status: stun(0.5), cooldown: 4 }, { name: "Siphon Star", power: 1.1, leech: 0.8, cooldown: 3 }], phases: [{ below: 0.4, text: "The Weaver steps through itself, doubling in power.", self: { id: "enrage", turns: 99, power: 0.35 } }], drops: [{ key: "wraith_essence", chance: 1, min: 3, max: 4 }, { key: "primal_essence", chance: 0.6, min: 1, max: 2 }] },
      { id: "dgVoidAstronomer", name: "Mad Astronomer", mod: { atk: 1.3, hp: 0.85 }, abilities: [{ name: "Meteor Call", power: 2, status: dot("burn", 0.05, 3, 0.8), cooldown: 4 }, { name: "Falling Stars", power: 0.55, hits: 4, cooldown: 3 }, { name: "Time Slip", power: 0, self: { id: "regen", turns: 3, power: 0.05 }, cooldown: 5 }], drops: [{ key: "wraith_essence", chance: 1, min: 3, max: 5 }, { key: "ember_core", chance: 0.7, min: 1, max: 3 }, { key: "primal_essence", chance: 0.6, min: 1, max: 2 }] },
    ],
    bosses: [
      { id: "dgVoidAstromancer", name: "Astromancer Vael", mod: { atk: 1.2, hp: 1.1 }, unique: "valeOrrery", abilities: [{ name: "Starfall", power: 2, status: dot("burn", 0.07, 3, 0.9), cooldown: 3 }, { name: "Orbital Prison", power: 0.6, status: stun(0.55), cooldown: 4 }, { name: "Cosmic Drain", power: 1.3, leech: 0.8, cooldown: 3 }, { name: "Eclipse", power: 0, status: debuff("weaken", 0.4, 3), cooldown: 5, text: "Vael darkens the sky. Your strength ebbs." }], phases: [{ below: 0.65, text: "Vael aligns the planets, and the observatory hums.", self: { id: "fortify", turns: 4, power: 0.35 } }, { below: 0.35, text: "\"The stars demand your light!\"", self: { id: "enrage", turns: 99, power: 0.5 } }], drops: [{ key: "wraith_crown", chance: 0.5, min: 1, max: 1 }, { key: "wraith_essence", chance: 1, min: 6, max: 9 }, { key: "primal_essence", chance: 1, min: 2, max: 4 }] },
      { id: "dgVoidCartographer", name: "The Void Cartographer", mod: { spd: 1.3, atk: 1.1 }, unique: "cartographerSigil", abilities: [{ name: "Unmake", power: 1.8, ignoreDefense: 0.5, cooldown: 3 }, { name: "Fold Space", power: 0.5, hits: 5, cooldown: 3 }, { name: "Blank Page", power: 0, status: debuff("vulnerable", 0.4, 3), cooldown: 5 }, { name: "Redraw", power: 0, heal: 0.15, cooldown: 6, text: "The Cartographer sketches over its wounds." }], phases: [{ below: 0.5, text: "The map tears open. The void leaks through!", self: { id: "enrage", turns: 99, power: 0.45 } }, { below: 0.25, text: "The Cartographer draws you off the edge of the world!", self: { id: "enrage", turns: 99, power: 0.3 } }], drops: [{ key: "wraith_crown", chance: 0.6, min: 1, max: 1 }, { key: "wraith_essence", chance: 1, min: 5, max: 8 }, { key: "primal_essence", chance: 1, min: 2, max: 3 }] },
    ],
    puzzles: [
      { kind: "sequence", name: "Constellation Dial", intro: "A dial of glowing stars follows a pattern. Set the next star to open the lens.", unit: "stars" },
      { kind: "order", name: "Alignment of the Spheres", intro: "Four celestial spheres must be aligned in the correct order.", items: ["Sun", "Moon", "Comet", "Star"] },
      { kind: "doors", name: "Gates of the Zodiac", intro: "Four gates, each carved with a prophecy. Only ONE prophecy is true.", door: "zodiac gate" },
      { kind: "lock", name: "Astrolabe Lock", intro: "An astrolabe guards the inner sanctum, set by a three digit star code.", lock: "astrolabe" },
      { kind: "circuit", name: "Starlight Circuit", intro: "Illuminate all five linked star lenses to restore the celestial bridge." },
      { kind: "scales", name: "Gravity Balance", intro: "Counterbalance a captive star using the observatory's gravity weights." },
      { kind: "path", name: "Starbridge Route", intro: "Plot a route across intact platforms and avoid the marked void rifts." },
      { kind: "pairs", name: "Celestial Twins", intro: "Match the hidden celestial signs. False alignments unleash void sparks.", symbols: ["Sun", "Moon", "Comet", "Star"] },
    ],
  },
};

export const DUNGEON_TYPE_IDS = Object.keys(DUNGEON_TYPES);

// Fixed by the game rules; shown to the player on the Dungeons screen.
export const TRAP_COUNTERS = {
  swing: { approach: "dash", label: "Swinging and slashing traps are best avoided by dashing" },
  crush: { approach: "brace", label: "Crushing and falling traps are best weathered by bracing" },
  rune: { approach: "disarm", label: "Rune and mechanism traps are best handled by disarming" },
};

export const UNIQUE_DROP_CHANCE = 0.01;
