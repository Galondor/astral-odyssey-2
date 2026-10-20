import { Fragment } from "react";
import Tooltip from "./Tooltip";
import { GLOSSARY } from "./glossary";
import { RARITY_COLORS, findGemstone, findItem, gemstoneTooltip, itemTooltip } from "../items/items";
import { MATERIAL_TIERS, getMaterialCount, MATERIALS, materialTooltip } from "../items/materials";
import { getPlayer } from "../character/player";

/*
 * Simple message formatting (rendered as React elements, never raw HTML):
 *   \n            line break
 *   **bold**  *italic*  __underline__  ~~strike~~
 *   [red]text[/red]   colors: see COLORS
 *   {{word|key}}  hoverable highlighted word; key is a GLOSSARY entry or a plain tooltip string
 *   {{name|item:ID}}  item link: rarity-colored name with the item's tooltip (ID from item.id)
 *   {{name|material:KEY}}  material link: rarity-colored name with material information
 * Tags can be nested, e.g. **[gold]Rare[/gold] item**
 */
const COLORS = {
  red: "#c0392b",
  pink: "#ff69b4",
  green: "#1e8449",
  blue: "#1f5fbf",
  gold: "#b7791f",
  purple: "#7d3c98",
  gray: "#666",
};

const TOKEN = /\{\{([^|{}]+)\|([^{}]+)\}\}|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|\*([\s\S]+?)\*|\[(\w+)\]([\s\S]+?)\[\/\7\]/;
const formatDamageCalculation = (text) =>
  text.replace(/-?\d+(?:\.\d+)?/g, (value) => Number(value).toFixed(2));

function parse(text, keyPrefix = "") {
  const out = [];
  let rest = text;
  let i = 0;
  while (rest) {
    const m = TOKEN.exec(rest);
    if (!m) {
      out.push(rest);
      break;
    }
    if (m[7] && !COLORS[m[7]]) {
      // unknown tag: emit the opening bracket as text and keep scanning
      out.push(rest.slice(0, m.index + 1));
      rest = rest.slice(m.index + 1);
      continue;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const key = `${keyPrefix}${i++}`;
    if (m[1] !== undefined) {
      const target = m[2].trim();
      const itemId = target.startsWith("item:") ? target.slice(5) : null;
      const gemstoneId = target.startsWith("gemstone:") ? target.slice(9) : null;
      const materialKey = target.startsWith("material:") ? target.slice(9) : null;
      const criticalDamage = target.startsWith("damage-critical:");
      const damageCalculation = target.startsWith("damage:")
        ? target.slice(7).split("~").map((line) => formatDamageCalculation(decodeURIComponent(line)))
        : criticalDamage
          ? target.slice(16).split("~").map((line) => formatDamageCalculation(decodeURIComponent(line)))
        : null;
      if (damageCalculation) {
        out.push(
          <Tooltip key={key} content={{ title: "Damage calculation", list: damageCalculation }}>
            <span className='tip-word damage-number' tabIndex={0} style={{ color: criticalDamage ? COLORS.pink : COLORS.red }}>{parse(m[1], key + ".")}</span>
          </Tooltip>
        );
      } else if (materialKey && MATERIALS[materialKey]) {
        const material = MATERIALS[materialKey];
        out.push(
          <Tooltip key={key} content={() => materialTooltip(materialKey, getMaterialCount(getPlayer(), materialKey))}>
            <span className='tip-word' tabIndex={0} style={{ color: MATERIAL_TIERS[material.tier].color }}>{parse(m[1], key + ".")}</span>
          </Tooltip>
        );
      } else if (gemstoneId) {
        const gemstone = findGemstone(gemstoneId);
        out.push(
          <Tooltip key={key} content={() => gemstoneTooltip(findGemstone(gemstoneId)) || "This gemstone is gone."}>
            <span className='tip-word' tabIndex={0} style={gemstone ? { color: RARITY_COLORS[gemstone.rarity] } : undefined}>{parse(m[1], key + ".")}</span>
          </Tooltip>
        );
      } else if (itemId) {
        // Item links resolve on hover so the tooltip stays accurate (e.g. after the item is equipped)
        const item = findItem(itemId);
        out.push(
          <Tooltip key={key} content={() => itemTooltip(findItem(itemId)) || "This item is gone."}>
            <span className='tip-word' tabIndex={0} style={item ? { color: RARITY_COLORS[item.rarity] } : undefined}>{parse(m[1], key + ".")}</span>
          </Tooltip>
        );
      } else {
        const tip = GLOSSARY[m[2].trim()] ?? m[2];
        out.push(
          <Tooltip key={key} content={tip}>
            <span className='tip-word' tabIndex={0}>{parse(m[1], key + ".")}</span>
          </Tooltip>
        );
      }
    }
    else if (m[3] !== undefined) out.push(<strong key={key}>{parse(m[3], key + ".")}</strong>);
    else if (m[4] !== undefined) out.push(<u key={key}>{parse(m[4], key + ".")}</u>);
    else if (m[5] !== undefined) out.push(<s key={key}>{parse(m[5], key + ".")}</s>);
    else if (m[6] !== undefined) out.push(<em key={key}>{parse(m[6], key + ".")}</em>);
    else out.push(<span key={key} style={{ color: COLORS[m[7]] }}>{parse(m[8], key + ".")}</span>);
    rest = rest.slice(m.index + m[0].length);
  }
  return out.map((n, idx) => (typeof n === "string" ? <Fragment key={`${keyPrefix}t${idx}`}>{n}</Fragment> : n));
}

export default function RichText({ text }) {
  return <>{parse(String(text ?? ""))}</>;
}
