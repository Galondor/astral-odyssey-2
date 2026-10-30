import { useEffect, useRef, useState } from "react";
import { STATUSES, statusLabel, statusTooltip } from "../combat/statuses";
import { SKILLS, skillCost, skillTooltip } from "../character/skills";
import { CONSUMABLES, consumableTooltip } from "../items/consumables";
import { UNIQUES } from "../world/dungeonData";
import { GROUP_DUNGEONS, GROUP_RUN_MS, GROUP_WIPE_PENALTY_MS } from "../world/groupDungeonData";
import { activeMembers } from "../world/groupDungeons";
import { DIAL_NAMES, RING_NAMES, STATIONS, puzzleClues, puzzleControls } from "../world/groupPuzzles";
import {
  GROUP_CHAT_MAX, GROUP_MAX_MEMBERS, clearGroupError, createParty, disbandParty,
  getGroupStatus, invitePlayer, joinParty, kickMember, leaveParty, promoteMember, sendChat, setPartyDungeon,
  setPartyOpen, setReady, startRun, submitIntent, subscribeGroup,
} from "../world/groupParty";
import { Bar } from "./CharacterSummary";
import RichText from "./RichText";
import Tooltip from "./Tooltip";
import { filterChatText } from "../shared/names";

const DUNGEON_LIST = Object.values(GROUP_DUNGEONS).sort((a, b) => a.level - b.level);
const STAGE_KIND_LABELS = ["Entry", "Teamwork", "Challenge", "Boss"];
const formatClock = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};
const RUN_REASONS = {
  victory: "The dungeon was cleared!",
  timeout: `The ${GROUP_RUN_MS / 60000} minute timer ran out and the party was cast out of the instance.`,
  abandoned: "Everyone left the dungeon.",
};

export const useGroupStatus = () => {
  const [, refresh] = useState(0);
  useEffect(() => subscribeGroup(() => refresh((value) => value + 1)), []);
  return getGroupStatus();
};

const StatusChips = ({ list = [] }) => (
  list.length > 0 && <div className='status-chips'>
    {list.map((st, index) => (
      <Tooltip key={`${st.id}-${index}`} content={statusTooltip(st)}>
        <span className={`status-chip ${STATUSES[st.id]?.debuff ? "group-debuff" : ""}`}>{statusLabel(st)}</span>
      </Tooltip>
    ))}
  </div>
);

// ---------------- Lobby (Adventures > Group Dungeons) ----------------

const DungeonCard = ({ dungeon, children }) => (
  <div className='dungeon-card group-dungeon-card' style={{ "--group-color": dungeon.color }}>
    <h3>{dungeon.name}</h3>
    <div className='dungeon-rating'>Dungeon Level {dungeon.level}</div>
    <p>{dungeon.description}</p>
    <ol className='group-stage-list'>
      {dungeon.stages.map((stage, index) => (
        <li key={stage.name}><span className='dungeon-stage-kind'>{STAGE_KIND_LABELS[index]}</span> {stage.name}</li>
      ))}
    </ol>
    <div>Unique drop: <span className='unique-text'>{UNIQUES[dungeon.unique]?.name}</span></div>
    {children}
  </div>
);

const Chat = ({ status, overlay = false, onClose }) => {
  const [text, setText] = useState("");
  const log = useRef(null);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [status.chat.length]);
  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    if (await sendChat(text)) setText("");
  };
  return (
    <div className={`group-chat${overlay ? " group-chat-overlay" : ""}`} role={overlay ? "dialog" : undefined} aria-label={overlay ? "Party chat" : undefined}>
      <div className='group-chat-head'>
        <h4>Party Chat</h4>
        {onClose && (
          <button type='button' className='buttons group-chat-close' aria-label='Close party chat' onClick={onClose}>✕</button>
        )}
      </div>
      <div className='group-chat-log' ref={log} aria-live='polite'>
        {!status.chat.length && <p className='group-muted'>No messages yet.</p>}
        {status.chat.map((msg) => (
          <div key={msg.id} className='group-chat-line'><strong>{msg.name}:</strong> {filterChatText(msg.text)}</div>
        ))}
      </div>
      <form className='group-chat-form' onSubmit={submit}>
        <input
          className='input-field'
          aria-label='Party chat message'
          value={text}
          maxLength={GROUP_CHAT_MAX}
          onChange={(event) => setText(event.target.value)}
          placeholder='Message your party...'
        />
        <button type='submit' className='buttons' disabled={status.pending || !text.trim()}>Send</button>
      </form>
    </div>
  );
};

const RunResult = ({ status }) => {
  const { run } = status;
  if (!run || run.status === "active") return null;
  const dungeon = GROUP_DUNGEONS[run.dungeon];
  return (
    <div className={`group-result ${run.status}`}>
      <h4>Last run: {dungeon?.name} {run.status === "cleared" ? "cleared" : "failed"}</h4>
      <p>{RUN_REASONS[run.reason] || ""} Stages cleared: {run.stagesCleared || 0}/4. Wipes: {run.wipes || 0}.</p>
      {run.members.includes(status.identity) && status.claimLines.length > 0 && (
        <div className='group-claim'>{status.claimLines.map((line, index) => <div key={index}><RichText text={line} /></div>)}</div>
      )}
      {status.unclaimed.length > 0 && (
        <p className='group-muted'>Waiting for {status.unclaimed.map((id) => run.names[id]).join(", ")} to collect rewards...</p>
      )}
    </div>
  );
};

const PartyLobby = ({ status, player }) => {
  const [invite, setInvite] = useState("");
  const { party, dungeon, isLeader, members, run } = status;
  const me = members.find((m) => m.id === status.identity);
  const tooLow = (player?.level || 1) < dungeon.level;
  const doInvite = async (event) => {
    event.preventDefault();
    if (await invitePlayer(invite)) setInvite("");
  };
  return (
    <div className='group-party'>
      <div className='group-party-main'>
        <div className='group-party-header'>
          <h3>Your Party</h3>
          {isLeader ? (
            <label className='group-dungeon-select'>
              Dungeon{" "}
              <select
                value={party.dungeon}
                disabled={status.pending || status.active}
                onChange={(event) => setPartyDungeon(event.target.value)}
              >
                {DUNGEON_LIST.map((d) => <option key={d.id} value={d.id}>{d.name} (Level {d.level})</option>)}
              </select>
            </label>
          ) : <span>Dungeon: <strong>{dungeon.name}</strong> (Level {dungeon.level})</span>}
        </div>
        <ul className='group-roster'>
          {members.map((m) => (
            <li key={m.id} className={`group-roster-member ${m.ready ? "ready" : ""}`}>
              <span className={`group-online ${m.online ? "on" : ""}`} role='img' aria-label={m.online ? "Online" : "Offline"} />
              <span className='group-roster-name'>{m.leader ? "★ " : ""}{m.name}</span>
              <span>Level {m.level}</span>
              <span className='group-roster-ready'>{m.ready ? "Ready" : "Not ready"}</span>
              {isLeader && m.id !== status.identity && !status.active && (
                <span className='group-roster-actions'>
                  <button type='button' className='buttons' disabled={status.pending} onClick={() => promoteMember(m.id)}>Promote</button>
                  <button type='button' className='buttons' disabled={status.pending} onClick={() => kickMember(m.id)}>Kick</button>
                </span>
              )}
            </li>
          ))}
          {Array.from({ length: GROUP_MAX_MEMBERS - members.length }, (_, index) => (
            <li key={`empty-${index}`} className='group-roster-member empty'>Open slot</li>
          ))}
        </ul>
        <div className='group-party-controls'>
          {me && (
            <button
              type='button'
              className='buttons'
              disabled={status.pending || status.active || (!me.ready && tooLow)}
              onClick={() => setReady(!me.ready)}
            >
              {me.ready ? "Unready" : tooLow ? `Level ${dungeon.level}+` : "Ready Up"}
            </button>
          )}
          {isLeader && (
            <Tooltip content={status.startBlocker ? { title: "Can't start yet", description: [status.startBlocker] } : null}>
              <button type='button' className='buttons group-start' disabled={status.pending || !!status.startBlocker} onClick={startRun}>
                Enter Dungeon
              </button>
            </Tooltip>
          )}
          {isLeader && (
            <label className='group-toggle'>
              <input type='checkbox' checked={!!party.open} disabled={status.pending} onChange={(event) => setPartyOpen(event.target.checked)} />
              {" "}Listed on the Looking for Group board
            </label>
          )}
          <button type='button' className='buttons' disabled={status.pending} onClick={leaveParty}>Leave Party</button>
          {isLeader && members.length > 1 && (
            <button type='button' className='buttons' disabled={status.pending || status.active} onClick={disbandParty}>Disband</button>
          )}
        </div>
        {isLeader && members.length < GROUP_MAX_MEMBERS && (
          <form className='group-invite' onSubmit={doInvite}>
            <input
              className='input-field'
              aria-label='Character name to invite'
              value={invite}
              onChange={(event) => setInvite(event.target.value)}
              placeholder='Invite a character by name'
            />
            <button type='submit' className='buttons' disabled={status.pending || !invite.trim()}>Invite</button>
          </form>
        )}
        {status.isLeader && status.startBlocker && !status.active && <p className='group-muted'>{status.startBlocker}</p>}
        {status.active && !status.inRun && <p className='dungeon-warning'>Your party is inside {GROUP_DUNGEONS[run.dungeon]?.name}.</p>}
        <RunResult status={status} />
      </div>
      <Chat status={status} />
    </div>
  );
};

export const GroupLobby = ({ player }) => {
  const status = useGroupStatus();
  const level = player?.level || 1;
  return (
    <div className='group-lobby'>
      <p className='dungeon-rules'>
        Team up with up to {GROUP_MAX_MEMBERS} players. Every dungeon has 4 stages with a checkpoint after each one and a
        {" "}{GROUP_RUN_MS / 60000} minute timer.<br />If the whole party falls you respawn at the last checkpoint, but the timer loses
        {" "}{GROUP_WIPE_PENALTY_MS / 60000} minutes. If time runs out, the run fails and the party is removed from the dungeon.
      </p>
      {status.error && (
        <p className='dungeon-warning' role='alert'>
          {status.error} <button type='button' className='buttons group-dismiss' onClick={clearGroupError}>Dismiss</button>
        </p>
      )}
      {!status.connected && <p role='status'>Connecting to the group service...</p>}
      {status.invites.length > 0 && (
        <p className='group-muted' role='status'>
          You have {status.invites.length === 1 ? "a party invitation" : `${status.invites.length} party invitations`} waiting in the Social tab.
        </p>
      )}
      {status.party && status.dungeon ? <PartyLobby status={status} player={player} /> : (
        <>
          <div className='dungeon-offers group-dungeons'>
            {DUNGEON_LIST.map((dungeon) => (
              <DungeonCard key={dungeon.id} dungeon={dungeon}>
                <button
                  type='button'
                  className='buttons'
                  disabled={status.pending || !status.connected || level < dungeon.level}
                  onClick={() => createParty(dungeon.id)}
                >
                  {level < dungeon.level ? `Level ${dungeon.level}+` : "Form a Party"}
                </button>
              </DungeonCard>
            ))}
          </div>
          <div className='group-lfg'>
            <h3>Looking for Group</h3>
            {!status.lfg.length && <p className='group-muted'>No parties are looking for members right now.</p>}
            {status.lfg.map((listing) => {
              const dungeon = GROUP_DUNGEONS[listing.dungeon];
              const locked = level < (dungeon?.level || 0);
              return (
                <div key={listing.id} className='group-invite-row'>
                  <span><strong>{listing.leaderName}</strong>'s party: {dungeon?.name} ({listing.size}/{GROUP_MAX_MEMBERS})</span>
                  <button type='button' className='buttons' disabled={status.pending || locked || !status.connected} onClick={() => joinParty(listing.id)}>
                    {locked ? `Level ${dungeon.level}+` : "Join"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// ---------------- Run screen ----------------

const EnemyCard = ({ enemy }) => (
  <div className={`group-enemy ${enemy.dead ? "dead" : ""} tier-${enemy.tier}`}>
    <div className='group-enemy-head'>
      <strong>{enemy.name}</strong>
      <span className='group-muted'> Lv {enemy.level}{enemy.tier !== "basic" ? ` [${enemy.tier}]` : ""}{enemy.defending ? " (Defending)" : ""}</span>
    </div>
    <Bar label='HP' value={Math.max(0, enemy.hp)} max={enemy.maxHp} color='#c0392b' />
    {enemy.immune && !enemy.dead && <div className='group-tag immune'>Immune to {enemy.immune} damage</div>}
    {enemy.pending && !enemy.dead && <div className='group-tag telegraph'>Winding up {enemy.pending.name}! Defend or Guard!</div>}
    {enemy.channel && !enemy.dead && (
      <div className='group-tag channel'>
        Channeling {enemy.channel.name}: deal {Math.max(0, enemy.channel.need - enemy.channel.dealt)} more damage or stun it
        ({enemy.channel.rounds} round{enemy.channel.rounds === 1 ? "" : "s"} left)
      </div>
    )}
    {enemy.rewind && !enemy.dead && (
      <div className='group-tag channel'>
        Rewinding time: deal {Math.max(0, enemy.rewind.need - enemy.rewind.dealt)} more damage to break it
        ({enemy.rewind.rounds} round{enemy.rewind.rounds === 1 ? "" : "s"} left)
      </div>
    )}
    {enemy.linkGroup && !enemy.dead && <div className='group-tag'>Linked shard: all shards must fall within two rounds</div>}
    {!enemy.dead && <StatusChips list={enemy.statuses} />}
  </div>
);

const MemberCard = ({ member, run, intentIn, me }) => {
  const left = run.left[member.id];
  const guarding = member.guarding && run.party[member.guarding];
  return (
    <div className={`group-member ${member.downed ? "downed" : ""} ${me ? "me" : ""}`}>
      <div className='group-member-head'>
        <strong>{member.name}</strong>
        <span className='group-muted'> Lv {member.level}{member.cls ? ` ${member.cls}` : ""}</span>
        {run.status === "active" && !member.downed && !left && (
          <span className={`group-intent ${intentIn ? "in" : ""}`}>{intentIn ? "✔ Ready" : "Choosing..."}</span>
        )}
      </div>
      {left ? <div className='group-muted'>Left the dungeon</div> : (
        <>
          <Bar label='Health' value={Math.max(0, member.stats.health)} max={member.stats.maxHealth} color='#1e8449' />
          <Bar label='Power' value={member.stats.power} max={member.stats.maxPower} color='#1f5fbf' />
          {member.downed && <div className='group-tag downed'>Fallen, revived at the next checkpoint</div>}
          {member.defending && <div className='group-tag'>Defending</div>}
          {guarding && <div className='group-tag'>Guarding {guarding.name}</div>}
          <StatusChips list={member.statuses} />
        </>
      )}
    </div>
  );
};

const PuzzlePanel = ({ run, identity }) => {
  const { puzzle } = run;
  const members = activeMembers(run);
  if (puzzle.kind === "stations")
    return (
      <div className='group-puzzle'>
        <h4>The bosun's order</h4>
        <p className='group-order'>{puzzle.order?.text}</p>
        <p>Man <strong>exactly</strong> the called stations, one hand each is enough. Anyone at another station fouls the lines.</p>
        <p>Orders completed: {puzzle.step}/{puzzle.goal} · Strikes: {puzzle.strikes}/{puzzle.maxStrikes}</p>
      </div>
    );
  if (puzzle.kind === "dials") {
    const clues = puzzleClues(puzzle, members, identity);
    const mine = puzzleControls(members, identity);
    return (
      <div className='group-puzzle'>
        <h4>The Synchron Lock</h4>
        <div className='group-dials'>
          {puzzle.values.map((value, index) => (
            <div key={index} className={`group-dial ${mine.includes(index) ? "mine" : ""}`}>
              <span>Dial {DIAL_NAMES[index]}</span>
              <strong>{value}</strong>
              <small>{run.names[members[index % members.length]]}</small>
            </div>
          ))}
        </div>
        <p>Each dial goes from 0 to 5. Only you can read your clue{clues.length === 1 ? "" : "s"}. Share {clues.length === 1 ? "it" : "them"} in party chat:</p>
        <ul className='group-clues'>{clues.map((clue) => <li key={clue}>{clue}</li>)}</ul>
        <p>
          Attempts: {puzzle.attempts}/{puzzle.maxAttempts}
          {typeof puzzle.last === "number" ? ` · Last try: ${puzzle.last} of 3 dials correct` : ""}
        </p>
      </div>
    );
  }
  const mine = puzzleControls(members, identity);
  return (
    <div className='group-puzzle'>
      <h4>The Constellation Bridge</h4>
      <div className='group-dials'>
        {puzzle.offsets.map((offset, index) => (
          <div key={index} className={`group-dial ${mine.includes(index) ? "mine" : ""} ${offset === 0 ? "aligned" : ""}`}>
            <span>{RING_NAMES[index]}</span>
            <strong>{offset === 0 ? "Aligned" : `${offset} off`}</strong>
            <small>{run.names[members[index % members.length]]}</small>
          </div>
        ))}
      </div>
      <p>
        Each ring has {puzzle.notches} notches. Turning a ring also drags the <strong>next</strong> ring
        ({RING_NAMES[0]} → {RING_NAMES[1]} → {RING_NAMES[2]} → {RING_NAMES[0]}) by the same amount. Every ring must read Aligned at the end of a round.
      </p>
      <p>Rounds: {puzzle.round}/{puzzle.maxRounds}</p>
    </div>
  );
};

export const GroupRunScreen = () => {
  const status = useGroupStatus();
  const log = useRef(null);
  const { run } = status;
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [run?.log?.length, run?.revision]);
  if (!run) return <div className='panel'><p role='status'>Loading the dungeon...</p></div>;
  const dungeon = GROUP_DUNGEONS[run.dungeon];
  const stage = dungeon.stages[run.stage];
  const enemies = (run.combat?.enemies || []).filter((enemy) => !enemy.hidden && !enemy.dead);
  return (
    <div className='panel group-run' style={{ "--group-color": dungeon.color }}>
      <div className='group-run-header'>
        <h2>{dungeon.name}</h2>
        <div className={`dungeon-timer ${status.remainingMs < 3 * 60 * 1000 ? "low" : ""}`} role='timer' aria-label='Dungeon time left'>
          Time left: {formatClock(status.remainingMs)}
        </div>
      </div>
      <div className='group-run-sub'>
        Stage {run.stage + 1}: {stage.name} · Round {run.round}
        {run.wipes > 0 ? ` · Wipes: ${run.wipes}` : ""}
        {run.combat?.objective?.survive ? ` · Survive ${Math.max(0, run.combat.objective.survive - run.combat.round + 1)} more round(s)` : ""}
      </div>
      <div className='group-battlefield'>
        <div className='group-side'>
          <h4>Party</h4>
          {run.members.map((id) => run.party[id] && (
            <MemberCard key={id} member={run.party[id]} run={run} intentIn={status.intentsIn[id]} me={id === status.identity} />
          ))}
        </div>
        <div className='group-side'>
          {run.puzzle ? <PuzzlePanel run={run} identity={status.identity} /> : (
            <>
              <h4>Enemies</h4>
              {enemies.map((enemy) => <EnemyCard key={enemy.uid} enemy={enemy} />)}
            </>
          )}
        </div>
      </div>
      <div className='log group-log' ref={log}>
        {run.log.map((line, index) => <div key={index} className='message game'><RichText text={line} /></div>)}
      </div>
    </div>
  );
};

// ---------------- Run actions (game controls area) ----------------

const intentLabel = (intent, run) => {
  if (!intent) return "";
  const who = (id) => run.party[id]?.name || "yourself";
  const enemy = (uid) => run.combat?.enemies?.find((e) => e.uid === uid)?.name;
  switch (intent.type) {
    case "melee": return `Melee Attack${enemy(intent.target) ? ` on ${enemy(intent.target)}` : ""}`;
    case "magic": return `Magic Attack${enemy(intent.target) ? ` on ${enemy(intent.target)}` : ""}`;
    case "skill": {
      const skill = SKILLS[intent.key];
      if (skill?.type === "support") return `${skill.name}${skill.target === "ally" ? ` on ${who(intent.target)}` : ""}`;
      return `${skill?.name || "Skill"}${enemy(intent.target) ? ` on ${enemy(intent.target)}` : ""}`;
    }
    case "item": return `${CONSUMABLES[intent.key]?.name || "Item"} on ${who(intent.target)}`;
    case "defend": return "Defend";
    case "guard": return `Guard ${who(intent.target)}`;
    case "station": return `Man the ${STATIONS[intent.key]}`;
    case "dial": return "Set dials";
    case "ring": return "Turn rings";
    default: return "Pass";
  }
};

const PuzzleSetter = ({ run, identity, kind, disabled }) => {
  const members = activeMembers(run);
  const mine = puzzleControls(members, identity);
  const max = kind === "dial" ? 5 : run.puzzle.notches - 1;
  const [values, setValues] = useState(() => Object.fromEntries(mine.map((index) => [index, kind === "dial" ? run.puzzle.values[index] : 0])));
  if (!mine.length) return <p className='group-muted'>You don't control any {kind === "dial" ? "dials" : "rings"} this round.</p>;
  const submit = () => submitIntent(kind === "dial" ? { type: "dial", values } : { type: "ring", turns: values });
  return (
    <div className='group-setter'>
      {mine.map((index) => (
        <label key={index}>
          {kind === "dial" ? `Dial ${DIAL_NAMES[index]}` : `Turn ${RING_NAMES[index]}`}{" "}
          <select
            value={values[index] ?? 0}
            disabled={disabled}
            onChange={(event) => setValues({ ...values, [index]: Number(event.target.value) })}
          >
            {Array.from({ length: max + 1 }, (_, n) => <option key={n} value={n}>{n}{kind === "ring" ? " notches" : ""}</option>)}
          </select>
        </label>
      ))}
      <button type='button' className='buttons input-button' disabled={disabled} onClick={submit}>Lock In</button>
    </div>
  );
};

const chatSeen = { partyId: Symbol("unset"), ids: new Set() };

export const GroupRunActions = ({ navigationModal }) => {
  const status = useGroupStatus();
  const [menu, setMenu] = useState({ view: "main" });
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { run, identity } = status;
  const [, markRead] = useState(0);
  // Seen messages are tracked by id (not sender timestamps, which come from each player's own clock) and survive remounts.
  if (chatSeen.partyId !== status.partyId) {
    chatSeen.partyId = status.partyId;
    chatSeen.ids = new Set(status.chat.map((msg) => msg.id));
  }
  const unseen = status.chat.filter((msg) => !chatSeen.ids.has(msg.id) && msg.from !== identity);
  useEffect(() => {
    if (!chatOpen || !unseen.length) return;
    for (const msg of unseen) chatSeen.ids.add(msg.id);
    markRead((n) => n + 1);
  }, [chatOpen, unseen]);
  const unreadChat = chatOpen ? 0 : unseen.length;
  const roundKey = run ? `${run.id}:${run.stage}:${run.round}` : "";
  useEffect(() => {
    setMenu({ view: "main" });
  }, [roundKey]);
  const me = run?.party?.[identity];
  const living = run?.combat ? run.members.filter((id) => run.party[id] && !run.party[id].downed && !run.left[id]) : [];
  const targets = (run?.combat?.enemies || []).filter((enemy) => !enemy.dead && !enemy.hidden);
  const disabled = status.pending || !status.connected || !run || run.status !== "active";
  const stunned = me?.statuses?.some((st) => STATUSES[st.id]?.kind === "skip");
  const send = async (intent) => {
    if (await submitIntent(intent)) setMenu({ view: "main" });
  };
  const back = { label: "Back", select: () => setMenu({ view: "main" }) };
  const pickEnemy = (intent) => {
    if (targets.length <= 1) return send({ ...intent, target: targets[0]?.uid || null });
    return setMenu({ view: "enemy", intent });
  };
  const pickAlly = (intent, { excludeSelf = false } = {}) => setMenu({ view: "ally", intent, excludeSelf });

  let options = [];
  let prompt = "";
  if (run && me && run.status === "active") {
    if (run.puzzle?.kind === "stations") {
      prompt = "Choose your station for this order.";
      options = [
        ...Object.entries(STATIONS).map(([key, name]) => ({ label: name, select: () => send({ type: "station", key }) })),
        { label: "Stand Back", select: () => send({ type: "pass" }) },
      ];
    } else if (run.combat && me.downed) {
      prompt = "You have fallen. You'll be revived at the next checkpoint if your party clears the stage.";
    } else if (run.combat && menu.view === "enemy" && targets.length) {
      prompt = "Choose a target.";
      options = [back, ...targets.map((enemy) => ({
        label: `${enemy.name} (${Math.max(0, enemy.hp)}/${enemy.maxHp})${enemy.immune ? ` [immune: ${enemy.immune}]` : ""}`,
        select: () => send({ ...menu.intent, target: enemy.uid }),
      }))];
    } else if (run.combat && menu.view === "ally") {
      prompt = menu.intent.type === "guard" ? "Choose an ally to guard. Enemy attacks on them hit you instead." : "Choose who to help.";
      options = [back, ...living.filter((id) => !menu.excludeSelf || id !== identity).map((id) => {
        const ally = run.party[id];
        return {
          label: `${id === identity ? "Yourself" : ally.name} (${ally.stats.health}/${ally.stats.maxHealth})`,
          select: () => send({ ...menu.intent, target: id }),
        };
      })];
    } else if (run.combat && menu.view === "skills") {
      prompt = "Choose a skill.";
      const player = { class: me.cls, stats: me.stats, skills: me.skills };
      options = [back, ...(me.equipped || []).filter((key) => SKILLS[key]).map((key) => {
        const skill = SKILLS[key];
        const cost = skillCost(player, key);
        return {
          label: `${skill.name} (${cost} power)`,
          tooltip: skillTooltip(key, me.skills[key] || 0, "Takes your action this round", player),
          disabled: me.stats.power < cost,
          select: () => {
            const intent = { type: "skill", key };
            if (skill.type !== "support") return pickEnemy(intent);
            if (skill.target === "ally" && living.length > 1) return pickAlly(intent);
            return send({ ...intent, target: identity });
          },
        };
      })];
      if (options.length === 1) prompt = "No skills equipped. Equip skills in Progression before your next run.";
    } else if (run.combat && menu.view === "items") {
      prompt = "Choose an item. You can use it on an ally.";
      options = [back, ...Object.entries(me.consumables || {}).map(([key, count]) => [key, count - (me.spent?.[key] || 0)])
        .filter(([key, left]) => left > 0 && CONSUMABLES[key]).map(([key, left]) => ({
          label: `${CONSUMABLES[key].name} x${left}`,
          tooltip: consumableTooltip(key, "Takes your action this round"),
          select: () => (living.length > 1 ? pickAlly({ type: "item", key }) : send({ type: "item", key, target: identity })),
        }))];
      if (options.length === 1) prompt = "You have no usable potions left.";
    } else if (run.combat) {
      prompt = stunned ? "You are stunned and can only pass this round." : "Choose your action for this round.";
      options = stunned ? [{ label: "Pass", select: () => send({ type: "pass" }) }] : [
        { label: "Melee Attack", select: () => pickEnemy({ type: "melee" }) },
        { label: "Magic Attack", select: () => pickEnemy({ type: "magic" }) },
        { label: "Skills", select: () => setMenu({ view: "skills" }) },
        { label: "Use Item", select: () => setMenu({ view: "items" }) },
        { label: "Defend", select: () => send({ type: "defend" }) },
        ...(living.length > 1 ? [{ label: "Guard an Ally", select: () => pickAlly({ type: "guard" }, { excludeSelf: true }) }] : []),
        { label: "Pass", select: () => send({ type: "pass" }) },
      ];
    }
  }
  options = options.map((option) => ({ ...option, disabled: disabled || option.disabled }));

  useEffect(() => {
    if (navigationModal) return undefined;
    const selectByNumber = (event) => {
      if (!/^[1-9]$/.test(event.key) || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      const option = options[Number(event.key) - 1];
      if (!option || option.disabled) return;
      event.preventDefault();
      option.select();
    };
    window.addEventListener("keydown", selectByNumber);
    return () => window.removeEventListener("keydown", selectByNumber);
  });

  if (!run) return <div className='game-controls'><p role='status'>Loading the dungeon...</p></div>;
  const waitingFor = run.members.filter((id) => !run.left[id] && (run.puzzle || !run.party[id]?.downed) && !status.intentsIn[id]);
  return (
    <div className='game-controls group-controls'>
      {status.error && <p role='alert'>{status.error}</p>}
      <p role='status'>
        {!status.connected ? "Reconnecting..." : `Round ${run.round}: ${formatClock(status.roundRemainingMs)} left to choose. `}
        {status.myIntent ? `Locked in: ${intentLabel(status.myIntent, run)}. ` : ""}
        {waitingFor.length ? `Waiting for ${waitingFor.map((id) => (id === identity ? "you" : run.names[id])).join(", ")}.` : "Resolving..."}
      </p>
      {prompt && <p>{prompt}</p>}
      {(run.puzzle?.kind === "dials" || run.puzzle?.kind === "rings") && (
        <PuzzleSetter
          key={roundKey}
          run={run}
          identity={identity}
          kind={run.puzzle.kind === "dials" ? "dial" : "ring"}
          disabled={disabled}
        />
      )}
      <div className='input-buttons'>
        {options.map((option, index) => (
          <Tooltip key={`${menu.view}-${index}`} content={option.tooltip}>
            <button type='button' className='buttons input-button' disabled={option.disabled} onClick={option.select}>
              {index + 1}. {option.label}
            </button>
          </Tooltip>
        ))}
        <button
          type='button'
          className='buttons input-button group-chat-toggle'
          aria-expanded={chatOpen}
          onClick={() => setChatOpen((open) => !open)}
        >
          {chatOpen ? "Hide Chat" : "Chat"}
          {unreadChat > 0 && (
            <span className='group-chat-dot' role='img' aria-label={`${unreadChat} new messages`}>{unreadChat > 9 ? "9+" : unreadChat}</span>
          )}
        </button>
        {confirmLeave ? (
          <>
            <button type='button' className='buttons input-button group-leave' disabled={status.pending} onClick={leaveParty}>
              Confirm: leave run and party (no rewards)
            </button>
            <button type='button' className='buttons input-button' onClick={() => setConfirmLeave(false)}>Stay</button>
          </>
        ) : (
          <button type='button' className='buttons input-button group-leave' disabled={status.pending} onClick={() => setConfirmLeave(true)}>
            Leave Run
          </button>
        )}
      </div>
      {chatOpen && <Chat status={status} overlay onClose={() => setChatOpen(false)} />}
    </div>
  );
};
