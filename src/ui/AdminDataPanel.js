import { useState } from "react";
import { resetPlayerData, resetServerData } from "../world/adminData";

export default function AdminDataPanel({ players, onReset }) {
  const [identity, setIdentity] = useState("");
  const [pending, setPending] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const selected = players.find((player) => player.uid === identity);

  const begin = (server) => {
    setPending(server ? { server: true, phrase: "RESET SERVER" } : {
      server: false, identity: selected.uid, phrase: selected.name,
    });
    setConfirmation("");
    setNote("");
  };
  const reset = async (event) => {
    event.preventDefault();
    if (busy || confirmation !== pending.phrase) return;
    setBusy(true);
    setNote("");
    try {
      if (pending.server) {
        const count = await resetServerData(confirmation);
        setNote(`Server reset complete. ${count} characters reset. Reload the cloud save to continue.`);
      } else {
        await resetPlayerData(pending.identity, confirmation);
        setNote(`${pending.phrase} has been reset. Open sessions must reload the cloud save.`);
      }
      setPending(null);
      setConfirmation("");
      onReset();
    } catch (error) {
      console.error("Couldn't reset game data", error);
      setNote(`Reset failed: ${error.message}. Reload before trying again.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id='admin-panel-data' role='tabpanel' aria-labelledby='admin-tab-data'>
      <h3>Reset game data</h3>
      <p>Resets are permanent and cannot be undone. Accounts, character names, IDs, and slots are kept.</p>
      <p>Characters return to level 1 and choose starting stats again, with no items, equipment, astra, bank balance, skills, titles, or progression. No starter items are granted.</p>
      <p>Open sessions will be paused and must reload the cloud save. Resetting your own character also pauses this admin session.</p>
      <div className='admin-form'>
        <label htmlFor='admin-data-player'>Player</label>
        <select id='admin-data-player' className='input-field' value={identity} disabled={busy || !!pending}
          onChange={(event) => setIdentity(event.target.value)}>
          <option value=''>Select a character</option>
          {players.map((player) => (
            <option key={player.uid} value={player.uid}>{player.name} (Lv {player.level})</option>
          ))}
        </select>
        <p>A player reset affects only the selected character. Their mail, listings, rankings, social links, and active parties or contests are cleared. Other characters keep their progress.</p>
        <button type='button' className='buttons input-button character-delete-button'
          disabled={!selected || busy || !!pending} onClick={() => begin(false)}>Reset player data</button>
        <h3>Server reset</h3>
        <p>Resets every character, including admins, and deletes all shared gameplay data: mail, broadcasts, marketplace listings, rankings, World Boss progress, social links, parties, contests, and bug reports. Admin access and account configuration are preserved.</p>
        <button type='button' className='buttons input-button character-delete-button'
          disabled={busy || !!pending} onClick={() => begin(true)}>Reset server data</button>
        {pending && (
          <form onSubmit={reset}>
            <h4>{pending.server ? "Confirm server reset" : `Confirm reset of ${pending.phrase}`}</h4>
            <p>This permanently erases {pending.server ? "all game progress for every character" : "this character's game progress"}. There is no undo.</p>
            <label htmlFor='admin-reset-confirmation'>Type "{pending.phrase}" exactly to confirm.</label>
            <input id='admin-reset-confirmation' className='input-field' autoFocus autoComplete='off'
              value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} />
            <div className='character-menu-actions'>
              <button type='button' className='buttons' disabled={busy} onClick={() => setPending(null)}>Cancel</button>
              <button type='submit' className='buttons character-delete-button' disabled={busy || confirmation !== pending.phrase}>
                {busy ? "Resetting..." : pending.server ? "Permanently reset server" : "Permanently reset player"}
              </button>
            </div>
          </form>
        )}
        {note && <p className='recipe-note' role='status'>{note}</p>}
      </div>
    </section>
  );
}
