import { useEffect, useRef } from "react";

export default function QuickGuide({ open, onClose }) {
  const dialog = useRef(null);

  useEffect(() => {
    const element = dialog.current;
    if (open) element.showModal();
    else if (element.open) element.close();
    return () => {
      if (element.open) element.close();
    };
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className='quick-guide-dialog'
      aria-labelledby='quick-guide-title'
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id='quick-guide-title'>Welcome, adventurer!</h2>
      <p className='quick-guide-intro'>Quick tips to get you going.</p>
      <div className='quick-guide-tips'>
        <section>
          <h3>Travel</h3>
          <p>Choose Travel from Gameplay to spend 1 Stamina and encounter the world. Fights can earn astra, materials, and gear.</p>
        </section>
        <section>
          <h3>Loot &amp; gear</h3>
          <p>Check Character to compare your loot and equip better gear. Stronger equipment improves your stats.</p>
        </section>
        <section>
          <h3>Town</h3>
          <p>Use Lodging (for astra) to restore health, stamina, and power. Town also has supplies, crafting, and gear-selling services.</p>
        </section>
        <section>
          <h3>Combat turns</h3>
          <p>Solo and PvP turns have one Action and one Quick Action, in either order. Potions, Renewal, and Provoke are Quick Actions. You can spend your Action on a second Quick Action instead. Each skill can be used once per turn. Choose End Turn to forfeit unused slots.</p>
          <p>Watch for Preparing heavy attacks, Defend against them, and exploit Recovery. Your next Travel begins an interactive training fight once per character. Group combat keeps one action per round: potions and all skills cost that action.</p>
        </section>
        <section>
          <h3>Class mastery</h3>
          <p>Your allocated stats, gear, and permanent bonuses determine your class. Check class-change previews before committing changes. All seven classes have mastery trees in Progression: gain 1 mastery point immediately and another every 5 levels. Each class remembers its own choices using the same budget; only your current tree is active. Reset mastery for free outside combat.</p>
          <p>Swordsmen build Resolve by defending or guarding and blocking, then spend it on Resolve Strike. Spellblades alternate melee and magic attacks to build Weave for Fusion Strike, or spend it defensively with Runic Guard. Signatures have their own slot but cost an Action, even with Quick Reflexes. Class techniques share your ordinary skill slots. Combat resources reset for a new encounter, not between waves.</p>
          <p>Tacticians survey with Defend or Guard, or exploit defending/debuffed enemies, to build Advantage for Precision Strike. Spellcasters build Instability with magic: more damage, but higher spell costs; Arcane Release vents it for burst, while Stabilize turns it into protection. Basic magic remains free.</p>
          <p>Duelists prepare Riposte Stance against the next ordinary hit and earn Tempo for their next melee action; a missed read costs an attack opportunity, and committed group telegraphs cannot be parried. Tricksters prepare Tricks through damaging actions, then choose Cash Out for burst or Sabotage for control. Specialists rotate offense, protection, and support to build Adaptation for a stronger-attack Improvise that also heals. Repeating different attacks is still the same offense role.</p>
        </section>
        <section>
          <h3>Adventures</h3>
          <p>Solo dungeons unlock at level 12. They have a 5-minute time limit, so get ready before you enter. More challenges open as you level up.</p>
        </section>
      </div>
      <button type='button' className='buttons quick-guide-close' autoFocus onClick={onClose}>Start exploring</button>
    </dialog>
  );
}
