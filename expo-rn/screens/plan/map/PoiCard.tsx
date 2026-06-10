/**
 * POI info card for a tapped Google basemap landmark (shared by both
 * platforms). Self-contained: fetches /api/google/poi for the given place id,
 * owns pager/hours/saving state, and renders an inline day-picker sheet for
 * "Add to day". The save actions themselves come from the PlanMap contract
 * (the parent performs the backend writes); on success the card stays open in
 * its "Added ✓" state. Re-mount (key by placeId) to reset state per landmark.
 */
import { useEffect, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react-native';
import { api, type PoiDetails } from '../../../lib/api';
import { colors, font, type } from '../../../lib/theme';
import { placeUrl } from '../../../lib/googleMapsUrl';
import type { MapDayGroup } from '../PlanMap.types';

const GOLD = '#C99231'; // day-2 amber: rating stars

type PoiState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; details: PoiDetails };

type AddedKind = 'saved' | 'day' | 'restaurant' | null;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekdayOf = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]!;

export function PoiCard({
  placeId,
  dayGroups,
  online,
  onSavePlace,
  onAddToDay,
  onSaveRestaurant,
  onClose,
}: {
  placeId: string;
  /** Day choices for "Add to day" (all dated groups). */
  dayGroups: MapDayGroup[];
  online: boolean;
  onSavePlace: (poi: PoiDetails) => Promise<void>;
  onAddToDay: (poi: PoiDetails, dayDate: string) => Promise<void>;
  onSaveRestaurant: (poi: PoiDetails) => Promise<void>;
  onClose: () => void;
}) {
  const [state, setState] = useState<PoiState>({ status: 'loading' });
  const [added, setAdded] = useState<AddedKind>(null);
  const [saving, setSaving] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    api.google
      .poi(placeId)
      .then((d) => {
        if (!cancelled) setState({ status: 'loaded', details: d });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [placeId]);

  async function run(kind: Exclude<AddedKind, null>, fn: () => Promise<void>) {
    if (saving || added) return;
    setSaving(true);
    try {
      await fn();
      setAdded(kind);
    } catch {
      // keep the card usable; the buttons return to their idle labels
    } finally {
      setSaving(false);
    }
  }

  const d = state.status === 'loaded' ? state.details : null;
  const actionsDisabled = !online || saving || added != null;

  return (
    <View style={s.backdropHost}>
      {/* Backdrop tap closes. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={s.card}>
        {state.status === 'loading' ? (
          <Text style={s.stateText}>Loading place…</Text>
        ) : state.status === 'error' ? (
          <Text style={[s.stateText, { color: colors.danger }]}>
            Couldn't load this place. Try again.
          </Text>
        ) : d ? (
          <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
            {d.photoRefs.length > 0 ? (
              <View style={s.photoWrap}>
                <Image
                  source={{ uri: api.google.poiPhotoUrl(d.photoRefs[photoIdx] ?? d.photoRefs[0]!, 800) }}
                  style={s.photo}
                  resizeMode="cover"
                />
                {d.photoRefs.length > 1 ? (
                  <>
                    <Pressable
                      accessibilityLabel="Previous photo"
                      onPress={() =>
                        setPhotoIdx((i) => (i - 1 + d.photoRefs.length) % d.photoRefs.length)
                      }
                      style={({ pressed }) => [s.pagerBtn, s.pagerLeft, pressed && { opacity: 0.8 }]}
                    >
                      <ChevronLeft size={16} strokeWidth={2.2} color={colors.ink} />
                    </Pressable>
                    <Pressable
                      accessibilityLabel="Next photo"
                      onPress={() => setPhotoIdx((i) => (i + 1) % d.photoRefs.length)}
                      style={({ pressed }) => [s.pagerBtn, s.pagerRight, pressed && { opacity: 0.8 }]}
                    >
                      <ChevronRight size={16} strokeWidth={2.2} color={colors.ink} />
                    </Pressable>
                    <View style={s.counterPill}>
                      <Text style={s.counterText}>
                        {photoIdx + 1}/{d.photoRefs.length}
                      </Text>
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}

            <View style={s.headerRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.name}>{d.name || d.address || 'Map landmark'}</Text>
                {d.rating != null ? (
                  <View style={s.ratingRow}>
                    <Star size={12} color={GOLD} fill={GOLD} strokeWidth={0} />
                    <Text style={s.ratingValue}>{d.rating.toFixed(1)}</Text>
                    {d.ratingCount != null ? (
                      <Text style={s.ratingCount}>
                        · {d.ratingCount} {d.ratingCount === 1 ? 'review' : 'reviews'}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {d.address ? <Text style={s.address}>{d.address}</Text> : null}
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

            {d.summary ? <Text style={s.summary}>{d.summary}</Text> : null}

            {d.openNow != null || d.hours.length > 0 ? (
              <View style={{ marginTop: 10 }}>
                <Pressable
                  onPress={() => setHoursOpen((v) => !v)}
                  disabled={d.hours.length === 0}
                  accessibilityState={{ expanded: hoursOpen }}
                  style={s.hoursToggle}
                >
                  {d.openNow != null ? (
                    <Text
                      style={[s.hoursStatus, { color: d.openNow ? colors.success : colors.danger }]}
                    >
                      {d.openNow ? 'Open now' : 'Closed'}
                    </Text>
                  ) : (
                    <Text style={[s.hoursStatus, { color: colors.ink }]}>Hours</Text>
                  )}
                  {d.hours.length > 0 ? (
                    <Text style={s.hoursChevron}>{hoursOpen ? '▴' : '▾'}</Text>
                  ) : null}
                </Pressable>
                {hoursOpen && d.hours.length > 0 ? (
                  <View style={{ marginTop: 6, gap: 2 }}>
                    {d.hours.map((line) => (
                      <Text key={line} style={s.hoursLine}>
                        {line}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {d.reviews.length > 0 ? (
              <View style={{ marginTop: 12 }}>
                <Text style={s.reviewsHeader}>Reviews</Text>
                <View style={{ marginTop: 6 }}>
                  {d.reviews.map((rv, i) => (
                    <View
                      key={`${rv.author}-${i}`}
                      style={[s.review, i === d.reviews.length - 1 && s.reviewLast]}
                    >
                      <View style={s.reviewMeta}>
                        <Text style={s.reviewAuthor} numberOfLines={1}>
                          {rv.author}
                        </Text>
                        {rv.rating != null ? (
                          <View style={s.reviewRating}>
                            <Star size={10} color={GOLD} fill={GOLD} strokeWidth={0} />
                            <Text style={s.reviewRatingText}>{rv.rating}</Text>
                          </View>
                        ) : null}
                        {rv.time ? <Text style={s.reviewTime}>· {rv.time}</Text> : null}
                      </View>
                      <Text style={s.reviewText} numberOfLines={4}>
                        {rv.text}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {d.isFood ? (
              <ActionButton
                kind="orange"
                disabled={actionsDisabled}
                label={
                  added === 'restaurant' ? 'Saved to Eats ✓' : saving ? 'Adding…' : 'Save restaurant'
                }
                onPress={() => run('restaurant', () => onSaveRestaurant(d))}
                style={{ marginTop: 12 }}
              />
            ) : (
              <View style={s.actionRow}>
                <ActionButton
                  kind="orange"
                  disabled={actionsDisabled}
                  label={added === 'day' ? 'Added to day ✓' : saving ? 'Adding…' : 'Add to day'}
                  onPress={() => setPickerOpen(true)}
                  style={{ flex: 1 }}
                />
                <ActionButton
                  kind="outline"
                  disabled={actionsDisabled}
                  label={added === 'saved' ? 'Saved ✓' : 'Save place'}
                  onPress={() => run('saved', () => onSavePlace(d))}
                  style={{ flex: 1 }}
                />
              </View>
            )}

            <ActionButton
              kind="accent"
              disabled={false}
              label="Open in Google Maps"
              onPress={() => {
                Linking.openURL(
                  placeUrl({
                    name: d.name,
                    lat: d.lat,
                    lng: d.lng,
                    googlePlaceId: d.googlePlaceId,
                    address: d.address,
                  }),
                ).catch(() => {});
              }}
              style={{ marginTop: 8 }}
            />
          </ScrollView>
        ) : null}
      </View>

      {pickerOpen && d ? (
        <View style={s.pickerHost}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPickerOpen(false)}
            accessibilityLabel="Close"
          />
          <View style={s.pickerPanel}>
            <View style={s.pickerHandle} />
            <Text style={s.pickerTitle}>Add to which day?</Text>
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
              {dayGroups.map((g) => (
                <Pressable
                  key={g.date}
                  onPress={() => {
                    setPickerOpen(false);
                    void run('day', () => onAddToDay(d, g.date));
                  }}
                  style={({ pressed }) => [s.pickerRow, pressed && { backgroundColor: colors.surface }]}
                >
                  <Text style={s.pickerRowText}>
                    Day {g.dayNumber} · {weekdayOf(g.date)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ActionButton({
  kind,
  label,
  disabled,
  onPress,
  style,
}: {
  kind: 'orange' | 'outline' | 'accent';
  label: string;
  disabled: boolean;
  onPress: () => void;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.actionBtn,
        kind === 'orange' && { backgroundColor: pressed ? colors.orangePress : colors.orange },
        kind === 'accent' && { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
        kind === 'outline' && [
          s.actionOutline,
          pressed && { backgroundColor: colors.surface },
        ],
        // Disabled solid = surface bg + faint text (never opacity-wash orange).
        disabled && { backgroundColor: colors.surface, borderColor: colors.surface },
        style,
      ]}
    >
      <Text
        style={[
          s.actionText,
          kind === 'outline' ? { color: colors.ink } : { color: colors.white },
          disabled && { color: colors.faint },
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
    maxHeight: '78%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  scroll: { flexGrow: 0 },
  scrollContent: { padding: 12 },
  stateText: { ...type.body, color: colors.sub, paddingHorizontal: 16, paddingVertical: 14 },

  photoWrap: { borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  photo: { height: 165, width: '100%', backgroundColor: colors.surface },
  pagerBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagerLeft: { left: 8 },
  pagerRight: { right: 8 },
  counterPill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(27,31,28,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  counterText: {
    color: colors.white,
    fontSize: 10.5,
    fontFamily: font.bold,
    fontVariant: ['tabular-nums'],
  },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  name: { fontSize: 15, lineHeight: 20, fontFamily: font.semibold, color: colors.ink },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ratingValue: {
    fontSize: 12,
    fontFamily: font.semibold,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  ratingCount: { fontSize: 12, fontFamily: font.medium, color: colors.sub, fontVariant: ['tabular-nums'] },
  address: { ...type.caption, color: colors.sub, marginTop: 2 },
  close: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: colors.sub, fontSize: 13, fontFamily: font.medium },

  summary: { fontSize: 13, lineHeight: 19, fontFamily: font.regular, color: colors.ink, marginTop: 8 },

  hoursToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hoursStatus: { fontSize: 12, fontFamily: font.semibold },
  hoursChevron: { fontSize: 11, color: colors.faint, fontFamily: font.medium },
  hoursLine: { ...type.caption, color: colors.sub, fontVariant: ['tabular-nums'] },

  reviewsHeader: { ...type.micro, color: colors.faint, textTransform: 'uppercase' },
  review: {
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  reviewLast: { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewAuthor: { fontSize: 12, fontFamily: font.semibold, color: colors.ink, flexShrink: 1 },
  reviewRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  reviewRatingText: { fontSize: 12, fontFamily: font.medium, color: colors.sub, fontVariant: ['tabular-nums'] },
  reviewTime: { fontSize: 12, fontFamily: font.medium, color: colors.faint },
  reviewText: { fontSize: 12.5, lineHeight: 18, fontFamily: font.regular, color: colors.sub, marginTop: 2 },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionOutline: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
  actionText: { fontSize: 13, fontFamily: font.semibold },

  pickerHost: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  pickerPanel: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: '70%',
  },
  pickerHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 12,
  },
  pickerTitle: { ...type.title, color: colors.ink, marginBottom: 12 },
  pickerRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pickerRowText: { fontSize: 13.5, fontFamily: font.medium, color: colors.ink },
});
