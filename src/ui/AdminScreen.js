import { useEffect, useState } from "react";
import { CONSUMABLES, KEY_ITEMS } from "../items/consumables";
import { GEAR_SLOT_TYPES, RARITY_NAMES } from "../items/items";
import { MATERIALS } from "../items/materials";
import { UNIQUES } from "../world/dungeonData";
import { deleteBroadcast, describeAttachments, getBroadcasts, getDirectory, sendMessage } from "../world/inbox";
import { resolveBugReport, subscribeBugReports } from "../world/bugReports";

const KINDS = {
  astra: { label: "Astra" },
  exp: { label: "Experience" },
  material: { label: "Material", options: Object.entries(MATERIALS).map(([k, v]) => [k, v.name]) },
  consumable: { label: "Consumable", options: Object.entries(CONSUMABLES).map(([k, v]) => [k, v.name]) },
  keyItem: { label: "Key item", options: Object.entries(KEY_ITEMS).map(([k, v]) => [k, v.name]) },
  gear: { label: "Random gear", options: GEAR_SLOT_TYPES.map((s) => [s, s]) },
  unique: { label: "Unique item", options: Object.entries(UNIQUES).map(([k, v]) => [k, v.name]) },
  gemstone: { label: "Random gemstone" },
};

// Collapses the picked rows into the attachments shape stored on a message.
const buildAttachments = (rows) => {
  const out = { astra: 0, exp: 0, materials: {}, consumables: {}, keyItems: {}, gear: [], uniques: [], gemstones: [] };
  for (const r of rows) {
    if (r.kind === "astra") out.astra += r.amount;
    else if (r.kind === "exp") out.exp += r.amount;
    else if (r.kind === "material") out.materials[r.key] = (out.materials[r.key] || 0) + r.amount;
    else if (r.kind === "consumable") out.consumables[r.key] = (out.consumables[r.key] || 0) + r.amount;
    else if (r.kind === "keyItem") out.keyItems[r.key] = true;
    else if (r.kind === "gear") out.gear.push({ slot: r.key, minRarity: r.minRarity, count: r.amount });
    else if (r.kind === "unique") out.uniques.push({ id: r.key, count: r.amount });
    else out.gemstones.push({ minRarity: r.minRarity, count: r.amount });
  }
  return out;
};

const rowLabel = (r) => describeAttachments(buildAttachments([r]))[0];

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
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [bugsNote, setBugsNote] = useState("");

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

  const playerLabel = (p) => `${p.name} - ${p.uid}`;
  const [listOpen, setListOpen] = useState(false);
  const term = search.trim().toLowerCase();
  const matches = players.filter(
    (p) => !term || String(p.name).toLowerCase().includes(term) || String(p.uid).toLowerCase().includes(term)
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

  const addRow = () => {
    const n = Math.max(1, Math.floor(Number(amount) || 0));
    setRows((r) => [...r, { kind, key: selectedKey, amount: n, minRarity: Number(minRarity) }]);
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
                  {report.playerName} ({report.uid}) · {report.createdAt ? new Date(report.createdAt).toLocaleString() : "Unknown date"}
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
                placeholder='Search by name or ID'
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
                      {p.name} (Lv {p.level}) - {p.uid}
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
            {(kind === "gear" || kind === "gemstone") && (
              <select className='input-field' value={minRarity} onChange={(e) => setMinRarity(e.target.value)}>
                {RARITY_NAMES.map((r, i) => (
                  <option key={r} value={i}>{r}+</option>
                ))}
              </select>
            )}
            {kind !== "keyItem" && (
              <input className='input-field' type='number' min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
            )}
            <button type='button' className='buttons input-button' onClick={addRow}>Attach</button>
          </div>
          {rows.length > 0 && (
            <ul className='admin-rows'>
              {rows.map((r, i) => (
                <li key={i}>
                  {rowLabel(r)}{" "}
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
