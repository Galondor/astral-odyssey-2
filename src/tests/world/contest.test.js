import { getPlayer, setPlayer } from "../../character/player";
import { getEnemy, startCombat } from "../../combat/combat";
import { CONTEST_QUEUE_TTL_MS, CONTEST_TURN_MS, reconcileContestProgress, reduceContest } from "../../world/contest";
import { MATERIALS } from "../../items/materials";

jest.mock("../../firebase", () => ({ db: {}, auth: { currentUser: { uid: "account-a" } } }));
jest.mock("../../character/player", () => ({
  getPlayer: jest.fn(), setPlayer: jest.fn(), getCharacterIdentity: jest.fn(),
  commitPlayerChange: jest.fn(), flushPlayer: jest.fn(),
}));

const player = (name, speed = 10) => ({
  name, level: 10, class: "Specialist", equipment: {},
  skills: { fireball: 1 }, equippedSkills: ["fireball"],
  consumables: { healthPotion: 2 },
  stats: {
    health: 20, maxHealth: 100, stamina: 2, maxStamina: 10,
    power: 1, maxPower: 20, speed, attackMin: 20, attackMax: 20,
    magicAttackMin: 10, magicAttackMax: 10, defense: 0,
    criticalHitChance: 0, criticalDamageBonus: 2, evasion: 0,
  },
});
const queue = (state, uid, speed, time = 1000, accountId = uid) =>
  reduceContest(state, uid, accountId, {
    type: "queue", player: player(uid, speed),
    livePlayers: { alice: true, bob: true, alt: true },
  }, time);
const paired = (firstSpeed = 10, secondSpeed = 20) =>
  queue(queue(null, "alice", firstSpeed), "bob", secondSpeed);
const command = (state, uid, type, action, time = 2000) => {
  const matchId = state.entries[uid].matchId;
  return reduceContest(state, uid, uid, {
    type, action, matchId, revision: state.matches[matchId].revision,
  }, time);
};
const matchOf = (state) => state.matches[state.entries.alice.matchId];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Math, "random").mockReturnValue(0.99);
});
afterEach(() => jest.restoreAllMocks());

test("queue waits for a live opponent, starts full, and higher speed goes first", () => {
  const one = queue(null, "alice", 10);
  expect(one.entries.alice.status).toBe("waiting");
  expect(one.entries.alice.fighter.player.stats.health).toBe(100);
  expect(one.entries.alice.fighter.player.stats.power).toBe(20);
  const state = queue(one, "bob", 20);
  expect(state.entries.alice.status).toBe("playing");
  expect(state.entries.bob.matchId).toBe(state.entries.alice.matchId);
  expect(matchOf(state).turn).toBe("bob");
  expect(getPlayer).not.toHaveBeenCalled();
  expect(setPlayer).not.toHaveBeenCalled();
});

test("speed ties favor the first queued player; alternate turns without AI attacks", () => {
  let state = paired(10, 10);
  expect(matchOf(state).turn).toBe("alice");
  state = command(state, "alice", "action", { type: "melee" });
  let match = matchOf(state);
  expect(match.turn).toBe("bob");
  expect(match.fighters.alice.player.stats.health).toBe(100);
  expect(match.fighters.bob.player.stats.health).toBeLessThan(100);
  expect(() => command(state, "alice", "action", { type: "melee" })).toThrow("Wait");
  state = command(state, "bob", "action", { type: "magic" });
  match = matchOf(state);
  expect(match.turn).toBe("alice");
  expect(match.fighters.alice.player.stats.health).toBeLessThan(100);
});

test("stale and duplicate requests cannot take a second turn", () => {
  const state = paired();
  const id = state.entries.bob.matchId;
  const next = command(state, "bob", "action", { type: "pass" });
  expect(() => reduceContest(next, "bob", "bob", {
    type: "action", action: { type: "pass" }, matchId: id, revision: 0,
  }, 2000)).toThrow("changed");
});

test("self, same-account, and expired tickets never match", () => {
  const one = queue(null, "alice", 10);
  expect(() => queue(one, "alice", 10)).toThrow("already queued");
  const sameAccount = queue(one, "alt", 10, 1000, "alice");
  expect(sameAccount.entries.alt.status).toBe("waiting");
  const expired = queue(one, "bob", 20, 1000 + CONTEST_QUEUE_TTL_MS);
  expect(expired.entries.bob.status).toBe("waiting");
});

test("disconnected players are never selected even if their queue ticket has not expired", () => {
  const one = queue(null, "alice", 10);
  const state = reduceContest(one, "bob", "bob", {
    type: "queue", player: player("bob"), livePlayers: { bob: true, alice: false },
  }, 2000);
  expect(state.entries.bob.status).toBe("waiting");
});

test("queue cancellation is free and does not create rewards", () => {
  const state = reduceContest(queue(null, "alice", 10), "alice", "alice", { type: "cancel" }, 2000);
  expect(state.entries.alice.status).toBe("idle");
  expect(reconcileContestProgress(player("alice"), state.entries.alice)).toBeNull();
});

test("skills cost power, inflict statuses, and reject unequipped skills", () => {
  let state = paired();
  expect(() => command(state, "bob", "action", { type: "skill", key: "cleave" })).toThrow("available");
  state = command(state, "bob", "action", { type: "skill", key: "fireball" });
  const match = matchOf(state);
  expect(match.fighters.bob.player.stats.power).toBe(15);
  expect(match.fighters.alice.statuses.some((status) => status.id === "burn")).toBe(true);
});

test("stunning skills produce Firebase-safe state and make the opponent lose one turn", () => {
  let state = paired();
  const fighter = matchOf(state).fighters.bob;
  fighter.player.skills = { frostLance: 1 };
  fighter.player.equippedSkills = ["frostLance"];
  jest.spyOn(Math, "random").mockReturnValue(0);
  state = command(state, "bob", "action", { type: "skill", key: "frostLance" });
  let match = matchOf(state);
  expect(match.fighters.alice.statuses).toContainEqual(expect.objectContaining({ id: "stun", power: 0 }));
  const verifyFirebaseValue = (value) => {
    expect(value).not.toBeUndefined();
    if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
    if (value && typeof value === "object") Object.values(value).forEach(verifyFirebaseValue);
  };
  verifyFirebaseValue(state);
  const health = match.fighters.bob.player.stats.health;
  state = command(state, "alice", "action", { type: "pass" });
  match = matchOf(state);
  expect(match.turn).toBe("bob");
  expect(match.fighters.bob.player.stats.health).toBe(health);
  expect(match.fighters.alice.statuses.some((status) => status.id === "stun")).toBe(false);
});

test("defend persists until the defender next acts", () => {
  let state = paired(10, 10);
  state = command(state, "alice", "action", { type: "defend" });
  expect(matchOf(state).fighters.alice.defending).toBe(true);
  state = command(state, "bob", "action", { type: "melee" });
  expect(matchOf(state).fighters.alice.player.stats.health).toBe(90);
  state = command(state, "alice", "action", { type: "pass" });
  expect(matchOf(state).fighters.alice.defending).toBe(false);
});

test("victory grants one kill, one death, and exactly one rare Proof across replays", () => {
  let state = paired();
  matchOf(state).fighters.alice.player.stats.health = 1;
  state = command(state, "bob", "action", { type: "melee" });
  const match = matchOf(state);
  expect(match.winner).toBe("bob");
  expect(state.entries.bob.kills).toBe(1);
  expect(state.entries.alice.deaths).toBe(1);
  const winner = player("bob");
  const patch = reconcileContestProgress(winner, state.entries.bob);
  expect(patch.records.playerKills).toBe(1);
  expect(patch.materials.proof_of_victory).toBe(1);
  expect(MATERIALS.proof_of_victory.tier).toBe("rare");
  expect(reconcileContestProgress({ ...winner, ...patch }, state.entries.bob)).toBeNull();
  expect(winner.stats.health).toBe(20);
  expect(patch.stats).toBeUndefined();
  expect(() => command(state, "bob", "action", { type: "melee" })).toThrow("ended");
});

test("60-second timeout forfeits the idle player, not the player waiting for them", () => {
  const state = paired();
  const deadline = matchOf(state).deadline;
  expect(command(state, "alice", "timeout", null, deadline - 1)).toBeUndefined();
  const expired = command(state, "alice", "timeout", null, deadline);
  expect(matchOf(expired).winner).toBe("alice");
  expect(expired.entries.bob.deaths).toBe(1);
  expect(deadline).toBe(1000 + CONTEST_TURN_MS);
});

test("forfeiting is a loss even on the opponent's turn; pending results survive requeue", () => {
  let state = paired();
  state = command(state, "alice", "forfeit");
  expect(matchOf(state).winner).toBe("bob");
  state = queue(state, "bob", 20, 4000);
  expect(state.entries.bob.kills).toBe(1);
  expect(reconcileContestProgress(player("bob"), state.entries.bob).materials.proof_of_victory).toBe(1);
});

test("Contest calculations restore an existing PvE fight and never save adventure health", () => {
  getPlayer.mockReturnValue(player("adventure", 100));
  startCombat({ name: "PvE target", maxHp: 100, speed: 0 });
  const enemy = getEnemy();
  command(paired(), "bob", "action", { type: "melee" });
  expect(getEnemy()).toBe(enemy);
  expect(enemy.hp).toBe(100);
  expect(setPlayer).not.toHaveBeenCalled();
});

test("consumable spending is durable and reconciled exactly once", () => {
  const p = { ...player("bob"), consumables: { healthPotion: 3 } };
  const entry = { spent: { healthPotion: 1 } };
  const patch = reconcileContestProgress(p, entry);
  expect(patch.consumables.healthPotion).toBe(2);
  expect(reconcileContestProgress({ ...p, ...patch }, entry)).toBeNull();
});

test("consumables take exactly one turn and insufficient-power skills spend neither power nor a turn", () => {
  let state = paired();
  const fighter = matchOf(state).fighters.bob;
  fighter.player.stats.health = 20;
  state = command(state, "bob", "action", { type: "consume", key: "healthPotion" });
  let match = matchOf(state);
  expect(match.turn).toBe("alice");
  expect(match.fighters.bob.player.stats.health).toBe(70);
  expect(state.entries.bob.spent.healthPotion).toBe(1);
  state = command(state, "alice", "action", { type: "pass" });
  match = matchOf(state);
  match.fighters.bob.player.stats.power = 0;
  const original = JSON.stringify(state);
  expect(() => command(state, "bob", "action", { type: "skill", key: "fireball" })).toThrow("need 5 power");
  expect(JSON.stringify(state)).toBe(original);
});

test("damage over time can end a fight on the affected player's turn", () => {
  let state = paired();
  const fighter = matchOf(state).fighters.bob;
  fighter.player.stats.health = 1;
  fighter.statuses = [{ id: "burn", power: 0.1, turns: 2, stacks: 1 }];
  state = command(state, "bob", "action", { type: "pass" });
  expect(matchOf(state).winner).toBe("alice");
  expect(state.entries.bob.deaths).toBe(1);
});
