import { useEffect, useRef, useState } from "react";
import { getProfessionLevel, MATERIAL_TIER_LEVELS, PROFESSIONS } from "../character/professions";
import { getCraftingBook, getKnownProperties } from "../items/crafting";
import { getBlueprintIntrinsicDescription, getBlueprints } from "../items/craftingBlueprints";
import {
  CRAFTING_MATERIALS,
  describeEffect,
  MATERIAL_FAMILIES,
  MATERIAL_TAGS,
  REACTIONS,
} from "../items/craftingMaterials";
import { MATERIALS, MATERIAL_TIERS } from "../items/materials";

// Accessible modal used by the crafting book and material picker.
export function CraftingDialog({ label, onClose, children, className = "" }) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialog.current?.querySelector("input, button")?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close.current();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    <div className='item-popup-backdrop' onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialog} className={`item-popup crafting-dialog ${className}`} role='dialog' aria-modal='true' aria-label={label}>
        <button type='button' className='item-popup-close' aria-label={`Close ${label}`} onClick={onClose}>×</button>
        {children}
      </section>
    </div>
  );
}

const BOOK_TABS = [
  ["materials", "Materials"],
  ["reactions", "Reactions"],
  ["recipes", "Recipes"],
];

const tierLabel = (key) => MATERIAL_TIERS[MATERIALS[key]?.tier]?.label;
const matchesQuery = (terms, text) => terms.every((term) => text.includes(term));

export default function CraftingBook({ player, onClose }) {
  const [tab, setTab] = useState("materials");
  const [query, setQuery] = useState("");
  const book = getCraftingBook(player);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  const materials = Object.entries(CRAFTING_MATERIALS).map(([key, material]) => {
    const known = getKnownProperties(book, key);
    const effects = known.map(describeEffect);
    const tags = known.length ? material.tags.map((tag) => MATERIAL_TAGS[tag]) : [];
    const text = [MATERIALS[key].name, MATERIAL_FAMILIES[material.family].label, tierLabel(key), ...tags, ...effects]
      .join(" ").toLowerCase();
    return { key, material, known, effects, tags, text };
  }).filter((entry) => matchesQuery(terms, entry.text));

  const reactions = Object.entries(REACTIONS).map(([id, reaction]) => {
    const known = book.reactions.includes(id);
    const text = known ? [reaction.name, reaction.description, ...reaction.effects.map(describeEffect)].join(" ").toLowerCase() : "??? undiscovered";
    return { id, reaction, known, text };
  }).filter((entry) => matchesQuery(terms, entry.text));

  const recipes = Object.keys(PROFESSIONS).flatMap((profession) => getBlueprints(profession).map((blueprint) => {
    const text = [blueprint.name, blueprint.slotLabel, PROFESSIONS[profession].name, blueprint.kind,
      ...Object.keys(blueprint.requires || {}).map((key) => MATERIALS[key]?.name)].join(" ").toLowerCase();
    return { blueprint, text };
  })).filter((entry) => matchesQuery(terms, entry.text));

  const discoveredMaterials = Object.keys(book.materials).length;
  return (
    <CraftingDialog label='Crafting Book' onClose={onClose} className='crafting-book'>
      <h3>Crafting Book</h3>
      <p className='crafting-muted'>
        {discoveredMaterials} of {Object.keys(CRAFTING_MATERIALS).length} materials studied · {book.reactions.length} of {Object.keys(REACTIONS).length} reactions discovered
      </p>
      <input
        className='input-field'
        type='search'
        aria-label='Search crafting book'
        placeholder='Search materials, effects, reactions, recipes…'
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className='inventory-tabs' role='tablist' aria-label='Crafting book sections'>
        {BOOK_TABS.map(([key, label]) => (
          <button key={key} type='button' role='tab' aria-selected={tab === key} className={`inventory-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      <div className='crafting-book-list' role='region' aria-label={`${BOOK_TABS.find(([key]) => key === tab)[1]} entries`} tabIndex={0}>
        {tab === "materials" && materials.map(({ key, material, known, effects, tags }) => (
          <article key={key} className='crafting-book-entry'>
            <header>
              <strong style={{ color: MATERIAL_TIERS[MATERIALS[key].tier]?.color }}>{MATERIALS[key].name}</strong>
              <span className='crafting-muted'>
                {MATERIAL_FAMILIES[material.family].label} · Tier {material.tier} · Profession level {MATERIAL_TIER_LEVELS[material.tier - 1]}
              </span>
            </header>
            {tags.length > 0 && <span className='crafting-tags'>Affinities: {tags.join(", ")}</span>}
            <ul>
              {effects.map((effect, index) => <li key={index}>{effect}</li>)}
              {Array.from({ length: material.properties.length - known.length }, (_, index) => (
                <li key={`unknown-${index}`} className='crafting-unknown'>???</li>
              ))}
            </ul>
            {!known.length && <span className='crafting-muted'>Craft with this material to learn its properties.</span>}
          </article>
        ))}
        {tab === "reactions" && reactions.map(({ id, reaction, known }) => (
          <article key={id} className={`crafting-book-entry ${reaction.harmful && known ? "harmful" : ""}`}>
            {known ? (
              <>
                <header><strong>{reaction.name}</strong>{reaction.harmful && <span className='crafting-warning'>Harmful</span>}</header>
                <p>{reaction.description}</p>
                <ul>{reaction.effects.map((effect, index) => <li key={index}>{describeEffect(effect)}</li>)}</ul>
              </>
            ) : (
              <header><strong className='crafting-unknown'>??? Undiscovered reaction</strong></header>
            )}
          </article>
        ))}
        {tab === "recipes" && recipes.map(({ blueprint }) => {
          const level = getProfessionLevel(player, blueprint.profession);
          const unlocked = level >= blueprint.level;
          return (
            <article key={blueprint.id} className={`crafting-book-entry ${unlocked ? "" : "locked"}`}>
              <header>
                <strong className={blueprint.kind === "unique" ? "crafting-unique" : ""}>{blueprint.name}</strong>
                <span className='crafting-muted'>
                  {PROFESSIONS[blueprint.profession].name} {blueprint.level} · {blueprint.kind === "tool" ? "Crafting / Gathering tool" : blueprint.kind === "unique" ? `Unique ${blueprint.slotLabel}` : blueprint.slotLabel}
                </span>
              </header>
              {getBlueprintIntrinsicDescription(blueprint) && <p>{getBlueprintIntrinsicDescription(blueprint)}</p>}
              <span>
                Base: {blueprint.baseQty}× {blueprint.families.map((family) => MATERIAL_FAMILIES[family].label).join(" or ")}
                {blueprint.minTier ? ` (tier ${blueprint.minTier}+)` : ""}
              </span>
              {blueprint.parts && <span>Tool parts: {blueprint.parts.join(" and ")}</span>}
              {blueprint.kind === "part" && <span>Output: 1 {MATERIALS[blueprint.output].name}. Base cost: {blueprint.astra} astra before crafting discounts.</span>}
              {blueprint.requires && (
                <span>Requires: {Object.entries(blueprint.requires).map(([key, qty]) => `${qty}× ${MATERIALS[key].name}`).join(", ")}</span>
              )}
              {!unlocked && <span className='crafting-muted'>Unlocks at {PROFESSIONS[blueprint.profession].name} level {blueprint.level}.</span>}
            </article>
          );
        })}
        {((tab === "materials" && !materials.length) || (tab === "reactions" && !reactions.length) || (tab === "recipes" && !recipes.length)) && (
          <p className='crafting-muted'>No matching entries.</p>
        )}
      </div>
    </CraftingDialog>
  );
}
