import { useEffect, useRef, useState } from "react";
import PlayerName from "./PlayerName";

function DeleteCharacterDialog({ character, onDelete, onClose }) {
  const dialog = useRef(null);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const name = character.player?.name || "New adventurer";

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (confirmation !== name || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete(character.id, confirmation);
      onClose();
    } catch (error) {
      setError(error.message);
      setDeleting(false);
    }
  };

  return (
    <dialog ref={dialog} className='character-delete-dialog' aria-labelledby='delete-character-title' aria-describedby='delete-character-warning'
      onCancel={(event) => { event.preventDefault(); if (!deleting) onClose(); }}>
      <form onSubmit={submit}>
        <h2 id='delete-character-title'>Delete {name}?</h2>
        <p id='delete-character-warning'>This permanently deletes this character and all their progress, inventory, mail, and marketplace listings. This cannot be undone.</p>
        <label htmlFor='delete-character-confirmation'>Type "{name}" exactly to confirm.</label>
        <input id='delete-character-confirmation' className='input-field' autoFocus autoComplete='off' value={confirmation}
          disabled={deleting} onChange={(event) => setConfirmation(event.target.value)} />
        {error && <p role='alert'>{error}</p>}
        <div className='character-menu-actions'>
          <button type='button' className='buttons' disabled={deleting} onClick={onClose}>Cancel</button>
          <button type='submit' className='buttons character-delete-button' disabled={confirmation !== name || deleting}>
            {deleting ? "Deleting..." : "Permanently delete character"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export default function CharacterMenu({ roster, error, onPlay, onCreate, onDelete, onLogout }) {
  const { characters, limit } = roster;
  const [deleting, setDeleting] = useState(null);
  const deleteTrigger = useRef(null);
  const closeDialog = () => {
    setDeleting(null);
    if (deleteTrigger.current?.isConnected) deleteTrigger.current.focus();
  };
  return (
    <main className='auth-page character-menu'>
      <h1>Astral Odyssey 2</h1>
      <h2>Main menu</h2>
      <p className='auth-subtitle'>Choose a character or begin a new adventure.</p>
      <p>{characters.length} / {limit} character slots used</p>
      {error && <p role='alert'>{error}</p>}
      <div className='character-list'>
        {characters.map(({ id, player }) => (
          <section className='character-card' key={id}>
            <h3><PlayerName name={player?.name || "New adventurer"} activeTitle={player?.activeTitle} /></h3>
            <p>{player?.stats ? `Level ${player.level || 1} ${player.class || "Adventurer"}` : "Character creation unfinished"}</p>
            <button type='button' className='buttons' onClick={() => onPlay(id)}>
              {player?.stats ? `Play as ${player.name}` : `Continue ${player?.name || "character creation"}`}
            </button>
            <button type='button' className='character-delete-link' aria-label={`Delete ${player?.name || "New adventurer"}`}
              onClick={(event) => { deleteTrigger.current = event.currentTarget; setDeleting({ id, player }); }}>
              Delete character
            </button>
          </section>
        ))}
      </div>
      {!characters.length && <p>No characters yet. Create your first adventurer below.</p>}
      <div className='character-menu-actions'>
        <button type='button' className='buttons' disabled={characters.length >= limit} onClick={onCreate}>Create character</button>
        <button type='button' className='buttons' onClick={onLogout}>Log out</button>
      </div>
      {characters.length >= limit && <p>All character slots are in use.</p>}
      {deleting && <DeleteCharacterDialog character={deleting} onDelete={onDelete} onClose={closeDialog} />}
    </main>
  );
}
