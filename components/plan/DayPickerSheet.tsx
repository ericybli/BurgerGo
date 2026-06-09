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
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[70vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
      >
        <div className="mx-auto mt-2 mb-1 h-1 w-9 rounded-chip bg-line" aria-hidden="true" />
        <h2 className="mb-3 font-serif text-title text-ink">{title}</h2>
        <ul className="flex flex-col gap-2">
          {days.map((d) => (
            <li key={d.date}>
              <button
                type="button"
                onClick={() => {
                  onPick(d.date);
                  onClose();
                }}
                className="w-full rounded-control bg-paper px-4 py-3 text-left text-body font-medium text-ink shadow-inset transition hover:bg-line active:bg-line active:scale-[0.98]"
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
