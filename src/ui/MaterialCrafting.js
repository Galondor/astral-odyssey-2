import { useState } from "react";
import { getPlayer, setPlayer } from "../character/player";
import {
  getExpToNextLevel,
  getProfession,
  getReagentSlots,
  hasProfessionEffect,
  MAX_PROFESSION_LEVEL,
  PROFESSION_EFFECTS,
  PROFESSIONS,
  REAGENT_SLOT_LEVELS,
} from "../character/professions";
import {
  analyzeCraft, analyzeMaterialUpgrade, craftItem, getCraftingBook, getKnownProperties,
  MATERIAL_UPGRADE_RECIPES, upgradeMaterial,
} from "../items/crafting";
import { BLUEPRINTS, getBlueprintIntrinsicDescription, getBlueprints, hasBlueprintRecipe } from "../items/craftingBlueprints";
import {
  CRAFTING_MATERIALS,
  describeEffect,
  getMaterialCraftLevel,
  isBaseMaterial,
  isReagentMaterial,
  MATERIAL_FAMILIES,
  MATERIAL_TAGS,
  REACTIONS,
} from "../items/craftingMaterials";
import { RARITY_COLORS } from "../items/items";
import { getMaterialCount, MATERIALS, MATERIAL_TIERS } from "../items/materials";
import { getProfessionTool } from "../items/tools";
import CraftingBook, { CraftingDialog } from "./CraftingBook";
import ItemPopup from "./ItemPopup";

const GATED_EFFECTS = { ability: "infusion", mainStat: "attunement" };
const percent = (value, digits = 1) => `${(Math.round(value * 100 * 10 ** digits) / 10 ** digits).toFixed(digits)}%`;
const materialName = (key) => MATERIALS[key]?.name || key;
const materialColor = (key) => MATERIAL_TIERS[MATERIALS[key]?.tier]?.color;

function MaterialPicker({ player, blueprint, slot, used, level, onPick, onClear, onClose }) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("");
  const [tier, setTier] = useState("");
  const [availability, setAvailability] = useState("");
  const [sort, setSort] = useState("tier");
  const [selected, setSelected] = useState(null);
  const book = getCraftingBook(player);
  const isBase = slot === "base";
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const candidates = Object.keys(CRAFTING_MATERIALS)
    .filter((key) => (isBase
      ? isBaseMaterial(key) && blueprint.families.includes(CRAFTING_MATERIALS[key].family) && CRAFTING_MATERIALS[key].tier >= (blueprint.minTier || 1)
      : isReagentMaterial(key)))
    .map((key) => ({ key, available: getMaterialCount(player, key) - (used[key] || 0) }))
    .filter(({ key, available }) => available > 0 &&
      (!family || CRAFTING_MATERIALS[key].family === family) &&
      (!tier || CRAFTING_MATERIALS[key].tier === Number(tier)) &&
      (!availability || (availability === "usable" ? getMaterialCraftLevel(key) <= level : getMaterialCraftLevel(key) > level)) &&
      terms.every((term) => [materialName(key), MATERIAL_FAMILIES[CRAFTING_MATERIALS[key].family].label,
        ...getKnownProperties(book, key).map(describeEffect)].join(" ").toLowerCase().includes(term)))
    .sort((a, b) => {
      const byName = materialName(a.key).localeCompare(materialName(b.key));
      if (sort === "name") return byName;
      if (sort === "amount") return b.available - a.available || byName;
      const byTier = CRAFTING_MATERIALS[a.key].tier - CRAFTING_MATERIALS[b.key].tier;
      return (sort === "tierDesc" ? -byTier : byTier) || byName;
    });
  const label = isBase ? "Choose base material" : `Choose reagent ${slot + 1}`;
  if (selected) {
    const material = CRAFTING_MATERIALS[selected];
    const known = getKnownProperties(book, selected);
    const required = getMaterialCraftLevel(selected);
    const available = getMaterialCount(player, selected) - (used[selected] || 0);
    return (
      <CraftingDialog key={selected} label={`${materialName(selected)} details`} onClose={() => setSelected(null)} className='crafting-picker'>
        <h3 style={{ color: materialColor(selected) }}>{materialName(selected)}</h3>
        <p>{MATERIALS[selected].description}</p>
        {known.length > 0 && <p className='crafting-tags'>Affinities: {material.tags.map((tag) => MATERIAL_TAGS[tag]).join(", ")}</p>}
        <h4>Known properties</h4>
        <ul className='crafting-detail-properties'>
          {known.map((effect, index) => <li key={index}>{describeEffect(effect)}</li>)}
          {known.length < material.properties.length && <li className='crafting-unknown'>??? ({material.properties.length - known.length} undiscovered)</li>}
        </ul>
        {required > level && <p className='crafting-warning'>Requires level {required}</p>}
        <div className='item-popup-actions'>
          <button type='button' className='buttons' disabled={required > level || available < 1} onClick={() => onPick(selected)}>Select reagent</button>
          <button type='button' className='buttons' onClick={() => setSelected(null)}>Back to reagents</button>
        </div>
      </CraftingDialog>
    );
  }
  return (
    <CraftingDialog key='picker' label={label} onClose={onClose} className='crafting-picker'>
      <h3>{label}</h3>
      <input className='input-field' type='search' aria-label='Search materials' placeholder='Search your materials…' value={query} onChange={(event) => setQuery(event.target.value)} />
      {!isBase && <div className='crafting-picker-filters'>
        <label>Family<select className='input-field' aria-label='Filter reagent family' value={family} onChange={(event) => setFamily(event.target.value)}>
          <option value=''>All families</option>
          {Object.entries(MATERIAL_FAMILIES).filter(([, entry]) => !entry.base).map(([key, entry]) => <option key={key} value={key}>{entry.label}</option>)}
        </select></label>
        <label>Tier<select className='input-field' aria-label='Filter reagent tier' value={tier} onChange={(event) => setTier(event.target.value)}>
          <option value=''>All tiers</option>
          {[1, 2, 3, 4, 5, 6, 7].map((value) => <option key={value} value={value}>Tier {value}</option>)}
        </select></label>
        <label>Level<select className='input-field' aria-label='Filter reagent level' value={availability} onChange={(event) => setAvailability(event.target.value)}>
          <option value=''>All levels</option><option value='usable'>Usable now</option><option value='locked'>Level locked</option>
        </select></label>
        <label>Sort<select className='input-field' aria-label='Sort reagents' value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value='tier'>Tier: low to high</option><option value='tierDesc'>Tier: high to low</option>
          <option value='name'>Name: A to Z</option><option value='amount'>Available: most first</option>
        </select></label>
      </div>}
      <div className={`crafting-picker-list ${isBase ? "" : "crafting-picker-grid"}`}>
        {candidates.map(({ key, available }) => {
          const required = getMaterialCraftLevel(key);
          const locked = required > level;
          const known = getKnownProperties(book, key);
          const total = CRAFTING_MATERIALS[key].properties.length;
          return (
            <button key={key} type='button' className='crafting-picker-option' disabled={isBase && locked} onClick={() => isBase ? onPick(key) : setSelected(key)}>
              <strong style={{ color: materialColor(key) }}>{materialName(key)}</strong>
              <span>×{available} · {MATERIAL_FAMILIES[CRAFTING_MATERIALS[key].family].label} · Tier {CRAFTING_MATERIALS[key].tier}</span>
              <span className='crafting-muted'>
                {locked ? `Requires level ${required}` : known.length ? known.map(describeEffect).join(" · ") : "Properties unknown"}
                {!locked && known.length < total ? ` (${known.length}/${total} known)` : ""}
              </span>
            </button>
          );
        })}
        {!candidates.length && <p className='crafting-muted'>You have no matching materials{isBase ? ` for ${blueprint.name}` : ""}.</p>}
      </div>
      <div className='item-popup-actions'>
        <button type='button' className='buttons' onClick={onClear}>Clear slot</button>
        <button type='button' className='buttons' onClick={onClose}>Close</button>
      </div>
    </CraftingDialog>
  );
}

function CraftPreview({ analysis, book, level, materialsUsed }) {
  if (!analysis?.blueprint) return null;
  const { blueprint } = analysis;
  if (blueprint.kind === "part") return (
    <dl className='crafting-stats'>
      <dt>Output</dt><dd>1 {materialName(blueprint.output)}</dd>
      <dt>Profession exp</dt><dd>{analysis.exp}</dd>
      <dt>Astra cost</dt><dd>{analysis.astraCost}</dd>
    </dl>
  );
  return (
    <>
      {getBlueprintIntrinsicDescription(blueprint) && <p className='crafting-preview-intrinsic'>{getBlueprintIntrinsicDescription(blueprint)}</p>}
      <div className='crafting-preview-content'>
        <div className='crafting-preview-effects'>
          <section className='crafting-preview-section' aria-label='Known effects'>
            <h4>Known effects</h4>
            <ul className='crafting-effect-cards'>
              {materialsUsed.map((key) => {
                const known = getKnownProperties(book, key);
                const unknown = CRAFTING_MATERIALS[key].properties.length - known.length;
                return (
                  <li key={key} className='crafting-effect-card'>
                    <strong style={{ color: materialColor(key) }}>{materialName(key)}</strong>
                    <ul className='crafting-effect-list'>
                      {known.map((effect, index) => {
                        const gate = GATED_EFFECTS[effect.type];
                        const inactive = gate && !hasProfessionEffect(level, gate);
                        return (
                          <li key={index} className={inactive ? "crafting-inactive" : ""}>
                            <span>{describeEffect(effect)}</span>
                            {inactive && <span className='crafting-effect-requirement'>Needs {PROFESSION_EFFECTS[gate].name}</span>}
                          </li>
                        );
                      })}
                      {unknown > 0 && <li className='crafting-unknown'>??? ({unknown} undiscovered)</li>}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </section>
          {(analysis.reactions.length > 0 || analysis.suppressed.length > 0) && (
            <section className='crafting-preview-section' aria-label='Reactions'>
              <h4>Reactions</h4>
              <ul className='crafting-reaction-list'>
                {analysis.reactions.map((id) => (book.reactions.includes(id) ? (
                  <li key={id} className={`crafting-effect-card ${REACTIONS[id].harmful ? "crafting-warning" : ""}`}>
                    <strong>{REACTIONS[id].name}</strong>
                    <ul className='crafting-effect-list'>
                      {REACTIONS[id].effects.map((effect, index) => <li key={index}>{describeEffect(effect)}</li>)}
                    </ul>
                  </li>
                ) : (
                  <li key={id} className='crafting-effect-card crafting-unknown'>??? These materials will react in an unknown way.</li>
                )))}
                {analysis.suppressed.map((id) => (
                  <li key={id} className='crafting-effect-card crafting-muted'>
                    {book.reactions.includes(id) ? REACTIONS[id].name : "A harmful reaction"} is held in check.
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <section className='crafting-preview-section crafting-odds' aria-label='Craft odds'>
          <h4>Outcome</h4>
          {blueprint.kind === "unique" ? (
            <div className='crafting-odds-row compact'><span style={{ color: RARITY_COLORS.Unique }}>Unique</span><span>{percent(1 - analysis.mythicChance, 2)}</span></div>
          ) : analysis.rarityOdds.map(({ rarity, chance }) => (
            <div key={rarity} className='crafting-odds-row'>
              <span style={{ color: RARITY_COLORS[rarity] }}>{rarity}</span>
              <span className='crafting-odds-bar'><span style={{ width: `${Math.round(chance * 100)}%`, background: RARITY_COLORS[rarity] }} /></span>
              <span>{percent(chance)}</span>
            </div>
          ))}
          {blueprint.kind !== "tool" && (
            <div className='crafting-odds-row compact'>
              <span style={{ color: RARITY_COLORS.Mythic }}>Mythic</span>
              <span>{percent(analysis.mythicChance, 3)}</span>
            </div>
          )}
          <dl className='crafting-stats'>
            <dt>Craft quality</dt><dd>{analysis.quality}</dd>
            <dt>Item level</dt><dd>{analysis.iLevel === analysis.maxILevel ? analysis.iLevel : `${analysis.iLevel} - ${analysis.maxILevel}`}</dd>
            <dt>Minimum substat tier</dt><dd>T{analysis.minTier}</dd>
            <dt>Holofoil chance</dt><dd>{percent(analysis.holofoilChance)}</dd>
            <dt>Profession exp</dt><dd>{analysis.exp}{analysis.lowTierPenalty < 1 ? " (low-tier base)" : ""}</dd>
            <dt>Astra cost</dt><dd>{analysis.astraCost}</dd>
          </dl>
        </section>
      </div>
    </>
  );
}

export default function MaterialCrafting({ onChange }) {
  const player = getPlayer() || {};
  const [profession, setProfession] = useState("weaponry");
  const [upgradesOpen, setUpgradesOpen] = useState(false);
  const [upgradeQuantities, setUpgradeQuantities] = useState({});
  const [blueprintId, setBlueprintId] = useState(null);
  const [base, setBase] = useState(null);
  const [reagents, setReagents] = useState([]);
  const [picker, setPicker] = useState(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [blueprintQuery, setBlueprintQuery] = useState("");
  const [result, setResult] = useState(null);
  const [note, setNote] = useState("");

  const progress = getProfession(player, profession);
  const slots = getReagentSlots(progress.level);
  const blueprint = BLUEPRINTS[blueprintId];
  const book = getCraftingBook(player);
  const tool = getProfessionTool(player, profession);
  const chosenReagents = reagents.slice(0, slots).filter(Boolean);
  const selection = { blueprintId, base, reagents: chosenReagents };
  const analysis = blueprint && base ? analyzeCraft(player, selection) : null;
  const materialsUsed = [...new Set([base, ...chosenReagents].filter(Boolean))];
  const terms = blueprintQuery.toLowerCase().split(/\s+/).filter(Boolean);
  const blueprints = getBlueprints(profession).filter((entry) =>
    terms.every((term) => `${entry.name} ${entry.slotLabel || ""} ${entry.kind}`.toLowerCase().includes(term)));

  const usedExcept = (slot) => {
    const used = {};
    if (slot !== "base" && base && blueprint) used[base] = blueprint.baseQty;
    reagents.slice(0, slots).forEach((key, index) => { if (key && index !== slot) used[key] = (used[key] || 0) + 1; });
    return used;
  };
  const chooseProfession = (id) => {
    setUpgradesOpen(false);
    setProfession(id);
    setBlueprintId(null);
    setBase(null);
    setReagents([]);
    setNote("");
  };
  const chooseBlueprint = (entry) => {
    setBlueprintId(entry.id);
    if (entry.kind === "part") setReagents([]);
    if (base && (!entry.families.includes(CRAFTING_MATERIALS[base].family) || CRAFTING_MATERIALS[base].tier < (entry.minTier || 1))) setBase(null);
    setNote("");
  };
  const pick = (key) => {
    if (picker === "base") setBase(key);
    else setReagents((current) => {
      const next = [...current];
      next[picker] = key;
      return next;
    });
    setPicker(null);
  };
  const clear = () => {
    if (picker === "base") setBase(null);
    else setReagents((current) => current.map((key, index) => (index === picker ? null : key)));
    setPicker(null);
  };
  const craft = () => {
    const outcome = craftItem(getPlayer(), selection);
    if (!outcome.ok) {
      setNote(outcome.message);
      return;
    }
    setPlayer(outcome.patch);
    onChange?.();
    setNote(outcome.message);
    setResult(outcome);
  };
  const convert = (input) => {
    const outcome = upgradeMaterial(getPlayer(), input, Number(upgradeQuantities[input] ?? 1));
    setNote(outcome.message);
    if (!outcome.ok) return;
    setPlayer(outcome.patch);
    onChange?.();
  };

  const expNeeded = getExpToNextLevel(progress.level);
  const status = note || analysis?.message || (blueprint
    ? base ? "" : "Choose a base material."
    : "Choose a blueprint to start crafting.");

  return (
    <div className='material-crafting'>
      <div className='inventory-tabs' role='tablist' aria-label='Crafting professions'>
        {Object.values(PROFESSIONS).map((entry) => (
          <button key={entry.id} type='button' role='tab' aria-selected={!upgradesOpen && profession === entry.id} className={`inventory-tab ${!upgradesOpen && profession === entry.id ? "active" : ""}`} onClick={() => chooseProfession(entry.id)}>
            {entry.name}
          </button>
        ))}
        <button type='button' role='tab' aria-selected={upgradesOpen} className={`inventory-tab ${upgradesOpen ? "active" : ""}`} onClick={() => { setUpgradesOpen(true); setNote(""); }}>
          Material Transmutation
        </button>
      </div>
      {upgradesOpen ? (
        <section className='material-transmutation' aria-label='Material transmutation'>
          <header className='transmutation-header'>
            <div>
              <h3>Material Transmutation</h3>
              <p>Refine spare materials into the next tier at a 3:1 ratio.</p>
            </div>
            <strong className='transmutation-wallet'>{(player.astra || 0).toLocaleString()} astra</strong>
          </header>
          <p className='crafting-muted'>Enter how many output materials to craft. Requires the output tier's level in Weaponry, Armor, or Jewelry. No profession exp or property discoveries are granted.</p>
          {note && <div className='recipe-note' role='status'>{note}</div>}
          {["ore", "wood", "hide", "cloth"].map((family) => (
            <section key={family} className='transmutation-family' aria-label={`${MATERIAL_FAMILIES[family].label} transmutation`}>
              <h4>{MATERIAL_FAMILIES[family].label}</h4>
              <div className='transmutation-recipes'>
                {MATERIAL_UPGRADE_RECIPES.filter((recipe) => recipe.family === family).map((recipe) => {
                  const quantity = Number(upgradeQuantities[recipe.input] ?? 1);
                  const validQuantity = Number.isSafeInteger(quantity) && quantity > 0 &&
                    Number.isSafeInteger(quantity * recipe.astraCost);
                  const upgrade = analyzeMaterialUpgrade(player, recipe.input, quantity);
                  const owned = getMaterialCount(player, recipe.input);
                  const max = Math.max(0, Math.min(Math.floor(owned / 3), Math.floor((player.astra || 0) / recipe.astraCost)));
                  const unlocked = Object.keys(PROFESSIONS).some((id) => getProfession(player, id).level >= recipe.level);
                  const feedbackId = `transmutation-${recipe.input}-feedback`;
                  return (
                    <article key={recipe.input} className={`transmutation-card ${unlocked ? "" : "locked"}`} aria-label={`${materialName(recipe.input)} to ${materialName(recipe.output)}`}>
                      <div className='transmutation-route'>
                        <div><span className='crafting-slot-label'>Tier {recipe.tier - 1} · Spend 3</span><strong style={{ color: materialColor(recipe.input) }}>{materialName(recipe.input)}</strong></div>
                        <span className='transmutation-arrow' aria-hidden='true'>→</span>
                        <div><span className='crafting-slot-label'>Tier {recipe.tier} · Receive 1</span><strong style={{ color: materialColor(recipe.output) }}>{materialName(recipe.output)}</strong></div>
                      </div>
                      <div className='transmutation-meta'>
                        <span>Owned: {owned.toLocaleString()}</span>
                        <span>{recipe.astraCost} astra each</span>
                        <span>Crafting level {recipe.level}</span>
                      </div>
                      <div className='transmutation-controls'>
                        <label>
                          Output quantity
                          <input className='input-field' type='number' min='1' step='1' aria-label={`${materialName(recipe.output)} quantity`} aria-describedby={feedbackId} value={upgradeQuantities[recipe.input] ?? "1"} onChange={(event) => setUpgradeQuantities((current) => ({ ...current, [recipe.input]: event.target.value }))} />
                        </label>
                        <button type='button' className='buttons' aria-label={`Max ${materialName(recipe.output)}`} disabled={!unlocked || max < 1} onClick={() => setUpgradeQuantities((current) => ({ ...current, [recipe.input]: String(max) }))}>Max</button>
                        <button type='button' className='buttons' aria-label={`Craft ${materialName(recipe.output)}`} disabled={!upgrade.ok} onClick={() => convert(recipe.input)}>Craft</button>
                      </div>
                      <p className='transmutation-total'>{validQuantity ? `Total: ${(quantity * 3).toLocaleString()} ${materialName(recipe.input)} + ${(quantity * recipe.astraCost).toLocaleString()} astra → ${quantity.toLocaleString()} ${materialName(recipe.output)}` : "Total: —"}</p>
                      <p id={feedbackId} className={`transmutation-feedback ${upgrade.ok ? "crafting-tags" : "crafting-warning"}`}>{upgrade.ok ? `Ready to craft · Max affordable: ${max.toLocaleString()}` : upgrade.message}</p>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </section>
      ) : (
        <>
      <header className='crafting-profession'>
        <div className='profession-level-ring small' style={{ "--profession-progress": `${progress.level >= MAX_PROFESSION_LEVEL ? 100 : Math.min(100, Math.round((progress.exp / Math.max(1, expNeeded)) * 100))}%` }} aria-hidden='true'>
          <span>{progress.level}</span>
        </div>
        <div className='crafting-profession-info'>
          <strong>{PROFESSIONS[profession].name} level {progress.level}</strong>
          {progress.level < MAX_PROFESSION_LEVEL ? (
            <div className='profession-exp'>
              <div className='profession-exp-bar' role='progressbar' aria-label={`${PROFESSIONS[profession].name} exp`} aria-valuemin={0} aria-valuemax={expNeeded} aria-valuenow={progress.exp}>
                <span style={{ width: `${Math.min(100, (progress.exp / Math.max(1, expNeeded)) * 100)}%` }} />
              </div>
              <span className='profession-exp-label'>{progress.exp.toLocaleString()} / {expNeeded.toLocaleString()} exp · {progress.crafts} crafts</span>
            </div>
          ) : <span className='profession-exp-label'>Mastered · {progress.crafts} crafts</span>}
        </div>
        <span className={`crafting-tool-chip ${tool ? "equipped" : ""}`}>
          {tool ? `Tool: ${tool.name}` : `No ${PROFESSIONS[profession].tool === "hammer" ? "Blacksmith's Hammer" : "Precision Tools"} equipped`}
        </span>
        <button type='button' className='buttons' onClick={() => setBookOpen(true)}>Crafting Book</button>
      </header>
      <div className='crafting-layout'>
        <section className='crafting-blueprints' aria-label='Blueprints'>
          <h4>Blueprints</h4>
          <input className='input-field' type='search' aria-label='Search blueprints' placeholder='Search blueprints…' value={blueprintQuery} onChange={(event) => setBlueprintQuery(event.target.value)} />
          <div className='crafting-blueprint-list' role='region' aria-label='Available blueprints' tabIndex={0}>
            {blueprints.map((entry) => {
              const recipeKnown = hasBlueprintRecipe(player, entry);
              const locked = progress.level < entry.level || !recipeKnown;
              return (
                <button
                  key={entry.id}
                  type='button'
                  className={`crafting-blueprint ${blueprintId === entry.id ? "active" : ""} ${entry.kind}`}
                  aria-pressed={blueprintId === entry.id}
                  disabled={locked}
                  onClick={() => chooseBlueprint(entry)}
                >
                  <strong>{entry.name}</strong>
                  {getBlueprintIntrinsicDescription(entry) && <span className='crafting-muted'>{getBlueprintIntrinsicDescription(entry)}</span>}
                  <span className='crafting-muted'>
                    {!recipeKnown ? "Extract this Unique to learn its blueprint" : locked ? `Unlocks at level ${entry.level}` : entry.kind === "tool" ? "Crafting / Gathering tool" : entry.kind === "unique" ? `Unique ${entry.slotLabel}` : entry.slotLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <section className='crafting-bench' aria-label='Crafting bench'>
          <h4>{blueprint ? blueprint.name : "Crafting bench"}</h4>
          {blueprint && (
            <>
              <button type='button' className='crafting-slot base' aria-label='Base material slot' onClick={() => setPicker("base")}>
                <span className='crafting-slot-label'>Base · {blueprint.baseQty}× {blueprint.families.map((family) => MATERIAL_FAMILIES[family].label).join(" or ")}{blueprint.minTier ? ` (tier ${blueprint.minTier}+)` : ""}</span>
                {base
                  ? <strong style={{ color: materialColor(base) }}>{materialName(base)} <span className='crafting-muted'>(own {getMaterialCount(player, base)})</span></strong>
                  : <span className='crafting-muted'>Choose a base material</span>}
              </button>
              {blueprint.kind !== "part" && REAGENT_SLOT_LEVELS.map((unlock, index) => (index < slots ? (
                <button key={index} type='button' className='crafting-slot' aria-label={`Reagent slot ${index + 1}`} onClick={() => setPicker(index)}>
                  <span className='crafting-slot-label'>Reagent {index + 1}</span>
                  {reagents[index]
                    ? <strong style={{ color: materialColor(reagents[index]) }}>{materialName(reagents[index])} <span className='crafting-muted'>(own {getMaterialCount(player, reagents[index])})</span></strong>
                    : <span className='crafting-muted'>Empty</span>}
                </button>
              ) : (
                <div key={index} className='crafting-slot locked' aria-disabled='true'>
                  <span className='crafting-slot-label'>Reagent {index + 1}</span>
                  <span className='crafting-muted'>Unlocks at level {unlock}</span>
                </div>
              )))}
              {blueprint.parts && <p className='crafting-muted'>Place a {blueprint.parts.join(" and a ")} in your reagent slots. Tools roll from item level 1 up to your equip profession level, capped by the parts used.</p>}
              {blueprint.requires && (
                <div className='crafting-requires'>
                  <span className='crafting-slot-label'>Blueprint materials</span>
                  <ul>
                    {Object.entries(blueprint.requires).map(([key, qty]) => (
                      <li key={key} className={getMaterialCount(player, key) < qty ? "crafting-warning" : ""}>
                        {qty}× {materialName(key)} (own {getMaterialCount(player, key)})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          {!blueprint && <p className='crafting-muted'>Pick a blueprint, add a base material, then experiment with reagents. Every craft may reveal more about the materials you use.</p>}
        </section>
        <section className='crafting-preview' aria-label='Craft preview'>
          <h4>Preview</h4>
          <CraftPreview analysis={analysis} book={book} level={progress.level} materialsUsed={materialsUsed} />
          <button type='button' className='buttons crafting-craft' disabled={!analysis?.ok} onClick={craft}>Craft</button>
          {status && <div className='recipe-note' role='status'>{status}</div>}
        </section>
      </div>
        </>
      )}
      {picker !== null && blueprint && (
        <MaterialPicker
          player={player}
          blueprint={blueprint}
          slot={picker}
          used={usedExcept(picker)}
          level={progress.level}
          onPick={pick}
          onClear={clear}
          onClose={() => setPicker(null)}
        />
      )}
      {bookOpen && <CraftingBook player={player} onClose={() => setBookOpen(false)} />}
      {result?.material && (
        <CraftingDialog label='Crafted tool part' onClose={() => setResult(null)}>
          <h3>{result.count} {materialName(result.material)}</h3>
          <p>{result.message}</p>
          {result.discoveries.map(({ key, effect }) => <p key={key}>New discovery: {materialName(key)} - {describeEffect(effect)}</p>)}
          <button type='button' className='buttons' onClick={() => setResult(null)}>Close</button>
        </CraftingDialog>
      )}
      {result?.item && (
        <ItemPopup item={result.item} onClose={() => setResult(null)} allowDismantle onDismantled={() => onChange?.()} onExtracted={() => onChange?.()}>
          <div className='crafting-result'>
            {result.exp > 0 && <p>+{result.exp} {PROFESSIONS[profession].name} exp{result.levelsGained ? ` · Level up!` : ""}</p>}
            {result.discoveries.map(({ key, effect }) => (
              <p key={key} className='crafting-discovery'>New discovery: {materialName(key)} — {describeEffect(effect)}</p>
            ))}
            {result.newReactions.map((id) => (
              <p key={id} className='crafting-discovery'>Reaction discovered: {REACTIONS[id].name}</p>
            ))}
            {result.preserved.length > 0 && <p>Preserved: {result.preserved.map(materialName).join(", ")}</p>}
          </div>
        </ItemPopup>
      )}
    </div>
  );
}
