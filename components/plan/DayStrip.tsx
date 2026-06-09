'use client';

import { useTranslations } from 'next-intl';
import type { DerivedDay } from '@/src/lib/days';

type DayStripProps = {
  days: DerivedDay[];
  selectedDate: string;
  onSelect: (date: string) => void;
};

/** Short "May 3" label from a YYYY-MM-DD string (UTC-stable). */
function shortDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateStr}T00:00:00Z`));
}

/** Day-of-month (no leading zero) from a YYYY-MM-DD string. */
function dayOfMonth(dateStr: string): string {
  return String(Number(dateStr.slice(8, 10)));
}

/**
 * Equal-width two-line day chips (mock ADayStrip): weekday abbreviation over a
 * big date number; the active day is a solid ink chip. The accessible name
 * stays the full "Day {n} · {weekday} {date}" string (aria-label) so screen
 * readers and tests keep the descriptive label.
 */
export function DayStrip({ days, selectedDate, onSelect }: DayStripProps) {
  const t = useTranslations('plan');
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {days.map((d) => {
        const active = d.date === selectedDate;
        return (
          <button
            key={d.date}
            type="button"
            aria-current={active ? 'true' : undefined}
            aria-label={t('dayChip', {
              n: d.dayNumber,
              weekday: d.weekday.slice(0, 3),
              date: shortDate(d.date),
            })}
            onClick={() => onSelect(d.date)}
            className={`relative min-w-[56px] flex-1 shrink-0 whitespace-nowrap rounded-[12px] border px-2 pb-2 pt-[7px] text-center transition active:scale-[0.98] ${
              active ? 'border-ink bg-ink' : 'border-line bg-bg'
            }`}
          >
            <span
              className={`block text-[10px] font-semibold uppercase tracking-[0.08em] ${
                active ? 'text-white/65' : 'text-faint'
              }`}
            >
              {d.weekday.slice(0, 3)}
            </span>
            <span
              className={`mt-px flex items-center justify-center gap-1 text-[16px] font-bold leading-5 [font-variant-numeric:tabular-nums] ${
                active ? 'text-white' : 'text-ink'
              }`}
            >
              {dayOfMonth(d.date)}
              {d.isToday ? (
                <span aria-label={t('todayDot')} className="h-1.5 w-1.5 shrink-0 rounded-full bg-day-2" />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
