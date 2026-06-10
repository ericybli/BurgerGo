import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, glyph } from '../../lib/theme';

/**
 * Fallback for a photo slot when a place has no photo: soft diagonal stripes
 * over `surface` with the category glyph centered + faded — cards stay
 * visually even whether or not a photo exists (mirrors web PhotoPlaceholder).
 */
export function PhotoPlaceholder({
  category,
  height = 140,
  style,
  glyphSize,
}: {
  category: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  glyphSize?: number;
}) {
  // Slanted bars laid out in a row and clipped — cheap diagonal stripe effect.
  const bars = Array.from({ length: 26 });
  return (
    <View style={[styles.box, { height }, style]}>
      <View style={styles.barsRow} pointerEvents="none">
        {bars.map((_, i) => (
          <View key={i} style={[styles.bar, { height: height * 1.8, marginTop: -height * 0.4 }]} />
        ))}
      </View>
      <Text style={[styles.glyph, { fontSize: glyphSize ?? Math.min(44, height * 0.45) }]}>
        {glyph(category)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    backgroundColor: colors.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barsRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center' },
  bar: { width: 9, marginRight: 13, backgroundColor: 'rgba(27,31,28,0.04)', transform: [{ rotate: '20deg' }] },
  glyph: { opacity: 0.4 },
});
