'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Pencil } from 'lucide-react';
import type { Trip } from '@/src/db/schema';
import { tripStatus, today, diffDays } from '@/src/lib/days';

// Atlas status pill: white pill, role-colored text (info=teal, active=orange, past=sub).
const PILL_CLASS: Record<'upcoming' | 'active' | 'past', string> = {
  upcoming: 'text-accent',
  active: 'text-orange',
  past: 'text-sub',
};

function formatRange(startDate: string, endDate: string): {
  start: string;
  end: string;
  days: number;
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const start = fmt.format(new Date(`${startDate}T00:00:00Z`));
  const end = fmt.format(new Date(`${endDate}T00:00:00Z`));
  const ms =
    new Date(`${endDate}T00:00:00Z`).getTime() -
    new Date(`${startDate}T00:00:00Z`).getTime();
  const days = Math.round(ms / 86_400_000) + 1;
  return { start, end, days };
}

export function TripCard({ trip, tz, onManage }: { trip: Trip; tz: string; onManage?: () => void }) {
  const t = useTranslations();
  const status = tripStatus(trip, tz);
  const { start, end, days } = formatRange(trip.startDate, trip.endDate);
  // Display-only stat: upcoming trips count down to the start; others show length.
  const statNumber = status === 'upcoming' ? diffDays(today(tz), trip.startDate) : days;
  const statLabel = status === 'upcoming' ? t('tripCard.daysOut') : t('tripCard.daysLabel');

  return (
    <Link
      href={`/trip/${trip.id}`}
      className="block overflow-hidden rounded-[18px] border border-line bg-bg transition active:scale-[0.99]"
    >
      <div
        className="relative block h-[180px] overflow-hidden bg-cover-gradient"
        // future: a later plan serves cover photos via /api/photos
      >
        <span
          className={`absolute left-3 top-3 z-10 rounded-chip bg-white/95 px-3 py-[5px] text-[11.5px] font-bold ${PILL_CLASS[status]}`}
        >
          {t(`status.${status}`)}
        </span>
        {onManage ? (
          <button
            type="button"
            aria-label={t('tripCard.edit')}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onManage(); }}
            className="absolute right-3 top-3 z-10 flex h-[34px] w-[34px] items-center justify-center rounded-chip bg-white/95 text-ink transition hover:bg-white active:scale-95"
          >
            <Pencil size={15} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <span className="min-w-0">
          <span className="block text-[19px] font-bold tracking-[-0.02em] text-ink">
            {trip.name}
          </span>
          <span className="mt-1 block text-[13px] text-sub [font-variant-numeric:tabular-nums]">
            {t('tripCard.dateRange', { start, end, days })}
          </span>
        </span>
        <span className="shrink-0 rounded-[12px] border border-line px-3 py-[7px] text-center">
          <span className="block text-[17px] font-extrabold text-ink [font-variant-numeric:tabular-nums]">
            {statNumber}
          </span>
          <span className="block text-[9.5px] font-bold uppercase tracking-[0.08em] text-faint">
            {statLabel}
          </span>
        </span>
      </div>
    </Link>
  );
}
