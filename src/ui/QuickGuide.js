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
      <p className='quick-guide-intro'>Four quick tips to get you going.</p>
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
          <h3>Adventures</h3>
          <p>Solo dungeons unlock at level 12. They have a 5-minute time limit, so get ready before you enter. More challenges open as you level up.</p>
        </section>
      </div>
      <button type='button' className='buttons quick-guide-close' autoFocus onClick={onClose}>Start exploring</button>
    </dialog>
  );
}
