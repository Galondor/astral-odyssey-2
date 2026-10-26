import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { getCharacterIdentity } from "../character/player";
import { getLeaderboards, LEADERBOARD_REFRESH_MS, rankLeaderboard } from "../world/leaderboards";
import PlayerName from "./PlayerName";

const TABS = [
  ["level", "Highest level", "Level"],
  ["gearScore", "Highest gear score", "Gear score"],
  ["astra", "Most astra", "Total astra"],
];

export default function LeaderboardScreen() {
  const [tab, setTab] = useState("level");
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let timer;
    const load = async () => {
      try {
        const next = await getLeaderboards();
        if (!active) return;
        setSnapshot(next);
        setError(false);
        timer = setTimeout(load, Math.max(1, next.fetchedAt + LEADERBOARD_REFRESH_MS - Date.now()));
      } catch (error) {
        console.warn("Leaderboards unavailable", error);
        if (active) setError(true);
      }
    };
    load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [attempt]);

  const rows = snapshot ? rankLeaderboard(snapshot.entries, tab) : [];
  const identity = getCharacterIdentity() || auth.currentUser?.uid;
  const label = TABS.find(([key]) => key === tab)[2];
  return (
    <section className='progression leaderboards'>
      <h2>Leaderboards</h2>
      <p>Scores are published when players save.</p>
      <div className='inventory-tabs' role='tablist' aria-label='Leaderboards'>
        {TABS.map(([key, title]) => (
          <button
            key={key}
            id={`leaderboard-tab-${key}`}
            type='button'
            role='tab'
            aria-selected={tab === key}
            aria-controls='leaderboard-panel'
            className={`inventory-tab ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            {title}
          </button>
        ))}
      </div>
      {error && (
        <div role='alert'>
          Couldn't load the leaderboards. {snapshot && "Showing the last cached rankings."}{" "}
          <button type='button' className='buttons' onClick={() => { setError(false); setAttempt((n) => n + 1); }}>Retry</button>
        </div>
      )}
      {!snapshot && !error && <p role='status'>Loading leaderboards...</p>}
      {snapshot && (
        <>
          <p className='leaderboard-updated'>Rankings fetched: {new Date(snapshot.fetchedAt).toLocaleString()}</p>
          <div id='leaderboard-panel' role='tabpanel' aria-labelledby={`leaderboard-tab-${tab}`} className='leaderboard-panel'>
            {rows.length === 0 ? <p>No ranked players yet. Characters appear after their next sign-in or save.</p> : (
              <table className='leaderboard-table'>
                <caption>{TABS.find(([key]) => key === tab)[1]}</caption>
                <thead><tr><th scope='col'>Rank</th><th scope='col'>Player</th><th scope='col'>{label}</th></tr></thead>
                <tbody>
                  {rows.map((entry) => (
                    <tr key={entry.uid} className={entry.uid === identity ? "leaderboard-self" : undefined}>
                      <td>{entry.rank}</td>
                      <th scope='row'><PlayerName name={entry.name} activeTitle={entry.activeTitle} />{entry.uid === identity ? " (you)" : ""}</th>
                      <td>{entry[tab].toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  );
}