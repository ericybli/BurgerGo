'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { withBase } from '@/src/lib/basePath';
import { fetchTripData } from '@/src/lib/tripData';
import { TRIP_DATA_CHANGED } from '@/src/lib/events';
import { deriveDays, type DerivedDay } from '@/src/lib/days';
import { filterByStatus, type EatsStatusFilter } from '@/src/lib/eatsView';
import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';
import { EmptyState } from '@/components/EmptyState';
import { RestaurantCard } from '@/components/eats/RestaurantCard';
import { RestaurantFormSheet } from '@/components/eats/RestaurantFormSheet';
import { RestaurantDetailSheet } from '@/components/eats/RestaurantDetailSheet';

type TripLite = { id: string; name: string; startDate: string; endDate: string; coverPhoto: string | null };

type EatsData = { trip: TripLite; restaurants: RestaurantDTO[] };
type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; data: EatsData };

const FILTERS: { value: EatsStatusFilter; key: 'filterAll' | 'filterWantToTry' | 'filterBeen' }[] = [
  { value: 'all', key: 'filterAll' },
  { value: 'want-to-try', key: 'filterWantToTry' },
  { value: 'been', key: 'filterBeen' },
];

export function EatsClient({
  tripId,
  tz,
}: {
  tripId: string;
  tz: string;
  currency: string;
  locale?: string;
}) {
  const t = useTranslations('eats');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [online, setOnline] = useState(true);
  const [filter, setFilter] = useState<EatsStatusFilter>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, [tripId]);

  const load = useCallback(async () => {
    try {
      const [tripData, restRes] = await Promise.all([
        // Coalesced with the trip shell's identical fetch (one request).
        fetchTripData(tripId),
        fetch(withBase(`/api/trips/${tripId}/restaurants`), { credentials: 'same-origin' }),
      ]);
      if (!restRes.ok) throw new Error('load failed');
      const trip: TripLite = tripData.trip;
      const { restaurants } = (await restRes.json()) as { restaurants: RestaurantDTO[] };
      if (mountedRef.current) setState({ status: 'loaded', data: { trip, restaurants } });
    } catch {
      if (mountedRef.current) setState({ status: 'error' });
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Re-fetch when another part of the shell (e.g. AI import) adds restaurants.
  useEffect(() => {
    const onChanged = () => void load();
    window.addEventListener(TRIP_DATA_CHANGED, onChanged);
    return () => window.removeEventListener(TRIP_DATA_CHANGED, onChanged);
  }, [load]);

  const days: DerivedDay[] = useMemo(
    () => (state.status === 'loaded' ? deriveDays(state.data.trip, tz) : []),
    [state, tz],
  );

  if (state.status === 'loading') {
    return <p className="px-4 py-8 text-center text-body text-sub">{t('loading')}</p>;
  }
  if (state.status === 'error') {
    return <EmptyState mascotAlt={t('title')} headline={t('errorHeadline')} subtext={t('errorSubtext')} />;
  }

  const { restaurants } = state.data;
  const visible = filterByStatus(restaurants, filter);
  const byId = (id: string | null) => restaurants.find((r) => r.id === id) ?? null;
  const detail = byId(detailId);
  const editing = byId(editId);

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-24 pt-2">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="flex-1 text-[21px] font-bold tracking-[-0.02em] text-ink">{t('title')}</h1>
        <button
          type="button"
          disabled={!online}
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center justify-center rounded-[10px] bg-orange px-3.5 py-2 text-label text-white transition hover:bg-orange-press active:bg-orange-press disabled:opacity-40"
        >
          {t('addRestaurant')}
        </button>
      </div>

      <div role="group" className="mb-3 flex gap-0.5 rounded-[10px] bg-surface p-[3px]">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-label transition ${
              filter === f.value ? 'bg-bg text-ink shadow-thumb' : 'text-sub'
            }`}
          >
            {t(f.key)}
          </button>
        ))}
      </div>

      {restaurants.length === 0 ? (
        <EmptyState
          mascotAlt={t('title')}
          headline={t('empty.headline')}
          subtext={t('empty.subtext')}
          actionLabel={online ? t('addRestaurant') : undefined}
          onAction={online ? () => setAddOpen(true) : undefined}
        />
      ) : (
        <ul className="flex flex-col">
          {visible.map((r, i) => (
            <li
              key={r.id}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
            >
              <RestaurantCard restaurant={r} onTap={(id) => setDetailId(id)} />
            </li>
          ))}
        </ul>
      )}

      <RestaurantFormSheet
        key={addOpen || editing !== null ? (editId ?? 'add') : 'closed'}
        open={addOpen || editing !== null}
        tripId={tripId}
        restaurant={editing}
        disabled={!online}
        onClose={() => {
          setAddOpen(false);
          setEditId(null);
        }}
        onSaved={() => {
          setAddOpen(false);
          setEditId(null);
          void load();
        }}
      />

      {detail ? (
        <RestaurantDetailSheet
          open
          restaurant={detail}
          days={days}
          disabled={!online}
          onClose={() => setDetailId(null)}
          onChanged={() => {
            setDetailId(null);
            void load();
          }}
          onEdit={(id) => {
            setDetailId(null);
            setEditId(id);
          }}
        />
      ) : null}
    </main>
  );
}
