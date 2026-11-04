import Tooltip from "./Tooltip";

const SLOT_TYPES = {
  action: {
    name: "Action",
    icon: "⚔",
    description: "Attacks, Defend, and most skills use your Action. It can also be spent as a second Quick Action.",
  },
  quick: {
    name: "Quick Action",
    icon: "⚡",
    description: "Combat items and Quick skills. A Quick Action cannot be used to take an Action.",
  },
};

export const actionSlotList = (actions) => actions ? [
  { type: "action", available: !!actions.actionAvailable },
  { type: "quick", available: !!actions.quickAvailable },
] : [];

const slotTooltip = ({ type, available }) => ({
  title: SLOT_TYPES[type].name,
  subtitle: available ? "Ready" : "Used this turn",
  description: SLOT_TYPES[type].description,
  footer: "Unused slots are lost when you end your turn.",
});

export default function ActionSlots({ actions, slots = actionSlotList(actions) }) {
  if (!slots.length) return null;
  return (
    <div className='combat-actions' role='group' aria-label='Turn actions' aria-live='polite'>
      {slots.map((slot, index) => {
        const { name, icon } = SLOT_TYPES[slot.type];
        const label = `${name}: ${slot.available ? "Ready" : "Used"}`;
        return (
          <Tooltip key={`${slot.type}-${index}`} content={() => slotTooltip(slot)} openOnClick>
            <button
              type='button'
              className={`action-slot action-slot-${slot.type}${slot.available ? "" : " action-slot-used"}`}
              aria-label={label}
            >
              <span aria-hidden='true'>{icon}</span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
