/**
 * Shared photo grid + full-screen viewer, ported from the web's
 * components/plan/PhotoGallery.tsx. 80×80 thumb grid ("Photos" label); tap a
 * thumb → modal viewer on a black 0.85 scrim showing the `full` size with
 * wrap-around ‹ / › when >1 photo and a "Close photo" chip; tap outside
 * closes. Per-photo ✕ delete (single tap, no confirm) renders only when
 * `onDelete` is provided — the entry reader passes none (read-only).
 */
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { photoUrl, type JournalPhoto } from '../../lib/api';
import { colors, font, radius, type } from '../../lib/theme';
import { STR } from './strings';

export function PhotoGallery({
  photos,
  onDelete,
  deleteDisabled,
}: {
  photos: JournalPhoto[];
  /** Omit for a read-only gallery (delete buttons hidden). */
  onDelete?: (photoId: string) => void;
  /** Offline → true (mutations are online-only). */
  deleteDisabled?: boolean;
}) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  const open = viewerIndex != null ? (photos[viewerIndex] ?? null) : null;
  const close = () => setViewerIndex(null);
  const prev = () =>
    setViewerIndex((i) => (i == null ? i : (i - 1 + photos.length) % photos.length));
  const next = () => setViewerIndex((i) => (i == null ? i : (i + 1) % photos.length));

  return (
    <View style={pg.wrap}>
      <Text style={pg.label}>{STR.photosLabel}</Text>
      <View style={pg.grid}>
        {photos.map((p, i) => (
          <View key={p.id} style={pg.cell}>
            <Pressable
              onPress={() => setViewerIndex(i)}
              style={({ pressed }) => [pg.thumbBtn, pressed && { opacity: 0.85 }]}
            >
              <Image source={{ uri: photoUrl.personal(p.id, 'thumb') }} style={pg.thumbImg} />
            </Pressable>
            {onDelete ? (
              <Pressable
                hitSlop={6}
                disabled={deleteDisabled}
                onPress={() => onDelete(p.id)}
                accessibilityLabel="Delete photo"
                style={[pg.deleteBtn, deleteDisabled && { opacity: 0.4 }]}
              >
                <Text style={pg.deleteText}>✕</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>

      <Modal visible={open !== null} transparent animationType="fade" onRequestClose={close}>
        {open ? (
          <View style={pg.viewerRoot}>
            {/* Tap outside the photo closes the viewer. */}
            <Pressable style={StyleSheet.absoluteFill} onPress={close} />
            <Image
              source={{ uri: photoUrl.personal(open.id, 'full') }}
              style={pg.viewerImg}
              resizeMode="contain"
            />
            <View style={pg.viewerControls}>
              {photos.length > 1 ? (
                <>
                  <Pressable
                    style={({ pressed }) => [pg.viewerChip, pressed && pg.viewerChipPressed]}
                    onPress={prev}
                    accessibilityLabel="Previous photo"
                  >
                    <Text style={pg.viewerChipText}>‹</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [pg.viewerChip, pressed && pg.viewerChipPressed]}
                    onPress={next}
                    accessibilityLabel="Next photo"
                  >
                    <Text style={pg.viewerChipText}>›</Text>
                  </Pressable>
                </>
              ) : null}
              <Pressable
                style={({ pressed }) => [pg.viewerChip, pressed && pg.viewerChipPressed]}
                onPress={close}
              >
                <Text style={pg.viewerChipText}>{STR.closePhoto}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const pg = StyleSheet.create({
  wrap: { marginTop: 12 },
  label: { ...type.label, color: colors.ink },
  grid: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { position: 'relative' },
  thumbBtn: {
    width: 80,
    height: 80,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  deleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { fontSize: 12, fontFamily: font.bold, color: colors.danger },

  viewerRoot: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  viewerImg: { width: '100%', height: '75%', borderRadius: radius.card },
  viewerControls: { marginTop: 16, flexDirection: 'row', gap: 12 },
  viewerChip: {
    backgroundColor: colors.white,
    borderRadius: radius.chip,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  viewerChipText: { ...type.label, color: colors.ink },
  // Web parity: active:scale-95 on the viewer chips.
  viewerChipPressed: { transform: [{ scale: 0.95 }] },
});
