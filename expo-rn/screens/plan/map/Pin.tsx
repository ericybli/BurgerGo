/**
 * Atlas map pin as an RN View (native Marker child). Mirrors the web app's
 * src/lib/map/markerEl.ts spec exactly: white disc + 2px day-color ring +
 * category glyph (34px day stops / 28px un-numbered), stop-number badge
 * top-right for day stops, time pill below when scheduled.
 *
 * The wrapper is sized symmetrically around the disc so that with Marker
 * anchor {x:0.5,y:0.5} the DISC CENTER sits exactly on the coordinate, and
 * the badge/pill never overflow (Android renders markers to a bitmap and
 * clips overflow).
 */
import { StyleSheet, Text, View } from 'react-native';
import { font } from '../../../lib/theme';
import type { MapPin } from './mapData';

const PILL_SPACE = 26; // symmetric headroom above + pill room below the disc
const WRAP_W = 76;

export function PinView({ pin }: { pin: MapPin }) {
  const isDay = pin.label != null;
  const size = isDay ? 34 : 28;
  return (
    <View style={[s.wrap, { height: size + PILL_SPACE * 2 }]}>
      <View
        style={[
          s.disc,
          { width: size, height: size, borderRadius: size / 2, borderColor: pin.color },
        ]}
      >
        <Text style={s.glyph} allowFontScaling={false}>
          {pin.glyph}
        </Text>
        {isDay ? (
          <View style={[s.badge, { backgroundColor: pin.color }]}>
            <Text style={s.badgeText} allowFontScaling={false}>
              {pin.label}
            </Text>
          </View>
        ) : null}
      </View>
      {isDay && pin.scheduledTime ? (
        <View style={[s.pill, { top: PILL_SPACE + size + 3 }]}>
          <Text style={s.pillText} allowFontScaling={false}>
            {pin.scheduledTime}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: WRAP_W, alignItems: 'center', justifyContent: 'center' },
  disc: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B1F1C',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  glyph: { fontSize: 15, lineHeight: 18 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 9.5, lineHeight: 11, fontFamily: font.bold },
  pill: {
    position: 'absolute',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E9EBE6',
    backgroundColor: '#FFFFFF',
    shadowColor: '#1B1F1C',
    shadowOpacity: 0.12,
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  pillText: {
    color: '#1B1F1C',
    fontSize: 10,
    lineHeight: 12,
    fontFamily: font.bold,
    fontVariant: ['tabular-nums'],
  },
});
