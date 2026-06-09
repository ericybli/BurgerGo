'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Trip } from '@/src/db/schema';
import { withBase } from '@/src/lib/basePath';
import { TripCard } from '@/components/TripCard';
import { NewTripSheet } from '@/components/NewTripSheet';
import { ManageTripSheet } from '@/components/ManageTripSheet';
import { EmptyState } from '@/components/EmptyState';
import { OnboardingNote } from '@/components/OnboardingNote';

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; trips: Trip[] }
  | { status: 'error' };

/**
 * Home data owner. The page is a static shell (no server DB read) so the SW can
 * cache it; the live trip list comes from `/api/trips`, which the SW SWR-caches.
 * Offline, the cached JSON is served and the list still renders. (spec §7.3/§8.2)
 */
export function HomeClient({ tz }: { tz: string }) {
  const t = useTranslations();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [manageTrip, setManageTrip] = useState<Trip | null>(null);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const loadTrips = useCallback(async () => {
    try {
      const res = await fetch(withBase('/api/trips'), { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const trips = (await res.json()) as Trip[];
      if (mountedRef.current) setState({ status: 'loaded', trips });
    } catch {
      // Fetch failed AND the SW had no cached response → friendly error.
      if (mountedRef.current) setState({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-24 pt-4">
      <OnboardingNote />
      {state.status === 'loading' ? (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          {/* Bundled mascot → always renders offline. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={withBase('/burgergo-logo.png')}
            alt={t('mascot.alt')}
            width={96}
            height={96}
            className="mb-4 h-24 w-24 animate-pulse opacity-90"
          />
          <p className="text-body text-ink-muted">{t('home.loading')}</p>
        </div>
      ) : state.status === 'error' ? (
        <EmptyState
          mascotAlt={t('mascot.alt')}
          headline={t('home.errorHeadline')}
          subtext={t('home.errorSubtext')}
          actionLabel={t('common.retry')}
          onAction={() => void loadTrips()}
        />
      ) : state.trips.length === 0 ? (
        <EmptyState
          mascotAlt={t('mascot.alt')}
          headline={t('home.emptyHeadline')}
          subtext={t('home.emptySubtext')}
          actionLabel={t('home.emptyCta')}
          onAction={() => setSheetOpen(true)}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {state.trips.map((trip, i) => (
            <li
              key={trip.id}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
            >
              <TripCard trip={trip} tz={tz} onManage={() => setManageTrip(trip)} />
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        aria-label={t('home.newTrip')}
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-chip bg-coral text-2xl font-bold text-white shadow-lift transition hover:bg-coral-press hover:shadow-lift active:scale-95 active:bg-coral-press"
      >
        +
      </button>

      <NewTripSheet
        key={sheetOpen ? 'open' : 'closed'}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={() => void loadTrips()}
      />

      {manageTrip ? (
        <ManageTripSheet
          key={manageTrip.id}
          trip={manageTrip}
          onClose={() => setManageTrip(null)}
          onChanged={() => void loadTrips()}
        />
      ) : null}
    </main>
  );
}
