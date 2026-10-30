import { useCallback, useEffect, useRef, useState } from "react";
import { getRep, getRepRank } from "../world/quests";
import { getRegion, REGIONS } from "../world/events";
import CharacterSummary from "./CharacterSummary";
import profilePlaceholder from "./profile-placeholder.svg";

export default function ProfileMenu({ player, sending, inCombat, contestLocked, onMainMenu, onLogout, onSetPublicProfile }) {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState(null);
  const container = useRef(null);
  const toggle = useRef(null);
  const closeButton = useRef(null);
  const closeMenu = useCallback(() => {
    setOpen(false);
    setSettingsOpen(false);
    setStatsOpen(false);
    setSettingsError(null);
  }, []);
  const updatePublicProfile = async (event) => {
    setSavingSettings(true);
    setSettingsError(null);
    try {
      await onSetPublicProfile(event.target.checked);
    } catch (error) {
      setSettingsError(error.message || "Couldn't update your profile settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    closeButton.current.focus();
    const outside = (event) => {
      if (!container.current.contains(event.target)) closeMenu();
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        toggle.current.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, closeMenu]);

  return (
    <div className='profile-menu' ref={container} onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) closeMenu();
    }}>
      <button
        ref={toggle}
        type='button'
        className='profile-toggle'
        aria-label='Character profile'
        aria-haspopup='dialog'
        aria-expanded={open}
        aria-controls={open ? "character-profile" : undefined}
        onClick={() => {
          if (open) closeMenu();
          else setOpen(true);
        }}
      >
        <img src={profilePlaceholder} alt='' width='44' height='44' />
      </button>
      {open && (
        <section id='character-profile' className='profile-popup' role='dialog' aria-label='Character profile'>
          <button ref={closeButton} type='button' className='buttons profile-close' aria-label='Close character profile' onClick={() => {
            closeMenu();
            toggle.current.focus();
          }}>Close</button>
          {settingsOpen ? <>
            <h2>Character settings</h2>
            <p>Choose whether other players can view this character's profile.</p>
            <label className='public-profile-setting'>
              <input
                type='checkbox'
                checked={player?.publicProfile !== false}
                disabled={savingSettings}
                onChange={updatePublicProfile}
              />
              <span>Public Profile</span>
            </label>
            {settingsError && <p role='alert'>{settingsError}</p>}
            <div className='profile-actions'>
              <button type='button' className='buttons' onClick={() => setSettingsOpen(false)}>Back to profile</button>
            </div>
          </> : statsOpen ? <>
            <h2>Character stats</h2>
            <dl className='profile-details profile-stats'>
              <div><dt>Basic enemies killed</dt><dd>{(player?.records?.basicEnemiesKilled || 0).toLocaleString()}</dd></div>
              <div><dt>Elites killed</dt><dd>{(player?.records?.eliteEnemiesKilled || 0).toLocaleString()}</dd></div>
              <div><dt>Bosses killed</dt><dd>{(player?.records?.bossEnemiesKilled || 0).toLocaleString()}</dd></div>
              <div><dt>Contest Wins</dt><dd>{(player?.records?.playerKills || 0).toLocaleString()}</dd></div>
              <div><dt>Contest Losses</dt><dd>{(player?.records?.playerDeaths || 0).toLocaleString()}</dd></div>
              <div><dt>Total Astra gained</dt><dd>{(player?.records?.totalAstraGained || 0).toLocaleString()}</dd></div>
              <div><dt>Astra lost in Blackjack</dt><dd>{(player?.records?.totalAstraLostInBlackjack || 0).toLocaleString()}</dd></div>
              <div><dt>Most damage dealt in one hit</dt><dd>{(player?.records?.mostDamageDealt || 0).toLocaleString()}</dd></div>
              <div><dt>Dungeons cleared</dt><dd>{(player?.records?.dungeonsCleared || 0).toLocaleString()}</dd></div>
              <div><dt>Group dungeons cleared</dt><dd>{(player?.records?.groupDungeonsCleared || 0).toLocaleString()}</dd></div>
              <div><dt>Labyrinths cleared</dt><dd>{(player?.records?.labyrinthsCleared || 0).toLocaleString()}</dd></div>
              <div><dt>Highest cleared Colosseum wave</dt><dd>{(player?.records?.highestClearedColosseumWave || 0).toLocaleString()}</dd></div>
            </dl>
            <div className='profile-actions'>
              <button type='button' className='buttons' onClick={() => setStatsOpen(false)}>Back to profile</button>
            </div>
          </> : player && <>
            <div className='character-main'>
              <CharacterSummary player={player} />
            </div>
            <dl className='profile-details'>
              <div><dt>Region</dt><dd>{REGIONS[getRegion(player)].name}</dd></div>
              <div><dt>Astra</dt><dd>{player.astra}</dd></div>
              <div><dt>Reputation</dt><dd>{getRepRank(getRep(player))} ({getRep(player)})</dd></div>
            </dl>
          </>}
          {!settingsOpen && !statsOpen && <div className='profile-actions'>
            {player && <button type='button' className='buttons' onClick={() => setStatsOpen(true)}>Stats</button>}
            {player && <button type='button' className='buttons' onClick={() => setSettingsOpen(true)}>Settings</button>}
            <button type='button' className='buttons' disabled={sending || inCombat} onClick={onMainMenu}>Main menu</button>
            <button type='button' className='buttons' disabled={sending || contestLocked} onClick={onLogout}>Log out</button>
          </div>}
        </section>
      )}
    </div>
  );
}
