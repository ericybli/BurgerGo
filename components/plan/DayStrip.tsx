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
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {days.map((d) => {
        const active = d.date === selectedDate;
        return (
          <button
            key={d.date}
            type="button"
            aria-current={active ? 'true' : undefined}
            onClick={() => onSelect(d.date)}
            className={`relative flex shrink-0 items-center gap-1 rounded-chip px-3 py-1.5 text-caption font-medium transition-[transform,box-shadow,background-color] duration-200 ease-spring active:scale-95 ${
              active
                ? 'bg-coral text-white shadow-card'
                : 'bg-card text-ink-muted shadow-hair hover:shadow-card'
            }`}
          >
            {d.isToday ? (
              <span aria-label={t('todayDot')} className="h-1.5 w-1.5 rounded-full bg-sun" />
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
