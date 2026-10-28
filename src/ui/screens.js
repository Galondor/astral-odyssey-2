import { useEffect, useRef, useState } from "react";
import { getHolofoilStyle } from "../items/holofoil";
import {
  getInventoryItemKey,
  getPlayer,
  markInventoryItemViewed,
  savePlayerName,
  setPlayer,
} from "../character/player";
import {
  RARITY_COLORS,
  SLOTS,
  STAT_LABELS,
  buyBackGear,
  buyGearTraderItem,
  canEquip,
  CONDITION_NAMES,
  equipItem,
  GEAR_SLOT_TYPES,
  GEAR_TRADER_REFRESH_MS,
  getCustomSubStatTiers,
  getGearTraderStock,
  getSubStatPool,
  getSellPrice,
  getGemstoneValue,
  getGemstoneRemovalCost,
  gemstoneTooltip,
  itemTooltip,
  removeGemstone,
  socketGemstone,
  sellEquippedItem,
  sellGemstone,
  sellInventoryItem,
  unequipItem,
} from "../items/items";
import { craftRelicItem, getRelicCraftCost, RELIC_CONDITION_COSTS, RELIC_CRAFT_RARITIES, RELIC_RARITY_COSTS } from "../world/relicForge";
import { getItemGearScore } from "../items/gearScore";
import { ABILITIES } from "../combat/abilities";
import { isFavorite, toggleFavorite } from "../items/favorites";
import { applyRune, canApplyRune, RUNE_MAIN_STATS } from "../items/runes";
import { canRenameItem, renameItem } from "../items/certificates";
import { applyPrismaticAlloy, canApplyPrismaticAlloy } from "../items/prismaticAlloy";
import { getItemStats, MARKET_RARITIES, MARKET_SLOTS, MARKET_STATS } from "../world/marketplace";
import {
  CONSUMABLES,
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
import { getBaseStatPoints, getStatBreakdown } from "../character/stats";
import CharacterSummary, { Bar, statTooltip } from "./CharacterSummary";
import { TITLES, titleTooltip } from "../character/titles";
import { getRespecCost, getUnspentPoints, respecSkills, respecStatPoints, spendStatPoint } from "../character/progression";
import RichText from "./RichText";
import ItemPopup from "./ItemPopup";
import ChangelogScreen from "./ChangelogScreen";
import LeaderboardScreen from "./LeaderboardScreen";
import ArenaScreen from "./ArenaScreen";
import WorldBossScreen from "./WorldBossScreen";
import {
  MAX_ACTIVE_QUESTS,
  abandonQuest,
  acceptQuest,
  getActiveQuests,
  getObjective,
  getQuestBoard,
  getQuestBoardRefreshMs,
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
import MarketplaceScreen from "./MarketplaceScreen";
import { MARKETPLACE_MIN_LEVEL } from "../world/marketplace";
import AdminScreen from "./AdminScreen";
import BugReportScreen from "./BugReportScreen";
import LabyrinthScreen from "./LabyrinthExpeditionScreen";
import { getUnreadCount } from "../world/inbox";
import { DUNGEON_MIN_LEVEL, DUNGEON_REROLL_COST, describeOffer, formatTime, getBoard, getBoardRefreshMs, getRun, getStages, getTimeLeftMs, rerollDungeons, startDungeon } from "../world/dungeons";
/*
 Game screens. A scene picks one with `screen: "<key>"` (and optional `screenData`); the sidebar can
 also open the ones with `link: true` at any time. To add a screen, add an entry here.
   label     - sidebar text
   sidebarGroup - desktop navigation group; omitted for Admin and contextual screens at the end
   link      - always available from the sidebar (otherwise only enabled while a scene uses it)
   hideUnlessActive - hidden from the sidebar unless a scene is using it (highlighted when shown)
   badge     - (player) => number, shown as a count on the tab when above 0
   notification - (player) => boolean, shown as a dot on the tab when true
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

const AdventureScreen = ({ messages }) => <Log messages={messages} />;

const useNow = (interval = 1000) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
};

const getGearTraderRefreshMs = () => GEAR_TRADER_REFRESH_MS - (Date.now() % GEAR_TRADER_REFRESH_MS);

// Live mm:ss until the next refresh; calls onRollover when the window flips so the screen can reload its data.
const Countdown = ({ getMs, onRollover }) => {
  const [ms, setMs] = useState(getMs);
  const last = useRef(ms);
  const rolloverRef = useRef(onRollover);
  rolloverRef.current = onRollover;
  useEffect(() => {
    const id = setInterval(() => {
      const next = getMs();
      if (next > last.current) rolloverRef.current?.();
      last.current = next;
      setMs(next);
    }, 1000);
    return () => clearInterval(id);
  }, [getMs]);
  return <span>{formatTime(ms)}</span>;
};

const DungeonStages = ({ run }) => (
  <ol className='dungeon-stages'>
    {getStages(run).map((s, i) => (
      <li key={i} className={`dungeon-stage ${s.state}`}>
        <span className='dungeon-stage-kind'>{s.kind}</span> {s.label}
      </li>
    ))}
  </ol>
);

const DungeonRunScreen = ({ messages, player }) => {
  useNow();
  const run = getRun(player);
  if (!run) return <Log messages={messages} />;
  return (
    <div className='panel dungeon-run'>
      <h2>{run.name}</h2>
      <div className='dungeon-rating'>Dungeon Level {run.level}</div>
      <div className={`dungeon-timer ${getTimeLeftMs(run) < 1 * 60 * 1000 ? "low" : ""}`}>Time left: {formatTime(getTimeLeftMs(run))}</div>
      <DungeonStages run={run} />
      <Log messages={messages} />
    </div>
  );
};

const DungeonsScreen = ({ player, goToScene, inCombat, onChange, sceneId }) => {
  const [tab, setTab] = useState(sceneId === "labyrinth" ? "labyrinth" : "solo");
  const [error, setError] = useState("");
  const now = useNow();
  useEffect(() => {
    if (sceneId === "labyrinth") setTab("labyrinth");
  }, [sceneId]);
  const run = getRun(player);
  const board = tab === "solo" && player ? getBoard(player) : null;
  const enter = (offerId) => {
    const result = startDungeon(offerId);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError("");
    goToScene("dungeon");
  };
  const reroll = () => {
    const result = rerollDungeons();
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError("");
    onChange();
  };
  return (
    <div className={`panel dungeons adventures-theme-${tab} ${tab === "solo" ? "dungeons-solo" : ""}`}>
      <h2>Adventures</h2>
      {error && <p className='dungeon-warning' role='alert'>{error}</p>}
      <div className='dungeon-tabs'>
        {[["solo", "Solo Dungeons"], ["labyrinth", "Labyrinth"], ["world-boss", "World Boss"], ["group", "Group Dungeons"], ["raids", "Raids"]].map(([key, label]) => (
          <button
            key={key}
            type='button'
            className={`buttons dungeon-tab-${key} ${tab === key ? "active" : ""}`}
            disabled={key === "group" || key === "raids" || (key === "labyrinth" && (player?.level || 1) < 22)}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "group" && <p>Group dungeons are coming soon!</p>}
      {tab === "labyrinth" && <LabyrinthScreen player={player} inCombat={inCombat} goToScene={goToScene} onChange={onChange} />}
      {tab === "world-boss" && <WorldBossScreen player={player} goToScene={goToScene} onChange={onChange} inCombat={inCombat} />}
      {tab === "solo" && (
        <>
          <p className='dungeon-rules'>
            Three new dungeons appear every 30 minutes (next in {formatTime(getBoardRefreshMs())}). <br/>Once you enter, you cannot leave or visit town. You have 5 minutes to clear it.<br/>Running out of time fails the run and removes you from the dungeon.
          </p>
          <button
            type='button'
            className='buttons dungeon-reroll'
            disabled={!!run || inCombat || (player?.level || 1) < DUNGEON_MIN_LEVEL}
            onClick={reroll}
          >
            Generate New Dungeons ({DUNGEON_REROLL_COST.toLocaleString()} astra)
          </button>
          {run && <p className='dungeon-warning'>You are inside {run.name}. Time left: {formatTime(getTimeLeftMs(run))}. Use the Dungeon tab to continue.</p>}
          <div className='dungeon-offers' data-now={now}>
            {board?.offers.map((offer) => {
              const info = describeOffer(offer);
              return (
                <div key={offer.id} className={`dungeon-card ${offer.cleared ? "cleared" : ""}`}>
                  <h3>{info.type.name}</h3>
                  <div className='dungeon-rating'>Dungeon Level {offer.level}</div>
                  <p>{info.type.description}</p>
                  <div>Challenges: {info.challenges.join(", ")}</div>
                  <div>Elite: {info.elite}</div>
                  <div>Boss: <span className='dungeon-boss'>{info.boss}</span></div>
                  <div>Unique drop: <span className='unique-text'>{info.unique?.name}</span></div>
                  <button type='button' className='buttons' disabled={offer.cleared || !!run || inCombat || (player?.level || 1) < DUNGEON_MIN_LEVEL} onClick={() => enter(offer.id)}>
                    {offer.cleared ? "Cleared" : "Enter Dungeon"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

const CombatScreen = ({ messages, data, player }) => {
  const { enemy, round, stats, defending, playerStatuses = [], marrowWard } = data || {};
  const showMarrowWard = marrowWard?.current > 0;
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
      {round != null && <div className='combat-round'>Round {round}</div>}
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
              <div className={showMarrowWard ? "combat-health-warded" : undefined}>
                <Bar
                  label='Health'
                  value={stats.health}
                  max={stats.maxHealth}
                  color='#1e8449'
                />
                {showMarrowWard && (
                  <div className='marrow-ward'>
                    <div className='marrow-ward-label'>
                      <span>Marrow Ward</span>
                      <span>{marrowWard.current}/{marrowWard.max}</span>
                    </div>
                    <div
                      className='marrow-ward-track'
                      role='progressbar'
                      aria-label='Marrow Ward'
                      aria-valuemin={0}
                      aria-valuemax={marrowWard.max}
                      aria-valuenow={marrowWard.current}
                    >
                      <div
                        className='marrow-ward-fill'
                        style={{
                          width: `${Math.max(0, Math.min(100, (marrowWard.current / marrowWard.max) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
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

const ForgeScreen = ({ onChange }) => {
  const [tab, setTab] = useState("relic");
  const [name, setName] = useState("");
  const [slot, setSlot] = useState("weapon");
  const [rarity, setRarity] = useState("Rare");
  const [condition, setCondition] = useState("random");
  const [ability, setAbility] = useState("");
  const [twoHanded, setTwoHanded] = useState(false);
  const [subStats, setSubStats] = useState([]);
  const [note, setNote] = useState("");
  const player = getPlayer() || {};
  const relicCount = player.materials?.sealedRelic || 0;
  const fragmentCount = player.materials?.relicFragments || 0;
  const substatCount = RELIC_CRAFT_RARITIES.indexOf(rarity) + 1;
  const updateSubStat = (index, field, value) =>
    setSubStats((current) => {
      const next = [...current];
      next[index] = { ...(next[index] || { stat: "random", tier: 3 }), [field]: value };
      return next;
    });
  const selectedSubStats = subStats.filter((entry) => entry?.stat && entry.stat !== "random");
  const fragmentCost = getRelicCraftCost(rarity, selectedSubStats, ability, condition);
  const forge = () => {
    const result = craftRelicItem(player, { name, slot, rarity, condition, ability, twoHanded, subStats });
    if (!result.ok) {
      setNote(result.message);
      return;
    }
    setPlayer(result.patch);
    onChange?.();
    setNote(result.message);
  };
  return (
    <div className='workshop relic-forge'>
      <header className='relic-forge-header'>
        <div>
          <h3>Relic Forge</h3>
          <p>Design one custom item. Random choices are free; fragment costs are shown before forging.</p>
        </div>
        <div className='relic-forge-wallet' aria-label='Crafting materials'>
          <span><strong>{relicCount}</strong> Sealed Relics</span>
          <span><strong>{fragmentCount}</strong> Relic Fragments</span>
        </div>
      </header>
      <div className='inventory-tabs' role='tablist' aria-label='Forge'>
        <button type='button' role='tab' aria-selected={tab === "relic"} className={`inventory-tab ${tab === "relic" ? "active" : ""}`} onClick={() => setTab("relic")}>Relic Crafting</button>
        <button type='button' role='tab' aria-selected='false' className='inventory-tab' disabled title='Material crafting is not available yet'>Material Crafting</button>
      </div>
      {tab === "relic" && (
        <div className='relic-forge-content'>
          <section className='relic-forge-section'>
            <h4>Item design</h4>
            <div className='relic-forge-fields'>
              <label><span className='relic-forge-field-heading'>Item name <span>Free</span></span>
                <input className='input-field' value={name} maxLength={60} placeholder='Random name' onChange={(event) => setName(event.target.value)} />
              </label>
              <label>Slot
                <select className='input-field' value={slot} onChange={(event) => { setSlot(event.target.value); setSubStats([]); setAbility(""); setTwoHanded(false); }}>
                  {GEAR_SLOT_TYPES.map((value) => <option key={value} value={value}>{SLOTS.find((entry) => entry.type === value)?.label || value}</option>)}
                </select>
              </label>
              <label>Rarity
                <select className='input-field' value={rarity} onChange={(event) => { setRarity(event.target.value); setSubStats([]); }}>
                  {RELIC_CRAFT_RARITIES.map((value) => <option key={value} value={value}>{value} · {RELIC_RARITY_COSTS[value]} fragments</option>)}
                </select>
              </label>
              <label>Condition
                <select className='input-field' value={condition} onChange={(event) => setCondition(event.target.value)}>
                  <option value='random'>Random · Free</option>
                  {CONDITION_NAMES.map((value) => (
                    <option key={value} value={value}>
                      {value} · {RELIC_CONDITION_COSTS[value] ? `+${RELIC_CONDITION_COSTS[value]} fragments` : "Free"}
                    </option>
                  ))}
                </select>
              </label>
              <label>Ability
                <select className='input-field' value={ability} onChange={(event) => setAbility(event.target.value)}>
                  <option value=''>Random · Free</option>
                  {ABILITIES.filter((entry) => entry.slots.includes(slot)).map((entry) => <option key={entry.name} value={entry.name}>{entry.name} · 18 fragments</option>)}
                </select>
              </label>
              {slot === "weapon" && <label className='relic-forge-checkbox'>
                <input type='checkbox' checked={twoHanded} onChange={(event) => { setTwoHanded(event.target.checked); setSubStats([]); }} />
                Two-handed weapon
              </label>}
            </div>
          </section>
          <section className='relic-forge-section'>
            <div className='relic-forge-section-heading'>
              <div><h4>Substats ({substatCount})</h4><p>Choose each stat and tier, or leave it Random to pay no selection cost.</p></div>
            </div>
            <div className='relic-forge-substats'>
              {Array.from({ length: substatCount }, (_, index) => {
                const entry = subStats[index] || { stat: "random", tier: 3 };
                const pool = getSubStatPool(slot).filter((value) => !subStats.some((other, otherIndex) => otherIndex !== index && other?.stat === value));
                const tiers = entry.stat === "random" ? [] : getCustomSubStatTiers(entry.stat, Math.max(1, player.level || 1), twoHanded);
                return (
                  <div className='relic-forge-substat-row' key={index}>
                    <span className='relic-forge-substat-number'>{index + 1}</span>
                    <label>Stat
                      <select className='input-field' value={entry.stat || "random"} onChange={(event) => {
                        const value = event.target.value;
                        updateSubStat(index, "stat", value);
                        if (value !== "random") {
                          const availableTiers = getCustomSubStatTiers(value, Math.max(1, player.level || 1), twoHanded);
                          updateSubStat(index, "tier", availableTiers[0] ?? 0);
                        }
                      }}>
                        <option value='random'>Random · Free</option>
                        {pool.map((value) => <option key={value} value={value}>{STAT_LABELS[value] || value}</option>)}
                      </select>
                    </label>
                    <label>Tier
                      <select className='input-field' value={entry.tier} disabled={entry.stat === "random"} onChange={(event) => updateSubStat(index, "tier", Number(event.target.value))}>
                        {tiers.map((tier) => <option key={tier} value={tier}>T{tier} · {(tier + 1) ** 2} fragments</option>)}
                      </select>
                    </label>
                  </div>
                );
              })}
            </div>
          </section>
          <footer className='relic-forge-footer'>
            <div className='relic-forge-cost'><span>Crafting cost</span><strong>{fragmentCost} / {fragmentCount} fragments</strong><small>1 Sealed Relic per item · Item name is free</small></div>
            <button type='button' className='buttons' disabled={!relicCount || fragmentCount < fragmentCost} onClick={forge}>Forge Custom Item</button>
          </footer>
          <div className='recipe-note' role='status'>{note || "Your item is added directly to your inventory when forged."}</div>
        </div>
      )}
    </div>
  );
};

const GearTraderScreen = ({ data, onChange }) => {
  const [tab, setTab] = useState("sellGear");
  const [note, setNote] = useState("");
  const [selectedGear, setSelectedGear] = useState(null);
  const [selectedGearToSell, setSelectedGearToSell] = useState([]);
  const [selectedGemsToSell, setSelectedGemsToSell] = useState([]);
  const [compareSelected, setCompareSelected] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const player = getPlayer() || data?.player || {};
  const refresh = () => {
    onChange?.();
  };
  const act = (action, index) => {
    const result = action(index);
    if (result.ok) {
      setSelectedGearToSell([]);
      setSelectedGemsToSell([]);
      setNote(`${result.item.name}: ${result.price ?? result.value} astra.`);
      refresh();
      return true;
    } else {
      setNote(
        result.reason === "astra"
          ? `You need ${result.price} astra for that gear.`
          : result.reason === "favorite"
            ? "Unfavorite that item in your inventory before selling it."
          : "That gear can no longer be traded.",
      );
      return false;
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
  const gemstones = player.gemstones || [];
  const equipped = Object.entries(player.equipment || {}).filter(
    ([, item]) => item && !item.twoHandedOf,
  );
  const buyback = player.gearTraderBuyback || [];
  const stock = getGearTraderStock(player);
  const sellableInventoryGear = inventory.flatMap((item, index) =>
    isFavorite(player, "gear", item)
      ? []
      : [{ key: `inventory:${index}:${getInventoryItemKey(item)}`, item }],
  );
  const sellableGear = [
    ...sellableInventoryGear,
    ...equipped.flatMap(([slot, item]) =>
      isFavorite(player, "gear", item)
        ? []
        : [{ key: `equipment:${slot}:${getInventoryItemKey(item)}`, item }],
    ),
  ];
  const sellableGems = gemstones.flatMap((gemstone, index) =>
    isFavorite(player, "gemstones", gemstone)
      ? []
      : [{ key: `${index}:${gemstone.id || JSON.stringify(gemstone)}`, gemstone }],
  );
  const sellableGearByKey = new Map(sellableGear.map((entry) => [entry.key, entry]));
  const sellableGemsByKey = new Map(sellableGems.map((entry) => [entry.key, entry]));
  const selectedGearKeys = selectedGearToSell.filter((key) => sellableGearByKey.has(key));
  const selectedGemKeys = selectedGemsToSell.filter((key) => sellableGemsByKey.has(key));
  const selectedGearValue = selectedGearKeys.reduce((total, key) => {
    return total + (getSellPrice(sellableGearByKey.get(key).item) || 0);
  }, 0);
  const selectedGemsValue = selectedGemKeys.reduce((total, key) => {
    return total + (getGemstoneValue(sellableGemsByKey.get(key).gemstone) || 0);
  }, 0);
  const sellSelectedGear = () => {
    let count = 0;
    let total = 0;
    selectedGearKeys
      .filter((key) => key.startsWith("inventory:"))
      .map((key) => Number(key.slice("inventory:".length).split(":")[0]))
      .sort((a, b) => b - a)
      .forEach((index) => {
        const result = sellInventoryItem(index);
        if (result.ok) {
          count++;
          total += result.value;
        }
      });
    selectedGearKeys
      .filter((key) => key.startsWith("equipment:"))
      .map((key) => key.slice("equipment:".length).split(":")[0])
      .forEach((slot) => {
        const result = sellEquippedItem(slot);
        if (result.ok) {
          count++;
          total += result.value;
        }
      });
    setSelectedGearToSell([]);
    setNote(`${count} gear ${count === 1 ? "item" : "items"} sold for ${total} astra.`);
    if (count) refresh();
  };
  const sellSelectedGems = () => {
    let count = 0;
    let total = 0;
    [...selectedGemKeys]
      .map((key) => Number(key.split(":")[0]))
      .sort((a, b) => b - a)
      .forEach((index) => {
        const result = sellGemstone(index);
        if (result.ok) {
          count++;
          total += result.value;
        }
      });
    setSelectedGemsToSell([]);
    setNote(`${count} ${count === 1 ? "gem" : "gems"} sold for ${total} astra.`);
    if (count) refresh();
  };
  const gearButton = (
    item,
    label,
    key,
    onTrade,
    tradeLabel,
    unavailable = false,
    isEquipped = false,
    canFavorite = false,
  ) => (
    <Tooltip key={key} content={itemTooltip(item)}>
      <button
        type='button'
        className={`inventory-item ${isEquipped ? "equipped-gear" : ""} ${canFavorite && isFavorite(player, "gear", item) ? "favorite-item" : ""}`}
        style={getHolofoilStyle(item)}
        aria-disabled={unavailable || undefined}
        onClick={() => {
          setCompareSelected(false);
          setSelectedGear({
            item,
            tradeLabel,
            unavailable,
            canFavorite,
            onTrade,
          });
        }}
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
        {" "}
        <span className='recipe-astra'>New stock in <Countdown getMs={getGearTraderRefreshMs} onRollover={onChange} /></span>
      </h3>
      <div className='inventory-tabs' role='tablist' aria-label='Gear trader'>
        {[
          ["sellGear", "Sell Gear"],
          ["sellGems", "Sell Gems"],
          ["buyback", "Buy Back"],
          ["buy", "Buy Gear"],
        ].map(([key, label]) => (
          <button
            key={key}
            type='button'
            role='tab'
            aria-selected={tab === key}
            className={`inventory-tab ${tab === key ? "active" : ""}`}
            onClick={() => {
              setSelectedGear(null);
              setSelectedGearToSell([]);
              setSelectedGemsToSell([]);
              setTab(key);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "sellGear" && (
        <div className='gear-trader-list'>
          <div className='gear-trader-bulk-actions'>
            <button
              type='button'
              className='buttons'
              onClick={() => setSelectedGearToSell(sellableInventoryGear.map(({ key }) => key))}
              disabled={!sellableInventoryGear.length}
            >
              Select all sellable gear
            </button>
            <button
              type='button'
              className='buttons'
              onClick={sellSelectedGear}
              disabled={!selectedGearKeys.length}
            >
              Sell selected ({selectedGearKeys.length} • {selectedGearValue} astra)
            </button>
            <button
              type='button'
              className='buttons'
              onClick={() => setSelectedGearToSell([])}
              disabled={!selectedGearKeys.length}
            >
              Clear selection
            </button>
          </div>
          {!inventory.length && !equipped.length && (
            <div className='equip-empty'>You have no gear to sell.</div>
          )}
          <div className='inventory-list'>
            {inventory.map((item, index) => {
              const key = `inventory:${index}:${getInventoryItemKey(item)}`;
              const favorite = isFavorite(player, "gear", item);
              return (
                <div className='gear-trader-selectable' key={item.id || `pack-${index}`}>
                  <input
                    type='checkbox'
                    aria-label={`Select ${item.name} to sell`}
                    checked={selectedGearKeys.includes(key)}
                    disabled={favorite}
                    onChange={() => setSelectedGearToSell((current) =>
                      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
                    )}
                  />
                  {gearButton(
                    item,
                    favorite ? "Favorite • cannot sell " : `Sell for ${getSellPrice(item) ?? 0} astra • `,
                    item.id || `pack-${index}`,
                    () => act(sellInventoryItem, index),
                    "Sell",
                    favorite,
                    false,
                    true,
                  )}
                </div>
              );
            })}
            {equipped.map(([slot, item]) => {
              const key = `equipment:${slot}:${getInventoryItemKey(item)}`;
              const favorite = isFavorite(player, "gear", item);
              return (
                <div className='gear-trader-selectable' key={item.id || slot}>
                  <input
                    type='checkbox'
                    aria-label={`Select equipped ${item.name} to sell`}
                    checked={selectedGearKeys.includes(key)}
                    disabled={favorite}
                    onChange={() => setSelectedGearToSell((current) =>
                      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
                    )}
                  />
                  {gearButton(
                    item,
                    favorite ? "Favorite • equipped, cannot sell " : `Sell for ${getSellPrice(item) ?? 0} astra • Equipped `,
                    item.id || slot,
                    () => {
                      const result = sellEquippedItem(slot);
                      if (result.ok) {
                        setSelectedGearToSell([]);
                        setSelectedGemsToSell([]);
                        setNote(`${result.item.name}: ${result.value} astra.`);
                        refresh();
                        return true;
                      } else {
                        setNote(result.reason === "favorite"
                          ? "Unfavorite that item in your inventory before selling it."
                          : "That gear can no longer be traded.");
                        return false;
                      }
                    },
                    "Sell",
                    favorite,
                    true,
                    true,
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {tab === "sellGems" && (
        <div className='gear-trader-list'>
          <div className='gear-trader-bulk-actions'>
            <button
              type='button'
              className='buttons'
              onClick={() => setSelectedGemsToSell(sellableGems.map(({ key }) => key))}
              disabled={!sellableGems.length}
            >
              Select all sellable gems
            </button>
            <button
              type='button'
              className='buttons'
              onClick={sellSelectedGems}
              disabled={!selectedGemKeys.length}
            >
              Sell selected ({selectedGemKeys.length} • {selectedGemsValue} astra)
            </button>
            <button
              type='button'
              className='buttons'
              onClick={() => setSelectedGemsToSell([])}
              disabled={!selectedGemKeys.length}
            >
              Clear selection
            </button>
          </div>
          {!gemstones.length && (
            <div className='equip-empty'>You have no gems to sell.</div>
          )}
          <div className='inventory-list'>
            {gemstones.map((gemstone, index) => {
              const favorite = isFavorite(player, "gemstones", gemstone);
              const key = `${index}:${gemstone.id || JSON.stringify(gemstone)}`;
              return (
                <div className='gear-trader-selectable' key={gemstone.id || index}>
                  <input
                    type='checkbox'
                    aria-label={`Select ${gemstone.name} to sell`}
                    checked={selectedGemKeys.includes(key)}
                    disabled={favorite}
                    onChange={() => setSelectedGemsToSell((current) =>
                      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
                    )}
                  />
                  <Tooltip content={gemstoneTooltip(gemstone)}>
                    <button
                      type='button'
                      className={`inventory-item ${favorite ? "favorite-item" : ""}`}
                      aria-disabled={favorite || undefined}
                      onClick={() => act(sellGemstone, index)}
                    >
                      <strong style={{ color: RARITY_COLORS[gemstone.rarity] }}>
                        {gemstone.name}
                      </strong>
                      <span>{favorite ? "Favorite • cannot sell " : `Sell for ${getGemstoneValue(gemstone) ?? 0} astra`}</span>
                    </button>
                  </Tooltip>
                </div>
              );
            })}
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
                "Buy back",
                (player.astra || 0) < price,
              ),
            )}
          </div>
        </div>
      )}
      {tab === "buy" && (
        <div className='gear-trader-list'>
          <div className='recipe-note'>
            New stock arrives every 30 minutes. Higher town reputation improves
            gear quality.
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
                "Buy",
                (player.astra || 0) < item.price,
              ),
            )}
          </div>
        </div>
      )}
      <div className='recipe-note'>
        {note ||
          "Click gear to inspect its stats and choose an action."}
      </div>
      {selectedGear && (
        <ItemPopup
          item={selectedGear.item}
          onClose={() => setSelectedGear(null)}
          comparison={{ open: compareSelected, onToggle: () => setCompareSelected((open) => !open) }}
          actions={[
            ...(selectedGear.canFavorite ? [{
              label: isFavorite(player, "gear", selectedGear.item) ? "Unfavorite" : "Favorite",
              onClick: () => {
                const result = toggleFavorite("gear", selectedGear.item);
                if (result.ok) {
                  setSelectedGear((current) => ({ ...current }));
                  refresh();
                }
                else setNote(result.message);
              },
            }] : []),
            {
              label: selectedGear.tradeLabel,
              disabled: selectedGear.canFavorite
                ? isFavorite(player, "gear", selectedGear.item)
                : selectedGear.unavailable,
              onClick: () => {
                if (selectedGear.onTrade()) setSelectedGear(null);
              },
            },
          ]}
        />
      )}
    </div>
  );
};

const Equipment = ({ player, onChange, locked }) => {
  const [selectedGear, setSelectedGear] = useState(null);
  const [compareSelected, setCompareSelected] = useState(false);
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
            return (
              <Tooltip key={slot.key} content={item ? itemTooltip(item) : null}>
                <button
                  type='button'
                  className={`equip-slot ${item ? "filled" : ""}`}
                  style={getHolofoilStyle(item)}
                  disabled={!item}
                  onClick={() => {
                    if (item) {
                      setCompareSelected(false);
                      setSelectedGear({ item, slotKey: slot.key });
                    }
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
      {selectedGear && (
        <ItemPopup
          item={selectedGear.item}
          onClose={() => setSelectedGear(null)}
          comparison={{ open: compareSelected, onToggle: () => setCompareSelected((open) => !open) }}
          actions={[
            {
              label: isFavorite(player, "gear", selectedGear.item) ? "Unfavorite" : "Favorite",
              onClick: () => {
                toggleFavorite("gear", selectedGear.item);
                onChange();
              },
            },
            {
              label: "Unequip",
              disabled: locked,
              onClick: () => {
                unequipItem(selectedGear.slotKey);
                setSelectedGear(null);
                onChange();
              },
            },
          ]}
        />
      )}
    </div>
  );
};

const INVENTORY_TABS = [
  { key: "gear", label: "Gear" },
  { key: "consumables", label: "Consumables" },
  { key: "gemstones", label: "Gemstones" },
  { key: "materials", label: "Materials" },
  { key: "keyItems", label: "Key Items" },
  { key: "titles", label: "Titles" },
];

const GEAR_SORTS = [
  ["inventory", "Inventory order"],
  ["slot", "Slot"],
  ["levelDesc", "Item level: high to low"],
  ["levelAsc", "Item level: low to high"],
  ["gearScoreDesc", "Gear score: high to low"],
  ["rarityDesc", "Rarity: high to low"],
  ["nameAsc", "Name: A to Z"],
];

const ItemTargetPopup = ({
  title,
  description,
  targets,
  selectedId,
  onSelect,
  onClose,
  emptyMessage,
  locked,
  children,
}) => {
  const popup = useRef(null);
  useEffect(() => {
    (
      popup.current?.querySelector(".gemstone-popup-target:not(:disabled)") ||
      popup.current?.querySelector("button:not(:disabled)")
    )?.focus();
  }, []);
  return (
    <div
      className='item-popup-backdrop gemstone-popup-backdrop'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={popup}
        className='item-popup gemstone-popup'
        role='dialog'
        aria-modal='true'
        aria-label={title}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key === "Tab") {
            const focusable = event.currentTarget.querySelectorAll(
              "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
            );
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <button
          type='button'
          className='item-popup-close'
          aria-label='Close item selection'
          onClick={onClose}
        >
          ×
        </button>
        <h4>{title}</h4>
        <p className='gemstone-popup-description'>{description}</p>
        {targets.length ? (
          <div className='gemstone-popup-targets'>
            {targets.map(({ item, label }) => (
              <button
                key={`${label}-${item.id}`}
                type='button'
                className={`gemstone-popup-target ${selectedId === item.id ? "selected" : ""}`}
                aria-pressed={selectedId === item.id}
                style={getHolofoilStyle(item)}
                disabled={locked}
                onClick={() => onSelect(item.id)}
              >
                <span>{label}</span>
                <strong style={{ color: RARITY_COLORS[item.rarity] }}>{item.name}</strong>
                <span>{item.rarity || "Equipment"}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className='equip-empty'>{emptyMessage}</div>
        )}
        {children}
        <div className='item-popup-actions'>
          <button type='button' className='buttons' onClick={onClose}>Cancel</button>
        </div>
      </section>
    </div>
  );
};

const Inventory = ({ player, onChange, locked }) => {
  const [tab, setTab] = useState("gear");
  const [favoriteFilter, setFavoriteFilter] = useState("");
  const [favoriteMessage, setFavoriteMessage] = useState("");
  const [selectedGear, setSelectedGear] = useState(null);
  const [compareSelected, setCompareSelected] = useState(false);
  const matchesFavorite = (category, item) => !favoriteFilter ||
    isFavorite(player, category, item) === (favoriteFilter === "favorites");
  const favoriteOrder = (category, a, b) =>
    Number(isFavorite(player, category, b)) - Number(isFavorite(player, category, a));
  const favoriteClass = (category, item) => isFavorite(player, category, item) ? "favorite-item" : "";
  const [selectedGemstone, setSelectedGemstone] = useState(null);
  const gemstonePopup = useRef(null);
  const gemstoneTrigger = useRef(null);
  const itemTargetTrigger = useRef(null);
  const [gemstoneMessage, setGemstoneMessage] = useState("");
  const [gemstoneFilters, setGemstoneFilters] = useState({
    query: "",
    stat: "",
    rarity: "",
    sort: "nameAsc",
  });
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [consumableMessage, setConsumableMessage] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [selectedRune, setSelectedRune] = useState(null);
  const [runeItemId, setRuneItemId] = useState("");
  const [runeStat, setRuneStat] = useState("");
  const [selectedAlloy, setSelectedAlloy] = useState(false);
  const [alloyItemId, setAlloyItemId] = useState("");
  const [renamingItem, setRenamingItem] = useState(false);
  const [renameItemId, setRenameItemId] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const gear = player.inventory || [];
  const [gearFilters, setGearFilters] = useState({
    query: "",
    sort: "inventory",
    slot: "",
    rarity: "",
    ability: "",
    stat: "",
    minStat: "",
    usable: false,
  });
  const [gearFiltersOpen, setGearFiltersOpen] = useState(false);
  const gemstones = player.gemstones || [];
  const chosenGemstone = gemstones.find((gemstone) => gemstone.id === selectedGemstone) || null;
  const gemstoneTerms = gemstoneFilters.query.toLowerCase().split(/\s+/).filter(Boolean);
  const filteredGemstones = gemstones
    .filter((gemstone) => {
      if (gemstoneFilters.stat && gemstone.stat !== gemstoneFilters.stat) return false;
      if (gemstoneFilters.rarity && gemstone.rarity !== gemstoneFilters.rarity) return false;
      const searchText = `${gemstone.name} ${gemstone.rarity} ${STAT_LABELS[gemstone.stat] || gemstone.stat}`.toLowerCase();
      return gemstoneTerms.every((term) => searchText.includes(term));
    })
    .sort((a, b) => {
      const rarityRank = (gemstone) => MARKET_RARITIES.indexOf(gemstone.rarity);
      const sorters = {
        nameAsc: () => a.name.localeCompare(b.name),
        rarityDesc: () => rarityRank(b) - rarityRank(a),
        statAsc: () => (STAT_LABELS[a.stat] || a.stat).localeCompare(STAT_LABELS[b.stat] || b.stat),
      };
      return (sorters[gemstoneFilters.sort]?.() || 0) || gemstones.indexOf(a) - gemstones.indexOf(b);
    });
  const availableGemstoneTargets = [
    ...SLOTS.filter((slot) => player.equipment?.[slot.key] && !player.equipment[slot.key].twoHandedOf)
      .map((slot) => ({
        target: { kind: "equipment", slotKey: slot.key },
        label: slot.label,
        item: player.equipment[slot.key],
      })),
    ...gear.map((item, index) => ({
      target: { kind: "inventory", index },
      label: "In pack",
      item,
    })).filter(({ item }) => !item.twoHandedOf),
  ].filter(({ item }) => !item.gemstone);
  const equippedGemstoneTargets = SLOTS.filter((slot) => {
    const item = player.equipment?.[slot.key];
    return item?.gemstone && !item.twoHandedOf;
  }).map((slot) => ({
    target: { kind: "equipment", slotKey: slot.key },
    label: slot.label,
    item: player.equipment[slot.key],
  }));
  const gemstoneFilterActive = gemstoneFilters.query || gemstoneFilters.stat || gemstoneFilters.rarity;
  useEffect(() => {
    if (selectedGemstone) {
      gemstonePopup.current?.querySelector("button:not(:disabled)")?.focus();
    } else if (gemstoneTrigger.current?.isConnected) {
      gemstoneTrigger.current.focus();
    }
  }, [selectedGemstone]);
  const consumables = getConsumables(player);
  const keyItems = getKeyItems(player);
  const materials = getMaterials(player);
  const gearAbilities = [...new Set(gear.map((item) => item.ability?.name).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const gearTerms = gearFilters.query.toLowerCase().split(/\s+/).filter(Boolean);
  const minGearStat = gearFilters.minStat === "" || !Number.isFinite(Number(gearFilters.minStat))
    ? null
    : Number(gearFilters.minStat);
  const filteredGear = gear
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (!matchesFavorite("gear", item)) return false;
      if (gearFilters.slot && item.slot !== gearFilters.slot) return false;
      if (gearFilters.rarity && item.rarity !== gearFilters.rarity) return false;
      if (gearFilters.usable && !canEquip(item, player.level)) return false;
      if (gearFilters.ability === "__any" && !item.ability) return false;
      if (gearFilters.ability === "__none" && item.ability) return false;
      if (gearFilters.ability && !gearFilters.ability.startsWith("__") && item.ability?.name !== gearFilters.ability) return false;
      if (gearFilters.stat) {
        const stats = getItemStats(item);
        if (!(gearFilters.stat in stats)) return false;
        const value = ["criticalDamage", "criticalHitChance", "evasion"].includes(gearFilters.stat)
          ? stats[gearFilters.stat] * 100
          : stats[gearFilters.stat];
        if (minGearStat !== null && value < minGearStat) return false;
      }
      if (gearTerms.length) {
        const slot = MARKET_SLOTS.find((s) => s.type === item.slot)?.label || item.slot;
        const searchText = [
          item.name,
          item.rarity,
          item.condition,
          slot,
          item.twoHanded && "two-handed",
          item.ability?.name,
          item.ability?.description,
          ...Object.keys(getItemStats(item)).map((key) => STAT_LABELS[key] || key),
          item.gemstone?.name,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!gearTerms.every((term) => searchText.includes(term))) return false;
      }
      return true;
    });
  const rarityOrder = MARKET_RARITIES;
  const sortedGear = filteredGear.sort((a, b) => {
    const slotRank = (item) => {
      const rank = SLOTS.findIndex((slot) => slot.type === item.slot);
      return rank < 0 ? Number.MAX_SAFE_INTEGER : rank;
    };
    const sorters = {
      slot: () => slotRank(a.item) - slotRank(b.item),
      levelDesc: () => (b.item.iLevel || 0) - (a.item.iLevel || 0),
      levelAsc: () => (a.item.iLevel || 0) - (b.item.iLevel || 0),
      gearScoreDesc: () => getItemGearScore(b.item) - getItemGearScore(a.item),
      rarityDesc: () => rarityOrder.indexOf(b.item.rarity) - rarityOrder.indexOf(a.item.rarity),
      nameAsc: () => String(a.item.name).localeCompare(String(b.item.name)),
    };
    return favoriteOrder("gear", a.item, b.item) || (sorters[gearFilters.sort]?.() || 0) || a.index - b.index;
  });
  const activeGearFilterCount = Object.entries(gearFilters)
    .filter(([key, value]) => key !== "sort" && value !== "" && value !== false).length;
  const setGearFilter = (key) => (event) => setGearFilters({
    ...gearFilters,
    [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value,
  });
  const closeItemTargetPopup = (close) => {
    close();
    if (itemTargetTrigger.current?.isConnected) itemTargetTrigger.current.focus();
  };
  const counts = {
    gear: gear.length,
    consumables: consumables.reduce((n, c) => n + c.count, 0),
    gemstones: gemstones.length,
    materials: materials.reduce((n, m) => n + m.count, 0),
    keyItems: keyItems.length,
    titles: (player.titles || []).filter((id) => TITLES[id]).length,
  };
  const titles = [...new Set((player.titles || []).filter((id) => TITLES[id]))];
  const use = (key) => {
    markInventoryItemViewed("consumables", key);
    const result = drinkConsumable(key);
    setConsumableMessage(result.message);
    if (result.requiresNameChange || result.requiresItemRename || result.requiresRune || result.requiresHolofoilReroll) {
      setRenaming(false);
      setRenamingItem(false);
      setSelectedRune(null);
      setSelectedAlloy(false);
    }
    if (result.requiresNameChange) {
      setNewName("");
      setRenaming(true);
    }
    if (result.requiresItemRename) {
      setRenamingItem(true);
      setRenameItemId("");
      setNewItemName("");
    }
    if (result.requiresRune) {
      setSelectedRune(key);
      setRuneItemId("");
      setRuneStat("");
    }
    if (result.requiresHolofoilReroll) {
      setSelectedAlloy(true);
      setAlloyItemId("");
    }
    onChange();
  };
  const runeTargets = [
    ...gear,
    ...Object.values(player.equipment || {}),
  ].filter(canApplyRune);
  const alloyTargets = [
    ...gear,
    ...Object.values(player.equipment || {}),
  ].filter(canApplyPrismaticAlloy);
  const renameTargets = [...gear, ...Object.values(player.equipment || {})].filter(canRenameItem);
  const alterationTargets = (targets) => [
    ...gear.map((item) => ({ item, label: "In pack" })),
    ...SLOTS.flatMap((slot) => {
      const item = player.equipment?.[slot.key];
      return item && !item.twoHandedOf ? [{ item, label: slot.label }] : [];
    }),
  ].filter(({ item }) => targets.includes(item));
  const runePopupTargets = alterationTargets(runeTargets);
  const alloyPopupTargets = alterationTargets(alloyTargets);
  const renamePopupTargets = alterationTargets(renameTargets);
  const renameGear = (e) => {
    e.preventDefault();
    if (locked) return;
    const result = renameItem(renameItemId, newItemName);
    setConsumableMessage(result.message);
    if (result.ok) closeItemTargetPopup(() => setRenamingItem(false));
    onChange();
  };
  const runeTarget = runeTargets.find((item) => item.id === runeItemId);
  const alloyTarget = alloyTargets.find((item) => item.id === alloyItemId);
  const applyAlloy = (e) => {
    e.preventDefault();
    if (locked) return;
    const result = applyPrismaticAlloy(alloyItemId);
    setConsumableMessage(result.message);
    if (result.ok) closeItemTargetPopup(() => setSelectedAlloy(false));
    onChange();
  };
  const craftWithRune = (e) => {
    e.preventDefault();
    if (locked) return;
    const result = applyRune(selectedRune, runeItemId, runeStat);
    setConsumableMessage(result.message);
    if (result.ok) closeItemTargetPopup(() => setSelectedRune(null));
    onChange();
  };
  const rename = async (e) => {
    e.preventDefault();
    if (savingName || locked) return;
    setSavingName(true);
    try {
      const result = await savePlayerName(newName);
      setConsumableMessage(result.message);
      if (result.ok) setRenaming(false);
      onChange();
    } finally {
      setSavingName(false);
    }
  };
  const isNew = (category, key) =>
    (player.unseenInventoryItems?.[category] || []).includes(key);
  const viewItem = (category, key) => {
    markInventoryItemViewed(category, key);
    onChange();
  };
  const applyGemstone = (target) => {
    const result = socketGemstone(selectedGemstone, target);
    if (result.ok) {
      setSelectedGemstone(null);
      setGemstoneMessage("Gemstone socketed.");
    } else {
      setGemstoneMessage(result.reason === "combat" ? "You can't change gemstones during combat." : "That gear can't accept a gemstone.");
    }
    onChange();
  };
  const extractGemstone = (target, gemstone) => {
    const cost = getGemstoneRemovalCost(gemstone);
    const result = removeGemstone(target);
    setGemstoneMessage(
      result.ok
        ? `Gemstone removed for ${result.cost} astra.`
        : result.reason === "combat"
          ? "You can't change gemstones during combat."
          : result.reason === "astra"
            ? `You need ${cost} astra to remove this gemstone.`
            : "That gemstone can't be removed.",
    );
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
              onClick={() => {
                setSelectedGear(null);
                setTab(t.key);
              }}
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
        {tab === "gear" && <p className='recipe-kind'>Select gear to inspect its details and choose an action.</p>}
        {tab === "gear" && <select className='input-field inventory-favorite-filter' aria-label='Filter favorites' value={favoriteFilter} onChange={(event) => setFavoriteFilter(event.target.value)}>
          <option value=''>All items</option>
          <option value='favorites'>Favorites only</option>
          <option value='nonFavorites'>Non-favorites only</option>
        </select>}
        {favoriteMessage && <div role='status'>{favoriteMessage}</div>}
        {tab === "gear" && favoriteFilter && !gear.some((item) => matchesFavorite("gear", item)) && (
          <div className='equip-empty'>No items match this favorites filter.</div>
        )}
        {tab === "titles" && (
          <div className='inventory-list'>
            {!titles.length && <div className='equip-empty'>You have no titles yet. Titles can be claimed from mail.</div>}
            {titles.map((id) => {
              const title = TITLES[id];
              const equipped = player.activeTitle === id;
              return (
                <button
                  key={id}
                  type='button'
                  className={`inventory-item ${equipped ? "equipped-title" : ""}`}
                  aria-pressed={equipped}
                  onClick={() => {
                    setPlayer({ activeTitle: equipped ? null : id });
                    onChange();
                  }}
                >
                  <Tooltip content={titleTooltip(title)}>
                    <strong style={{ color: title.color }}>{title.name}</strong>
                  </Tooltip>
                  <span>{title.rarity} title{equipped ? " · Equipped (click to unequip)" : " · Click to equip"}</span>
                </button>
              );
            })}
          </div>
        )}
        {tab === "gear" && (
          <>
            {gear.length === 0 && (
              <div className='equip-empty'>You have no gear in your pack.</div>
            )}
            <button
              type='button'
              className='buttons market-filters-toggle'
              aria-expanded={gearFiltersOpen}
              onClick={() => setGearFiltersOpen((open) => !open)}
            >
              Search &amp; Filters{activeGearFilterCount ? ` (${activeGearFilterCount})` : ""} {gearFiltersOpen ? "▴" : "▾"}
            </button>
            <div className={`market-filters ${gearFiltersOpen ? "open" : ""}`}>
              <input
                className='input-field market-search'
                aria-label='Search gear'
                placeholder='Search name, ability, stat...'
                value={gearFilters.query}
                onChange={setGearFilter("query")}
              />
              <select className='input-field' aria-label='Sort gear' value={gearFilters.sort} onChange={setGearFilter("sort")}>
                {GEAR_SORTS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <select className='input-field' aria-label='Slot' value={gearFilters.slot} onChange={setGearFilter("slot")}>
                <option value=''>Any slot</option>
                {MARKET_SLOTS.map((slot) => <option key={slot.type} value={slot.type}>{slot.label}</option>)}
              </select>
              <select className='input-field' aria-label='Rarity' value={gearFilters.rarity} onChange={setGearFilter("rarity")}>
                <option value=''>Any rarity</option>
                {MARKET_RARITIES.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
              </select>
              <select className='input-field' aria-label='Ability' value={gearFilters.ability} onChange={setGearFilter("ability")}>
                <option value=''>Any ability</option>
                <option value='__any'>Has an ability</option>
                <option value='__none'>No ability</option>
                {gearAbilities.map((ability) => <option key={ability} value={ability}>{ability}</option>)}
              </select>
              <select className='input-field' aria-label='Stat' value={gearFilters.stat} onChange={setGearFilter("stat")}>
                <option value=''>Any stat</option>
                {MARKET_STATS.map((stat) => <option key={stat.key} value={stat.key}>{stat.label}</option>)}
              </select>
              {gearFilters.stat && (
                <input
                  className='input-field market-num'
                  aria-label='Minimum stat'
                  type='number'
                  min='0'
                  placeholder='Min stat'
                  value={gearFilters.minStat}
                  onChange={setGearFilter("minStat")}
                />
              )}
              <label className='market-check'>
                <input type='checkbox' checked={gearFilters.usable} onChange={setGearFilter("usable")} />
                Usable at my level
              </label>
              <button type='button' className='buttons' onClick={() => setGearFilters({
                query: "", sort: "inventory", slot: "", rarity: "", ability: "", stat: "", minStat: "", usable: false,
              })}>
                Reset
              </button>
            </div>
            <div className='inventory-list'>
              {gear.length > 0 && sortedGear.length === 0 && (
                <div className='equip-empty'>No gear matches these filters.</div>
              )}
              {sortedGear.map(({ item, index }) => (
                <Tooltip key={item.id || index} content={itemTooltip(item)}>
                  <button
                    type='button'
                    className={`inventory-item ${canEquip(item, player.level) ? "" : "too-high"} ${favoriteClass("gear", item)}`}
                    style={getHolofoilStyle(item)}
                    onClick={() => {
                      markInventoryItemViewed("gear", getInventoryItemKey(item));
                      onChange();
                      setCompareSelected(false);
                      setSelectedGear({ item, index });
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
            {consumableMessage && <div role='status'>{consumableMessage}</div>}
            {selectedRune && (
              <ItemTargetPopup
                title={`Use ${CONSUMABLES[selectedRune].name}`}
                description='Choose an eligible item to use this rune on.'
                targets={runePopupTargets}
                selectedId={runeItemId}
                onSelect={(id) => { setRuneItemId(id); setRuneStat(""); }}
                onClose={() => closeItemTargetPopup(() => setSelectedRune(null))}
                emptyMessage='You have no eligible items. Crafted items cannot receive runes.'
                locked={locked}
              >
                <form className='input-form item-input-form' onSubmit={craftWithRune}>
                  {selectedRune === "architectsRune" && runeTarget && (
                    <>
                      <label>
                        New main stat
                        <select className='input-field' value={runeStat} disabled={locked} onChange={(e) => setRuneStat(e.target.value)}>
                          <option value=''>Choose a stat</option>
                          {RUNE_MAIN_STATS.filter((stat) => stat !== runeTarget.mainStat.stat).map((stat) => <option key={stat} value={stat}>{STAT_LABELS[stat]}</option>)}
                        </select>
                      </label>
                      <p>Keeps the main stat's value and tier. Adds Crafted, preventing any further rune use.</p>
                    </>
                  )}
                  {selectedRune === "runeOfUnpredictability" && (
                    <p>Randomly does nothing, changes a substat tier or type, or adds a substat line. Adds Crafted, preventing any further rune use.</p>
                  )}
                  <button type='submit' className='buttons' disabled={locked || !runeTarget || (selectedRune === "architectsRune" && !runeStat)}>Apply rune</button>
                </form>
              </ItemTargetPopup>
            )}
            {selectedAlloy && (
              <ItemTargetPopup
                title='Use Prismatic Alloy'
                description='Choose an item to apply or reroll its Holofoil.'
                targets={alloyPopupTargets}
                selectedId={alloyItemId}
                onSelect={setAlloyItemId}
                onClose={() => closeItemTargetPopup(() => setSelectedAlloy(false))}
                emptyMessage='You have no equipment items to apply the alloy to.'
                locked={locked}
              >
                <form className='input-form item-input-form' onSubmit={applyAlloy}>
                  <button type='submit' className='buttons' disabled={locked || !alloyTarget}>Apply alloy</button>
                </form>
              </ItemTargetPopup>
            )}
            {renamingItem && (
              <ItemTargetPopup
                title='Use Item Certificate'
                description='Choose an item to rename.'
                targets={renamePopupTargets}
                selectedId={renameItemId}
                onSelect={setRenameItemId}
                onClose={() => closeItemTargetPopup(() => setRenamingItem(false))}
                emptyMessage='You have no equipment to rename.'
                locked={locked}
              >
                {renameItemId && (
                  <form className='input-form item-input-form' onSubmit={renameGear}>
                    <label>
                      New item name
                      <input className='input-field' value={newItemName} onChange={(e) => setNewItemName(e.target.value)} maxLength={64} disabled={locked} />
                    </label>
                    <p>Letters, numbers, and spaces only, up to 64 characters. Inappropriate names are not allowed.</p>
                    <button type='submit' className='buttons' disabled={locked || !newItemName.trim()}>Rename item</button>
                  </form>
                )}
              </ItemTargetPopup>
            )}
            {renaming && (
              <form className='input-form item-input-form' onSubmit={rename}>
                <label>
                  New character name
                  <input className='input-field' value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={64} disabled={savingName || locked} autoFocus />
                </label>
                <button type='submit' className='buttons' disabled={savingName || locked}>Save name</button>
                <button type='button' className='buttons' disabled={savingName} onClick={() => setRenaming(false)}>Cancel</button>
              </form>
            )}
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
                    disabled={locked || savingName}
                    className={`inventory-item ${favoriteClass("consumables", c)}`}
                    onClick={(event) => {
                      itemTargetTrigger.current = event.currentTarget;
                      use(c.key);
                    }}
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
        {tab === "gemstones" && (
          <div className='gemstone-workbench'>
            <div className='gemstone-intro'>
              <div>
                <h4>Gemstone Socketing</h4>
                <p>Socket and unsocket gemstones into your gear.</p>
              </div>
              <span className='gemstone-count'>{gemstones.length} available</span>
            </div>
            {locked && (
              <div className='progression-locked' role='status'>
                You can't socket or remove gemstones during combat.
              </div>
            )}
            {gemstoneMessage && <div className='gemstone-message' role='status'>{gemstoneMessage}</div>}
            <section className='gemstone-section' aria-labelledby='gemstone-inventory-heading'>
              <div className='gemstone-section-heading'>
                <h4 id='gemstone-inventory-heading'>Your gemstones</h4>
                <span>{filteredGemstones.length} of {gemstones.length}</span>
              </div>
              {gemstones.length > 0 && (
                <div className='gemstone-filters' aria-label='Gemstone filters'>
                  <input
                    className='input-field gemstone-search'
                    type='search'
                    aria-label='Search gemstones'
                    placeholder='Search name or stat'
                    value={gemstoneFilters.query}
                    onChange={(event) => setGemstoneFilters({ ...gemstoneFilters, query: event.target.value })}
                  />
                  <select
                    className='input-field'
                    aria-label='Filter gemstones by stat'
                    value={gemstoneFilters.stat}
                    onChange={(event) => setGemstoneFilters({ ...gemstoneFilters, stat: event.target.value })}
                  >
                    <option value=''>All stats</option>
                    {[...new Set(gemstones.map((gemstone) => gemstone.stat))].sort().map((stat) => (
                      <option key={stat} value={stat}>{STAT_LABELS[stat] || stat}</option>
                    ))}
                  </select>
                  <select
                    className='input-field'
                    aria-label='Filter gemstones by rarity'
                    value={gemstoneFilters.rarity}
                    onChange={(event) => setGemstoneFilters({ ...gemstoneFilters, rarity: event.target.value })}
                  >
                    <option value=''>All rarities</option>
                    {[...new Set(gemstones.map((gemstone) => gemstone.rarity))]
                      .sort((a, b) => MARKET_RARITIES.indexOf(a) - MARKET_RARITIES.indexOf(b))
                      .map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
                  </select>
                  <select
                    className='input-field'
                    aria-label='Sort gemstones'
                    value={gemstoneFilters.sort}
                    onChange={(event) => setGemstoneFilters({ ...gemstoneFilters, sort: event.target.value })}
                  >
                    <option value='nameAsc'>Name: A to Z</option>
                    <option value='rarityDesc'>Rarity: high to low</option>
                    <option value='statAsc'>Stat: A to Z</option>
                  </select>
                  {gemstoneFilterActive && (
                    <button
                      type='button'
                      className='buttons gemstone-reset'
                      onClick={() => setGemstoneFilters({ ...gemstoneFilters, query: "", stat: "", rarity: "" })}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
              {gemstones.length === 0 ? (
                <div className='equip-empty'>You have no gemstones. Enemies may drop them.</div>
              ) : filteredGemstones.length === 0 ? (
                <div className='equip-empty'>No gemstones match these filters.</div>
              ) : (
                <div className='inventory-list gemstone-inventory'>
                  {filteredGemstones.map((gemstone) => (
                    <Tooltip
                      key={gemstone.id}
                      onView={() => viewItem("gemstones", gemstone.id)}
                      content={gemstoneTooltip(gemstone)}
                    >
                      <button
                        type='button'
                        aria-haspopup='dialog'
                        className={`inventory-item gemstone-item ${favoriteClass("gemstones", gemstone)}`}
                        disabled={locked}
                        onClick={(event) => {
                          markInventoryItemViewed("gemstones", gemstone.id);
                          gemstoneTrigger.current = event.currentTarget;
                          setSelectedGemstone(gemstone.id);
                          setGemstoneMessage("");
                          onChange();
                        }}
                      >
                        {isNew("gemstones", gemstone.id) && (
                          <span className='inventory-new-dot' aria-label='New item' />
                        )}
                        <strong style={{ color: RARITY_COLORS[gemstone.rarity] }}>
                          {gemstone.name}
                        </strong>
                        <span className='gemstone-item-stat'>
                          {STAT_LABELS[gemstone.stat] || gemstone.stat} +{gemstone.value}
                        </span>
                        <span className='gemstone-item-hint'>
                          {gemstone.rarity} · click to socket
                        </span>
                      </button>
                    </Tooltip>
                  ))}
                </div>
              )}
            </section>
            <section className='gemstone-section' aria-labelledby='gemstone-equipped-heading'>
              <div className='gemstone-section-heading'>
                <h4 id='gemstone-equipped-heading'>Equipped gemstones</h4>
                <span>Click an equipped item to remove its gemstone</span>
              </div>
              {!equippedGemstoneTargets.length ? (
                <div className='equip-empty'>No equipped gear has a gemstone socketed.</div>
              ) : (
                <div className='gemstone-targets'>
                  {equippedGemstoneTargets.map(({ target, label, item }) => {
                    const cost = getGemstoneRemovalCost(item.gemstone);
                    return (
                      <button
                        type='button'
                        className={`gemstone-equipped-card ${target.kind === "equipment" ? "equipped-gear" : ""}`}
                        style={getHolofoilStyle(item)}
                        key={`${target.kind}-${target.slotKey ?? target.index}`}
                        disabled={locked || (player.astra || 0) < cost}
                        aria-label={`Remove ${item.gemstone.name} from ${item.name} for ${cost} astra`}
                        onClick={() => extractGemstone(target, item.gemstone)}
                      >
                        <span className='gemstone-target-location'>{label}</span>
                        <strong style={{ color: RARITY_COLORS[item.rarity] }}>{item.name}</strong>
                        <span className='gemstone-socket-status'>
                          Socketed: {item.gemstone.name} · {STAT_LABELS[item.gemstone.stat] || item.gemstone.stat} +{item.gemstone.value}
                        </span>
                        <span className='gemstone-unsocket-hint'>
                          {locked ? "Unavailable during combat" : (player.astra || 0) < cost ? `Need ${cost} astra` : `Click to remove · ${cost} astra`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
            {chosenGemstone && (
              <div
                className='item-popup-backdrop gemstone-popup-backdrop'
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setSelectedGemstone(null);
                }}
              >
                <section
                  ref={gemstonePopup}
                  className='item-popup gemstone-popup'
                  role='dialog'
                  aria-modal='true'
                  aria-labelledby='gemstone-popup-title'
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setSelectedGemstone(null);
                    if (event.key === "Tab") {
                      const buttons = event.currentTarget.querySelectorAll("button:not(:disabled)");
                      const first = buttons[0];
                      const last = buttons[buttons.length - 1];
                      if (event.shiftKey && document.activeElement === first) {
                        event.preventDefault();
                        last.focus();
                      } else if (!event.shiftKey && document.activeElement === last) {
                        event.preventDefault();
                        first.focus();
                      }
                    }
                  }}
                >
                  <button
                    type='button'
                    className='item-popup-close'
                    aria-label='Close gemstone gear selection'
                    onClick={() => setSelectedGemstone(null)}
                  >
                    ×
                  </button>
                  <h4 id='gemstone-popup-title'>Socket {chosenGemstone.name}</h4>
                  <p className='gemstone-popup-description'>
                    {STAT_LABELS[chosenGemstone.stat] || chosenGemstone.stat} +{chosenGemstone.value}. Choose gear with an empty socket.
                  </p>
                  {availableGemstoneTargets.length ? (
                    <div className='gemstone-popup-targets'>
                      {availableGemstoneTargets.map(({ target, label, item }) => (
                        <button
                          key={`${target.kind}-${target.slotKey ?? target.index}`}
                          type='button'
                          className='gemstone-popup-target'
                          aria-label={`Socket ${chosenGemstone.name} into ${item.name} (${label})`}
                          style={getHolofoilStyle(item)}
                          disabled={locked}
                          onClick={() => applyGemstone(target)}
                        >
                          <span>{label}</span>
                          <strong style={{ color: RARITY_COLORS[item.rarity] }}>{item.name}</strong>
                          <span>Empty socket · Socket into {item.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className='equip-empty'>No gear with an empty socket can accept this gemstone.</div>
                  )}
                  <div className='item-popup-actions'>
                    <button type='button' className='buttons' onClick={() => setSelectedGemstone(null)}>Cancel</button>
                  </div>
                </section>
              </div>
            )}
          </div>
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
                  <div className={`inventory-item ${favoriteClass("materials", m)}`}>
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
                  <div className={`inventory-item ${favoriteClass("keyItems", k)}`}>
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
      {selectedGear && tab === "gear" && (
        <ItemPopup
          item={selectedGear.item}
          onClose={() => setSelectedGear(null)}
          comparison={{ open: compareSelected, onToggle: () => setCompareSelected((open) => !open) }}
          actions={[
            {
              label: isFavorite(player, "gear", selectedGear.item) ? "Unfavorite" : "Favorite",
              onClick: () => {
                const result = toggleFavorite("gear", selectedGear.item);
                setFavoriteMessage(result.ok ? "" : result.message);
                onChange();
              },
            },
            {
              label: "Equip",
              disabled: locked || !canEquip(selectedGear.item, player.level),
              onClick: () => {
                const result = equipItem(selectedGear.index);
                if (result.ok) setSelectedGear(null);
                onChange();
              },
            },
          ]}
        />
      )}
    </div>
  );
};

const CharacterScreen = ({ player: initial, inCombat, onChange }) => {
  const [player, setPlayerState] = useState(initial);
  const refresh = () => {
    setPlayerState(getPlayer());
    onChange?.();
  };
  if (!player) return <div className='panel'>No character yet.</div>;
  return (
    <div className='panel character-layout'>
      <div className='character-main'>
        <CharacterSummary player={player} />
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

const STAT_POINT_AMOUNTS = [1, 5, 10];

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
                <span className='spend-buttons'>
                  {STAT_POINT_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      type='button'
                      className='spend-button'
                      aria-label={`Add ${amount} ${label}`}
                      disabled={inCombat || statPoints < amount}
                      onClick={() => onSpend(key, amount)}
                    >
                      +{amount}
                    </button>
                  ))}
                </span>
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
  const spend = (key, amount) => {
    if (spendStatPoint(key, amount).ok) refresh();
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
      <div className='recipe-kind'>Available (new notices in <Countdown getMs={getQuestBoardRefreshMs} onRollover={onChange} />)</div>
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
  adventure: { label: "Gameplay", sidebarGroup: "adventure", link: true, component: AdventureScreen },
  dungeons: { label: "Adventures", sidebarGroup: "adventure", link: true, minLevel: DUNGEON_MIN_LEVEL, adminAccess: true, component: DungeonsScreen },
  arena: { label: "Arena", sidebarGroup: "adventure", link: true, component: ArenaScreen },
  character: {
    label: "Character",
    sidebarGroup: "character",
    link: true,
    component: CharacterScreen,
    notification: (p) =>
      ["gear", "consumables", "gemstones"].some(
        (category) => p.unseenInventoryItems?.[category]?.length > 0,
      ),
  },
  progression: {
    label: "Progression",
    sidebarGroup: "character",
    link: true,
    component: ProgressionScreen,
    badge: (p) => getUnspentPoints(p),
  },
  quests: {
    label: "Quests",
    sidebarGroup: "character",
    link: true,
    component: QuestsScreen,
    badge: (p) => getReadyQuestCount(p),
  },
  inbox: {
    label: "Inbox",
    sidebarGroup: "character",
    link: true,
    component: InboxScreen,
    badge: () => getUnreadCount(),
  },
  leaderboards: { label: "Leaderboards", sidebarGroup: "community", link: true, component: LeaderboardScreen },
  changelog: { label: "Changelog", sidebarGroup: "community", link: true, component: ChangelogScreen },
  bugReport: { label: "Report a Bug", sidebarGroup: "community", link: true, component: BugReportScreen },
  admin: { label: "Admin", link: true, adminOnly: true, component: AdminScreen },
  combat: { label: "Combat", component: CombatScreen, hideUnlessActive: true },
  dungeonRun: { label: "Dungeon", component: DungeonRunScreen, hideUnlessActive: true },
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
  marketplace: {
    label: "Marketplace",
    component: MarketplaceScreen,
    hideUnlessActive: true,
    minLevel: MARKETPLACE_MIN_LEVEL,
  },
  questBoard: {
    label: "Quest Board",
    component: QuestBoardScreen,
    hideUnlessActive: true,
  },
  forge: {
    label: "Forge",
    component: ForgeScreen,
    hideUnlessActive: true,
  },
};

export const DEFAULT_SCREEN = "adventure";
