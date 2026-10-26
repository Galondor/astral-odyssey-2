import { STAT_INFO, getStatBreakdown } from "../character/stats";
import Tooltip from "./Tooltip";
import PlayerName from "./PlayerName";

export const Bar = ({ label, value, max, color }) => (
  <div className='bar'>
    <div className='bar-label'>
      <span>{label}</span>
      <span>{value}/{max}</span>
    </div>
    <div className='bar-track'>
      <div className='bar-fill' style={{
        width: `${max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0}%`,
        background: color,
      }} />
    </div>
  </div>
);

const formatStatValue = (v, format, signed) => {
  const n = format === "percent"
    ? `${Math.round(Math.abs(v) * 1000) / 10}%`
    : Math.round(Math.abs(v) * 1000) / 1000;
  return signed ? `${v < 0 ? "-" : "+"}${n}` : `${v < 0 ? "-" : ""}${n}`;
};

export const statTooltip = (breakdown, keys) => {
  const sections = keys.map((key) => {
    const info = STAT_INFO[key];
    const b = breakdown[key];
    if (!info || !b) return null;
    return {
      title: keys.length > 1 ? info.title : undefined,
      description: keys.length > 1 ? undefined : info.description,
      stats: [
        ...b.lines.map((l, i) => ({
          label: l.label,
          value: formatStatValue(l.value, b.format, i > 0),
        })),
        { label: "Total", value: formatStatValue(b.total, b.format), color: "#ffd479" },
      ],
      footer: info.formula,
    };
  }).filter(Boolean);
  if (!sections.length) return null;
  if (sections.length === 1) return { title: STAT_INFO[keys[0]].title, ...sections[0] };
  return { description: STAT_INFO[keys[0]].description, sections };
};

export default function CharacterSummary({ player }) {
  const s = player.stats || {};
  const rows = [
    ["Attack", `${s.attackMin}-${s.attackMax}`, ["attackMin", "attackMax"]],
    ["Defense", s.defense, ["defense"]],
    ["Magic attack", `${s.magicAttackMin}-${s.magicAttackMax}`, ["magicAttackMin", "magicAttackMax"]],
    ["Strength", s.strength, ["strength"]],
    ["Dexterity", s.dexterity, ["dexterity"]],
    ["Intelligence", s.intelligence, ["intelligence"]],
    ["Vitality", s.vitality, ["vitality"]],
    ["Agility", s.agility, ["agility"]],
    ["Resilience", s.resilience, ["resilience"]],
    ["Critical damage", `${Math.round((s.criticalDamageBonus || 0) * 100)}%`, ["criticalDamageBonus"]],
    ["Evasion", `${Math.round((s.evasion || 0) * 100)}%`, ["evasion"]],
    ["Luck", s.luck, ["luck"]],
    ["Critical chance", `${Math.round((s.criticalHitChance || 0) * 100)}%`, ["criticalHitChance"]],
    ["Speed", s.speed, ["speed"]],
    ["Gear score", s.gearScore || 0, ["gearScore"]],
  ];
  const breakdown = player.stats ? getStatBreakdown(player) : {};
  return (
    <>
      <div className='character-name-heading'>
        <h2><PlayerName name={player.name} activeTitle={player.activeTitle} /></h2>
        <div>{player.class ? `${player.class} · ` : ""}Level {player.level}</div>
      </div>
      {player.stats ? <>
        <h3>Experience {s.exp}/{s.expToLevel}</h3>
        <Bar label='Health' value={s.health} max={s.maxHealth} color='#1e8449' />
        <Bar label='Stamina' value={s.stamina} max={s.maxStamina} color='#b7791f' />
        <Bar label='Power' value={s.power} max={s.maxPower} color='#1f5fbf' />
        <div className='stat-grid'>
          {rows.map(([label, value, keys]) => (
            <Tooltip key={label} content={statTooltip(breakdown, keys)}>
              <div className='stat-row'><span>{label}</span><span>{value}</span></div>
            </Tooltip>
          ))}
        </div>
      </> : <p>Character creation in progress.</p>}
    </>
  );
}
