import { useEffect, useMemo, useState } from "react";
import { getPlayer } from "../character/player";
import { RARITY_COLORS, STAT_LABELS, canEquip, formatValue, gemstoneTooltip, getEquipLevel, itemComparisonTooltip, itemTooltip } from "../items/items";
import { getItemGearScore } from "../items/gearScore";
import { consumableTooltip, getConsumables } from "../items/consumables";
import { getMaterials, materialTooltip, MATERIAL_TIERS } from "../items/materials";
import {
  DEFAULT_FILTERS,
  MARKET_RARITIES,
  MARKET_SLOTS,
  MARKET_STATS,
  MARKETPLACE_MIN_LEVEL,
  MAX_LISTINGS,
  SORTS,
  buyListing,
  cancelListing,
  filterListings,
  getAbilityNames,
  getMyUid,
  getPayout,
  getTax,
  isMarketUnlocked,
  isConsumableListing,
  isGemstoneListing,
  isMaterialListing,
  listItem,
  sortListings,
  subscribeListings,
} from "../world/marketplace";
import Tooltip from "./Tooltip";

const TABS = [
  ["browse", "Browse"],
  ["sell", "Sell"],
  ["mine", "My Listings"],
];

const slotLabel = (item) => MARKET_SLOTS.find((s) => s.type === item.slot)?.label || item.slot;
const itemRarity = (item) => item.rarity || MATERIAL_TIERS[item.tier]?.label;
const itemColor = (item) => RARITY_COLORS[itemRarity(item)] || MATERIAL_TIERS[item.tier]?.color || "#7bd88f";
const itemKindLabel = (item) => isConsumableListing(item)
  ? "Consumable"
  : isMaterialListing(item)
    ? `${MATERIAL_TIERS[item.tier]?.label || "Material"} Material`
    : isGemstoneListing(item)
      ? `${item.rarity} Gemstone`
      : `${item.rarity} ${slotLabel(item)}`;

// Card body shared by every tab: name, rarity/slot, level, main stat, ability, then a tab-specific footer.
const ItemCard = ({ item, tooltip, selected, dimmed, onClick, children }) => (
  <Tooltip content={tooltip}>
    <button
      type='button'
      className={`market-card ${selected ? "selected" : ""} ${dimmed ? "dimmed" : ""}`}
      style={{ "--rarity": itemColor(item) }}
      onClick={onClick}
    >
      <strong className='market-card-name' style={{ color: itemColor(item) }}>
        {item.name}
      </strong>
      <span className='market-card-sub'>
        {itemKindLabel(item)}
        {item.twoHanded ? " • Two-handed" : ""}
      </span>
      {item.kind === "material" && <span className='market-card-sub'>{item.count} available</span>}
      {item.kind === "gemstone" && <span className='market-card-stat'>
        {formatValue(item.stat, item.value)} {STAT_LABELS[item.stat] || item.stat}
      </span>}
      {item.kind !== "consumable" && item.kind !== "material" && item.kind !== "gemstone" && <span className='market-card-sub'>
        iLvl {item.iLevel || 1} • Equip {getEquipLevel(item)} • GS {getItemGearScore(item)}
      </span>}
      {item.mainStat?.stat && (
        <span className='market-card-stat'>
          {formatValue(item.mainStat.stat, item.mainStat.value)} {STAT_LABELS[item.mainStat.stat] || item.mainStat.stat}
        </span>
      )}
      {item.ability?.name && <span className='market-card-ability'>{item.ability.name}</span>}
      {children}
    </button>
  </Tooltip>
);

const countActiveFilters = (filters) =>
  Object.keys(DEFAULT_FILTERS).filter((k) => k !== "sort" && filters[k] !== DEFAULT_FILTERS[k]).length;

const KindFilter = ({ filters, setFilters }) => (
  <select className='input-field' value={filters.kind} aria-label='Item type' onChange={(e) => setFilters({
    ...filters, kind: e.target.value, slot: "", rarity: "", tier: "", ability: "", stat: "", minStat: "",
      sort: "newest",
    })}>
    <option value=''>All item types</option>
    <option value='gear'>Gear</option>
    <option value='consumable'>Consumables</option>
    <option value='material'>Materials</option>
    <option value='gemstone'>Gemstones</option>
  </select>
);

// On small screens the whole bar collapses behind a toggle button (see .market-filters-toggle in App.css).
const Filters = ({ filters, setFilters, abilities }) => {
  const [open, setOpen] = useState(false);
  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const active = countActiveFilters(filters);
  return (
    <>
    <button
      type='button'
      className='buttons market-filters-toggle'
      aria-expanded={open}
      onClick={() => setOpen((o) => !o)}
    >
      Search &amp; Filters{active ? ` (${active})` : ""} {open ? "▴" : "▾"}
    </button>
    <div className={`market-filters ${open ? "open" : ""}`}>
      <KindFilter filters={filters} setFilters={setFilters} />
      <input className='input-field market-search' placeholder='Search name, ability, stat, seller...' value={filters.query} onChange={set("query")} />
      <select className='input-field' value={filters.sort} onChange={set("sort")} aria-label='Sort'>
        {SORTS.filter(([key]) => {
          if (filters.kind === "material") return ["newest", "oldest", "priceAsc", "priceDesc", "tierDesc", "quantityDesc", "nameAsc"].includes(key);
          if (filters.kind === "gemstone") return ["newest", "oldest", "priceAsc", "priceDesc", "rarityDesc", "statDesc", "nameAsc"].includes(key);
          if (filters.kind === "consumable") return ["newest", "oldest", "priceAsc", "priceDesc", "nameAsc"].includes(key);
          return true;
        }).map(([k, label]) => (
          <option key={k} value={k}>{label}</option>
        ))}
      </select>
      <select className='input-field' value={filters.slot} onChange={set("slot")} aria-label='Slot' disabled={filters.kind !== "" && filters.kind !== "gear"}>
        <option value=''>Any slot</option>
        {MARKET_SLOTS.map((s) => (
          <option key={s.type} value={s.type}>{s.label}</option>
        ))}
      </select>
      {filters.kind !== "material" && <select className='input-field' value={filters.rarity} onChange={set("rarity")} aria-label='Rarity' disabled={filters.kind === "consumable"}>
        <option value=''>Any rarity</option>
        {MARKET_RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>}
      {filters.kind === "material" && <select className='input-field' value={filters.tier} onChange={set("tier")} aria-label='Material tier'>
        <option value=''>Any material tier</option>
        {Object.entries(MATERIAL_TIERS).map(([key, tier]) => <option key={key} value={key}>{tier.label}</option>)}
      </select>}
      <select className='input-field' value={filters.ability} onChange={set("ability")} aria-label='Ability' disabled={filters.kind !== "" && filters.kind !== "gear"}>
        <option value=''>Any / no ability</option>
        <option value='__any'>Has an ability</option>
        <option value='__none'>No ability</option>
        {abilities.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
      <select className='input-field' value={filters.stat} onChange={set("stat")} aria-label='Stat' disabled={filters.kind !== "" && filters.kind !== "gear" && filters.kind !== "gemstone"}>
        <option value=''>Any stat</option>
        {MARKET_STATS.map((s) => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>
      {filters.stat && (
        <input className='input-field market-num' type='number' min='0' placeholder='Min stat' value={filters.minStat} onChange={set("minStat")} />
      )}
      <input className='input-field market-num' type='number' min='0' placeholder='Min price' value={filters.minPrice} onChange={set("minPrice")} />
      <input className='input-field market-num' type='number' min='0' placeholder='Max price' value={filters.maxPrice} onChange={set("maxPrice")} />
      <label className='market-check'>
        <input type='checkbox' checked={filters.usable} onChange={set("usable")} disabled={filters.kind !== "" && filters.kind !== "gear"} /> Usable at my level
      </label>
      <button type='button' className='buttons' onClick={() => setFilters(DEFAULT_FILTERS)}>
        Reset
      </button>
    </div>
    </>
  );
};

const MarketplaceScreen = ({ onChange, inCombat }) => {
  const [tab, setTab] = useState("browse");
  const [listings, setListings] = useState(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState(null);
  const [sellIndex, setSellIndex] = useState(null);
  const [sellAmount, setSellAmount] = useState(1);
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(
    () =>
      subscribeListings(
        (list) => {
          setListings(list);
          setError("");
        },
        () => setError("The marketplace is unreachable right now."),
      ),
    [],
  );

  const player = getPlayer() || {};
  const me = getMyUid();
  const all = useMemo(() => listings || [], [listings]);
  const mine = all.filter((l) => l.sellerUid === me);
  const abilities = useMemo(() => getAbilityNames(all), [all]);
  const shown = useMemo(() => sortListings(filterListings(all, filters, player.level || 1), filters.sort), [all, filters, player.level]);
  const selected = all.find((l) => l.id === selectedId) || null;
  const inventory = [
    ...(player.inventory || []),
    ...getConsumables(player).map((c) => ({ ...c, kind: "consumable" })),
    ...getMaterials(player).map((material) => ({ ...material, kind: "material" })),
    ...(player.gemstones || []).map((gemstone) => ({ ...gemstone, kind: "gemstone" })),
  ];
  const sellItem = sellIndex !== null ? inventory[sellIndex] : null;

  if (!isMarketUnlocked(player)) {
    return (
      <div className='workshop marketplace'>
        <h3>Marketplace</h3>
        <div className='equip-empty'>The marketplace opens to adventurers of level {MARKETPLACE_MIN_LEVEL}.</div>
      </div>
    );
  }

  const run = async (action) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    setNote(result.message);
    onChange?.();
    return result;
  };

  const switchTab = (key) => {
    setTab(key);
    setSelectedId(null);
    setSellIndex(null);
    setSellAmount(1);
    setNote("");
  };

  const buy = async (l) => {
    const result = await run(() => buyListing(l));
    if (result.ok) setSelectedId(null);
  };

  const takeDown = async (l) => {
    const result = await run(() => cancelListing(l));
    if (result.ok) setSelectedId(null);
  };

  const list = async () => {
    const item = isConsumableListing(sellItem) ? sellItem.key
      : isMaterialListing(sellItem) || isGemstoneListing(sellItem) ? sellItem
        : sellIndex;
    const result = await run(() => listItem(item, price, mine.length, sellAmount));
    if (result.ok) {
      setSellIndex(null);
      setPrice("");
    }
  };

  const listingTooltip = (l) =>
    marketTooltip(l.item, [`Price: ${l.price} astra`, `Seller: ${l.sellerName}`, `Listed ${new Date(l.listedAt).toLocaleString()} `].join(" • "));

  const marketTooltip = (item, extra) => {
    if (isConsumableListing(item)) return consumableTooltip(item.key, extra);
    if (isMaterialListing(item)) return { ...materialTooltip(item.key), footer: `${item.count}× listed • ${extra}` };
    if (isGemstoneListing(item)) {
      const tooltip = gemstoneTooltip(item);
      return { ...tooltip, footer: `${extra} • ${tooltip.footer}` };
    }
    return itemComparisonTooltip(item, extra);
  };

  const parsedPrice = Number(price);
  const validPrice = Number.isInteger(parsedPrice) && parsedPrice >= 1;

  return (
    <div className='workshop marketplace'>
      <h3>
        Marketplace <span className='recipe-astra'>{player.astra || 0} astra</span>
        <span className='recipe-astra'>
          {all.length} listing{all.length === 1 ? "" : "s"} • 10% tax on sales
        </span>
      </h3>
      <div className='inventory-tabs' role='tablist' aria-label='Marketplace'>
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type='button'
            role='tab'
            aria-selected={tab === key}
            className={`inventory-tab ${tab === key ? "active" : ""}`}
            onClick={() => switchTab(key)}
          >
            {label}
            {key === "mine" && ` (${mine.length}/${MAX_LISTINGS})`}
          </button>
        ))}
      </div>

      {error && <div className='recipe-note'>{error}</div>}

      {tab === "browse" && (
        <>
          <Filters filters={filters} setFilters={setFilters} abilities={abilities} />
          {selected && (
            <div className='market-confirm'>
              {selected.sellerUid === me ? (
                <>
                  <span>This is your listing of <strong style={{ color: itemColor(selected.item) }}>{selected.item.name}</strong>.</span>
                  <button type='button' className='buttons' disabled={busy || inCombat} onClick={() => takeDown(selected)}>Take down</button>
                </>
              ) : (
                <>
                  <span>
                    Buy <strong style={{ color: itemColor(selected.item) }}>{selected.item.name}</strong> from {selected.sellerName} for{" "}
                    <strong>{selected.price} astra</strong>?
                  </span>
                  <button type='button' className='buttons' disabled={busy || inCombat || (player.astra || 0) < selected.price} onClick={() => buy(selected)}>
                    {(player.astra || 0) < selected.price ? "Not enough astra" : "Buy"}
                  </button>
                </>
              )}
              <button type='button' className='buttons' onClick={() => setSelectedId(null)}>Cancel</button>
            </div>
          )}
          <div className='gear-trader-list'>
            {listings === null && !error && <div className='equip-empty'>Loading listings...</div>}
            {listings !== null && !shown.length && <div className='equip-empty'>No listings match.</div>}
            <div className='market-grid'>
              {shown.map((l) => {
                const affordable = (player.astra || 0) >= l.price;
                const own = l.sellerUid === me;
                return (
                  <ItemCard
                    key={l.id}
                    item={l.item}
                    tooltip={() => listingTooltip(l)}
                    selected={l.id === selectedId}
                    dimmed={!own && !affordable}
                    onClick={() => {
                      setSelectedId(l.id);
                      setNote("");
                    }}
                  >
                    <span className='market-card-footer'>
                      <span className='market-card-seller'>{own ? "Your listing" : l.sellerName}</span>
                      <span style={{ color: own || affordable ? "#7bd88f" : "#ff6b6b" }}>{l.price.toLocaleString()} astra</span>
                    </span>
                    {l.item.kind !== "consumable" && l.item.kind !== "material" && l.item.kind !== "gemstone" && !canEquip(l.item, player.level || 1) && <span className='market-card-warn'>Requires level {getEquipLevel(l.item)}</span>}
                  </ItemCard>
                );
              })}
            </div>
          </div>
        </>
      )}

      {tab === "sell" && (
        <>
          <KindFilter filters={filters} setFilters={setFilters} />
          <p>Each listing sells one gear piece, consumable, or gemstone. Materials can be listed in stacks.</p>
          {sellItem && (
            <div className='market-confirm'>
              <span>
                List {isMaterialListing(sellItem) && <input
                  className='input-field market-num'
                  type='number'
                  min='1'
                  max={sellItem.count}
                  step='1'
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  aria-label='Material quantity'
                />} <strong style={{ color: itemColor(sellItem) }}>{sellItem.name}{isMaterialListing(sellItem) ? ` ×${sellAmount}` : ""}</strong> for
              </span>
              <input
                className='input-field market-num'
                type='number'
                min='1'
                step='1'
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder='Price'
                autoFocus
              />
              <span className='recipe-kind'>
                {validPrice ? `Tax ${getTax(parsedPrice)} • You receive ${getPayout(parsedPrice)} astra` : "Enter a whole number of astra"}
              </span>
              <button type='button' className='buttons' disabled={busy || inCombat || !validPrice || mine.length >= MAX_LISTINGS || (isMaterialListing(sellItem) && (!Number.isInteger(Number(sellAmount)) || Number(sellAmount) < 1 || Number(sellAmount) > sellItem.count))} onClick={list}>
                List item
              </button>
              <button type='button' className='buttons' onClick={() => setSellIndex(null)}>Cancel</button>
            </div>
          )}
          <div className='gear-trader-list'>
            {mine.length >= MAX_LISTINGS && <div className='equip-empty'>You have the maximum of {MAX_LISTINGS} listings.</div>}
            {!inventory.length && <div className='equip-empty'>You have no gear, consumables, materials, or gemstones to list. Unequip gear to sell it.</div>}
            <div className='market-grid'>
              {inventory.map((item, index) => (!filters.kind || filters.kind === (isConsumableListing(item) ? "consumable" : isMaterialListing(item) ? "material" : isGemstoneListing(item) ? "gemstone" : "gear")) && (
                <ItemCard
                  key={item.id || item.key || `pack-${index}`}
                  item={item}
                  tooltip={() => isConsumableListing(item) ? consumableTooltip(item.key, `${item.count} available`)
                    : isMaterialListing(item) ? materialTooltip(item.key, item.count)
                      : isGemstoneListing(item) ? gemstoneTooltip(item)
                        : itemTooltip(item, `Vendor value: ${item.price ?? 0} astra`)}
                  selected={index === sellIndex}
                  onClick={() => {
                    setSellIndex(index);
                    setSellAmount(1);
                    setPrice(String(item.price || ""));
                    setNote("");
                  }}
                >
                  <span className='market-card-footer'>
                    <span className='market-card-seller'>Click to list</span>
                    <span>{isConsumableListing(item) || isMaterialListing(item) ? `${item.count} available` : isGemstoneListing(item) ? item.rarity : `Value ${item.price ?? 0}`}</span>
                  </span>
                </ItemCard>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "mine" && (
        <>
          {selected && selected.sellerUid === me && (
            <div className='market-confirm'>
              <span>
                Take down <strong style={{ color: itemColor(selected.item) }}>{selected.item.name}</strong> and return it to your inventory?
              </span>
              <button type='button' className='buttons' disabled={busy || inCombat} onClick={() => takeDown(selected)}>Take down</button>
              <button type='button' className='buttons' onClick={() => setSelectedId(null)}>Cancel</button>
            </div>
          )}
          <div className='gear-trader-list'>
            {listings !== null && !mine.length && <div className='equip-empty'>You have no active listings.</div>}
            <div className='market-grid'>
              {sortListings(mine, "newest").map((l) => (
                <ItemCard
                  key={l.id}
                  item={l.item}
                  tooltip={() => marketTooltip(l.item, `Price: ${l.price} astra • You receive ${getPayout(l.price)} astra `)}
                  selected={l.id === selectedId}
                  onClick={() => {
                    setSelectedId(l.id);
                    setNote("");
                  }}
                >
                  <span className='market-card-footer'>
                    <span className='market-card-seller'>Listed {new Date(l.listedAt).toLocaleDateString()}</span>
                    <span>{l.price.toLocaleString()} astra</span>
                  </span>
                </ItemCard>
              ))}
            </div>
          </div>
        </>
      )}

      <div className='recipe-note'>{note || (tab === "browse" ? "Hover a listing for details; click it to buy. Purchases arrive in your Inbox." : "")}</div>
    </div>
  );
};

export default MarketplaceScreen;
