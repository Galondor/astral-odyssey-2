import {
  getExpToNextLevel,
  getProfession,
  getProfessionMythicChance,
  getProfessionRates,
  getReagentSlots,
  MATERIAL_TIER_LEVELS,
  MAX_PROFESSION_LEVEL,
  PROFESSION_EFFECTS,
  PROFESSIONS,
  REAGENT_SLOT_LEVELS,
} from "../character/professions";
import { getBlueprints } from "../items/craftingBlueprints";
import { REGION_TIERS } from "../items/craftingMaterials";
import { REGIONS } from "../world/regions";

const formatPercent = (value, digits = 1) => `${Math.round(value * 100 * 10 ** digits) / 10 ** digits}%`;

export const buildUnlockGroups = (profession) => {
  const blueprints = getBlueprints(profession);
  return [
    {
      id: "slots",
      title: "Reagent slots",
      entries: REAGENT_SLOT_LEVELS.map((at, index) => ({ level: at, name: `Reagent slot ${index + 1}` })),
    },
    {
      id: "techniques",
      title: "Techniques",
      entries: Object.values(PROFESSION_EFFECTS).map((effect) => ({ level: effect.level, name: effect.name, detail: effect.description })),
    },
    {
      id: "materials",
      title: "Material tiers",
      entries: MATERIAL_TIER_LEVELS.map((at, index) => ({ level: at, name: `Tier ${index + 1}`, detail: REGIONS[REGION_TIERS[index]].name })),
    },
    {
      id: "tools",
      title: "Tool blueprints",
      entries: blueprints.filter((blueprint) => blueprint.kind === "tool").map((blueprint) => ({ level: blueprint.level, name: blueprint.name })),
    },
    {
      id: "uniques",
      title: "Unique recipes",
      unique: true,
      entries: blueprints.filter((blueprint) => blueprint.kind === "unique").map((blueprint) => ({ level: blueprint.level, name: blueprint.name, detail: blueprint.slotLabel })),
    },
    {
      id: "gear",
      title: "Gear blueprints",
      compact: true,
      entries: blueprints.filter((blueprint) => blueprint.kind === "gear").map((blueprint) => ({ level: blueprint.level, name: blueprint.name })),
    },
  ]
    .map((group) => ({ ...group, entries: [...group.entries].sort((a, b) => a.level - b.level) }))
    .filter((group) => group.entries.length);
};

// Progression > Professions > Crafting: level, exp, current rates, and the unlock track.
export default function ProfessionProgress({ player, profession }) {
  const definition = PROFESSIONS[profession];
  const { level, exp, crafts } = getProfession(player, profession);
  const maxed = level >= MAX_PROFESSION_LEVEL;
  const rates = getProfessionRates(level);
  const needed = getExpToNextLevel(level);
  const expPercent = maxed ? 100 : Math.min(100, Math.round((exp / Math.max(1, needed)) * 100));
  const groups = buildUnlockGroups(profession);
  const milestones = groups.filter((group) => !group.compact).flatMap((group) => group.entries.map((entry) => ({ ...entry, group })));
  const nextLevel = milestones.filter((entry) => entry.level > level).reduce((min, entry) => Math.min(min, entry.level), Infinity);
  const nextUnlocks = milestones.filter((entry) => entry.level === nextLevel);
  const trackLevels = [...new Set(milestones.map((entry) => entry.level))].sort((a, b) => a - b);
  const trackPosition = (at) => `${((at - 1) / (MAX_PROFESSION_LEVEL - 1)) * 100}%`;
  const stats = [
    { label: "Reagent slots", value: `${getReagentSlots(level)} / ${REAGENT_SLOT_LEVELS.length}` },
    { label: "Craft quality", value: `+${rates.quality}` },
    { label: "Astra discount", value: formatPercent(rates.astraDiscount) },
    { label: "Discovery", value: formatPercent(rates.discoveryChance) },
    { label: "Mythic chance", value: formatPercent(getProfessionMythicChance(level), 3), mythic: true },
  ];

  return (
    <section className='profession-progress' aria-label={`${definition.name} progression`}>
      <header className='profession-hero'>
        <div className='profession-level-ring' style={{ "--profession-progress": `${expPercent}%` }} aria-hidden='true'>
          <span><small>LV</small>{level}</span>
        </div>
        <div className='profession-hero-body'>
          <div className='profession-hero-title'>
            <h3>{definition.name} level {level}{maxed ? " (max)" : ""}</h3>
            <span className='profession-chip'>{crafts} crafted</span>
          </div>
          <p>{definition.description}</p>
          <div className='profession-exp'>
            <div
              className='profession-exp-bar'
              role='progressbar'
              aria-label={`${definition.name} exp`}
              aria-valuemin={0}
              aria-valuemax={maxed ? 1 : needed}
              aria-valuenow={maxed ? 1 : exp}
            >
              <span style={{ width: `${expPercent}%` }} />
            </div>
            <span className='profession-exp-label'>
              {maxed ? "Mastered" : <>{exp.toLocaleString()} / {needed.toLocaleString()} exp <em>→ Lv {level + 1}</em></>}
            </span>
          </div>
        </div>
      </header>

      {nextUnlocks.length > 0 && (
        <div className='profession-next'>
          <span className='profession-next-label'>Next unlock · Lv {nextLevel}</span>
          <span className='profession-next-items'>
            {nextUnlocks.map((entry) => (
              <span key={`${entry.group.id}-${entry.name}`} className={entry.group.unique ? "crafting-unique" : ""}>{entry.name}</span>
            ))}
          </span>
        </div>
      )}

      <div className='profession-track' aria-hidden='true'>
        <div className='profession-track-line'>
          <span style={{ width: trackPosition(level) }} />
        </div>
        {trackLevels.map((at) => (
          <span
            key={at}
            className={`profession-track-dot ${at <= level ? "reached" : ""} ${at === nextLevel ? "next" : ""}`}
            style={{ left: trackPosition(at) }}
            title={`Level ${at}`}
          />
        ))}
        <span className='profession-track-end start'>1</span>
        <span className='profession-track-end end'>{MAX_PROFESSION_LEVEL}</span>
      </div>

      <div className='profession-stat-grid'>
        {stats.map((stat) => (
          <div key={stat.label} className={`profession-stat ${stat.mythic ? "mythic" : ""}`}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>

      <div className='profession-unlock-groups'>
        {groups.map((group) => {
          const earned = group.entries.filter((entry) => entry.level <= level).length;
          return (
            <section key={group.id} className={`profession-unlock-group ${group.compact ? "compact" : ""}`} aria-label={group.title}>
              <header>
                <h4>{group.title}</h4>
                <span className='profession-chip'>{earned} / {group.entries.length}</span>
              </header>
              <ul>
                {group.entries.map((entry, index) => {
                  const state = entry.level <= level ? "unlocked" : entry.level === nextLevel ? "next" : "locked";
                  return (
                    <li key={index} className={`profession-unlock ${state}`} title={entry.detail}>
                      <span className='profession-unlock-level'>{entry.level}</span>
                      <span className='profession-unlock-text'>
                        <span className={group.unique ? "crafting-unique" : ""}>{entry.name}</span>
                        {entry.detail && !group.compact && <small>{entry.detail}</small>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}
