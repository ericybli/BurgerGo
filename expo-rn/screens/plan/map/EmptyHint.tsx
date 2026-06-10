/**
 * Non-blocking floating hint shown over a LIVE map when the current selection
 * has zero plottable pins (web parity: the canvas never unmounts, so layers /
 * locate / satellite / POI taps stay reachable on an empty day or Saved
 * bucket). pointerEvents="none" — the map underneath stays fully interactive.
 */
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, type } from '../../../lib/theme';

export function EmptyMapHint() {
  return (
    <View style={s.host} pointerEvents="none">
      <View style={s.card}>
        <Text style={s.headline}>Nothing to map here</Text>
        <Text style={s.subtext}>Add places with an address and they'll appear on the map.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 2,
  },
  card: {
    maxWidth: 320,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#1B1F1C',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  headline: { fontSize: 13, lineHeight: 18, fontFamily: font.semibold, color: colors.ink },
  subtext: { ...type.caption, color: colors.sub, marginTop: 2, textAlign: 'center' },
});
