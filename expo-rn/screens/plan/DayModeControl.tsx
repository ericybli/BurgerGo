import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TravelMode } from '../../lib/api';
import { colors, font } from '../../lib/theme';

const MODES: TravelMode[] = ['walk', 'drive', 'transit'];
const LABEL: Record<TravelMode, string> = { walk: 'Walk', drive: 'Drive', transit: 'Transit' };

/**
 * Per-day default travel mode (web DayModeControl): "Default" micro label +
 * Walk|Drive|Transit segmented (Atlas recipe), with an accent "Recompute" text
 * button on the right — hidden entirely when offline/disabled.
 */
export function DayModeControl({
  mode,
  disabled,
  busy,
  onChange,
  onRecompute,
}: {
  mode: TravelMode;
  disabled: boolean;
  busy?: boolean;
  onChange: (mode: TravelMode) => void;
  onRecompute: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.label}>Default</Text>
        <View style={styles.track}>
          {MODES.map((m) => {
            const active = m === mode;
            return (
              <Pressable
                key={m}
                disabled={disabled || busy}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onChange(m)}
                style={[styles.item, active && styles.itemActive, (disabled || busy) && !active && { opacity: 0.6 }]}
              >
                <Text style={[styles.itemText, active && styles.itemTextActive]}>{LABEL[m]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {disabled ? null : (
        <Pressable onPress={onRecompute} disabled={busy} hitSlop={6}>
          <Text style={styles.recompute}>{busy ? '…' : 'Recompute'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  label: { fontFamily: font.semibold, fontSize: 11.5, letterSpacing: 0.7, color: colors.faint, textTransform: 'uppercase' },
  track: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 10, padding: 3, gap: 2 },
  item: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  itemActive: {
    backgroundColor: colors.bg,
    shadowColor: colors.ink,
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  itemText: { fontFamily: font.semibold, fontSize: 13, color: colors.sub },
  itemTextActive: { color: colors.ink },
  recompute: { fontFamily: font.semibold, fontSize: 12.5, color: colors.accent, paddingHorizontal: 4, paddingVertical: 4 },
});
