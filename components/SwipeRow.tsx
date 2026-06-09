'use client';

import { useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';

export interface SwipeAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

const ACTION_WIDTH = 76; // px per revealed action button
const DRAG_THRESHOLD = 6; // px before a horizontal move counts as a swipe (vs a tap)

/**
 * A list row that reveals trailing action buttons (e.g. Edit / Delete) when
 * swiped left — a mobile convenience (spec §U5). Drag is pointer-based (touch +
 * mouse) and `touch-action: pan-y` preserves vertical scrolling. A swipe is
 * suppressed from firing the row's own tap, and tapping an open row closes it.
 * The actions are real buttons in the DOM, so they stay keyboard-reachable; the
 * underlying edit/delete are also available via the row's normal tap target, so
 * this never becomes the *only* way to act.
 */
export function SwipeRow({
  children,
  actions,
  disabled = false,
}: {
  children: ReactNode;
  actions: SwipeAction[];
  disabled?: boolean;
}) {
  const revealWidth = actions.length * ACTION_WIDTH;
  const [offset, setOffset] = useState(0); // 0 = closed, -revealWidth = fully open
  const startXRef = useRef<number | null>(null);
  const baseRef = useRef(0);
  const draggingRef = useRef(false);

  function onPointerDown(e: ReactPointerEvent) {
    if (disabled || actions.length === 0) return;
    startXRef.current = e.clientX;
    baseRef.current = offset;
    draggingRef.current = false;
  }
  function onPointerMove(e: ReactPointerEvent) {
    if (startXRef.current === null) return;
    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) > DRAG_THRESHOLD) draggingRef.current = true;
    setOffset(Math.max(-revealWidth, Math.min(0, baseRef.current + dx)));
  }
  function endDrag() {
    if (startXRef.current === null) return;
    startXRef.current = null;
    // Snap open past the halfway point, else closed.
    setOffset((o) => (o < -revealWidth / 2 ? -revealWidth : 0));
  }
  function onClickCapture(e: React.MouseEvent) {
    // Swallow the click that follows a swipe, and let a tap on an open row just
    // close it rather than activating the row.
    if (draggingRef.current || offset !== 0) {
      e.preventDefault();
      e.stopPropagation();
      if (offset !== 0) setOffset(0);
      draggingRef.current = false;
    }
  }

  return (
    <div className="relative overflow-hidden rounded-card">
      {actions.length > 0 ? (
        <div className="absolute inset-y-0 right-0 flex shadow-inset" aria-hidden={offset === 0}>
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              disabled={disabled}
              tabIndex={offset === 0 ? -1 : 0}
              onClick={() => {
                a.onClick();
                setOffset(0);
              }}
              style={{ width: ACTION_WIDTH }}
              className={`flex items-center justify-center text-caption font-medium text-white transition-[filter,transform] duration-150 ease-spring hover:brightness-110 active:scale-95 disabled:opacity-60 ${
                a.danger ? 'bg-danger' : 'bg-teal'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        style={{
          transform: `translateX(${offset}px)`,
          touchAction: 'pan-y',
          transition: startXRef.current === null ? 'transform 0.18s ease' : 'none',
        }}
        className="relative"
      >
        {children}
      </div>
    </div>
  );
}
