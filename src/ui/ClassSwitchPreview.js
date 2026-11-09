import { useEffect, useRef, useState } from "react";
import { getPlayer } from "../character/player";
import { CLASS_TREES } from "../character/mastery";
import { SKILLS } from "../character/skills";
import { cancelClassSwitch, confirmClassSwitch, getClassSwitchPreview, subscribeClassSwitch } from "../character/classSwitch";

export default function ClassSwitchPreview({ onConfirm }) {
  const [, refresh] = useState(0);
  const [error, setError] = useState("");
  const dialog = useRef(null);
  useEffect(() => subscribeClassSwitch(() => { setError(""); refresh((value) => value + 1); }), []);
  const preview = getClassSwitchPreview();
  useEffect(() => {
    if (!preview && !error) return undefined;
    const previous = document.activeElement;
    dialog.current?.querySelector("button")?.focus();
    const keydown = (event) => {
      event.stopImmediatePropagation();
      if (event.key === "Escape") { event.preventDefault(); cancelClassSwitch(); setError(""); }
      if (event.key === "Tab") {
        const buttons = dialog.current?.querySelectorAll("button");
        if (!buttons?.length) return;
        if (event.shiftKey && document.activeElement === buttons[0]) {
          event.preventDefault(); buttons[buttons.length - 1].focus();
        } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
          event.preventDefault(); buttons[0].focus();
        }
      }
    };
    window.addEventListener("keydown", keydown, true);
    return () => { window.removeEventListener("keydown", keydown, true); if (previous?.isConnected) previous.focus(); };
  }, [preview, error]);
  if (!preview && !error) return null;
  return <div className='item-popup-backdrop' style={{ zIndex: 10000 }}>
    <section ref={dialog} className='item-popup' role='dialog' aria-modal='true' aria-label='Class change preview'>
      <h3>Class change preview</h3>
      {preview && <>
        <p><strong>{preview.from} → {preview.to}</strong></p>
        <p>Your class is determined automatically by allocated stats, equipment and permanent bonuses.</p>
        <ul>{["strength", "dexterity", "intelligence"].map((key) => <li key={key}>
          {key}: {preview.before[key] || 0} → {preview.after[key] || 0}
        </li>)}</ul>
        <p>The new class activates its saved mastery and loadout. Other classes' mastery remains saved. Combat resources start empty in the next fight.</p>
        <p>Current equipped skills: {preview.outgoingSkills.map((key) => SKILLS[key]?.name || key).join(", ") || "none"}.</p>
        <p>After switching: {preview.incomingSkills.map((key) => SKILLS[key]?.name || key).join(", ") || "none"}.
          {" "}Techniques from the old class become inactive; shared skills remain learned.</p>
        <p>Active mastery: {preview.mastery.map((id) => CLASS_TREES[preview.to]?.nodes.find((node) => node.id === id)?.name || id).join(", ") || "none"}.</p>
        {CLASS_TREES[preview.to] && <p>Signature: {CLASS_TREES[preview.to].signature.name} (no regular skill slot required).</p>}
        <p>Nothing, including costs or equipment, changes until you confirm.</p>
        <button type='button' className='buttons' onClick={() => {
          const result = confirmClassSwitch();
          if (result.ok) onConfirm?.();
          else setError(result.message || "Couldn't save the class change.");
        }}>Confirm class change</button>
      </>}
      {error && <p role='alert'>{error}</p>}
      <button type='button' className='buttons' onClick={() => { cancelClassSwitch(); setError(""); }}>Cancel</button>
    </section>
  </div>;
}

export function withClassSwitchPreview(Screen) {
  return function PreviewScreen(props) {
    const [revision, refresh] = useState(0);
    return <>
      <Screen key={revision} {...props} player={revision ? getPlayer() : props.player} />
      <ClassSwitchPreview onConfirm={() => { props.onChange?.(); refresh((value) => value + 1); }} />
    </>;
  };
}
