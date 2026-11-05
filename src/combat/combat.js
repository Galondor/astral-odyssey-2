import { getPlayer as getSavedPlayer, setPlayer as setSavedPlayer } from "../character/player";
import { canDropSkillGemstone, generateRandomGemstone, generateRandomSkillGemstone, generateRandomSlotItem, SKILL_GEM_DROP_CHANCE } from "../items/items";
import {
  applyConsumable,
  CONSUMABLES,
  getKeyItemEffect,
  ITEM_CERTIFICATE_DROP_CHANCE,
  PRISMATIC_ALLOY_DROP_CHANCE,
  RUNE_OF_UNPREDICTABILITY_DROP_CHANCE,
  POLISHING_RUNE_DROP_CHANCE,
} from "../items/consumables";
import {
  SKILLS,
  applySupportSkill,
  getSkillLevel,
  skillCost,
  skillMultiplier,
} from "../character/skills";
import { gainExp, MAX_PLAYER_CHANCE, MAX_CRITICAL_RESISTANCE } from "../character/stats";
import { updateRecords } from "../character/records";
import {
  SALTBLOOD_TIDE,
  STAR_EATER,
  TEMPORAL_ECHO,
  advanceEcho,
  bleedRemaining,
  getAbilityTotals,
} from "./abilities";
import {
  STATUSES,
  absorbDamage,
  addStatus,
  hasStatus,
  healMult,
  incomingMult,
  outgoingMult,
} from "./statuses";
import {
  ENEMY_SPEED_MULTIPLIER,
  getEnemyStatusResistance,
  rollMaterialDrops,
} from "./enemies";
import { MATERIALS, addToMaterials } from "../items/materials";
import { rollCraftingDrops } from "../items/craftingDrops";
import { recordQuestKill } from "../world/quests";
import { freshActions, getActionAvailability } from "./actionEconomy";
import { TUTORIAL_STEPS, tutorialActionError } from "./tutorial";
import { PASSIVE_TUNING as PT, getEquippedPassives } from "../character/passives";
import { GROUP_REWARD_BONUS } from "./encounters";

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
const FORTUNES_SPARK_CHANCE = 0.25;

// Simple turn-based combat state, shown by the "combat" game screen.
let enemy = null;
let enemies = [];
let playerDefending = false;
let playerStatuses = [];
let fight = null;
let openingReplies = [];
let contestContext = null;
const getPlayer = () => contestContext ? contestContext.player : getSavedPlayer();
const setPlayer = (patch) => {
  if (contestContext) Object.assign(contestContext.player, patch);
  else setSavedPlayer(patch);
};
const passiveOn = (key, state = fight) => !!state?.passives?.includes(key);
// Overcharge lets combat power generation overfill to 150% of max.
const powerCap = (s, state = fight) =>
  passiveOn("overcharge", state) ? Math.floor(s.maxPower * PT.overcharge.cap) : s.maxPower;
const gainPower = (s, amount) => {
  const cap = powerCap(s);
  if (s.power < cap) s.power = Math.min(cap, s.power + amount);
};
// Quick Reflexes keeps flagging new turns until the first skill is used.
const newActions = () => ({ ...freshActions(), ...(fight?.quickReflexesReady ? { quickSkill: true } : {}) });

const restoreSavedCombat = () => {
  if (enemy || contestContext) return;
  const saved = getSavedPlayer()?.combatState;
  if (!saved) return;
  enemies = (saved.enemies || [saved.enemy]).map((foe) => ({
    statuses: [], cooldowns: {}, phasesDone: [], abilities: [], phases: [], ...foe,
  }));
  enemy = enemies[saved.targetIndex || 0];
  fight = restoreFight({ ...saved.fight, ab: getAbilityTotals(getSavedPlayer()) });
  playerStatuses = saved.playerStatuses || [];
  playerDefending = !!saved.playerDefending;
};
export const getEnemy = () => {
  restoreSavedCombat();
  return enemy;
};
export const getEnemies = () => {
  restoreSavedCombat();
  return enemies;
};
export const selectCombatTarget = (index) => {
  restoreSavedCombat();
  if (!Number.isInteger(index) || !enemies[index] || enemies[index].hp <= 0)
    return { ok: false, message: "Choose a living enemy to target." };
  enemy = enemies[index];
  saveCombatState();
  return { ok: true };
};
const encounterWon = () => contestContext ? enemy.hp <= 0 : enemies.every((foe) => foe.hp <= 0);
const selectLivingTarget = () => {
  if (enemy?.hp <= 0) enemy = enemies.find((foe) => foe.hp > 0) || enemy;
};
export const getCombatActions = () => fight?.actions || freshActions();
export const getCombatTutorial = () => fight?.tutorial
  ? { ...TUTORIAL_STEPS[fight.tutorial.step], step: fight.tutorial.step + 1, total: TUTORIAL_STEPS.length }
  : null;
export const getCombatConsumables = () => fight?.tutorial
  ? { healthPotion: fight.tutorial.step <= 1 ? 1 : 0 }
  : getPlayer()?.consumables || {};
export const getCombatRound = () => fight?.round ?? null;
export const isPlayerDefending = () => playerDefending;
export const getPlayerStatuses = () => playerStatuses;
export const getMarrowWard = () =>
  fight?.wardMax > 0 ? { current: fight.ward, max: fight.wardMax } : null;
export const endCombat = ({ preserveSaved = false } = {}) => {
  if (!contestContext && !preserveSaved && getSavedPlayer()?.combatState) {
    setSavedPlayer({
      combatState: null,
      ...(fight?.tutorial ? { stats: fight.tutorial.originalStats } : {}),
    });
  }
  enemy = null;
  enemies = [];
  playerDefending = false;
  playerStatuses = [];
  fight = null;
  // Overcharged power drains back to max once the fight ends.
  if (!contestContext && !preserveSaved) {
    const stats = getSavedPlayer()?.stats;
    if (stats && stats.power > stats.maxPower) setSavedPlayer({ stats: { ...stats, power: stats.maxPower } });
  }
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
const prepareEnemy = (template) => ({
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
  statusResistance: template.statusResistance ?? getEnemyStatusResistance(
    template.tier,
    template.worldBossCycle ? "worldBoss" : template.labyrinth ? "labyrinth" : template.dungeon ? "dungeon" : template.colosseum ? "colosseum" : "travel",
  ),
  hp: template.maxHp,
  defending: false,
  statuses: [],
  cooldowns: {},
  phasesDone: [],
  stunGrace: false,
  ...(template.worldBossCycle ? { worldBossDamageDealt: 0 } : {}),
});

export const startCombat = (templates, { enemyFirst = false } = {}) => {
  const roster = Array.isArray(templates) ? templates : [templates];
  if (!roster.length || roster.some((foe) => !foe))
    throw new Error("Combat requires at least one enemy.");
  if (roster.length > 1 && roster.some((foe) => foe.tier === "boss"))
    throw new Error("Boss encounters must be one-on-one.");
  const template = roster[0];
  enemies = roster.map((foe) => {
    const prepared = prepareEnemy(foe);
    prepared.speed = Math.round(prepared.speed * ENEMY_SPEED_MULTIPLIER);
    return prepared;
  });
  enemy = enemies[0];
  playerDefending = false;
  playerStatuses = [];
  openingReplies = [];
  if (enemy.worldBossCycle)
    openingReplies.push(`${enemy.name} is immune to health-percentage damage.`);

  const p = getPlayer();
  const ab = getAbilityTotals(p);
  const passives = getEquippedPassives(p);
  fight = {
    ab,
    cls: p.class,
    round: 1,
    actions: { ...freshActions(), ...(passives.includes("quickReflexes") ? { quickSkill: true } : {}) },
    usedUltimates: {},
    passives,
    quickReflexesReady: passives.includes("quickReflexes"),
    hatred: 0,
    inspired: false,
    lastLightUsed: false,
    ...(template.tutorial ? { tutorial: { step: 0, originalStats: { ...p.stats } } } : {}),
    secondWindUsed: false,
    combo: 0,
    kinds: new Set(),
    spellstrike: false,
    playerStunGrace: false,
    playerActsFirst: !enemyFirst && enemy.speed <= Math.round(
      (p.stats?.speed || 0) * (1 + (ab.speedMult || 0)),
    ),
    ward: 0,
    wardMax: 0,
    temperedStrikes: 0,
    starKinds: new Set(),
    starReady: false,
    rootstrideReady: true,
    unwrittenPathStrikes: 0,
    echoCount: 0,
    tideHits: 0,
    hunger: 0,
    mostDamageDealt: 0,
  };
  if (fight.ab.uniqueEffects.includes("marrowWard")) {
    fight.wardMax = Math.round((p.stats?.maxHealth || 0) * 0.2);
    fight.ward = fight.wardMax;
  }
  if (template.tutorial) {
    setPlayer({ stats: { ...p.stats, health: Math.max(1, Math.floor(p.stats.maxHealth * 0.6)) } });
  }

  // The faster combatant acts first; ties go to the player.
  const speed = Math.round(
    (p.stats?.speed || 0) * (1 + (fight.ab.speedMult || 0)),
  );
  const target = enemy;
  const s = { ...p.stats };
  let outcome = null;
  for (const foe of enemies) {
    if (!enemyFirst && foe.speed <= speed) continue;
    enemy = foe;
    openingReplies.push(
      enemyFirst
        ? `The ${enemy.name} catches you and acts first!`
        : `The ${enemy.name} is faster and acts first!`,
    );
    const result = enemyTurn(s, openingReplies);
    if (result === "collapse") {
      outcome = result;
      break;
    }
  }
  enemy = target;
  selectLivingTarget();
  if (encounterWon()) outcome = "victory";
  if (openingReplies.length) settle(outcome, p, s, openingReplies, {});
  else {
    openingReplies.push("You are faster and act first!");
  }
  if (!contestContext) saveCombatState();
};

function saveCombatState() {
  const combatState = combatSnapshot();
  if (combatState) setPlayer({ combatState });
}

function combatSnapshot() {
  // Scripted dungeon/world encounters own their restart and callback lifecycle.
  if (!enemy || contestContext || enemy.dungeon || enemy.labyrinth || enemy.colosseum || enemy.worldBossCycle) return null;
  return {
    enemy, enemies, targetIndex: enemies.indexOf(enemy),
    fight: serializeFight(fight), playerStatuses, playerDefending,
  };
}

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
  if (!addStatus(enemy.statuses, id, { ...opts, power, resistance: enemy.statusResistance })) {
    replies.push(`The ${enemy.name} resists being ${lower(id)}!`);
    return false;
  }
  replies.push(`The ${enemy.name} is now ${lower(id)}.`);
  return true;
}

function inflictOnPlayer(id, opts, replies) {
  const def = STATUSES[id];
  if (def.kind === "skip" && fight.playerStunGrace) {
    replies.push("You shake off the stun.");
    return false;
  }
  if (!addStatus(playerStatuses, id, { ...opts, resistance: getPlayer().stats.statusResistance })) {
    replies.push(`You resist being ${lower(id)}!`);
    return false;
  }
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

function dealEnemyDamage(amount) {
  const before = enemy.hp;
  enemy.hp = Math.max(0, enemy.hp - amount);
  if (contestContext) {
    const defender = contestContext.defender;
    const wind = defender.combat.ab.secondWind;
    if (wind && !defender.combat.secondWindUsed && enemy.hp <= enemy.maxHp * 0.1) {
      defender.combat.secondWindUsed = true;
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.round(enemy.maxHp * wind));
      contestContext.reactions.push(`${enemy.name}'s Second Wind restores health!`);
    }
    if (enemy.hp <= 0 && passiveOn("lastLight", defender.combat) && !defender.combat.lastLightUsed) {
      defender.combat.lastLightUsed = true;
      enemy.hp = 1;
      addLastLightBarrier(enemy.statuses, enemy.maxHp);
      contestContext.reactions.push(`Last Light! ${enemy.name} refuses to fall.`);
    }
  }
  fight.mostDamageDealt = Math.max(fight.mostDamageDealt, before - enemy.hp);
  if (enemy.worldBossCycle)
    enemy.worldBossDamageDealt += before - enemy.hp;
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
  if (s.health <= 0 && passiveOn("lastLight") && !fight.lastLightUsed) {
    fight.lastLightUsed = true;
    s.health = 1;
    const barrier = addLastLightBarrier(playerStatuses, s.maxHealth);
    replies.push(`[green]Last Light![/green] You cling to 1 health behind a ${barrier} barrier.`);
  }
}

// Last Light's barrier: adds to any existing barrier. Returns the amount added.
function addLastLightBarrier(statuses, maxHealth) {
  const amount = Math.max(1, Math.round(maxHealth * PT.lastLight.barrier));
  const shield = statuses.find((st) => st.id === "barrier");
  if (shield) shield.power += amount;
  else addStatus(statuses, "barrier", { power: amount });
  return amount;
}

function hurtEnemy(amount, replies, source, calculation) {
  dealEnemyDamage(amount);
  replies.push(
    `${source} hits the ${enemy.name} for ${damageNumber(amount, calculation || [`Damage dealt: ${amount}.`])} damage.`,
  );
}

// Ticks a status list: damage/healing over time through `apply(amount, label)` (negative = healing), then durations drop.
// Stun-like statuses last until they cost a turn. Returns the remaining statuses.
const tickStatuses = (list, maxHp, apply, percentDamageImmune = false) => {
  for (const st of list) {
    const kind = STATUSES[st.id].kind;
    if (kind === "dot" && !percentDamageImmune) {
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
  const target = enemy;
  for (const foe of enemies) {
    if (foe.hp <= 0) continue;
    enemy = foe;
    enemy.statuses = tickStatuses(
      enemy.statuses,
      enemy.maxHp,
      (amount, label, calculation) => {
        if (amount < 0) {
          healEnemy(-amount, replies);
          return;
        }
        dealEnemyDamage(amount);
        replies.push(
          `The ${foe.name} takes ${damageNumber(amount, calculation)} ${label} damage.`,
        );
      },
      !!enemy.worldBossCycle,
    );
  }
  enemy = target;
  selectLivingTarget();
  if (encounterWon()) return "victory";

  playerStatuses = tickStatuses(
    playerStatuses,
    s.maxHealth,
    (amount, label, calculation) => {
      if (amount < 0) {
        healPlayer(s, -amount, replies, "Regeneration");
        return;
      }
      damagePlayer(s, amount, replies);
      replies.push(
        `You take ${damageNumber(amount, calculation)} ${label} damage.`,
      );
    },
  );

  if (fight.cls === "Spellcaster") gainPower(s, 1);
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
// Unbreakable: below 35% health (checked before the hit), a single hit can't exceed 25% of max health.
const unbreakableLimit = (state, stats) =>
  passiveOn("unbreakable", state) && stats.health < stats.maxHealth * PT.unbreakable.threshold
    ? Math.max(1, Math.floor(stats.maxHealth * PT.unbreakable.cap)) : Infinity;

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
  if (!ability?.heavy && Math.random() < (enemy.critical || 0)) {
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
  if (critical && s.criticalResistance > 0) {
    const resistance = Math.min(MAX_CRITICAL_RESISTANCE, s.criticalResistance);
    dmg *= 1 - resistance;
    calculation.push(`Critical Resistance: ×${1 - resistance} = ${dmg}.`);
  }
  if (passiveOn("glassCannon")) {
    dmg *= 1 + PT.glassCannon.taken;
    calculation.push(`Glass Cannon: ×${1 + PT.glassCannon.taken} = ${dmg}.`);
  }
  const beforeRounding = dmg;
  dmg = Math.max(1, Math.round(dmg));
  calculation.push(`Final rounding: ${beforeRounding} → ${dmg} (minimum 1).`);
  const unbreakableCap = unbreakableLimit(fight, s);
  if (dmg > unbreakableCap) {
    dmg = unbreakableCap;
    calculation.push(`Unbreakable: capped at ${unbreakableCap}.`);
  }

  if (fight.ab.uniqueEffects.includes("marrowWard") && fight.ward > 0) {
    const absorbed = Math.min(fight.ward, dmg);
    fight.ward -= absorbed;
    dmg -= absorbed;
    replies.push(`Marrow Ward absorbs ${absorbed} damage${fight.ward ? ` (${fight.ward} ward remains)` : " and breaks"}.`);
    calculation.push(`Marrow Ward absorbs ${absorbed}; ${dmg} damage passes through.`);
  }
  if (dmg > 0) {
    const { remaining, absorbed } = absorbDamage(playerStatuses, dmg);
    if (absorbed) {
      dmg = remaining;
      replies.push(`Your barrier absorbs ${absorbed} damage.`);
      calculation.push(`Barrier absorbs ${absorbed}; ${dmg} damage passes through.`);
    }
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
  if (dmg > 0 && passiveOn("revenge")) fight.hatred = (fight.hatred || 0) + dmg;
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
    if (inflictOnEnemy("stun", {}, replies))
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
  if (enemy.recovering) {
    for (const key of Object.keys(enemy.cooldowns)) enemy.cooldowns[key] = Math.max(0, enemy.cooldowns[key] - 1);
    const stun = enemy.statuses.findIndex((st) => STATUSES[st.id].kind === "skip");
    if (stun >= 0) {
      enemy.statuses.splice(stun, 1);
      enemy.stunGrace = true;
      replies.push(`The ${enemy.name} is stunned; recovery is delayed.`);
      return null;
    }
    enemy.recovering = false;
    replies.push(`The ${enemy.name} recovers and cannot act this turn.`);
    return null;
  }
  if (!enemy.pending)
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
  if (enemy.tutorial && !enemy.pending) {
    enemy.pending = enemy.abilities[0];
    replies.push("The Training Sentinel prepares Training Slam! Defend before ending your next turn.");
    return null;
  }
  const committed = enemy.pending;
  const action = committed ? { type: "skill", skill: committed } : chooseEnemyAction(wasDefending);

  if (action.type === "defend") {
    enemy.defending = true;
    replies.push(`The ${enemy.name} braces itself, ready to defend.`);
    return null;
  }

  const ability = action.type === "skill" ? action.skill : null;
  if (ability?.heavy && !committed) {
    enemy.pending = ability;
    if (ability.cooldown) enemy.cooldowns[ability.name] = ability.cooldown;
    replies.push(`The ${enemy.name} prepares ${ability.name}! ${ability.warning || "Defend or prepare protection before ending your next turn."}`);
    return null;
  }
  if (committed) {
    enemy.pending = null;
    enemy.recovering = true;
    if (enemy.tutorial) {
      const damage = Math.max(1, Math.round(s.maxHealth * (playerDefending ? 0.08 : 0.2)));
      s.health = Math.max(1, s.health - damage);
      replies.push(`The Training Sentinel releases Training Slam! Your guard reduces it to ${damage} damage. It is now Recovering.`);
      return null;
    }
  }
  if (ability?.cooldown && !committed) enemy.cooldowns[ability.name] = ability.cooldown;
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

function scavenge(s, replies) {
  if (!passiveOn("scavenger")) return;
  const health = Math.min(s.maxHealth - s.health, Math.round(s.maxHealth * PT.scavenger.restore));
  const power = Math.min(Math.max(0, s.maxPower - s.power), Math.round(s.maxPower * PT.scavenger.restore));
  s.health += Math.max(0, health);
  s.power += power;
  if (health > 0 || power > 0)
    replies.push(`Scavenger: you recover ${Math.max(0, health)} health and ${power} power.`);
}

function winCombat(p, s, replies, patch) {
  s.power = Math.min(s.power, s.maxPower);
  scavenge(s, replies);
  if (enemy.worldBossCycle) {
    replies.push(`The ${enemy.name} falls! Its contribution is recorded for the world.`);
    enemy.onDefeat?.(p, s, patch, replies);
    setPlayer({ ...patch, stats: s });
    endCombat();
    return;
  }
  const leader = enemies[0];
  const multiplier = 1 + GROUP_REWARD_BONUS * (enemies.length - 1);
  if (enemies.length > 1)
    replies.push(`Encounter cleared! ${enemies.length} enemies defeated; +${Math.round((multiplier - 1) * 100)}% exp and astra.`);
  let totalExp = 0;
  for (const foe of enemies) {
    enemy = foe;
    totalExp += awardEnemyRewards({ ...p, ...patch }, s, replies, patch, multiplier);
  }
  const leveled = gainExp({ ...p, ...patch, stats: s }, totalExp);
  Object.assign(patch, leveled.patch);
  replies.push(...leveled.messages);
  for (const foe of enemies)
    foe.onDefeat?.({ ...p, ...patch }, patch.stats, patch, replies);
  leader.onEncounterDefeat?.({ ...p, ...patch }, patch.stats, patch, replies);
  setPlayer(patch);
  endCombat();
}

function awardEnemyRewards(p, s, replies, patch, rewardMultiplier) {
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
  const astraMultiplier = (1 + (fight.ab.astraBonus || 0) + plunderBonus) * rewardMultiplier;
  const astra = enemy.colosseum
    ? Math.floor(enemy.astra * astraMultiplier * 0.5)
    : Math.round(enemy.astra * astraMultiplier);
  const exp = enemy.colosseum ? Math.floor(enemy.exp / 2) : Math.round(enemy.exp * rewardMultiplier);
  patch.astra = (p.astra || 0) + astra;
  replies.push(
    `The ${enemy.name} falls! You gain ${exp} exp and ${astra} {{astra|astra}}.`,
  );

  if (!enemy.colosseum) {
    const questKill = recordQuestKill(p.quests, enemy);
    if (questKill.messages.length) {
      patch.quests = questKill.quests;
      replies.push(...questKill.messages);
    }
  }

  // Luck improves drop chance by 1% per 3 points
  const luckBonus = Math.floor((s.luck || 0) / 3) * 0.01;

  const drops = rollMaterialDrops(
    enemy,
    luckBonus + getKeyItemEffect(p, "materialChance"),
  );
  for (const [key, amount] of Object.entries(rollCraftingDrops(enemy, luckBonus)))
    drops[key] = (drops[key] || 0) + amount;
  if (Object.keys(drops).length) {
    patch.materials = addToMaterials(p.materials, drops);
    const list = Object.entries(drops).map(
      ([k, n]) => `{{${n}x ${MATERIALS[k].name}|material:${k}}}`,
    );
    replies.push(`Materials gained: ${list.join(", ")}.`);
  }

  if (!enemy.colosseum) {
    if (Math.random() < (enemy.dropChance ?? BASE_DROP_CHANCE) + luckBonus) {
      const item = generateRandomSlotItem(
        enemy.minRarity || 0,
        0,
        enemy.tier === "boss" ? {} : { maxILevel: enemy.level },
      );
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
    if (!enemy.dungeon) {
      for (const [key, chance] of [
        ["runeOfUnpredictability", RUNE_OF_UNPREDICTABILITY_DROP_CHANCE],
        ["polishingRune", POLISHING_RUNE_DROP_CHANCE],
      ]) {
        if (Math.random() < chance) {
          const consumables = { ...(patch.consumables ?? p.consumables ?? {}) };
          consumables[key] = (consumables[key] || 0) + 1;
          patch.consumables = consumables;
          replies.push(`The ${enemy.name} dropped a {{${CONSUMABLES[key].name}|consumable:${key}}}!`);
        }
      }
    }
    if (Math.random() < 0.08 + luckBonus) {
      const gemstone = generateRandomGemstone();
      patch.gemstones = [...(p.gemstones || []), gemstone];
      replies.push(`The ${enemy.name} dropped a {{${gemstone.name}|gemstone:${gemstone.id}}}!`);
    }
    if (canDropSkillGemstone(enemy) && Math.random() < SKILL_GEM_DROP_CHANCE) {
      const gemstone = generateRandomSkillGemstone();
      patch.gemstones = [...(patch.gemstones || p.gemstones || []), gemstone];
      replies.push(`The ${enemy.name} dropped a {{${gemstone.name}|gemstone:${gemstone.id}}}!`);
    }
    const certificateChance = ITEM_CERTIFICATE_DROP_CHANCE[enemy.dungeon ? "dungeon" : "overworld"][enemy.tier];
    if (certificateChance && Math.random() < certificateChance) {
      const consumables = { ...(patch.consumables ?? p.consumables ?? {}) };
      consumables.itemCertificate = (consumables.itemCertificate || 0) + 1;
      patch.consumables = consumables;
      replies.push(`The ${enemy.name} dropped an {{Item Certificate|consumable:itemCertificate}}!`);
    }
  }
  return exp;
}

// Applies a round outcome and saves. Returns { replies, over }.
function settle(outcome, p, s, replies, patch) {
  if (contestContext) {
    setPlayer({ ...patch, stats: s });
    return { replies, over: !!outcome, outcome };
  }
  if (fight.tutorial && outcome === "victory") {
    const originalStats = fight.tutorial.originalStats;
    setPlayer({ combatTutorialCompleted: true, combatState: null, stats: originalStats });
    replies.push("Training complete! Your health and resources are restored to their pre-training values. Your own items were not spent. On future turns choose an Action and a Quick Action in either order, or two Quick Actions.");
    endCombat();
    return { replies, over: true, outcome, turnEnded: true };
  }
  const increments = {};
  if (outcome === "victory")
    for (const foe of enemies)
      if (["basic", "elite", "boss"].includes(foe.tier)) {
        const key = `${foe.tier}EnemiesKilled`;
        increments[key] = (increments[key] || 0) + 1;
      }
  updateRecords(p, patch, {
    increments,
    maxima: {
      mostDamageDealt: fight.mostDamageDealt,
      ...(outcome === "victory" && enemy.colosseum
        ? { highestClearedColosseumWave: enemy.colosseumWave }
        : {}),
    },
  });
  if (outcome === "victory") {
    winCombat(p, s, replies, patch);
    return { replies, over: true, outcome };
  }
  if (outcome === "collapse") {
    collapse(p, s, replies, patch);
    endCombat();
    setPlayer({ ...patch, stats: s });
    return { replies, over: true, outcome };
  }
  selectLivingTarget();
  setPlayer({ ...patch, stats: s, combatState: combatSnapshot() });
  return { replies, over: false, outcome: null };
}

// Ends the player's action: the enemy takes its turn, effects tick, then the player's guard drops.
function finishRound(p, s, replies, patch) {
  if (contestContext) {
    playerStatuses = tickStatuses(playerStatuses, s.maxHealth, (amount, label) => {
      if (amount < 0) healPlayer(s, -amount, replies);
      else {
        damagePlayer(s, amount, replies);
        replies.push(`You take ${amount} ${label} damage.`);
      }
    });
    if (fight.cls === "Spellcaster") gainPower(s, 1);
    fight.round += 1;
    fight.actions = newActions();
    return { ...settle(s.health <= 0 ? "collapse" : enemy.hp <= 0 ? "victory" : null, p, s, replies, patch), turnEnded: true };
  }
  const target = enemy;
  let outcome = null;
  for (const foe of enemies) {
    if (foe.hp <= 0) continue;
    enemy = foe;
    if (enemyTurn(s, replies) === "collapse") {
      outcome = "collapse";
      break;
    }
  }
  enemy = target;
  selectLivingTarget();
  outcome = outcome || (encounterWon() ? "victory" : endOfRound(s, replies));
  playerDefending = false;
  if (!outcome) {
    fight.round += 1;
    fight.actions = newActions();
  }
  const result = settle(outcome, p, s, replies, patch);
  if (!result.over) {
    if (Number.isFinite(enemy.maxRounds) && enemy.maxRounds > 0 && fight.round > enemy.maxRounds) {
      replies.push(`The ${enemy.name} forces you from the fight after ${enemy.maxRounds} rounds. Your damage contribution is recorded.`);
      endCombat();
      result.over = true;
    }
  }
  return { ...result, turnEnded: true };
}

function actionError(type, key) {
  if (!enemy || !fight) return "There is nothing to fight.";
  if (fight.meteorCharge && !(type === "skill" && key === "meteor"))
    return "Meteor is ready to strike and must be released now.";
  if (
    type === "skill" &&
    SKILLS[key]?.ultimate &&
    fight.usedUltimates?.[key] &&
    !(fight.meteorCharge?.skillKey === key)
  )
    return `${SKILLS[key].name} has already been used in this combat.`;
  if (fight.tutorial) {
    const error = tutorialActionError(fight.tutorial.step, type, key);
    if (error) return error;
  }
  return type === "pass" ? null : getActionAvailability(fight.actions, type, key).message;
}

const rejectedAction = (message) => ({ replies: [message], over: false, used: false, turnEnded: false });

export const isUltimateUsed = (key) => !!(SKILLS[key]?.ultimate && fight?.usedUltimates?.[key]);

// A channeled Meteor strikes as soon as the player's next turn begins (Contest handles this at turn handoff).
function releaseChargedMeteor(result) {
  if (result.over || !fight?.meteorCharge || contestContext) return result;
  const strike = attackRound();
  return { ...strike, replies: [...result.replies, ...strike.replies], used: true };
}

function completeAction(type, key, p, s, replies, patch = {}, forceEndTurn = false) {
  const { slot } = getActionAvailability(fight.actions, type, key);
  fight.actions[slot] = false;
  if (type === "skill") fight.actions.usedSkills.push(key);
  if (type === "skill" && fight.quickReflexesReady && !SKILLS[key]?.ultimate) {
    fight.quickReflexesReady = false;
    fight.actions.quickSkill = false;
  }
  if (fight.tutorial) fight.tutorial.step += 1;
  if (s.health <= 0 || encounterWon())
    return { ...settle(s.health <= 0 ? "collapse" : "victory", p, s, replies, patch), turnEnded: true };
  if (forceEndTurn || (!fight.actions.actionAvailable && !fight.actions.quickAvailable))
    return finishRound(p, s, replies, patch);
  return { ...settle(null, p, s, replies, patch), turnEnded: false };
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
  const releasingMeteor = !!fight?.meteorCharge;
  if (releasingMeteor) {
    skillKey = "meteor";
    type = "magic";
  }
  if (!releasingMeteor && ((skillKey && !SKILLS[skillKey]) || (!skillKey && !["melee", "magic"].includes(type))))
    return rejectedAction("Choose an available attack or equipped skill.");
  const actionType = skillKey ? "skill" : type;
  const error = actionError(actionType, skillKey);
  if (error) return rejectedAction(error);
  const p = getPlayer();
  const s = { ...p.stats };
  const replies = [];
  const skill = skillKey ? SKILLS[skillKey] : null;
  const level = skill ? (releasingMeteor ? fight.meteorCharge.level : getSkillLevel(p, skillKey)) : 0;
  let cost = 0;
  if (skill) {
    if (level < 1 || !(p.equippedSkills || []).includes(skillKey))
      return {
        replies: ["You haven't learned that skill."],
        over: false,
        used: false,
      };
    cost = releasingMeteor ? 0 : skillCost(p, skillKey);
    if (s.power < cost)
      return {
        replies: [`You need ${cost} power to use ${skill.name}.`],
        over: false,
        used: false,
      };
    type = skill.type;
  }
  if (loseTurnToStun(replies)) {
    if (releasingMeteor) {
      fight.meteorCharge = null;
      replies.push("The stun interrupts your Meteor channel!");
    }
    return { ...finishRound(p, s, replies, {}), used: true };
  }
  if (releasingMeteor) {
    fight.meteorCharge = null;
    replies.push("Your Meteor crashes down!");
  }
  if (fight.tutorial) {
    const final = fight.tutorial.step === TUTORIAL_STEPS.length - 1;
    const dealt = final ? enemy.hp : Math.min(25, enemy.hp - 1);
    enemy.hp = final ? 0 : Math.max(1, enemy.hp - 25);
    replies.push(`Your training strike deals ${dealt} damage.`);
    return { ...completeAction(type, null, p, s, replies), used: true };
  }
  const overcharged = !!skill && passiveOn("overcharge") && s.power > s.maxPower;
  s.power -= cost;
  if (skill?.ultimate && !releasingMeteor) {
    fight.usedUltimates = fight.usedUltimates || {};
    fight.usedUltimates[skillKey] = true;
  }
  if (skill?.charge && !releasingMeteor) {
    fight.meteorCharge = { skillKey, level };
    replies.push("You begin channeling Meteor. It will strike at the start of your next turn unless the channel is interrupted.");
    return releaseChargedMeteor({ ...completeAction(actionType, skillKey, p, s, replies, {}, true), used: true });
  }
  const echo = advanceEcho(fight, fight.ab);

  // Outside group combat, support skills always target the caster.
  if (skill?.type === "support") {
    const self = { name: "You", stats: s, statuses: playerStatuses };
    replies.push(`You use ${skill.name}.`);
    const support = applySupportSkill(skillKey, level, self, [self], { passives: fight.passives });
    replies.push(...support.lines);
    if (echo) {
      const echoed = applySupportSkill(skillKey, level, self, [self], { echo: TEMPORAL_ECHO.power, passives: fight.passives }).lines;
      replies.push(echoed.length ? `Chronal Loop: ${skill.name} echoes through time!` : "Chronal Loop: the echo finds nothing to repeat.", ...echoed);
    }
    if (passiveOn("inspiration") && support.affected.length && !fight.inspired) {
      fight.inspired = true;
      replies.push("Inspiration: your next attack deals 10% more damage.");
    }
    playerStatuses = self.statuses;
    fight.combo += 1;
    if (fight.cls === "Spellblade") {
      fight.spellstrike = true;
      replies.push("Your weapon crackles with energy!");
    }
    return { ...completeAction(actionType, skillKey, p, s, replies, {}, !!skill?.ultimate), used: true };
  }

  const { ab, cls } = fight;
  const target = enemy;
  const targets = skill?.area && !contestContext
    ? [target, ...enemies.filter((foe) => foe !== target && foe.hp > 0)]
    : [target];
  const inspired = fight.inspired;
  const hatred = fight.hatred;
  for (const foe of targets) {
    enemy = foe;
    strikeTarget({ s, replies, skill, skillKey, level, type, overcharged, echo, inspired, hatred });
    if (s.health <= 0) break;
  }
  enemy = target;
  if (inspired) fight.inspired = false;
  if (passiveOn("revenge") && hatred > 0) fight.hatred = 0;
  if (ab.uniqueEffects.includes("starCharted")) {
    fight.starKinds.add(skill ? "skill" : type);
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
  if (!skill && passiveOn("battleTrance")) {
    const before = s.power;
    gainPower(s, PT.battleTrance.power);
    if (s.power > before) replies.push(`Battle Trance: you recover ${s.power - before} power.`);
  }

  if (encounterWon())
    return { ...settle("victory", p, s, replies, {}), used: true, turnEnded: true };
  return { ...completeAction(actionType, skillKey, p, s, replies), used: true };
}

function strikeTarget({ s, replies, skill, skillKey, level, type, overcharged, echo, inspired, hatred }) {
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
  if (
    ctx.crit &&
    ab.uniqueEffects.includes("fortunesSpark") &&
    Math.random() < FORTUNES_SPARK_CHANCE
  ) {
    const bonusPercent = roll(100, 300);
    hit *= 1 + bonusPercent / 100;
    calculation.push(
      `Fortune's Spark bonus: +${bonusPercent}% (×${1 + bonusPercent / 100}) = ${hit}.`,
    );
    replies.push(`Fortune's Spark activates for +${bonusPercent}% damage!`);
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
  const hunger = ab.uniqueEffects.includes("starEaterHunger")
    ? Math.min(STAR_EATER.maxStacks, fight.hunger || 0) * STAR_EATER.bonus
    : 0;
  if (hunger) {
    bonus += hunger;
    calculation.push(`Star-Eater's Hunger: +${Math.round(hunger * 100)}%.`);
  }
  const passiveBonuses = [
    passiveOn("apexPredator") && enemy.hp < enemy.maxHp * PT.apexPredator.threshold && ["Apex Predator", PT.apexPredator.bonus],
    passiveOn("glassCannon") && ["Glass Cannon", PT.glassCannon.dealt],
    passiveOn("unbreakable") && ["Unbreakable", -PT.unbreakable.penalty],
    overcharged && ["Overcharge", PT.overcharge.bonus],
    inspired && ["Inspiration", PT.inspiration.bonus],
    passiveOn("revenge") && hatred > 0 &&
      ["Revenge", Math.min(PT.revenge.maxBonus, hatred / Math.max(1, s.maxHealth))],
  ].filter(Boolean);
  for (const [name, value] of passiveBonuses) {
    bonus += value;
    calculation.push(`${name}: ${value >= 0 ? "+" : ""}${Math.round(value * 100)}%.`);
  }
  if (passiveOn("revenge") && hatred > 0) {
    replies.push("Revenge: your Hatred fuels the strike!");
  }
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
    const blockMultiplier = contestContext?.defender.combat.cls === "Swordsman" ? BULWARK_DAMAGE_TAKEN : 0.5;
    dealt = Math.max(1, Math.floor(dealt * blockMultiplier));
    calculation.push(
      `Enemy defending: floor(${beforeBlock} × ${blockMultiplier}) = ${dealt} (minimum 1).`,
    );
  }
  if (contestContext && ctx.crit) {
    const resistance = Math.min(MAX_CRITICAL_RESISTANCE, Math.max(0, contestContext.defender.player.stats.criticalResistance || 0));
    dealt = Math.max(1, Math.round(dealt * (1 - resistance)));
    if (resistance) calculation.push(`Critical Resistance: ×${1 - resistance} = ${dealt}.`);
  }
  if (contestContext) dealt = defendContestStrike(dealt, s, replies);
  ctx.dealt = dealt;
  dealEnemyDamage(dealt);
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

  if (glacialShatter && dealt > 0) {
    enemy.statuses = enemy.statuses.filter((status) => status.id !== "vulnerable");
    replies.push("Glacial Edge shatters the enemy's vulnerability!");
  }
  if (constellationReady && dealt > 0 && enemy.hp > 0) {
    inflictOnEnemy("stun", {}, replies);
    replies.push("The constellation aligns and locks the enemy in place!");
  }
  if (ab.uniqueEffects.includes("rootstride") && fight.playerActsFirst && fight.rootstrideReady) {
    fight.rootstrideReady = false;
    if (dealt > 0 && enemy.hp > 0) {
      inflictOnEnemy("stun", {}, replies);
      replies.push("Rootstride binds the enemy with your opening strike!");
    }
  }
  if (ab.uniqueEffects.includes("undyingHunger") && dealt > 0 &&
      enemy.statuses.some((status) => ["burn", "poison", "bleed"].includes(status.id))) {
    healPlayer(s, Math.round(s.maxHealth * 0.08), replies, "Undying Hunger");
  }
  if (!enemy.worldBossCycle && ab.uniqueEffects.includes("moltenGrip") && dealt > 0 && enemy.hp > 0 &&
      enemy.statuses.some((status) => status.id === "burn")) {
    const burn = enemy.statuses.find((status) => status.id === "burn");
    const burnTick = Math.max(
      1,
      Math.round(enemy.maxHp * burn.power * burn.stacks),
    );
    const burst = burnTick * 2;
    dealEnemyDamage(burst);
    enemy.statuses = enemy.statuses.filter((status) => status.id !== "burn");
    replies.push(
      `Molten Grip detonates the burn for ${damageNumber(burst, [
        `Burn tick: ${enemy.maxHp} × ${burn.power} × ${burn.stacks} = ${burnTick}.`,
        `Detonation: ${burnTick} × 2 = ${burst}.`,
      ])} damage.`,
    );
  }
  if (ab.lifesteal && dealt > 0)
    healPlayer(
      s,
      Math.max(1, Math.round(dealt * ab.lifesteal)),
      replies,
      "Vampiric",
    );
  if (ab.surge && ctx.crit && dealt > 0 && s.power < powerCap(s)) {
    gainPower(s, Math.round((s.maxPower * ab.surge) / 2));
    replies.push("Arcane Surge: you recover power!");
  }
  if (ctx.crit && dealt > 0 && ab.uniqueEffects.includes("orbitalFocus")) {
    if (enemy.hp > 0) {
      const shard = Math.max(1, Math.round(dealt * 0.35));
      dealEnemyDamage(shard);
      replies.push(`Orbital Focus launches a shard for ${damageNumber(shard, [`Strike damage: ${dealt}.`, `Orbiting shard: ${dealt} × 35% = ${shard}.`])} bonus damage.`);
    }
  }
  if (echo && dealt > 0 && enemy.hp > 0) {
    const echoed = Math.max(1, Math.round(dealt * TEMPORAL_ECHO.power));
    dealEnemyDamage(echoed);
    replies.push(`Chronal Loop: your ${skill ? skill.name : "strike"} echoes for ${damageNumber(echoed, [`Strike damage: ${dealt}.`, `Echo: ${dealt} × ${TEMPORAL_ECHO.power * 100}% = ${echoed}.`])} damage.`);
  }
  if (dealt > 0 && enemy.hp > 0 && ab.uniqueEffects.includes("starEaterHunger")) {
    const meal = enemy.statuses.find((status) => STAR_EATER.buffs.includes(status.id));
    if (meal) {
      enemy.statuses = enemy.statuses.filter((status) => status !== meal);
      fight.hunger = Math.min(STAR_EATER.maxStacks, (fight.hunger || 0) + 1);
      replies.push(`Star-Eater's Hunger devours the ${enemy.name}'s ${STATUSES[meal.id].name} effect (+${Math.round(fight.hunger * STAR_EATER.bonus * 100)}% damage)!`);
      healPlayer(s, Math.round(s.maxHealth * STAR_EATER.heal), replies, "Star-Eater's Hunger");
    }
  }
  if (dealt > 0) skill?.onHit?.(ctx);
  if (dealt > 0 && enemy.hp > 0) {
    if (ab.ignite && Math.random() < ab.ignite)
      inflictOnEnemy("burn", { turns: 3, power: 0.04 }, replies);
    if (ab.weakened && Math.random() < ab.weakened)
      inflictOnEnemy("weaken", {}, replies);
    if (ab.poison && Math.random() < ab.poison)
      inflictOnEnemy("poison", {}, replies);
    if (ab.uniqueEffects.includes("bloomOfDecay")) {
      const existing = enemy.statuses.find((status) => status.id === "poison");
      const stacks = Math.min(5, (existing?.stacks || 0) + 1);
      const applied = inflictOnEnemy("poison", {}, replies);
      const poison = enemy.statuses.find((status) => status.id === "poison");
      if (applied && poison) {
        poison.stacks = stacks;
        replies.push(`Bloom of Decay grows to ${stacks} poison stack${stacks === 1 ? "" : "s"}.`);
      }
    }
    if (ab.uniqueEffects.includes("saltbloodTide")) {
      inflictOnEnemy("bleed", SALTBLOOD_TIDE.bleed, replies);
      fight.tideHits = (fight.tideHits || 0) + 1;
      const bleed = enemy.statuses.find((status) => status.id === "bleed");
      if (!enemy.worldBossCycle && fight.tideHits >= SALTBLOOD_TIDE.every && bleed) {
        fight.tideHits = 0;
        const burst = bleedRemaining(bleed, enemy.maxHp);
        enemy.statuses = enemy.statuses.filter((status) => status !== bleed);
        dealEnemyDamage(burst);
        replies.push(`Saltblood Tide breaks, drawing out the bleed for ${damageNumber(burst, [
          `Bleed: ${enemy.maxHp} × ${bleed.power} × ${bleed.stacks} for ${bleed.turns} round(s).`,
          `All at once: ${burst}.`,
        ])} damage!`);
        healPlayer(s, Math.min(Math.round(burst * SALTBLOOD_TIDE.healShare), Math.round(s.maxHealth * SALTBLOOD_TIDE.healCap)), replies, "Saltblood Tide");
      }
    }
    if (cls === "Trickster" && Math.random() < HEX_CHANCE)
      inflictOnEnemy(
        Math.random() < 0.5 ? "weaken" : "vulnerable",
        { turns: 2 },
        replies,
      );
  }
}

// Skipping your turn: a stun is used up, otherwise you simply wait while the enemy acts.
export function passRound() {
  const error = actionError("pass");
  if (error) return rejectedAction(error);
  const p = getPlayer();
  const s = { ...p.stats };
  const replies = [];
  if (!loseTurnToStun(replies)) replies.push("You end your turn.");
  if (fight.tutorial) fight.tutorial.step += 1;
  return { ...finishRound(p, s, replies, {}), used: true };
}

export const isPlayerStunned = () =>
  playerStatuses.some((st) => STATUSES[st.id]?.kind === "skip");

// Guarding on your turn reduces the next hit you take.
export function defendRound() {
  const error = actionError("defend");
  if (error) return rejectedAction(error);
  const p = getPlayer();
  const s = { ...p.stats };
  const replies = [];
  if (loseTurnToStun(replies))
    return { ...finishRound(p, s, replies, {}), used: true };
  playerDefending = true;
  replies.push("You brace yourself and defend.");
  return { ...completeAction("defend", null, p, s, replies), used: true };
}

// Using a consumable takes your turn. Returns { replies, over, used }; used is false (and no turn passes) if it can't be used.
export function consumeItemRound(key) {
  const error = actionError("consume", key);
  if (error) return rejectedAction(error);
  const p = getPlayer();
  const used = { ...p.stats };
  const statuses = [...playerStatuses];
  const result = applyConsumable(fight.tutorial ? { ...p, consumables: getCombatConsumables() } : p, key, used, {
    healScale: healMult(playerStatuses),
    statuses,
  });
  if (!result.ok)
    return { replies: [result.message], over: false, used: false };
  const replies = [];
  // A stunned player loses the turn without spending the item.
  if (loseTurnToStun(replies))
    return { ...finishRound(p, { ...p.stats }, replies, {}), used: true };
  playerStatuses = statuses;
  replies.push(result.message);
  return {
    ...completeAction("consume", key, p, used, replies, fight.tutorial ? {} : { consumables: result.consumables }),
    used: true,
  };
}

const serializeFight = (state) => ({
  ...state,
  kinds: [...state.kinds],
  starKinds: [...state.starKinds],
});
const restoreFight = (state) => ({
  ...state,
  actions: { ...freshActions(), ...state.actions, usedSkills: state.actions?.usedSkills || [] },
  kinds: new Set(state.kinds || []),
  starKinds: new Set(state.starKinds || []),
});

// Reuse PvE actions without touching the local character or an existing PvE fight.
const withContestContext = (context, work) => {
  const previous = { enemy, enemies, playerDefending, playerStatuses, fight, openingReplies, contestContext };
  contestContext = context;
  try {
    return work();
  } finally {
    ({ enemy, enemies, playerDefending, playerStatuses, fight, openingReplies, contestContext } = previous);
  }
};

export const createContestFighter = (player) => withContestContext({ player }, () => {
  startCombat({ name: "Contest opponent", maxHp: 1, speed: 0 });
  return {
    player,
    combat: serializeFight(fight),
    statuses: [],
    defending: false,
  };
});

function defendContestStrike(amount, s, replies) {
  const defender = contestContext.defender;
  const state = defender.combat;
  const stats = defender.player.stats;
  if (Math.random() < Math.min(MAX_PLAYER_CHANCE, stats.evasion || 0)) {
    replies.push(`${enemy.name} evades the attack!`);
    return 0;
  }
  if (state.cls === "Duelist" && Math.random() < PARRY_CHANCE) {
    damagePlayer(s, Math.max(1, Math.round(roll(stats.attackMin, stats.attackMax) * PARRY_COUNTER - s.defense)), replies);
    replies.push(`${enemy.name} parries and ripostes!`);
    return 0;
  }
  state.combo = 0;
  amount = Math.max(1, Math.round(amount * (1 - Math.min(DAMAGE_REDUCTION_CAP, state.ab.damageReduction || 0))));
  if (passiveOn("glassCannon", state)) amount = Math.max(1, Math.round(amount * (1 + PT.glassCannon.taken)));
  amount = Math.min(amount, unbreakableLimit(state, { health: enemy.hp, maxHealth: enemy.maxHp }));
  if (state.ward > 0) {
    const absorbed = Math.min(state.ward, amount);
    state.ward -= absorbed;
    amount -= absorbed;
    replies.push(`${enemy.name}'s Marrow Ward absorbs ${absorbed} damage.`);
  }
  if (amount > 0) {
    const { remaining, absorbed } = absorbDamage(enemy.statuses, amount);
    if (absorbed) {
      amount = remaining;
      replies.push(`${enemy.name}'s barrier absorbs ${absorbed} damage.`);
    }
  }
  if (state.ab.uniqueEffects.includes("temperedSteel")) {
    state.temperedStrikes += 1;
    if (state.temperedStrikes === 2) {
      state.temperedStrikes = 0;
      amount = 0;
      damagePlayer(s, Math.max(1, Math.round(stats.attackMax * 0.6 - s.defense)), replies);
      replies.push(`${enemy.name}'s Tempered Steel counters!`);
    }
  }
  if (state.ab.reflect && amount > 0)
    damagePlayer(s, Math.max(1, Math.round(amount * state.ab.reflect)), replies);
  if (enemy.defending && state.cls === "Swordsman")
    damagePlayer(s, Math.max(1, Math.round(roll(stats.attackMin, stats.attackMax) * BULWARK_COUNTER - s.defense)), replies);
  if (state.ab.uniqueEffects.includes("frozenResolve") && Math.random() < 0.1)
    inflictOnPlayer("stun", {}, replies);
  if (amount > 0 && passiveOn("revenge", state)) state.hatred = (state.hatred || 0) + amount;
  return amount;
}

export const playContestAction = (actor, target, action) => {
  const attacker = JSON.parse(JSON.stringify(actor));
  const defender = JSON.parse(JSON.stringify(target));
  defender.combat.ab = getAbilityTotals(defender.player);
  const context = { player: attacker.player, defender, reactions: [] };
  return withContestContext(context, () => {
    fight = restoreFight({ ...attacker.combat, ab: getAbilityTotals(attacker.player) });
    playerStatuses = attacker.statuses || [];
    playerDefending = attacker.turnEnded === false && !!attacker.defending;
    enemy = {
      name: defender.player.name,
      hp: defender.player.stats.health,
      maxHp: defender.player.stats.maxHealth,
      defense: defender.player.stats.defense,
      speed: Math.round(defender.player.stats.speed * (1 + (defender.combat.ab.speedMult || 0))),
      statuses: defender.statuses || [],
      defending: defender.defending,
      stunGrace: defender.combat.playerStunGrace,
      statusResistance: defender.player.stats.statusResistance || 0,
    };
    let result;
    if (action.type === "melee" || action.type === "magic") result = attackRound(action.type);
    else if (action.type === "skill" && (attacker.player.equippedSkills || []).includes(action.key))
      result = attackRound("melee", action.key);
    else if (action.type === "defend") result = defendRound();
    else if (action.type === "pass") result = passRound();
    else if (action.type === "consume") result = consumeItemRound(action.key);
    else throw new Error("Choose an available Contest action.");
    if (result.used === false) throw new Error(result.replies.join(" "));
    attacker.combat = serializeFight(fight);
    attacker.statuses = playerStatuses;
    attacker.defending = playerDefending;
    attacker.turnEnded = result.turnEnded;
    defender.player.stats.health = enemy.hp;
    defender.statuses = enemy.statuses;
    defender.combat.playerStunGrace = enemy.stunGrace;
    return { attacker, defender, replies: [...result.replies, ...context.reactions], turnEnded: result.turnEnded, used: result.used };
  });
};
