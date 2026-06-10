import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Day } from '../../lib/days';
import { DAY_COLORS, colors, font } from '../../lib/theme';
import { monthDay, dayOfMonth } from './planShared';

/**
 * Equal-width two-line day chips (web DayStrip): 3-letter weekday over a big
 * date number; the active day is a solid ink chip; today gets a `day-2` amber
 * dot beside its number. Horizontal scroll for long trips.
 */
export function DayStrip({
  days,
  selectedDate,
  onSelect,
}: {
  days: Day[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {days.map((d) => {
        const active = d.date === selectedDate;
        return (
          <Pressable
            key={d.date}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Day ${d.dayNumber} · ${d.weekday} ${monthDay(d.date)}`}
            onPress={() => onSelect(d.date)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.weekday, active && styles.weekdayActive]}>{d.weekday.toUpperCase()}</Text>
            <View style={styles.numRow}>
              <Text style={[styles.num, active && styles.numActive]}>{dayOfMonth(d.date)}</Text>
              {d.isToday ? <View accessibilityLabel="Today" style={styles.todayDot} /> : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexGrow: 1, gap: 6, paddingBottom: 4 },
  chip: {
    flexGrow: 1,
    minWidth: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    alignItems: 'center',
    paddingTop: 7,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  weekday: { fontFamily: font.semibold, fontSize: 10, letterSpacing: 0.8, color: colors.faint },
  weekdayActive: { color: 'rgba(255,255,255,0.65)' },
  numRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  num: { fontFamily: font.bold, fontSize: 16, lineHeight: 20, color: colors.ink, fontVariant: ['tabular-nums'] },
  numActive: { color: colors.white },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: DAY_COLORS[1] },
});
