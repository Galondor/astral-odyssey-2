import { useState } from "react";

const TABS = [["pvp", "PvP"], ["pve", "PvE"], ["bossRush", "Boss Rush"]];

export default function ArenaScreen() {
  const [tab, setTab] = useState("pvp");

  return (
    <section className='panel arena'>
      <h2>Arena</h2>
      <div className='inventory-tabs' role='tablist' aria-label='Arena'>
        {TABS.map(([key, label]) => (
          <button
            key={key}
            id={`arena-tab-${key}`}
            type='button'
            role='tab'
            aria-selected={tab === key}
            aria-controls='arena-panel'
            className={`inventory-tab ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div id='arena-panel' role='tabpanel' aria-labelledby={`arena-tab-${tab}`}>
        <p>Coming soon</p>
      </div>
    </section>
  );
}
