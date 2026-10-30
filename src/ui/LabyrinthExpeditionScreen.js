import { useState } from "react";
import { getLabyrinthState, enterLabyrinth, leaveLabyrinth, moveInLabyrinth, returnToLabyrinthCheckpoint, solveLabyrinthPuzzle, LABYRINTH_FLOOR_COUNT, LABYRINTH_MAX_FRAGMENTS_PER_WEEK, LABYRINTH_MAX_RELICS, LABYRINTH_MIN_LEVEL, LABYRINTH_STAMINA_PER_STEP } from "../world/labyrinth";
import RichText from "./RichText";

const MAP_SIZE = 9;
const TILE_SYMBOLS = {
  entrance: "■",
  checkpoint: "✚",
  exit: "↓",
  boss: "⬢",
  trap: "▲",
  secret: "◇",
  cache: "◆",
  enemy: "✕",
  puzzle: "?",
  empty: "·",
  wall: "",
};
const TILE_LABELS = {
  entrance: "Entrance",
  checkpoint: "Checkpoint",
  exit: "Stairwell",
  boss: "Final guardian",
  trap: "Trap",
  secret: "Relic secret",
  cache: "Supply cache",
  enemy: "Labyrinth enemy",
  puzzle: "Ancient puzzle",
  empty: "Quiet passage",
  wall: "Solid wall",
};
const DIRECTIONS = [
  { name: "north", x: 0, y: -1 },
  { name: "east", x: 1, y: 0 },
  { name: "south", x: 0, y: 1 },
  { name: "west", x: -1, y: 0 },
];

const keyOf = ({ x, y }) => `${x},${y}`;
const isSame = (a, b) => a.x === b.x && a.y === b.y;
const formatTime = (milliseconds) => {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor(total % 86400 / 3600);
  const minutes = Math.floor(total % 3600 / 60);
  const seconds = total % 60;
  return `${days ? `${days}d ` : ""}${hours}h ${minutes}m ${seconds}s`;
};

function LabyrinthExpeditionScreen({ player, inCombat, goToScene, onChange }) {
  const [notice, setNotice] = useState("");
  const state = getLabyrinthState(player);
  const floor = state.floors[state.currentFloor];
  const position = floor.position;
  const currentTile = floor.tiles[position.y * MAP_SIZE + position.x];
  const health = player?.stats?.health || 0;
  const maxHealth = player?.stats?.maxHealth || 1;
  const stamina = player?.stats?.stamina || 0;
  const maxStamina = player?.stats?.maxStamina || 1;
  const resetRemaining = new Date(state.weekId).getTime() - Date.now();
  const eligible = (player?.level || 1) >= LABYRINTH_MIN_LEVEL;
  const pendingPuzzle = state.pendingEncounter?.kind === "puzzle"
    && state.pendingEncounter.floor === state.currentFloor
    && state.pendingEncounter.x === position.x
    && state.pendingEncounter.y === position.y;

  const act = (action) => {
    const result = action();
    if (result.message) setNotice(result.message);
    onChange?.();
    return result;
  };
  const enter = () => {
    const result = enterLabyrinth();
    if (!result.ok) setNotice(result.message);
    else setNotice(result.state?.started ? "You resume at your checkpoint." : "The weekly expedition begins.");
    onChange?.();
  };
  const leave = () => {
    const result = leaveLabyrinth();
    if (!result.ok) setNotice(result.message);
    else {
      setNotice("You return to the gate. Your checkpoint is saved.");
      goToScene("menu");
    }
    onChange?.();
  };
  const move = (tile) => {
    const result = moveInLabyrinth(tile.x, tile.y);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setNotice(result.message || "");
    if (result.encounter === "combat") goToScene("combat");
    else if (result.encounter === "puzzle") onChange?.(result.message);
    onChange?.();
  };

  return (
    <div className="labyrinth panel">
      <header className="labyrinth-header">
        <div>
          <p className="labyrinth-eyebrow">WEEKLY EXPEDITION</p>
          <h2>The Labyrinth</h2>
          <p className="labyrinth-intro">Five shifting floors filled with ancient mechanisms, rival wardens, hidden relics, and paths that never stay still.</p>
        </div>
        <div className="labyrinth-cycle">
          <span>FRIDAYS · 8:00 AM ET</span>
          <strong>{formatTime(resetRemaining)}</strong>
          <small>Weekly generation</small>
        </div>
      </header>

      <div className="labyrinth-prototype-note">
        Weekly progress saves to your character. Sealed Relics are added to your inventory only after defeating the final guardian.
      </div>

      {state.completed ? (
        <section className="labyrinth-outpost complete" role="status">
          <div className="labyrinth-emblem">⬢</div>
          <h3>Expedition complete</h3>
          <p>You defeated the Unwritten King and claimed this week's Labyrinth rewards. A new maze forms Friday at 8:00 AM ET.</p>
          <button type="button" className="buttons" onClick={leave}>Return to the Gate</button>
        </section>
      ) : !state.active ? (
        <section className="labyrinth-outpost">
          <div className="labyrinth-outpost-copy">
            <span className="labyrinth-location">THE SHATTERED GATE</span>
            <h3>{state.started ? "Your checkpoint awaits." : "An expedition awaits."}</h3>
            <p>{state.started
              ? `Continue at Floor ${floor.number}'s checkpoint. Your relic finds and recovered fragments are saved for this weekly run.`
              : "Explore a five-floor maze each week. Recover resources, collect up to five sealed Relics, and survive the final guardian to claim them."}</p>
          </div>
          <div className="labyrinth-gate">
            <div className="labyrinth-gate-art" aria-hidden="true">
              <svg className="labyrinth-logo" viewBox="0 0 32 32" fill="none">
                <path d="M5 5h22v22H5zM10 10v12h12V10H10zm0 6h6v6m0-12v6h6m-6 6h6" />
                <path d="M5 16h5m12 0h5M16 5v5m0 12v5" />
              </svg>
            </div>
            <div className="labyrinth-checkpoint-detail"><span>RETURN POINT</span><strong>{state.started ? `Floor ${floor.number} · Checkpoint` : "Not yet discovered"}</strong></div>
            <button type="button" className="buttons labyrinth-enter" disabled={!eligible || !!inCombat || state.completed} onClick={enter}>
              {!eligible ? `Level ${LABYRINTH_MIN_LEVEL}+` : state.started ? "Resume Expedition" : "Enter the Labyrinth"}
            </button>
            {inCombat && <small className="labyrinth-lock-note">Finish your current battle first.</small>}
          </div>
        </section>
      ) : (
        <section className="labyrinth-expedition">
          <div className="labyrinth-expedition-heading">
            <div><span className="labyrinth-location">ACTIVE EXPEDITION</span><h3>The Unmapped Reach <small>· Floor {floor.number} of {LABYRINTH_FLOOR_COUNT}</small></h3></div>
            <button type="button" className="buttons labyrinth-leave" disabled={!!inCombat} onClick={leave}>Return to Gate</button>
          </div>
          <p className="labyrinth-message" role="status">{notice || `Every step costs ${LABYRINTH_STAMINA_PER_STEP} stamina. Seek the ✚ checkpoint to restore health and stamina.`}</p>
          <div className="labyrinth-map-layout">
            <aside className="labyrinth-status-panel" aria-label="Expedition status">
              <h4>EXPEDITION STATUS</h4>
              <div className="labyrinth-status-stat">
                <span>FLOOR</span><strong>{floor.number}<small> / {LABYRINTH_FLOOR_COUNT}</small></strong>
              </div>
              <div className="labyrinth-status-stat">
                <span>HEALTH</span><strong>{health}<small> / {maxHealth}</small></strong>
                <div className="labyrinth-meter health"><i style={{ width: `${health / maxHealth * 100}%` }} /></div>
              </div>
              <div className="labyrinth-status-stat">
                <span>STAMINA</span><strong>{stamina}<small> / {maxStamina}</small></strong>
                <div className="labyrinth-meter stamina"><i style={{ width: `${stamina / maxStamina * 100}%` }} /></div>
              </div>
              <div className="labyrinth-status-stat relic-status">
                <span>RELICS SECURED</span><strong>{state.relicsFound}<small> / {LABYRINTH_MAX_RELICS}</small></strong>
              </div>
              <div className="labyrinth-status-stat fragment-status">
                <span>RELIC FRAGMENTS</span><strong>{state.fragmentsEarned}<small> / {LABYRINTH_MAX_FRAGMENTS_PER_WEEK}</small></strong>
              </div>
              {stamina < LABYRINTH_STAMINA_PER_STEP && !isSame(position, floor.checkpoint) && (
                <button type="button" className="buttons labyrinth-enter" onClick={() => act(returnToLabyrinthCheckpoint)}>
                  Return to checkpoint
                </button>
              )}
            </aside>
            <div className="labyrinth-map" role="grid" aria-label={`Labyrinth floor ${floor.number} map`}>
              {floor.tiles.map((tile) => {
                const discovered = floor.discovered.includes(keyOf(tile));
                const current = isSame(tile, position);
                const adjacent = Math.abs(tile.x - position.x) + Math.abs(tile.y - position.y) === 1;
                const canMove = !current && !inCombat && adjacent && tile.type !== "wall" && stamina >= LABYRINTH_STAMINA_PER_STEP;
                const type = tile.type === "wall"
                  ? discovered || adjacent ? "wall" : "unknown"
                  : discovered ? tile.type : "unknown";
                const direction = DIRECTIONS.find((item) => tile.x === position.x + item.x && tile.y === position.y + item.y)?.name;
                const label = current
                  ? `Current position, ${TILE_LABELS[tile.type]}`
                  : tile.type === "wall"
                    ? "Solid labyrinth wall"
                    : discovered
                      ? TILE_LABELS[tile.type]
                      : `Unexplored tile${direction ? `, explore ${direction}` : ""}`;
                return (
                  <button
                    key={keyOf(tile)}
                    type="button"
                    role="gridcell"
                    className={`labyrinth-tile ${type} ${canMove ? "movable" : ""} ${current ? "current" : ""} ${discovered ? "discovered" : ""} ${tile.resolved ? "resolved" : ""}`}
                    aria-label={label}
                    aria-current={current ? "location" : undefined}
                    disabled={!canMove}
                    onClick={() => move(tile)}
                  >
                    {current ? "●" : discovered ? TILE_SYMBOLS[tile.type] : ""}
                  </button>
                );
              })}
            </div>
            <aside className="labyrinth-side-panel">
              <h4>FIELD NOTES</h4>
              <div className="labyrinth-legend">
                {[["checkpoint", "Checkpoint"], ["cache", "Supply cache"], ["secret", "Secret relic"], ["enemy", "Enemy"], ["trap", "Trap"], ["puzzle", "Puzzle"], [floor.number === LABYRINTH_FLOOR_COUNT ? "boss" : "exit", floor.number === LABYRINTH_FLOOR_COUNT ? "Final guardian" : "Stairwell"]].map(([type, label]) => (
                  <span key={type}><i className={`legend-${type}`}>{TILE_SYMBOLS[type]}</i>{label}</span>
                ))}
              </div>
              {pendingPuzzle && (
                <div className="labyrinth-encounter">
                  <strong>Entrance rune puzzle</strong>
                  <p>Which symbol was carved above the entrance?</p>
                  <div className="labyrinth-puzzle-answers">
                    {["■", "◆", "▲"].map((answer) => (
                      <button key={answer} type="button" className="buttons" disabled={!!inCombat} onClick={() => act(() => solveLabyrinthPuzzle(answer))}>{answer}</button>
                    ))}
                  </div>
                  <small>An incorrect choice costs health; the puzzle can be retried.</small>
                </div>
              )}
              {currentTile.type === "exit" && !currentTile.resolved && (
                <p className="labyrinth-move-hint">Stairwell discovered. Move onto it to descend and attune the next checkpoint.</p>
              )}
              {currentTile.type === "boss" && !currentTile.resolved && (
                <p className="labyrinth-warning">The final guardian awaits at the exit. Defeating it completes the weekly run.</p>
              )}
              <p className="labyrinth-move-hint">Move to an adjacent tile to reveal what's there. Each step costs {LABYRINTH_STAMINA_PER_STEP} stamina.</p>
              <button type="button" className="buttons labyrinth-rest" disabled={stamina > 0} onClick={() => act(returnToLabyrinthCheckpoint)}>
                Emergency return to checkpoint
              </button>
            </aside>
          </div>
        </section>
      )}
      <footer className="labyrinth-footer">
        {state.lastCombatResults?.length > 0 && (
          <section className="labyrinth-combat-results" aria-label="Last combat results">
            <h4>Last Combat Results</h4>
            <ul>
              {state.lastCombatResults.map((result, index) => (
                <li key={`${index}-${result}`}><RichText text={result} /></li>
              ))}
            </ul>
          </section>
        )}
      </footer>
    </div>
  );
}

export default LabyrinthExpeditionScreen;
