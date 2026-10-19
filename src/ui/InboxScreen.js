import { useState } from "react";
import {
  claimMessage,
  deleteMessage,
  describeAttachments,
  getMessages,
  hasAttachments,
  hasUnclaimed,
  markRead,
} from "../world/inbox";

const FILTERS = [
  ["all", "All"],
  ["unread", "Unread"],
  ["read", "Read"],
];

const formatDate = (ts) => (ts ? new Date(ts).toLocaleString() : "");

const InboxScreen = ({ inCombat }) => {
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const messages = getMessages();
  const visible = messages.filter((m) => filter === "all" || (filter === "unread" ? !m.read : m.read));
  const selected = messages.find((m) => m.id === selectedId) || null;
  const unread = messages.filter((m) => !m.read).length;

  const open = (m) => {
    setSelectedId(m.id);
    setConfirmId(null);
    setNote("");
    if (!m.read) markRead(m.id);
  };

  const claim = async (m) => {
    setBusy(true);
    const result = await claimMessage(m.id);
    setBusy(false);
    setNote(result.ok ? `Claimed: ${result.lines.join(", ")}.` : result.message);
  };

  const remove = async (m) => {
    await deleteMessage(m.id).catch(() => {});
    setConfirmId(null);
    setSelectedId(null);
    setNote("");
  };

  const requestDelete = (m) => (hasUnclaimed(m) ? setConfirmId(m.id) : remove(m));

  return (
    <div className='panel inbox'>
      <h2>Inbox</h2>
      <div className='inventory-tabs' role='tablist'>
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type='button'
            role='tab'
            aria-selected={filter === key}
            className={`inventory-tab ${filter === key ? "active" : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
            {key === "unread" && ` (${unread})`}
          </button>
        ))}
      </div>
      <div className='inbox-layout'>
        <div className='inbox-list'>
          {!visible.length && <div className='equip-empty'>No messages.</div>}
          {visible.map((m) => (
            <button
              key={m.id}
              type='button'
              className={`inbox-row ${m.read ? "read" : "unread"} ${m.id === selectedId ? "selected" : ""}`}
              onClick={() => open(m)}
            >
              <span className='inbox-subject'>
                {!m.read && <span className='inbox-dot' aria-label='Unread' />}
                {m.subject}
              </span>
              <span className='inbox-meta'>
                {m.from} • {formatDate(m.sentAt)}
                {hasUnclaimed(m) && <span className='inbox-attach'> • Unclaimed items</span>}
              </span>
            </button>
          ))}
        </div>
        <div className='inbox-detail'>
          {!selected && <div className='equip-empty'>Select a message to read it.</div>}
          {selected && (
            <>
              <h3>{selected.subject}</h3>
              <div className='inbox-meta'>
                From {selected.from} • {formatDate(selected.sentAt)}
              </div>
              <div className='inbox-body'>{selected.body}</div>
              {hasAttachments(selected.attachments) && (
                <div className='inbox-attachments'>
                  <div className='recipe-kind'>{selected.claimed ? "Attachments (claimed)" : "Attachments"}</div>
                  <ul>
                    {describeAttachments(selected.attachments).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  {!selected.claimed && (
                    <button type='button' className='buttons input-button' disabled={busy || inCombat} onClick={() => claim(selected)}>
                      Claim
                    </button>
                  )}
                  {!selected.claimed && inCombat && <div className='recipe-kind'>You can't claim during combat.</div>}
                </div>
              )}
              {confirmId === selected.id ? (
                <div className='inbox-confirm'>
                  <div>This message has unclaimed items. Deleting it will lose them forever.</div>
                  <div className='inbox-actions'>
                    <button type='button' className='buttons input-button' onClick={() => remove(selected)}>
                      Delete anyway
                    </button>
                    <button type='button' className='buttons input-button' onClick={() => setConfirmId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className='inbox-actions'>
                  <button type='button' className='buttons input-button' onClick={() => requestDelete(selected)}>
                    Delete
                  </button>
                </div>
              )}
              {note && <div className='recipe-note'>{note}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InboxScreen;
