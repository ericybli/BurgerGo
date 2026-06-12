import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import {
  api,
  photoUrl,
  type Leg,
  type Place,
  type PlacePatch,
  type PoiDetails,
  type TravelMode,
} from '../../lib/api';
import { useTrip } from '../../navigation/TripContext';
import { useOnline } from '../../lib/online';
import { colors, font, CATEGORIES } from '../../lib/theme';
import { DEFAULT_DAY_MODE, dayColor } from '../../lib/legView';
import { ErrorState, Loading, SegmentedControl, Sheet } from '../../components/ui';
import { indexLegsByMode } from './planShared';
import { generateSummary, placeDetails, setLegMode, setPlaceList } from './planApi';
import { TripOverview } from './TripOverview';
import { DayStrip } from './DayStrip';
import { DayItinerary } from './DayItinerary';
import { TodayHero } from './TodayHero';
import { SavedList } from './SavedList';
import { DayPickerSheet } from './DayPickerSheet';
import { AddPlaceSheet } from './AddPlaceSheet';
import { PlaceDetailSheet } from './PlaceDetailSheet';
import { PlaceViewSheet } from './PlaceViewSheet';
import PlanMap from './PlanMap';
import type { MapRestaurant } from './PlanMap.types';

type Data = {
  places: Place[];
  legs: Leg[];
  currency: string;
  dayModes: Record<string, TravelMode>;
  dayTitles: Record<string, string>;
  lists: { id: string; name: string }[];
  restaurants: MapRestaurant[];
};
type State = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; data: Data };
type ViewMode = 'list' | 'map';
type Bucket = 'days' | 'saved';
type DayPicker = { mode: 'move' | 'copy' | 'promote'; place: Place } | null;

export function PlanScreen() {
  const { tripId, days, startDate, endDate } = useTrip();
  const online = useOnline();
  // Transparent glass stack header (Task 5): the sticky in-page chrome starts
  // below it; the map/list area keeps its place under that chrome.
  const headerHeight = useHeaderHeight();

  // One day is always selected (web has no "All days" list view); the map adds
  // an "all days" overlay state of its own (selectedDate=null on the map).
  const [date, setDate] = useState<string>(() => {
    const today = days.find((d) => d.isToday);
    return (today ?? days[0])?.date ?? '';
  });
  const [mapAllDays, setMapAllDays] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [bucket, setBucket] = useState<Bucket>('days');

  const [state, setState] = useState<State>({ status: 'loading' });
  const [pending, setPending] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const [viewing, setViewing] = useState<Place | null>(null);
  const [editing, setEditing] = useState<Place | null>(null);
  const [adding, setAdding] = useState(false);
  const [dayPicker, setDayPicker] = useState<DayPicker>(null);

  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const [r, e] = await Promise.all([
        api.places.list(tripId),
        // Restaurants power the map overlay only — never fail the whole plan.
        api.eats.list(tripId).catch(() => ({ restaurants: [] })),
      ]);
      if (!mountedRef.current) return;
      // `notes` rides along beyond the frozen MapRestaurant contract — the
      // restaurant pin card (web RestaurantInfoCard parity) renders it.
      const restaurants: (MapRestaurant & { notes?: string | null })[] = e.restaurants
        .filter((x) => x.lat != null && x.lng != null)
        .map((x) => ({
          id: x.id,
          name: x.name,
          lat: x.lat as number,
          lng: x.lng as number,
          cuisine: x.cuisine,
          notes: x.notes,
          address: x.address,
          googlePlaceId: x.googlePlaceId,
          googleRating: x.googleRating,
          googleHours: x.googleHours,
          // Web thumbForRestaurant precedence: first personal photo → cached Google photo.
          photoUrl: x.photos[0]
            ? photoUrl.personal(x.photos[0].id, 'card')
            : x.photoPath != null
              ? photoUrl.restaurant(x.id, 'card')
              : null,
        }));
      setState({
        status: 'loaded',
        data: {
          places: r.places,
          legs: r.legs,
          currency: r.currency,
          dayModes: r.dayModes,
          dayTitles: r.dayTitles ?? {},
          lists: r.lists ?? [],
          restaurants,
        },
      });
    } catch {
      if (mountedRef.current) setState((s) => (s.status === 'loaded' ? s : { status: 'error' }));
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      void fetchData();
      return () => {
        mountedRef.current = false;
      };
    }, [fetchData]),
  );

  // AI import (trip header) creates places while this tab is focused — refetch.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('burgergo:dataChanged', () => void fetchData());
    return () => sub.remove();
  }, [fetchData]);

  const data = state.status === 'loaded' ? state.data : null;
  const places = data?.places ?? [];
  const currency = data?.currency ?? 'USD';
  const legLookup = useMemo(() => indexLegsByMode(data?.legs ?? []), [data?.legs]);

  const stopsForDate = useCallback(
    (d: string | null) => places.filter((p) => p.dayDate === d).sort((a, b) => a.orderIndex - b.orderIndex),
    [places],
  );
  const modeFor = useCallback(
    (d: string): TravelMode => data?.dayModes[d] ?? DEFAULT_DAY_MODE,
    [data?.dayModes],
  );

  const dayIndex = Math.max(
    0,
    days.findIndex((d) => d.date === date),
  );
  const selectedDay = days[dayIndex];
  const stops = stopsForDate(date);
  const saved = useMemo(() => stopsForDate(null), [stopsForDate]);
  const viewingLive = viewing ? (places.find((p) => p.id === viewing.id) ?? null) : null;

  const mapDayGroups = useMemo(
    () =>
      days.map((d, i) => ({
        date: d.date,
        dayNumber: d.dayNumber,
        color: dayColor(i),
        stops: stopsForDate(d.date),
      })),
    [days, stopsForDate],
  );

  // --- Mutation orchestration (web mutateDay parity) --------------------------

  /** Run a mutation with the in-flight guard + transient error + final refetch. */
  function run(fn: () => Promise<unknown>, errorMessage = 'Action failed — please try again.') {
    setMutationError(null);
    setPending(true);
    void (async () => {
      try {
        await fn();
      } catch {
        if (mountedRef.current) setMutationError(errorMessage);
      } finally {
        // Hold the in-flight guard through the refetch (web startTransition
        // parity): re-enabling before the reload paints opens a double-fire
        // window against stale ids/orderIndex.
        await fetchData();
        if (mountedRef.current) setPending(false);
      }
    })();
  }

  /** Mutate, then recompute that day's legs (online + real day only), refetch. */
  function mutateDay(d: string | null, fn: () => Promise<unknown>, mode?: TravelMode) {
    run(async () => {
      await fn();
      if (online && d) await api.places.recompute(tripId, d, mode ?? modeFor(d));
    });
  }

  /** Move recomputes BOTH the source day (lost a stop) and the target (gained one). */
  function moveToDay(place: Place, targetDate: string) {
    const sourceDate = place.dayDate;
    run(async () => {
      await api.places.move(tripId, place.id, targetDate, false);
      if (online) {
        await Promise.all([
          sourceDate && sourceDate !== targetDate
            ? api.places.recompute(tripId, sourceDate, modeFor(sourceDate))
            : Promise.resolve(null),
          api.places.recompute(tripId, targetDate, modeFor(targetDate)),
        ]);
      }
    });
  }

  function onModeChange(m: TravelMode) {
    // Optimistically reflect the new default right away, then persist +
    // recompute the day's legs with the new mode.
    setState((s) =>
      s.status === 'loaded'
        ? { ...s, data: { ...s.data, dayModes: { ...s.data.dayModes, [date]: m } } }
        : s,
    );
    if (online) mutateDay(date, () => api.places.setMode(tripId, date, m), m);
  }

  /** Save/clear a day's title: optimistic local update + fire the write. */
  function saveDayTitle(d: string, title: string | null) {
    setState((prev) => {
      if (prev.status !== 'loaded') return prev;
      const next = { ...prev.data.dayTitles };
      if (title) next[d] = title;
      else delete next[d];
      return { ...prev, data: { ...prev.data, dayTitles: next } };
    });
    api.places.setDayTitle(tripId, d, title).catch(() => {
      if (!mountedRef.current) return;
      setMutationError('Couldn’t save — please try again.');
      void fetchData();
    });
  }

  // --- Map seam (PlanMapProps contract) ---------------------------------------

  /** Map day selection ↔ list sync: "All days" on the map lands the list on day 1. */
  function onSelectDate(d: string | null) {
    if (d === null) {
      setMapAllDays(true);
      const first = days[0]?.date;
      if (first) setDate(first);
    } else {
      setMapAllDays(false);
      setDate(d);
    }
  }

  /** List DayStrip pick: select the day AND focus the map on it. */
  function selectDay(d: string) {
    setDate(d);
    setMapAllDays(false);
  }

  function poiCategory(poi: PoiDetails): string {
    return (CATEGORIES as readonly string[]).includes(poi.categoryGuess) ? poi.categoryGuess : 'other';
  }

  async function onPoiSavePlace(poi: PoiDetails) {
    const { place } = await api.places.create(tripId, {
      name: poi.name,
      address: poi.address,
      lat: poi.lat,
      lng: poi.lng,
      googlePlaceId: poi.googlePlaceId,
      category: poiCategory(poi),
      dayDate: null,
    });
    // Fire-and-forget: AI summary + cached-details fetch (downloads the place
    // photo so the card thumbnail shows). Never blocks the add.
    void generateSummary(tripId, place.id).catch(() => {});
    void placeDetails(poi.googlePlaceId).catch(() => {});
    await fetchData();
  }

  async function onPoiAddToDay(poi: PoiDetails, dayDate: string) {
    const { place } = await api.places.create(tripId, {
      name: poi.name,
      address: poi.address,
      lat: poi.lat,
      lng: poi.lng,
      googlePlaceId: poi.googlePlaceId,
      category: poiCategory(poi),
      dayDate,
    });
    void generateSummary(tripId, place.id).catch(() => {});
    void placeDetails(poi.googlePlaceId).catch(() => {});
    if (online) await api.places.recompute(tripId, dayDate, modeFor(dayDate)).catch(() => {});
    await fetchData();
  }

  async function onPoiSaveRestaurant(poi: PoiDetails) {
    // The POST schema rejects null fields and strips lat/lng/googlePlaceId
    // (the server re-geocodes the address into an address-type place id) —
    // create lean, then PATCH the tapped POI's exact identity. The PATCH path
    // (updateRestaurantAction) also refreshes persisted Google rating/hours/
    // photo, matching web addRestaurantAction (same pattern as RestaurantForm).
    const { restaurant } = await api.eats.create(tripId, {
      name: poi.name,
      status: 'want-to-try',
      ...(poi.address ? { address: poi.address } : {}),
    });
    await api.eats.update(tripId, restaurant.id, {
      lat: poi.lat,
      lng: poi.lng,
      googlePlaceId: poi.googlePlaceId,
    });
    await fetchData();
  }

  // --- Render -------------------------------------------------------------------

  const actionDisabled = !online || pending;
  const showDayStrip = bucket === 'days' && view === 'list';
  const showTodayHero = bucket === 'days' && view === 'list' && !!selectedDay?.isToday && stops.length > 0;
  const addDayDate = bucket === 'saved' ? null : date;

  return (
    <View style={[styles.root, { paddingTop: headerHeight }]}>
      {mutationError ? (
        <Text accessibilityRole="alert" style={styles.errorBanner}>
          {mutationError}
        </Text>
      ) : null}

      {/* Sticky chrome: overview + toggles + day strip stay put; only the
          itinerary scrolls beneath (web `sticky top-0` parity). */}
      <View style={[styles.header, view === 'list' && styles.headerListBorder]}>
        {bucket === 'days' && state.status === 'loaded' ? (
          <TripOverview
            tripId={tripId}
            trip={{ startDate, endDate }}
            days={days}
            places={places}
            online={online}
            onViewPlace={setViewing}
          />
        ) : null}

        <View style={styles.togglesRow}>
          <View style={{ flex: 1 }}>
            <SegmentedControl<ViewMode>
              options={[
                { value: 'list', label: 'List' },
                { value: 'map', label: 'Map' },
              ]}
              value={view}
              onChange={setView}
            />
          </View>
          <View style={{ flex: 1 }}>
            <SegmentedControl<Bucket>
              options={[
                { value: 'days', label: 'Days' },
                { value: 'saved', label: 'Saved' },
              ]}
              value={bucket}
              onChange={setBucket}
            />
          </View>
        </View>

        {showDayStrip ? (
          <View style={{ marginTop: 10 }}>
            <DayStrip days={days} selectedDate={date} onSelect={selectDay} />
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        {state.status === 'loading' ? (
          <Loading label="Loading your plan…" />
        ) : state.status === 'error' ? (
          <ErrorState
            headline="Couldn’t load this plan"
            subtext="Connect to the internet and try again."
            onRetry={() => {
              setState({ status: 'loading' });
              void fetchData();
            }}
          />
        ) : view === 'map' ? (
          <PlanMap
            bucket={bucket}
            dayGroups={mapDayGroups}
            legs={data?.legs ?? []}
            savedPlaces={saved}
            restaurants={data?.restaurants ?? []}
            dayModes={data?.dayModes ?? {}}
            selectedDate={mapAllDays ? null : date}
            onSelectDate={onSelectDate}
            online={online}
            onViewPlace={setViewing}
            onPoiSavePlace={onPoiSavePlace}
            onPoiAddToDay={onPoiAddToDay}
            onPoiSaveRestaurant={onPoiSaveRestaurant}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
            {bucket === 'days' ? (
              <>
                {showTodayHero ? <TodayHero stops={stops} legs={legLookup} mode={modeFor(date)} /> : null}
                <DayItinerary
                  dayLabel={`Day ${selectedDay?.dayNumber ?? dayIndex + 1}`}
                  dayDate={date}
                  dayTitle={data?.dayTitles[date] ?? null}
                  onSaveDayTitle={(title) => saveDayTitle(date, title)}
                  stops={stops}
                  legs={legLookup}
                  mode={modeFor(date)}
                  dayColor={dayColor(dayIndex)}
                  disabled={actionDisabled}
                  busy={pending}
                  online={online}
                  onAddPlace={() => setAdding(true)}
                  onAddFromSaved={() => setBucket('saved')}
                  onReorder={(ids) => mutateDay(date, () => api.places.reorder(tripId, date, ids))}
                  onTapPlace={setEditing}
                  onViewPlace={setViewing}
                  onMoveToSaved={(p) => mutateDay(date, () => api.places.move(tripId, p.id, null, false))}
                  onMoveToDay={(p) => setDayPicker({ mode: 'move', place: p })}
                  onCopyToDay={(p) => setDayPicker({ mode: 'copy', place: p })}
                  onDelete={(p) => mutateDay(date, () => api.places.remove(tripId, p.id))}
                  onModeChange={onModeChange}
                  onLegModeChange={(p, m) => mutateDay(date, () => setLegMode(tripId, p.id, m))}
                  onRecompute={() => mutateDay(date, async () => undefined)}
                />
              </>
            ) : (
              <SavedList
                saved={saved}
                lists={data?.lists ?? []}
                disabled={actionDisabled}
                onAddToDay={(p) => setDayPicker({ mode: 'promote', place: p })}
                onTapPlace={setEditing}
                onAddPlace={() => setAdding(true)}
                onMoveToList={(placeId, listId) => run(() => setPlaceList(tripId, placeId, listId))}
                onDelete={(p) => run(() => api.places.remove(tripId, p.id))}
                onCreateList={async (name) => {
                  const { list } = await api.savedLists.add(tripId, name);
                  await fetchData();
                  return list;
                }}
                onRenameList={(listId, name) => run(() => api.savedLists.rename(tripId, listId, name))}
                onDeleteList={(listId) => run(() => api.savedLists.remove(tripId, listId))}
              />
            )}
          </ScrollView>
        )}
      </View>

      {/* Read card */}
      <Sheet visible={viewingLive !== null} onClose={() => setViewing(null)}>
        {viewingLive ? (
          <PlaceViewSheet
            key={viewingLive.id}
            place={viewingLive}
            online={online}
            onClose={() => setViewing(null)}
            onEdit={() => {
              const p = viewingLive;
              setViewing(null);
              setEditing(p);
            }}
            onAddToDay={
              viewingLive.dayDate === null
                ? () => {
                    const p = viewingLive;
                    setViewing(null);
                    setDayPicker({ mode: 'promote', place: p });
                  }
                : undefined
            }
          />
        ) : null}
      </Sheet>

      {/* Add place — remounted blank each open */}
      <Sheet visible={adding} onClose={() => setAdding(false)}>
        {adding ? (
          <AddPlaceSheet
            key="add-open"
            tripId={tripId}
            dayDate={addDayDate}
            online={online}
            onClose={() => setAdding(false)}
            onAdded={() => {
              setAdding(false);
              mutateDay(addDayDate, async () => undefined);
            }}
          />
        ) : null}
      </Sheet>

      {/* Edit sheet */}
      <Sheet visible={editing !== null} onClose={() => setEditing(null)}>
        {editing ? (
          <PlaceDetailSheet
            key={editing.id}
            tripId={tripId}
            place={editing}
            currency={currency}
            online={online}
            onClose={() => setEditing(null)}
            onSaved={(placeId: string, patch: PlacePatch) => {
              // Optimistic merge so a reopen shows the change before the refetch.
              setState((s) =>
                s.status === 'loaded'
                  ? {
                      ...s,
                      data: {
                        ...s.data,
                        places: s.data.places.map((p) => (p.id === placeId ? { ...p, ...patch } : p)),
                      },
                    }
                  : s,
              );
              setEditing(null);
              void fetchData();
            }}
            onChanged={() => void fetchData()}
          />
        ) : null}
      </Sheet>

      {/* Day picker (move / copy / promote) */}
      <Sheet visible={dayPicker !== null} onClose={() => setDayPicker(null)}>
        {dayPicker ? (
          <DayPickerSheet
            key={`${dayPicker.mode}-${dayPicker.place.id}`}
            title={
              dayPicker.mode === 'copy'
                ? 'Copy to which day?'
                : dayPicker.mode === 'move'
                  ? 'Move to which day?'
                  : 'Add to which day?'
            }
            days={days}
            onPick={(targetDate) => {
              const p = dayPicker.place;
              if (dayPicker.mode === 'move') moveToDay(p, targetDate);
              else if (dayPicker.mode === 'copy')
                mutateDay(targetDate, () => api.places.move(tripId, p.id, targetDate, true));
              else mutateDay(targetDate, () => api.places.move(tripId, p.id, targetDate, false));
            }}
            onClose={() => setDayPicker(null)}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: font.medium,
    fontSize: 12,
    color: colors.danger,
  },
  header: { backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  headerListBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  togglesRow: { flexDirection: 'row', gap: 8 },
  // Bottom padding clears the floating glass tab bar (content scrolls under it).
  listContent: { padding: 16, paddingBottom: 150 },
});
