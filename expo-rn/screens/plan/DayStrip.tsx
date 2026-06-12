import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Day } from '../../lib/days';
import { DAY_COLORS, colors, font } from '../../lib/theme';
import { useReduceMotion } from '../../components/ui/motion';
import { monthDay, dayOfMonth } from './planShared';

/**
 * Equal-width two-line day chips (web DayStrip): 3-letter weekday over a big
 * date number; the active day is marked by a sliding ink pill (handoff #4)
 * that springs between chips on selection; today gets a `day-2` amber dot
 * beside its number. Horizontal scroll for long trips — the pill lives inside
 * the scrolled row so it moves with the content.
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
  // Measured chip frames (relative to the inner row — the pill's positioning
  // context), keyed by date.
  const layoutsRef = useRef(new Map<string, { x: number; width: number }>());
  // Chip widths vary slightly (1- vs 2-digit dates, the today dot), so the
  // pill animates BOTH translateX and width. Width is not native-driver
  // animatable and one node can't mix drivers, so both values run JS-driven
  // springs (same curve as `springy`) — the pill is one tiny view, cheap.
  const pillX = useRef(new Animated.Value(0)).current;
  const pillW = useRef(new Animated.Value(0)).current;
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);
  const reduce = useReduceMotion();

  const placePill = useCallback(
    (to: { x: number; width: number }, animate: boolean) => {
      if (animate) {
        Animated.parallel([
          Animated.spring(pillX, { toValue: to.x, friction: 7, tension: 80, useNativeDriver: false }),
          Animated.spring(pillW, { toValue: to.width, friction: 7, tension: 80, useNativeDriver: false }),
        ]).start();
      } else {
        pillX.setValue(to.x);
        pillW.setValue(to.width);
      }
      if (!readyRef.current) {
        readyRef.current = true;
        setReady(true);
      }
    },
    [pillX, pillW],
  );

  // Slide on selection change (snap on first placement / reduce-motion).
  useEffect(() => {
    const frame = layoutsRef.current.get(selectedDate);
    if (!frame) return; // not measured yet — that chip's onLayout places the pill
    placePill(frame, readyRef.current && !reduce);
    // Selection-driven only; `reduce` is read, never a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, placePill]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.row}>
        {/* Rendered first = behind every chip: the pill slides UNDER glass
            siblings (handoff pitfall #2 kept on purpose). */}
        <Animated.View
          pointerEvents="none"
          style={[styles.pill, !ready && { opacity: 0 }, { width: pillW, transform: [{ translateX: pillX }] }]}
        />
        {days.map((d) => {
          const active = d.date === selectedDate;
          return (
            <Pressable
              key={d.date}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Day ${d.dayNumber} · ${d.weekday} ${monthDay(d.date)}`}
              onPress={() => onSelect(d.date)}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                layoutsRef.current.set(d.date, { x, width });
                // First measurement or relayout of the active chip: keep the
                // pill glued to it without animating (selection changes never
                // fire onLayout — chip frames don't move).
                if (d.date === selectedDate) placePill({ x, width }, false);
              }}
              // The active chip's own background goes transparent once the
              // pill is placed — the pill IS its background (handoff #4).
              style={[styles.chip, active && (ready ? styles.chipActiveClear : styles.chipActive)]}
            >
              <Text style={[styles.weekday, active && styles.weekdayActive]}>{d.weekday.toUpperCase()}</Text>
              <View style={styles.numRow}>
                <Text style={[styles.num, active && styles.numActive]}>{dayOfMonth(d.date)}</Text>
                {d.isToday ? <View accessibilityLabel="Today" style={styles.todayDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, paddingBottom: 4 },
  row: { flexGrow: 1, flexDirection: 'row', gap: 6 },
  pill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: colors.ink,
  },
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
  // Active once the pill is under the chip: the chip itself goes clear.
  chipActiveClear: { backgroundColor: 'transparent', borderColor: 'transparent' },
  weekday: { fontFamily: font.semibold, fontSize: 10, letterSpacing: 0.8, color: colors.faint },
  weekdayActive: { color: 'rgba(255,255,255,0.65)' },
  numRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  num: { fontFamily: font.bold, fontSize: 16, lineHeight: 20, color: colors.ink, fontVariant: ['tabular-nums'] },
  numActive: { color: colors.white },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: DAY_COLORS[1] },
});
