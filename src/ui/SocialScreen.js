import { useEffect, useState } from "react";
import { GROUP_DUNGEONS } from "../world/groupDungeonData";
import { GROUP_MAX_MEMBERS, acceptInvite, clearGroupError, declineInvite, inviteToParty } from "../world/groupParty";
import {
  acceptFriendRequest, clearSocialMessages, declineFriendRequest, getSocialStatus, markSocialSeen, removeFriend,
  sendFriendRequest, subscribeSocial,
} from "../world/social";
import { useGroupStatus } from "./GroupDungeonScreen";

const GROUP_MIN_LEVEL = Math.min(...Object.values(GROUP_DUNGEONS).map((dungeon) => dungeon.level));

const useSocialStatus = () => {
  const [, refresh] = useState(0);
  useEffect(() => subscribeSocial(() => refresh((value) => value + 1)), []);
  return getSocialStatus();
};

const SocialScreen = ({ player, onNavigate }) => {
  const social = useSocialStatus();
  const group = useGroupStatus();
  const [name, setName] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [joined, setJoined] = useState(false);
  const [note, setNote] = useState("");
  const busy = social.pending || group.pending;
  const level = player?.level || 1;
  const latest = Math.max(0, ...social.requests.map((entry) => entry.at), ...group.invites.map((entry) => entry.at));

  useEffect(() => {
    markSocialSeen();
  }, [latest]);
  useEffect(() => () => {
    clearSocialMessages();
    clearGroupError();
  }, []);

  const addFriend = async (event) => {
    event.preventDefault();
    if (await sendFriendRequest(name)) setName("");
  };
  const accept = async (id) => {
    if (await acceptInvite(id)) setJoined(true);
  };

  const partyFull = group.members.length >= GROUP_MAX_MEMBERS;
  const inviteBlocker = (friend) => {
    if (group.party) {
      if (!group.isLeader) return "Only your party leader can invite players.";
      if (group.party.members?.[friend.id]) return "Already in your party.";
      if (partyFull) return "Your party is full.";
      if (group.run?.status === "active") return "You can't invite players during a run.";
      return null;
    }
    if (level < GROUP_MIN_LEVEL) return `Group dungeons unlock at level ${GROUP_MIN_LEVEL}.`;
    return null;
  };

  return (
    <div className='panel social'>
      <h2>Social</h2>
      {social.error && <p className='dungeon-warning' role='alert'>{social.error}</p>}
      {group.error && <p className='dungeon-warning' role='alert'>{group.error}</p>}
      {social.notice && <p role='status'>{social.notice}</p>}
      {note && !group.error && <p role='status'>{note}</p>}

      <section className='social-section'>
        <h3>Party Invitations</h3>
        {joined && group.partyId && (
          <p role='status'>
            You joined the party.{" "}
            <button type='button' className='buttons' onClick={() => onNavigate?.("dungeons")}>Go to Group Dungeons</button>
          </p>
        )}
        {!group.invites.length && <p className='group-muted'>No party invitations.</p>}
        {group.invites.map((invite) => {
          const dungeon = GROUP_DUNGEONS[invite.dungeon];
          const locked = level < (dungeon?.level || 0);
          return (
            <div key={invite.id} className='group-invite-row'>
              <span><strong>{invite.from}</strong> invites you to {dungeon?.name || "a group dungeon"}{dungeon ? ` (Level ${dungeon.level})` : ""}.</span>
              <button
                type='button'
                className='buttons'
                disabled={busy || !!group.partyId || locked || !group.connected}
                title={group.partyId ? "Leave your current party first." : locked ? `Requires level ${dungeon.level}.` : undefined}
                onClick={() => accept(invite.id)}
              >
                {locked ? `Level ${dungeon.level}+` : "Accept"}
              </button>
              <button type='button' className='buttons' disabled={busy} onClick={() => declineInvite(invite.id)}>Decline</button>
            </div>
          );
        })}
      </section>

      <section className='social-section'>
        <h3>Friend Requests</h3>
        {!social.requests.length && <p className='group-muted'>No pending friend requests.</p>}
        {social.requests.map((request) => (
          <div key={request.id} className='group-invite-row'>
            <span><strong>{request.name}</strong> wants to be your friend.</span>
            <button type='button' className='buttons' disabled={busy} onClick={() => acceptFriendRequest(request.id)}>Accept</button>
            <button type='button' className='buttons' disabled={busy} onClick={() => declineFriendRequest(request.id)}>Decline</button>
          </div>
        ))}
      </section>

      <section className='social-section'>
        <h3>Friends ({social.friends.length})</h3>
        <form className='group-invite' onSubmit={addFriend}>
          <input
            className='input-field'
            aria-label='Character name to add as a friend'
            value={name}
            maxLength={64}
            onChange={(event) => setName(event.target.value)}
            placeholder='Add a friend by character name'
          />
          <button type='submit' className='buttons' disabled={busy || !name.trim()}>Send Request</button>
        </form>
        {!social.friends.length && <p className='group-muted'>You haven't added any friends yet.</p>}
        {social.friends.map((friend) => {
          const blocker = inviteBlocker(friend);
          return (
            <div key={friend.id} className='group-invite-row social-friend'>
              <span>
                <span className={`social-presence ${friend.online ? "online" : ""}`} aria-hidden='true' />
                <strong>{friend.name}</strong> <span className='group-muted'>{friend.online ? "Online" : "Offline"}</span>
              </span>
              <button
                type='button'
                className='buttons'
                disabled={busy || !!blocker || !group.connected}
                title={blocker || undefined}
                onClick={async () => {
                  if (await inviteToParty(friend.name)) setNote(`Party invitation sent to ${friend.name}.`);
                }}
              >
                Invite to Party
              </button>
              {confirmRemove === friend.id ? (
                <>
                  <button type='button' className='buttons group-leave' disabled={busy} onClick={async () => {
                    await removeFriend(friend.id);
                    setConfirmRemove(null);
                  }}>Confirm Remove</button>
                  <button type='button' className='buttons' onClick={() => setConfirmRemove(null)}>Keep</button>
                </>
              ) : (
                <button type='button' className='buttons' disabled={busy} onClick={() => setConfirmRemove(friend.id)}>Remove</button>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
};

export default SocialScreen;
