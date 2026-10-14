import { Fragment } from "react";

/*
 * Simple message formatting (rendered as React elements, never raw HTML):
 *   \n            line break
 *   **bold**  *italic*  __underline__  ~~strike~~
 *   [red]text[/red]   colors: see COLORS
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

const TOKEN = /\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|\*([\s\S]+?)\*|\[(\w+)\]([\s\S]+?)\[\/\5\]/;

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
    if (m[5] && !COLORS[m[5]]) {
      // unknown tag: emit the opening bracket as text and keep scanning
      out.push(rest.slice(0, m.index + 1));
      rest = rest.slice(m.index + 1);
      continue;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const key = `${keyPrefix}${i++}`;
    if (m[1] !== undefined) out.push(<strong key={key}>{parse(m[1], key + ".")}</strong>);
    else if (m[2] !== undefined) out.push(<u key={key}>{parse(m[2], key + ".")}</u>);
    else if (m[3] !== undefined) out.push(<s key={key}>{parse(m[3], key + ".")}</s>);
    else if (m[4] !== undefined) out.push(<em key={key}>{parse(m[4], key + ".")}</em>);
    else out.push(<span key={key} style={{ color: COLORS[m[5]] }}>{parse(m[6], key + ".")}</span>);
    rest = rest.slice(m.index + m[0].length);
  }
  return out.map((n, idx) => (typeof n === "string" ? <Fragment key={`${keyPrefix}t${idx}`}>{n}</Fragment> : n));
}

export default function RichText({ text }) {
  return <>{parse(String(text ?? ""))}</>;
}
