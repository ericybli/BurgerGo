/**
 * Journal ▸ Photography tab, ported from
 * components/journal/PhotographyTab.tsx. Named lists of reference shots
 * (owner_type 'photo_list'): each card shows name + tabular photo count,
 * 32×32 Pencil (rename) / Trash2 (two-tap delete — armed turns the chip
 * danger + shows "Tap again to delete this list and its photos") chips, the
 * shared 80×80 gallery with single-tap ✕ photo delete, and a multi-select
 * "Add photos" picker that uploads sequentially and stops at the first
 * failure. Offline disables every mutation.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { api, type PhotoList } from '../../lib/api';
import { colors, font, radius, type } from '../../lib/theme';
import { EmptyState, Sheet, SheetPanel } from '../../components/ui';
import { ErrorBanner, OutlineAccentButton, SmallPrimaryButton } from './formBits';
import { PhotoGallery } from './PhotoGallery';
import { pickImages, uploadErrorMessage } from './photoUpload';
import { PhotoListSheet } from './PhotoListSheet';
import { STR, photoCountLabel } from './strings';

export function PhotographyTab({
  tripId,
  lists,
  online,
  onChanged,
}: {
  tripId: string;
  lists: PhotoList[];
  online: boolean;
  onChanged: () => void;
}) {
  // Conditional render inside <Sheet> → fresh state on every open (key-remount).
  const [sheet, setSheet] = useState<{ list: { id: string; name: string } | null } | null>(null);

  return (
    <View style={pt.wrap}>
      <View style={pt.actionRow}>
        <SmallPrimaryButton
          title={STR.newPhotoList}
          disabled={!online}
          onPress={() => setSheet({ list: null })}
        />
      </View>

      {lists.length === 0 ? (
        <EmptyState
          headline={STR.photoListsEmptyHeadline}
          subtext={STR.photoListsEmptySubtext}
          action={
            online ? (
              <SmallPrimaryButton title={STR.newPhotoList} onPress={() => setSheet({ list: null })} />
            ) : undefined
          }
        />
      ) : (
        lists.map((list) => (
          <PhotoListCard
            key={list.id}
            tripId={tripId}
            list={list}
            online={online}
            onChanged={onChanged}
            onRename={() => setSheet({ list: { id: list.id, name: list.name } })}
          />
        ))
      )}

      <Sheet visible={sheet !== null} onClose={() => setSheet(null)}>
        {sheet ? (
          <SheetPanel title={sheet.list ? STR.renameList : STR.newPhotoList}>
            <PhotoListSheet
              key={sheet.list?.id ?? 'new-photo-list'}
              tripId={tripId}
              list={sheet.list}
              online={online}
              onClose={() => setSheet(null)}
              onSaved={onChanged}
            />
          </SheetPanel>
        ) : null}
      </Sheet>
    </View>
  );
}

function PhotoListCard({
  tripId,
  list,
  online,
  onChanged,
  onRename,
}: {
  tripId: string;
  list: PhotoList;
  online: boolean;
  onChanged: () => void;
  onRename: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);

  async function addPhotos() {
    setError(null);
    const files = await pickImages(true);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          setError(STR.photoNotImage);
          continue;
        }
        try {
          await api.photos.upload(tripId, 'photo_list', list.id, file);
        } catch (e) {
          setError(uploadErrorMessage(e));
          break; // stop on the first failure (e.g. the per-list cap)
        }
      }
    } finally {
      setUploading(false);
      onChanged();
    }
  }

  async function deletePhoto(photoId: string) {
    setError(null);
    try {
      await api.photos.remove(photoId);
      onChanged();
    } catch {
      setError(STR.photoUploadFailed);
    }
  }

  async function deleteList() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setPending(true);
    try {
      await api.photoLists.remove(tripId, list.id);
      onChanged();
    } catch {
      setError(STR.mutationFailed);
      setArmed(false);
      setPending(false);
    }
  }

  const addDisabled = !online || uploading;
  const iconDisabled = !online || pending;

  return (
    <View style={pt.card}>
      <View style={pt.cardHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={pt.cardName} numberOfLines={1}>
            {list.name}
          </Text>
          <Text style={pt.cardCount}>{photoCountLabel(list.photos.length)}</Text>
        </View>
        <View style={pt.chipRow}>
          <Pressable
            disabled={iconDisabled}
            onPress={onRename}
            accessibilityLabel={STR.renameList}
            hitSlop={4}
            style={({ pressed }) => [
              pt.iconChip,
              pressed && { backgroundColor: colors.line },
              iconDisabled && { opacity: 0.4 },
            ]}
          >
            <Pencil size={16} strokeWidth={1.75} color={colors.ink} />
          </Pressable>
          <Pressable
            disabled={iconDisabled}
            onPress={deleteList}
            accessibilityLabel={STR.deleteList}
            hitSlop={4}
            style={({ pressed }) => [
              pt.iconChip,
              armed && pt.iconChipArmed,
              pressed && !armed && { backgroundColor: colors.line },
              iconDisabled && { opacity: 0.4 },
            ]}
          >
            <Trash2 size={16} strokeWidth={1.75} color={armed ? colors.white : colors.ink} />
          </Pressable>
        </View>
      </View>
      {armed ? <Text style={pt.armedCaption}>{STR.confirmDeleteList}</Text> : null}

      <PhotoGallery photos={list.photos} onDelete={deletePhoto} deleteDisabled={!online} />
      {list.photos.length === 0 ? <Text style={pt.emptyCaption}>{STR.photoListEmpty}</Text> : null}

      {error ? <ErrorBanner text={error} style={{ marginTop: 8 }} /> : null}

      <View style={{ marginTop: 12 }}>
        <OutlineAccentButton
          title={uploading ? STR.uploadingPhoto : STR.addPhotos}
          onPress={addPhotos}
          disabled={addDisabled}
        />
      </View>
      {!online ? <Text style={pt.emptyCaption}>{STR.addPhotoOffline}</Text> : null}
    </View>
  );
}

const pt = StyleSheet.create({
  wrap: { gap: 12 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end' },

  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardName: { fontSize: 15, lineHeight: 20, fontFamily: font.semibold, color: colors.ink },
  cardCount: {
    marginTop: 2,
    ...type.caption,
    color: colors.faint,
    fontVariant: ['tabular-nums'],
  },
  chipRow: { flexDirection: 'row', gap: 4 },
  iconChip: {
    width: 32,
    height: 32,
    borderRadius: radius.chip,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipArmed: { backgroundColor: colors.danger },
  armedCaption: { marginTop: 4, ...type.caption, color: colors.danger },
  emptyCaption: { marginTop: 12, ...type.caption, color: colors.faint },
});
