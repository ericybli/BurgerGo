'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { TripHeader } from '@/components/TripHeader';
import { BottomTabBar } from '@/components/BottomTabBar';
import { EmptyState } from '@/components/EmptyState';
import { landingDate } from '@/src/lib/landingDate';
import { fetchTripData } from '@/src/lib/tripData';
import type { Trip } from '@/src/db/schema';

/** Browser-resolved IANA timezone; mirrors env.TZ for client-side day math. */
function clientTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function formatSubtitle(startDate: string, endDate: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const start = fmt.format(new Date(`${startDate}T00:00:00Z`));
  const end = fmt.format(new Date(`${endDate}T00:00:00Z`));
  return `${start} – ${end}`;
}

type ShellState =
  | { status: 'loading' }
  | { status: 'loaded'; trip: Trip }
  | { status: 'notFound' };

/**
 * Client shell for a trip. The layout is a static app shell (no server DB read)
 * so the SW can cache the page document; this owns the per-trip data fetched from
 * `/api/trips/:id` (SWR-cached). Offline navigations to a previously-visited trip
 * serve the cached shell + cached JSON. (spec §7.3/§8.2)
 */
export function TripShellClient({
  tripId,
  children,
}: {
  tripId: string;
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const [state, setState] = useState<ShellState>({ status: 'loading' });
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active-trip auto-land (spec §2/§3.8): once the trip resolves, if we are on
  // the Plan path with no `date` param, replace the URL with the landing date
  // (today for active trips, start_date otherwise). Client-side so the page
  // stays a static, cacheable shell — no server DB read, no force-dynamic.
  useEffect(() => {
    if (state.status !== 'loaded') return;
    if (!pathname.endsWith('/plan')) return;
    if (searchParams.get('date')) return;
    const date = landingDate(state.trip, clientTz());
    router.replace(`/trip/${tripId}/plan?view=list&bucket=days&date=${date}`);
  }, [state, pathname, searchParams, router, tripId]);

  // Lock the document to the viewport while a trip is open so only the inner
  // region scrolls (the shell is a fixed-height column; the body must not scroll
  // or rubber-band — `min-h-screen`/100vh overflows the visible area on iOS).
  // Restored on unmount so Home/Settings scroll normally.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // Coalesced with the active tab client's identical fetch (one request).
        const { trip } = await fetchTripData(tripId);
        if (!cancelled) setState({ status: 'loaded', trip });
      } catch {
        // 404, any 5xx/network error, or offline with no cached trip → all
        // intentionally mapped to notFound. For a private single-user app,
        // "can't load" and "not found" are the same user-facing outcome; a
        // distinct error screen adds no value here.
        if (!cancelled) setState({ status: 'notFound' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  if (state.status === 'notFound') {
    return (
      <div className="min-h-screen">
        <EmptyState
          mascotAlt={t('mascot.alt')}
          headline={t('trip.notFoundHeadline')}
          subtext={t('trip.notFoundSubtext')}
        />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {state.status === 'loading' ? (
        <header className="flex items-center gap-2 px-2 py-3" aria-busy="true">
          <div className="h-11 w-11 animate-pulse rounded-chip bg-line" />
          <div className="min-w-0 flex-1">
            <div className="h-5 w-1/2 animate-pulse rounded-control bg-line" />
            <p className="mt-1 text-caption text-ink-muted">{t('trip.loading')}</p>
          </div>
        </header>
      ) : (
        <div className="shrink-0">
          <TripHeader
            tripId={state.trip.id}
            name={state.trip.name}
            dateSubtitle={formatSubtitle(state.trip.startDate, state.trip.endDate)}
          />
        </div>
      )}
      {/* The single scroll region: the page itself never scrolls (shell is a
          fixed-height overflow-hidden column); inner content scrolls here, and
          map view fills it (flex-1) so the map drags instead of scrolling. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain">{children}</div>
      <BottomTabBar tripId={tripId} />
    </div>
  );
}
