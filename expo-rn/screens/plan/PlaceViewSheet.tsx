import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import { photoUrl, type Place } from '../../lib/api';
import { colors, font, glyph, radius, type } from '../../lib/theme';
import { placeUrl } from '../../lib/googleMapsUrl';
import { thumbForPlace } from '../../lib/legView';
import { categoryLabel } from './planShared';

/** Long-text block with Show more / Show less (collapsed ≈6 lines, >400 chars). */
function Collapsible({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 400;
  return (
    <View>
      <Text style={styles.body} numberOfLines={!open && long ? 6 : undefined}>
        {text}
      </Text>
      {long ? (
        <Pressable onPress={() => setOpen((v) => !v)} hitSlop={6}>
          <Text style={styles.showMore}>{open ? 'Show less' : 'Show more'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Read view for a place (web PlaceReadCard) — works offline. Glyph box only
 * when there's no photo; micro-uppercase "About" / "Notes" / "Travel guides"
 * sections; accent "Open in Maps" + outline Edit; saved-bucket places get a
 * full-width orange "Add to day".
 */
export function PlaceViewSheet({
  place,
  online,
  onClose,
  onEdit,
  onAddToDay,
}: {
  place: Place;
  online: boolean;
  onClose: () => void;
  onEdit: () => void;
  /** Saved-bucket places only: schedule onto a day (opens the day picker). */
  onAddToDay?: () => void;
}) {
  const thumb = thumbForPlace(place, 'full');
  const mapsHref = placeUrl({
    name: place.name,
    lat: place.lat ?? 0,
    lng: place.lng ?? 0,
    googlePlaceId: place.googlePlaceId,
    address: place.address,
  });

  return (
    <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
      <View style={styles.handle} />
      <View style={styles.head}>
        {!thumb ? (
          <View style={styles.glyphBox}>
            <Text style={styles.glyphBoxText}>{glyph(place.category)}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>
            {place.name}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {categoryLabel(place.category)}
            {place.address ? ` · ${place.address}` : ''}
          </Text>
        </View>
        <Pressable accessibilityLabel="Close" hitSlop={6} onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      {thumb ? <Image source={{ uri: thumb }} style={styles.hero} resizeMode="cover" /> : null}

      {place.aiSummary ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ABOUT</Text>
          <Collapsible text={place.aiSummary} />
        </View>
      ) : null}

      {place.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOTES</Text>
          <Collapsible text={place.notes} />
        </View>
      ) : null}

      {place.links.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TRAVEL GUIDES</Text>
          {place.links.map((l) => (
            <Pressable
              key={l.id}
              style={({ pressed }) => [styles.linkRow, pressed && { backgroundColor: colors.surface }]}
              onPress={() => void Linking.openURL(l.url)}
            >
              {l.thumbnail != null ? <Image source={{ uri: photoUrl.linkThumb(l.id) }} style={styles.linkThumb} /> : null}
              <Text style={styles.linkText} numberOfLines={1}>
                {l.title ?? l.url}
              </Text>
              <ExternalLink size={13} color={colors.accent} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={() => void Linking.openURL(mapsHref)}
          style={({ pressed }) => [styles.mapsBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.mapsText}>Open in Google Maps</Text>
        </Pressable>
        <Pressable
          disabled={!online}
          onPress={onEdit}
          style={({ pressed }) => [styles.editBtn, !online && { opacity: 0.4 }, pressed && { backgroundColor: colors.surface }]}
        >
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      </View>

      {onAddToDay ? (
        <Pressable
          disabled={!online}
          onPress={onAddToDay}
          style={({ pressed }) => [
            styles.addToDay,
            pressed && online && { backgroundColor: colors.orangePress },
            !online && styles.addToDayDisabled,
          ]}
        >
          <Text style={[styles.addToDayText, !online && { color: colors.faint }]}>Add to day</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheetScroll: {
    maxHeight: '88%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  sheet: { padding: 18, paddingTop: 8, paddingBottom: 32 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 12 },

  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  glyphBox: {
    width: 48,
    height: 48,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphBoxText: { fontSize: 24 },
  title: { ...type.title, fontSize: 18, color: colors.ink },
  sub: { marginTop: 2, fontFamily: font.medium, fontSize: 12, color: colors.sub },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 14, color: colors.sub },

  hero: { marginTop: 12, width: '100%', height: 165, borderRadius: 14, backgroundColor: colors.surface },

  section: { marginTop: 14 },
  sectionLabel: { ...type.micro, color: colors.faint, marginBottom: 6 },
  body: { ...type.body, color: colors.ink },
  showMore: { marginTop: 4, fontFamily: font.semibold, fontSize: 12.5, color: colors.accent },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 8,
  },
  linkThumb: { width: 32, height: 32, borderRadius: 4, backgroundColor: colors.surface },
  linkText: { flex: 1, minWidth: 0, fontFamily: font.semibold, fontSize: 12.5, color: colors.ink },

  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  mapsBtn: { flex: 1, borderRadius: 12, backgroundColor: colors.accent, paddingVertical: 12, alignItems: 'center' },
  mapsText: { fontFamily: font.semibold, fontSize: 14, color: colors.white },
  editBtn: {
    width: 76,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editText: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },

  addToDay: { marginTop: 8, borderRadius: 12, backgroundColor: colors.orange, paddingVertical: 12, alignItems: 'center' },
  addToDayDisabled: { backgroundColor: colors.surface },
  addToDayText: { fontFamily: font.semibold, fontSize: 14, color: colors.white },
});
