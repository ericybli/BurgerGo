'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Trip } from '@/src/db/schema';
import { TripCard } from '@/components/TripCard';
import { NewTripSheet } from '@/components/NewTripSheet';
import { EmptyState } from '@/components/EmptyState';

export function HomeClient({ trips, tz }: { trips: Trip[]; tz: string }) {
  const t = useTranslations();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-24 pt-4">
      {trips.length === 0 ? (
        <EmptyState
          mascotAlt={t('mascot.alt')}
          headline={t('home.emptyHeadline')}
          subtext={t('home.emptySubtext')}
          actionLabel={t('home.emptyCta')}
          onAction={() => setSheetOpen(true)}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <TripCard trip={trip} tz={tz} />
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        aria-label={t('home.newTrip')}
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-chip bg-coral text-2xl font-bold text-white shadow-lift active:bg-coral-press"
      >
        +
      </button>

      <NewTripSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </main>
  );
}
