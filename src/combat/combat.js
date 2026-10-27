import { getPlayer, setPlayer } from "../character/player";
import { generateRandomGemstone, generateRandomSlotItem } from "../items/items";
import { applyConsumable, getKeyItemEffect, ITEM_CERTIFICATE_DROP_CHANCE, PRISMATIC_ALLOY_DROP_CHANCE } from "../items/consumables";
import {
  SKILLS,
  getSkillLevel,
  skillCost,
  skillMultiplier,
} from "../character/skills";
import { gainExp, MAX_PLAYER_CHANCE } from "../character/stats";
import { getAbilityTotals } from "./abilities";
import {
  STATUSES,
  addStatus,
  hasStatus,
  healMult,
  incomingMult,
  outgoingMult,
} from "./statuses";
import { rollMaterialDrops } from "./enemies";
import { MATERIALS, addToMaterials } from "../items/materials";
import { recordQuestKill } from "../world/quests";

const BASE_DROP_CHANCE = 0.25;

// Class bonus tuning (descriptions live in classes.js).
const BULWARK_DAMAGE_TAKEN = 0.3;
const BULWARK_COUNTER = 0.5;
const RHYTHM_CRIT = 0.04;
const RHYTHM_MAX = 0.2;
const PARRY_CHANCE = 0.15;
const PARRY_COUNTER = 0.6;
const SPELLSTRIKE_BONUS = 0.5;
const HEX_CHANCE = 0.2;
const ADAPTABLE_PER_KIND = 0.05;
const ADAPTABLE_MAX = 0.2;
const DAMAGE_REDUCTION_CAP = 0.6;

// Simple turn-based combat state, shown by the "combat" game screen.
let enemy = null;
let playerDefending = false;
let playerStatuses = [];
let fight = null;
let openingReplies = [];

export const getEnemy = () => enemy;
export const isPlayerDefending = () => playerDefending;
export const getPlayerStatuses = () => playerStatuses;
export const endCombat = () => {
  enemy = null;
  playerDefending = false;
  playerStatuses = [];
  fight = null;
};

// Messages from any enemy turn that happened before the player could act (consumed once).
export const takeOpeningReplies = () => {
  const r = openingReplies;
  openingReplies = [];
  return r;
};

const roll = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const lower = (id) => STATUSES[id].name.toLowerCase();
const damageNumber = (amount, calculation, critical = false) =>
  `[red]{{${amount}|${critical ? "damage-critical" : "damage"}:${calculation.map(encodeURIComponent).join("~")}}}[/red]`;

// Enemy template fields: see enemies.js. Anything missing falls back to the defaults below.
export const startCombat = (template, { enemyFirst = false } = {}) => {
  enemy = {
    level: template.level || 1,
    attack: [1, 5],
    defense: 2,
    speed: 3,
    critical: 0.05,
    astra: 0,
    exp: 0,
    abilities: [],
    phases: [],
    ...template,
    hp: template.maxHp,
    defending: false,
    statuses: [],
    cooldowns: {},
    phasesDone: [],
    stunGrace: false,
  };
  playerDefending = false;
  playerStatuses = [];
  openingReplies = [];

  const p = getPlayer();
  const ab = getAbilityTotals(p);
  fight = {
    ab,
    cls: p.class,
    secondWindUsed: false,
    combo: 0,
    kinds: new Set(),
    spellstrike: false,
    playerStunGrace: false,
    playerActsFirst: !enemyFirst && enemy.speed <= Math.round(
      (p.stats?.speed || 0) * (1 + (ab.speedMult || 0)),
    ),
    ward: 0,
    temperedStrikes: 0,
    starKinds: new Set(),
    starReady: false,
    rootstrideReady: true,
    unwrittenPathStrikes: 0,
  };
  if (fight.ab.uniqueEffects.includes("marrowWard"))
    fight.ward = Math.round((p.stats?.maxHealth || 0) * 0.2);

  // The faster combatant acts first; ties go to the player.
  const speed = Math.round(
    (p.stats?.speed || 0) * (1 + (fight.ab.speedMult || 0)),
  );
  if (enemyFirst || enemy.speed > speed) {
    openingReplies.push(
      enemyFirst
        ? `The ${enemy.name} catches you and acts first!`
        : `The ${enemy.name} is faster and acts first!`,
    );
    const s = { ...p.stats };
    const outcome = enemyTurn(s, openingReplies);
    settle(outcome, p, s, openingReplies, {});
  } else {
    openingReplies.push("You are faster and act first!");
  }
};

// ---- Statuses ----

// Returns true if the status was applied.
function inflictOnEnemy(id, opts, replies) {
  const def = STATUSES[id];
  if (def.kind === "skip") {
    if (Math.random() < (enemy.stunResist || 0)) {
      replies.push(`The ${enemy.name} resists being ${lower(id)}!`);
      return false;
    }
    if (enemy.stunGrace) {
      replies.push(`The ${enemy.name} shakes off the effect.`);
      return false;
    }
  }
  const power =
    (opts?.power ?? def.defaultPower) *
    (def.kind === "dot" ? (enemy.dotResist ?? 1) : 1);
  addStatus(enemy.statuses, id, { ...opts, power });
  replies.push(`The ${enemy.name} is now ${lower(id)}.`);
  return true;
}

function inflictOnPlayer(id, opts, replies) {
  const def = STATUSES[id];
  if (def.kind === "skip" && fight.playerStunGrace) {
    replies.push("You shake off the stun.");
    return false;
  }
  addStatus(playerStatuses, id, opts);
  replies.push(`You are now ${lower(id)}.`);
  return true;
}

function healEnemy(amount, replies) {
  const healed = Math.min(
    Math.floor(amount * healMult(enemy.statuses)),
    enemy.maxHp - enemy.hp,
  );
  if (healed <= 0) return 0;
  enemy.hp += healed;
  replies.push(`The ${enemy.name} recovers ${healed} health.`);
  return healed;
}

function healPlayer(s, amount, replies, source) {
  const healed = Math.min(
    Math.floor(amount * healMult(playerStatuses)),
    s.maxHealth - s.health,
  );
  if (healed <= 0) return 0;
  s.health += healed;
  replies.push(
    `${source ? `${source}: you` : "You"} recover [green]${healed}[/green] health.`,
  );
  return healed;
}

// Applies damage to the player and triggers Second Wind if it drops them to 10% health.
function damagePlayer(s, amount, replies) {
  s.health = Math.max(0, s.health - amount);
  const wind = fight.ab.secondWind;
  if (wind && !fight.secondWindUsed && s.health <= s.maxHealth * 0.1) {
    fight.secondWindUsed = true;
    s.health = Math.min(s.maxHealth, s.health + Math.round(s.maxHealth * wind));
    replies.push(
      `[green]Second Wind![/green] You recover to ${s.health} health.`,
    );
  }
}

function hurtEnemy(amount, replies, source, calculation) {
  enemy.hp = Math.max(0, enemy.hp - amount);
  replies.push(
    `${source} hits the ${enemy.name} for ${damageNumber(amount, calculation || [`Damage dealt: ${amount}.`])} damage.`,
  );
}

// Ticks a status list: damage/healing over time through `apply(amount, label)` (negative = healing), then durations drop.
// Stun-like statuses last until they cost a turn. Returns the remaining statuses.
const tickStatuses = (list, maxHp, apply) => {
  for (const st of list) {
    const kind = STATUSES[st.id].kind;
    if (kind === "dot") {
      const raw = maxHp * st.power * st.stacks;
      apply(Math.max(1, Math.round(raw)), lower(st.id), [
        `Maximum health: ${maxHp}.`,
        `Status strength: ${Math.round(st.power * 100)}% × ${st.stacks} stack(s).`,
        `Raw damage: ${maxHp} × ${st.power} × ${st.stacks} = ${raw}.`,
        `Round to nearest whole number, minimum 1: ${Math.max(1, Math.round(raw))}.`,
      ]);
    } else if (kind === "regen")
      apply(-Math.max(1, Math.round(maxHp * st.power)));
  }
  return list
    .map((st) =>
      STATUSES[st.id].kind === "skip" ? st : { ...st, turns: st.turns - 1 },
    )
    .filter((st) => st.turns > 0);
};

// End of round: damage/healing over time for both sides, then durations tick down.
// Returns "victory", "collapse" or null.
function endOfRound(s, replies) {
  enemy.statuses = tickStatuses(
    enemy.statuses,
    enemy.maxHp,
    (amount, label, calculation) => {
      if (amount < 0) {
        healEnemy(-amount, replies);
        return;
      }
      enemy.hp = Math.max(0, enemy.hp - amount);
      replies.push(
        `The ${enemy.name} takes ${damageNumber(amount, calculation)} ${label} damage.`,
      );
    },
  );
  if (enemy.hp <= 0) return "victory";

  playerStatuses = tickStatuses(
    playerStatuses,
    s.maxHealth,
    (amount, label, calculation) => {
      if (amount < 0) return;
      damagePlayer(s, amount, replies);
      replies.push(
        `You take ${damageNumber(amount, calculation)} ${label} damage.`,
      );
    },
  );

  if (fight.cls === "Spellcaster" && s.power < s.maxPower) s.power += 1;
  return s.health <= 0 ? "collapse" : null;
}

// ---- Enemy turn ----

const chooseEnemyAction = (wasDefending) => {
  const choices = [{ type: "attack", weight: 6 }];
  if (!wasDefending)
    choices.push({
      type: "defend",
      weight: enemy.hp / enemy.maxHp < 0.4 ? 3 : 1.5,
    });
  for (const ability of enemy.abilities || []) {
    if ((enemy.cooldowns[ability.name] || 0) > 0) continue;
    if (ability.below && enemy.hp / enemy.maxHp >= ability.below) continue;
    if (ability.self && hasStatus(enemy.statuses, ability.self.id)) continue;
    if (ability.heal && enemy.hp >= enemy.maxHp) continue;
    choices.push({
      type: "skill",
      skill: ability,
      weight: ability.weight ?? 2.5,
    });
  }
  let r = Math.random() * choices.reduce((sum, c) => sum + c.weight, 0);
  for (const c of choices) {
    r -= c.weight;
    if (r < 0) return c;
  }
  return choices[0];
};

// One enemy strike against the player. Returns the damage dealt, or 0 if it was evaded/parried.
function enemyStrike(s, replies, ability) {
  const used = ability ? `uses ${ability.name}` : null;
  if (Math.random() < Math.min(MAX_PLAYER_CHANCE, s.evasion || 0)) {
    replies.push(
      used
        ? `The ${enemy.name} ${used}, but you evade it!`
        : `You evade the ${enemy.name}'s attack!`,
    );
    return 0;
  }
  if (fight.cls === "Duelist" && Math.random() < PARRY_CHANCE) {
    replies.push(`You parry the ${enemy.name}'s attack and riposte!`);
    const counterRoll = roll(s.attackMin, s.attackMax);
    const raw = counterRoll * PARRY_COUNTER - enemy.defense;
    const riposte = Math.max(1, Math.round(raw));
    hurtEnemy(riposte, replies, "Your riposte", [
      `Melee attack roll: ${counterRoll} (range ${s.attackMin}-${s.attackMax}).`,
      `Riposte multiplier: ${counterRoll} × ${PARRY_COUNTER} = ${counterRoll * PARRY_COUNTER}.`,
      `Enemy defense: ${counterRoll * PARRY_COUNTER} - ${enemy.defense} = ${raw}.`,
      `Round to nearest whole number, minimum 1: ${riposte}.`,
    ]);
    return 0;
  }
  const baseRoll = roll(...enemy.attack);
  const abilityMultiplier = ability?.power ?? 1;
  const calculation = [
    `Enemy attack roll: ${baseRoll} (range ${enemy.attack[0]}-${enemy.attack[1]}).`,
  ];
  let dmg = baseRoll * abilityMultiplier;
  if (abilityMultiplier !== 1)
    calculation.push(
      `Ability power: ${baseRoll} × ${abilityMultiplier} = ${dmg}.`,
    );
  let critical = false;
  if (Math.random() < (enemy.critical || 0)) {
    dmg *= 2;
    critical = true;
    replies.push(`${enemy.name} lands a critical hit!`);
  }
  if (critical) calculation.push(`Critical hit: ×2 = ${dmg}.`);
  const enemyOutgoing = outgoingMult(enemy.statuses);
  dmg *= enemyOutgoing;
  if (enemyOutgoing !== 1)
    calculation.push(`Enemy status effects: ×${enemyOutgoing} = ${dmg}.`);
  const defenseApplied = s.defense * (1 - (ability?.ignoreDefense || 0));
  const beforeDefense = dmg;
  dmg = Math.max(1, Math.round(dmg - defenseApplied));
  calculation.push(
    `Player defense: ${beforeDefense} - ${s.defense} × (1 - ${ability?.ignoreDefense || 0}) = ${dmg} after rounding (minimum 1).`,
  );
  const blocked = playerDefending;
  if (blocked) {
    const blockMultiplier =
      fight.cls === "Swordsman" ? BULWARK_DAMAGE_TAKEN : 0.5;
    const beforeBlock = dmg;
    dmg = Math.max(1, Math.floor(dmg * blockMultiplier));
    calculation.push(
      `Defending: floor(${beforeBlock} × ${blockMultiplier}) = ${dmg} (minimum 1).`,
    );
  }
  const playerIncoming = incomingMult(playerStatuses);
  dmg *= playerIncoming;
  if (playerIncoming !== 1)
    calculation.push(`Player status effects: ×${playerIncoming} = ${dmg}.`);
  const reduction = Math.min(
    DAMAGE_REDUCTION_CAP,
    fight.ab.damageReduction || 0,
  );
  dmg *= 1 - reduction;
  if (reduction)
    calculation.push(`Damage reduction: ×${1 - reduction} = ${dmg}.`);
  const beforeRounding = dmg;
  dmg = Math.max(1, Math.round(dmg));
  calculation.push(`Final rounding: ${beforeRounding} → ${dmg} (minimum 1).`);

  if (fight.ab.uniqueEffects.includes("marrowWard") && fight.ward > 0) {
    const absorbed = Math.min(fight.ward, dmg);
    fight.ward -= absorbed;
    dmg -= absorbed;
    replies.push(`Marrow Ward absorbs ${absorbed} damage${fight.ward ? ` (${fight.ward} ward remains)` : " and breaks"}.`);
    calculation.push(`Marrow Ward absorbs ${absorbed}; ${dmg} damage passes through.`);
  }
  if (fight.ab.uniqueEffects.includes("temperedSteel")) {
    fight.temperedStrikes += 1;
    if (fight.temperedStrikes === 2) {
      fight.temperedStrikes = 0;
      dmg = 0;
      replies.push("Tempered Steel turns the strike aside!");
      const counter = Math.max(1, Math.round(s.attackMax * 0.6 - enemy.defense));
      hurtEnemy(counter, replies, "Your tempered counter", [
        `Counterattack: round(${s.attackMax} × 0.6 - ${enemy.defense}) = ${counter}.`,
      ]);
    }
  }
  damagePlayer(s, dmg, replies);
  fight.combo = 0;
  replies.push(
    used
      ? `The ${enemy.name} ${used} on you for ${damageNumber(dmg, calculation, critical)} damage.`
      : `The ${enemy.name} hits you for ${damageNumber(dmg, calculation, critical)} damage.`,
  );
  if (
    fight.ab.uniqueEffects.includes("frozenResolve") &&
    Math.random() < 0.1
  ) {
    inflictOnEnemy("stun", {}, replies);
    replies.push("Frozen Resolve stuns the attacker!");
  }
  if (fight.ab.reflect) {
    const reflected = Math.max(1, Math.round(dmg * fight.ab.reflect));
    hurtEnemy(reflected, replies, "Your thorns", [
      `Damage taken: ${dmg}.`,
      `Thorns reflection: round(${dmg} × ${fight.ab.reflect}) = ${reflected} (minimum 1).`,
    ]);
  }
  if (blocked && fight.cls === "Swordsman" && enemy.hp > 0) {
    const counterRoll = roll(s.attackMin, s.attackMax);
    const counterRaw = counterRoll * BULWARK_COUNTER - enemy.defense;
    const counter = Math.max(1, Math.round(counterRaw));
    hurtEnemy(counter, replies, "Your counterattack", [
      `Melee attack roll: ${counterRoll} (range ${s.attackMin}-${s.attackMax}).`,
      `Counter multiplier: ${counterRoll} × ${BULWARK_COUNTER} = ${counterRoll * BULWARK_COUNTER}.`,
      `Enemy defense: ${counterRoll * BULWARK_COUNTER} - ${enemy.defense} = ${counterRaw}.`,
      `Round to nearest whole number, minimum 1: ${counter}.`,
    ]);
  }
  return dmg;
}

// Runs the enemy's turn against the stats copy `s` (mutated). Adds messages to `replies`.
// Returns "victory" (the enemy died to a counter), "collapse" (the player fell) or null.
function enemyTurn(s, replies) {
  for (const [i, phase] of (enemy.phases || []).entries()) {
    if (enemy.phasesDone.includes(i) || enemy.hp / enemy.maxHp >= phase.below)
      continue;
    enemy.phasesDone.push(i);
    replies.push(`[purple]${phase.text}[/purple]`);
    if (phase.self) addStatus(enemy.statuses, phase.self.id, phase.self);
    if (phase.heal) healEnemy(Math.round(enemy.maxHp * phase.heal), replies);
  }
  for (const k of Object.keys(enemy.cooldowns))
    enemy.cooldowns[k] = Math.max(0, enemy.cooldowns[k] - 1);

  const stun = enemy.statuses.findIndex(
    (st) => STATUSES[st.id].kind === "skip",
  );
  if (stun >= 0) {
    enemy.statuses.splice(stun, 1);
    enemy.stunGrace = true;
    replies.push(`The ${enemy.name} is stunned and loses its turn!`);
    return null;
  }
  enemy.stunGrace = false;

  const wasDefending = enemy.defending;
  enemy.defending = false;
  const action = chooseEnemyAction(wasDefending);

  if (action.type === "defend") {
    enemy.defending = true;
    replies.push(`The ${enemy.name} braces itself, ready to defend.`);
    return null;
  }

  const ability = action.type === "skill" ? action.skill : null;
  if (ability?.cooldown) enemy.cooldowns[ability.name] = ability.cooldown;
  const power = ability ? (ability.power ?? 1) : 1;
  const buffSelf = () => {
    if (!ability?.self) return;
    addStatus(enemy.statuses, ability.self.id, ability.self);
    replies.push(`The ${enemy.name} is now ${lower(ability.self.id)}.`);
  };

  if (ability && power <= 0) {
    replies.push(ability.text || `The ${enemy.name} uses ${ability.name}.`);
    if (ability.heal)
      healEnemy(Math.round(enemy.maxHp * ability.heal), replies);
    buffSelf();
    if (ability.status && Math.random() < (ability.status.chance ?? 1)) {
      if (Math.random() < (s.evasion || 0)) replies.push("You evade it!");
      else inflictOnPlayer(ability.status.id, ability.status, replies);
    }
    return null;
  }

  if (ability?.text) replies.push(ability.text);
  let total = 0;
  for (let i = 0; i < (ability?.hits || 1); i++) {
    total += enemyStrike(s, replies, ability);
    if (enemy.hp <= 0) return "victory";
    if (s.health <= 0) return "collapse";
  }
  if (total > 0) {
    if (ability?.leech) healEnemy(Math.round(total * ability.leech), replies);
    buffSelf();
    if (ability?.status && Math.random() < (ability.status.chance ?? 1))
      inflictOnPlayer(ability.status.id, ability.status, replies);
  }
  return null;
}

// ---- Outcomes ----

export function collapse(p, s, replies, patch) {
  // Fights with their own rules (dungeons) decide what a defeat costs.
  if (enemy?.onPlayerDefeat) {
    enemy.onPlayerDefeat(p, s, patch, replies);
    return;
  }
  applyDeathPenalties(p, s, replies, patch);
}

export function applyDeathPenalties(p, s, replies, patch) {
  s.health = s.maxHealth;
  s.stamina = s.maxStamina;
  s.power = s.maxPower;
  const astraLost = Math.floor((0.25 + Math.random() * 0.5) * (p.astra || 0));
  patch.astra = Math.max(0, (p.astra || 0) - astraLost);
  const expLost = (p.level || 1) > 10 ? Math.floor((s.exp || 0) * 0.5) : 0;
  if (expLost) s.exp -= expLost;
  if (s.exp < 0) s.exp = 0;
  replies.push(
    `You Collapse, and wake up back at safety. You lost ${astraLost} astra and ${expLost} exp.`,
  );
}

function winCombat(p, s, replies, patch) {
  const plunderBonus = fight.ab.uniqueEffects.includes("plunder")
    ? Math.min(
        0.3,
        new Set(
          enemy.statuses
            .filter((status) => ["burn", "poison", "bleed", "weaken", "vulnerable", "stun"].includes(status.id))
            .map((status) => status.id),
        ).size * 0.1,
      )
    : 0;
  const astra = Math.round(
    enemy.astra * (1 + (fight.ab.astraBonus || 0) + plunderBonus),
  );
  patch.astra = (p.astra || 0) + astra;
  replies.push(
    `The ${enemy.name} falls! You gain ${enemy.exp} exp and ${astra} {{astra|astra}}.`,
  );
  const leveled = gainExp({ ...p, stats: s }, enemy.exp);
  Object.assign(patch, leveled.patch);
  replies.push(...leveled.messages);

  const questKill = recordQuestKill(p.quests, enemy);
  if (questKill.messages.length) {
    patch.quests = questKill.quests;
    replies.push(...questKill.messages);
  }

  // Luck improves drop chance by 1% per 3 points
  const luckBonus = Math.floor((s.luck || 0) / 3) * 0.01;

  const drops = rollMaterialDrops(
    enemy,
    luckBonus + getKeyItemEffect(p, "materialChance"),
  );
  if (Object.keys(drops).length) {
    patch.materials = addToMaterials(p.materials, drops);
    const list = Object.entries(drops).map(
      ([k, n]) => `{{${n}x ${MATERIALS[k].name}|material:${k}}}`,
    );
    replies.push(`Materials gained: ${list.join(", ")}.`);
  }

  if (Math.random() < (enemy.dropChance ?? BASE_DROP_CHANCE) + luckBonus) {
    const item = generateRandomSlotItem(enemy.minRarity || 0);
    if (item) {
      patch.inventory = [...(p.inventory || []), item];
      replies.push(
        `The ${enemy.name} dropped {{${item.name}|item:${item.id}}}!`,
      );
    }
  }
  if (Math.random() < PRISMATIC_ALLOY_DROP_CHANCE) {
    const consumables = { ...(patch.consumables ?? p.consumables ?? {}) };
    consumables.prismaticAlloy = (consumables.prismaticAlloy || 0) + 1;
    patch.consumables = consumables;
    replies.push(`The ${enemy.name} dropped a {{Prismatic Alloy|consumable:prismaticAlloy}}!`);
  }
  if (Math.random() < 0.08 + luckBonus) {
    const gemstone = generateRandomGemstone();
    patch.gemstones = [...(p.gemstones || []), gemstone];
    replies.push(`The ${enemy.name} dropped a {{${gemstone.name}|gemstone:${gemstone.id}}}!`);
  }
  const certificateChance = ITEM_CERTIFICATE_DROP_CHANCE[enemy.dungeon ? "dungeon" : "overworld"][enemy.tier];
  if (certificateChance && Math.random() < certificateChance) {
    const consumables = { ...(patch.consumables ?? p.consumables ?? {}) };
    consumables.itemCertificate = (consumables.itemCertificate || 0) + 1;
    patch.consumables = consumables;
    replies.push(`The ${enemy.name} dropped an {{Item Certificate|consumable:itemCertificate}}!`);
  }
  enemy.onDefeat?.(p, patch.stats || s, patch, replies);
  setPlayer(patch);
  endCombat();
}

// Applies a round outcome and saves. Returns { replies, over }.
function settle(outcome, p, s, replies, patch) {
  if (outcome === "victory") {
    winCombat(p, s, replies, patch);
    return { replies, over: true };
  }
  if (outcome === "collapse") {
    collapse(p, s, replies, patch);
    endCombat();
    setPlayer({ ...patch, stats: s });
    return { replies, over: true };
  }
  setPlayer({ ...patch, stats: s });
  return { replies, over: false };
}

// Ends the player's action: the enemy takes its turn, effects tick, then the player's guard drops.
function finishRound(p, s, replies, patch) {
  const outcome = enemyTurn(s, replies) || endOfRound(s, replies);
  playerDefending = false;
  return settle(outcome, p, s, replies, patch);
}

// If the player is stunned their action is forfeited. Returns true if so.
function loseTurnToStun(replies) {
  const i = playerStatuses.findIndex((st) => STATUSES[st.id].kind === "skip");
  if (i < 0) {
    fight.playerStunGrace = false;
    return false;
  }
  playerStatuses.splice(i, 1);
  fight.playerStunGrace = true;
  replies.push("You are stunned and lose your turn!");
  return true;
}

// ---- Player actions ----

// Runs one round of attacking, optionally with an equipped skill. Returns { replies, over, used } and updates the saved player.
// used is false (and no turn passes) if the skill can't be used.
export function attackRound(type, skillKey) {
  const p = getPlayer();
  const s = { ...p.stats };
  const replies = [];
  const skill = skillKey ? SKILLS[skillKey] : null;
  const level = skill ? getSkillLevel(p, skillKey) : 0;
  let cost = 0;
  if (skill) {
    if (level < 1)
      return {
        replies: ["You haven't learned that skill."],
        over: false,
        used: false,
      };
    cost = skillCost(p, skillKey);
    if (s.power < cost)
      return {
        replies: [`You need ${cost} power to use ${skill.name}.`],
        over: false,
        used: false,
      };
    type = skill.type;
  }
  playerDefending = false;
  if (loseTurnToStun(replies))
    return { ...finishRound(p, s, replies, {}), used: true };
  s.power -= cost;

  const { ab, cls } = fight;
  const speedAdvantage =
    Math.round(s.speed * (1 + (ab.speedMult || 0))) - enemy.speed;
  let hit =
    type === "melee"
      ? roll(s.attackMin, s.attackMax)
      : roll(s.magicAttackMin, s.magicAttackMax);
  if (skill) hit = Math.round(hit * skillMultiplier(skillKey, level));

  const ctx = {
    level,
    stats: s,
    enemy,
    speedAdvantage,
    dealt: 0,
    crit: false,
    applyStatus: (id, opts) => {
      if (enemy.hp > 0) inflictOnEnemy(id, opts, replies);
    },
    heal: (amount) => healPlayer(s, amount, replies, skill?.name),
    log: (text) => replies.push(text),
  };

  const starCategory = skill ? "skill" : type;
  const constellationReady =
    ab.uniqueEffects.includes("starCharted") && fight.starReady;
  if (constellationReady) {
    fight.starReady = false;
    fight.starKinds.clear();
  }
  const unwrittenPathReady =
    ab.uniqueEffects.includes("unwrittenPath") &&
    fight.unwrittenPathStrikes === 2;

  const calculation = [];
  const baseHit = hit;
  calculation.push(
    `${type === "melee" ? "Melee" : "Magic"} attack roll: ${baseHit} (range ${type === "melee" ? `${s.attackMin}-${s.attackMax}` : `${s.magicAttackMin}-${s.magicAttackMax}`}).`,
  );
  if (skill)
    calculation.push(
      `Skill multiplier: ×${skillMultiplier(skillKey, level)}; rounded hit: ${hit}.`,
    );

  const rhythm =
    cls === "Tactician" ? Math.min(RHYTHM_MAX, fight.combo * RHYTHM_CRIT) : 0;
  const critChance =
    Math.min(
      MAX_PLAYER_CHANCE,
      (s.criticalHitChance || 0) + (skill?.critBonus?.(ctx) || 0) + rhythm,
    );
  if (Math.random() < critChance) {
    hit *= s.criticalDamageBonus;
    ctx.crit = true;
    calculation.push(
      `Critical multiplier: ×${s.criticalDamageBonus} = ${hit}.`,
    );
    replies.push("Critical hit!");
  }

  const abilityBonus = ab.damageBonus || 0;
  const skillBonus = skill?.bonus?.(ctx) || 0;
  let bonus = 1 + abilityBonus + skillBonus;
  if (cls === "Specialist") {
    fight.kinds.add(skill ? skillKey : type);
    const adaptableBonus = Math.min(
      ADAPTABLE_MAX,
      fight.kinds.size * ADAPTABLE_PER_KIND,
    );
    bonus += adaptableBonus;
    calculation.push(`Specialist bonus: +${adaptableBonus * 100}%.`);
  }
  if (cls === "Spellblade" && !skill && fight.spellstrike) {
    bonus += SPELLSTRIKE_BONUS;
    fight.spellstrike = false;
    replies.push("Your spellstrike discharges!");
    calculation.push(`Spellstrike bonus: +${SPELLSTRIKE_BONUS * 100}%.`);
  }
  if (abilityBonus)
    calculation.push(`Ability damage bonus: +${abilityBonus * 100}%.`);
  if (skillBonus) calculation.push(`Skill bonus: +${skillBonus * 100}%.`);
  const outgoing = outgoingMult(playerStatuses);
  const incoming = incomingMult(enemy.statuses);
  const beforeMultipliers = hit;
  const glacialShatter =
    ab.uniqueEffects.includes("glacialEdge") &&
    enemy.statuses.some((status) => status.id === "vulnerable");
  if (constellationReady) bonus += 1.5;
  if (glacialShatter) bonus += 0.35;
  if (unwrittenPathReady) bonus += 1;
  hit *= bonus * outgoing * incoming;
  calculation.push(
    `Damage modifiers: ${beforeMultipliers} × ${bonus} × ${outgoing} × ${incoming} = ${hit}.`,
  );
  if (outgoing !== 1)
    calculation.push(`Attacker status effects: ×${outgoing}.`);
  if (incoming !== 1) calculation.push(`Enemy status effects: ×${incoming}.`);

  const ignore = Math.min(
    1,
    (skill?.ignoreDefense?.(level) || 0) +
      (ab.pierce || 0) +
      (unwrittenPathReady ? 1 : 0),
  );
  const beforeDefense = hit - enemy.defense * (1 - ignore);
  let dealt = Math.max(1, Math.round(beforeDefense));
  calculation.push(
    `Enemy defense: ${hit} - ${enemy.defense} × (1 - ${ignore}) = ${beforeDefense}; rounded to ${dealt} (minimum 1).`,
  );
  if (enemy.defending) {
    const beforeBlock = dealt;
    dealt = Math.max(1, Math.floor(dealt / 2));
    calculation.push(
      `Enemy defending: floor(${beforeBlock} ÷ 2) = ${dealt} (minimum 1).`,
    );
  }
  ctx.dealt = dealt;
  enemy.hp = Math.max(0, enemy.hp - dealt);
  if (ab.uniqueEffects.includes("unwrittenPath")) {
    if (unwrittenPathReady) {
      fight.unwrittenPathStrikes = 0;
      replies.push("Unwritten Path finds a shortcut, bypassing defense for a doubled strike!");
    } else {
      fight.unwrittenPathStrikes += 1;
    }
  }
  replies.push(
    `${skill ? `You use ${skill.name} on` : "You strike"} the ${enemy.name} for ${damageNumber(dealt, calculation, ctx.crit)} damage${enemy.defending ? " (defended)" : ""}.`,
  );

  if (glacialShatter) {
    enemy.statuses = enemy.statuses.filter((status) => status.id !== "vulnerable");
    replies.push("Glacial Edge shatters the enemy's vulnerability!");
  }
  if (constellationReady && enemy.hp > 0) {
    inflictOnEnemy("stun", {}, replies);
    replies.push("The constellation aligns and locks the enemy in place!");
  }
  if (ab.uniqueEffects.includes("rootstride") && fight.playerActsFirst && fight.rootstrideReady) {
    fight.rootstrideReady = false;
    if (enemy.hp > 0) {
      inflictOnEnemy("stun", {}, replies);
      replies.push("Rootstride binds the enemy with your opening strike!");
    }
  }
  if (ab.uniqueEffects.includes("undyingHunger") && dealt > 0 &&
      enemy.statuses.some((status) => ["burn", "poison", "bleed"].includes(status.id))) {
    healPlayer(s, Math.round(s.maxHealth * 0.08), replies, "Undying Hunger");
  }
  if (ab.uniqueEffects.includes("moltenGrip") && dealt > 0 && enemy.hp > 0 &&
      enemy.statuses.some((status) => status.id === "burn")) {
    const burst = Math.max(1, Math.round(enemy.maxHp * 0.06));
    enemy.hp = Math.max(0, enemy.hp - burst);
    replies.push(`Molten Grip detonates the flames for ${damageNumber(burst, [`Maximum health: ${enemy.maxHp}.`, `Flame detonation: ${enemy.maxHp} × 6% = ${burst}.`])} damage.`);
  }
  if (ab.lifesteal)
    healPlayer(
      s,
      Math.max(1, Math.round(dealt * ab.lifesteal)),
      replies,
      "Vampiric",
    );
  if (ab.surge && ctx.crit && s.power < s.maxPower) {
    s.power = Math.min(
      s.maxPower,
      s.power + Math.round((s.maxPower * ab.surge) / 2),
    );
    replies.push("Arcane Surge: you recover power!");
  }
  if (ctx.crit && ab.uniqueEffects.includes("fortunesSpark")) {
    if (enemy.hp > 0) {
      const spark = Math.max(1, Math.round(enemy.maxHp * 0.1));
      enemy.hp = Math.max(0, enemy.hp - spark);
      replies.push(`Fortune's Spark deals ${damageNumber(spark, [`Maximum health: ${enemy.maxHp}.`, `Spark: ${enemy.maxHp} × 10% = ${spark}.`])} bonus damage.`);
    }
    const restored = Math.max(
      0,
      Math.min(Math.round(s.maxPower * 0.25), s.maxPower - s.power),
    );
    s.power += restored;
    replies.push(
      restored
        ? `Fortune's Spark restores ${restored} power.`
        : "Fortune's Spark has no power to restore.",
    );
  }
  if (ctx.crit && ab.uniqueEffects.includes("orbitalFocus")) {
    if (enemy.hp > 0) {
      const shard = Math.max(1, Math.round(dealt * 0.35));
      enemy.hp = Math.max(0, enemy.hp - shard);
      replies.push(`Orbital Focus launches a shard for ${damageNumber(shard, [`Strike damage: ${dealt}.`, `Orbiting shard: ${dealt} × 35% = ${shard}.`])} bonus damage.`);
    }
  }
  skill?.onHit?.(ctx);
  if (enemy.hp > 0) {
    if (ab.ignite && Math.random() < ab.ignite)
      inflictOnEnemy("burn", { turns: 3, power: 0.04 }, replies);
    if (ab.weakened && Math.random() < ab.weakened)
      inflictOnEnemy("weaken", {}, replies);
    if (ab.poison && Math.random() < ab.poison)
      inflictOnEnemy("poison", {}, replies);
    if (ab.uniqueEffects.includes("bloomOfDecay")) {
      const existing = enemy.statuses.find((status) => status.id === "poison");
      const stacks = Math.min(5, (existing?.stacks || 0) + 1);
      inflictOnEnemy("poison", {}, replies);
      const poison = enemy.statuses.find((status) => status.id === "poison");
      if (poison) poison.stacks = stacks;
      replies.push(`Bloom of Decay grows to ${stacks} poison stack${stacks === 1 ? "" : "s"}.`);
    }
    if (cls === "Trickster" && Math.random() < HEX_CHANCE)
      inflictOnEnemy(
        Math.random() < 0.5 ? "weaken" : "vulnerable",
        { turns: 2 },
        replies,
      );
  }
  if (ab.uniqueEffects.includes("starCharted")) {
    fight.starKinds.add(starCategory);
    if (fight.starKinds.size >= 3) {
      fight.starReady = true;
      replies.push("A constellation takes shape around your next strike.");
    }
  }
  fight.combo += 1;
  if (cls === "Spellblade" && skill) {
    fight.spellstrike = true;
    replies.push("Your weapon crackles with energy!");
  }

  if (enemy.hp <= 0)
    return { ...settle("victory", p, s, replies, {}), used: true };
  return { ...finishRound(p, s, replies, {}), used: true };
}

// Skipping your turn: a stun is used up, otherwise you simply wait while the enemy acts.
export function passRound() {
  const p = getPlayer();
  const s = { ...p.stats };
  const replies = [];
  playerDefending = false;
  if (!loseTurnToStun(replies)) replies.push("You pass your turn.");
  return finishRound(p, s, replies, {});
}

export const isPlayerStunned = () =>
  playerStatuses.some((st) => STATUSES[st.id]?.kind === "skip");

// Guarding on your turn reduces the next hit you take.
export function defendRound() {
  const p = getPlayer();
  const s = { ...p.stats };
  const replies = [];
  if (!loseTurnToStun(replies)) {
    playerDefending = true;
    replies.push("You brace yourself and defend.");
  }
  return finishRound(p, s, replies, {});
}

// Using a consumable takes your turn. Returns { replies, over, used }; used is false (and no turn passes) if it can't be used.
export function consumeItemRound(key) {
  const p = getPlayer();
  const used = { ...p.stats };
  const result = applyConsumable(p, key, used, {
    healScale: healMult(playerStatuses),
  });
  if (!result.ok)
    return { replies: [result.message], over: false, used: false };
  playerDefending = false;
  const replies = [];
  // A stunned player loses the turn without spending the item.
  if (loseTurnToStun(replies))
    return { ...finishRound(p, { ...p.stats }, replies, {}), used: true };
  replies.push(result.message);
  return {
    ...finishRound(p, used, replies, { consumables: result.consumables }),
    used: true,
  };
}
