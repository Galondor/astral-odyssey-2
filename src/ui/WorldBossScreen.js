import { useEffect, useState } from "react";
import { getEnemy, startCombat } from "../combat/combat";
import { getCharacterIdentity, getPlayer } from "../character/player";
import {
  finishWorldBossAttempt,
  clearWorldBossError,
  forceWorldBossRespawn,
  getWorldBossError,
  getWorldBossTentativeRewards,
  getWorldBossUniqueDropChance,
  hasPendingWorldBossAttempt,
  retryWorldBossAttempt,
  startWorldBossAttempt,
  subscribeWorldBoss,
  subscribeWorldBossError,
  WORLD_BOSS_DAILY_ATTEMPTS,
  WORLD_BOSS_HEALTH,
  WORLD_BOSS_REWARD_THRESHOLD,
} from "../world/worldBoss";
import { isAdmin } from "../world/inbox";

export const formatWorldBossDuration = (milliseconds) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${days}d ${hours}h ${minutes}m ${remainingSeconds}s`;
};

const WorldBossScreen = ({ player, goToScene, onChange, inCombat }) => {
  const [boss, setBoss] = useState(null);
  const [error, setError] = useState(getWorldBossError);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const uid = getCharacterIdentity();

  useEffect(() => {
    const stop = subscribeWorldBoss(setBoss, (cause) => setError(cause.message || "World Boss data is unavailable."));
    const stopError = subscribeWorldBossError(setError);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stop();
      stopError();
      clearInterval(timer);
    };
  }, []);

  const participant = boss?.participants?.[uid];
  const attemptsUsed = participant?.attemptsDay === Math.floor(now / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000)
    ? Number(participant.attemptsUsed) || 0
    : 0;
  const activeFighters = boss?.fighters?.filter((entry) => entry.activeUntil > now) || [];
  const ranked = boss?.fighters?.filter((entry) => entry.damage > 0) || [];
  const canFight = (player?.level || 1) >= 35 && !inCombat && !boss?.defeated &&
    attemptsUsed < WORLD_BOSS_DAILY_ATTEMPTS && !(participant?.activeUntil > now) && !busy;

  const beginAttempt = async () => {
    setBusy(true);
    clearWorldBossError();
    setError("");
    try {
      const result = await startWorldBossAttempt(getPlayer() || player);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      startCombat(result.enemy);
      if (!getEnemy()) finishWorldBossAttempt(result.enemy).catch((cause) => setError(cause.message));
      goToScene("combat");
      onChange();
    } catch (cause) {
      setError(cause.message || "The World Boss attempt could not be started.");
    } finally {
      setBusy(false);
    }
  };

  const respawn = async () => {
    setBusy(true);
    clearWorldBossError();
    setError("");
    try {
      await forceWorldBossRespawn();
    } catch (cause) {
      setError(cause.message || "The World Boss could not be respawned.");
    } finally {
      setBusy(false);
    }
  };

  const retryContribution = async () => {
    setBusy(true);
    clearWorldBossError();
    setError("");
    try {
      await retryWorldBossAttempt();
      onChange();
    } catch (cause) {
      setError(cause.message || "Your contribution could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  if ((player?.level || 1) < 35 && !isAdmin()) {
    return (
      <section className='panel world-boss'>
        <h2>World Boss</h2>
        <p>The World Boss unlocks at level 35. Reach level 35 to join the shared battle.</p>
      </section>
    );
  }

  if (!boss) {
    return <section className='panel world-boss'><h2>World Boss</h2><p role='status'>Loading shared boss status…</p></section>;
  }

  return (
    <section className='panel world-boss'>
      <h2>World Boss: The Astral Colossus</h2>
      <p>A shared 1,000,000-health encounter. Each attempt is a solo fight; damage is added to the global contribution leaderboard.</p>
      <div className='world-boss-status'>
        <strong>{boss.defeated ? "Defeated" : `${boss.health.toLocaleString()} / ${WORLD_BOSS_HEALTH.toLocaleString()} health`}</strong>
        <div className='progress-track' role='progressbar' aria-label='World Boss health' aria-valuemin='0' aria-valuemax={WORLD_BOSS_HEALTH} aria-valuenow={boss.health}>
          <div className='progress-fill' style={{ width: `${100 * boss.health / WORLD_BOSS_HEALTH}%` }} />
        </div>
        <span>{(100 * boss.health / WORLD_BOSS_HEALTH).toFixed(2)}% remaining</span>
      </div>
      <p>
        {boss.defeated
          ? `The next Colossus arrives in ${formatWorldBossDuration(boss.nextSpawnAt - now)}.`
          : `Next spawn in ${formatWorldBossDuration(boss.nextSpawnAt - now)}.`}
      </p>
      <p>
        {activeFighters.length
          ? `Currently fighting: ${activeFighters.map((entry) => entry.name).join(", ")}`
          : "No one is fighting the Colossus right now."}
      </p>
      <p>
        Attempts today: {attemptsUsed}/{WORLD_BOSS_DAILY_ATTEMPTS}. You can make three attempts per day.
      </p>
      <p>
        Rewards require at least {(WORLD_BOSS_REWARD_THRESHOLD / WORLD_BOSS_HEALTH * 100).toFixed(0)}% damage ({WORLD_BOSS_REWARD_THRESHOLD.toLocaleString()} damage), except placement prizes for the top three.
      </p>
      <button type='button' className='buttons' onClick={beginAttempt} disabled={!canFight}>
        {busy ? "Starting…" : participant?.activeUntil > now ? "Attempt in progress" : "Start Attempt"}
      </button>
      {hasPendingWorldBossAttempt() && (
        <button type='button' className='buttons' onClick={retryContribution} disabled={busy}>
          Retry saving contribution
        </button>
      )}
      {player?.level < 35 && <p>Level 35 required.</p>}
      {boss.defeated && <p>The Colossus is defeated. A new boss spawns every 72 hours.</p>}
      {isAdmin() && (
        <button type='button' className='buttons' onClick={respawn} disabled={busy}>
          Force Respawn
        </button>
      )}
      {error && <p className='error-message' role='alert'>{error}</p>}

      <h3>Contribution leaderboard</h3>
      {ranked.length ? (
        <div className='table-scroll'>
          <table>
            <thead>
              <tr><th>Rank</th><th>Player</th><th>Damage</th><th>Contribution</th><th>Tentative reward</th></tr>
            </thead>
            <tbody>
              {ranked.map((entry, index) => {
                const rank = index + 1;
                const percent = entry.damage / WORLD_BOSS_HEALTH * 100;
                return (
                  <tr key={entry.uid}>
                    <td>#{rank}</td>
                    <td>{entry.name || "Unknown"}</td>
                    <td>{entry.damage.toLocaleString()}</td>
                    <td>{percent.toFixed(2)}%</td>
                    <td>{entry.damage > 0 ? getWorldBossTentativeRewards(rank, entry.damage) : "No damage contribution yet"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p>No contributions yet.</p>}
      <h3>Placement rewards</h3>
      <ul>
        <li>#1: Unique title on the first #1 finish, 2 Prismatic Alloy, 3 Architect's Runes, 800,000 Astra</li>
        <li>#2: 1 Prismatic Alloy, 2 Architect's Runes, 500,000 Astra</li>
        <li>#3: 1 Prismatic Alloy, 1 Architect's Rune, 200,000 Astra</li>
        <li>#4–10: 100,000 Astra</li>
        <li>Contributors with at least 1% damage: 50,000 bonus Astra, materials, and 3–8 Epic T3+ gear (top 10 receive T5+)</li>
      </ul>
      <p>All rewards are delivered by mail after the boss is defeated.</p>
    </section>
  );
};

export default WorldBossScreen;
