/**
 * Eats — restaurant list for a trip (Atlas Light). Status filter segmented
 * control, hairline-divided rows with a fade-up entrance stagger, add/edit
 * form sheet and a detail sheet. Reads are public GETs; writes go through
 * `api.eats`. Reload-after-write: detail mutations close the sheet then
 * reload (web behavior); photo ops reload while staying open.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, DeviceEventEmitter, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, type Restaurant } from '../../lib/api';
import { useTrip } from '../../navigation/TripContext';
import { useOnline } from '../../lib/online';
import { filterByStatus, type EatsFilter } from '../../lib/eatsView';
import { Button, EmptyState, ErrorState, Loading, SegmentedControl, Sheet } from '../../components/ui';
import { colors, font } from '../../lib/theme';
import { RestaurantForm } from './RestaurantForm';
import { RestaurantDetail } from './RestaurantDetail';
import { RestaurantCard } from './RestaurantCard';

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; restaurants: Restaurant[] };

const FILTER_OPTIONS: { value: EatsFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'want-to-try', label: 'Want to try' },
  { value: 'been', label: 'Been' },
];

/** Web `animate-fade-up`: fade + 8px rise, staggered min(index,6) × 40ms. */
function FadeUpRow({ index, children }: { index: number; children: ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 300,
      delay: Math.min(index, 6) * 40,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [anim, index]);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

export function EatsScreen() {
  const { tripId } = useTrip();
  const online = useOnline();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [filter, setFilter] = useState<EatsFilter>('all');
  // form: undefined = closed; null = add mode; Restaurant = edit mode.
  const [form, setForm] = useState<Restaurant | null | undefined>(undefined);
  const [detail, setDetail] = useState<Restaurant | null>(null);

  const load = useCallback(() => {
    let active = true;
    api.eats
      .list(tripId)
      .then((r) => active && setState({ status: 'loaded', restaurants: r.restaurants }))
      .catch(() => active && setState((s) => (s.status === 'loaded' ? s : { status: 'error' })));
    return () => {
      active = false;
    };
  }, [tripId]);

  useFocusEffect(load);

  // AI import (trip header) creates restaurants while this tab is focused — refetch.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('burgergo:dataChanged', () => {
      load();
    });
    return () => sub.remove();
  }, [load]);

  const restaurants = state.status === 'loaded' ? state.restaurants : [];
  const visible = useMemo(() => filterByStatus(restaurants, filter), [restaurants, filter]);

  // Keep the open detail sheet in sync with re-fetched data after a photo write.
  const detailLive = detail ? restaurants.find((r) => r.id === detail.id) ?? null : null;

  if (state.status === 'loading') return <Loading label="Loading your eats…" />;
  if (state.status === 'error') {
    return (
      <ErrorState
        headline="Couldn't load your eats"
        subtext="Connect to the internet and try again."
        onRetry={() => {
          setState({ status: 'loading' });
          load();
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Eats</Text>
        <Pressable
          disabled={!online}
          onPress={() => setForm(null)}
          style={({ pressed }) => [
            styles.addBtn,
            pressed && online && { backgroundColor: colors.orangePress },
            !online && styles.addBtnDisabled,
          ]}
        >
          <Text style={[styles.addBtnText, !online && styles.addBtnTextDisabled]}>Add restaurant</Text>
        </Pressable>
      </View>

      <View style={styles.filterWrap}>
        <SegmentedControl options={FILTER_OPTIONS} value={filter} onChange={setFilter} />
      </View>

      {restaurants.length === 0 ? (
        <EmptyState
          headline="No eats logged yet"
          subtext="Add a spot you want to try, or one you've already loved."
          action={online ? <Button title="Add restaurant" onPress={() => setForm(null)} /> : undefined}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {visible.map((r, i) => (
            <FadeUpRow key={r.id} index={i}>
              <RestaurantCard restaurant={r} onTap={() => setDetail(r)} />
            </FadeUpRow>
          ))}
        </ScrollView>
      )}

      {/* Add / edit form */}
      <Sheet visible={form !== undefined} onClose={() => setForm(undefined)}>
        {form !== undefined ? (
          <RestaurantForm
            key={form?.id ?? 'new'}
            tripId={tripId}
            restaurant={form}
            online={online}
            onClose={() => setForm(undefined)}
            onSaved={() => {
              setForm(undefined);
              load();
            }}
          />
        ) : null}
      </Sheet>

      {/* Detail */}
      <Sheet visible={detailLive !== null} onClose={() => setDetail(null)}>
        {detailLive ? (
          <RestaurantDetail
            key={detailLive.id}
            tripId={tripId}
            restaurant={detailLive}
            online={online}
            onClose={() => setDetail(null)}
            onChanged={() => {
              // Web closes the detail sheet after status/schedule/delete.
              setDetail(null);
              load();
            }}
            onPhotoChanged={load}
            onEdit={() => {
              const target = detailLive;
              setDetail(null);
              setForm(target);
            }}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontFamily: font.bold, fontSize: 21, letterSpacing: -0.42, color: colors.ink },

  addBtn: {
    backgroundColor: colors.orange,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnDisabled: { backgroundColor: colors.surface },
  addBtnText: { fontFamily: font.semibold, fontSize: 13, color: colors.white },
  addBtnTextDisabled: { color: colors.faint },

  filterWrap: { paddingHorizontal: 16, paddingBottom: 8 },

  // Bottom padding clears the floating glass tab bar (content scrolls under it).
  list: { paddingHorizontal: 16, paddingBottom: 150 },
});
