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
  cleanseDebuffs,
  hasStatus,
  healMult,
  incomingMult,
  outgoingMult,
} from "./statuses";
import { CONSUMABLES, getKeyItemEffect } from "../items/consumables";
import { MAX_PLAYER_CHANCE } from "../character/stats";
import { SKILLS, applySupportSkill, skillMultiplier } from "../character/skills";

/*
 Group combat: up to 3 players against any number of enemies, resolved one round at a time.
 Everything here is pure JSON in / JSON out (no module state) so the party leader's client can resolve a round,
 write it to the database, and every member renders the same result.

 combat = {
   round, players: { [id]: member }, enemies: [enemy], waves: [[template ids]], waveIndex, waveStart,
   objective: { survive: rounds } | null, conveyor: { tpl, max } | null, reinforce: { after, tpl, done } | null,
   environment: { status, every, power } | null, lastBigHit: { name, amount } | null, nextUid
 }
 member = snapshot from createGroupMember (stats, ab, skills, consumables, statuses, defending, guarding, downed, ...)
 enemy  = built by the dungeon (see groupDungeons.js) plus runtime fields:
   uid, hp, statuses, cooldowns, phasesDone, threat { [memberId]: n }, defending, dead, hidden,
   immune ("melee" | "magic"), immuneCycle, shieldWhileAdds, linkGroup, pending (telegraphed ability),
   channel, rewind, collapse, corruptionReflect

 Intents (one per member per round): { type: "melee" | "magic" | "skill" | "defend" | "guard" | "item" | "pass",
   key (skill/consumable), target (enemy uid, or member id for support skills/items/guard) }
 Defend and Guard take effect at the start of the round; everything else resolves in speed order.

 Enemy ability extras (on top of the solo fields name, power, hits, status, self, heal, leech, ignoreDefense,
 cooldown, below, weight, text):
   aoe        hits every living player
   telegraph  announced a round early, then hits the whole party; Defending or being Guarded cuts it to 35%
   mechanic   "rewind" | "channel" | "soulLink" | "doom" | "mirror" | "steal" (see enemyAbility)
 Phase extras: summon [template ids], mechanic "shieldWhileAdds" | "split" | "collapse".
*/

export const GROUP_ROUND_MS = 60 * 1000;
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
const TELEGRAPH_BLOCKED = 0.35;
const ADD_SHIELD = 0.25;
const THREAT_FOCUS = 0.7;
const SUPPORT_THREAT = 0.5;
const GUARD_THREAT = 15;

const roll = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const lower = (id) => STATUSES[id].name.toLowerCase();
// Named enemies (proper: true) read without an article: "Nyx'thara strikes" rather than "The Nyx'thara strikes".
const the = (e) => (e.proper ? e.name : `the ${e.name}`);
const The = (e) => (e.proper ? e.name : `The ${e.name}`);
const red = (n) => `[red]${n}[/red]`;

export const memberSpeed = (m) => Math.round((m.stats.speed || 0) * (1 + (m.ab?.speedMult || 0)));
export const livingMembers = (c) => Object.values(c.players).filter((m) => !m.downed);
export const livingEnemies = (c) => c.enemies.filter((e) => !e.dead);
export const targetableEnemies = (c) => c.enemies.filter((e) => !e.dead && !e.hidden);
export const isStunned = (m) => (m.statuses || []).some((st) => STATUSES[st.id]?.kind === "skip");

// Combat-ready copy of a saved character, taken when the run starts. Health and power start full.
export function createGroupMember(id, player) {
  const stats = { ...player.stats, health: player.stats.maxHealth, power: player.stats.maxPower };
  const equipped = (player.equippedSkills || []).filter((key) => SKILLS[key] && (player.skills?.[key] || 0) > 0);
  const consumables = {};
  for (const [key, count] of Object.entries(player.consumables || {}))
    if ((CONSUMABLES[key]?.heal || CONSUMABLES[key]?.power) && count > 0) consumables[key] = count;
  return {
    id,
    name: player.name,
    cls: player.class || null,
    level: player.level || 1,
    stats,
    ab: getAbilityTotals(player),
    skills: Object.fromEntries(equipped.map((key) => [key, player.skills[key]])),
    equipped,
    potionBonus: getKeyItemEffect(player, "potionBonus"),
    consumables,
    spent: {},
    statuses: [],
    defending: false,
    guarding: null,
    downed: false,
    combo: 0,
    kinds: [],
    spellstrike: false,
    stunGrace: false,
    secondWindUsed: false,
    ward: 0,
    starKinds: [],
    starReady: false,
    unwrittenPathStrikes: 0,
    rootstrideReady: true,
    echoCount: 0,
    tideHits: 0,
    hunger: 0,
    damageDealt: 0,
    healingDone: 0,
  };
}

// Firebase drops empty arrays and objects; restore them before resolving or rendering.
export function normalizeCombat(c) {
  if (!c) return null;
  c.players = c.players || {};
  c.enemies = c.enemies || [];
  c.waves = c.waves || [];
  for (const m of Object.values(c.players)) {
    m.statuses = m.statuses || [];
    m.kinds = m.kinds || [];
    m.starKinds = m.starKinds || [];
    m.skills = m.skills || {};
    m.equipped = m.equipped || [];
    m.consumables = m.consumables || {};
    m.spent = m.spent || {};
    m.ab = { uniqueEffects: [], ...(m.ab || {}) };
    m.ab.uniqueEffects = m.ab.uniqueEffects || [];
  }
  for (const e of c.enemies) {
    e.statuses = e.statuses || [];
    e.cooldowns = e.cooldowns || {};
    e.phasesDone = e.phasesDone || [];
    e.threat = e.threat || {};
    e.abilities = e.abilities || [];
    e.phases = e.phases || [];
  }
  return c;
}

// Resets members for a fresh attempt at a stage (start of a stage, or respawning at a checkpoint).
export function refreshMembers(players, { revive = true, full = true } = {}) {
  for (const m of Object.values(players)) {
    if (m.downed && !revive) continue;
    if (full || m.downed) {
      m.stats.health = full ? m.stats.maxHealth : Math.max(1, Math.round(m.stats.maxHealth * 0.5));
      m.stats.power = full ? m.stats.maxPower : Math.max(m.stats.power || 0, Math.round(m.stats.maxPower * 0.5));
    }
    m.downed = false;
    m.statuses = full ? [] : (m.statuses || []).filter((st) => STATUSES[st.id]?.cleansable !== false);
    m.defending = false;
    m.guarding = null;
    m.stunGrace = false;
    m.secondWindUsed = false;
    m.combo = 0;
    m.kinds = [];
    m.spellstrike = false;
    m.starKinds = [];
    m.starReady = false;
    m.unwrittenPathStrikes = 0;
    m.rootstrideReady = true;
    m.echoCount = 0;
    m.tideHits = 0;
    m.hunger = 0;
    m.ward = m.ab?.uniqueEffects?.includes("marrowWard") ? Math.round(m.stats.maxHealth * 0.2) : 0;
  }
}

// Builds the combat for one fight. `spawn(tplId)` returns a fresh enemy (see groupDungeons.js).
export function createGroupCombat(players, fight, spawn) {
  const c = {
    round: 1,
    players,
    enemies: [],
    waves: (fight.waves || []).map((w) => [...w]),
    waveIndex: 0,
    waveStart: 1,
    objective: fight.survive ? { survive: fight.survive } : null,
    conveyor: fight.conveyor || null,
    reinforce: fight.reinforce ? { ...fight.reinforce, done: false } : null,
    environment: fight.environment || null,
    lastBigHit: null,
    roundBigHit: null,
    nextUid: 1,
  };
  const first = c.waves.length ? c.waves[0] : fight.enemies || [];
  for (const tpl of first) addEnemy(c, spawn(tpl));
  if (fight.startStatus)
    for (const m of livingMembers(c)) addStatus(m.statuses, fight.startStatus, {});
  return c;
}

export function addEnemy(c, enemy) {
  const e = {
    statuses: [],
    cooldowns: {},
    phasesDone: [],
    threat: {},
    defending: false,
    dead: false,
    stunGrace: false,
    ...enemy,
    uid: `e${c.nextUid}`,
    hp: enemy.hp ?? enemy.maxHp,
  };
  c.nextUid += 1;
  c.enemies.push(e);
  return e;
}

const findMember = (c, id) => (id && c.players[id] && !c.players[id].downed ? c.players[id] : null);
const findEnemy = (c, uid) => targetableEnemies(c).find((e) => e.uid === uid) || targetableEnemies(c)[0] || null;

// ---- Damage plumbing ----

function inflictOnEnemy(c, e, id, opts, log) {
  const def = STATUSES[id];
  if (def.kind === "skip") {
    if (e.channel) {
      log.push(`[gold]${The(e)}'s ${e.channel.name} is interrupted![/gold]`);
      e.channel = null;
    }
    if (Math.random() < (e.stunResist || 0)) {
      log.push(`${The(e)} resists being ${lower(id)}!`);
      return false;
    }
    if (e.stunGrace) {
      log.push(`${The(e)} shakes off the effect.`);
      return false;
    }
  }
  const power = (opts?.power ?? def.defaultPower) * (def.kind === "dot" ? e.dotResist ?? 1 : 1);
  addStatus(e.statuses, id, { ...opts, power });
  log.push(`${The(e)} is now ${lower(id)}.`);
  return true;
}

function inflictOnMember(m, id, opts, log) {
  if (STATUSES[id].kind === "skip" && m.stunGrace) {
    log.push(`${m.name} shakes off the stun.`);
    return false;
  }
  if (!addStatus(m.statuses, id, opts)) {
    log.push(`${m.name}'s ward repels ${lower(id)}.`);
    return false;
  }
  log.push(`${m.name} is now ${lower(id)}.`);
  return true;
}

function healMember(m, amount, log, source) {
  if (m.downed) return 0;
  const healed = Math.max(0, Math.min(Math.floor(amount * healMult(m.statuses)), m.stats.maxHealth - m.stats.health));
  if (healed <= 0) return 0;
  m.stats.health += healed;
  log.push(`${source ? `${source}: ` : ""}${m.name} recovers [green]${healed}[/green] health.`);
  return healed;
}

function healEnemy(e, amount, log) {
  const healed = Math.min(Math.floor(amount * healMult(e.statuses)), e.maxHp - e.hp);
  if (healed <= 0) return 0;
  e.hp += healed;
  log.push(`${The(e)} recovers ${healed} health.`);
  return healed;
}

function knockDown(c, m, log) {
  m.downed = true;
  m.stats.health = 0;
  m.statuses = [];
  m.defending = false;
  m.guarding = null;
  for (const e of c.enemies) delete e.threat[m.id];
  log.push(`[red]${m.name} falls![/red]`);
}

// Final damage to a member after mitigation: soul links share it, then Second Wind may save them.
function applyMemberDamage(c, m, amount, log, { shared = false } = {}) {
  if (m.downed || amount <= 0) return 0;
  const link = !shared && m.statuses.find((st) => st.id === "soulLink");
  const partner = link && findMember(c, link.link);
  if (partner && partner !== m) {
    const share = Math.floor(amount * (link.power || 0.5));
    if (share > 0) {
      amount -= share;
      log.push(`The Soul Link passes ${share} damage to ${partner.name}.`);
      applyMemberDamage(c, partner, share, log, { shared: true });
    }
  }
  m.stats.health = Math.max(0, m.stats.health - amount);
  const wind = m.ab.secondWind;
  if (wind && !m.secondWindUsed && m.stats.health > 0 && m.stats.health <= m.stats.maxHealth * 0.1) {
    m.secondWindUsed = true;
    m.stats.health = Math.min(m.stats.maxHealth, m.stats.health + Math.round(m.stats.maxHealth * wind));
    log.push(`[green]Second Wind![/green] ${m.name} recovers to ${m.stats.health} health.`);
  }
  if (m.stats.health <= 0) knockDown(c, m, log);
  return amount;
}

// Barriers, Marrow Ward and Tempered Steel soak a hit before it lands.
function soak(m, amount, log) {
  if (m.ward > 0 && amount > 0) {
    const absorbed = Math.min(m.ward, amount);
    m.ward -= absorbed;
    amount -= absorbed;
    log.push(`${m.name}'s Marrow Ward absorbs ${absorbed} damage.`);
  }
  if (amount > 0) {
    const { remaining, absorbed } = absorbDamage(m.statuses, amount);
    if (absorbed) log.push(`${m.name}'s barrier absorbs ${absorbed} damage.`);
    amount = remaining;
  }
  return amount;
}

function dieIfDone(c, e, log) {
  if (e.hp > 0 || e.dead) return;
  e.dead = true;
  e.hp = 0;
  e.diedRound = c.round;
  e.channel = null;
  e.pending = null;
  log.push(`[gold]${The(e)} is defeated![/gold]`);
}

function damageEnemy(c, e, amount, log, env, source) {
  const before = e.hp;
  e.hp = Math.max(0, e.hp - amount);
  const dealt = before - e.hp;
  if (source) {
    e.threat[source.id] = (e.threat[source.id] || 0) + dealt;
    source.damageDealt = (source.damageDealt || 0) + dealt;
  }
  if (e.rewind) e.rewind.dealt += dealt;
  if (e.channel) {
    e.channel.dealt += dealt;
    if (e.channel.dealt >= e.channel.need) {
      log.push(`[gold]The party breaks ${the(e)}'s ${e.channel.name}![/gold]`);
      e.channel = null;
    }
  }
  checkPhases(c, e, log, env);
  dieIfDone(c, e, log);
  return dealt;
}

function checkPhases(c, e, log, env) {
  if (e.hp <= 0) return;
  (e.phases || []).forEach((phase, index) => {
    if (e.phasesDone.includes(index) || e.hp / e.maxHp >= phase.below) return;
    e.phasesDone.push(index);
    if (phase.text) log.push(`[red]${phase.text}[/red]`);
    if (phase.self) addStatus(e.statuses, phase.self.id, phase.self);
    if (phase.heal) healEnemy(e, e.maxHp * phase.heal, log);
    for (const tpl of phase.summon || []) {
      const add = addEnemy(c, env.spawn(tpl));
      log.push(`A ${add.name} joins the fight!`);
    }
    if (phase.immune !== undefined) e.immune = phase.immune;
    if (phase.mechanic === "shieldWhileAdds") e.shieldWhileAdds = true;
    if (phase.mechanic === "collapse") e.collapse = 1;
    if (phase.mechanic === "split") splitEnemy(c, e, phase, log, env);
  });
}

function splitEnemy(c, e, phase, log, env) {
  e.hidden = true;
  e.channel = null;
  e.rewind = null;
  e.pending = null;
  const count = phase.count || 3;
  const hp = Math.max(1, Math.round((e.hp * (phase.shardHp || 0.45))));
  for (let i = 0; i < count; i += 1) {
    const shard = addEnemy(c, { ...env.spawn(phase.into), maxHp: hp, hp });
    shard.linkGroup = e.uid;
    shard.name = `${shard.name} ${String.fromCharCode(65 + i)}`;
  }
  log.push(`[red]${The(e)} splits into ${count} shards! They must all fall within two rounds of each other.[/red]`);
}

// ---- Player actions ----

// Star-Eater's Hunger: each meal heals and stacks damage for the rest of the fight.
function feedHunger(actor, log, what) {
  if (!actor.ab.uniqueEffects.includes("starEaterHunger")) return;
  actor.hunger = Math.min(STAR_EATER.maxStacks, (actor.hunger || 0) + 1);
  log.push(`${actor.name}'s Star-Eater's Hunger ${what} (+${Math.round(actor.hunger * STAR_EATER.bonus * 100)}% damage)!`);
  actor.healingDone = (actor.healingDone || 0) + healMember(actor, Math.round(actor.stats.maxHealth * STAR_EATER.heal), log, "Star-Eater's Hunger");
}

// Saltblood Tide: hits bleed; every 4th hit draws the whole bleed out at once and heals the most wounded ally.
function saltbloodTide(c, actor, enemy, log, env) {
  inflictOnEnemy(c, enemy, "bleed", SALTBLOOD_TIDE.bleed, log);
  actor.tideHits = (actor.tideHits || 0) + 1;
  const bleed = enemy.statuses.find((st) => st.id === "bleed");
  if (actor.tideHits < SALTBLOOD_TIDE.every || !bleed) return;
  actor.tideHits = 0;
  const burst = bleedRemaining(bleed, enemy.maxHp);
  enemy.statuses = enemy.statuses.filter((st) => st !== bleed);
  log.push(`[gold]${actor.name}'s Saltblood Tide breaks, drawing out the bleed for ${red(burst)} damage![/gold]`);
  damageEnemy(c, enemy, burst, log, env, actor);
  const wounded = livingMembers(c).reduce((low, m) =>
    m.stats.health / m.stats.maxHealth < low.stats.health / low.stats.maxHealth ? m : low, actor);
  const heal = Math.min(Math.round(burst * SALTBLOOD_TIDE.healShare), Math.round(wounded.stats.maxHealth * SALTBLOOD_TIDE.healCap));
  actor.healingDone = (actor.healingDone || 0) + healMember(wounded, heal, log, "Saltblood Tide");
}

function supportAction(c, actor, key, level, intent, log, echo = false) {
  const skill = SKILLS[key];
  let targets;
  if (skill.target === "party") targets = livingMembers(c);
  else if (skill.target === "ally") targets = [findMember(c, intent.target) || actor];
  else targets = [actor];
  log.push(`${actor.name} uses ${skill.name}${skill.target === "ally" && targets[0] !== actor ? ` on ${targets[0].name}` : ""}.`);
  const result = applySupportSkill(key, level, actor, targets);
  log.push(...result.lines);
  if (echo) {
    const echoed = applySupportSkill(key, level, actor, targets, { echo: TEMPORAL_ECHO.power });
    log.push(echoed.lines.length ? `Chronal Loop: ${skill.name} echoes through time!` : "Chronal Loop: the echo finds nothing to repeat.", ...echoed.lines);
    result.healed += echoed.healed;
    result.threat += echoed.threat;
  }
  actor.healingDone = (actor.healingDone || 0) + result.healed;
  const threat = Math.round(result.threat * SUPPORT_THREAT);
  for (const e of livingEnemies(c)) e.threat[actor.id] = (e.threat[actor.id] || 0) + threat;
}

function applyItem(c, actor, intent, log) {
  const item = CONSUMABLES[intent.key];
  const target = findMember(c, intent.target) || actor;
  const left = (actor.consumables[intent.key] || 0) - (actor.spent[intent.key] || 0);
  if (!item || !(item.heal || item.power) || left < 1) {
    log.push(`${actor.name} fumbles for an item they don't have.`);
    return;
  }
  const s = target.stats;
  const healed = Math.min(
    Math.floor((item.heal || 0) * (1 + (actor.potionBonus || 0)) * healMult(target.statuses) * s.maxHealth),
    s.maxHealth - s.health,
  );
  const power = Math.min(Math.floor((item.power || 0) * s.maxPower), s.maxPower - s.power);
  s.health += Math.max(0, healed);
  s.power += Math.max(0, power);
  actor.spent[intent.key] = (actor.spent[intent.key] || 0) + 1;
  const gains = [healed > 0 && `[green]${healed}[/green] health`, power > 0 && `[blue]${power}[/blue] power`].filter(Boolean);
  log.push(`${actor.name} uses a ${item.name}${target === actor ? "" : ` on ${target.name}`}${gains.length ? `: ${target === actor ? "they" : target.name} recover${target === actor ? "" : "s"} ${gains.join(" and ")}.` : ", but it has no effect."}`);
  const threat = Math.round(Math.max(0, healed) * SUPPORT_THREAT);
  for (const e of livingEnemies(c)) e.threat[actor.id] = (e.threat[actor.id] || 0) + threat;
}

function attackAction(c, actor, intent, log, env) {
  const skillKey = intent.type === "skill" ? intent.key : null;
  const skill = skillKey ? SKILLS[skillKey] : null;
  const level = skill ? actor.skills[skillKey] || 0 : 0;
  const s = actor.stats;
  const ab = actor.ab;
  const cls = actor.cls;
  if (skill) {
    const cost = cls === "Spellcaster" && skill.type === "magic" ? Math.max(1, skill.powerCost - 1) : skill.powerCost;
    if (level < 1 || !actor.equipped.includes(skillKey) || s.power < cost) {
      log.push(`${actor.name} can't use ${skill.name} and hesitates.`);
      return;
    }
    s.power -= cost;
  }
  const echo = advanceEcho(actor, ab);
  if (skill?.type === "support") {
    supportAction(c, actor, skillKey, level, intent, log, echo);
    actor.combo += 1;
    return;
  }
  const type = skill ? skill.type : intent.type;
  const enemy = findEnemy(c, intent.target);
  if (!enemy) return;
  if (enemy.immune === type) {
    log.push(`${actor.name}'s ${type} attack glances off ${the(enemy)}'s ward. It is immune to ${type} damage!`);
    actor.combo += 1;
    return;
  }
  const speedAdvantage = memberSpeed(actor) - enemy.speed;
  let hit = type === "melee" ? roll(s.attackMin, s.attackMax) : roll(s.magicAttackMin || 0, s.magicAttackMax || 0);
  if (skill) hit = Math.round(hit * skillMultiplier(skillKey, level));
  const ctx = {
    level,
    stats: s,
    enemy,
    speedAdvantage,
    dealt: 0,
    crit: false,
    applyStatus: (id, opts) => {
      if (!enemy.dead) inflictOnEnemy(c, enemy, id, opts, log);
    },
    heal: (amount) => {
      actor.healingDone = (actor.healingDone || 0) + healMember(actor, amount, log, skill?.name);
    },
    log: (text) => log.push(text),
  };
  const kinds = new Set(actor.kinds);
  const starKinds = new Set(actor.starKinds);
  const constellation = ab.uniqueEffects.includes("starCharted") && actor.starReady;
  if (constellation) {
    actor.starReady = false;
    starKinds.clear();
  }
  const unwritten = ab.uniqueEffects.includes("unwrittenPath") && actor.unwrittenPathStrikes === 2;
  const rhythm = cls === "Tactician" ? Math.min(RHYTHM_MAX, actor.combo * RHYTHM_CRIT) : 0;
  const critChance = Math.min(MAX_PLAYER_CHANCE, (s.criticalHitChance || 0) + (skill?.critBonus?.(ctx) || 0) + rhythm);
  if (Math.random() < critChance) {
    hit *= s.criticalDamageBonus || 1.5;
    ctx.crit = true;
  }
  if (ctx.crit && ab.uniqueEffects.includes("fortunesSpark") && Math.random() < FORTUNES_SPARK_CHANCE)
    hit *= 1 + roll(100, 300) / 100;
  let bonus = 1 + (ab.damageBonus || 0) + (skill?.bonus?.(ctx) || 0);
  if (cls === "Specialist") {
    kinds.add(skill ? skillKey : type);
    bonus += Math.min(ADAPTABLE_MAX, kinds.size * ADAPTABLE_PER_KIND);
  }
  if (cls === "Spellblade" && !skill && actor.spellstrike) {
    bonus += SPELLSTRIKE_BONUS;
    actor.spellstrike = false;
  }
  const glacial = ab.uniqueEffects.includes("glacialEdge") && hasStatus(enemy.statuses, "vulnerable");
  if (constellation) bonus += 1.5;
  if (glacial) bonus += 0.35;
  if (unwritten) bonus += 1;
  if (ab.uniqueEffects.includes("starEaterHunger")) bonus += Math.min(STAR_EATER.maxStacks, actor.hunger || 0) * STAR_EATER.bonus;
  hit *= bonus * outgoingMult(actor.statuses) * incomingMult(enemy.statuses);
  const ignore = Math.min(1, (skill?.ignoreDefense?.(level) || 0) + (ab.pierce || 0) + (unwritten ? 1 : 0));
  let dealt = Math.max(1, Math.round(hit - enemy.defense * (1 - ignore)));
  if (enemy.defending) dealt = Math.max(1, Math.floor(dealt * 0.5));
  if (enemy.shieldWhileAdds && livingEnemies(c).some((other) => other !== enemy && !other.linkGroup)) {
    dealt = Math.max(1, Math.round(dealt * ADD_SHIELD));
    log.push(`${The(enemy)}'s crew shields their captain!`);
  }
  ctx.dealt = dealt;
  if (ab.uniqueEffects.includes("unwrittenPath")) actor.unwrittenPathStrikes = unwritten ? 0 : actor.unwrittenPathStrikes + 1;
  log.push(`${ctx.crit ? "Critical! " : ""}${actor.name} ${skill ? `uses ${skill.name} on` : "strikes"} ${the(enemy)} for ${red(dealt)} damage${enemy.defending ? " (defended)" : ""}.`);
  damageEnemy(c, enemy, dealt, log, env, actor);
  if (!c.roundBigHit || dealt > c.roundBigHit.amount) c.roundBigHit = { name: actor.name, amount: dealt };

  if (glacial) enemy.statuses = enemy.statuses.filter((st) => st.id !== "vulnerable");
  if (constellation && !enemy.dead) inflictOnEnemy(c, enemy, "stun", {}, log);
  if (ab.uniqueEffects.includes("rootstride") && actor.rootstrideReady) {
    actor.rootstrideReady = false;
    if (!enemy.dead && c.round === 1) inflictOnEnemy(c, enemy, "stun", {}, log);
  }
  if (ab.uniqueEffects.includes("undyingHunger") && enemy.statuses.some((st) => ["burn", "poison", "bleed"].includes(st.id)))
    healMember(actor, Math.round(s.maxHealth * 0.08), log, "Undying Hunger");
  const burn = ab.uniqueEffects.includes("moltenGrip") && !enemy.dead && enemy.statuses.find((st) => st.id === "burn");
  if (burn) {
    const burst = Math.max(1, Math.round(enemy.maxHp * burn.power * burn.stacks)) * 2;
    enemy.statuses = enemy.statuses.filter((st) => st.id !== "burn");
    log.push(`Molten Grip detonates the burn for ${red(burst)} damage.`);
    damageEnemy(c, enemy, burst, log, env, actor);
  }
  if (ab.lifesteal) healMember(actor, Math.max(1, Math.round(dealt * ab.lifesteal)), log, "Vampiric");
  if (ab.surge && ctx.crit && s.power < s.maxPower)
    s.power = Math.min(s.maxPower, s.power + Math.round((s.maxPower * ab.surge) / 2));
  if (ctx.crit && ab.uniqueEffects.includes("orbitalFocus") && !enemy.dead) {
    const shard = Math.max(1, Math.round(dealt * 0.35));
    log.push(`Orbital Focus launches a shard for ${red(shard)} damage.`);
    damageEnemy(c, enemy, shard, log, env, actor);
  }
  if (echo) {
    // The echo carries on to another foe if the first one has already fallen.
    const echoTarget = !enemy.dead ? enemy : targetableEnemies(c).find((e) => e.immune !== type);
    if (echoTarget) {
      const echoed = Math.max(1, Math.round(dealt * TEMPORAL_ECHO.power));
      log.push(`Chronal Loop: ${actor.name}'s ${skill ? skill.name : "strike"} echoes into ${the(echoTarget)} for ${red(echoed)} damage.`);
      damageEnemy(c, echoTarget, echoed, log, env, actor);
      if (echoTarget !== enemy && echoTarget.dead) feedHunger(actor, log, "devours the fallen");
    }
  }
  if (ab.uniqueEffects.includes("starEaterHunger")) {
    const meal = !enemy.dead && enemy.statuses.find((st) => STAR_EATER.buffs.includes(st.id));
    if (meal) {
      enemy.statuses = enemy.statuses.filter((st) => st !== meal);
      feedHunger(actor, log, `devours ${the(enemy)}'s ${STATUSES[meal.id].name} effect`);
    } else if (enemy.dead) feedHunger(actor, log, "devours the fallen");
  }
  skill?.onHit?.(ctx);
  if (!enemy.dead) {
    if (ab.ignite && Math.random() < ab.ignite) inflictOnEnemy(c, enemy, "burn", { turns: 3, power: 0.04 }, log);
    if (ab.weakened && Math.random() < ab.weakened) inflictOnEnemy(c, enemy, "weaken", {}, log);
    if (ab.poison && Math.random() < ab.poison) inflictOnEnemy(c, enemy, "poison", {}, log);
    if (ab.uniqueEffects.includes("bloomOfDecay")) {
      const stacks = Math.min(5, (enemy.statuses.find((st) => st.id === "poison")?.stacks || 0) + 1);
      inflictOnEnemy(c, enemy, "poison", {}, log);
      const poison = enemy.statuses.find((st) => st.id === "poison");
      if (poison) poison.stacks = stacks;
    }
    if (cls === "Trickster" && Math.random() < HEX_CHANCE)
      inflictOnEnemy(c, enemy, Math.random() < 0.5 ? "weaken" : "vulnerable", { turns: 2 }, log);
    if (ab.uniqueEffects.includes("saltbloodTide")) saltbloodTide(c, actor, enemy, log, env);
  }
  if (enemy.corruptionReflect) {
    const stacks = livingMembers(c).reduce((sum, m) => sum + (m.statuses.find((st) => st.id === "corruption")?.stacks || 0), 0);
    const fraction = Math.min(0.4, stacks * 0.04);
    if (fraction > 0) {
      const back = Math.max(1, Math.round(dealt * fraction));
      log.push(`${The(enemy)}'s void mirror reflects ${red(back)} damage at ${actor.name}!`);
      applyMemberDamage(c, actor, back, log);
    }
  }
  if (ab.uniqueEffects.includes("starCharted")) {
    starKinds.add(skill ? "skill" : type);
    if (starKinds.size >= 3) actor.starReady = true;
  }
  actor.kinds = [...kinds];
  actor.starKinds = [...starKinds];
  actor.combo += 1;
  if (cls === "Spellblade" && skill) actor.spellstrike = true;
}

function memberAct(c, actor, intent, log, env) {
  if (actor.downed) return;
  const stun = actor.statuses.findIndex((st) => STATUSES[st.id].kind === "skip");
  if (stun >= 0) {
    actor.statuses.splice(stun, 1);
    actor.stunGrace = true;
    log.push(`${actor.name} is stunned and loses the turn!`);
    return;
  }
  actor.stunGrace = false;
  switch (intent?.type) {
    case "melee":
    case "magic":
    case "skill":
      attackAction(c, actor, intent, log, env);
      break;
    case "item":
      applyItem(c, actor, intent, log);
      break;
    case "defend":
    case "guard":
      break;
    default:
      log.push(`${actor.name} waits.`);
  }
}

// Defend and Guard are stances: they protect for the whole round, so they're applied before anyone acts.
function applyStances(c, intents, log) {
  for (const m of livingMembers(c)) {
    const intent = intents[m.id];
    if (isStunned(m)) continue;
    if (intent?.type === "defend") {
      m.defending = true;
      log.push(`${m.name} braces to defend.`);
    } else if (intent?.type === "guard") {
      const ally = findMember(c, intent.target);
      if (!ally || ally === m) {
        m.defending = true;
        log.push(`${m.name} braces to defend.`);
      } else {
        m.guarding = ally.id;
        log.push(`${m.name} stands guard over ${ally.name}.`);
        for (const e of livingEnemies(c)) e.threat[m.id] = (e.threat[m.id] || 0) + GUARD_THREAT;
      }
    }
  }
}

// ---- Enemy actions ----

function chooseTarget(c, e) {
  const living = livingMembers(c);
  if (!living.length) return null;
  const taunting = living.filter((m) => hasStatus(m.statuses, "taunt"));
  if (taunting.length) return pick(taunting);
  if (Math.random() < THREAT_FOCUS) {
    const best = living.reduce((top, m) => ((e.threat[m.id] || 0) > (e.threat[top.id] || 0) ? m : top), living[0]);
    if ((e.threat[best.id] || 0) > 0) return best;
  }
  return pick(living);
}

const guardianOf = (c, target) =>
  livingMembers(c).find((m) => m.guarding === target.id && m !== target && !isStunned(m)) || null;

// One enemy hit on a member (Guard redirects it). Returns the damage dealt.
function enemyStrike(c, e, target, ability, log, { scale = 1, telegraphed = false } = {}) {
  if (!target || target.downed) return 0;
  const guardian = guardianOf(c, target);
  const victim = guardian || target;
  if (guardian) log.push(`${guardian.name} steps in front of ${target.name}!`);
  const s = victim.stats;
  const used = ability ? `'s ${ability.name}` : "'s attack";
  if (!telegraphed && Math.random() < Math.min(MAX_PLAYER_CHANCE, s.evasion || 0)) {
    log.push(`${victim.name} evades ${the(e)}${used}!`);
    return 0;
  }
  if (!telegraphed && victim.cls === "Duelist" && Math.random() < PARRY_CHANCE) {
    const riposte = Math.max(1, Math.round(roll(s.attackMin, s.attackMax) * PARRY_COUNTER - e.defense));
    log.push(`${victim.name} parries ${the(e)}${used} and ripostes for ${red(riposte)}!`);
    damageEnemy(c, e, riposte, log, c.env, victim);
    return 0;
  }
  let dmg = roll(e.attack[0], e.attack[1]) * (ability?.power ?? 1) * scale;
  const crit = Math.random() < (e.critical || 0);
  if (crit) dmg *= 2;
  dmg *= outgoingMult(e.statuses);
  dmg = Math.max(1, Math.round(dmg - (s.defense || 0) * (1 - (ability?.ignoreDefense || 0))));
  const blocked = victim.defending || !!guardian;
  if (blocked) dmg = Math.max(1, Math.floor(dmg * (victim.cls === "Swordsman" ? BULWARK_DAMAGE_TAKEN : 0.5)));
  if (blocked && telegraphed) dmg = Math.max(1, Math.floor(dmg * TELEGRAPH_BLOCKED));
  dmg *= incomingMult(victim.statuses);
  dmg *= 1 - Math.min(DAMAGE_REDUCTION_CAP, victim.ab.damageReduction || 0);
  dmg = Math.max(1, Math.round(dmg));
  dmg = soak(victim, dmg, log);
  if (victim.ab.uniqueEffects.includes("temperedSteel")) {
    victim.temperedStrikes = (victim.temperedStrikes || 0) + 1;
    if (victim.temperedStrikes >= 2) {
      victim.temperedStrikes = 0;
      dmg = 0;
      const counter = Math.max(1, Math.round(s.attackMax * 0.6 - e.defense));
      log.push(`${victim.name}'s Tempered Steel turns the strike aside and counters for ${red(counter)}!`);
      damageEnemy(c, e, counter, log, c.env, victim);
    }
  }
  victim.combo = 0;
  log.push(`${crit ? "Critical! " : ""}${The(e)}${used} hits ${victim.name} for ${red(dmg)} damage${blocked ? " (blocked)" : ""}.`);
  applyMemberDamage(c, victim, dmg, log);
  if (!victim.downed && !e.dead) {
    if (victim.ab.uniqueEffects.includes("frozenResolve") && Math.random() < 0.1) inflictOnEnemy(c, e, "stun", {}, log);
    if (victim.ab.reflect && dmg > 0) {
      const back = Math.max(1, Math.round(dmg * victim.ab.reflect));
      log.push(`${victim.name}'s thorns reflect ${red(back)} damage.`);
      damageEnemy(c, e, back, log, c.env, victim);
    }
    if (blocked && victim.cls === "Swordsman" && !e.dead) {
      const counter = Math.max(1, Math.round(roll(s.attackMin, s.attackMax) * BULWARK_COUNTER - e.defense));
      log.push(`${victim.name} counterattacks for ${red(counter)}!`);
      damageEnemy(c, e, counter, log, c.env, victim);
    }
    if (ability?.status && Math.random() < (ability.status.chance ?? 1))
      inflictOnMember(victim, ability.status.id, ability.status, log);
  }
  if (ability?.leech && dmg > 0 && !e.dead) healEnemy(e, dmg * ability.leech, log);
  return dmg;
}

function chooseEnemyAction(e) {
  const choices = [{ type: "attack", weight: 6 }];
  if (!e.wasDefending) choices.push({ type: "defend", weight: e.hp / e.maxHp < 0.4 ? 2 : 1 });
  for (const ability of e.abilities) {
    if ((e.cooldowns[ability.name] || 0) > 0) continue;
    if (ability.below && e.hp / e.maxHp >= ability.below) continue;
    if (ability.self && hasStatus(e.statuses, ability.self.id) && !ability.power) continue;
    if (ability.heal && e.hp >= e.maxHp) continue;
    choices.push({ type: "skill", ability, weight: ability.weight ?? 2.5 });
  }
  let r = Math.random() * choices.reduce((sum, choice) => sum + choice.weight, 0);
  for (const choice of choices) {
    r -= choice.weight;
    if (r < 0) return choice;
  }
  return choices[0];
}

function enemyAbility(c, e, ability, log) {
  if (ability.text) log.push(`[red]${ability.text}[/red]`);
  if (ability.self) {
    addStatus(e.statuses, ability.self.id, ability.self);
    log.push(`${The(e)} uses ${ability.name} and is now ${lower(ability.self.id)}.`);
  }
  if (ability.heal) healEnemy(e, e.maxHp * ability.heal, log);
  const living = livingMembers(c);
  switch (ability.mechanic) {
    case "rewind":
      e.rewind = { hp: e.hp, dealt: 0, rounds: 2, need: Math.round(e.maxHp * (ability.need || 0.1)) };
      log.push(`[red]${The(e)} begins to rewind time! Deal ${e.rewind.need} damage to it within 2 rounds or its wounds will close.[/red]`);
      return;
    case "channel":
      e.channel = { name: ability.name, rounds: ability.rounds || 2, dealt: 0, need: Math.round(e.maxHp * (ability.need || 0.06)), effect: ability.effect };
      log.push(`[red]${The(e)} begins channeling ${ability.name}! Stun it or deal ${e.channel.need} damage to interrupt.[/red]`);
      return;
    case "soulLink": {
      if (living.length < 2) break;
      const [a, b] = [...living].sort(() => Math.random() - 0.5);
      const ea = addStatus(a.statuses, "soulLink", {});
      const eb = addStatus(b.statuses, "soulLink", {});
      if (ea) ea.link = b.id;
      if (eb) eb.link = a.id;
      log.push(`[red]${The(e)} binds the souls of ${a.name} and ${b.name}! They now share damage.[/red]`);
      return;
    }
    case "doom": {
      const target = chooseTarget(c, e);
      if (target && inflictOnMember(target, "doom", { turns: ability.turns || 3, power: ability.doomPower || 0.6 }, log))
        log.push(`[red]${target.name} is marked for Doom! Guard them or Purify the mark before it detonates.[/red]`);
      return;
    }
    case "mirror": {
      const echo = c.lastBigHit;
      if (!echo) break;
      log.push(`[red]${The(e)} mirrors ${echo.name}'s strongest blow back at the party![/red]`);
      for (const m of living) {
        let dmg = Math.round(echo.amount * (ability.echo || 0.5));
        if (m.defending || guardianOf(c, m)) dmg = Math.floor(dmg * 0.5);
        dmg = soak(m, Math.max(1, dmg), log);
        log.push(`The echo hits ${m.name} for ${red(dmg)} damage.`);
        applyMemberDamage(c, m, dmg, log);
      }
      return;
    }
    case "steal": {
      const target = chooseTarget(c, e);
      if (!target) return;
      const buffs = target.statuses.filter((st) => !STATUSES[st.id].debuff && STATUSES[st.id].cleansable !== false && st.id !== "soulLink");
      if (buffs.length) {
        target.statuses = target.statuses.filter((st) => !buffs.includes(st));
        addStatus(e.statuses, "enrage", { turns: 3, power: 0.3 });
        log.push(`[red]${The(e)} steals ${buffs.map((st) => STATUSES[st.id].name).join(", ")} from ${target.name} and becomes enraged![/red]`);
      }
      if (ability.power) enemyStrike(c, e, target, ability, log);
      return;
    }
    default:
      break;
  }
  if (!ability.power) return;
  const targets = ability.aoe ? living : [chooseTarget(c, e)];
  for (const target of targets)
    for (let hit = 0; hit < (ability.hits || 1); hit += 1) {
      if (e.dead || !target || target.downed) break;
      enemyStrike(c, e, target, ability, log);
    }
}

function fireChannel(c, e, log) {
  const channel = e.channel;
  e.channel = null;
  log.push(`[red]${The(e)} completes ${channel.name}![/red]`);
  for (const m of livingMembers(c)) {
    if (channel.effect === "gravity") {
      const pulled = Math.max(0, m.stats.health - 1);
      if (pulled > 0) {
        m.stats.health = 1;
        log.push(`${m.name} is crushed down to 1 health.`);
      }
    }
  }
}

function enemyAct(c, e, log) {
  if (e.dead || e.hidden) return;
  for (const key of Object.keys(e.cooldowns)) e.cooldowns[key] = Math.max(0, e.cooldowns[key] - 1);
  e.wasDefending = e.defending;
  e.defending = false;
  const stun = e.statuses.findIndex((st) => STATUSES[st.id].kind === "skip");
  if (stun >= 0) {
    e.statuses.splice(stun, 1);
    e.stunGrace = true;
    log.push(`${The(e)} is stunned and loses its turn!`);
    return;
  }
  e.stunGrace = false;
  if (e.channel) {
    e.channel.rounds -= 1;
    if (e.channel.rounds <= 0) fireChannel(c, e, log);
    else log.push(`[red]${The(e)} keeps channeling ${e.channel.name}...[/red]`);
    return;
  }
  if (e.pending) {
    const ability = e.pending;
    e.pending = null;
    log.push(`[red]${The(e)} unleashes ${ability.name}![/red]`);
    for (const m of livingMembers(c))
      if (!e.dead) enemyStrike(c, e, m, ability, log, { telegraphed: true });
    return;
  }
  if (!livingMembers(c).length) return;
  const action = chooseEnemyAction(e);
  if (action.type === "defend") {
    e.defending = true;
    log.push(`${The(e)} defends.`);
    return;
  }
  if (action.type === "skill") {
    const ability = action.ability;
    if (ability.cooldown) e.cooldowns[ability.name] = ability.cooldown;
    if (ability.telegraph) {
      e.pending = ability;
      log.push(`[red]⚠ ${The(e)} prepares ${ability.name}! ${ability.warning || "Defend or guard your allies next round!"}[/red]`);
      return;
    }
    enemyAbility(c, e, ability, log);
    return;
  }
  enemyStrike(c, e, chooseTarget(c, e), null, log);
}

// ---- Round end ----

function tickMember(c, m, log) {
  const kept = [];
  for (const st of m.statuses) {
    const kind = STATUSES[st.id].kind;
    if (kind === "dot") {
      const amount = Math.max(1, Math.round(m.stats.maxHealth * st.power * st.stacks));
      log.push(`${m.name} takes ${red(amount)} ${lower(st.id)} damage.`);
      applyMemberDamage(c, m, amount, log);
    } else if (kind === "regen") healMember(m, Math.max(1, Math.round(m.stats.maxHealth * st.power)), log, "Regeneration");
    else if (kind === "doom" && st.turns <= 1) {
      const guardian = guardianOf(c, m);
      const amount = Math.round(m.stats.maxHealth * st.power);
      if (guardian) {
        const taken = Math.max(1, Math.round(amount * 0.4 * (1 - Math.min(DAMAGE_REDUCTION_CAP, guardian.ab.damageReduction || 0))));
        log.push(`[gold]${guardian.name} shields ${m.name} from Doom and takes ${red(taken)} damage![/gold]`);
        applyMemberDamage(c, guardian, soak(guardian, taken, log), log);
      } else {
        log.push(`[red]Doom detonates on ${m.name} for ${amount} damage, splashing the party![/red]`);
        applyMemberDamage(c, m, soak(m, amount, log), log);
        for (const ally of livingMembers(c))
          if (ally !== m) applyMemberDamage(c, ally, soak(ally, Math.round(ally.stats.maxHealth * 0.2), log), log);
      }
    }
    if (m.downed) return;
    if (kind === "skip") kept.push(st);
    else if (st.turns - 1 > 0) kept.push({ ...st, turns: st.turns - 1 });
  }
  m.statuses = kept;
}

function tickEnemy(c, e, log, env) {
  const kept = [];
  for (const st of e.statuses) {
    const kind = STATUSES[st.id].kind;
    if (kind === "dot") {
      const amount = Math.max(1, Math.round(e.maxHp * st.power * st.stacks));
      log.push(`${The(e)} takes ${red(amount)} ${lower(st.id)} damage.`);
      damageEnemy(c, e, amount, log, env);
    } else if (kind === "regen") healEnemy(e, Math.max(1, Math.round(e.maxHp * st.power)), log);
    if (e.dead) return;
    if (kind === "skip") kept.push(st);
    else if (st.turns - 1 > 0) kept.push({ ...st, turns: st.turns - 1 });
  }
  e.statuses = kept;
}

function resolveSplits(c, log) {
  for (const parent of c.enemies.filter((e) => e.hidden && !e.dead)) {
    const shards = c.enemies.filter((e) => e.linkGroup === parent.uid);
    if (!shards.length) continue;
    if (shards.every((e) => e.dead)) {
      parent.dead = true;
      parent.hp = 0;
      log.push(`[gold]Every shard shatters at once. ${The(parent)} is undone![/gold]`);
      continue;
    }
    for (const shard of shards.filter((e) => e.dead)) {
      // A fallen shard waits one more round for its siblings before it reforms.
      if (shard.downRound == null) {
        shard.downRound = c.round;
        continue;
      }
      if (c.round - shard.downRound < 1) continue;
      shard.dead = false;
      shard.downRound = null;
      shard.hp = Math.max(1, Math.round(shard.maxHp * 0.5));
      shard.statuses = [];
      log.push(`[red]${The(shard)} reforms! Every shard must fall within two rounds of each other.[/red]`);
    }
  }
}

function endOfRound(c, log, env) {
  for (const e of livingEnemies(c)) if (!e.hidden) tickEnemy(c, e, log, env);
  for (const m of livingMembers(c)) tickMember(c, m, log);
  const environment = c.environment;
  if (environment && c.round % (environment.every || 1) === 0)
    for (const m of livingMembers(c)) {
      const entry = addStatus(m.statuses, environment.status, { power: environment.power, turns: environment.turns });
      if (entry) log.push(`${environment.text || `${m.name} suffers ${lower(environment.status)}.`}`.replace("{name}", m.name));
    }
  for (const e of livingEnemies(c)) {
    if (e.collapse) {
      const fraction = Math.min(0.5, 0.04 * e.collapse);
      log.push(`[red]Reality collapses around the party (${Math.round(fraction * 100)}% of max health)![/red]`);
      for (const m of livingMembers(c)) applyMemberDamage(c, m, soak(m, Math.round(m.stats.maxHealth * fraction), log), log);
      e.collapse += 1;
    }
    if (e.rewind) {
      e.rewind.rounds -= 1;
      if (e.rewind.dealt >= e.rewind.need) {
        log.push(`[gold]The party overwhelms the rewind! ${The(e)} staggers.[/gold]`);
        addStatus(e.statuses, "stun", {});
        addStatus(e.statuses, "vulnerable", { turns: 2, power: 0.25 });
        e.rewind = null;
      } else if (e.rewind.rounds <= 0) {
        const restored = Math.max(0, Math.min(e.maxHp, e.rewind.hp + Math.round(e.maxHp * 0.08)) - e.hp);
        e.hp += restored;
        log.push(`[red]Time folds back. ${The(e)} rewinds ${restored} health![/red]`);
        e.rewind = null;
      }
    }
    if (e.immuneCycle && c.round % e.immuneCycle === 0 && e.immune) {
      e.immune = e.immune === "melee" ? "magic" : "melee";
      log.push(`${The(e)}'s ward shifts. It is now immune to ${e.immune} damage.`);
    }
  }
  resolveSplits(c, log);
  for (const m of livingMembers(c)) {
    if (m.cls === "Spellcaster" && m.stats.power < m.stats.maxPower) m.stats.power += 1;
    m.defending = false;
    m.guarding = null;
  }
  c.lastBigHit = c.roundBigHit;
  c.roundBigHit = null;
}

function advanceEncounter(c, log, env) {
  if (!livingMembers(c).length) return "wipe";
  if (c.objective?.survive && c.round >= c.objective.survive) {
    log.push(`[gold]The party holds out for ${c.objective.survive} rounds![/gold]`);
    return "victory";
  }
  if (!livingEnemies(c).length) {
    if (c.waveIndex + 1 < c.waves.length) {
      c.waveIndex += 1;
      c.waveStart = c.round + 1;
      if (c.reinforce) c.reinforce.done = false;
      log.push(`[red]Wave ${c.waveIndex + 1} of ${c.waves.length} charges in![/red]`);
      for (const tpl of c.waves[c.waveIndex]) addEnemy(c, env.spawn(tpl));
      return null;
    }
    if (!c.objective?.survive) return "victory";
  }
  if (c.reinforce && !c.reinforce.done && c.round - c.waveStart + 1 >= c.reinforce.after) {
    c.reinforce.done = true;
    const add = addEnemy(c, env.spawn(c.reinforce.tpl));
    log.push(`[red]The fight drags on. A ${add.name} joins the fray![/red]`);
  }
  if (c.conveyor && livingEnemies(c).length < c.conveyor.max) {
    const pool = [].concat(c.conveyor.tpl);
    c.conveyor.next = (c.conveyor.next || 0) + 1;
    const add = addEnemy(c, env.spawn(pool[(c.conveyor.next - 1) % pool.length]));
    log.push(`The conveyor delivers a ${add.name}.`);
  }
  return null;
}

/*
 Resolves one round. `intents` maps member id -> intent (missing = Pass). env = { spawn(tplId) }.
 Mutates and returns { combat, log, outcome } where outcome is "victory", "wipe" or null.
*/
export function resolveGroupRound(combat, intents, env) {
  const c = normalizeCombat(combat);
  const log = [`— Round ${c.round} —`];
  Object.defineProperty(c, "env", { value: env, enumerable: false, configurable: true });
  applyStances(c, intents || {}, log);
  const actors = [
    ...livingMembers(c).map((m) => ({ kind: "member", ref: m, speed: memberSpeed(m), order: 0 })),
    ...livingEnemies(c).map((e) => ({ kind: "enemy", ref: e, speed: e.speed, order: 1 })),
  ].sort((a, b) => b.speed - a.speed || a.order - b.order);
  for (const actor of actors) {
    if (!livingMembers(c).length) break;
    if (!c.objective?.survive && !livingEnemies(c).length) break;
    if (actor.kind === "member") memberAct(c, actor.ref, intents?.[actor.ref.id], log, env);
    else enemyAct(c, actor.ref, log);
  }
  if (livingMembers(c).length) endOfRound(c, log, env);
  const outcome = advanceEncounter(c, log, env);
  c.round += 1;
  delete c.env;
  return { combat: c, log, outcome };
}

// Purify-style helper for puzzles/hazards that cleanse the party.
export const cleanseParty = (c) => livingMembers(c).forEach((m) => cleanseDebuffs(m.statuses));
