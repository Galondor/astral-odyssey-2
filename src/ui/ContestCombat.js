import { useEffect, useRef, useState } from "react";
import { getContestStatus, sendContestCommand, subscribeContest } from "../world/contest";
import { getConsumables, consumableTooltip } from "../items/consumables";
import { getEquippedSkills, getSkillLevel, SKILLS, skillCost, skillTooltip } from "../character/skills";
import { STATUSES } from "../combat/statuses";
import Tooltip from "./Tooltip";

export const getContestCombatView = ({ match, uid }) => {
  const fighter = match?.fighters?.[uid];
  const opponent = match?.fighters?.[match.host === uid ? match.guest : match.host];
  if (!fighter || !opponent) return null;
  const stats = opponent.player.stats;
  const messages = [
    { sender: "game", text: `Contest: ${fighter.player.name} vs ${opponent.player.name}. Each turn is narrated from the acting player's perspective.` },
    ...(match.log || []).flatMap((turn) => [
      { sender: "game", text: `${turn.actor}'s turn` },
      ...turn.replies.map((text) => ({ sender: "game", text })),
    ]),
  ];
  if (match.winner) messages.push({
    sender: "game",
    text: `${match.winner === uid
      ? "Victory! You earned 1 Proof of Victory."
      : "Defeat, better luck next time."}${match.reason === "timeout"
      ? " The turn timer expired." : match.reason === "forfeit" ? " The fight ended by forfeit." : ""}`,
  });
  return {
    player: fighter.player,
    messages,
    data: {
      enemy: {
        name: opponent.player.name,
        level: opponent.player.level,
        hp: stats.health,
        maxHp: stats.maxHealth,
        attack: [stats.attackMin, stats.attackMax],
        defense: stats.defense,
        speed: stats.speed,
        critical: stats.criticalHitChance || 0,
        defending: opponent.defending,
        statuses: opponent.statuses || [],
        marrowWard: opponent.combat?.wardMax > 0
          ? { current: opponent.combat.ward, max: opponent.combat.wardMax } : null,
      },
      round: Math.floor((match.revision || 0) / 2) + 1,
      stats: fighter.player.stats,
      defending: fighter.defending,
      playerStatuses: fighter.statuses || [],
      marrowWard: fighter.combat?.wardMax > 0
        ? { current: fighter.combat.ward, max: fighter.combat.wardMax } : null,
    },
  };
};

export default function ContestCombat({ onLeave, navigationModal }) {
  const [, refresh] = useState(0);
  const [menu, setMenu] = useState("combat");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const stop = subscribeContest(() => refresh((value) => value + 1));
    const timer = setInterval(() => refresh((value) => value + 1), 1000);
    return () => { stop(); clearInterval(timer); };
  }, []);
  const status = getContestStatus();
  const { match, uid } = status;
  const fighter = match?.fighters?.[uid];
  const opponent = match?.fighters?.[match.host === uid ? match.guest : match.host];
  const act = async (command) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await sendContestCommand(command);
      setMenu("combat");
    } catch (failure) {
      console.error("Couldn't submit Contest action", failure);
      setError(failure.message || "Couldn't update Contest. Please try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const action = (type, key) => act({ type: "action", action: { type, ...(key ? { key } : {}) } });
  const disabled = busy || status.saving || !status.ready || !status.yourTurn || status.remainingMs === 0;
  const stunned = fighter?.statuses?.some((effect) => STATUSES[effect.id]?.kind === "skip");
  let options = [];
  if (match?.winner) {
    options = [{ label: "Return to Arena", disabled: busy || status.saving, select: onLeave }];
  } else if (fighter) {
    const back = { label: "Back", select: () => setMenu("combat") };
    if (menu === "skills") {
      options = [back, ...getEquippedSkills(fighter.player).map((key) => ({
        label: SKILLS[key].name,
        tooltip: skillTooltip(key, getSkillLevel(fighter.player, key), "Takes your turn", fighter.player),
        disabled: disabled || stunned || fighter.player.stats.power < skillCost(fighter.player, key),
        select: () => action("skill", key),
      }))];
    } else if (menu === "items") {
      options = [back, ...getConsumables(fighter.player).filter((item) => item.heal || item.power).map((item) => ({
        label: `${item.name} x${item.count}`,
        tooltip: consumableTooltip(item.key, "Takes your turn"),
        disabled: disabled || stunned,
        select: () => action("consume", item.key),
      }))];
    } else {
      options = [
        { label: "Melee Attack", select: () => action("melee") },
        { label: "Magic Attack", select: () => action("magic") },
        { label: "Defend", select: () => action("defend") },
        { label: "Use Item", select: () => setMenu("items") },
        { label: "Skills", select: () => setMenu("skills") },
        { label: "Pass", select: () => action("pass"), allowStunned: true },
      ].filter((option) => !stunned || option.allowStunned).map((option) => ({ ...option, disabled }));
      options.push({
        label: "Forfeit Contest", disabled: busy || status.saving || !status.ready,
        select: () => act({ type: "forfeit" }),
      });
    }
  }
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
  return <div className='game-controls'>
    {(error || status.error) && <p role='alert'>{error || status.error}</p>}
    {!match?.winner && <p role='status'>{!status.ready ? "Connecting to Contest..." :
      `${status.yourTurn ? "Your turn" : `${opponent?.player.name}'s turn`} - ${Math.ceil(status.remainingMs / 1000)} seconds remaining.`}</p>}
    {menu === "skills" && !match?.winner && <>
      <p>Choose a skill to use.</p>
      {!getEquippedSkills(fighter?.player).length && <p>No skills equipped. Equip learned skills in Progression before joining Contest.</p>}
    </>}
    {menu === "items" && !match?.winner && <p>Choose an item to use.</p>}
    <div className='input-buttons'>
      {options.map((option, index) => <Tooltip key={option.label} content={option.tooltip}>
        <button type='button' className='buttons input-button' disabled={option.disabled} onClick={option.select}>
          {index + 1}. {option.label}
        </button>
      </Tooltip>)}
    </div>
  </div>;
}
