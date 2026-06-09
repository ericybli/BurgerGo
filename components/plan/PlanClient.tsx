'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { deriveDays, type DerivedDay } from '@/src/lib/days';
import { dayRouteUrl, DEFAULT_DAY_MODE, type TravelMode } from '@/src/lib/googleMapsUrl';
import { landingDate } from '@/src/lib/landingDate';
import { withBase } from '@/src/lib/basePath';
import { fetchTripData } from '@/src/lib/tripData';
import { TRIP_DATA_CHANGED } from '@/src/lib/events';
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
  type SavedListItem,
} from '@/src/lib/planView';
import { indexLegs } from '@/src/lib/legView';
import type { RestaurantMarkerInput } from '@/src/lib/map/markers';
import {
  reorderDayAction,
  promoteToDayAction,
  copyPlaceToDayAction,
  moveToSavedAction,
  deletePlaceAction,
  recomputeDayLegsAction,
  setLegModeAction,
  setDayModeAction,
  setPlaceListAction,
} from '@/app/_actions/places';
import {
  addSavedListAction,
  renameSavedListAction,
  deleteSavedListAction,
} from '@/app/_actions/savedLists';
import { EmptyState } from '@/components/EmptyState';
import { DayStrip } from '@/components/plan/DayStrip';
import { DayItinerary } from '@/components/plan/DayItinerary';
import { SavedList } from '@/components/plan/SavedList';
import { TodayHero } from '@/components/plan/TodayHero';
import { TripOverview } from '@/components/plan/TripOverview';
import { AddPlaceSheet } from '@/components/plan/AddPlaceSheet';
import { PlaceDetailSheet } from '@/components/plan/PlaceDetailSheet';
import { PlaceReadCard } from '@/components/plan/PlaceReadCard';
import { RestaurantInfoCard } from '@/components/plan/RestaurantInfoCard';
import { DayPickerSheet } from '@/components/plan/DayPickerSheet';

// P1: code-split the whole map subtree (MapCanvas + both providers + mapbox-gl.css
// + legend) out of the Plan tab's initial bundle. It loads only when the user
// opens map view (`params.view === 'map'`), keeping the default list-view payload
// small. ssr:false — the map is client-only (no server render of map internals).
const PlanMap = dynamic(() => import('@/components/plan/PlanMap').then((m) => ({ default: m.PlanMap })), {
  ssr: false,
});

type TripLite = { id: string; name: string; startDate: string; endDate: string; coverPhoto: string | null };
type PlanData = {
  trip: TripLite;
  places: PlaceDTO[];
  legs: LegDTO[];
  restaurants: RestaurantMarkerInput[];
  /** Sparse per-day default travel mode (dayDate → mode); missing → DEFAULT_DAY_MODE. */
  dayModes: Record<string, TravelMode>;
  /** Saved-place grouping lists (id + name), in display order. */
  lists: SavedListItem[];
};
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

/** Stable identity for a leg (matches `buildDayPaths` / `indexLegs`). */
// Structural key so both full LegDTOs and the slim heavy-hydrate legs match.
const legKey = (l: { fromPlaceId: string; toPlaceId: string; mode: TravelMode }) =>
  `${l.fromPlaceId}|${l.toPlaceId}|${l.mode}`;

/**
 * Merge the heavy fields from a `?detail=full` fetch into already-loaded state:
 * per-place `aiSummary` and per-leg route `polyline`. Maps over the current
 * places/legs (preserving any optimistic edits + add/remove since the light
 * load) and only fills fields for ids/legs still present.
 */
function mergeHeavyFields(
  state: Extract<LoadState, { status: 'loaded' }>,
  heavyPlaces: { id: string; aiSummary: string | null }[],
  heavyLegs: { fromPlaceId: string; toPlaceId: string; mode: TravelMode; polyline: string | null }[],
): LoadState {
  const summaryById = new Map(heavyPlaces.map((p) => [p.id, p.aiSummary]));
  const polylineByLeg = new Map(heavyLegs.map((l) => [legKey(l), l.polyline]));
  return {
    ...state,
    data: {
      ...state.data,
      places: state.data.places.map((p) =>
        summaryById.has(p.id) ? { ...p, aiSummary: summaryById.get(p.id) ?? null } : p,
      ),
      legs: state.data.legs.map((l) => {
        const polyline = polylineByLeg.get(legKey(l));
        return polyline != null ? { ...l, polyline } : l;
      }),
    },
  };
}

export function PlanClient({
  tripId,
  tz,
}: {
  tripId: string;
  tz: string;
}) {
  const t = useTranslations('plan');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [online, setOnline] = useState(true);
  // Trip display currency (from the places response), for the place-cost field (F3).
  const [currency, setCurrency] = useState('USD');
  const [addOpen, setAddOpen] = useState(false);
  const [detailFor, setDetailFor] = useState<PlaceDTO | null>(null);
  const [viewPlace, setViewPlace] = useState<PlaceDTO | null>(null);
  const [viewRestaurant, setViewRestaurant] = useState<RestaurantMarkerInput | null>(null);
  // Day picker for moving / copying a day place to another date.
  const [dayPicker, setDayPicker] = useState<{ mode: 'move' | 'copy' | 'promote'; placeId: string } | null>(null);
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

  const load = useCallback(async (opts?: { full?: boolean }) => {
    // After a mutation the list is already painted, so skip the light→heavy split
    // and pull the full payload in one request (P3). Mount uses the split below.
    const reload = opts?.full === true;
    try {
      const [tripData, placesRes, restaurantsRes] = await Promise.all([
        // Coalesced with the trip shell's identical fetch (one request).
        fetchTripData(tripId),
        // Light list payload (mount) or full (reload). Light omits aiSummary +
        // route polylines — hydrated by the slim heavy pass below.
        fetch(withBase(`/api/trips/${tripId}/places${reload ? '?detail=full' : ''}`), { credentials: 'same-origin' }),
        // Restaurants power the optional map overlay only — non-critical, so a
        // failure here must not error the whole plan (`.catch` → null below).
        fetch(withBase(`/api/trips/${tripId}/restaurants`), { credentials: 'same-origin' }).catch(
          () => null,
        ),
      ]);
      if (!placesRes.ok) throw new Error('load failed');
      const trip: TripLite = tripData.trip;
      const { places, legs, dayModes, lists, currency: cur } = (await placesRes.json()) as {
        places: PlaceDTO[];
        legs: LegDTO[];
        dayModes: Record<string, TravelMode>;
        lists: SavedListItem[];
        currency?: string;
      };
      if (cur) setCurrency(cur);
      let restaurants: RestaurantMarkerInput[] = [];
      if (restaurantsRes && restaurantsRes.ok) {
        const { restaurants: rows } = (await restaurantsRes.json()) as {
          restaurants: Array<{
            id: string;
            name: string;
            lat: number | null;
            lng: number | null;
            googlePlaceId: string | null;
            cuisine: string | null;
            address: string | null;
            notes: string | null;
            photoPath: string | null;
            photos: { id: string; width: number | null; height: number | null }[];
          }>;
        };
        restaurants = rows.map((r) => ({
          id: r.id,
          name: r.name,
          lat: r.lat,
          lng: r.lng,
          googlePlaceId: r.googlePlaceId,
          cuisine: r.cuisine,
          address: r.address,
          notes: r.notes,
          photoPath: r.photoPath,
          photos: r.photos,
        }));
      }
      // FIX C1: only setState if still mounted
      if (mountedRef.current) setState({ status: 'loaded', data: { trip, places, legs, restaurants, dayModes, lists } });
    } catch {
      if (mountedRef.current) setState({ status: 'error' });
      return;
    }
    // Reload already pulled the full payload — nothing left to hydrate.
    if (reload) return;
    // Background hydrate (perf): the list paints from the light payload above;
    // now pull ONLY the heavy fields the list never needs — per-place aiSummary
    // (read card) + route polylines (map) — via the slim heavy endpoint, and merge.
    try {
      const res = await fetch(withBase(`/api/trips/${tripId}/places?detail=heavy`), {
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      const { places: heavyPlaces, legs: heavyLegs } = (await res.json()) as {
        places: { id: string; aiSummary: string | null }[];
        legs: { fromPlaceId: string; toPlaceId: string; mode: TravelMode; polyline: string | null }[];
      };
      if (mountedRef.current) {
        setState((s) => (s.status === 'loaded' ? mergeHeavyFields(s, heavyPlaces, heavyLegs) : s));
      }
    } catch {
      // Offline / failed → keep the light data; summaries + road polylines just
      // stay absent (the map falls back to straight stop-to-stop segments).
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Re-fetch when another part of the shell (e.g. AI import) adds places.
  useEffect(() => {
    const onChanged = () => void load({ full: true });
    window.addEventListener(TRIP_DATA_CHANGED, onChanged);
    return () => window.removeEventListener(TRIP_DATA_CHANGED, onChanged);
  }, [load]);

  // Escape closes the place read-card / restaurant info overlays.
  useEffect(() => {
    if (!viewPlace && !viewRestaurant) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setViewPlace(null);
        setViewRestaurant(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [viewPlace, viewRestaurant]);

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

  const { trip, places, legs, restaurants, dayModes, lists } = state.data;
  const days: DerivedDay[] = deriveDays(trip, tz);
  const landing = landingDate(trip, tz);
  const range = { startDate: trip.startDate, endDate: trip.endDate };
  const params: PlanParams = parsePlanParams(searchParams, range, landing);
  // The selected day's default travel mode: its stored override, else the global
  // default ('drive'). Persisted per day (day_modes), so it survives reload.
  const dayMode: TravelMode = dayModes[params.date] ?? DEFAULT_DAY_MODE;

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
   * Optimistically merge an edited place's fields into local state so a reopen
   * reflects the change immediately — the async `load()` below reconciles it,
   * but this closes the window where reopening before the reload landed showed
   * stale (e.g. empty) values.
   */
  const applyPlacePatch = (placeId: string, patch: Partial<PlaceDTO>) => {
    setState((s) =>
      s.status === 'loaded'
        ? { ...s, data: { ...s.data, places: s.data.places.map((p) => (p.id === placeId ? { ...p, ...patch } : p)) } }
        : s,
    );
  };

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
        await load({ full: true });
      }
    });
  }

  /** Reassign a place to `targetDate`; recompute legs for both the source day
   *  (it lost a stop) and the target day (it gained one). */
  function moveToDay(placeId: string, targetDate: string) {
    const sourceDate = params.date;
    setMutationError(null);
    startTransition(async () => {
      try {
        await promoteToDayAction(placeId, targetDate);
        if (online) {
          // Source + target days are independent → recompute both at once.
          await Promise.all([
            recomputeDayLegsAction(tripId, sourceDate, dayMode),
            recomputeDayLegsAction(tripId, targetDate, dayMode),
          ]);
        }
      } catch {
        if (mountedRef.current) setMutationError(t('mutationFailed'));
      } finally {
        await load({ full: true });
      }
    });
  }

  /** Duplicate a place onto `targetDate` (original stays); recompute the target day. */
  function copyToDay(placeId: string, targetDate: string) {
    setMutationError(null);
    startTransition(async () => {
      try {
        await copyPlaceToDayAction(placeId, targetDate);
        if (online) await recomputeDayLegsAction(tripId, targetDate, dayMode);
      } catch {
        if (mountedRef.current) setMutationError(t('mutationFailed'));
      } finally {
        await load({ full: true });
      }
    });
  }

  function onModeChange(m: TravelMode) {
    // Optimistically reflect the new default in the selector right away, then
    // persist it (day_modes) and recompute the day's legs with the new mode.
    setState((s) =>
      s.status === 'loaded'
        ? { ...s, data: { ...s.data, dayModes: { ...s.data.dayModes, [params.date]: m } } }
        : s,
    );
    if (online) mutateDay(params.date, () => setDayModeAction(tripId, params.date, m), m);
  }

  // --- Saved-bucket list management (online-only; no leg recompute needed) ---
  function runSavedMutation(fn: () => Promise<unknown>) {
    setMutationError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch {
        if (mountedRef.current) setMutationError(t('mutationFailed'));
      } finally {
        await load({ full: true });
      }
    });
  }
  function moveToList(placeId: string, listId: string | null) {
    runSavedMutation(() => setPlaceListAction(placeId, listId));
  }
  function deleteSavedPlace(placeId: string) {
    runSavedMutation(() => deletePlaceAction(placeId));
  }
  function renameList(listId: string, name: string) {
    runSavedMutation(() => renameSavedListAction(tripId, listId, name));
  }
  function deleteList(listId: string) {
    runSavedMutation(() => deleteSavedListAction(tripId, listId));
  }
  /** Create a list and re-fetch; returns it so the caller can move a place in. */
  async function createList(name: string): Promise<SavedListItem> {
    const row = await addSavedListAction(tripId, name);
    await load({ full: true });
    return { id: row.id, name: row.name };
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

      {/* F1: collapsible trip-at-a-glance panel (days bucket only). Default
          collapsed; shows the relevant day's date, weather, next stop, plan + hotel. */}
      {params.bucket === 'days' ? (
        <TripOverview
          tripId={tripId}
          trip={trip}
          tz={tz}
          days={days}
          places={places}
          nowHHMM={nowHHMM(tz)}
          onViewPlace={(id) => setViewPlace(placeById(id))}
        />
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

      {/* The top day strip drives the LIST view's selected day. In map view the
          map's own legend ("All days / Day N") is the day control, so the strip
          is hidden there to avoid two redundant day selectors. */}
      {params.bucket === 'days' && params.view === 'list' ? (
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
          onOpenDayRoute={onOpenDayRoute}
          onViewPlace={(id) => setViewPlace(placeById(id))}
          onViewRestaurant={(id) => setViewRestaurant(restaurants.find((r) => r.id === id) ?? null)}
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
            dayDate={params.date}
            stops={stops}
            legs={legLookup}
            mode={dayMode}
            dayColor={color}
            disabled={actionDisabled}
            online={online}
            onAddPlace={() => setAddOpen(true)}
            onAddFromSaved={() => setParams({ bucket: 'saved' })}
            onReorder={(ids) => mutateDay(params.date, () => reorderDayAction(tripId, params.date, ids))}
            onTapPlace={(id) => setDetailFor(placeById(id))}
            onViewPlace={(id) => setViewPlace(placeById(id))}
            onMoveToSaved={(id) => mutateDay(params.date, () => moveToSavedAction(id))}
            onMoveToDay={(id) => setDayPicker({ mode: 'move', placeId: id })}
            onCopyToDay={(id) => setDayPicker({ mode: 'copy', placeId: id })}
            onDelete={(id) => mutateDay(params.date, () => deletePlaceAction(id))}
            onModeChange={onModeChange}
            onLegModeChange={(placeId, m) => mutateDay(params.date, () => setLegModeAction(placeId, m))}
            onRecompute={() => mutateDay(params.date, async () => undefined)}
          />
        </>
      ) : (
        <SavedList
          saved={saved}
          lists={lists}
          days={days}
          disabled={actionDisabled}
          onPromote={(id, date) => mutateDay(date, () => promoteToDayAction(id, date))}
          onTapPlace={(id) => setDetailFor(placeById(id))}
          onAddPlace={() => setAddOpen(true)}
          onMoveToList={moveToList}
          onDelete={deleteSavedPlace}
          onCreateList={createList}
          onRenameList={renameList}
          onDeleteList={deleteList}
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
          disabled={!online}
          onClose={() => setDetailFor(null)}
          onSaved={(placeId, patch) => {
            if (placeId && patch) applyPlacePatch(placeId, patch);
            setDetailFor(null);
            void load({ full: true });
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
              onAddToDay={
                viewPlace.dayDate === null
                  ? () => { const id = viewPlace.id; setViewPlace(null); setDayPicker({ mode: 'promote', placeId: id }); }
                  : undefined
              }
            />
          </div>
        </div>
      ) : null}

      {viewRestaurant ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={viewRestaurant.name}
          className="fixed inset-0 z-50 flex items-end justify-center bg-[rgb(110_85_68_/_0.35)] px-3 pb-24"
          onClick={() => setViewRestaurant(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
            <RestaurantInfoCard restaurant={viewRestaurant} onClose={() => setViewRestaurant(null)} />
          </div>
        </div>
      ) : null}

      <DayPickerSheet
        open={dayPicker !== null}
        title={dayPicker?.mode === 'copy' ? t('copyToDayTitle') : dayPicker?.mode === 'promote' ? t('dayPickerTitle') : t('moveToDayTitle')}
        days={days}
        onPick={(date) => {
          if (!dayPicker) return;
          if (dayPicker.mode === 'copy') copyToDay(dayPicker.placeId, date);
          else if (dayPicker.mode === 'promote') mutateDay(date, () => promoteToDayAction(dayPicker.placeId, date));
          else moveToDay(dayPicker.placeId, date);
        }}
        onClose={() => setDayPicker(null)}
      />
    </main>
  );
}
