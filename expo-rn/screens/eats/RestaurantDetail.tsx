/**
 * Restaurant detail bottom sheet — Atlas Light port of the web
 * `RestaurantDetailSheet`. Shows meta + schedule line, a Google block
 * (persisted rating + live open-now/hours with stored fallback), notes, hero
 * photo, personal-photo gallery (fullscreen viewer + per-photo delete),
 * add-photo, status toggle (solid accent), day picker, unschedule, edit
 * handoff, two-tap delete, cancel. Close-on-mutate matches web: status /
 * schedule / unschedule / delete call `onChanged` (parent closes + reloads);
 * photo ops call `onPhotoChanged` (reload only — sheet stays open).
 */
import { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Star } from 'lucide-react-native';
import { api, photoUrl, type Restaurant } from '../../lib/api';
import { useTrip } from '../../navigation/TripContext';
import { nextStatus, priceLevelLabel, ratingStars } from '../../lib/eatsView';
import { OfflineHint, SheetPanel } from '../../components/ui';
import { colors, dayColor, font, radius, type } from '../../lib/theme';
import { fetchPoiLive, longWeekday, parseStoredHours, restaurantThumb, type LiveHours } from './eatsGoogle';

const GOLD = dayColor(2); // #C99231 — Google star glyph only

const UPLOAD_ERRORS: Record<string, string> = {
  too_large: 'That image is too large (max 10MB).',
  too_many: "You've reached the photo limit for this place (max 12).",
  invalid_image: 'Please choose an image file.',
  non_image: 'Please choose an image file.',
};

/** Outlined hairline action (web's rounded-control border-line buttons). */
function OutlineButton({
  title,
  onPress,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.outlineBtn,
        pressed && !disabled && { backgroundColor: colors.surface },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      <Text style={styles.outlineBtnText}>{title}</Text>
    </Pressable>
  );
}

export function RestaurantDetail({
  tripId,
  restaurant,
  online,
  onClose,
  onChanged,
  onPhotoChanged,
  onEdit,
}: {
  tripId: string;
  restaurant: Restaurant;
  online: boolean;
  onClose: () => void;
  /** Status / schedule / delete succeeded → parent closes the sheet + reloads. */
  onChanged: () => void;
  /** Photo add/delete succeeded → parent reloads only (sheet stays open). */
  onPhotoChanged: () => void;
  onEdit: () => void;
}) {
  const { days } = useTrip();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Live Google open-now + freshest hours (online only). Stored googleHours /
  // googleRating remain the offline fallback; openNow is never read from storage.
  const [live, setLive] = useState<LiveHours | null>(null);
  // Hours start EXPANDED (user request) — the toggle can still collapse them.
  const [hoursOpen, setHoursOpen] = useState(true);
  useEffect(() => {
    setLive(null);
    setHoursOpen(true);
    if (!online || !restaurant.googlePlaceId) return;
    let cancelled = false;
    void fetchPoiLive(restaurant.googlePlaceId).then((d) => {
      if (!cancelled && d) setLive(d);
    });
    return () => {
      cancelled = true;
    };
  }, [online, restaurant.id, restaurant.googlePlaceId]);

  const disabled = busy || uploading || !online;
  const stars = ratingStars(restaurant.rating);
  const price = priceLevelLabel(restaurant.priceLevel);
  // Full-width hero on a 3x screen needs the 1600px tier — 'card' (800) blurs.
  const hero = restaurantThumb(restaurant, 'full');
  const photos = restaurant.photos;

  const storedHours = parseStoredHours(restaurant.googleHours);
  const hours = live && live.hours.length > 0 ? live.hours : storedHours;
  const openNow = live?.openNow ?? null;
  const showGoogleBlock = restaurant.googleRating != null || hours.length > 0 || openNow != null;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(false);
    try {
      await fn();
      onChanged(); // parent closes + reloads (web behavior)
    } catch {
      setBusy(false);
      setError(true);
    }
  }

  function toggleStatus() {
    void run(() => api.eats.update(tripId, restaurant.id, { status: nextStatus(restaurant.status) }));
  }

  function scheduleTo(dayDate: string) {
    setPicking(false);
    void run(() => api.eats.schedule(tripId, restaurant.id, dayDate));
  }

  function unschedule() {
    void run(() => api.eats.schedule(tripId, restaurant.id, null));
  }

  function removeRestaurant() {
    void run(() => api.eats.remove(tripId, restaurant.id));
  }

  async function deletePhoto(photoId: string) {
    setBusy(true);
    setPhotoError(null);
    try {
      await api.photos.remove(photoId);
      setBusy(false);
      onPhotoChanged(); // sheet stays open; list + gallery re-fetch
    } catch {
      setBusy(false);
      setPhotoError("Couldn't upload — please try again.");
    }
  }

  async function addPhoto() {
    setPhotoError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    const mime = asset.mimeType ?? 'image/jpeg';
    if (!mime.startsWith('image/')) {
      setPhotoError('Please choose an image file.');
      return;
    }
    const name = asset.fileName ?? asset.uri.split('/').pop() ?? 'photo.jpg';
    setUploading(true);
    try {
      await api.photos.upload(tripId, 'restaurant', restaurant.id, { uri: asset.uri, name, type: mime });
      setUploading(false);
      onPhotoChanged();
    } catch (e) {
      setUploading(false);
      const code = e instanceof Error ? e.message : '';
      setPhotoError(UPLOAD_ERRORS[code] ?? "Couldn't upload — please try again.");
    }
  }

  function prevPhoto() {
    setViewerIndex((i) => (i == null ? i : (i - 1 + photos.length) % photos.length));
  }
  function nextPhoto() {
    setViewerIndex((i) => (i == null ? i : (i + 1) % photos.length));
  }
  const openPhoto = viewerIndex != null ? photos[viewerIndex] : null;

  return (
    <SheetPanel style={styles.panel}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Couldn't save — please try again.</Text>
          </View>
        ) : null}

        <Text style={styles.title}>{restaurant.name}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>{restaurant.cuisine ?? 'Cuisine not set'}</Text>
          {stars ? (
            <Text style={styles.stars} accessibilityLabel={`${restaurant.rating} out of 5`}>
              <Text style={styles.starFilled}>{'★'.repeat(stars.filled)}</Text>
              <Text style={styles.starEmpty}>{'★'.repeat(stars.empty)}</Text>
            </Text>
          ) : (
            <Text style={styles.meta}>No rating</Text>
          )}
          {price ? <Text style={styles.price}>{price}</Text> : null}
        </View>

        <Text style={styles.scheduled}>
          {restaurant.scheduledDayDate ? `Scheduled · ${restaurant.scheduledDayDate}` : 'Not scheduled'}
        </Text>

        {showGoogleBlock ? (
          <View style={styles.googleBox}>
            {restaurant.googleRating != null ? (
              <View style={styles.googleRatingRow}>
                <Star size={12} color={GOLD} fill={GOLD} strokeWidth={0} />
                <Text style={styles.googleRatingValue}>{restaurant.googleRating.toFixed(1)}</Text>
                {restaurant.googleRatingCount != null ? (
                  <Text style={styles.googleRatingCount}>
                    · {restaurant.googleRatingCount.toLocaleString('en-US')}{' '}
                    {restaurant.googleRatingCount === 1 ? 'review' : 'reviews'}
                  </Text>
                ) : null}
                <Text style={styles.googleSource}>· Google</Text>
              </View>
            ) : null}
            {openNow != null || hours.length > 0 ? (
              <View style={restaurant.googleRating != null ? { marginTop: 6 } : null}>
                <Pressable
                  onPress={() => setHoursOpen((v) => !v)}
                  disabled={hours.length === 0}
                  accessibilityRole="button"
                  style={styles.hoursToggle}
                >
                  {openNow != null ? (
                    <Text style={[styles.hoursToggleText, { color: openNow ? colors.success : colors.danger }]}>
                      {openNow ? 'Open now' : 'Closed'}
                    </Text>
                  ) : (
                    <Text style={[styles.hoursToggleText, { color: colors.ink }]}>Hours</Text>
                  )}
                  {hours.length > 0 ? (
                    <Text style={styles.hoursChevron}>{hoursOpen ? '▴' : '▾'}</Text>
                  ) : null}
                </Pressable>
                {hoursOpen && hours.length > 0 ? (
                  <View style={styles.hoursList}>
                    {hours.map((line, i) => (
                      <Text key={`${i}-${line}`} style={styles.hoursLine}>
                        {line}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {restaurant.notes ? <Text style={styles.notes}>{restaurant.notes}</Text> : null}

        {hero ? <Image source={{ uri: hero }} style={styles.hero} resizeMode="cover" /> : null}

        {photoError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{photoError}</Text>
          </View>
        ) : null}

        {photos.length > 0 ? (
          <View style={styles.gallery}>
            <Text style={styles.galleryLabel}>Photos</Text>
            <View style={styles.thumbWrap}>
              {photos.map((p, i) => (
                <View key={p.id} style={styles.thumbItem}>
                  <Pressable onPress={() => setViewerIndex(i)}>
                    <Image
                      source={{ uri: photoUrl.personal(p.id, 'thumb') }}
                      style={styles.thumb}
                      resizeMode="cover"
                    />
                  </Pressable>
                  <Pressable
                    style={[styles.thumbDelete, disabled && { opacity: 0.4 }]}
                    disabled={disabled}
                    onPress={() => deletePhoto(p.id)}
                    hitSlop={6}
                    accessibilityLabel="Delete photo"
                  >
                    <Text style={styles.thumbDeleteText}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <OutlineButton
          title={uploading ? 'Uploading…' : online ? 'Add photo' : 'Connect to add photos'}
          onPress={addPhoto}
          disabled={disabled}
          style={styles.action}
        />

        <Pressable
          onPress={toggleStatus}
          disabled={disabled}
          style={({ pressed }) => [
            styles.toggleBtn,
            pressed && !disabled && { opacity: 0.85 },
            disabled && styles.solidDisabled,
          ]}
        >
          <Text style={[styles.solidText, disabled && styles.solidTextDisabled]}>
            {restaurant.status === 'been' ? 'Mark as want to try' : 'Mark as been'}
          </Text>
        </Pressable>

        {picking ? (
          <View style={styles.picker}>
            <Text style={styles.pickerTitle}>Add to which day?</Text>
            {days.map((d) => (
              <Pressable
                key={d.date}
                disabled={disabled}
                onPress={() => scheduleTo(d.date)}
                style={({ pressed }) => [
                  styles.dayRow,
                  pressed && !disabled && { backgroundColor: colors.surface },
                  disabled && { opacity: 0.45 },
                ]}
              >
                <Text style={styles.dayText}>
                  Day {d.dayNumber} · {longWeekday(d.date)} {d.date}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <OutlineButton title="Add to a day" onPress={() => setPicking(true)} disabled={disabled} style={styles.action} />
        )}

        {restaurant.scheduledDayDate ? (
          <OutlineButton title="Remove from plan" onPress={unschedule} disabled={disabled} style={styles.action} />
        ) : null}

        <OutlineButton title="Edit restaurant" onPress={onEdit} disabled={busy || !online} style={styles.action} />

        {!online ? <OfflineHint /> : null}

        {confirmDelete ? (
          <Pressable
            onPress={removeRestaurant}
            disabled={disabled}
            style={({ pressed }) => [
              styles.deleteSolid,
              pressed && !disabled && { opacity: 0.85 },
              disabled && styles.solidDisabled,
            ]}
          >
            <Text style={[styles.solidText, disabled && styles.solidTextDisabled]}>Delete this restaurant?</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setConfirmDelete(true)}
            disabled={disabled}
            style={({ pressed }) => [styles.deleteText, (pressed || disabled) && { opacity: 0.45 }]}
          >
            <Text style={styles.deleteTextLabel}>Delete</Text>
          </Pressable>
        )}

        <OutlineButton title="Cancel" onPress={onClose} style={styles.cancel} />
      </ScrollView>

      <Modal visible={openPhoto !== null} transparent animationType="fade" onRequestClose={() => setViewerIndex(null)}>
        <View style={styles.viewerWrap}>
          {openPhoto ? (
            <Image
              source={{ uri: photoUrl.personal(openPhoto.id, 'full') }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          ) : null}
          <View style={styles.viewerControls}>
            {photos.length > 1 ? (
              <>
                <Pressable style={styles.viewerBtn} onPress={prevPhoto} accessibilityLabel="Previous photo">
                  <Text style={styles.viewerBtnText}>‹</Text>
                </Pressable>
                <Pressable style={styles.viewerBtn} onPress={nextPhoto} accessibilityLabel="Next photo">
                  <Text style={styles.viewerBtnText}>›</Text>
                </Pressable>
              </>
            ) : null}
            <Pressable style={styles.viewerBtn} onPress={() => setViewerIndex(null)} accessibilityLabel="Close photo">
              <Text style={styles.viewerBtnText}>Close photo</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SheetPanel>
  );
}

const styles = StyleSheet.create({
  panel: { maxHeight: '85%' },
  content: { paddingBottom: 4 },

  errorBox: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: { ...type.caption, color: colors.danger },

  title: { fontFamily: font.bold, fontSize: 18, letterSpacing: -0.18, color: colors.ink },

  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, marginTop: 4 },
  meta: { ...type.caption, color: colors.sub },
  stars: { fontSize: 12 },
  starFilled: { color: colors.accent },
  starEmpty: { color: colors.line },
  price: { fontFamily: font.medium, fontSize: 12, color: colors.ink, fontVariant: ['tabular-nums'] },

  scheduled: { marginTop: 4, ...type.micro, color: colors.accent, textTransform: 'uppercase' },

  googleBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  googleRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  googleRatingValue: { fontFamily: font.semibold, fontSize: 12, color: colors.ink, fontVariant: ['tabular-nums'] },
  googleRatingCount: { ...type.caption, color: colors.sub, fontVariant: ['tabular-nums'] },
  googleSource: { ...type.caption, color: colors.faint },
  hoursToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  hoursToggleText: { fontFamily: font.semibold, fontSize: 12 },
  hoursChevron: { fontSize: 12, color: colors.faint },
  hoursList: { marginTop: 6, gap: 2 },
  hoursLine: { ...type.caption, color: colors.sub, fontVariant: ['tabular-nums'] },

  notes: { marginTop: 8, ...type.body, color: colors.ink },

  hero: {
    marginTop: 12,
    width: '100%',
    height: 192,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },

  gallery: { marginTop: 12 },
  galleryLabel: { ...type.label, color: colors.ink },
  thumbWrap: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbItem: { position: 'relative' },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  thumbDelete: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbDeleteText: { fontFamily: font.bold, fontSize: 12, color: colors.danger },

  action: { marginTop: 12 },
  cancel: { marginTop: 16 },

  outlineBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: radius.control,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  outlineBtnText: { ...type.label, color: colors.ink },

  toggleBtn: {
    marginTop: 16,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  solidDisabled: { backgroundColor: colors.surface },
  solidText: { fontFamily: font.semibold, fontSize: 14, color: colors.white },
  solidTextDisabled: { color: colors.faint },

  picker: { marginTop: 12 },
  pickerTitle: { ...type.label, color: colors.ink },
  dayRow: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dayText: { ...type.body, color: colors.ink, fontVariant: ['tabular-nums'] },

  deleteSolid: {
    marginTop: 12,
    backgroundColor: colors.danger,
    borderRadius: radius.control,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  deleteText: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  deleteTextLabel: { ...type.label, color: colors.danger },

  viewerWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  viewerImage: { width: '100%', height: '80%', borderRadius: radius.card },
  viewerControls: { flexDirection: 'row', gap: 12, marginTop: 16 },
  viewerBtn: {
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerBtnText: { ...type.label, color: colors.ink },
});
