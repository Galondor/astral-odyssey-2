import {
  GATHERING_PROFESSIONS, GATHERING_UNLOCKS, getGathering, getGatheringExpNeeded, getGatheringRates,
} from "../character/gathering";
import { getGatheringConfig } from "../world/gathering";

export default function GatheringProgress({ player, profession }) {
  const definition = GATHERING_PROFESSIONS[profession];
  const { level, exp, attempts } = getGathering(player, profession);
  const rates = getGatheringRates(level);
  const config = getGatheringConfig(player, profession);
  const needed = getGatheringExpNeeded(level);
  const percent = level === 50 ? 100 : Math.min(100, exp / needed * 100);
  const next = GATHERING_UNLOCKS.find((unlock) => unlock.level > level);
  return (
    <section className='profession-progress' aria-label={`${definition.name} progression`}>
      <header className='profession-hero'>
        <div className='profession-level-ring' style={{ "--profession-progress": `${percent}%` }} aria-hidden='true'><span><small>LV</small>{level}</span></div>
        <div className='profession-hero-body'>
          <h3>{definition.name} level {level}{level === 50 ? " (max)" : ""}</h3>
          <p>{definition.description} {attempts} attempts completed.</p>
          <div className='profession-exp-bar' role='progressbar' aria-label={`${definition.name} exp`} aria-valuemin={0} aria-valuemax={level === 50 ? 1 : needed} aria-valuenow={level === 50 ? 1 : exp}><span style={{ width: `${percent}%` }} /></div>
          <p>{level === 50 ? "Mastered" : `${exp} / ${needed} exp`}</p>
        </div>
      </header>
      <p>{config.toolName} · Gathering Power {config.power} · Maximum material tier {config.maxTier}</p>
      <div className='profession-stat-grid'>
        {[["Profession yield", rates.yield], ["Timing tolerance", rates.timing], ["Perfect window", rates.perfect], ["Rarity preference", rates.rarity]].map(([label, value]) => (
          <div className='profession-stat' key={label}><span>{label}</span><strong>+{Math.round(value * 1000) / 10}%</strong></div>
        ))}
      </div>
      {next && <p className='profession-next'>Next: Lv {next.level} - {next.name}</p>}
      <section className='profession-unlock-group' aria-label='Gathering milestones'>
        <h4>Milestones</h4>
        <ul>{GATHERING_UNLOCKS.map((unlock) => (
          <li key={unlock.level} className={`profession-unlock ${level >= unlock.level ? "unlocked" : "locked"}`}>
            <span className='profession-unlock-level'>{unlock.level}</span>
            <span className='profession-unlock-text'><strong>{unlock.name}</strong><span>{unlock.description}</span></span>
          </li>
        ))}</ul>
      </section>
      <p>Every level improves yield and timing tolerance.</p>
    </section>
  );
}
