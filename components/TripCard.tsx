'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Trip } from '@/src/db/schema';
import { tripStatus } from '@/src/lib/days';

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
      className="block overflow-hidden rounded-card shadow-card transition-[transform,box-shadow] duration-200 ease-spring hover:shadow-lift active:scale-[0.99]"
    >
      <div
        className="relative flex h-40 flex-col justify-end overflow-hidden bg-cover-gradient p-4"
        // future: a later plan serves cover photos via /api/photos
      >
        {/* Grain + bottom scrim keep white text legible over the warm gradient. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-overlay"
          style={{
            backgroundSize: '160px 160px',
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
          style={{ background: 'linear-gradient(to top, var(--scrim), transparent)' }}
        />
        {onManage ? (
          <button
            type="button"
            aria-label={t('tripCard.edit')}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onManage(); }}
            className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-chip bg-card/90 text-ink shadow-card backdrop-blur transition hover:bg-card active:scale-95 active:bg-line"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        ) : null}
        <span
          className={`absolute right-3 top-3 z-10 rounded-chip px-3 py-1 text-caption font-medium ${PILL_CLASS[status]}`}
        >
          {t(`status.${status}`)}
        </span>
        <span className="relative z-10 font-serif text-display font-bold text-white drop-shadow">
          {trip.name}
        </span>
        <span className="relative z-10 mt-1 text-caption font-medium text-white/90 [font-variant-numeric:tabular-nums]">
          {t('tripCard.dateRange', { start, end, days })}
        </span>
      </div>
    </Link>
  );
}
