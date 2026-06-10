/**
 * Pin-tap info card for a Restaurants-layer marker: 🍽️ glyph square, name,
 * cuisine, and an "Open in Google Maps" deep link (offline-safe). The PlanMap
 * contract's MapRestaurant carries id/name/coords/cuisine only, so the richer
 * web fields (address/notes/photo) are omitted here.
 */
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, type } from '../../../lib/theme';
import { placeUrl } from '../../../lib/googleMapsUrl';
import type { MapRestaurant } from '../PlanMap.types';
import { RESTAURANT_GLYPH } from './mapData';

export function RestaurantCard({
  restaurant,
  onClose,
}: {
  restaurant: MapRestaurant;
  onClose: () => void;
}) {
  return (
    <View style={s.backdropHost}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={s.card}>
        <View style={s.headerRow}>
          <View style={s.glyphBox}>
            <Text style={s.glyph}>{RESTAURANT_GLYPH}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.name} numberOfLines={1}>
              {restaurant.name}
            </Text>
            {restaurant.cuisine ? (
              <Text style={s.cuisine} numberOfLines={1}>
                {restaurant.cuisine}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close"
            hitSlop={6}
            style={({ pressed }) => [s.close, pressed && { backgroundColor: colors.line }]}
          >
            <Text style={s.closeText}>✕</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => {
            Linking.openURL(
              placeUrl({ name: restaurant.name, lat: restaurant.lat, lng: restaurant.lng }),
            ).catch(() => {});
          }}
          accessibilityRole="link"
          style={({ pressed }) => [s.mapsBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={s.mapsText}>Open in Google Maps</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdropHost: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 24,
    zIndex: 10,
  },
  card: {
    width: '100%',
    maxWidth: 384,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    padding: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  glyphBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 20 },
  name: { fontSize: 14, lineHeight: 19, fontFamily: font.semibold, color: colors.ink },
  cuisine: { ...type.caption, color: colors.sub, marginTop: 1 },
  close: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: colors.sub, fontSize: 13, fontFamily: font.medium },
  mapsBtn: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: colors.accent,
    paddingVertical: 9,
    alignItems: 'center',
  },
  mapsText: { fontSize: 13, fontFamily: font.semibold, color: colors.white },
});
