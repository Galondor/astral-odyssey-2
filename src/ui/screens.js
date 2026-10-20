import { useEffect, useRef, useState } from "react";
import {
  getInventoryItemKey,
  getPlayer,
  markInventoryItemViewed,
  setPlayer,
} from "../character/player";
import {
  RARITY_COLORS,
  SLOTS,
  buyBackGear,
  buyGearTraderItem,
  canEquip,
  equipItem,
  GEAR_TRADER_REFRESH_MS,
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
import { STAT_INFO, getBaseStatPoints, getStatBreakdown } from "../character/stats";
import { getRespecCost, getUnspentPoints, respecSkills, respecStatPoints, spendStatPoint } from "../character/progression";
import RichText from "./RichText";
import {
  MAX_ACTIVE_QUESTS,
  abandonQuest,
  acceptQuest,
  getActiveQuests,
  getObjective,
  getQuestBoard,
  getQuestStatus,
  getQuestTier,
  getQuests,
  getReadyQuestCount,
  getRep,
  getRepRank,
  getRequirementProblem,
  rewardText,
  turnInQuest,
} from "../world/quests";
import Tooltip from "./Tooltip";
import InboxScreen from "./InboxScreen";
import AdminScreen from "./AdminScreen";
import { getUnreadCount } from "../world/inbox";
/*
 Game screens. A scene picks one with `screen: "<key>"` (and optional `screenData`); the sidebar can
 also open the ones with `link: true` at any time. To add a screen, add an entry here.
   label     - sidebar text
   link      - always available from the sidebar (otherwise only enabled while a scene uses it)
   hideUnlessActive - hidden from the sidebar unless a scene is using it (highlighted when shown)
   badge     - (player) => number, shown as a notification on the tab when above 0
   adminOnly - only shown to players listed under admins/{uid} in the database
   component - React component receiving { messages, data, player }
*/
const MOBILE_QUERY = "(max-width: 800px)";
const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => setMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
};

const Log = ({ messages, limit, mobileLimit }) => {
  const ref = useRef(null);
  const isMobile = useIsMobile();
  const effectiveLimit = isMobile && mobileLimit ? mobileLimit : limit;
  const shown = effectiveLimit ? messages.slice(-effectiveLimit) : messages;
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

const DungeonsScreen = () => (
  <div className='panel'>
    <h2>Dungeons</h2>
    <p>Coming soon!</p>
  </div>
);

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
      <Log messages={messages} limit={10} mobileLimit={4} />
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
    const untilNextRefresh = GEAR_TRADER_REFRESH_MS - (now % GEAR_TRADER_REFRESH_MS);
    let interval;
    const timeout = window.setTimeout(() => {
      refreshHourlyStock();
      interval = window.setInterval(refreshHourlyStock, GEAR_TRADER_REFRESH_MS);
    }, untilNextRefresh);
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
  const gearButton = (
    item,
    label,
    key,
    onClick,
    disabled = false,
    isEquipped = false,
  ) => (
    <Tooltip key={key} content={itemComparisonTooltip(item, label)}>
      <button
        type='button'
        className={`inventory-item ${isEquipped ? "equipped-gear" : ""}`}
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
                false,
                true,
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
            New stock arrives every 30 minutes.
          </div>
          {!stock.length && (
            <div className='equip-empty'>This stock has sold out.</div>
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
    markInventoryItemViewed("consumables", key);
    drinkConsumable(key);
    onChange();
  };
  const isNew = (category, key) =>
    (player.unseenInventoryItems?.[category] || []).includes(key);
  const viewItem = (category, key) => {
    markInventoryItemViewed(category, key);
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
              {t.label}
              {player.unseenInventoryItems?.[t.key]?.length > 0 && (
                <span className='inventory-new-dot' aria-label='New items' />
              )}
              {" "}
              <span className='equip-count'>{counts[t.key]}</span>
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
                  onView={() => viewItem("gear", getInventoryItemKey(item))}
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
                      markInventoryItemViewed("gear", getInventoryItemKey(item));
                      equipItem(i);
                      onChange();
                    }}
                  >
                    {isNew("gear", getInventoryItemKey(item)) && (
                      <span className='inventory-new-dot' aria-label='New item' />
                    )}
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
                  onView={() => viewItem("consumables", c.key)}
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
                    {isNew("consumables", c.key) && (
                      <span className='inventory-new-dot' aria-label='New item' />
                    )}
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
                <Tooltip
                  key={m.key}
                  onView={() => viewItem("materials", m.key)}
                  content={materialTooltip(m.key, m.count)}
                >
                  <div className='inventory-item'>
                    {isNew("materials", m.key) && (
                      <span className='inventory-new-dot' aria-label='New item' />
                    )}
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
                <Tooltip
                  key={k.key}
                  onView={() => viewItem("keyItems", k.key)}
                  content={keyItemTooltip(k.key)}
                >
                  <div className='inventory-item'>
                    {isNew("keyItems", k.key) && (
                      <span className='inventory-new-dot' aria-label='New item' />
                    )}
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

const RespecButton = ({ player, inCombat, refundable, label, onClick }) => {
  const cost = getRespecCost(player);
  return (
    <div className='respec'>
      <button
        type='button'
        className='buttons class-toggle'
        disabled={inCombat || refundable < 1 || (player.astra || 0) < cost}
        onClick={onClick}
      >
        {label} ({cost} astra)
      </button>
      <span className='equip-empty'>
        {refundable < 1
          ? ""
          : (player.astra || 0) < cost
            ? ``
            : ` Refunds ${refundable} point${refundable === 1 ? "" : "s"}.`}
      </span>
    </div>
  );
};

const StatsTab = ({ player, inCombat, onSpend, onRespec }) => {
  const statPoints = player.statPoints || 0;
  const breakdown = getStatBreakdown(player);
  const base = getBaseStatPoints(player);
  const refundable = CORE_STAT_ROWS.reduce((sum, [k]) => sum + Math.max(0, (base[k] || 0) - 1), 0);
  return (
    <>
      <h3>
        Stat points:{" "}
        <span className={statPoints ? "points-available" : ""}>
          {statPoints}
        </span>
      </h3>
      <RespecButton player={player} inCombat={inCombat} refundable={refundable} label='Reset stat points' onClick={onRespec} />
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
      <RespecButton
        player={player}
        inCombat={inCombat}
        refundable={Object.values(player.skills || {}).reduce((sum, n) => sum + (n || 0), 0)}
        label='Reset skills'
        onClick={() => {
          respecSkills();
          onChange();
        }}
      />
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
        <StatsTab player={player} inCombat={inCombat} onSpend={spend} onRespec={() => { respecStatPoints(); refresh(); }} />
      )}
      {tab === "skills" && (
        <SkillsTab player={player} inCombat={inCombat} onChange={refresh} />
      )}
      {tab === "classes" && <ClassesTab player={player} />}
    </div>
  );
};

const questTooltip = (quest, player) => {
  const tier = getQuestTier(quest.tier);
  const problem = getRequirementProblem(quest, player);
  return {
    title: quest.title,
    titleColor: tier.color,
    subtitle: `${quest.tier}-Rank • Level ${quest.level}`,
    description: quest.description,
    stats: [
      { label: "Reward", value: rewardText(quest.reward), color: "#ffd479" },
      ...(problem ? [{ label: "Locked", value: problem, color: "#ff6b6b" }] : []),
    ],
  };
};

const QuestBoardScreen = ({ onChange }) => {
  const [note, setNote] = useState("");
  const player = getPlayer() || {};
  const board = getQuestBoard(player);
  const active = getActiveQuests(player);
  const rep = getRep(player);
  const refresh = () => onChange?.();
  const accept = (quest) => {
    const result = acceptQuest(quest.id);
    setNote(result.ok ? `Accepted: ${quest.title}.` : result.message || "That quest is no longer available.");
    refresh();
  };
  const turnIn = (quest) => {
    const result = turnInQuest(quest.id);
    setNote(result.ok ? result.messages.join(" ") : "That quest isn't finished yet.");
    refresh();
  };
  return (
    <div className='workshop quest-board'>
      <h3>
        Quest Board{" "}
        <span className='recipe-astra'>
          Reputation: {getRepRank(rep)} ({rep}) • Active {active.length}/{MAX_ACTIVE_QUESTS}
        </span>
      </h3>
      {active.length > 0 && (
        <>
          <div className='recipe-kind'>Your quests</div>
          <div className='recipe-grid'>
            {active.map((q) => {
              const obj = getObjective(q, player);
              return (
                <Tooltip key={q.id} content={questTooltip(q, player)}>
                  <button type='button' className={`recipe ${obj.done ? "" : "unaffordable"}`} disabled={!obj.done} onClick={() => turnIn(q)}>
                    <strong style={{ color: getQuestTier(q.tier).color }}>[{q.tier}] {q.title}</strong>
                    <span>{q.description}</span>
                    <span className='recipe-cost'>
                      {obj.progress}/{obj.count} • {obj.done ? "Turn in" : "In progress"}
                    </span>
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </>
      )}
      <div className='recipe-kind'>Available (new notices every 10 minutes)</div>
      {!board.length && <div className='equip-empty'>No notices left right now.</div>}
      <div className='recipe-grid'>
        {board.map((q) => {
          const problem = getRequirementProblem(q, player);
          return (
            <Tooltip key={q.id} content={questTooltip(q, player)}>
              <button type='button' className={`recipe ${problem ? "unaffordable" : ""}`} disabled={!!problem} onClick={() => accept(q)}>
                <strong style={{ color: getQuestTier(q.tier).color }}>[{q.tier}] {q.title}</strong>
                <span>{q.description}</span>
                <span className='recipe-cost'>{problem || `Reward: ${rewardText(q.reward)}`}</span>
              </button>
            </Tooltip>
          );
        })}
      </div>
      <div className='recipe-note'>
        <RichText text={note || "Hover over a notice for details, then click it to accept."} />
      </div>
    </div>
  );
};

const QuestsScreen = ({ onChange }) => {
  const [, setTick] = useState(0);
  const [tab, setTab] = useState("active");
  const player = getPlayer();
  if (!player) return <div className='panel'>No character yet.</div>;
  const rep = getRep(player);
  const quests = getQuests(player);
  const isActive = (q) => q.status === "active";
  const sorted = (tab === "active"
    ? quests.filter(isActive)
    : quests.filter((q) => !isActive(q)).sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0)));
  const tabs = [
    ["active", "Active", quests.filter(isActive).length],
    ["archived", "Archived", quests.filter((q) => !isActive(q)).length],
  ];
  const abandon = (quest) => {
    abandonQuest(quest.id);
    setTick((t) => t + 1);
    onChange?.();
  };
  return (
    <div className='panel'>
      <h2>Quests</h2>
      <h3>
        Reputation: {getRepRank(rep)} ({rep})
      </h3>
      <div className='inventory-tabs' role='tablist'>
        {tabs.map(([key, label, count]) => (
          <button
            key={key}
            type='button'
            role='tab'
            aria-selected={tab === key}
            className={`inventory-tab ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label} ({count})
          </button>
        ))}
      </div>
      {!sorted.length && (
        <div className='equip-empty'>
          {tab === "active"
            ? "No active quests. Visit the tavern in town."
            : "No completed or abandoned quests yet."}
        </div>
      )}
      <div className='quest-list'>
        {sorted.map((q) => {
          const obj = getObjective(q, player);
          const status = getQuestStatus(q, player);
          return (
            <Tooltip key={q.id} content={questTooltip(q, player)}>
              <div className={`quest-entry ${q.status}`}>
                <div>
                  <strong style={{ color: getQuestTier(q.tier).color }}>[{q.tier}] {q.title}</strong>
                  <span className='quest-status'> • {status}</span>
                </div>
                <div>{q.description}</div>
                <div className='recipe-kind'>
                  {q.status === "active" ? `Progress ${obj.progress}/${obj.count} • ` : ""}Reward: {rewardText(q.reward)}
                </div>
                {q.status === "active" && (
                  <button type='button' className='buttons input-button' onClick={() => abandon(q)}>
                    Abandon
                  </button>
                )}
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};

export const SCREENS = {
  adventure: { label: "Adventure", link: true, component: AdventureScreen },
  dungeons: { label: "Dungeons", link: true, component: DungeonsScreen },
  character: { label: "Character", link: true, component: CharacterScreen },
  progression: {
    label: "Progression",
    link: true,
    component: ProgressionScreen,
    badge: (p) => getUnspentPoints(p),
  },
  quests: {
    label: "Quests",
    link: true,
    component: QuestsScreen,
    badge: (p) => getReadyQuestCount(p),
  },
  inbox: {
    label: "Inbox",
    link: true,
    component: InboxScreen,
    badge: () => getUnreadCount(),
  },
  admin: { label: "Admin", link: true, adminOnly: true, component: AdminScreen },
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
  questBoard: {
    label: "Quest Board",
    component: QuestBoardScreen,
    hideUnlessActive: true,
  },
};

export const DEFAULT_SCREEN = "adventure";
