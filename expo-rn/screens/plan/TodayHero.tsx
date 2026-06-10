import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Place, TravelMode } from '../../lib/api';
import { colors, font, glyph } from '../../lib/theme';
import { formatLeg } from '../../lib/legView';
import { placeUrl } from '../../lib/googleMapsUrl';
import { legFor, nextStopIndex, nowHHMM, type LegLookup } from './planShared';

/** Stable signature of the day's stop set; the pointer resets when it changes. */
function stopSignature(stops: Place[]): string {
  return stops.map((s) => s.id).join('|');
}

/**
 * "Up next" banner above today's itinerary (web TodayHero): the next upcoming
 * stop (first with scheduledTime > now, else stop 0), its incoming leg, an
 * accent "Open in Google Maps" CTA, and a Skip button advancing the pointer.
 */
export function TodayHero({ stops, legs, mode }: { stops: Place[]; legs: LegLookup; mode: TravelMode }) {
  const signature = stopSignature(stops);
  const [index, setIndex] = useState(() => nextStopIndex(stops, nowHHMM()));
  useEffect(() => {
    setIndex(nextStopIndex(stops, nowHHMM()));
    // Keyed on the stop set only; recompute on add/reorder/delete, not every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (stops.length === 0 || index < 0 || index >= stops.length) return null;

  const stop = stops[index]!;
  const prev = stops[index - 1];
  const leg = prev ? legFor(legs, prev.id, stop.id, stop.legMode ?? mode) : undefined;
  const canSkip = index < stops.length - 1;

  const href = placeUrl({
    name: stop.name,
    lat: stop.lat ?? 0,
    lng: stop.lng ?? 0,
    googlePlaceId: stop.googlePlaceId,
  });

  return (
    <View style={styles.card}>
      <Text style={styles.micro}>UP NEXT</Text>
      <View style={styles.titleRow}>
        <Text style={styles.glyph}>{glyph(stop.category)}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {stop.name}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{stop.scheduledTime ?? 'No time set'}</Text>
        {prev ? <Text style={styles.metaText}>{leg ? formatLeg(leg) : '—'}</Text> : null}
      </View>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.mapsBtn, pressed && { opacity: 0.85 }]}
          onPress={() => Linking.openURL(href)}
        >
          <Text style={styles.mapsText}>Open in Google Maps</Text>
        </Pressable>
        {canSkip ? (
          <Pressable
            style={({ pressed }) => [styles.skipBtn, pressed && { backgroundColor: colors.surface }]}
            onPress={() => setIndex((i) => Math.min(i + 1, stops.length - 1))}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    padding: 16,
    marginBottom: 16,
  },
  micro: { fontFamily: font.bold, fontSize: 10.5, letterSpacing: 1.05, color: colors.faint },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  glyph: { fontSize: 20 },
  title: { flex: 1, minWidth: 0, fontFamily: font.bold, fontSize: 19, letterSpacing: -0.38, color: colors.ink },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  metaText: { fontFamily: font.medium, fontSize: 12, color: colors.sub, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  mapsBtn: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    alignItems: 'center',
  },
  mapsText: { fontFamily: font.semibold, fontSize: 14, color: colors.white },
  skipBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  skipText: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
});
