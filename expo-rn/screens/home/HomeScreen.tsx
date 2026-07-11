/**
 * Home (web components/HomeClient.tsx + app/(home)/layout.tsx): logo header,
 * first-run onboarding note, the trip-card list (server order within groups;
 * active + upcoming first, then a divider, then past trips sunk to the bottom), mascot
 * loading/error/empty states, and the orange New-trip FAB. Cards open the
 * trip; the pencil chip opens the Manage sheet.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Plus, Settings as SettingsIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassBar, GlassTintPlate } from '../../components/ui/glass';
import type { RootStackParamList } from '../../navigation/types';
import { api, type Trip } from '../../lib/api';
import { useOnline } from '../../lib/online';
import { colors, font, type } from '../../lib/theme';
import { useReduceMotion, usePressScale } from '../../components/ui/motion';
import { TripCard } from './TripCard';
import { tripStatus } from './tripDates';
import { NewTripSheet } from './NewTripSheet';
import { ManageTripSheet } from './ManageTripSheet';
import { OnboardingNote } from './OnboardingNote';

/** A list row: a trip card, or the hairline that sinks past trips to the bottom. */
type TripRow = { kind: 'trip'; trip: Trip } | { kind: 'divider' };

/**
 * Current (active + upcoming) trips stay in server order, then a divider, then
 * past trips (also server order) sunk to the bottom. Each past card shows its
 * own "Past" pill, so the divider stays label-free.
 */
function buildTripRows(trips: Trip[]): TripRow[] {
  const past = trips.filter((t) => tripStatus(t) === 'past');
  const current = trips.filter((t) => tripStatus(t) !== 'past');
  return [
    ...current.map((trip): TripRow => ({ kind: 'trip', trip })),
    ...(past.length ? [{ kind: 'divider' } as const] : []),
    ...past.map((trip): TripRow => ({ kind: 'trip', trip })),
  ];
}

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
type State = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; trips: Trip[] };

const MASCOT = require('../../assets/burgergo-logo.png');
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** Pulsing 96px mascot + copy (web home loading state). */
function LoadingState() {
  const opacity = useRef(new Animated.Value(0.9)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <View style={s.center}>
      <Animated.Image
        source={MASCOT}
        style={[s.mascotSmall, { opacity }]}
        resizeMode="contain"
        accessible
        accessibilityLabel="BurgerGo the Siamese cat"
      />
      <Text style={s.centerBody}>Fetching your trips…</Text>
    </View>
  );
}

/** Mascot empty/error state with an orange CTA (web components/EmptyState.tsx). */
function MascotState({
  headline,
  subtext,
  actionLabel,
  onAction,
}: {
  headline: string;
  subtext: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={s.center}>
      <Image
        source={MASCOT}
        style={s.mascotBig}
        resizeMode="contain"
        accessible
        accessibilityLabel="BurgerGo the Siamese cat"
      />
      <Text style={s.centerHead}>{headline}</Text>
      <Text style={s.centerSub}>{subtext}</Text>
      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        style={({ pressed }) => [s.cta, pressed && { backgroundColor: colors.orangePress, transform: [{ scale: 0.98 }] }]}
      >
        <Text style={s.ctaText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

/** Staggered fade-up entrance for list items (delay = min(index,6)×40ms). */
function FadeUpItem({ index, children }: { index: number; children: ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 280,
      delay: Math.min(index, 6) * 40,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [progress, index]);
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

export function HomeScreen({ navigation }: Props) {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [creating, setCreating] = useState(false);
  const [manageTrip, setManageTrip] = useState<Trip | null>(null);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  // --- Breathing pulse (handoff #8) ---
  const reduceMotion = useReduceMotion();
  const breatheScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(breatheScale, {
            toValue: 1.04,
            duration: 1300,
            easing: (t) => Math.sin((t * Math.PI) / 2),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.35,
            duration: 1300,
            easing: (t) => Math.sin((t * Math.PI) / 2),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
        Animated.parallel([
          Animated.timing(breatheScale, {
            toValue: 1,
            duration: 1300,
            easing: (t) => Math.sin((t * Math.PI) / 2),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0,
            duration: 1300,
            easing: (t) => Math.sin((t * Math.PI) / 2),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, breatheScale, glowOpacity]);

  const pressScale = usePressScale();

  const load = useCallback(async () => {
    try {
      const trips = await api.trips.list();
      if (mounted.current) setState({ status: 'loaded', trips });
    } catch {
      if (mounted.current) setState((prev) => (prev.status === 'loaded' ? prev : { status: 'error' }));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  function openTrip(trip: Trip) {
    navigation.navigate('Trip', {
      tripId: trip.id,
      name: trip.name,
      startDate: trip.startDate,
      endDate: trip.endDate,
    });
  }

  let content: ReactNode;
  if (state.status === 'loading') {
    content = (
      <View style={s.statePad}>
        <OnboardingNote />
        <LoadingState />
      </View>
    );
  } else if (state.status === 'error') {
    content = (
      <View style={s.statePad}>
        <OnboardingNote />
        <MascotState
          headline="Couldn't load trips"
          subtext="Connect to the internet and try again."
          actionLabel="Try again"
          onAction={() => {
            setState({ status: 'loading' });
            void load();
          }}
        />
      </View>
    );
  } else if (state.trips.length === 0) {
    content = (
      <View style={s.statePad}>
        <OnboardingNote />
        <MascotState
          headline="Where to first?"
          subtext="Plan your first trip and BurgerGo will tag along."
          actionLabel="New trip"
          onAction={() => setCreating(true)}
        />
      </View>
    );
  } else {
    content = (
      <FlatList
        // Active + upcoming keep server order; past trips sink below a divider.
        data={buildTripRows(state.trips)}
        keyExtractor={(row, i) => (row.kind === 'trip' ? row.trip.id : `divider-${i}`)}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View>
            <OnboardingNote />
            <Text style={s.sectionLabel}>Trips</Text>
          </View>
        }
        renderItem={({ item, index }) =>
          item.kind === 'divider' ? (
            <View style={s.pastDivider} />
          ) : (
            <FadeUpItem index={index}>
              <TripCard
                trip={item.trip}
                onPress={() => openTrip(item.trip)}
                onManage={() => setManageTrip(item.trip)}
              />
            </FadeUpItem>
          )
        }
      />
    );
  }

  return (
    <View style={s.root}>
      {/* Web (home)/layout.tsx header: 38px logo + display wordmark left,
          36px surface settings chip right — drawn in-page, not in a nav bar.
          Fixed above the scroller, so it gets the glass-bar treatment (Task 5). */}
      <GlassBar style={[s.header, { paddingTop: insets.top + 6 }]}>
        <View style={s.headerTitle}>
          <Image source={MASCOT} style={s.headerLogo} resizeMode="contain" />
          <Text style={s.headerText}>BurgerGo</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={({ pressed }) => [s.settingsChip, pressed && { transform: [{ scale: 0.95 }] }]}
        >
          <SettingsIcon size={18} color={colors.ink} />
        </Pressable>
      </GlassBar>
      {content}

      {/* Orange New-trip FAB (the one allowed extra shadow). Always enabled —
          web behavior; an offline save surfaces the sheet's error instead. */}
      <Animated.View
        style={[s.fabWrapper, { transform: [{ scale: breatheScale }, ...pressScale.style.transform] }]}
      >
        {/* Glow halo behind the FAB — opacity animated via native driver */}
        <Animated.View style={[s.fabGlow, { opacity: glowOpacity }]} pointerEvents="none" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New trip"
          onPress={() => setCreating(true)}
          onPressIn={pressScale.onPressIn}
          onPressOut={pressScale.onPressOut}
        >
          <GlassTintPlate radius={999} style={s.fabPlate}>
            <Plus size={24} color={colors.white} />
          </GlassTintPlate>
        </Pressable>
      </Animated.View>

      <NewTripSheet
        // Key-remount per open so the fields reset (web parity).
        key={creating ? 'open' : 'closed'}
        visible={creating}
        online={online}
        onClose={() => setCreating(false)}
        onCreated={refresh}
      />

      {manageTrip ? (
        <ManageTripSheet
          key={manageTrip.id}
          trip={manageTrip}
          online={online}
          onClose={() => setManageTrip(null)}
          onChanged={refresh}
          onDeleted={() => {
            setManageTrip(null);
            refresh();
          }}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  statePad: { flex: 1, padding: 16, paddingBottom: 96 },
  list: { padding: 16, paddingBottom: 100, gap: 12 },
  // Sinks the past-trips pile below the current ones (12px list gap on each side).
  pastDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  sectionLabel: {
    ...type.micro,
    textTransform: 'uppercase',
    color: colors.faint,
    marginBottom: 10,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    // No solid bg — the GlassBar material is the surface (liquid-glass Task 5).
  },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingsChip: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: { width: 38, height: 36 },
  headerText: { ...type.display, color: colors.ink },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 },
  mascotSmall: { width: 96, height: 96, marginBottom: 16 },
  mascotBig: { width: 112, height: 112, opacity: 0.9, marginBottom: 24 },
  centerBody: { ...type.body, color: colors.sub, textAlign: 'center' },
  centerHead: { ...type.heading, color: colors.ink, textAlign: 'center' },
  centerSub: { marginTop: 8, ...type.body, color: colors.sub, textAlign: 'center', maxWidth: 320 },
  cta: {
    marginTop: 24,
    borderRadius: 12,
    backgroundColor: colors.orange,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  ctaText: { fontSize: 14, fontFamily: font.semibold, color: colors.white },

  // Outer wrapper: carries position + breathing transform.
  fabWrapper: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Glow halo: slightly larger circle behind the FAB, orange, opacity-pulsed.
  fabGlow: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: colors.orange,
  },
  // GlassTintPlate inner: size + centering (placement keys are on fabWrapper).
  fabPlate: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
