/**
 * List row for the Eats screen — Atlas Light port of the web `RestaurantCard`.
 * A flat hairline-divided row (NOT a boxed card): [72×72 thumb] [text column]
 * [chevron]. Thumb renders only when a photo exists (personal upload → cached
 * Google photo → none; no glyph). Google rating / open-now never appear here —
 * detail sheet only.
 */
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import type { Restaurant } from '../../lib/api';
import { priceLevelLabel, ratingStars } from '../../lib/eatsView';
import { colors, font, type } from '../../lib/theme';
import { restaurantThumb } from './eatsGoogle';

export function RestaurantCard({
  restaurant,
  onTap,
}: {
  restaurant: Restaurant;
  onTap: () => void;
}) {
  const price = priceLevelLabel(restaurant.priceLevel);
  const stars = ratingStars(restaurant.rating);
  const been = restaurant.status === 'been';
  const thumb = restaurantThumb(restaurant);

  return (
    <Pressable
      onPress={onTap}
      accessibilityLabel={restaurant.name}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      {thumb ? <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" /> : null}

      <View style={styles.column}>
        <Text style={styles.name} numberOfLines={1}>
          {restaurant.name}
        </Text>

        <View style={[styles.statusChip, been ? styles.statusBeen : styles.statusWant]}>
          <Text style={[styles.statusText, been ? styles.statusTextBeen : styles.statusTextWant]}>
            {been ? 'Been' : 'Want to try'}
          </Text>
        </View>

        <View style={styles.metaRow}>
          {restaurant.cuisine ? <Text style={styles.meta}>{restaurant.cuisine}</Text> : null}
          {stars ? (
            <Text style={styles.stars} accessibilityLabel={`${restaurant.rating} out of 5`}>
              <Text style={styles.starFilled}>{'★'.repeat(stars.filled)}</Text>
              <Text style={styles.starEmpty}>{'★'.repeat(stars.empty)}</Text>
            </Text>
          ) : null}
          {price ? <Text style={styles.price}>{price}</Text> : null}
        </View>

        {restaurant.notes ? (
          <Text style={styles.notes} numberOfLines={1}>
            {restaurant.notes}
          </Text>
        ) : null}

        {restaurant.scheduledDayDate ? (
          <Text style={styles.scheduled}>Scheduled · {restaurant.scheduledDayDate}</Text>
        ) : null}
      </View>

      <ChevronRight size={14} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  thumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.surface },

  column: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontFamily: font.semibold, fontSize: 15, color: colors.ink },

  statusChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  statusBeen: { backgroundColor: colors.surface },
  statusWant: { backgroundColor: colors.accentTint },
  statusText: {
    fontFamily: font.bold,
    fontSize: 10.5,
    letterSpacing: 0.42,
    textTransform: 'uppercase',
  },
  statusTextBeen: { color: colors.sub },
  statusTextWant: { color: colors.accent },

  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8 },
  meta: { fontFamily: font.regular, fontSize: 11.5, color: colors.sub },
  stars: { fontSize: 11.5 },
  starFilled: { color: colors.accent },
  starEmpty: { color: colors.line },
  price: { fontFamily: font.medium, fontSize: 11.5, color: colors.sub, fontVariant: ['tabular-nums'] },

  notes: { ...type.caption, color: colors.sub },
  scheduled: { ...type.micro, color: colors.accent, textTransform: 'uppercase' },
});
