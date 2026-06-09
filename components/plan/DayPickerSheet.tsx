'use client';

import type { DerivedDay } from '@/src/lib/days';

/**
 * Bottom-sheet day chooser: lists the trip's days as buttons. Used to move or
 * copy a place to another day, and to promote a Saved place onto a day. Picking
 * a day fires `onPick(date)` then closes.
 */
export function DayPickerSheet({
  open,
  title,
  days,
  onPick,
  onClose,
}: {
  open: boolean;
  title: string;
  days: DerivedDay[];
  onPick: (date: string) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-[3px]"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[70vh] w-full overflow-y-auto rounded-t-sheet bg-bg p-[18px] pb-8 shadow-sheet"
      >
        <div className="mx-auto mb-3.5 h-1 w-10 rounded-chip bg-line" aria-hidden="true" />
        <h2 className="mb-3 text-[18px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
        <ul className="flex flex-col gap-2">
          {days.map((d) => (
            <li key={d.date}>
              <button
                type="button"
                onClick={() => {
                  onPick(d.date);
                  onClose();
                }}
                className="w-full rounded-control border border-line bg-bg px-4 py-3 text-left text-body font-medium text-ink transition hover:bg-surface active:opacity-70"
              >
                {`Day ${d.dayNumber} · ${d.weekday.slice(0, 3)}`}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
