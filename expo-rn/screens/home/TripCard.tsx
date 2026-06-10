/**
 * Home trip card (web components/TripCard.tsx). 180px cover region (cover
 * photo or the Atlas cover gradient), status pill, pencil edit chip, then a
 * footer with the trip name + "Sep 4 – Sep 12 · 9 days" and a stat box (days
 * out for upcoming trips, trip length otherwise). The whole card navigates.
 */
import { useId, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
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
// Drawn smoothly with react-native-svg (bundled in Expo Go; expo-linear-gradient
// isn't a dependency). userSpaceOnUse endpoints reproduce the CSS 135° gradient
// line exactly: direction (√2/2, √2/2) through the center with line length
// (w+h)·√2/2, which works out to center ± (w+h)/4 on each axis.
function CoverGradient() {
  // Unique per instance — on react-native-web the SVG ids land in one document.
  const gradId = `cover-grad-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [box, setBox] = useState({ w: 0, h: 0 });
  const k = (box.w + box.h) / 4;
  return (
    <View
      // Mid-stop solid until the first layout pass so there's no white flash.
      style={[StyleSheet.absoluteFill, { backgroundColor: '#EDF1EE' }]}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {box.w > 0 && box.h > 0 ? (
        <Svg width="100%" height="100%">
          <Defs>
            <SvgLinearGradient
              id={gradId}
              gradientUnits="userSpaceOnUse"
              x1={box.w / 2 - k}
              y1={box.h / 2 - k}
              x2={box.w / 2 + k}
              y2={box.h / 2 + k}
            >
              <Stop offset={0} stopColor="#F7F1E4" />
              <Stop offset={0.55} stopColor="#EDF1EE" />
              <Stop offset={1} stopColor="#E6EFF1" />
            </SvgLinearGradient>
          </Defs>
          <Rect x={0} y={0} width={box.w} height={box.h} fill={`url(#${gradId})`} />
        </Svg>
      ) : null}
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
