import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Leg, TravelMode } from '../../lib/api';
import { colors, font } from '../../lib/theme';
import { formatLeg } from '../../lib/legView';

const MODES: TravelMode[] = ['walk', 'drive', 'transit'];
const LABEL: Record<TravelMode, string> = { walk: 'Walk', drive: 'Drive', transit: 'Transit' };

/**
 * Travel-leg pill sitting on the itinerary timeline (web LegConnector): the
 * day-colored rail + hollow node are drawn by the parent DayItinerary lane —
 * this component just renders a hairline pill with "🚗 5 min · 3.2 mi" text
 * (or "—" + "no route"/"needs connection"), and a Walk/Drive/Transit text tab
 * group pushed to the far right — active = accent text with a 2px accent
 * underline.
 */
export function LegConnector({
  leg,
  mode,
  disabled,
  online,
  onModeChange,
}: {
  /** The cached leg for the active mode (undefined → placeholder). */
  leg: Leg | undefined;
  mode: TravelMode;
  disabled: boolean;
  online: boolean;
  onModeChange: (mode: TravelMode) => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.pill}>
        <Text style={styles.legText}>{leg ? formatLeg(leg) : '—'}</Text>
        {leg ? null : (
          <Text style={styles.hint}>{online ? 'no route' : 'needs connection'}</Text>
        )}
      </View>
      <View style={styles.tabs}>
        {MODES.map((m) => {
          const active = m === mode;
          return (
            <Pressable
              key={m}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onModeChange(m)}
              style={[styles.tab, active && styles.tabActive, disabled && { opacity: 0.4 }]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{LABEL[m]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6, flexWrap: 'wrap', rowGap: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  legText: {
    fontFamily: font.semibold,
    fontSize: 11.5,
    color: colors.sub,
    fontVariant: ['tabular-nums'],
  },
  hint: { fontFamily: font.regular, fontSize: 11.5, color: colors.faint },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 'auto' },
  tab: { borderBottomWidth: 2, borderBottomColor: 'transparent', paddingBottom: 1 },
  tabActive: { borderBottomColor: colors.accent },
  tabText: { fontFamily: font.semibold, fontSize: 11.5, color: colors.faint },
  tabTextActive: { color: colors.accent },
});
