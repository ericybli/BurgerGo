import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { api, type DayWeather, type Place } from '../../lib/api';
import type { Day } from '../../lib/days';
import { todayLocal } from '../../lib/days';
import { placeUrl } from '../../lib/googleMapsUrl';
import { colors, font, glyph } from '../../lib/theme';
import { diffDays, nextStopIndex, nowHHMM, shortDate, tripStatus, weatherCodeInfo } from './planShared';

const LODGING = new Set(['lodging', 'hotel', 'airbnb']);
const STORAGE_KEY = 'burgergo.overview.collapsed';

/**
 * Collapsible "trip at a glance" panel (web TripOverview). Default collapsed
 * (persisted; '0' = expanded). The "relevant day" is today while the trip is
 * active, day 1 before it starts (with a countdown), the last day after.
 * Weather rows hide when the fetch fails / offline / no pinned coords.
 */
export function TripOverview({
  tripId,
  trip,
  days,
  places,
  online,
  onViewPlace,
}: {
  tripId: string;
  trip: { startDate: string; endDate: string };
  days: Day[];
  places: Place[];
  online: boolean;
  onViewPlace: (place: Place) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  // Per-date weather cache so re-renders / day flips don't refetch.
  const [weatherByDate, setWeatherByDate] = useState<Record<string, DayWeather | null>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => setCollapsed(v !== '0'))
      .catch(() => {});
  }, []);

  const today = todayLocal();
  const status = days.length ? tripStatus(trip, today) : 'upcoming';
  const relevant: Day | null = !days.length
    ? null
    : status === 'active'
      ? (days.find((d) => d.isToday) ?? days[0]!)
      : status === 'upcoming'
        ? days[0]!
        : days[days.length - 1]!;
  const relevantDate = relevant?.date ?? '';

  useEffect(() => {
    if (!relevantDate || !online || fetchedRef.current.has(relevantDate)) return;
    fetchedRef.current.add(relevantDate);
    api.weather
      .day(tripId, relevantDate)
      .then((r) => setWeatherByDate((cur) => ({ ...cur, [relevantDate]: r.weather ?? null })))
      .catch(() => {
        // offline / upstream down → no weather row; allow a later retry
        fetchedRef.current.delete(relevantDate);
      });
  }, [tripId, relevantDate, online]);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      AsyncStorage.setItem(STORAGE_KEY, next ? '1' : '0').catch(() => {});
      return next;
    });
  }

  if (!relevant) return null;

  const stops = places
    .filter((p) => p.dayDate === relevant.date)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const nextStop = stops[relevant.isToday ? nextStopIndex(stops, nowHHMM()) : 0];
  const hotel = stops.find((s) => LODGING.has(s.category));
  const daysToStart = status === 'upcoming' ? diffDays(today, trip.startDate) : 0;

  const weather = weatherByDate[relevantDate] ?? null;
  const wInfo = weather ? weatherCodeInfo(weather.code) : null;
  const dayHeading = `Day ${relevant.dayNumber} · ${shortDate(relevant.date)}`;

  return (
    <View style={styles.panel}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        style={({ pressed }) => [styles.headerBtn, pressed && { backgroundColor: colors.surface }]}
      >
        {collapsed ? (
          <ChevronRight size={14} color={colors.faint} strokeWidth={2.5} />
        ) : (
          <ChevronDown size={14} color={colors.faint} strokeWidth={2.5} />
        )}
        <Text style={styles.headerLabel}>Overview</Text>
        {collapsed ? (
          <>
            <Text style={styles.headerSummary} numberOfLines={1}>
              {dayHeading}
            </Text>
            {weather && wInfo ? (
              <Text style={styles.headerWeather}>
                {wInfo.emoji} {Math.round(weather.tMaxC)}°
              </Text>
            ) : null}
          </>
        ) : null}
      </Pressable>

      {collapsed ? null : (
        <View style={styles.body}>
          <View style={[styles.row, styles.headingRow]}>
            <Text style={styles.dayHeading}>{dayHeading}</Text>
            {status === 'upcoming' && daysToStart > 0 ? (
              <Text style={styles.toGo}>{daysToStart}d to go</Text>
            ) : null}
          </View>

          {weather && wInfo ? (
            <View style={styles.row}>
              <Text style={styles.weatherLine}>
                {wInfo.emoji} {Math.round(weather.tMaxC)}°/{Math.round(weather.tMinC)}° {wInfo.label}
                {weather.precipProb != null && weather.precipProb > 0 ? ` · ${weather.precipProb}% rain` : ''}
                {weather.source === 'normal' ? ' · typical' : ''}
              </Text>
            </View>
          ) : null}

          {nextStop ? (
            <View style={[styles.row, styles.inlineRow]}>
              <Text style={styles.micro}>UP NEXT</Text>
              <Pressable onPress={() => onViewPlace(nextStop)} style={styles.nextBtn}>
                <Text style={styles.nextText} numberOfLines={1}>
                  <Text>{glyph(nextStop.category)} </Text>
                  {nextStop.scheduledTime ? <Text style={styles.nextTime}>{nextStop.scheduledTime} </Text> : null}
                  <Text>{nextStop.name}</Text>
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Open in Google Maps"
                hitSlop={6}
                onPress={() =>
                  Linking.openURL(
                    placeUrl({
                      name: nextStop.name,
                      lat: nextStop.lat ?? 0,
                      lng: nextStop.lng ?? 0,
                      googlePlaceId: nextStop.googlePlaceId,
                    }),
                  )
                }
              >
                <Text style={styles.extLink}>↗</Text>
              </Pressable>
            </View>
          ) : null}

          {hotel ? (
            <Pressable onPress={() => onViewPlace(hotel)} style={[styles.row, styles.inlineRow]}>
              <Text>🛏</Text>
              <Text style={styles.hotelLabel}>Hotel</Text>
              <Text style={styles.hotelName} numberOfLines={1}>
                {hotel.name}
              </Text>
            </Pressable>
          ) : null}

          {stops.length > 0 ? (
            <View style={styles.row}>
              <Text style={styles.micro}>PLAN</Text>
              <View style={{ marginTop: 4 }}>
                {stops.map((s) => (
                  <Pressable key={s.id} onPress={() => onViewPlace(s)} style={styles.planRow}>
                    <Text style={styles.planTime}>{s.scheduledTime ?? ''}</Text>
                    <Text>{glyph(s.category)}</Text>
                    <Text style={styles.planName} numberOfLines={1}>
                      {s.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.row}>
              <Text style={styles.noStops}>No stops planned yet</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    overflow: 'hidden',
    marginBottom: 12,
  },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9 },
  headerLabel: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
  headerSummary: {
    flex: 1,
    minWidth: 0,
    marginLeft: 4,
    fontFamily: font.regular,
    fontSize: 12.5,
    color: colors.sub,
    fontVariant: ['tabular-nums'],
  },
  headerWeather: { fontFamily: font.regular, fontSize: 12.5, color: colors.sub, fontVariant: ['tabular-nums'] },

  body: { borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 12, paddingBottom: 6 },
  row: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  headingRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayHeading: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink, fontVariant: ['tabular-nums'] },
  toGo: { fontFamily: font.medium, fontSize: 12, color: colors.sub },
  weatherLine: { fontFamily: font.medium, fontSize: 12, color: colors.sub, fontVariant: ['tabular-nums'] },

  micro: { fontFamily: font.bold, fontSize: 10.5, letterSpacing: 1.05, color: colors.faint },
  nextBtn: { flex: 1, minWidth: 0, paddingVertical: 2 },
  nextText: { fontFamily: font.regular, fontSize: 13.5, color: colors.ink },
  nextTime: { fontFamily: font.regular, fontSize: 13.5, color: colors.sub, fontVariant: ['tabular-nums'] },
  extLink: { fontFamily: font.semibold, fontSize: 14, color: colors.accent, paddingHorizontal: 4 },

  hotelLabel: { fontFamily: font.medium, fontSize: 12, color: colors.sub },
  hotelName: { flex: 1, minWidth: 0, fontFamily: font.regular, fontSize: 13.5, color: colors.ink },

  planRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  planTime: { width: 40, fontFamily: font.regular, fontSize: 12, color: colors.sub, fontVariant: ['tabular-nums'] },
  planName: { flex: 1, minWidth: 0, fontFamily: font.regular, fontSize: 12, color: colors.ink },
  noStops: { fontFamily: font.regular, fontSize: 12, color: colors.sub },
});
