'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { PhotoGallery } from '@/components/plan/PhotoGallery';
import { usePhotoUpload } from '@/components/plan/usePhotoUpload';
import { deletePhotoAction } from '@/app/_actions/photos';
import { deletePhotoListAction } from '@/app/_actions/photoLists';
import { PhotoListSheet } from '@/components/journal/PhotoListSheet';
import type { PhotoListDTO } from '@/app/api/trips/[tripId]/journal/route';

/**
 * Journal ▸ Photography: a collection of named lists, each holding reference
 * photos ("how to shoot here" inspiration). Reuses the shared photo pipeline
 * (upload/serve/delete) via owner_type='photo_list', and PhotoGallery for the
 * thumbnail grid + full-screen viewer.
 */
export function PhotographyTab({
  tripId,
  lists,
  online,
  onChanged,
}: {
  tripId: string;
  lists: PhotoListDTO[];
  online: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations('journal');
  const [sheet, setSheet] = useState<{ open: boolean; list?: { id: string; name: string } }>({ open: false });
  const [sheetKey, setSheetKey] = useState(0);

  function openCreate() {
    setSheet({ open: true });
    setSheetKey((k) => k + 1);
  }
  function openRename(list: PhotoListDTO) {
    setSheet({ open: true, list: { id: list.id, name: list.name } });
    setSheetKey((k) => k + 1);
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!online}
          onClick={openCreate}
          className="rounded-[10px] bg-orange px-3.5 py-2 text-label text-white hover:bg-orange-press active:bg-orange-press disabled:bg-surface disabled:text-faint"
        >
          {t('newPhotoList')}
        </button>
      </div>

      {lists.length === 0 ? (
        <EmptyState
          mascotAlt={t('photography')}
          headline={t('photoListsEmptyHeadline')}
          subtext={t('photoListsEmptySubtext')}
          actionLabel={online ? t('newPhotoList') : undefined}
          onAction={online ? openCreate : undefined}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {lists.map((list, i) => (
            <li key={list.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
              <PhotoListCard
                tripId={tripId}
                list={list}
                online={online}
                onChanged={onChanged}
                onRename={() => openRename(list)}
              />
            </li>
          ))}
        </ul>
      )}

      <PhotoListSheet
        key={`photo-list-sheet-${sheetKey}`}
        open={sheet.open}
        tripId={tripId}
        list={sheet.list}
        disabled={!online}
        onClose={() => setSheet({ open: false })}
        onSaved={onChanged}
      />
    </div>
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
  list: PhotoListDTO;
  online: boolean;
  onChanged: () => void;
  onRename: () => void;
}) {
  const t = useTranslations('journal');
  const { upload, uploading } = usePhotoUpload();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, startTransition] = useTransition();

  async function handleAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow re-picking the same files
    if (files.length === 0) return;
    setError(null);
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError(t('photoNotImage'));
        continue;
      }
      const { photo, errorCode } = await upload({ file, tripId, ownerId: list.id, ownerType: 'photo_list' });
      if (!photo) {
        if (errorCode === 'too_large') setError(t('photoTooLarge'));
        else if (errorCode === 'too_many') setError(t('photoTooMany'));
        else setError(t('photoUploadFailed'));
        break; // stop on the first failure (e.g. the per-list cap)
      }
    }
    onChanged();
  }

  function handleDeletePhoto(photoId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await deletePhotoAction(photoId);
        onChanged();
      } catch {
        setError(t('photoUploadFailed'));
      }
    });
  }

  function handleDeleteList() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startTransition(async () => {
      try {
        await deletePhotoListAction(tripId, list.id);
        onChanged();
      } catch {
        setError(t('mutationFailed'));
        setConfirmDelete(false);
      }
    });
  }

  const addDisabled = !online || uploading;

  return (
    <div className="rounded-[14px] border border-line bg-bg p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-ink">{list.name}</h3>
          <p className="mt-0.5 text-caption tabular-nums text-faint">
            {t('photoCount', { count: list.photos.length })}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            disabled={!online}
            onClick={onRename}
            aria-label={t('renameList')}
            className="flex h-8 w-8 items-center justify-center rounded-chip bg-surface text-ink transition hover:bg-line active:scale-95 disabled:opacity-40"
          >
            <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!online}
            onClick={handleDeleteList}
            aria-label={t('deleteList')}
            className={`flex h-8 w-8 items-center justify-center rounded-chip transition active:scale-95 disabled:opacity-40 ${confirmDelete ? 'bg-danger text-white' : 'bg-surface text-ink hover:bg-line'}`}
          >
            <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
      {confirmDelete ? <p className="mt-1 text-caption text-danger">{t('confirmDeleteList')}</p> : null}

      <PhotoGallery photos={list.photos} placeName={list.name} disabled={!online} onDelete={handleDeletePhoto} />
      {list.photos.length === 0 ? (
        <p className="mt-3 text-caption text-faint">{t('photoListEmpty')}</p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 rounded-control bg-danger/10 px-3 py-2 text-caption text-danger">
          {error}
        </p>
      ) : null}

      <label
        className={`mt-3 inline-flex cursor-pointer items-center justify-center rounded-control border border-line bg-bg px-3.5 py-2 text-label text-accent transition hover:bg-accent-tint active:opacity-70 ${addDisabled ? 'pointer-events-none opacity-40' : ''}`}
      >
        {uploading ? t('uploadingPhoto') : t('addPhotos')}
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={addDisabled}
          onChange={handleAddPhotos}
          className="sr-only"
        />
      </label>
      {!online ? <p className="mt-1 text-caption text-faint">{t('addPhotoOffline')}</p> : null}
    </div>
  );
}
