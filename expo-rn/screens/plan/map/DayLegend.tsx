/**
 * Horizontal day-filter chips above the map (days bucket only): "All days" +
 * one chip per dated day group (7px color dot + "Day N"). Active = ink bg +
 * white text + white dot; inactive = hairline border + day-color dot.
 * Tapping a day shows ONLY that day (onSelectDate(date)); "All days" shows all
 * (onSelectDate(null)) — kept in sync with the list via the shared selection.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../../../lib/theme';
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
      <Pressable
        onPress={() => onSelectDate(null)}
        accessibilityState={{ selected: allVisible }}
        style={({ pressed }) => [
          s.chip,
          allVisible && s.chipActive,
          // Web: active:scale-95 + hover:bg-surface (inactive chips only).
          pressed && s.chipPressed,
          pressed && !allVisible && s.chipPressedInactive,
        ]}
      >
        <Text style={[s.text, allVisible && s.textActive]}>All days</Text>
      </Pressable>
      {entries.map((e) => (
        <Pressable
          key={e.date}
          onPress={() => onSelectDate(e.date)}
          accessibilityState={{ selected: e.visible }}
          style={({ pressed }) => [
            s.chip,
            e.visible && s.chipActive,
            pressed && s.chipPressed,
            pressed && !e.visible && s.chipPressedInactive,
          ]}
        >
          <View style={[s.dot, { backgroundColor: e.visible ? colors.white : e.color }]} />
          <Text style={[s.text, e.visible && s.textActive]}>Day {e.dayNumber}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  host: { flexGrow: 0 },
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipPressed: { transform: [{ scale: 0.95 }] },
  chipPressedInactive: { backgroundColor: colors.surface },
  dot: { width: 7, height: 7, borderRadius: 999 },
  text: { fontSize: 12, fontFamily: font.semibold, color: colors.sub },
  textActive: { color: colors.white },
});
