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
            onClick={() => onSelect(d.date)}
            className={`relative flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[12px] border px-3 py-2 text-[13px] font-semibold transition active:scale-[0.98] [font-variant-numeric:tabular-nums] ${
              active ? 'border-ink bg-ink text-white' : 'border-line bg-bg text-ink'
            }`}
          >
            {d.isToday ? (
              <span aria-label={t('todayDot')} className="h-1.5 w-1.5 shrink-0 rounded-full bg-day-2" />
            ) : null}
            <span>
              {t('dayChip', {
                n: d.dayNumber,
                weekday: d.weekday.slice(0, 3),
                date: shortDate(d.date),
              })}
            </span>
          </button>
        );
      })}
    </div>
  );
}
