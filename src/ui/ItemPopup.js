import { useEffect, useRef, useState } from "react";
import { itemTooltip, itemComparisonTooltip } from "../items/items";
import { consumableTooltip } from "../items/consumables";
import { TooltipContent } from "./Tooltip";

export default function ItemPopup({ item, onClose, actions = [], comparison, message, onDelete, deleteDisabled, children }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  const details = item?.kind === "consumable"
    ? consumableTooltip(item.key, `${item.count} available`)
    : itemTooltip(item);
  const comparisonDetails = comparison?.open ? itemComparisonTooltip(item) : null;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return undefined;
    const previousFocus = document.activeElement;
    element.querySelector("button").focus();
    const keepFocusInside = (event) => {
      if (!element.contains(event.target)) element.querySelector("button").focus();
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close.current();
      }
      if (event.key === "Tab") {
        const controls = Array.from(element.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'))
          .filter((control) => !control.closest("[hidden]"));
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("focusin", keepFocusInside);
    window.addEventListener("keydown", closeOnEscape, true);
    return () => {
      document.removeEventListener("focusin", keepFocusInside);
      window.removeEventListener("keydown", closeOnEscape, true);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  if (!item || !details) return null;

  return (
    <div
      className='item-popup-backdrop'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
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
        {children}
        {message && <div className='gemstone-message' role='status'>{message}</div>}
        {confirmingDelete && (
          <p role='alert'>
            Delete {item.kind === "consumable" ? "one " : ""}{item.name}?
            {" "}This cannot be undone.
            {item.kind !== "consumable" && " Any socketed gemstones will also be deleted."}
          </p>
        )}
        {!confirmingDelete && comparison?.open && comparisonDetails && (
          <div className='item-popup-comparison'>
            <TooltipContent data={{ sections: comparisonDetails.sections }} />
          </div>
        )}
        <div className='item-popup-actions'>
          {!confirmingDelete && comparison && (
            <button
              type='button'
              className='buttons'
              aria-expanded={Boolean(comparison.open)}
              onClick={comparison.onToggle}
            >
              {comparison.open ? "Hide comparison" : "Compare"}
            </button>
          )}
          {!confirmingDelete && actions.map(({ label, onClick, disabled }) => (
            <button key={label} type='button' className='buttons' disabled={disabled} onClick={onClick}>
              {label}
            </button>
          ))}
          {onDelete && (confirmingDelete ? (
            <>
              <button type='button' className='buttons' disabled={deleteDisabled} onClick={onDelete}>
                Confirm delete
              </button>
              <button type='button' className='buttons' onClick={() => setConfirmingDelete(false)}>Cancel</button>
            </>
          ) : (
            <button type='button' className='buttons' disabled={deleteDisabled} onClick={() => setConfirmingDelete(true)}>
              Delete item
            </button>
          ))}
          <button type='button' className='buttons' onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
}
