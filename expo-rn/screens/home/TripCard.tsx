/**
 * Home trip card (web components/TripCard.tsx). 180px cover region (cover
 * photo or the Atlas cover gradient), status pill, pencil edit chip, then a
 * footer with the trip name + "Sep 4 – Sep 12 · 9 days" and a stat box (days
 * out for upcoming trips, trip length otherwise). The whole card navigates.
 */
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Pencil } from 'lucide-react-native';
import { photoUrl, type Trip } from '../../lib/api';
import { colors, font, radius } from '../../lib/theme';
import { formatRange, tripStatus, todayLocal, diffDays, type TripStatus } from './tripDates';

// Atlas status pill: white pill, role-colored text (info=teal, active=orange, past=sub).
const PILL_COLOR: Record<TripStatus, string> = {
  upcoming: colors.accent,
  active: colors.orange,
  past: colors.sub,
};
const PILL_LABEL: Record<TripStatus, string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  past: 'Past',
};

// Web cover fallback: linear-gradient(135deg, #F7F1E4 0%, #EDF1EE 55%, #E6EFF1 100%).
// No gradient package available → approximate with stacked interpolated bands
// (vertical cream → sage → teal-tint blend).
const GRADIENT_STOPS: [string, number][] = [
  ['#F7F1E4', 0],
  ['#EDF1EE', 0.55],
  ['#E6EFF1', 1],
];
const BAND_COUNT = 12;

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  let out = '#';
  for (const shift of [16, 8, 0]) {
    const ca = (pa >> shift) & 255;
    const cb = (pb >> shift) & 255;
    out += Math.round(ca + (cb - ca) * t).toString(16).padStart(2, '0');
  }
  return out;
}

function gradientColorAt(t: number): string {
  const [c0, p0] = GRADIENT_STOPS[0]!;
  const [c1, p1] = GRADIENT_STOPS[1]!;
  const [c2, p2] = GRADIENT_STOPS[2]!;
  if (t <= p1) return mixHex(c0, c1, (t - p0) / (p1 - p0));
  return mixHex(c1, c2, (t - p1) / (p2 - p1));
}

const BANDS = Array.from({ length: BAND_COUNT }, (_, i) => gradientColorAt(i / (BAND_COUNT - 1)));

function CoverGradient() {
  return (
    <View style={StyleSheet.absoluteFill}>
      {BANDS.map((c, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: c }} />
      ))}
    </View>
  );
}

export function TripCard({
  trip,
  onPress,
  onManage,
}: {
  trip: Trip;
  onPress: () => void;
  onManage: () => void;
}) {
  // Cover 404 (photo deleted elsewhere) → fall back to the gradient.
  const [coverFailed, setCoverFailed] = useState(false);
  const status = tripStatus(trip);
  const { label } = formatRange(trip.startDate, trip.endDate);
  // Display-only stat: upcoming trips count down to the start; others show length.
  const statNumber =
    status === 'upcoming'
      ? diffDays(todayLocal(), trip.startDate)
      : diffDays(trip.startDate, trip.endDate) + 1;
  const statLabel = status === 'upcoming' ? 'days out' : 'days';
  const showCover = trip.coverPhoto !== null && !coverFailed;

  return (
    <Pressable
      onPress={onPress}
      // No "button" role: on web that renders a <button>, and the Edit chip
      // inside would nest <button>-in-<button> (invalid HTML, hydration error).
      accessibilityLabel={trip.name}
      style={({ pressed }) => [s.card, pressed && { transform: [{ scale: 0.99 }] }]}
    >
      <View style={s.cover}>
        <CoverGradient />
        {showCover ? (
          <Image
            // Key by photo id so a replaced cover resets the failure flag.
            key={trip.coverPhoto}
            source={{ uri: photoUrl.personal(trip.coverPhoto!, 'card') }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setCoverFailed(true)}
          />
        ) : null}
        <View style={s.pill}>
          <Text style={[s.pillText, { color: PILL_COLOR[status] }]}>{PILL_LABEL[status]}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit trip"
          hitSlop={8}
          onPress={onManage}
          style={({ pressed }) => [s.editChip, pressed && { transform: [{ scale: 0.95 }] }]}
        >
          <Pencil size={15} color={colors.ink} />
        </Pressable>
      </View>
      <View style={s.footer}>
        <View style={s.footerLeft}>
          <Text numberOfLines={1} style={s.name}>
            {trip.name}
          </Text>
          <Text style={s.dates}>{label}</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statNumber}>{statNumber}</Text>
          <Text style={s.statLabel}>{statLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  cover: { height: 180, overflow: 'hidden' },
  pill: {
    position: 'absolute',
    left: 12,
    top: 12,
    borderRadius: radius.chip,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillText: { fontSize: 11.5, fontFamily: font.bold },
  editChip: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 34,
    height: 34,
    borderRadius: radius.chip,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
  },
  footerLeft: { flex: 1, minWidth: 0 },
  name: { fontSize: 19, fontFamily: font.bold, letterSpacing: -0.38, color: colors.ink },
  dates: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: font.regular,
    color: colors.sub,
    fontVariant: ['tabular-nums'],
  },
  statBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 17,
    fontFamily: font.bold,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 9.5,
    fontFamily: font.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.76,
    color: colors.faint,
  },
});
