import { useEffect, useRef, useState } from "react";
import { getPlayer, setPlayer } from "../character/player";
import {
  RARITY_COLORS,
  SLOTS,
  buyBackGear,
  buyGearTraderItem,
  canEquip,
  equipItem,
  getGearTraderStock,
  getSellPrice,
  itemComparisonTooltip,
  itemTooltip,
  sellEquippedItem,
  sellInventoryItem,
  unequipItem,
} from "../items/items";
import {
  KEY_ITEMS,
  consumableTooltip,
  getConsumables,
  getKeyItems,
  getKeyItemEffect,
  keyItemTooltip,
  drinkConsumable,
} from "../items/consumables";
import {
  MATERIAL_TIERS,
  MATERIALS,
  getMaterialCount,
  getMaterials,
  materialTooltip,
} from "../items/materials";
import {
  RECIPES,
  craft,
  canAfford,
  getCraftedCount,
  getRecipeCost,
  isMaxed,
} from "../items/workshop";
import { statusLabel, statusTooltip } from "../combat/statuses";
import { enemyAbilityTooltip, TIERS } from "../combat/enemies";
import { CLASSES, classTooltip } from "../character/classes";
import {
  MAX_EQUIPPED,
  SKILLS,
  equipSkill,
  getEquippedSkills,
  getSkillLevel,
  levelUpSkill,
  skillTooltip,
  unequipSkill,
} from "../character/skills";
import { STAT_INFO, getStatBreakdown } from "../character/stats";
import { getUnspentPoints, spendStatPoint } from "../character/progression";
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
      <span>
        {value}/{max}
      </span>
    </div>
    <div className='bar-track'>
      <div
        className='bar-fill'
        style={{
          width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`,
          background: color,
        }}
      />
    </div>
  </div>
);

const AdventureScreen = ({ messages }) => <Log messages={messages} />;

const CombatScreen = ({ messages, data, player }) => {
  const { enemy, stats, defending, playerStatuses = [] } = data || {};
  const analyzerUnlocked = getKeyItemEffect(player, "analyzer") > 0;
  const tier = enemy ? TIERS[enemy.tier] : null;
  const chips = (list) => (
    <div className='status-chips'>
      {list.map((st) => (
        <Tooltip key={st.id} content={statusTooltip(st)}>
          <span className='status-chip'>{statusLabel(st)}</span>
        </Tooltip>
      ))}
    </div>
  );
  return (
    <div className='screen-split'>
      <div className='combat-arena'>
        <div className='combatant'>
          <h3>
            {enemy ? enemy.name : "No enemy"}
            {enemy
              ? ` Level ${enemy.level}${enemy.defending ? " (Defending)" : ""}${tier && enemy.tier !== "basic" ? ` [${enemy.tier}]` : ""}`
              : ""}
          </h3>
          {enemy && (
            <Bar
              label='HP'
              value={enemy.hp}
              max={enemy.maxHp}
              color='#c0392b'
            />
          )}
          {enemy && chips(enemy.statuses || [])}
          {analyzerUnlocked && enemy?.abilities?.length > 0 && (
            <div className='enemy-abilities'>
              Abilities:{" "}
              {enemy.abilities.map((ability, index) => (
                <Tooltip
                  key={`${ability.name}-${index}`}
                  content={enemyAbilityTooltip(ability)}
                >
                  <span className='tip-word' tabIndex={0}>
                    {ability.name}
                    {index < enemy.abilities.length - 1 ? " • " : ""}
                  </span>
                </Tooltip>
              ))}
            </div>
          )}
          {analyzerUnlocked && (
            <div className='combatant-stats'>
              <h4>
                Attack
                <br />
                {enemy ? enemy.attack.join(" - ") : "-"}
              </h4>
              <h4>
                Defense
                <br />
                {enemy ? enemy.defense : "-"}
              </h4>
              <h4>
                Speed
                <br />
                {enemy ? enemy.speed : "-"}
              </h4>
              <h4>
                Critical
                <br />
                {enemy ? `${enemy.critical * 100}%` : "-"}
              </h4>
            </div>
          )}
        </div>
        <div className='combat-vs'>VS</div>
        <div className='combatant'>
          <h3>You{defending ? " (Defending)" : ""}</h3>
          {stats && (
            <>
              <Bar
                label='Health'
                value={stats.health}
                max={stats.maxHealth}
                color='#1e8449'
              />
              <Bar
                label='Stamina'
                value={stats.stamina}
                max={stats.maxStamina}
                color='#b7791f'
              />
              <Bar
                label='Power'
                value={stats.power}
                max={stats.maxPower}
                color='#1f5fbf'
              />
              {chips(playerStatuses)}
            </>
          )}
        </div>
      </div>
      <Log messages={messages} limit={6} />
    </div>
  );
};

const CraftingScreen = ({ data, onChange }) => {
  const [note, setNote] = useState("");
  const player = getPlayer() || data?.player || {};
  const make = (key) => {
    const result = craft(player, key);
    if (result.ok) {
      setPlayer(result.patch);
      onChange();
    }
    setNote(result.message);
  };
  return (
    <div className='workshop'>
      <h3>
        Workshop <span className='recipe-astra'>{player.astra || 0} astra</span>
      </h3>
      <div className='recipe-grid'>
        {Object.entries(RECIPES).map(([key, r]) => {
          const maxed = isMaxed(player, key);
          const cost = getRecipeCost(player, key);
          const affordable = canAfford(player, key);
          return (
            <Tooltip
              key={key}
              content={{
                title: r.name,
                subtitle: r.type === "key" ? "Key Item" : "Permanent Upgrade",
                description: r.description || KEY_ITEMS[r.item]?.description,
              }}
            >
              <button
                type='button'
                disabled={maxed}
                onClick={() => make(key)}
                className={`recipe ${maxed ? "maxed" : affordable ? "" : "unaffordable"}`}
              >
                <strong>{r.name}</strong>
                <span className='recipe-kind'>
                  {r.type === "key"
                    ? "Key Item"
                    : `Upgrade ${getCraftedCount(player, key)}/${r.limit}`}
                </span>
                <span>{r.description || KEY_ITEMS[r.item]?.description}</span>
                {maxed ? (
                  <span className='recipe-cost'>
                    {r.type === "key" ? "Owned" : "Maxed"}
                  </span>
                ) : (
                  <span className='recipe-cost'>
                    <span
                      style={{
                        color:
                          (player.astra || 0) >= cost.astra
                            ? "#7bd88f"
                            : "#ff6b6b",
                      }}
                    >
                      {cost.astra} astra
                    </span>
                    {Object.entries(cost.materials).map(([m, n]) => (
                      <span
                        key={m}
                        style={{
                          color:
                            getMaterialCount(player, m) >= n
                              ? "#7bd88f"
                              : "#ff6b6b",
                        }}
                      >{` • ${n} ${MATERIALS[m].name} (${getMaterialCount(player, m)})`}</span>
                    ))}
                  </span>
                )}
              </button>
            </Tooltip>
          );
        })}
      </div>
      <div className='recipe-note'>
        <RichText text={note || "Click a recipe to craft it."} />
      </div>
    </div>
  );
};

const GearTraderScreen = ({ data, onChange }) => {
  const [tab, setTab] = useState("sell");
  const [note, setNote] = useState("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const player = getPlayer() || data?.player || {};
  const refresh = () => {
    onChange?.();
  };
  const act = (action, index) => {
    const result = action(index);
    if (result.ok) {
      setNote(`${result.item.name}: ${result.price ?? result.value} astra.`);
      refresh();
    } else {
      setNote(
        result.reason === "astra"
          ? `You need ${result.price} astra for that gear.`
          : "That gear can no longer be traded.",
      );
    }
  };

  useEffect(() => {
    const refreshHourlyStock = () => {
      getGearTraderStock();
      onChangeRef.current?.();
    };
    const now = Date.now();
    const untilNextHour = 3600000 - (now % 3600000);
    let interval;
    const timeout = window.setTimeout(() => {
      refreshHourlyStock();
      interval = window.setInterval(refreshHourlyStock, 3600000);
    }, untilNextHour);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  const inventory = player.inventory || [];
  const equipped = Object.entries(player.equipment || {}).filter(
    ([, item]) => item && !item.twoHandedOf,
  );
  const buyback = player.gearTraderBuyback || [];
  const stock = getGearTraderStock(player);
  const gearButton = (item, label, key, onClick, disabled = false) => (
    <Tooltip key={key} content={itemComparisonTooltip(item, label)}>
      <button
        type='button'
        className='inventory-item'
        disabled={disabled}
        onClick={onClick}
      >
        <strong style={{ color: RARITY_COLORS[item.rarity] }}>
          {item.name}
        </strong>
        <span>{label}</span>
      </button>
    </Tooltip>
  );

  return (
    <div className='workshop gear-trader'>
      <h3>
        Gear Trader{" "}
        <span className='recipe-astra'>{player.astra || 0} astra</span>
      </h3>
      <div className='inventory-tabs' role='tablist' aria-label='Gear trader'>
        {[
          ["sell", "Sell Gear"],
          ["buyback", "Buy Back"],
          ["buy", "Buy Gear"],
        ].map(([key, label]) => (
          <button
            key={key}
            type='button'
            role='tab'
            aria-selected={tab === key}
            className={`inventory-tab ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "sell" && (
        <div className='gear-trader-list'>
          {!inventory.length && !equipped.length && (
            <div className='equip-empty'>You have no gear to sell.</div>
          )}
          <div className='inventory-list'>
            {inventory.map((item, index) =>
              gearButton(
                item,
                `Sell for ${getSellPrice(item) ?? 0} astra • `,
                item.id || `pack-${index}`,
                () => act(sellInventoryItem, index),
              ),
            )}
            {equipped.map(([slot, item]) =>
              gearButton(
                item,
                `Sell for ${getSellPrice(item) ?? 0} astra • Equipped `,
                item.id || slot,
                () => {
                  const result = sellEquippedItem(slot);
                  if (result.ok) {
                    setNote(`${result.item.name}: ${result.value} astra.`);
                    refresh();
                  } else {
                    setNote("That gear can no longer be traded.");
                  }
                },
              ),
            )}
          </div>
        </div>
      )}
      {tab === "buyback" && (
        <div className='gear-trader-list'>
          {!buyback.length && (
            <div className='equip-empty'>
              No recently sold gear is available to buy back.
            </div>
          )}
          <div className='inventory-list'>
            {buyback.map(({ item, price }, index) =>
              gearButton(
                item,
                `Buy back for ${price} astra`,
                item.id || `buyback-${index}`,
                () => act(buyBackGear, index),
                (player.astra || 0) < price,
              ),
            )}
          </div>
        </div>
      )}
      {tab === "buy" && (
        <div className='gear-trader-list'>
          <div className='recipe-note'>
            New randomly generated gear arrives every hour.
          </div>
          {!stock.length && (
            <div className='equip-empty'>This hour's stock has sold out.</div>
          )}
          <div className='inventory-list'>
            {stock.map((item, index) =>
              gearButton(
                item,
                `Buy for ${item.price} astra`,
                item.id || `stock-${index}`,
                () => act(buyGearTraderItem, index),
                (player.astra || 0) < item.price,
              ),
            )}
          </div>
        </div>
      )}
      <div className='recipe-note'>
        {note ||
          "Hover over gear to inspect its stats, then click it to trade."}
      </div>
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
            const item = slotItem?.twoHandedOf
              ? equipment[slotItem.twoHandedOf]
              : slotItem;
            const content = item
              ? itemTooltip(
                  item,
                  locked ? "Can't change gear in combat" : "Click to unequip ",
                )
              : { title: slot.label, description: "Empty" };
            return (
              <Tooltip key={slot.key} content={content}>
                <button
                  type='button'
                  className={`equip-slot ${item ? "filled" : ""}`}
                  disabled={!item || locked}
                  onClick={() => {
                    unequipItem(slot.key);
                    onChange();
                  }}
                >
                  <span className='equip-slot-label'>{slot.label}</span>
                  <span
                    className='equip-slot-item'
                    style={
                      item ? { color: RARITY_COLORS[item.rarity] } : undefined
                    }
                  >
                    {item ? item.name : "Empty"}
                  </span>
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const INVENTORY_TABS = [
  { key: "gear", label: "Gear" },
  { key: "consumables", label: "Consumables" },
  { key: "materials", label: "Materials" },
  { key: "keyItems", label: "Key Items" },
];

const Inventory = ({ player, onChange, locked }) => {
  const [tab, setTab] = useState("gear");
  const gear = player.inventory || [];
  const consumables = getConsumables(player);
  const keyItems = getKeyItems(player);
  const materials = getMaterials(player);
  const counts = {
    gear: gear.length,
    consumables: consumables.reduce((n, c) => n + c.count, 0),
    materials: materials.reduce((n, m) => n + m.count, 0),
    keyItems: keyItems.length,
  };
  const use = (key) => {
    drinkConsumable(key);
    onChange();
  };
  return (
    <div className='inventory-panel'>
      <div className='equip-col'>
        <h3>
          <span>Inventory</span>
        </h3>
        <div className='inventory-tabs' role='tablist'>
          {INVENTORY_TABS.map((t) => (
            <button
              key={t.key}
              type='button'
              role='tab'
              aria-selected={tab === t.key}
              className={`inventory-tab ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label} <span className='equip-count'>{counts[t.key]}</span>
            </button>
          ))}
        </div>
        {tab === "gear" && (
          <>
            {gear.length === 0 && (
              <div className='equip-empty'>You have no gear in your pack.</div>
            )}
            <div className='inventory-list'>
              {gear.map((item, i) => (
                <Tooltip
                  key={item.id || i}
                  content={() =>
                    itemComparisonTooltip(
                      item,
                      locked
                        ? "Can't change gear in combat"
                        : "Click to equip ",
                    )
                  }
                >
                  <button
                    type='button'
                    disabled={locked}
                    className={`inventory-item ${canEquip(item, player.level) ? "" : "too-high"}`}
                    onClick={() => {
                      equipItem(i);
                      onChange();
                    }}
                  >
                    <strong style={{ color: RARITY_COLORS[item.rarity] }}>
                      {item.name}
                    </strong>
                  </button>
                </Tooltip>
              ))}
            </div>
          </>
        )}
        {tab === "consumables" && (
          <>
            {consumables.length === 0 && (
              <div className='equip-empty'>You have no consumables.</div>
            )}
            <div className='inventory-list'>
              {consumables.map((c) => (
                <Tooltip
                  key={c.key}
                  content={consumableTooltip(
                    c.key,
                    locked ? "Use items from the combat menu" : "Click to use ",
                  )}
                >
                  <button
                    type='button'
                    disabled={locked}
                    className='inventory-item'
                    onClick={() => use(c.key)}
                  >
                    <strong>
                      {c.name} x{c.count}
                    </strong>
                  </button>
                </Tooltip>
              ))}
            </div>
          </>
        )}
        {tab === "materials" && (
          <>
            {materials.length === 0 && (
              <div className='equip-empty'>
                You have no materials. Enemies drop them.
              </div>
            )}
            <div className='inventory-list'>
              {materials.map((m) => (
                <Tooltip key={m.key} content={materialTooltip(m.key, m.count)}>
                  <div className='inventory-item'>
                    <strong style={{ color: MATERIAL_TIERS[m.tier].color }}>
                      {m.name} x{m.count}
                    </strong>
                  </div>
                </Tooltip>
              ))}
            </div>
          </>
        )}
        {tab === "keyItems" && (
          <>
            {keyItems.length === 0 && (
              <div className='equip-empty'>You have no key items.</div>
            )}
            <div className='inventory-list'>
              {keyItems.map((k) => (
                <Tooltip key={k.key} content={keyItemTooltip(k.key)}>
                  <div className='inventory-item'>
                    <strong>{k.name}</strong>
                  </div>
                </Tooltip>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const formatStatValue = (v, format, signed) => {
  const n =
    format === "percent"
      ? `${Math.round(Math.abs(v) * 1000) / 10}%`
      : Math.round(Math.abs(v) * 1000) / 1000;
  return signed ? `${v < 0 ? "-" : "+"}${n}` : `${v < 0 ? "-" : ""}${n}`;
};

// Tooltip for a stat row: what it does, the formula, and the live calculation lines. A row can cover several keys (e.g. min/max).
const statTooltip = (breakdown, keys) => {
  const sections = keys
    .map((key) => {
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
          {
            label: "Total",
            value: formatStatValue(b.total, b.format),
            color: "#ffd479",
          },
        ],
        footer: info.formula,
      };
    })
    .filter(Boolean);
  if (!sections.length) return null;
  if (sections.length === 1)
    return { title: STAT_INFO[keys[0]].title, ...sections[0] };
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
    [
      "Magic attack",
      `${s.magicAttackMin}-${s.magicAttackMax}`,
      ["magicAttackMin", "magicAttackMax"],
    ],
    ["Strength", s.strength, ["strength"]],
    ["Dexterity", s.dexterity, ["dexterity"]],
    ["Intelligence", s.intelligence, ["intelligence"]],
    ["Vitality", s.vitality, ["vitality"]],
    ["Agility", s.agility, ["agility"]],
    ["Resilience", s.resilience, ["resilience"]],
    [
      "Critical damage",
      `${Math.round((s.criticalDamageBonus || 0) * 100)}%`,
      ["criticalDamageBonus"],
    ],
    ["Evasion", `${Math.round((s.evasion || 0) * 100)}%`, ["evasion"]],
    ["Luck", s.luck, ["luck"]],
    [
      "Critical chance",
      `${Math.round((s.criticalHitChance || 0) * 100)}%`,
      ["criticalHitChance"],
    ],
    ["Speed", s.speed, ["speed"]],
    ["Gear score", s.gearScore || 0, ["gearScore"]],
  ];
  const breakdown = getStatBreakdown(player);
  return (
    <div className='panel character-layout'>
      <div className='character-main'>
        <h2>
          {player.name} the {player.class}, Level {player.level}
        </h2>
        <h3>
          Experience {s.exp}/{s.expToLevel}
        </h3>
        <Bar
          label='Health'
          value={s.health}
          max={s.maxHealth}
          color='#1e8449'
        />
        <Bar
          label='Stamina'
          value={s.stamina}
          max={s.maxStamina}
          color='#b7791f'
        />
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

const PROGRESSION_TABS = [
  { key: "points", label: "Stats" },
  { key: "skills", label: "Skills" },
  { key: "classes", label: "Classes" },
];

const StatsTab = ({ player, inCombat, onSpend }) => {
  const statPoints = player.statPoints || 0;
  const breakdown = getStatBreakdown(player);
  return (
    <>
      <h3>
        Stat points:{" "}
        <span className={statPoints ? "points-available" : ""}>
          {statPoints}
        </span>
      </h3>
      <div className='stat-grid'>
        {CORE_STAT_ROWS.map(([key, label]) => (
          <Tooltip key={key} content={statTooltip(breakdown, [key])}>
            <div className='stat-row'>
              <span>{label}</span>
              <span>
                {player.stats?.[key]}{" "}
                <button
                  type='button'
                  className='spend-button'
                  disabled={inCombat || statPoints < 1}
                  onClick={() => onSpend(key)}
                >
                  +
                </button>
              </span>
            </div>
          </Tooltip>
        ))}
      </div>
    </>
  );
};

const SkillsTab = ({ player, inCombat, onChange }) => {
  const skillPoints = player.skillPoints || 0;
  const equipped = getEquippedSkills(player);
  const act = (fn, key) => {
    fn(key);
    onChange();
  };
  return (
    <>
      <h3>
        Skill points:{" "}
        <span className={skillPoints ? "points-available" : ""}>
          {skillPoints}
        </span>
      </h3>
      <div className='equip-empty'>
        You earn a skill point every other level. Equipped skills (
        {equipped.length}/{MAX_EQUIPPED}) can be used in combat for power.
      </div>
      <div className='skill-list'>
        {Object.entries(SKILLS).map(([key, s]) => {
          const level = getSkillLevel(player, key);
          const isEquipped = equipped.includes(key);
          return (
            <Tooltip key={key} content={skillTooltip(key, level)}>
              <div className={`skill-card ${isEquipped ? "equipped" : ""}`}>
                <strong>{s.name}</strong>
                <span className='skill-level'>
                  {level > 0 ? `Level ${level}/${s.maxLevel}` : "Not learned"}
                </span>
                <div className='skill-actions'>
                  <button
                    type='button'
                    className='buttons class-toggle'
                    disabled={
                      inCombat || skillPoints < 1 || level >= s.maxLevel
                    }
                    onClick={() => act(levelUpSkill, key)}
                  >
                    {level > 0 ? "Level up" : "Learn"}
                  </button>
                  {isEquipped ? (
                    <button
                      type='button'
                      className='buttons class-toggle'
                      disabled={inCombat}
                      onClick={() => act(unequipSkill, key)}
                    >
                      Unequip
                    </button>
                  ) : (
                    <button
                      type='button'
                      className='buttons class-toggle'
                      disabled={
                        inCombat || level < 1 || equipped.length >= MAX_EQUIPPED
                      }
                      onClick={() => act(equipSkill, key)}
                    >
                      Equip
                    </button>
                  )}
                </div>
              </div>
            </Tooltip>
          );
        })}
      </div>
    </>
  );
};

const ClassesTab = ({ player }) => (
  <div className='class-grid'>
    {Object.entries(CLASSES).map(([name, c]) => (
      <div
        key={name}
        className={`class-card ${name === player.class ? "current" : ""}`}
      >
        <strong>
          {name}
          {name === player.class && (
            <span className='class-current'> (current)</span>
          )}
        </strong>
        <em>{c.subtitle}</em>
        <span>{c.description}</span>
        {c.bonus && (
          <span className='class-bonus'>
            <strong>{c.bonus.name}:</strong> {c.bonus.description}
          </span>
        )}
        <span className='class-focus'>Focus: {c.focus.join(", ")}</span>
        <span className='class-req'>{c.requirement}</span>
      </div>
    ))}
  </div>
);

const ProgressionScreen = ({ player: initial, inCombat, onChange }) => {
  const [player, setPlayerState] = useState(initial);
  const [tab, setTab] = useState("points");
  if (!player) return <div className='panel'>No character yet.</div>;
  const refresh = () => {
    setPlayerState(getPlayer());
    onChange?.();
  };
  const spend = (key) => {
    if (spendStatPoint(key).ok) refresh();
  };
  const pending = {
    points: player.statPoints || 0,
    skills: player.skillPoints || 0,
  };
  return (
    <div className='panel progression'>
      <h2>Progression</h2>
      <Tooltip content={classTooltip(player.class)}>
        <h3 className='class-heading'>
          Level {player.level} {player.class}
        </h3>
      </Tooltip>
      {inCombat && (
        <div className='progression-locked'>
          You can't spend points or change skills during combat.
        </div>
      )}
      <div className='inventory-tabs' role='tablist'>
        {PROGRESSION_TABS.map((t) => (
          <button
            key={t.key}
            type='button'
            role='tab'
            aria-selected={tab === t.key}
            className={`inventory-tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {pending[t.key] > 0 && (
              <span className='sidebar-badge'>{pending[t.key]}</span>
            )}
          </button>
        ))}
      </div>
      {tab === "points" && (
        <StatsTab player={player} inCombat={inCombat} onSpend={spend} />
      )}
      {tab === "skills" && (
        <SkillsTab player={player} inCombat={inCombat} onChange={refresh} />
      )}
      {tab === "classes" && <ClassesTab player={player} />}
    </div>
  );
};

export const SCREENS = {
  adventure: { label: "Adventure", link: true, component: AdventureScreen },
  character: { label: "Character", link: true, component: CharacterScreen },
  progression: {
    label: "Progression",
    link: true,
    component: ProgressionScreen,
    badge: (p) => getUnspentPoints(p),
  },
  combat: { label: "Combat", component: CombatScreen, hideUnlessActive: true },
  crafting: {
    label: "Workshop",
    component: CraftingScreen,
    hideUnlessActive: true,
  },
  gearTrader: {
    label: "Gear Trader",
    component: GearTraderScreen,
    hideUnlessActive: true,
  },
};

export const DEFAULT_SCREEN = "adventure";
