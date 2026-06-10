/**
 * Offline replacement for the whole map: empty-state headline + every visible
 * plottable place as a tappable deep-link row (name + teal ↗) — placeUrl works
 * offline from cached coords.
 */
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '../../../components/ui';
import { colors, font } from '../../../lib/theme';
import { placeUrl } from '../../../lib/googleMapsUrl';
import type { OfflinePlace } from './useMapShell';

export function OfflineMap({ places }: { places: OfflinePlace[] }) {
  return (
    <ScrollView style={s.host} contentContainerStyle={s.content}>
      <View style={s.empty}>
        <EmptyState
          headline="Map needs a connection"
          subtext="Tap any place to open Google Maps."
        />
      </View>
      {places.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="link"
          onPress={() => {
            Linking.openURL(
              placeUrl({
                name: p.name,
                lat: p.lat,
                lng: p.lng,
                googlePlaceId: p.googlePlaceId,
                address: p.address,
              }),
            ).catch(() => {});
          }}
          style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.surface }]}
        >
          <Text style={s.name} numberOfLines={1}>
            {p.name}
          </Text>
          <Text style={s.arrow}>↗</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  host: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
  empty: { minHeight: 180, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  name: { flexShrink: 1, fontSize: 13, fontFamily: font.semibold, color: colors.ink },
  arrow: { marginLeft: 8, color: colors.accent, fontSize: 14, fontFamily: font.semibold },
});
