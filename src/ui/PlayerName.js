import { getTitle, titleTooltip } from "../character/titles";
import Tooltip from "./Tooltip";

export default function PlayerName({ name, activeTitle }) {
  const title = getTitle(activeTitle);
  return (
    <span className='player-name'>
      <span>{name}</span>
      {title && (
        <Tooltip content={titleTooltip(title)}>
          <span className='player-title' style={{ color: title.color }}>{title.name}</span>
        </Tooltip>
      )}
    </span>
  );
}
