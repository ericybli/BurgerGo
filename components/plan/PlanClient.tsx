'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { deriveDays, type DerivedDay } from '@/src/lib/days';
import { dayRouteUrl, type TravelMode } from '@/src/lib/googleMapsUrl';
import { landingDate } from '@/src/lib/landingDate';
import {
  parsePlanParams,
  buildPlanQuery,
  buildDayGroups,
  type PlanParams,
} from '@/src/lib/planUrl';
import {
  placesForDay,
  savedPlaces,
  dayColor,
  type PlaceDTO,
  type LegDTO,
} from '@/src/lib/planView';
import { indexLegs } from '@/src/lib/legView';
import {
  reorderDayAction,
  promoteToDayAction,
  moveToSavedAction,
  deletePlaceAction,
  recomputeDayLegsAction,
} from '@/app/_actions/places';
import { EmptyState } from '@/components/EmptyState';
import { DayStrip } from '@/components/plan/DayStrip';
import { DayItinerary } from '@/components/plan/DayItinerary';
import { SavedList } from '@/components/plan/SavedList';
import { TodayHero } from '@/components/plan/TodayHero';
import { AddPlaceSheet } from '@/components/plan/AddPlaceSheet';
import { PlaceDetailSheet } from '@/components/plan/PlaceDetailSheet';
import { PlanMap } from '@/components/plan/PlanMap';

type TripLite = { id: string; name: string; startDate: string; endDate: string; coverPhoto: string | null };
type PlanData = { trip: TripLite; places: PlaceDTO[]; legs: LegDTO[] };
type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; data: PlanData };

/** Current wall-clock HH:MM in the trip timezone (for next-stop selection). */
function nowHHMM(tz: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
}

export function PlanClient({
  tripId,
  tz,
  currency,
  locale = 'en',
}: {
  tripId: string;
  tz: string;
  currency: string;
  locale?: string;
}) {
  const t = useTranslations('plan');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [online, setOnline] = useState(true);
  const [dayMode, setDayMode] = useState<TravelMode>('walk');
  const [addOpen, setAddOpen] = useState(false);
  const [detailFor, setDetailFor] = useState<PlaceDTO | null>(null);
  const [visibleDates, setVisibleDates] = useState<Set<string>>(new Set());

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

  const load = useCallback(async () => {
    try {
      const [tripRes, placesRes] = await Promise.all([
        fetch(`/api/trips/${tripId}`, { credentials: 'same-origin' }),
        fetch(`/api/trips/${tripId}/places`, { credentials: 'same-origin' }),
      ]);
      if (!tripRes.ok || !placesRes.ok) throw new Error('load failed');
      const { trip } = (await tripRes.json()) as { trip: TripLite };
      const { places, legs } = (await placesRes.json()) as { places: PlaceDTO[]; legs: LegDTO[] };
      setState({ status: 'loaded', data: { trip, places, legs } });
    } catch {
      setState({ status: 'error' });
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  const legLookup = useMemo(
    () => indexLegs(state.status === 'loaded' ? state.data.legs : []),
    [state],
  );

  if (state.status === 'loading') {
    return <p className="px-4 py-8 text-center text-body text-ink-muted">{t('loading')}</p>;
  }
  if (state.status === 'error') {
    return (
      <EmptyState mascotAlt={t('addPlace')} headline={t('errorHeadline')} subtext={t('errorSubtext')} />
    );
  }

  const { trip, places, legs } = state.data;
  const days: DerivedDay[] = deriveDays(trip, tz);
  const landing = landingDate(trip, tz);
  const range = { startDate: trip.startDate, endDate: trip.endDate };
  const params: PlanParams = parsePlanParams(searchParams, range, landing);

  function setParams(patch: Partial<PlanParams>) {
    router.replace(`${pathname}?${buildPlanQuery({ ...params, ...patch })}`);
  }

  const dayIndex = days.findIndex((d) => d.date === params.date);
  const dayLabel = dayIndex >= 0 ? `Day ${days[dayIndex]!.dayNumber}` : 'Day';
  const color = dayColor(Math.max(0, dayIndex));
  const stops = placesForDay(places, params.date);
  const saved = savedPlaces(places);
  const selectedDay = days[dayIndex];
  const showTodayHero =
    params.bucket === 'days' && params.view === 'list' && !!selectedDay?.isToday && stops.length > 0;

  const placeById = (id: string) => places.find((p) => p.id === id) ?? null;

  /**
   * Run a mutation, recompute that day's legs (online only; saved bucket / null
   * date skips recompute), then re-fetch. `mode` defaults to the current day
   * mode but is passed explicitly on a mode change (state is stale in-closure).
   */
  async function mutateDay(
    date: string | null,
    fn: () => Promise<unknown>,
    mode: TravelMode = dayMode,
  ) {
    await fn();
    if (online && date) await recomputeDayLegsAction(tripId, date, mode);
    await load();
  }

  function onModeChange(m: TravelMode) {
    setDayMode(m);
    // Recompute with the NEW mode explicitly — `dayMode` state is still stale in
    // this closure until the next render.
    if (online) void mutateDay(params.date, async () => undefined, m);
  }

  // PlanMap seam (locked): build dayGroups + handlers; pass legs + mode + online.
  const dayGroups = buildDayGroups(params.bucket, days, places);
  function onOpenDayRoute(date: string) {
    const group = dayGroups.find((g) => g.date === date);
    if (!group || group.places.length === 0) return;
    const coords = group.places
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({ lat: p.lat as number, lng: p.lng as number }));
    if (coords.length === 0) return;
    window.open(dayRouteUrl(coords, dayMode), '_blank', 'noopener,noreferrer');
  }
  function onToggleDate(date: string) {
    setVisibleDates((cur) => {
      const next = new Set(cur);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-24 pt-2">
      {/* List/Map + Days/Saved toggles */}
      <div className="mb-3 flex gap-2">
        <div role="group" className="flex flex-1 rounded-control bg-card p-0.5 shadow-inset">
          <button
            type="button"
            aria-pressed={params.view === 'list'}
            onClick={() => setParams({ view: 'list' })}
            className={`flex-1 rounded-control py-1.5 text-caption font-medium ${params.view === 'list' ? 'bg-coral text-white' : 'text-ink-muted'}`}
          >
            {t('listTab')}
          </button>
          <button
            type="button"
            aria-pressed={params.view === 'map'}
            onClick={() => setParams({ view: 'map' })}
            className={`flex-1 rounded-control py-1.5 text-caption font-medium ${params.view === 'map' ? 'bg-coral text-white' : 'text-ink-muted'}`}
          >
            {t('mapTab')}
          </button>
        </div>
        <div role="group" className="flex flex-1 rounded-control bg-card p-0.5 shadow-inset">
          <button
            type="button"
            aria-pressed={params.bucket === 'days'}
            onClick={() => setParams({ bucket: 'days' })}
            className={`flex-1 rounded-control py-1.5 text-caption font-medium ${params.bucket === 'days' ? 'bg-coral text-white' : 'text-ink-muted'}`}
          >
            {t('daysTab')}
          </button>
          <button
            type="button"
            aria-pressed={params.bucket === 'saved'}
            onClick={() => setParams({ bucket: 'saved' })}
            className={`flex-1 rounded-control py-1.5 text-caption font-medium ${params.bucket === 'saved' ? 'bg-coral text-white' : 'text-ink-muted'}`}
          >
            {t('savedTab')}
          </button>
        </div>
      </div>

      {params.bucket === 'days' ? (
        <div className="mb-3">
          <DayStrip days={days} selectedDate={params.date} onSelect={(date) => setParams({ date })} />
        </div>
      ) : null}

      {params.view === 'map' ? (
        online ? (
          <PlanMap
            bucket={params.bucket}
            dayGroups={dayGroups}
            legs={legs}
            mode={dayMode}
            visibleDates={visibleDates}
            onToggleDate={onToggleDate}
            onSelectPlace={(id) => setDetailFor(placeById(id))}
            onOpenDayRoute={onOpenDayRoute}
            online={online}
          />
        ) : (
          <EmptyState
            mascotAlt={t('mapTab')}
            headline={t('mapNeedsConnectionHeadline')}
            subtext={t('mapNeedsConnectionSubtext')}
          />
        )
      ) : params.bucket === 'days' ? (
        <>
          {showTodayHero ? (
            <TodayHero stops={stops} legs={legLookup} mode={dayMode} nowHHMM={nowHHMM(tz)} />
          ) : null}
          <DayItinerary
            dayLabel={dayLabel}
            stops={stops}
            legs={legLookup}
            mode={dayMode}
            dayColor={color}
            currency={currency}
            locale={locale}
            disabled={!online}
            onAddPlace={() => setAddOpen(true)}
            onAddFromSaved={() => setParams({ bucket: 'saved' })}
            onReorder={(ids) => void mutateDay(params.date, () => reorderDayAction(tripId, params.date, ids))}
            onTapPlace={(id) => setDetailFor(placeById(id))}
            onMoveToSaved={(id) => void mutateDay(params.date, () => moveToSavedAction(id))}
            onMoveToDay={(id) => setDetailFor(placeById(id))}
            onDelete={(id) => void mutateDay(params.date, () => deletePlaceAction(id))}
            onModeChange={onModeChange}
            onRecompute={() => void mutateDay(params.date, async () => undefined)}
          />
        </>
      ) : (
        <SavedList
          saved={saved}
          days={days}
          disabled={!online}
          onPromote={(id, date) => void mutateDay(date, () => promoteToDayAction(id, date))}
          onTapPlace={(id) => setDetailFor(placeById(id))}
          onAddPlace={() => setAddOpen(true)}
        />
      )}

      <AddPlaceSheet
        open={addOpen}
        tripId={tripId}
        dayDate={params.bucket === 'saved' ? null : params.date}
        disabled={!online}
        onClose={() => setAddOpen(false)}
        onAdded={() => void mutateDay(params.bucket === 'saved' ? null : params.date, async () => undefined)}
      />

      {detailFor ? (
        <PlaceDetailSheet
          open
          place={detailFor}
          currency={currency}
          locale={locale}
          disabled={!online}
          onClose={() => setDetailFor(null)}
          onSaved={() => {
            setDetailFor(null);
            void load();
          }}
        />
      ) : null}
    </main>
  );
}
