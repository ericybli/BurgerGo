import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Leg, TravelMode } from '../../lib/api';
import { colors, font } from '../../lib/theme';
import { formatLeg } from '../../lib/legView';

const MODES: TravelMode[] = ['walk', 'drive', 'transit'];
const LABEL: Record<TravelMode, string> = { walk: 'Walk', drive: 'Drive', transit: 'Transit' };

/**
 * Slim leg connector between two place cards (web LegConnector): dotted 2px
 * vertical `line` rail aligned under the pins, "🚗 5 min · 3.2 mi" text (or
 * "—" + "no route"/"needs connection"), and a per-leg Walk/Drive/Transit text
 * tab group — active = accent text with a 2px accent underline.
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
      <View style={styles.rail} pointerEvents="none" />
      <View style={styles.row}>
        <Text style={styles.legText}>{leg ? formatLeg(leg) : '—'}</Text>
        {leg ? null : (
          <Text style={styles.hint}>{online ? 'no route' : 'needs connection'}</Text>
        )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingLeft: 34, paddingVertical: 8 },
  rail: {
    position: 'absolute',
    left: 10,
    top: 0,
    bottom: 0,
    width: 0,
    borderLeftWidth: 2,
    borderColor: colors.line,
    borderStyle: 'dotted',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 },
  legText: { fontFamily: font.regular, fontSize: 11.5, color: colors.sub, fontVariant: ['tabular-nums'] },
  hint: { fontFamily: font.regular, fontSize: 11.5, color: colors.faint },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tab: { borderBottomWidth: 2, borderBottomColor: 'transparent', paddingBottom: 1 },
  tabActive: { borderBottomColor: colors.accent },
  tabText: { fontFamily: font.semibold, fontSize: 11.5, color: colors.faint },
  tabTextActive: { color: colors.accent },
});
