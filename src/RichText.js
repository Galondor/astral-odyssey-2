import { Fragment } from "react";
import Tooltip from "./Tooltip";
import { GLOSSARY } from "./glossary";
import { RARITY_COLORS, findItem, itemTooltip } from "./items";

/*
 * Simple message formatting (rendered as React elements, never raw HTML):
 *   \n            line break
 *   **bold**  *italic*  __underline__  ~~strike~~
 *   [red]text[/red]   colors: see COLORS
 *   {{word|key}}  hoverable highlighted word; key is a GLOSSARY entry or a plain tooltip string
 *   {{name|item:ID}}  item link: rarity-colored name with the item's tooltip (ID from item.id)
 * Tags can be nested, e.g. **[gold]Rare[/gold] item**
 */
const COLORS = {
  red: "#c0392b",
  green: "#1e8449",
  blue: "#1f5fbf",
  gold: "#b7791f",
  purple: "#7d3c98",
  gray: "#666",
};

const TOKEN = /\{\{([^|{}]+)\|([^{}]+)\}\}|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|\*([\s\S]+?)\*|\[(\w+)\]([\s\S]+?)\[\/\7\]/;

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
      const itemId = m[2].trim().startsWith("item:") ? m[2].trim().slice(5) : null;
      if (itemId) {
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
