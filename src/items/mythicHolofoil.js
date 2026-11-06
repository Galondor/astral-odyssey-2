export const MYTHIC_HOLOFOIL_EFFECTS = [
  "event-horizon",
  "astral-orrery",
  "runic-circuit",
  "phoenix-gilding",
  "meteor-script",
];

// Color pairs are saved in the existing holofoil field, just like ordinary foils.
export const MYTHIC_HOLOFOIL_PALETTES = {
  "event-horizon": [["#ffcf85", "#a878ed"], ["#96efff", "#5476ed"], ["#ff8baf", "#c95530"]],
  "astral-orrery": [["#ecd19e", "#a8ceff"], ["#d2b5ff", "#ffb5ce"], ["#a6f1d0", "#efd69d"]],
  "runic-circuit": [["#7cfff0", "#baa3ff"], ["#ffc875", "#ff8e72"], ["#d3a6ff", "#83b4ff"]],
  "phoenix-gilding": [["#ffce70", "#dc5938"], ["#a3ebff", "#657bfa"], ["#ffaccf", "#b369e8"]],
  "meteor-script": [["#e0ecff", "#a3adff"], ["#ffe2a0", "#e7a46d"], ["#aaffdf", "#66cce8"]],
};

const sequence = (count, draw) => Array.from({ length: count }, (_, i) => draw(i)).join("");
const circle = (x, y, r, color, extra = "") =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" ${extra}/>`;
const ring = (radius, color, extra = "") =>
  `<circle r="${radius}" fill="none" stroke="${color}" ${extra}/>`;
const point = (angle, radius) => [Math.cos(angle) * radius, Math.sin(angle) * radius]
  .map(value => value.toFixed(2)).join(" ");

function illustration(effect, [light, accent], animated) {
  const rotate = (duration, reverse = false) => animated
    ? `<animateTransform attributeName="transform" type="rotate" from="0" to="${reverse ? -360 : 360}" dur="${duration}s" repeatCount="indefinite"/>` : "";
  const pulse = (duration, begin = 0) => animated
    ? `<animate attributeName="opacity" values=".25;1;.25" dur="${duration}s" begin="${begin}s" repeatCount="indefinite"/>` : "";
  let artwork;
  switch (effect) {
    case "event-horizon":
      artwork = `<g transform="rotate(-15)"><g transform="scale(1 .34)">
        ${sequence(7, j => ring(73 + j * 6, j % 2 ? accent : light, `stroke-width="2" opacity="${.65 - j * .065}"`))}
        ${sequence(3, j => `<g>${rotate(14 + j * 6, j === 1)}${sequence(14, k => {
          const angle = k * Math.PI * 2 / 14 + j;
          return `<g transform="translate(${point(angle, 74 + j * 18)})">${circle(0, 0, 1 + k % 3 * .4, light)}</g>`;
        })}</g>`)}
        </g></g>${circle(0, 0, 43, "#06050c")}${ring(44, light, 'stroke-width="1.5"')}${ring(47, accent, 'opacity=".5"')}
        <g transform="rotate(-15) scale(1 .34)"><path d="M-94 0 A94 94 0 0 0 94 0" fill="none" stroke="${light}" stroke-width="3" opacity=".8"/></g>`;
      break;
    case "astral-orrery":
      artwork = sequence(3, j => `<g transform="rotate(${j * 60})"><g>${rotate(90 + j * 15, j === 1)}
        <g transform="scale(1 ${.38 + j * .12})">${ring(111 - j * 12, j === 1 ? accent : light, 'opacity=".45"')}
        <g>${rotate(16 + j * 7, j === 1)}${sequence(2, k => {
          const x = (k ? -1 : 1) * (111 - j * 12);
          return circle(x, 0, 9, light, 'opacity=".1"') + circle(x, 0, 2.8, light);
        })}</g></g></g></g>`) + ring(28, light, 'opacity=".4"') + ring(35, light, 'opacity=".2"');
      break;
    case "runic-circuit":
      artwork = sequence(9, j => {
        const y = (j - 4) * 24;
        const offset = j % 2 ? 15 : -15;
        const path = `M-220 ${y} H-145 L-120 ${y + offset} H-65 L-40 ${y} H55 L80 ${y - 15} H145 L169 ${y} H220`;
        const motion = animated ? `<animateMotion path="${path}" dur="${7 + j % 3}s" begin="-${j * 1.7}s" repeatCount="indefinite"/>` : "";
        return `<path d="${path}" fill="none" stroke="${accent}" opacity=".22"/>
          <g ${animated ? "" : `transform="translate(${(j % 4 - 1.5) * 75} ${y})"`}>${motion}${circle(0, 0, 10, light, 'opacity=".12"')}${circle(0, 0, 2, light)}</g>
          ${[-1, 1].map(side => {
            const x = side * (88 + j % 3 * 23);
            return `<g opacity=".6">${pulse(4 + j % 3, -j)}<circle cx="${x}" cy="${y}" r="4" fill="none" stroke="${light}"/>
              <path d="M${x - 4} ${y - 8} l4 4 4-4" fill="none" stroke="${accent}"/></g>`;
          }).join("")}`;
      });
      break;
    case "phoenix-gilding":
      artwork = sequence(22, j => {
        const x = Math.sin(j * 2.4) * (35 + j % 7 * 10);
        const duration = 7 + j % 4;
        const movement = animated ? `<animateTransform attributeName="transform" type="translate" from="0 140" to="${Math.sin(j) * 25} -150" dur="${duration}s" begin="-${j * 1.13}s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;.7;.4;0" keyTimes="0;.25;.7;1" dur="${duration}s" begin="-${j * 1.13}s" repeatCount="indefinite"/>` : "";
        return `<g transform="translate(${x} 0)"><g ${animated ? "" : `transform="translate(0 ${(j / 22 - .5) * 210})"`} opacity=".6">${movement}
          <g transform="rotate(${Math.sin(j) * 35})"><path d="M0 17 C-20 0-12-15 0-34 C-2-8 17-2 0 17" fill="${accent}" opacity=".35"/>
          <path d="M0 14 Q-7-3 0-25" fill="none" stroke="${light}" opacity=".65"/></g></g></g>`;
      }) + sequence(20, j => {
        const motion = animated ? `<animateTransform attributeName="transform" type="translate" from="0 130" to="12 -130" dur="${6 + j % 5}s" begin="-${j * .9}s" repeatCount="indefinite"/>` : "";
        return `<g transform="translate(${Math.sin(j * 6.7) * 165} ${animated ? 0 : (j / 20 - .5) * 220})"><g>${motion}${circle(0, 0, .7 + j % 3 * .3, light)}</g></g>`;
      });
      break;
    case "meteor-script":
      artwork = sequence(35, j => circle(Math.sin(j * 7.3) * 200, Math.cos(j * 4.7) * 118, .4 + j % 3 * .3, light, 'opacity=".45"')) +
        sequence(9, j => {
          const duration = 4.5 + j % 4;
          const motion = animated ? `<animateTransform attributeName="transform" type="translate" from="270 -140" to="-270 140" dur="${duration}s" begin="-${j * 1.7}s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.15;.85;1" dur="${duration}s" begin="-${j * 1.7}s" repeatCount="indefinite"/>` : "";
          return `<g transform="translate(0 ${(j % 3 - 1) * 65})"><g ${animated ? "" : `transform="translate(${(j / 9 - .5) * 350} ${(j / 9 - .5) * -180})"`}>${motion}
            <path d="M0 0 L48-25" fill="none" stroke="url(#trail)" stroke-width="1.7"/>
            <path d="M-3 0 H3 M0-3 V3" stroke="${light}"/>${circle(0, 0, 1.4, light)}</g></g>`;
        });
      break;
    default:
      throw new Error(`Unknown Mythic Holofoil effect: ${effect}`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 236" preserveAspectRatio="none">
    <defs><radialGradient id="halo"><stop stop-color="${accent}" stop-opacity=".25"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
    <linearGradient id="trail" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${light}"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient></defs>
    <path fill="#090b14" fill-opacity=".92" d="M0 0H400V236H0z"/>
    <ellipse cx="200" cy="118" rx="170" ry="118" fill="url(#halo)"/>
    <g transform="translate(200 118)">${artwork}</g></svg>`;
}

const image = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
const makeStyle = (effect, colors) => ({
  "--holofoil-mythic-still": image(illustration(effect, colors, false)),
  backgroundImage: `${image(illustration(effect, colors, true))}, var(--holofoil-background)`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
});

// Precompute the fifteen rollable finishes; custom/legacy colors remain supported.
const styles = Object.fromEntries(MYTHIC_HOLOFOIL_EFFECTS.map(effect => [
  effect, MYTHIC_HOLOFOIL_PALETTES[effect].map(colors => makeStyle(effect, colors)),
]));

export function getMythicHolofoilStyle(effect, colors) {
  const index = MYTHIC_HOLOFOIL_PALETTES[effect].findIndex(pair =>
    pair.every((color, i) => color.toLowerCase() === colors[i].toLowerCase()));
  return index < 0 ? makeStyle(effect, colors) : styles[effect][index];
}
