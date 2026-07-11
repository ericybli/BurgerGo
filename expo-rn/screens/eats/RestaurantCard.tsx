/**
 * List card for the Eats screen — photo-led restaurant card (Tickets+Eats
 * redesign). A rounded, shadowed card whose whole surface is the tap target:
 * a ~176px photo band (personal upload → cached Google photo → warm gradient
 * fallback) with overlaid status + rating pills and a name/cuisine·price
 * caption, plus an optional white footer (notes + Scheduled chip). The footer
 * is omitted entirely when there are no notes and nothing is scheduled, leaving
 * a pure photo card. Open-now is not available in list data and is never shown.
 */
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Restaurant } from '../../lib/api';
import { priceLevelLabel, ratingStars } from '../../lib/eatsView';
import { gradientFor } from '../../lib/uiHash';
import { colors, dayColor, font } from '../../lib/theme';
import { restaurantThumb } from './eatsGoogle';

const GOLD = dayColor(2); // #C99231 — Google / your-star glyph color

/** Compact review count: 1,234 → "1.2k", 980 → "980". */
function compactCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function RestaurantCard({
  restaurant,
  onTap,
}: {
  restaurant: Restaurant;
  onTap: () => void;
}) {
  const price = priceLevelLabel(restaurant.priceLevel);
  const been = restaurant.status === 'been';
  const thumb = restaurantThumb(restaurant, 'card');
  const stars = been ? ratingStars(restaurant.rating) : null;

  const subParts = [restaurant.cuisine, price].filter(Boolean) as string[];
  const subLine = subParts.join(' · ');

  const hasFooter = !!restaurant.notes || !!restaurant.scheduledDayDate;

  return (
    <Pressable
      onPress={onTap}
      accessibilityLabel={restaurant.name}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      {/* Photo band */}
      <View style={styles.photo}>
        <LinearGradient
          colors={gradientFor(restaurant.name)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {thumb ? (
          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}

        {/* Bottom scrim for legible overlay text */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)']}
          style={StyleSheet.absoluteFill}
        />

        {/* Top-left status pill */}
        <View style={styles.statusPill}>
          <Text style={[styles.statusText, been && styles.statusTextBeen]} numberOfLines={1}>
            {been ? '✓ Been' : 'Want to try'}
          </Text>
        </View>

        {/* Top-right rating pill: personal stars (been) → Google rating → none */}
        {stars ? (
          <View style={styles.ratingPill}>
            <Text
              style={styles.ratingStars}
              accessibilityLabel={`${restaurant.rating} out of 5`}
            >
              <Text style={styles.starFilled}>{'★'.repeat(stars.filled)}</Text>
              <Text style={styles.starEmpty}>{'★'.repeat(stars.empty)}</Text>
            </Text>
          </View>
        ) : restaurant.googleRating != null ? (
          <View style={styles.ratingPill}>
            <Text style={styles.ratingText}>
              <Text style={styles.starFilled}>★ </Text>
              {restaurant.googleRating.toFixed(1)}
              {restaurant.googleRatingCount != null
                ? ` · ${compactCount(restaurant.googleRatingCount)}`
                : ''}
            </Text>
          </View>
        ) : null}

        {/* Bottom overlay: name + cuisine·price */}
        <View style={styles.overlay}>
          <Text style={styles.name} numberOfLines={1}>
            {restaurant.name}
          </Text>
          {subLine ? (
            <Text style={styles.sub} numberOfLines={1}>
              {subLine}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Footer (only when there's something to show) */}
      {hasFooter ? (
        <View style={styles.footer}>
          {restaurant.notes ? (
            <Text style={styles.notes} numberOfLines={1}>
              {restaurant.notes}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {restaurant.scheduledDayDate ? (
            <View style={styles.schedChip}>
              <Text style={styles.schedText}>📅 Scheduled</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  photo: { height: 176, position: 'relative' },

  statusPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  statusText: { fontFamily: font.bold, fontSize: 12, color: colors.ink },
  statusTextBeen: { color: colors.success },

  ratingPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(27,31,28,0.55)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  ratingStars: { fontSize: 12 },
  ratingText: {
    fontFamily: font.bold,
    fontSize: 12,
    color: colors.white,
    fontVariant: ['tabular-nums'],
  },
  starFilled: { color: GOLD },
  starEmpty: { color: 'rgba(255,255,255,0.4)' },

  overlay: { position: 'absolute', left: 14, right: 14, bottom: 12 },
  name: {
    fontFamily: font.bold,
    fontSize: 21,
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sub: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
  },
  notes: { flex: 1, fontFamily: font.regular, fontSize: 13, color: colors.sub },
  schedChip: {
    backgroundColor: colors.accentTint,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  schedText: { fontFamily: font.semibold, fontSize: 12, color: colors.accent },
});
