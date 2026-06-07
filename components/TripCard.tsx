'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Trip } from '@/src/db/schema';
import { tripStatus } from '@/src/lib/days';

const COVER_GRADIENT =
  'linear-gradient(135deg, #F2C879 0%, #EE5B3C 100%)';

// Pill background/text per spec §3.1: Upcoming=Sun, Active=Coral, Past=Teal-muted.
const PILL_CLASS: Record<'upcoming' | 'active' | 'past', string> = {
  upcoming: 'bg-sun-tint text-ink',
  active: 'bg-coral text-white',
  past: 'bg-teal-tint text-teal',
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

  return (
    <Link
      href={`/trip/${trip.id}`}
      className="block overflow-hidden rounded-card shadow-card"
    >
      <div
        className="relative flex h-40 flex-col justify-end p-4"
        // future: a later plan serves cover photos via /api/photos
        style={{ backgroundImage: COVER_GRADIENT }}
      >
        {onManage ? (
          <button
            type="button"
            aria-label={t('tripCard.edit')}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onManage(); }}
            className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-chip bg-card/90 text-ink shadow-card backdrop-blur active:bg-line"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        ) : null}
        <span
          className={`absolute right-3 top-3 rounded-chip px-3 py-1 text-caption font-medium ${PILL_CLASS[status]}`}
        >
          {t(`status.${status}`)}
        </span>
        <span className="text-display font-bold text-white drop-shadow">
          {trip.name}
        </span>
        <span className="mt-1 text-caption font-medium text-white/90 [font-variant-numeric:tabular-nums]">
          {t('tripCard.dateRange', { start, end, days })}
        </span>
      </div>
    </Link>
  );
}
