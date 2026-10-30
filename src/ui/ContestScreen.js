import { useEffect, useState } from "react";
import { CONTEST_MIN_LEVEL, getContestStatus, sendContestCommand, subscribeContest } from "../world/contest";

export default function ContestScreen({ player, inCombat, onChange }) {
  const [, refresh] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const stop = subscribeContest(() => refresh((value) => value + 1));
    const timer = setInterval(() => refresh((value) => value + 1), 1000);
    return () => { stop(); clearInterval(timer); };
  }, []);
  const status = getContestStatus();
  const { match, uid } = status;
  const levelLocked = (player?.level || 1) < CONTEST_MIN_LEVEL;
  const act = async (command) => {
    if (busy) return;
    setBusy(true);
    try {
      await sendContestCommand(command);
      onChange?.();
    } catch (failure) {
      console.error("Couldn't submit Contest action", failure);
    } finally {
      setBusy(false);
    }
  };
  return <section className='contest'>
    <h3>Contest</h3>
    <p>Queue for a live 1v1 fight against another player.</p>
    {!status.ready ? <>
      <p role='status'>Connecting to Contest...</p>
      {levelLocked && <button className='buttons' disabled>{`Level ${CONTEST_MIN_LEVEL}+`}</button>}
    </> : status.waiting ? <>
      <p role='status'>Searching for another live player...</p>
      <button className='buttons' disabled={busy || status.saving} onClick={() => act({ type: "cancel" })}>Leave queue</button>
    </> : status.playing ? <p role='status'>Your Contest is opening in Combat...</p> : <>
      {match?.winner && <p role='status'>{match.winner === uid
        ? "Victory! You earned 1 Proof of Victory."
        : "Defeat, better luck next time."}{match.reason === "timeout" ? " The turn timer expired." : match.reason === "forfeit" ? " The fight ended by forfeit." : ""}</p>}
      {inCombat && <p>Finish your current battle or adventure before joining Contest.</p>}
      <button className='buttons' disabled={levelLocked || busy || status.saving || inCombat || !!status.error}
        onClick={() => act({ type: "queue" })}>{levelLocked ? `Level ${CONTEST_MIN_LEVEL}+` : "Join Contest queue"}</button>
    </>}
  </section>;
}
