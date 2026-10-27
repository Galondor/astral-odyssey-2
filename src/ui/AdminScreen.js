import { useEffect, useState } from "react";
import { CONSUMABLES, KEY_ITEMS } from "../items/consumables";
import { CONDITION_NAMES, createCustomItem, GEAR_SLOT_TYPES, getCustomSubStatTiers, getSubStatPool, MAIN_STAT_NAMES, RARITY_COLORS, RARITY_NAMES, STAT_LABELS, STAT_TIERS } from "../items/items";
import { ABILITIES, UNIQUE_ABILITIES } from "../combat/abilities";
import { MATERIALS } from "../items/materials";
import { isHolofoilColors } from "../items/holofoil";
import { UNIQUES } from "../world/dungeonData";
import {
  administerPlayerTimer,
  deleteBroadcast,
  describeAttachments,
  getBroadcasts,
  getDirectory,
  grantLabyrinthAttempt,
  sendMessage,
} from "../world/inbox";
import { resolveBugReport, subscribeBugReports } from "../world/bugReports";
import { TITLES } from "../character/titles";
import PlayerName from "./PlayerName";

const KINDS = {
  astra: { label: "Astra" },
  exp: { label: "Experience" },
  material: { label: "Material", options: Object.entries(MATERIALS).map(([k, v]) => [k, v.name]) },
  consumable: { label: "Consumable", options: Object.entries(CONSUMABLES).map(([k, v]) => [k, v.name]) },
  keyItem: { label: "Key item", options: Object.entries(KEY_ITEMS).map(([k, v]) => [k, v.name]) },
  gear: { label: "Random gear", options: GEAR_SLOT_TYPES.map((s) => [s, s]) },
  custom: { label: "Custom gear" },
  unique: { label: "Unique item", options: Object.entries(UNIQUES).map(([k, v]) => [k, v.name]) },
  gemstone: { label: "Random gemstone" },
  title: { label: "Title", options: Object.entries(TITLES).map(([id, title]) => [id, `${title.rarity} — ${title.name} (${title.criteria})`]) },
};

// Collapses the picked rows into the attachments shape stored on a message.
const buildAttachments = (rows) => {
  const out = { astra: 0, exp: 0, materials: {}, consumables: {}, keyItems: {}, gear: [], uniques: [], gemstones: [], titles: [], items: [] };
  for (const r of rows) {
    const foil = r.holofoil ? { holofoil: r.holofoil } : {};
    if (r.kind === "astra") out.astra += r.amount;
    else if (r.kind === "exp") out.exp += r.amount;
    else if (r.kind === "material") out.materials[r.key] = (out.materials[r.key] || 0) + r.amount;
    else if (r.kind === "consumable") out.consumables[r.key] = (out.consumables[r.key] || 0) + r.amount;
    else if (r.kind === "keyItem") out.keyItems[r.key] = true;
    else if (r.kind === "gear") out.gear.push({ slot: r.key, minRarity: r.minRarity, count: r.amount, ...foil });
    else if (r.kind === "unique") out.uniques.push({ id: r.key, count: r.amount, ...foil });
    else if (r.kind === "title") out.titles.push(r.key);
    else if (r.kind === "custom") out.items.push(...r.items);
    else out.gemstones.push({ minRarity: r.minRarity, count: r.amount });
  }
  return out;
};

const rowLabel = (r) => r.kind === "custom"
  ? `${r.items.length}× ${describeAttachments({ items: [r.items[0]] })[0]} (Lv ${r.items[0].iLevel})`
  : describeAttachments(buildAttachments([r]))[0];

const initialCustom = {
  name: "", slot: GEAR_SLOT_TYPES[0], rarity: "Common", condition: "Average",
  iLevel: "1", price: "1", stat: "strength", tier: "0", ability: "", twoHanded: false,
};

const AdminScreen = () => {
  const [activeTab, setActiveTab] = useState("broadcasting");
  const [players, setPlayers] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [bugReports, setBugReports] = useState([]);
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [rows, setRows] = useState([]);
  const [kind, setKind] = useState("astra");
  const [key, setKey] = useState("");
  const [amount, setAmount] = useState(1);
  const [minRarity, setMinRarity] = useState(0);
  const [forceHolofoil, setForceHolofoil] = useState(false);
  const [color1, setColor1] = useState("");
  const [color2, setColor2] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [bugsNote, setBugsNote] = useState("");
  const [maintenanceNote, setMaintenanceNote] = useState("");
  const [timer, setTimer] = useState("dungeons");
  const [custom, setCustom] = useState(initialCustom);
  const [customSubStats, setCustomSubStats] = useState({});
  const updateCustom = (field, value) => setCustom((c) => ({ ...c, [field]: value }));

  const load = () => {
    getDirectory().then(setPlayers).catch(() => setNote("Couldn't load the player list."));
    getBroadcasts().then(setBroadcasts).catch(() => {});
  };
  useEffect(load, []);
  useEffect(
    () => subscribeBugReports(
      setBugReports,
      () => setBugsNote("Couldn't load bug reports."),
    ),
    [],
  );

  const playerLabel = (p) => `${p.name} (Lv ${p.level})`;
  const [listOpen, setListOpen] = useState(false);
  const term = search.trim().toLowerCase();
  const matches = players.filter(
    (p) => !term || String(p.name).toLowerCase().includes(term)
  );
  const onPlayerInput = (value) => {
    setSearch(value);
    setTo("");
    setListOpen(true);
  };
  const pickPlayer = (p) => {
    setTo(p.uid);
    setSearch(playerLabel(p));
    setListOpen(false);
  };

  const options = KINDS[kind].options;
  const selectedKey = options ? key || options[0][0] : "";
  const isGear = kind === "gear" || kind === "unique";

  const addRow = () => {
    let holofoil;
    if ((isGear || kind === "custom") && forceHolofoil) {
      const colors = [color1.trim(), color2.trim()];
      if (colors.some(Boolean) && !isHolofoilColors(colors)) {
        setNote("Enter both holofoil colors as #RRGGBB hex codes, or leave both blank for random colors.");
        return;
      }
      holofoil = colors.some(Boolean) ? colors : true;
    }
    if (kind === "custom") {
      try {
        const count = Number(amount);
        if (!Number.isSafeInteger(count) || count < 1) throw new Error("Quantity must be a positive whole number.");
        const definition = {
          ...custom,
          iLevel: custom.iLevel.trim() ? Number(custom.iLevel) : NaN,
          price: custom.price.trim() ? Number(custom.price) : NaN,
          mainStat: { stat: custom.stat, tier: Number(custom.tier) },
          subStats: Object.fromEntries(Object.entries(customSubStats)
            .filter(([stat, value]) => getSubStatPool(custom.slot).includes(stat) && value.trim() !== "")
            .map(([stat, value]) => [stat, Number(value)])),
          ...(holofoil !== undefined ? { holofoil } : {}),
        };
        const items = Array.from({ length: count }, () => createCustomItem(definition));
        setRows((r) => [...r, { kind, items }]);
        setNote("");
      } catch (err) {
        setNote(err.message);
      }
      return;
    }
    const n = Math.max(1, Math.floor(Number(amount) || 0));
    setRows((r) => [...r, { kind, key: selectedKey, amount: n, minRarity: Number(minRarity), ...(holofoil ? { holofoil } : {}) }]);
    setNote("");
  };

  const send = async (e) => {
    e.preventDefault();
    const recipient = activeTab === "broadcasting" ? "all" : to;
    if (!recipient) return setNote("Select a player.");
    if (!subject.trim() || !body.trim()) return setNote("Subject and message are required.");
    setBusy(true);
    try {
      await sendMessage({ to: recipient, subject, body, attachments: buildAttachments(rows) });
      setNote(recipient === "all" ? "Sent to all players." : "Message sent.");
      setSubject("");
      setBody("");
      setRows([]);
      load();
    } catch (err) {
      setNote(`Failed to send: ${err.message}`);
    }
    setBusy(false);
  };

  const removeBroadcast = async (id) => {
    await deleteBroadcast(id).catch(() => setNote("Couldn't delete that broadcast."));
    load();
  };

  const resolveReport = async (id) => {
    setBugsNote("");
    setBusy(true);
    try {
      await resolveBugReport(id);
      setBugsNote("Bug report resolved.");
    } catch (err) {
      console.error("Couldn't resolve bug report", err);
      setBugsNote("Couldn't resolve that bug report.");
    } finally {
      setBusy(false);
    }
  };

  const runMaintenanceAction = async (action) => {
    if (!players.some((player) => player.uid === to)) {
      setMaintenanceNote("Select a player.");
      return;
    }
    setMaintenanceNote("");
    setBusy(true);
    try {
      if (action === "attempt") {
        await grantLabyrinthAttempt(to);
        setMaintenanceNote("A fresh Labyrinth attempt has been granted.");
      } else {
        await administerPlayerTimer(to, timer);
        setMaintenanceNote(`${timer === "dungeons" ? "Dungeons" : "Labyrinth"} timer refreshed.`);
      }
    } catch (err) {
      console.error("Couldn't update player timers", err);
      setMaintenanceNote(err.message || "Couldn't update the player's timer. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className='panel admin-panel'>
      <h2>Admin controls</h2>
      <div className='admin-tabs' role='tablist' aria-label='Admin controls'>
        <button
          id='admin-tab-broadcasting'
          type='button'
          role='tab'
          aria-selected={activeTab === "broadcasting"}
          aria-controls='admin-panel-broadcasting'
          className={`inventory-tab ${activeTab === "broadcasting" ? "active" : ""}`}
          onClick={() => setActiveTab("broadcasting")}
        >
          Broadcasting
        </button>
        <button
          id='admin-tab-other-controls'
          type='button'
          role='tab'
          aria-selected={activeTab === "other"}
          aria-controls='admin-panel-other-controls'
          className={`inventory-tab ${activeTab === "other" ? "active" : ""}`}
          onClick={() => setActiveTab("other")}
        >
          Individual Message
        </button>
        <button
          id='admin-tab-bugs'
          type='button'
          role='tab'
          aria-selected={activeTab === "bugs"}
          aria-controls='admin-panel-bugs'
          className={`inventory-tab ${activeTab === "bugs" ? "active" : ""}`}
          onClick={() => setActiveTab("bugs")}
        >
          Bugs
        </button>
        <button
          id='admin-tab-maintenance'
          type='button'
          role='tab'
          aria-selected={activeTab === "maintenance"}
          aria-controls='admin-panel-maintenance'
          className={`inventory-tab ${activeTab === "maintenance" ? "active" : ""}`}
          onClick={() => setActiveTab("maintenance")}
        >
          Timers & Attempts
        </button>
      </div>
      {activeTab === "bugs" ? (
        <section
          id='admin-panel-bugs'
          role='tabpanel'
          aria-labelledby='admin-tab-bugs'
        >
          <h3>Player bug reports</h3>
          {bugsNote && <div className='recipe-note' role='status'>{bugsNote}</div>}
          {!bugReports.length && <div className='equip-empty'>No bug reports.</div>}
          <ul className='bug-report-list'>
            {bugReports.map((report) => (
              <li key={report.id} className={`bug-report-entry ${report.status}`}>
                <div className='bug-report-entry-header'>
                  <h4>{report.title}</h4>
                  <span className={`bug-report-status ${report.status}`}>{report.status}</span>
                </div>
                <p className='bug-report-description'>{report.description}</p>
                <div className='bug-report-meta'>
                  {report.playerName} · {report.createdAt ? new Date(report.createdAt).toLocaleString() : "Unknown date"}
                </div>
                {report.status !== "resolved" && (
                  <button
                    type='button'
                    className='buttons input-button'
                    disabled={busy}
                    onClick={() => resolveReport(report.id)}
                  >
                    Resolve
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : activeTab === "maintenance" ? (
        <section
          id='admin-panel-maintenance'
          role='tabpanel'
          aria-labelledby='admin-tab-maintenance'
        >
          <h3>Refresh a player's timer or grant an attempt</h3>
          <p>Refreshing the Labyrinth or granting another attempt replaces the current maze with a fresh one.</p>
          <p>Players with an open game session must reload to receive the change.</p>
          <div className='admin-form'>
            <div className='player-combobox' onBlur={() => setListOpen(false)}>
              <label htmlFor='admin-player-input'>Player</label>
              <input
                id='admin-player-input'
                className='input-field'
                role='combobox'
                aria-expanded={listOpen}
                aria-controls='admin-player-list'
                placeholder='Search by character name'
                autoComplete='off'
                value={search}
                onFocus={() => setListOpen(true)}
                onChange={(e) => onPlayerInput(e.target.value)}
              />
              {listOpen && (
                <ul id='admin-player-list' className='player-combobox-list' role='listbox'>
                  {!matches.length && <li className='player-combobox-empty'>No matching players</li>}
                  {matches.map((p) => (
                    <li
                      key={p.uid}
                      role='option'
                      aria-selected={p.uid === to}
                      className={p.uid === to ? "selected" : ""}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickPlayer(p);
                      }}
                    >
                      <PlayerName name={`${p.name} (Lv ${p.level})`} activeTitle={p.activeTitle} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <label htmlFor='admin-timer-select'>
              Timer
              <select
                id='admin-timer-select'
                className='input-field'
                value={timer}
                onChange={(e) => setTimer(e.target.value)}
              >
                <option value='dungeons'>Dungeons</option>
                <option value='labyrinth'>Labyrinth</option>
              </select>
            </label>
            <button
              type='button'
              className='buttons input-button'
              disabled={busy || !players.length}
              onClick={() => runMaintenanceAction("timer")}
            >
              {busy ? "Updating..." : "Force refresh timer"}
            </button>
            <button
              type='button'
              className='buttons input-button'
              disabled={busy || !players.length}
              onClick={() => runMaintenanceAction("attempt")}
            >
              {busy ? "Updating..." : "Grant another Labyrinth attempt"}
            </button>
            {maintenanceNote && <div className='recipe-note' role='status'>{maintenanceNote}</div>}
          </div>
        </section>
      ) : (
      <section
        id={activeTab === "broadcasting" ? "admin-panel-broadcasting" : "admin-panel-other-controls"}
        role='tabpanel'
        aria-labelledby={activeTab === "broadcasting" ? "admin-tab-broadcasting" : "admin-tab-other-controls"}
      >
        <h3>{activeTab === "broadcasting" ? "Send a broadcast" : "Send a player message"}</h3>
        <form className='admin-form' onSubmit={send}>
          {activeTab === "other" && (
            <div className='player-combobox' onBlur={() => setListOpen(false)}>
              <label htmlFor='admin-player-input'>Player</label>
              <input
                id='admin-player-input'
                className='input-field'
                role='combobox'
                aria-expanded={listOpen}
                aria-controls='admin-player-list'
                placeholder='Search by character name'
                autoComplete='off'
                value={search}
                onFocus={() => setListOpen(true)}
                onChange={(e) => onPlayerInput(e.target.value)}
              />
              {listOpen && (
                <ul id='admin-player-list' className='player-combobox-list' role='listbox'>
                  {!matches.length && <li className='player-combobox-empty'>No matching players</li>}
                  {matches.map((p) => (
                    <li
                      key={p.uid}
                      role='option'
                      aria-selected={p.uid === to}
                      className={p.uid === to ? "selected" : ""}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickPlayer(p);
                      }}
                    >
                      <PlayerName name={`${p.name} (Lv ${p.level})`} activeTitle={p.activeTitle} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <label>
            Subject
            <input className='input-field' value={subject} maxLength={100} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label>
            Message
            <textarea className='input-field' rows={4} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} />
          </label>
          <div className='admin-attach'>
            <select
              className='input-field'
              aria-label='Attachment type'
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setKey("");
              }}
            >
              {Object.entries(KINDS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            {options && (
              <select className='input-field' value={selectedKey} onChange={(e) => setKey(e.target.value)}>
                {options.map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            )}
            {kind === "custom" && (
              <fieldset className='admin-custom-item'>
                <legend>Custom gear (roll within chosen stat tiers)</legend>
                <label>Item name
                  <input className='input-field' value={custom.name} maxLength={100} onChange={(e) => updateCustom("name", e.target.value)} />
                </label>
                <label>Item slot
                  <select className='input-field' value={custom.slot} onChange={(e) => setCustom((c) => ({ ...c, slot: e.target.value, ability: "", twoHanded: false }))}>
                    {GEAR_SLOT_TYPES.map((slot) => <option key={slot}>{slot}</option>)}
                  </select>
                </label>
                <label>Rarity
                  <select className='input-field' value={custom.rarity} onChange={(e) => updateCustom("rarity", e.target.value)}>
                    {Object.keys(RARITY_COLORS).map((rarity) => <option key={rarity}>{rarity}</option>)}
                  </select>
                </label>
                <label>Condition
                  <select className='input-field' value={custom.condition} onChange={(e) => updateCustom("condition", e.target.value)}>
                    {CONDITION_NAMES.map((condition) => <option key={condition}>{condition}</option>)}
                  </select>
                </label>
                <label>Item level
                  <input className='input-field' type='number' min={1} step={1} value={custom.iLevel} onChange={(e) => updateCustom("iLevel", e.target.value)} />
                </label>
                <label>Item value (astra)
                  <input className='input-field' type='number' min={0} step={1} value={custom.price} onChange={(e) => updateCustom("price", e.target.value)} />
                </label>
                <label>Main stat
                  <select className='input-field' value={custom.stat} onChange={(e) => updateCustom("stat", e.target.value)}>
                    {MAIN_STAT_NAMES.map((stat) => <option key={stat} value={stat}>{STAT_LABELS[stat]}</option>)}
                  </select>
                </label>
                <label>Main stat tier
                  <select className='input-field' value={custom.tier} onChange={(e) => updateCustom("tier", e.target.value)}>
                    {STAT_TIERS.map((tier) => <option key={tier} value={tier}>T{tier}</option>)}
                  </select>
                </label>
                <label>Ability
                  <select className='input-field' value={custom.ability} onChange={(e) => updateCustom("ability", e.target.value)}>
                    <option value=''>None</option>
                    {[...ABILITIES.filter((a) => a.slots.includes(custom.slot)), ...UNIQUE_ABILITIES].map((ability) =>
                      <option key={ability.name} value={ability.name}>{ability.name}</option>)}
                  </select>
                </label>
                {custom.slot === "weapon" && <label>
                  <input type='checkbox' checked={custom.twoHanded} onChange={(e) => updateCustom("twoHanded", e.target.checked)} />
                  Two-handed
                </label>}
                <p>Choose a tier for each stat; leave substats blank to omit. Each copy rolls within the exact chosen tiers when attached, not when claimed. Main stats use the shared 0-22 scale; substats scale with item level and handedness. Unavailable tiers are disabled; changing level or handedness may require reselecting a tier.</p>
                {getSubStatPool(custom.slot).map((stat) => <label key={stat}>
                  {STAT_LABELS[stat]}
                  <select className='input-field' value={customSubStats[stat] ?? ""}
                    onChange={(e) => setCustomSubStats((s) => ({ ...s, [stat]: e.target.value }))}>
                    <option value=''>None</option>
                    {STAT_TIERS.map((tier) => <option key={tier} value={tier}
                      disabled={!getCustomSubStatTiers(stat, Number(custom.iLevel), custom.twoHanded).includes(tier)}>T{tier}</option>)}
                  </select>
                </label>)}
              </fieldset>
            )}
            {(kind === "gear" || kind === "gemstone") && (
              <select className='input-field' value={minRarity} onChange={(e) => setMinRarity(e.target.value)}>
                {RARITY_NAMES.map((r, i) => (
                  <option key={r} value={i}>{r}+</option>
                ))}
              </select>
            )}
            {kind !== "keyItem" && kind !== "title" && (
              <input className='input-field' aria-label='Quantity' type='number' min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
            )}
            {(isGear || kind === "custom") && (
              <label>
                <input type='checkbox' checked={forceHolofoil} onChange={(e) => setForceHolofoil(e.target.checked)} />
                Force holofoil
              </label>
            )}
            {(isGear || kind === "custom") && forceHolofoil && (
              <>
                <label>
                  Holofoil color 1
                  <input className='input-field' placeholder='#RRGGBB' value={color1} onChange={(e) => setColor1(e.target.value)} />
                </label>
                <label>
                  Holofoil color 2
                  <input className='input-field' placeholder='#RRGGBB' value={color2} onChange={(e) => setColor2(e.target.value)} />
                </label>
                <span>Leave both colors blank for random colors.</span>
              </>
            )}
            <button type='button' className='buttons input-button' onClick={addRow}>Attach</button>
          </div>
          {rows.length > 0 && (
            <ul className='admin-rows'>
              {rows.map((r, i) => (
                <li key={i}>
                  {rowLabel(r)}{" "}
                  {Array.isArray(r.holofoil) && `(${r.holofoil.join(" / ")}) `}
                  <button type='button' className='buttons' onClick={() => setRows((all) => all.filter((_, j) => j !== i))}>Remove</button>
                </li>
              ))}
            </ul>
          )}
          <button type='submit' className='buttons input-button' disabled={busy || (activeTab === "other" && !players.length)}>
            {activeTab === "broadcasting" ? "Send to all players" : "Send to player"}
          </button>
          {note && <div className='recipe-note'>{note}</div>}
        </form>
        {activeTab === "broadcasting" && (
          <>
            <h3>Sent broadcasts</h3>
            {!broadcasts.length && <div className='equip-empty'>None sent.</div>}
            <ul className='admin-rows'>
              {broadcasts.map((b) => (
                <li key={b.id}>
                  {b.subject} • {new Date(b.sentAt).toLocaleString()}{" "}
                  <button type='button' className='buttons' onClick={() => removeBroadcast(b.id)}>Delete</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      )}
    </div>
  );
};

export default AdminScreen;
