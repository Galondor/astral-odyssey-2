import { getItemGemstones, getItemSocketCount, MAX_ITEM_SOCKETS } from "../items/sockets";

export { MAX_ITEM_SOCKETS } from "../items/sockets";

const GEM_COLORS = {
  ruby: { fill: "#e5484d", light: "#ff9a9e" },
  emerald: { fill: "#46a758", light: "#9be0a8" },
  sapphire: { fill: "#3e8ef0", light: "#9ec9ff" },
  skill: { fill: "#ff8000", light: "#ffd479" },
};

const STAT_GEM_TYPES = {
  strength: "ruby",
  dexterity: "emerald",
  intelligence: "sapphire",
};

export function ItemSockets({ item }) {
  if (!item || item.twoHandedOf) return null;
  const gems = getItemGemstones(item);
  const count = Math.min(Math.max(getItemSocketCount(item), gems.length), MAX_ITEM_SOCKETS);
  if (!count) return null;
  return (
    <span className='socket-icons' aria-hidden='true'>
      {Array.from({ length: count }, (_, index) => (
        <SocketIcon key={index} gemstone={gems[index]} size={18} />
      ))}
    </span>
  );
}

/* Small socket indicator for item cards: a recessed ring when empty, a faceted tinted gem when socketed. */
export default function SocketIcon({ gemstone, size = 14 }) {
  const type = gemstone
    ? (GEM_COLORS[gemstone.type] ? gemstone.type : STAT_GEM_TYPES[gemstone.stat])
    : null;
  const colors = GEM_COLORS[type];
  return (
    <svg
      className='socket-icon'
      width={size}
      height={size}
      viewBox='0 0 16 16'
      aria-hidden='true'
      focusable='false'
    >
      {gemstone && colors ? (
        <>
          <circle cx='8' cy='8' r='7.4' fill={colors.fill} opacity='0.3' />
          <circle cx='8' cy='8' r='6.2' fill='rgba(0, 0, 0, 0.55)' stroke='#6b6b7e' strokeWidth='1' />
          <polygon
            points='8,3.2 12.4,8 8,12.8 3.6,8'
            fill={colors.fill}
            stroke={colors.light}
            strokeWidth='0.8'
            strokeLinejoin='round'
          />
          <path d='M3.6 8 H12.4 M8 3.2 V12.8' stroke={colors.light} strokeWidth='0.6' opacity='0.7' fill='none' />
        </>
      ) : (
        <>
          <circle cx='8' cy='8' r='6.2' fill='rgba(0, 0, 0, 0.55)' stroke='#6b6b7e' strokeWidth='1.4' />
          <circle cx='8' cy='8' r='2.8' fill='rgba(0, 0, 0, 0.6)' stroke='#45455a' strokeWidth='1' />
        </>
      )}
    </svg>
  );
}
