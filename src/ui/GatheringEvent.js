import { useEffect, useRef, useState } from "react";
import { GATHERING_PROFESSIONS, GATHERING_UNLOCKS } from "../character/gathering";
import {
  advanceGathering, describeGatheringMaterials, finishGathering, forfeitGathering,
  getGatheringAttempt, getGatheringDuration, getGatheringPool, getMiningMarker,
  recordGatheringInput, startGathering,
} from "../world/gathering";
import { MATERIALS } from "../items/materials";
import { REGIONS } from "../world/regions";

export default function GatheringEvent({ goToScene, onChange }) {
  const [view, setView] = useState(getGatheringAttempt);
  const [now, setNow] = useState(() => performance.now());
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const refresh = useRef(onChange);
  refresh.current = onChange;
  const id = view?.id;
  const active = view?.state === "active";
  useEffect(() => {
    if (!active) return undefined;
    let frame;
    const tick = () => {
      const time = performance.now();
      const progress = advanceGathering(id, time);
      if (!progress.ok) {
        setError(progress.message);
        setView(getGatheringAttempt());
        return;
      }
      if (progress.complete) {
        const result = finishGathering(id, time);
        if (!result.ok) setError(result.message);
        setView(getGatheringAttempt());
        refresh.current?.();
        return;
      }
      setNow(time);
      setView(getGatheringAttempt());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => {
      if (document.hidden) {
        forfeitGathering(id, "Gathering was forfeited when the page was hidden. No rewards were granted.");
        setView(getGatheringAttempt());
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [active, id]);
  useEffect(() => () => {
    if (getGatheringAttempt()?.state === "active") forfeitGathering(id);
  }, [id]);

  if (!view) return (
    <div className='panel gathering'><p>This gathering opportunity is no longer available.</p>
      <button className='buttons' onPointerDown={() => goToScene("menu")}>Return</button>
    </div>
  );
  const definition = GATHERING_PROFESSIONS[view.activity];
  const c = view.config;
  const elapsed = active ? Math.max(0, now - view.startedAt) : 0;
  const countdown = active && elapsed < c.countdown;
  const index = Math.min(c.count - 1, Math.max(0, Math.floor((elapsed - c.countdown) / c.interval)));
  const beat = Math.min(c.count - 1, Math.max(0, Math.round((elapsed - c.countdown) / c.interval) - 1));
  const expectedSide = beat % 2 ? "right" : "left";
  const untilBeat = c.countdown + (beat + 1) * c.interval - elapsed;
  const pointer = (action) => (event) => {
    if (event.button > 0 || event.isPrimary === false) return;
    event.preventDefault();
    action();
  };
  const start = () => {
    const result = startGathering(id);
    if (!result.ok) setError(result.message);
    setNow(performance.now());
    setView(getGatheringAttempt());
  };
  const strike = (side) => {
    const result = recordGatheringInput(id, side);
    if (!result.ok) setError(result.message);
    else if (!result.ignored) setFeedback(result.score === 1 ? "Perfect!" : result.score >= 0.5 ? "Good!" : result.score > 0 ? "Glancing hit" : "Miss");
    setView(getGatheringAttempt());
  };
  const result = view.result;
  return (
    <section className={`panel gathering gathering-${view.activity}`} aria-label={`${definition.name} event`}>
      <header><span className='gathering-eyebrow'>{REGIONS[view.region].name} discovery</span><h2>{definition.name}</h2></header>
      <p>{view.activity === "mining"
        ? "Tap Strike as the moving marker crosses the weak point. Aim for its bright center."
        : "Tap the left and right chopping targets in an alternating rhythm as the beat reaches the center."}</p>
      <p className='gathering-tool'>{c.toolName} · Gathering Power {c.power} · Maximum material tier {c.maxTier}</p>
      {view.state === "offered" && (
        <>
          <h3>Possible resources</h3>
          <ul className='gathering-pool'>{getGatheringPool(view.activity, view.region, c).map(({ key, tier }) => <li key={key}>T{tier} {MATERIALS[key].name}</li>)}</ul>
          <div className='gathering-actions'>
            <button type='button' className='buttons' onPointerDown={pointer(start)}>Start {definition.name}</button>
            <button type='button' className='buttons' onPointerDown={pointer(() => goToScene("menu"))}>Skip</button>
          </div>
        </>
      )}
      {active && (
        <div className='gathering-playfield'>
          <div className='gathering-progress' role='progressbar' aria-label='Gathering time'
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(100 * elapsed / getGatheringDuration(c))}>
            <span style={{ width: `${Math.min(100, 100 * elapsed / getGatheringDuration(c))}%` }} />
          </div>
          {countdown ? <h3 className='gathering-countdown'>Get ready...</h3> : view.activity === "mining" ? (
            <>
              <p>Strike {index + 1} / {c.count}</p>
              <div className='gathering-meter' role='img' aria-label='Moving marker and mining weak point'>
                <span className='gathering-zone' style={{ left: `${(view.targets[index] - c.window) * 100}%`, width: `${c.window * 200}%` }} />
                <span className='gathering-perfect-zone' style={{ left: `${(view.targets[index] - c.perfect) * 100}%`, width: `${c.perfect * 200}%` }} />
                <span className='gathering-marker' style={{ left: `${getMiningMarker(elapsed, c) * 100}%` }} />
              </div>
              <button type='button' className='buttons gathering-strike' disabled={view.scores[index] !== null}
                onPointerDown={pointer(() => strike("strike"))}>Strike</button>
            </>
          ) : (
            <>
              <p>Beat {beat + 1} / {c.count} · {expectedSide === "left" ? "LEFT" : "RIGHT"}</p>
              <div className='gathering-meter logging-meter' role='img' aria-label='Logging beat approaches the center'>
                <span className='gathering-zone' style={{ left: `${50 - c.window / c.interval * 45}%`, width: `${c.window / c.interval * 90}%` }} />
                <span className='gathering-perfect-zone' style={{ left: `${50 - c.perfect / c.interval * 45}%`, width: `${c.perfect / c.interval * 90}%` }} />
                <span className='gathering-marker' style={{ left: `${50 - Math.max(-1, Math.min(1, untilBeat / c.interval)) * 45}%` }} />
              </div>
              <div className='gathering-chops'>{["left", "right"].map((side) => (
                <button key={side} type='button' className={`buttons gathering-chop ${expectedSide === side ? "expected" : ""}`}
                  onPointerDown={pointer(() => strike(side))}>{side === "left" ? "Left chop" : "Right chop"}</button>
              ))}</div>
            </>
          )}
          <p className='gathering-feedback' role='status'>{feedback || "Aim carefully"}</p>
          <div className='gathering-score-dots' aria-label='Scored inputs'>{view.scores.map((value, i) => <span key={i} className={value === null ? "" : value >= 0.5 ? "hit" : "miss"}>{value === null ? "-" : value === 1 ? "P" : value > 0 ? "+" : "X"}</span>)}</div>
          <button type='button' className='buttons' onPointerDown={pointer(() => goToScene("menu"))}>Leave (forfeit)</button>
        </div>
      )}
      {result && (
        <div className='gathering-result' role='status'>
          <h3>{result.grade} · {Math.round(result.performance * 100)}%</h3>
          <p>{describeGatheringMaterials(result.materials) || "No materials recovered."}</p>
          <p>+{result.exp} {definition.name} exp · Best combo {result.bestCombo}</p>
          {result.levelsGained > 0 && <p>{definition.name} reached level {result.level}!</p>}
          {GATHERING_UNLOCKS.filter((unlock) => unlock.level > result.level - result.levelsGained && unlock.level <= result.level).map((unlock) => <p key={unlock.level}>Unlocked: {unlock.name} - {unlock.description}</p>)}
        </div>
      )}
      {view.state === "forfeited" && <p role='status'>Gathering forfeited. No rewards were granted.</p>}
      {["resolved", "forfeited"].includes(view.state) && <button type='button' className='buttons' onPointerDown={pointer(() => goToScene("menu"))}>Return</button>}
      {error && <p role='alert'>{error}</p>}
    </section>
  );
}
