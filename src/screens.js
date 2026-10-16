import { useEffect, useRef, useState } from "react";
import { getPlayer } from "./player";
import { RARITY_COLORS, SLOTS, canEquip, equipItem, itemTooltip, unequipItem } from "./items";
import { STAT_INFO, getStatBreakdown } from "./stats";
import { getUnspentPoints, spendStatPoint } from "./progression";
import RichText from "./RichText";
import Tooltip from "./Tooltip";

/*
 Game screens. A scene picks one with `screen: "<key>"` (and optional `screenData`); the sidebar can
 also open the ones with `link: true` at any time. To add a screen, add an entry here.
   label     - sidebar text
   link      - always available from the sidebar (otherwise only enabled while a scene uses it)
   hideUnlessActive - hidden from the sidebar unless a scene is using it (highlighted when shown)
   badge     - (player) => number, shown as a notification on the tab when above 0
   component - React component receiving { messages, data, player }
*/
const Log = ({ messages, limit }) => {
  const ref = useRef(null);
  const shown = limit ? messages.slice(-limit) : messages;
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);
  return (
    <div className='log' ref={ref}>
      {shown.map((m, i) => (
        <div key={i} className='message game'>
          <RichText text={m.text} />
        </div>
      ))}
    </div>
  );
};

const Bar = ({ label, value, max, color }) => (
  <div className='bar'>
    <div className='bar-label'>
      <span>{label}</span>
      <span>{value}/{max}</span>
    </div>
    <div className='bar-track'>
      <div className='bar-fill' style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color }} />
    </div>
  </div>
);

const AdventureScreen = ({ messages }) => <Log messages={messages} />;

const CombatScreen = ({ messages, data }) => {
  const { enemy, stats } = data || {};
  return (
    <div className='screen-split'>
      <div className='combat-arena'>
        <div className='combatant'>
          <h3>{enemy ? enemy.name : "No enemy"}</h3>
          {enemy && <Bar label='HP' value={enemy.hp} max={enemy.maxHp} color='#c0392b' />}
        </div>
        <div className='combat-vs'>VS</div>
        <div className='combatant'>
          <h3>You</h3>
          {stats && (
            <>
              <Bar label='Health' value={stats.health} max={stats.maxHealth} color='#1e8449' />
              <Bar label='Stamina' value={stats.stamina} max={stats.maxStamina} color='#b7791f' />
              <Bar label='Power' value={stats.power} max={stats.maxPower} color='#1f5fbf' />
            </>
          )}
        </div>
      </div>
      <Log messages={messages} limit={6} />
    </div>
  );
};

const CraftingScreen = ({ messages, data }) => {
  const { recipes = [], astra = 0 } = data || {};
  return (
    <div className='screen-split'>
      <div className='recipes'>
        <h3>Forge <span className='recipe-astra'>{astra} astra</span></h3>
        {recipes.map((r) => (
          <Tooltip key={r.name} content={{ title: r.name, description: r.description, stats: [{ label: "Cost", value: `${r.cost} astra`, color: astra >= r.cost ? "#7bd88f" : "#ff6b6b" }] }}>
            <div className={`recipe ${astra >= r.cost ? "" : "unaffordable"}`}>
              <strong>{r.name}</strong>
              <span>{r.description}</span>
              <span>{r.cost} astra</span>
            </div>
          </Tooltip>
        ))}
      </div>
      <Log messages={messages} limit={6} />
    </div>
  );
};

const Equipment = ({ player, onChange, locked }) => {
  const equipment = player.equipment || {};
  return (
    <div className='equip-section'>
      <div className='equip-col'>
        <h3>Equipment</h3>
        <div className='equip-slots'>
          {SLOTS.map((slot) => {
            const slotItem = equipment[slot.key];
            const item = slotItem?.twoHandedOf ? equipment[slotItem.twoHandedOf] : slotItem;
            const content = item ? itemTooltip(item, locked ? "Can't change gear in combat" : "Click to unequip") : { title: slot.label, description: "Empty" };
            return (
              <Tooltip key={slot.key} content={content}>
                <button
                  type='button'
                  className={`equip-slot ${item ? "filled" : ""}`}
                  disabled={!item || locked}
                  onClick={() => { unequipItem(slot.key); onChange(); }}
                >
                  <span className='equip-slot-label'>{slot.label}</span>
                  <span className='equip-slot-item' style={item ? { color: RARITY_COLORS[item.rarity] } : undefined}>{item ? item.name : "Empty"}</span>
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Inventory = ({ player, onChange, locked }) => {
  const inventory = player.inventory || [];
  return (
    <div className='inventory-panel'>
      <div className='equip-col'>
        <h3>
          <span>Inventory <span className='equip-count'>{inventory.length}</span></span>
        </h3>
        {inventory.length === 0 && <div className='equip-empty'>Your pack is empty.</div>}
        <div className='inventory-list'>
          {inventory.map((item, i) => (
            <Tooltip key={item.id || i} content={itemTooltip(item, locked ? "Can't change gear in combat" : "Click to equip")}>
              <button type='button' disabled={locked} className={`inventory-item ${canEquip(item, player.level) ? "" : "too-high"}`} onClick={() => { equipItem(i); onChange(); }}>
                <strong style={{ color: RARITY_COLORS[item.rarity] }}>{item.name}</strong>
              </button>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
};

const formatStatValue = (v, format, signed) => {
  const n = format === "percent" ? `${Math.round(Math.abs(v) * 1000) / 10}%` : Math.round(Math.abs(v) * 1000) / 1000;
  return signed ? `${v < 0 ? "-" : "+"}${n}` : `${v < 0 ? "-" : ""}${n}`;
};

// Tooltip for a stat row: what it does, the formula, and the live calculation lines. A row can cover several keys (e.g. min/max).
const statTooltip = (breakdown, keys) => {
  const sections = keys.map((key) => {
    const info = STAT_INFO[key];
    const b = breakdown[key];
    if (!info || !b) return null;
    return {
      title: keys.length > 1 ? info.title : undefined,
      description: keys.length > 1 ? undefined : info.description,
      stats: [
        ...b.lines.map((l, i) => ({ label: l.label, value: formatStatValue(l.value, b.format, i > 0) })),
        { label: "Total", value: formatStatValue(b.total, b.format), color: "#ffd479" },
      ],
      footer: info.formula,
    };
  }).filter(Boolean);
  if (!sections.length) return null;
  if (sections.length === 1) return { title: STAT_INFO[keys[0]].title, ...sections[0] };
  return { description: STAT_INFO[keys[0]].description, sections };
};

const CharacterScreen = ({ player: initial, inCombat }) => {
  const [player, setPlayerState] = useState(initial);
  const refresh = () => setPlayerState(getPlayer());
  if (!player) return <div className='panel'>No character yet.</div>;
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
  ];
  const breakdown = getStatBreakdown(player);
  return (
    <div className='panel character-layout'>
      <div className='character-main'>
        <h2>{player.name} the {player.class}, Level {player.level}</h2>
        <h3>Experience {s.exp}/{s.expToLevel}</h3>
        <Bar label='Health' value={s.health} max={s.maxHealth} color='#1e8449' />
        <Bar label='Stamina' value={s.stamina} max={s.maxStamina} color='#b7791f' />
        <Bar label='Power' value={s.power} max={s.maxPower} color='#1f5fbf' />
        <div className='stat-grid'>
          {rows.map(([k, v, keys]) => (
            <Tooltip key={k} content={statTooltip(breakdown, keys)}>
              <div className='stat-row'>
                <span>{k}</span>
                <span>{v}</span>
              </div>
            </Tooltip>
          ))}
        </div>
        <Equipment player={player} onChange={refresh} locked={inCombat} />
      </div>
      <Inventory player={player} onChange={refresh} locked={inCombat} />
    </div>
  );
};

const CORE_STAT_ROWS = [
  ["strength", "Strength"],
  ["dexterity", "Dexterity"],
  ["intelligence", "Intelligence"],
];

const ProgressionScreen = ({ player: initial, inCombat, onChange }) => {
  const [player, setPlayerState] = useState(initial);
  if (!player) return <div className='panel'>No character yet.</div>;
  const statPoints = player.statPoints || 0;
  const skillPoints = player.skillPoints || 0;
  const breakdown = getStatBreakdown(player);
  const spend = (key) => {
    if (spendStatPoint(key).ok) {
      setPlayerState(getPlayer());
      onChange?.();
    }
  };
  return (
    <div className='panel progression'>
      <h2>Progression</h2>
      <h3>Level {player.level}</h3>
      {inCombat && <div className='progression-locked'>You can't spend points during combat.</div>}
      <h3>Stat points: <span className={statPoints ? "points-available" : ""}>{statPoints}</span></h3>
      <div className='stat-grid'>
        {CORE_STAT_ROWS.map(([key, label]) => (
          <Tooltip key={key} content={statTooltip(breakdown, [key])}>
            <div className='stat-row'>
              <span>{label}</span>
              <span>
                {player.stats?.[key]}{" "}
                <button type='button' className='spend-button' disabled={inCombat || statPoints < 1} onClick={() => spend(key)}>+</button>
              </span>
            </div>
          </Tooltip>
        ))}
      </div>
      <h3>Skill points: <span className={skillPoints ? "points-available" : ""}>{skillPoints}</span></h3>
      <div className='equip-empty'>Skills will be available here in a future update. You earn a skill point every other level.</div>
    </div>
  );
};

export const SCREENS = {
  adventure: { label: "Adventure", link: true, component: AdventureScreen },
  character: { label: "Character", link: true, component: CharacterScreen },
  progression: { label: "Progression", link: true, component: ProgressionScreen, badge: (p) => getUnspentPoints(p) },
  combat: { label: "Combat", component: CombatScreen, hideUnlessActive: true },
  crafting: { label: "Crafting", component: CraftingScreen, hideUnlessActive: true },
};

export const DEFAULT_SCREEN = "adventure";
