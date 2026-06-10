/**
 * Pin-tap info card for a Restaurants-layer marker (web RestaurantInfoCard
 * parity): glyph square ONLY when there's no photo, name, cuisine, Google
 * rating (when persisted), photo (first personal → cached Google), address,
 * notes, and an "Open in Google Maps" deep link built from the exact POI
 * identity (googlePlaceId + address) so Maps opens the real place card.
 * The richer MapRestaurant fields are optional — the card degrades to the
 * glyph + name + cuisine basics when they're absent.
 */
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { colors, font, type } from '../../../lib/theme';
import { placeUrl } from '../../../lib/googleMapsUrl';
import type { MapRestaurant } from '../PlanMap.types';
import { RESTAURANT_GLYPH } from './mapData';

const GOLD = '#C99231'; // day-2 amber: rating stars (same as PoiCard)

/** `notes` is web-card content not yet in the frozen contract; read when present. */
type CardRestaurant = MapRestaurant & { notes?: string | null };

export function RestaurantCard({
  restaurant,
  onClose,
}: {
  restaurant: CardRestaurant;
  onClose: () => void;
}) {
  const photo = restaurant.photoUrl ?? null;
  return (
    <View style={s.backdropHost}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={s.card}>
        <View style={s.headerRow}>
          {photo == null ? (
            <View style={s.glyphBox}>
              <Text style={s.glyph}>{RESTAURANT_GLYPH}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.name} numberOfLines={1}>
              {restaurant.name}
            </Text>
            {restaurant.cuisine ? (
              <Text style={s.cuisine} numberOfLines={1}>
                {restaurant.cuisine}
              </Text>
            ) : null}
            {restaurant.googleRating != null ? (
              <View style={s.ratingRow}>
                <Star size={12} color={GOLD} fill={GOLD} strokeWidth={0} />
                <Text style={s.ratingValue}>{restaurant.googleRating.toFixed(1)}</Text>
              </View>
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

        {photo != null ? (
          <Image
            source={{ uri: photo }}
            style={s.photo}
            resizeMode="cover"
            accessibilityLabel={restaurant.name}
          />
        ) : null}

        {restaurant.address ? <Text style={s.address}>{restaurant.address}</Text> : null}
        {restaurant.notes ? <Text style={s.notes}>{restaurant.notes}</Text> : null}

        <Pressable
          onPress={() => {
            Linking.openURL(
              placeUrl({
                name: restaurant.name,
                lat: restaurant.lat,
                lng: restaurant.lng,
                googlePlaceId: restaurant.googlePlaceId,
                address: restaurant.address,
              }),
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
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ratingValue: {
    fontSize: 12,
    fontFamily: font.semibold,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  close: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: colors.sub, fontSize: 13, fontFamily: font.medium },
  // Web: mt-3 h-44 rounded-[10px] object-cover.
  photo: {
    marginTop: 12,
    height: 176,
    width: '100%',
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  address: { ...type.caption, color: colors.ink, marginTop: 8 },
  notes: { ...type.caption, color: colors.sub, marginTop: 4 },
  mapsBtn: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: colors.accent,
    paddingVertical: 9,
    alignItems: 'center',
  },
  mapsText: { fontSize: 13, fontFamily: font.semibold, color: colors.white },
});
