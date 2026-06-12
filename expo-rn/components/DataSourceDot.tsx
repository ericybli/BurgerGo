/**
 * Global data-source indicator: 8px dot, top-right safe area, every screen.
 * Green = live server data; red = cached/offline data. Tap → 3s label
 * with the offline-download timestamp when showing cached data.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDataSource, subscribeDataSource } from '../lib/dataSource';
import { getOfflineMeta } from '../lib/offlineStore';
import { useOnline } from '../lib/online';
import { colors, font } from '../lib/theme';
import { GlassPlate } from './ui/glass';

export function DataSourceDot() {
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const [source, setSource] = useState(getDataSource());
  const [label, setLabel] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => subscribeDataSource(setSource), []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const cached = !online || source === 'cache';

  async function showLabel() {
    if (cached) {
      const meta = await getOfflineMeta();
      const when = meta
        ? ` — downloaded ${new Date(meta.ts).toLocaleString([], { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
        : '';
      setLabel(`Offline data${when}`);
    } else {
      setLabel('Live data');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setLabel(null), 3000);
  }

  return (
    <View pointerEvents="box-none" style={[s.wrap, { top: insets.top + 10 }]}>
      {label ? (
        <GlassPlate radius={999} style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={s.labelText}>{label}</Text>
        </GlassPlate>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cached ? 'Showing offline data' : 'Showing live data'}
        hitSlop={10}
        onPress={() => void showLabel()}
        style={[s.dot, { backgroundColor: cached ? colors.danger : colors.success }]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 12,
    zIndex: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  labelText: { fontSize: 11, fontFamily: font.medium, color: colors.ink },
});
