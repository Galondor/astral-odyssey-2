import { useEffect, useRef, useState } from "react";
import { KEY_ITEMS } from "../items/consumables";
import { RECIPES, getCraftedCount } from "../items/workshop";
import { itemTooltip, RARITY_COLORS, SLOTS } from "../items/items";
import { getHolofoilStyle } from "../items/holofoil";
import { SKILLS } from "../character/skills";
import { getRegion, REGIONS } from "../world/events";
import { getRepRank } from "../world/quests";
import { loadPublicProfile, searchCharacters } from "../character/profiles";
import CharacterSummary from "./CharacterSummary";
import Tooltip from "./Tooltip";
import PlayerName from "./PlayerName";

function PublicCharacterProfile({ profile, onClose }) {
  const character = { ...profile, rep: profile.rep || 0 };
  const equipment = profile.equipment || {};
  const upgrades = Object.entries(RECIPES)
    .filter(([key, recipe]) => recipe.type === "upgrade" && getCraftedCount(profile, key) > 0);
  const keyItems = (profile.keyItems || []).filter((key) => KEY_ITEMS[key]);
  const learnedSkills = Object.entries(profile.skills || {})
    .filter(([key, level]) => SKILLS[key] && level > 0);

  return (
    <div className='public-profile-backdrop' onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className='public-profile-dialog' role='dialog' aria-modal='true' aria-label={`${profile.name}'s character profile`}>
        <button type='button' className='buttons profile-close' aria-label='Close character profile' onClick={onClose}>Close</button>
        <div className='character-main'>
          <CharacterSummary player={character} />
        </div>
        <dl className='profile-details'>
          <div><dt>Region</dt><dd>{REGIONS[getRegion(profile)].name}</dd></div>
          <div><dt>Astra</dt><dd>{profile.astra || 0}</dd></div>
          <div><dt>Reputation</dt><dd>{getRepRank(profile.rep || 0)} ({profile.rep || 0})</dd></div>
          <div><dt>Unspent skill points</dt><dd>{profile.skillPoints || 0}</dd></div>
        </dl>
        <section className='public-profile-section'>
          <h3>Skills</h3>
          {learnedSkills.length ? (
            <ul className='public-profile-list'>
            {learnedSkills.map(([key, level]) => (
              <li key={key}><strong>{SKILLS[key].name} — Level {level}</strong></li>
            ))}
            </ul>
          ) : <p>No skills learned yet.</p>}
        </section>
        <section className='public-profile-section'>
          <h3>Equipped gear</h3>
          <ul className='public-profile-equipment'>
            {SLOTS.map((slot) => {
              const slotItem = equipment[slot.key];
              const item = slotItem?.twoHandedOf ? equipment[slotItem.twoHandedOf] : slotItem;
              return (
                <li key={slot.key} style={item ? getHolofoilStyle(item) : undefined}>
                  <span>{slot.label}</span>
                  {item ? (
                    <Tooltip content={itemTooltip(item)}>
                      <span className='public-profile-item' style={{
                        color: RARITY_COLORS[item.rarity],
                      }}>
                        {item.name}
                      </span>
                    </Tooltip>
                  ) : <span>Empty</span>}
                </li>
              );
            })}
          </ul>
        </section>
        <section className='public-profile-section'>
          <h3>Workshop upgrades</h3>
          {upgrades.length ? (
            <ul className='public-profile-list'>
              {upgrades.map(([key, recipe]) => (
                <li key={key}><strong>{recipe.name} × {getCraftedCount(profile, key)}</strong> — {recipe.description}</li>
              ))}
            </ul>
          ) : <p>No workshop upgrades yet.</p>}
        </section>
        <section className='public-profile-section'>
          <h3>Key items</h3>
          {keyItems.length ? (
            <ul className='public-profile-list'>
              {keyItems.map((key) => (
              <li key={key}><strong>{KEY_ITEMS[key].name}</strong></li>
              ))}
            </ul>
          ) : <p>No key items yet.</p>}
        </section>
      </section>
    </div>
  );
}

export default function CharacterSearch({ excludeIdentity }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const input = useRef(null);

  useEffect(() => {
    const prefix = term.trim();
    if (prefix.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const found = await searchCharacters(prefix);
        if (!cancelled) setResults(found.filter((character) => character.id !== excludeIdentity));
      } catch (searchError) {
        console.warn("Couldn't search for characters", searchError);
        if (!cancelled) {
          setResults([]);
          setError("Character search is unavailable. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, excludeIdentity]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      if (profile) {
        setProfile(null);
        setProfileError(null);
      } else {
        setOpen(false);
        input.current?.blur();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [profile]);

  const selectCharacter = async (character) => {
    if (character.publicProfile === false) return;
    setOpen(false);
    setProfileLoading(true);
    setProfileError(null);
    try {
      setProfile(await loadPublicProfile(character.id));
    } catch (profileLoadError) {
      console.warn("Couldn't load public character profile", profileLoadError);
      setProfileError(profileLoadError.message || "Couldn't load this character profile.");
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <>
      <div className='character-search'>
        <label className='visually-hidden' htmlFor='character-search-input'>Search characters</label>
        <input
          id='character-search-input'
          ref={input}
          className='input-field character-search-input'
          type='search'
          role='combobox'
          autoComplete='off'
          placeholder='Search characters...'
          value={term}
          aria-autocomplete='list'
          aria-haspopup='listbox'
          aria-controls='character-search-results'
          aria-expanded={open && term.trim().length >= 2}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setTerm(event.target.value); setOpen(true); }}
        />
        {open && term.trim().length >= 2 && (
          <div id='character-search-results' className='character-search-results' role='listbox' aria-label='Character search results'>
            {loading && <p role='status'>Searching...</p>}
            {error && <p role='alert'>{error}</p>}
            {!loading && !error && results.length === 0 && <p>No characters found.</p>}
            {!loading && !error && results.map((character) => {
              const isPublic = character.publicProfile !== false;
              return (
                <button
                  key={character.id}
                  type='button'
                  role='option'
                  aria-selected='false'
                  className='character-search-result'
                  disabled={!isPublic}
                  onClick={() => selectCharacter(character)}
                >
                  <strong><PlayerName name={character.name} activeTitle={character.activeTitle} /></strong>
                  <span>Level {character.level || 1} {character.class || "Adventurer"}</span>
                  <span>Gear score {character.gearScore || 0}</span>
                  {!isPublic && <span className='character-search-private'>Private profile</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {profileLoading && <div className='character-profile-status' role='status'>Loading character profile...</div>}
      {profileError && (
        <div className='character-profile-error' role='alert'>
          <p>{profileError}</p>
          <button type='button' className='buttons' onClick={() => setProfileError(null)}>Close</button>
        </div>
      )}
      {profile && <PublicCharacterProfile profile={profile} onClose={() => setProfile(null)} />}
    </>
  );
}
