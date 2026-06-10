/**
 * Global connectivity banner — mirrors web components/OfflineBanner.tsx
 * (mounted app-wide in app/layout.tsx). Ink strip, white caption text,
 * centered; hidden while online. Driven by the shared NetInfo hook.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnline } from '../lib/online';
import { colors, font } from '../lib/theme';

export function OfflineBanner() {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[s.banner, { paddingTop: insets.top + 8 }]}
    >
      <Text style={s.text}>Offline — viewing saved data. Editing needs a connection.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    width: '100%',
    backgroundColor: colors.ink,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: colors.white,
    fontFamily: font.medium,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
});
