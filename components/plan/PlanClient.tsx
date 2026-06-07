'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { deriveDays, type DerivedDay } from '@/src/lib/days';
import { dayRouteUrl, type TravelMode } from '@/src/lib/googleMapsUrl';
import { landingDate } from '@/src/lib/landingDate';
import { withBase } from '@/src/lib/basePath';
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
import type { RestaurantMarkerInput } from '@/src/lib/map/markers';
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
import { PlaceReadCard } from '@/components/plan/PlaceReadCard';
import { PlanMap } from '@/components/plan/PlanMap';

type TripLite = { id: string; name: string; startDate: string; endDate: string; coverPhoto: string | null };
type PlanData = { trip: TripLite; places: PlaceDTO[]; legs: LegDTO[]; restaurants: RestaurantMarkerInput[] };
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
  const [viewPlace, setViewPlace] = useState<PlaceDTO | null>(null);
  const [visibleDates, setVisibleDates] = useState<Set<string>>(new Set());
  // FIX I2+I5: track in-flight mutations to prevent double-fire
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // FIX C1: mounted guard so load() never setState on an unmounted/stale component
  const mountedRef = useRef(true);
  // Default the map's day-visibility to ALL days once data loads (empty = nothing
  // shown, which left the map at its {0,0} ocean default). Guarded so it runs once
  // per trip and never clobbers the user's later toggles or resets on refetch.
  const visibleInitRef = useRef(false);

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

  // FIX C1: flip mountedRef on unmount (also reset on tripId change via cleanup)
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, [tripId]);

  const load = useCallback(async () => {
    try {
      const [tripRes, placesRes, restaurantsRes] = await Promise.all([
        fetch(withBase(`/api/trips/${tripId}`), { credentials: 'same-origin' }),
        fetch(withBase(`/api/trips/${tripId}/places`), { credentials: 'same-origin' }),
        // Restaurants power the optional map overlay only — non-critical, so a
        // failure here must not error the whole plan (`.catch` → null below).
        fetch(withBase(`/api/trips/${tripId}/restaurants`), { credentials: 'same-origin' }).catch(
          () => null,
        ),
      ]);
      if (!tripRes.ok || !placesRes.ok) throw new Error('load failed');
      const { trip } = (await tripRes.json()) as { trip: TripLite };
      const { places, legs } = (await placesRes.json()) as { places: PlaceDTO[]; legs: LegDTO[] };
      let restaurants: RestaurantMarkerInput[] = [];
      if (restaurantsRes && restaurantsRes.ok) {
        const { restaurants: rows } = (await restaurantsRes.json()) as {
          restaurants: Array<{
            id: string;
            name: string;
            lat: number | null;
            lng: number | null;
            googlePlaceId: string | null;
          }>;
        };
        restaurants = rows.map((r) => ({
          id: r.id,
          name: r.name,
          lat: r.lat,
          lng: r.lng,
          googlePlaceId: r.googlePlaceId,
        }));
      }
      // FIX C1: only setState if still mounted
      if (mountedRef.current) setState({ status: 'loaded', data: { trip, places, legs, restaurants } });
    } catch {
      if (mountedRef.current) setState({ status: 'error' });
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Once trip data is loaded, seed visibleDates with every day so all pins show
  // on the map by default. Runs once per trip (ref guard) so user toggles and
  // post-mutation refetches don't reset it.
  useEffect(() => {
    if (state.status === 'loaded' && !visibleInitRef.current) {
      visibleInitRef.current = true;
      const dates = deriveDays(state.data.trip, tz).map((d) => d.date);
      setVisibleDates(new Set(dates));
    }
  }, [state, tz]);

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

  const { trip, places, legs, restaurants } = state.data;
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
   *
   * FIX I2+I5: wrapped in startTransition so isPending gates action buttons
   * (prevents double-fire). try/catch surfaces transient error; finally always
   * re-fetches so stale UI after a failed action is avoided.
   */
  function mutateDay(
    date: string | null,
    fn: () => Promise<unknown>,
    mode: TravelMode = dayMode,
  ) {
    setMutationError(null);
    startTransition(async () => {
      try {
        await fn();
        if (online && date) await recomputeDayLegsAction(tripId, date, mode);
      } catch {
        if (mountedRef.current) setMutationError(t('mutationFailed'));
      } finally {
        await load();
      }
    });
  }

  function onModeChange(m: TravelMode) {
    setDayMode(m);
    // Recompute with the NEW mode explicitly — `dayMode` state is still stale in
    // this closure until the next render.
    if (online) mutateDay(params.date, async () => undefined, m);
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
  function showOnlyDate(date: string) {
    setVisibleDates(new Set([date]));
  }
  function showAllDays() {
    setVisibleDates(new Set(days.map((d) => d.date)));
  }

  // FIX I2+I5: buttons are disabled both when offline AND when a mutation is in-flight
  const actionDisabled = !online || isPending;

  return (
    <main
      className={`mx-auto w-full max-w-md px-4 pt-2 ${
        params.view === 'map' ? 'flex min-h-0 flex-1 flex-col pb-2' : 'pb-24'
      }`}
    >
      {/* FIX I2: transient mutation error banner */}
      {mutationError ? (
        <p role="alert" className="mb-2 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
          {mutationError}
        </p>
      ) : null}

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
        <PlanMap
          bucket={params.bucket}
          dayGroups={dayGroups}
          legs={legs}
          mode={dayMode}
          visibleDates={visibleDates}
          onShowOnlyDate={showOnlyDate}
          onShowAllDays={showAllDays}
          onSelectPlace={(id) => setDetailFor(placeById(id))}
          onOpenDayRoute={onOpenDayRoute}
          onViewPlace={(id) => setViewPlace(placeById(id))}
          online={online}
          savedPlaces={saved}
          restaurants={restaurants}
        />
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
            disabled={actionDisabled}
            onAddPlace={() => setAddOpen(true)}
            onAddFromSaved={() => setParams({ bucket: 'saved' })}
            onReorder={(ids) => mutateDay(params.date, () => reorderDayAction(tripId, params.date, ids))}
            onTapPlace={(id) => setDetailFor(placeById(id))}
            onMoveToSaved={(id) => mutateDay(params.date, () => moveToSavedAction(id))}
            onMoveToDay={(id) => setDetailFor(placeById(id))}
            onDelete={(id) => mutateDay(params.date, () => deletePlaceAction(id))}
            onModeChange={onModeChange}
            onRecompute={() => mutateDay(params.date, async () => undefined)}
          />
        </>
      ) : (
        <SavedList
          saved={saved}
          days={days}
          disabled={actionDisabled}
          onPromote={(id, date) => mutateDay(date, () => promoteToDayAction(id, date))}
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
        onAdded={() => mutateDay(params.bucket === 'saved' ? null : params.date, async () => undefined)}
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

      {viewPlace ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={viewPlace.name}
          className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
          onClick={() => setViewPlace(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full p-3">
            <PlaceReadCard
              place={viewPlace}
              onClose={() => setViewPlace(null)}
              onEdit={() => { setDetailFor(viewPlace); setViewPlace(null); }}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
