/**
 * Horizontal day-filter chips above the map (days bucket only): "All days" +
 * one chip per dated day group (7px color dot + "Day N"). Inactive chips are
 * liquid-glass pills (day-color dot); the ACTIVE chip drops the glass for a
 * solid ink pill + white text/dot (handoff stacking rule: active = no glass).
 * Tapping a day shows ONLY that day (onSelectDate(date)); "All days" shows all
 * (onSelectDate(null)) — kept in sync with the list via the shared selection.
 */
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../../../lib/theme';
import { GlassPlate } from '../../../components/ui/glass';
import type { LegendEntry } from './useMapShell';

export function DayLegend({
  entries,
  allVisible,
  onSelectDate,
}: {
  entries: LegendEntry[];
  allVisible: boolean;
  onSelectDate: (date: string | null) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      style={s.host}
    >
      <LegendChip active={allVisible} onPress={() => onSelectDate(null)}>
        <Text style={[s.text, allVisible && s.textActive]}>All days</Text>
      </LegendChip>
      {entries.map((e) => (
        <LegendChip key={e.date} active={e.visible} onPress={() => onSelectDate(e.date)}>
          <View style={[s.dot, { backgroundColor: e.visible ? colors.white : e.color }]} />
          <Text style={[s.text, e.visible && s.textActive]}>Day {e.dayNumber}</Text>
        </LegendChip>
      ))}
    </ScrollView>
  );
}

function LegendChip({
  active,
  onPress,
  children,
}: {
  active: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected: active }}
      // Web: active:scale-95.
      style={({ pressed }) => (pressed ? s.chipPressed : null)}
    >
      {active ? (
        <View style={[s.chip, s.chipActive]}>{children}</View>
      ) : (
        <GlassPlate radius={999} style={s.chip}>
          {children}
        </GlassPlate>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  host: { flexGrow: 0 },
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.ink, borderRadius: 999 },
  chipPressed: { transform: [{ scale: 0.95 }] },
  dot: { width: 7, height: 7, borderRadius: 999 },
  text: { fontSize: 12, fontFamily: font.semibold, color: colors.sub },
  textActive: { color: colors.white },
});
