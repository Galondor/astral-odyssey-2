import { useEffect, useRef } from "react";
import RichText from "./RichText";
import Tooltip from "./Tooltip";

/*
 Game screens. A scene picks one with `screen: "<key>"` (and optional `screenData`); the sidebar can
 also open the ones with `link: true` at any time. To add a screen, add an entry here.
   label     - sidebar text
   link      - always available from the sidebar (otherwise only enabled while a scene uses it)
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

const CharacterScreen = ({ player }) => {
  if (!player) return <div className='panel'>No character yet.</div>;
  const s = player.stats || {};
  const rows = [
    ["Class", player.class],
    ["Level", player.level],
    ["Exp", `${s.exp}/${s.expToLevel}`],
    ["Astra", player.astra],
    ["Region", player.region],
    ["Strength", s.strength],
    ["Dexterity", s.dexterity],
    ["Intelligence", s.intelligence],
    ["Attack", `${s.attackMin}-${s.attackMax}`],
    ["Defense", s.defense],
    ["Speed", s.speed],
    ["Critical chance", `${Math.round((s.criticalHitChance || 0) * 100)}%`],
  ];
  return (
    <div className='panel'>
      <h2>{player.name} the {player.class}</h2>
      <Bar label='Health' value={s.health} max={s.maxHealth} color='#1e8449' />
      <Bar label='Stamina' value={s.stamina} max={s.maxStamina} color='#b7791f' />
      <Bar label='Power' value={s.power} max={s.maxPower} color='#1f5fbf' />
      <div className='stat-grid'>
        {rows.map(([k, v]) => (
          <div key={k} className='stat-row'>
            <span>{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const SCREENS = {
  adventure: { label: "Adventure", link: true, component: AdventureScreen },
  character: { label: "Character", link: true, component: CharacterScreen },
  combat: { label: "Combat", component: CombatScreen },
  crafting: { label: "Crafting", component: CraftingScreen },
};

export const DEFAULT_SCREEN = "adventure";
