import { useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { X } from 'lucide-react-native';
import { api, photoUrl, type Place, type PlacePatch } from '../../lib/api';
import { CATEGORIES, colors, font, radius, type } from '../../lib/theme';
import { inputToMinor, minorToInput } from '../../lib/currency';
import { placeUrl } from '../../lib/googleMapsUrl';
import { todayLocal } from '../../lib/days';
import { Button, Field, OfflineHint, Select } from '../../components/ui';
import { categoryLabel, isHttpUrl, placeCategoryToBudget } from './planShared';
import { useAutocomplete } from './useAutocomplete';
import { addPlaceLink, generateSummary } from './planApi';

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c as string, label: categoryLabel(c) }));

type Thumb = { id: string; width: number | null; height: number | null };
type LinkLite = { id: string; url: string; title: string | null; thumbnail: string | null };

const UPLOAD_ERRORS: Record<string, string> = {
  too_large: 'That image is too large (max 10MB).',
  too_many: 'You’ve reached the photo limit for this place (max 12).',
  invalid_image: 'Please choose an image file.',
};

/** Lenient "HH:MM" parse: "9:5" → "09:05"; empty → null; invalid → undefined. */
function parseTime(value: string): string | null | undefined {
  const t = value.trim();
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(t);
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return undefined;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * Edit sheet for a place (web PlaceDetailSheet): every editable field, address
 * re-pin via autocomplete (coords patched only when a suggestion is re-picked),
 * cost + "Add as expense", About (AI) with Regenerate, photos, travel guides,
 * and an accent "Open in Google Maps".
 */
export function PlaceDetailSheet({
  tripId,
  place,
  currency,
  online,
  onClose,
  onSaved,
  onChanged,
}: {
  tripId: string;
  place: Place;
  currency: string;
  online: boolean;
  onClose: () => void;
  /** After a successful field save: optimistic patch + refetch + close. */
  onSaved: (placeId: string, patch: PlacePatch) => void;
  /** Reload the underlying list after a photo/link change (without closing). */
  onChanged?: () => void;
}) {
  const disabled = !online;
  const [name, setName] = useState(place.name);
  const [address, setAddress] = useState(place.address ?? '');
  const [category, setCategory] = useState<string>(place.category);
  const [time, setTime] = useState(place.scheduledTime ?? '');
  const [cost, setCost] = useState(place.cost != null ? minorToInput(place.cost, currency) : '');
  const [notes, setNotes] = useState(place.notes ?? '');
  const [aiSummary, setAiSummary] = useState(place.aiSummary ?? '');
  const [regenerating, setRegenerating] = useState(false);
  const [expenseStatus, setExpenseStatus] = useState<'idle' | 'added' | 'error'>('idle');
  // Coords + place id captured when the user re-pins via an address suggestion;
  // null → keep the existing pin on save.
  const [picked, setPicked] = useState<{ lat: number; lng: number; googlePlaceId: string } | null>(null);
  const { predictions, search, select, clear } = useAutocomplete();

  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [photos, setPhotos] = useState<Thumb[]>(place.photos);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Full-screen photo viewer (web PhotoGallery): tap a thumb → /full image on a
  // dark scrim with ‹ / › wrap-around when >1 photo + "Close photo".
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const viewerPhoto = viewerIndex != null ? (photos[viewerIndex] ?? null) : null;

  function prevPhoto() {
    setViewerIndex((i) => (i == null ? i : (i - 1 + photos.length) % photos.length));
  }
  function nextPhoto() {
    setViewerIndex((i) => (i == null ? i : (i + 1) % photos.length));
  }

  const [links, setLinks] = useState<LinkLite[]>(place.links);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);

  const mapsHref = placeUrl({
    name: place.name,
    lat: place.lat ?? 0,
    lng: place.lng ?? 0,
    googlePlaceId: place.googlePlaceId,
    address: place.address,
  });

  function handleAddressChange(value: string) {
    setAddress(value);
    setPicked(null); // typing invalidates a prior suggestion pick
    search(value);
  }

  function handleAddressClear() {
    setAddress('');
    setPicked(null);
    clear();
  }

  /** Re-pin: a picked suggestion carries the corrected coordinates + place id. */
  async function handlePick(placeId: string) {
    const filled = await select(placeId);
    if (!filled) return;
    if (filled.address) setAddress(filled.address);
    if (typeof filled.lat === 'number' && typeof filled.lng === 'number') {
      setPicked({ lat: filled.lat, lng: filled.lng, googlePlaceId: filled.googlePlaceId });
    }
    clear();
  }

  /** Log the entered cost as a budget expense linked back to this place. */
  async function handleAddExpense() {
    const minor = inputToMinor(cost, currency);
    if (minor == null) return; // needs a positive cost
    setExpenseStatus('idle');
    setBusy(true);
    try {
      await api.budget.addExpense(tripId, {
        amount: minor,
        category: placeCategoryToBudget(place.category),
        spentOn: place.dayDate ?? todayLocal(),
        note: place.name,
        linkedPlaceId: place.id,
      });
      setExpenseStatus('added');
    } catch {
      setExpenseStatus('error');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const r = await generateSummary(tripId, place.id);
      if (r.place?.aiSummary) setAiSummary(r.place.aiSummary);
    } catch {
      /* leave the field as-is */
    } finally {
      setRegenerating(false);
    }
  }

  async function handleSave() {
    setSaveError(null);
    const parsedTime = parseTime(time);
    if (parsedTime === undefined) {
      setSaveError('Time must be HH:MM (24h).');
      return;
    }
    const patch: PlacePatch = {
      name: name.trim() || place.name,
      address: address.trim() || null,
      category,
      scheduledTime: parsedTime,
      cost: cost.trim() === '' ? null : inputToMinor(cost, currency),
      notes: notes.trim() || null,
      aiSummary: aiSummary.trim() || null,
      // Only move the pin when the user re-picked an address suggestion.
      ...(picked ? { lat: picked.lat, lng: picked.lng, googlePlaceId: picked.googlePlaceId } : {}),
    };
    setBusy(true);
    try {
      await api.places.update(tripId, place.id, patch);
      onSaved(place.id, patch);
    } catch {
      setBusy(false);
      setSaveError('Couldn’t save — please try again.');
    }
  }

  async function addPhoto() {
    setPhotoError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    const mime = asset.mimeType ?? 'image/jpeg';
    if (!mime.startsWith('image/')) return setPhotoError('Please choose an image file.');
    setPhotoBusy(true);
    try {
      const { photo } = await api.photos.upload(place.tripId, 'place', place.id, {
        uri: asset.uri,
        name: asset.fileName ?? asset.uri.split('/').pop() ?? 'photo.jpg',
        type: mime,
      });
      setPhotos((ps) => [...ps, { id: photo.id, width: photo.width, height: photo.height }]);
      onChanged?.();
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setPhotoError(UPLOAD_ERRORS[code] ?? 'Couldn’t upload — please try again.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto(photoId: string) {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      await api.photos.remove(photoId);
      setPhotos((ps) => ps.filter((p) => p.id !== photoId));
      onChanged?.();
    } catch {
      setPhotoError('Couldn’t remove the photo.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function addLink() {
    const value = linkUrl.trim();
    if (!isHttpUrl(value) || disabled) return;
    setLinkBusy(true);
    try {
      // Best-effort OG preview for a title + thumbnail (optional).
      let title: string | null = null;
      let thumbnail: string | null = null;
      try {
        const preview = await api.journal.linkPreview(tripId, value);
        title = preview.title ?? null;
        thumbnail = preview.thumbnailPath ?? null;
      } catch {
        /* preview optional */
      }
      const { link } = await addPlaceLink(tripId, { placeId: place.id, url: value, title, thumbnail });
      setLinks((ls) => [{ id: link.id, url: value, title, thumbnail }, ...ls]);
      setLinkUrl('');
      onChanged?.();
    } catch {
      /* surfaced by the parent reload */
    } finally {
      setLinkBusy(false);
    }
  }

  async function removeLink(id: string) {
    setLinkBusy(true);
    try {
      await api.journal.deleteLink(tripId, id);
      setLinks((ls) => ls.filter((l) => l.id !== id));
      onChanged?.();
    } catch {
      /* ignore */
    } finally {
      setLinkBusy(false);
    }
  }

  const photoDisabled = photoBusy || busy || disabled;
  const expenseDisabled = disabled || busy || inputToMinor(cost, currency) == null || expenseStatus === 'added';

  return (
    <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
      <View style={styles.handle} />
      <Text style={styles.title} numberOfLines={1}>
        {place.name}
      </Text>

      {saveError ? (
        <Text accessibilityRole="alert" style={styles.errorBox}>
          {saveError}
        </Text>
      ) : null}

      <Field label="Name" value={name} onChangeText={setName} editable={!busy && !disabled} />

      <View>
        <Field
          label="Address"
          value={address}
          onChangeText={handleAddressChange}
          editable={!busy && !disabled}
          placeholder="Search or type an address"
          autoCapitalize="words"
          autoCorrect={false}
          style={{ paddingRight: 38 }}
        />
        {address && !disabled ? (
          <Pressable accessibilityLabel="Clear address" hitSlop={6} onPress={handleAddressClear} style={styles.clearBtn}>
            <X size={16} color={colors.faint} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.hint}>Search and pick a suggestion to fix this place&apos;s map pin.</Text>

      {predictions.length > 0 ? (
        <View style={styles.suggestions}>
          {predictions.map((p, i) => (
            <Pressable
              key={p.placeId}
              disabled={busy || disabled}
              onPress={() => void handlePick(p.placeId)}
              style={({ pressed }) => [
                styles.suggestion,
                i < predictions.length - 1 && styles.suggestionDivider,
                pressed && { backgroundColor: colors.surface },
              ]}
            >
              <Text style={styles.suggestionText}>{p.description}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Select label="Category" value={category} options={CATEGORY_OPTIONS} onChange={setCategory} disabled={busy || disabled} />

      <View style={styles.inlineFieldRow}>
        <View style={{ flex: 1 }}>
          <Field
            label="Time"
            value={time}
            onChangeText={setTime}
            editable={!busy && !disabled}
            placeholder="HH:MM"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />
        </View>
        {time ? (
          <Pressable
            disabled={busy || disabled}
            onPress={() => setTime('')}
            style={[styles.clearTimeBtn, (busy || disabled) && { opacity: 0.4 }]}
          >
            <Text style={styles.clearTimeText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.inlineFieldRow}>
        <Text style={styles.currencyPrefix}>{currency}</Text>
        <View style={{ flex: 1 }}>
          <Field
            label="Cost"
            value={cost}
            onChangeText={(v) => {
              setCost(v);
              setExpenseStatus('idle');
            }}
            editable={!busy && !disabled}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        </View>
      </View>
      <Pressable
        disabled={expenseDisabled}
        onPress={() => void handleAddExpense()}
        style={[styles.expenseBtn, expenseDisabled && styles.expenseBtnDisabled]}
      >
        <Text style={[styles.expenseText, expenseDisabled && { color: colors.faint }]}>
          {expenseStatus === 'added' ? 'Added to budget ✓' : 'Add as expense'}
        </Text>
      </Pressable>
      {expenseStatus === 'error' ? <Text style={styles.errorText}>Couldn’t save — please try again.</Text> : null}

      <View style={styles.aboutHeader}>
        <Text style={styles.label}>About</Text>
        <Pressable disabled={disabled || regenerating} onPress={() => void handleRegenerate()} hitSlop={6}>
          <Text style={[styles.regenText, (disabled || regenerating) && { color: colors.faint }]}>
            {regenerating ? 'Generating…' : 'Regenerate'}
          </Text>
        </Pressable>
      </View>
      <Field value={aiSummary} onChangeText={setAiSummary} editable={!busy && !disabled} multiline />

      <Field label="Notes" value={notes} onChangeText={setNotes} editable={!busy && !disabled} multiline />

      <View style={styles.photoSection}>
        <Text style={styles.label}>Photos</Text>
        {photoError ? <Text style={styles.errorText}>{photoError}</Text> : null}
        {disabled ? <Text style={styles.hint}>Connect to add photos</Text> : null}
        <View style={styles.thumbWrap}>
          {photos.map((p, i) => (
            <View key={p.id} style={styles.thumbItem}>
              <Pressable
                accessibilityLabel={`Photo of ${place.name}`}
                onPress={() => setViewerIndex(i)}
                style={({ pressed }) => [pressed && { opacity: 0.85 }]}
              >
                <Image source={{ uri: photoUrl.personal(p.id, 'thumb') }} style={styles.thumb} />
              </Pressable>
              <Pressable
                accessibilityLabel="Delete photo"
                style={styles.thumbDelete}
                hitSlop={6}
                disabled={photoDisabled}
                onPress={() => void removePhoto(p.id)}
              >
                <Text style={styles.thumbDeleteText}>✕</Text>
              </Pressable>
            </View>
          ))}
          <Pressable
            style={[styles.addPhoto, photoDisabled && { opacity: 0.4 }]}
            disabled={photoDisabled}
            onPress={() => void addPhoto()}
          >
            <Text style={styles.addPhotoPlus}>＋</Text>
            <Text style={styles.addPhotoText}>{photoBusy ? '…' : 'Add photo'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Full-screen viewer (web PhotoGallery: dark scrim, object-contain /full image,
          ‹ / › when >1 photo, "Close photo"; tap outside the image closes). */}
      <Modal
        visible={viewerPhoto != null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerIndex(null)}
      >
        <Pressable
          accessibilityLabel={`Photo of ${place.name}`}
          style={styles.viewerScrim}
          onPress={() => setViewerIndex(null)}
        >
          {viewerPhoto ? (
            // Noop pressable so tapping the photo itself doesn't dismiss (web parity).
            <Pressable onPress={() => {}} style={styles.viewerImageWrap}>
              <Image
                source={{ uri: photoUrl.personal(viewerPhoto.id, 'full') }}
                style={styles.viewerImage}
                resizeMode="contain"
              />
            </Pressable>
          ) : null}
          <View style={styles.viewerControls}>
            {photos.length > 1 ? (
              <>
                <Pressable
                  accessibilityLabel="Previous photo"
                  onPress={prevPhoto}
                  style={({ pressed }) => [styles.viewerBtn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.viewerBtnText}>‹</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Next photo"
                  onPress={nextPhoto}
                  style={({ pressed }) => [styles.viewerBtn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.viewerBtnText}>›</Text>
                </Pressable>
              </>
            ) : null}
            <Pressable
              accessibilityLabel="Close photo"
              onPress={() => setViewerIndex(null)}
              style={({ pressed }) => [styles.viewerBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.viewerBtnText}>Close photo</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <View style={styles.linksSection}>
        <Text style={styles.label}>Travel guides</Text>
        {links.map((l) => (
          <View key={l.id} style={styles.linkRow}>
            {l.thumbnail != null ? (
              <Image source={{ uri: photoUrl.linkThumb(l.id) }} style={styles.linkThumb} />
            ) : null}
            <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => void Linking.openURL(l.url)}>
              <Text style={styles.linkTitle} numberOfLines={1}>
                {l.title ?? l.url}
              </Text>
            </Pressable>
            <Pressable disabled={disabled || linkBusy} onPress={() => void removeLink(l.id)} hitSlop={6}>
              <Text style={[styles.linkDelete, (disabled || linkBusy) && { opacity: 0.4 }]}>Delete</Text>
            </Pressable>
          </View>
        ))}
        <View style={styles.linkAddRow}>
          <View style={{ flex: 1 }}>
            <Field
              accessibilityLabel="Add a guide link"
              value={linkUrl}
              onChangeText={setLinkUrl}
              editable={!disabled && !linkBusy}
              placeholder="Paste a URL"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>
          <Pressable
            disabled={disabled || linkBusy || !isHttpUrl(linkUrl)}
            onPress={() => void addLink()}
            style={[
              styles.linkAddBtn,
              (disabled || linkBusy || !isHttpUrl(linkUrl)) && styles.linkAddBtnDisabled,
            ]}
          >
            <Text
              style={[
                styles.linkAddText,
                (disabled || linkBusy || !isHttpUrl(linkUrl)) && { color: colors.faint },
              ]}
            >
              {linkBusy ? '…' : 'Add a guide link'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={() => void Linking.openURL(mapsHref)}
        style={({ pressed }) => [styles.mapsBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.mapsText}>Open in Google Maps</Text>
      </Pressable>

      {!online ? <OfflineHint /> : null}

      <View style={styles.actions}>
        <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} disabled={busy} />
        <Button title="Save" onPress={() => void handleSave()} busy={busy} disabled={disabled} style={{ flex: 1 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheetScroll: {
    maxHeight: '92%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  sheet: { padding: 18, paddingTop: 8, paddingBottom: 32 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 12 },
  title: { ...type.title, fontSize: 18, color: colors.ink },

  label: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
  hint: { marginTop: 5, fontFamily: font.medium, fontSize: 12, color: colors.sub },
  errorBox: {
    marginTop: 12,
    borderRadius: radius.control,
    backgroundColor: colors.orangeTint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: font.medium,
    fontSize: 12,
    color: colors.danger,
  },
  errorText: { marginTop: 6, fontFamily: font.medium, fontSize: 12, color: colors.danger },

  clearBtn: {
    position: 'absolute',
    right: 8,
    bottom: 9,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestions: { marginTop: 8, borderRadius: radius.control, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  suggestion: { paddingHorizontal: 12, paddingVertical: 10 },
  suggestionDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  suggestionText: { ...type.body, color: colors.ink },

  inlineFieldRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  clearTimeBtn: {
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  clearTimeText: { fontFamily: font.semibold, fontSize: 13, color: colors.sub },
  currencyPrefix: { fontFamily: font.medium, fontSize: 12, color: colors.sub, paddingBottom: 14 },

  expenseBtn: {
    marginTop: 8,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingVertical: 9,
    alignItems: 'center',
  },
  expenseBtnDisabled: { backgroundColor: colors.surface },
  expenseText: { fontFamily: font.semibold, fontSize: 13, color: colors.accent },

  aboutHeader: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  regenText: { fontFamily: font.semibold, fontSize: 13, color: colors.accent },

  photoSection: { marginTop: 16 },
  thumbWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  thumbItem: { position: 'relative' },
  thumb: { width: 80, height: 80, borderRadius: 10, backgroundColor: colors.surface },
  thumbDelete: {
    position: 'absolute',
    right: 3,
    top: 3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbDeleteText: { fontSize: 12, fontFamily: font.bold, color: colors.danger },
  addPhoto: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoPlus: { fontSize: 20, color: colors.sub },
  addPhotoText: { fontSize: 10.5, fontFamily: font.medium, color: colors.sub },

  // Web PhotoGallery viewer: rgb(0 0 0 / .85) scrim, contained image, white
  // chip buttons (rounded-chip px-4 py-2 text-label text-ink).
  viewerScrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  viewerImageWrap: { alignSelf: 'stretch', height: '70%' },
  viewerImage: { width: '100%', height: '100%', borderRadius: radius.card },
  viewerControls: { flexDirection: 'row', gap: 12, marginTop: 16 },
  viewerBtn: {
    borderRadius: radius.chip,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerBtnText: { ...type.label, color: colors.ink },

  linksSection: { marginTop: 16 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  linkThumb: { width: 28, height: 28, borderRadius: 4, backgroundColor: colors.surface },
  linkTitle: { fontFamily: font.semibold, fontSize: 12.5, color: colors.ink },
  linkDelete: { fontFamily: font.medium, fontSize: 12, color: colors.danger, paddingHorizontal: 4 },
  linkAddRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  linkAddBtn: {
    borderRadius: radius.control,
    backgroundColor: colors.orange,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  linkAddBtnDisabled: { backgroundColor: colors.surface },
  linkAddText: { fontFamily: font.semibold, fontSize: 13, color: colors.white },

  mapsBtn: { marginTop: 18, borderRadius: 12, backgroundColor: colors.accent, paddingVertical: 12, alignItems: 'center' },
  mapsText: { fontFamily: font.semibold, fontSize: 14, color: colors.white },

  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
});
