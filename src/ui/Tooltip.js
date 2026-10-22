import { cloneElement, useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const OFFSET = 12;
const MARGIN = 8;

/*
 * Tooltip content ("content" prop) can be:
 *  - string / number / React node
 *  - function returning any of the above or a data object (evaluated on hover, so it can show live data)
 *  - data object: {
 *      title, subtitle, description,
 *      stats: [{ label, value, color? }],
 *      list: ["line", ...],
 *      tags: ["tag", ...],
 *      sections: [ <data object>, ... ],
 *      footer
 *    }
 */
export function TooltipContent({ data }) {
  if (data == null || data === false) return null;
  if (typeof data !== "object" || data.$$typeof) return <>{data}</>;
  const { title, titleColor, subtitle, description, stats, list, tags, sections, footer } = data;
  return (
    <>
      {title && <div className='tooltip-title' style={titleColor ? { color: titleColor } : undefined}>{title}</div>}
      {subtitle && <div className='tooltip-subtitle'>{subtitle}</div>}
      {description && (
        <div className='tooltip-description'>
          {Array.isArray(description) ? description.map((d, i) => <div key={i}>{d}</div>) : description}
        </div>
      )}
      {stats?.length > 0 && (
        <div className='tooltip-stats'>
          {stats.map((s, i) => (
            <div key={i} className='tooltip-stat'>
              <span>
                {s.tier && <span className='tooltip-stat-tier' style={s.tierColor ? { color: s.tierColor } : undefined}>{s.tier} </span>}
                {s.label}
              </span>
              <span style={s.color ? { color: s.color } : undefined}>{s.value}</span>
            </div>
          ))}
        </div>
      )}
      {list?.length > 0 && (
        <ul className='tooltip-list'>
          {list.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
      {tags?.length > 0 && (
        <div className='tooltip-tags'>
          {tags.map((t, i) => (
            <span key={i} className='tooltip-tag'>{t}</span>
          ))}
        </div>
      )}
      {sections?.map((s, i) => (
        <div key={i} className='tooltip-section'>
          <TooltipContent data={s} />
        </div>
      ))}
      {footer && <div className='tooltip-footer'>{footer}</div>}
    </>
  );
}

function resolve(content) {
  return typeof content === "function" ? content() : content;
}

/* Wraps a single element, showing a tooltip on hover/focus. Renders nothing extra if content is empty. */
export default function Tooltip({ content, delay = 150, onView, openOnClick = false, children }) {
  const [state, setState] = useState(null); // { data, x, y }
  const [pos, setPos] = useState(null);
  const tipRef = useRef(null);
  const timer = useRef(null);
  const anchor = useRef({ x: 0, y: 0 });

  const open = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const data = resolve(content);
      if (data == null || data === "" || data === false) return;
      setState({ data });
      onView?.();
    }, delay);
  }, [content, delay, onView]);

  const close = useCallback(() => {
    clearTimeout(timer.current);
    setState(null);
    setPos(null);
  }, []);

  const move = (e) => {
    anchor.current = { x: e.clientX, y: e.clientY };
    if (state) place();
  };

  const place = () => {
    const tip = tipRef.current;
    if (!tip) return;
    const { x, y } = anchor.current;
    const { width, height } = tip.getBoundingClientRect();
    let left = x + OFFSET;
    let top = y + OFFSET;
    if (left + width > window.innerWidth - MARGIN) left = x - OFFSET - width;
    if (top + height > window.innerHeight - MARGIN) top = y - OFFSET - height;
    setPos({
      left: Math.max(MARGIN, left),
      top: Math.max(MARGIN, top),
    });
  };

  useLayoutEffect(() => {
    if (state) place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const child = cloneElement(children, {
    onMouseEnter: (e) => {
      anchor.current = { x: e.clientX, y: e.clientY };
      open();
      children.props.onMouseEnter?.(e);
    },
    onMouseMove: (e) => {
      move(e);
      children.props.onMouseMove?.(e);
    },
    onMouseLeave: (e) => {
      close();
      children.props.onMouseLeave?.(e);
    },
    onFocus: (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      anchor.current = { x: r.left, y: r.bottom };
      open();
      children.props.onFocus?.(e);
    },
    onBlur: (e) => {
      close();
      children.props.onBlur?.(e);
    },
    onClick: (e) => {
      if (openOnClick) {
        const r = e.currentTarget.getBoundingClientRect();
        anchor.current = { x: r.left, y: r.bottom };
        open();
      } else {
        close();
      }
      children.props.onClick?.(e);
    },
  });

  return (
    <>
      {child}
      {state &&
        createPortal(
          <div
            ref={tipRef}
            role='tooltip'
            className='tooltip'
            style={{ ...state.data.backgroundStyle, left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden" }}
          >
            <TooltipContent data={state.data} />
          </div>,
          document.body
        )}
    </>
  );
}
