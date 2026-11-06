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
import { analyzeCraft, craftItem, getCraftingBook, getKnownProperties } from "../items/crafting";
import { BLUEPRINTS, getBlueprintIntrinsicDescription, getBlueprints } from "../items/craftingBlueprints";
import {
  CRAFTING_MATERIALS,
  describeEffect,
  getMaterialCraftLevel,
  isBaseMaterial,
  isReagentMaterial,
  MATERIAL_FAMILIES,
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
  const book = getCraftingBook(player);
  const isBase = slot === "base";
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const candidates = Object.keys(CRAFTING_MATERIALS)
    .filter((key) => (isBase
      ? isBaseMaterial(key) && blueprint.families.includes(CRAFTING_MATERIALS[key].family) && CRAFTING_MATERIALS[key].tier >= (blueprint.minTier || 1)
      : isReagentMaterial(key)))
    .map((key) => ({ key, available: getMaterialCount(player, key) - (used[key] || 0) }))
    .filter(({ key, available }) => available > 0 &&
      terms.every((term) => [materialName(key), MATERIAL_FAMILIES[CRAFTING_MATERIALS[key].family].label,
        ...getKnownProperties(book, key).map(describeEffect)].join(" ").toLowerCase().includes(term)))
    .sort((a, b) => CRAFTING_MATERIALS[a.key].tier - CRAFTING_MATERIALS[b.key].tier || materialName(a.key).localeCompare(materialName(b.key)));
  const label = isBase ? "Choose base material" : `Choose reagent ${slot + 1}`;
  return (
    <CraftingDialog label={label} onClose={onClose} className='crafting-picker'>
      <h3>{label}</h3>
      <input className='input-field' type='search' aria-label='Search materials' placeholder='Search your materials…' value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className='crafting-picker-list'>
        {candidates.map(({ key, available }) => {
          const required = getMaterialCraftLevel(key);
          const locked = required > level;
          const known = getKnownProperties(book, key);
          const total = CRAFTING_MATERIALS[key].properties.length;
          return (
            <button key={key} type='button' className='crafting-picker-option' disabled={locked} onClick={() => onPick(key)}>
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

  const expNeeded = getExpToNextLevel(progress.level);
  const status = note || analysis?.message || (blueprint
    ? base ? "" : "Choose a base material."
    : "Choose a blueprint to start crafting.");

  return (
    <div className='material-crafting'>
      <div className='inventory-tabs' role='tablist' aria-label='Crafting professions'>
        {Object.values(PROFESSIONS).map((entry) => (
          <button key={entry.id} type='button' role='tab' aria-selected={profession === entry.id} className={`inventory-tab ${profession === entry.id ? "active" : ""}`} onClick={() => chooseProfession(entry.id)}>
            {entry.name}
          </button>
        ))}
      </div>
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
              const locked = progress.level < entry.level;
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
                    {locked ? `Unlocks at level ${entry.level}` : entry.kind === "tool" ? "Crafting / Gathering tool" : entry.kind === "unique" ? `Unique ${entry.slotLabel}` : entry.slotLabel}
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
                    ? <strong style={{ color: materialColor(reagents[index]) }}>{materialName(reagents[index])}</strong>
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
                  <span className='crafting-slot-label'>Recipe materials</span>
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
        <ItemPopup item={result.item} onClose={() => setResult(null)}>
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
