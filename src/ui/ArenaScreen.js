import { useEffect, useState } from "react";
import { endCombat, getEnemy, startCombat } from "../combat/combat";
import LeaderboardScreen from "./LeaderboardScreen";
import ContestScreen from "./ContestScreen";
import { CONTEST_MIN_LEVEL, getContestStatus } from "../world/contest";
import {
  advanceColosseumRun,
  beginColosseumRun,
  endColosseumRun,
  getColosseumStatus,
  COLOSSEUM_MIN_LEVEL,
} from "../world/colosseum";

const TABS = [["pve", "Colosseum"], ["pvp", "Contest"], ["bossRush", "Boss Rush"]];
const formatCooldown = (milliseconds) => {
  const seconds = Math.ceil(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

export default function ArenaScreen({ player, goToScene, onChange, inCombat }) {
  const [tab, setTab] = useState((player?.level || 1) >= CONTEST_MIN_LEVEL ? "pvp" : "pve");
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState("");
  const status = getColosseumStatus(player, now);
  const contestLocked = getContestStatus().locked;
  const contestEligible = (player?.level || 1) >= CONTEST_MIN_LEVEL;
  const colosseumEligible = (player?.level || 1) >= COLOSSEUM_MIN_LEVEL;

  useEffect(() => {
    if (tab !== "pve") return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [tab]);

  const refresh = () => onChange?.();
  const startRun = () => {
    if (inCombat) {
      setMessage("Finish your current battle before entering the Colosseum.");
      return;
    }
    const result = beginColosseumRun();
    if (!result.ok) {
      setMessage(
        result.reason === "level"
          ? "You cannot enter the Colosseum right now."
          : result.reason === "group"
            ? "Finish your group dungeon run first."
          : result.reason === "cooldown"
            ? `You can enter again in ${formatCooldown(result.cooldownRemainingMs)}.`
            : "A Colosseum run is already active.",
      );
      return;
    }
    setMessage("");
    startCombat(result.enemy);
    goToScene("combat");
    refresh();
  };
  const continueRun = () => {
    const enemy = advanceColosseumRun();
    if (!enemy) return;
    startCombat(enemy);
    setMessage("");
    goToScene("combat");
    refresh();
  };
  const leaveRun = () => {
    endColosseumRun();
    if (getEnemy()?.colosseum) endCombat();
    setMessage("You leave the Colosseum and end your run.");
    goToScene("menu");
    refresh();
  };

  return (
    <section className='panel arena'>
      <h2>Arena</h2>
      <div className='arena-tabs' role='tablist' aria-label='Arena'>
        {TABS.map(([key, label]) => {
          const levelLocked = key === "pvp" ? !contestEligible : key === "pve" && !colosseumEligible;
          const minLevel = key === "pvp" ? CONTEST_MIN_LEVEL : COLOSSEUM_MIN_LEVEL;
          return (
            <button
              key={key}
              id={`arena-tab-${key}`}
              type='button'
              role='tab'
              aria-selected={tab === key}
              aria-controls='arena-panel'
              className={`buttons arena-tab-${key} ${tab === key ? "active" : ""}`}
              disabled={levelLocked || (contestLocked && key !== "pvp")}
              onClick={() => setTab(key)}
            >
              {levelLocked ? `Level ${minLevel}+` : label}
            </button>
          );
        })}
      </div>
      <div id='arena-panel' role='tabpanel' aria-labelledby={`arena-tab-${tab}`}>
        {tab === "pvp" ? <ContestScreen player={player} inCombat={inCombat} onChange={onChange} /> : tab !== "pve" ? <p>Coming soon</p> : status.active ? <>
          <h3>Colosseum run</h3>
          <p>Wave {status.wave} • {status.waitingForBossDecision ? "Boss defeated" : "Gladiators await"}</p>
          {status.waitingForBossDecision ? <>
            <p>You defeated the boss. Continue to the next wave or leave with your record.</p>
            <div className='profile-actions'>
              <button type='button' className='buttons' onClick={continueRun}>Continue run</button>
              <button type='button' className='buttons' onClick={leaveRun}>Quit run</button>
            </div>
          </> : <>
            <p>Defeat the ascending waves to earn half rewards, astra, and experience.</p>
            <div className='profile-actions'>
              <button type='button' className='buttons' onClick={() => goToScene("combat")}>Return to battle</button>
              <button type='button' className='buttons' onClick={leaveRun}>Leave run</button>
            </div>
          </>}
        </> : <>
          <h3>Colosseum</h3>
          <p>Face endless waves of gladiators to achieve ultimate glory or perish in the arena.</p>
          <p>Gladiators grow stronger every wave. Runs have a 15-minute cooldown.</p>
          {colosseumEligible
            ? status.cooldownRemainingMs > 0
              ? <p role='status'>You can enter again in {formatCooldown(status.cooldownRemainingMs)}.</p>
              : <p role='status'>Ready to enter.</p>
            : null}
          {(message || inCombat) && <p role='status'>{message || "Finish your current battle before entering the Colosseum."}</p>}
          <button type='button' className='buttons' disabled={!status.canEnter || inCombat} onClick={startRun}>
            {colosseumEligible ? "Enter Colosseum" : `Level ${COLOSSEUM_MIN_LEVEL}+`}
          </button>
        </>}
        {tab === "pve" && <LeaderboardScreen arenaOnly />}
      </div>
    </section>
  );
}
