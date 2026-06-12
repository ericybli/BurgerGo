/**
 * Floating chip for a tapped route segment (bottom-center, above the bottom
 * controls): "{from} → {to}" + "🚗 5 min · 3.2 mi" (formatLeg; "—" when the
 * leg is uncomputed), with a ✕ close button. Liquid-glass plate.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, type } from '../../../lib/theme';
import { GlassPlate } from '../../../components/ui/glass';
import { formatLeg } from '../../../lib/legView';
import type { MapSeg } from './mapData';

export function LegChip({ seg, onClose }: { seg: MapSeg; onClose: () => void }) {
  return (
    <View style={s.host} pointerEvents="box-none">
      <GlassPlate radius={14} style={s.chip}>
        <View style={s.textCol}>
          <Text style={s.route} numberOfLines={1}>
            {seg.fromName} → {seg.toName}
          </Text>
          <Text style={s.figures}>{seg.leg ? formatLeg(seg.leg) : '—'}</Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close"
          hitSlop={6}
          style={({ pressed }) => [s.close, pressed && { backgroundColor: colors.line }]}
        >
          <Text style={s.closeText}>✕</Text>
        </Pressable>
      </GlassPlate>
    </View>
  );
}

const s = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 72,
    alignItems: 'center',
    zIndex: 3,
  },
  // Bg/border/shadow come from the glass plate.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textCol: { flexShrink: 1 },
  route: { ...type.caption, color: colors.sub },
  figures: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: font.semibold,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  // Web: h-7 w-7 (28px).
  close: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: colors.sub, fontSize: 13, fontFamily: font.medium },
});
