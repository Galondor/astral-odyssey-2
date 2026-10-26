import { useEffect } from "react";
import { itemTooltip, itemComparisonTooltip } from "../items/items";
import { TooltipContent } from "./Tooltip";

export default function ItemPopup({ item, onClose, actions = [], comparison }) {
  const details = itemTooltip(item);
  const comparisonDetails = comparison?.open ? itemComparisonTooltip(item) : null;

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  if (!item || !details) return null;

  return (
    <div
      className='item-popup-backdrop'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className='item-popup'
        role='dialog'
        aria-modal='true'
        aria-label={`${item.name} details`}
        style={details.backgroundStyle}
      >
        <button type='button' className='item-popup-close' aria-label='Close item details' onClick={onClose}>
          ×
        </button>
        <TooltipContent data={details} />
        {comparison?.open && comparisonDetails && (
          <div className='item-popup-comparison'>
            <TooltipContent data={{ sections: comparisonDetails.sections }} />
          </div>
        )}
        <div className='item-popup-actions'>
          {comparison && (
            <button
              type='button'
              className='buttons'
              aria-expanded={Boolean(comparison.open)}
              onClick={comparison.onToggle}
            >
              {comparison.open ? "Hide comparison" : "Compare"}
            </button>
          )}
          {actions.map(({ label, onClick, disabled }) => (
            <button key={label} type='button' className='buttons' disabled={disabled} onClick={onClick}>
              {label}
            </button>
          ))}
          <button type='button' className='buttons' onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
}
