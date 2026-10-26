import { getTitle } from "../character/titles";

export default function PlayerName({ name, activeTitle }) {
  const title = getTitle(activeTitle);
  return (
    <span className='player-name'>
      <span>{name}</span>
      {title && (
        <span className='player-title' style={{ color: title.color }} title={`${title.rarity} title`}>
          {title.name}
        </span>
      )}
    </span>
  );
}
