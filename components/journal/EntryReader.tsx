'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { PhotoGallery } from '@/components/plan/PhotoGallery';
import type { EntryDTO } from '@/app/api/trips/[tripId]/journal/route';

// react-markdown + remark/rehype plugins are ~45 KB and only render here (when
// an entry is opened), so split them into their own chunk instead of shipping
// them in the journal route's First Load JS. Client-only — the body is
// client-fetched, so there is nothing to server-render. (perf)
const Markdown = dynamic(() => import('@/components/journal/Markdown').then((m) => m.Markdown), {
  ssr: false,
  loading: () => <p className="mt-2 text-body text-sub">…</p>,
});

type Props = {
  entry: EntryDTO;
  online: boolean;
  onEdit: () => void;
  onClose: () => void;
  /** Deletes this entry (owner closes the reader + reloads on success). */
  onDelete: () => Promise<void>;
};

/** Human weekday for an ISO date, e.g. "Friday". Empty string if unparseable. */
function weekday(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en', { weekday: 'long' }).format(d);
}

/** Full-bleed entry reader: title, date, sanitized markdown body, photo gallery. */
export function EntryReader({ entry, online, onEdit, onClose, onDelete }: Props) {
  const t = useTranslations('journal');
  const wd = entry.entryDate ? weekday(entry.entryDate) : '';
  // Two-tap delete (mirrors EntrySheet): first tap arms, second tap deletes.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setDeleteError(false);
    startTransition(async () => {
      try {
        await onDelete();
      } catch {
        setDeleteError(true);
        setConfirmingDelete(false);
      }
    });
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-24 pt-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="rounded-control border border-line bg-bg px-3 py-1.5 text-label text-ink hover:bg-surface active:opacity-70"
        >
          {t('back')}
        </button>
        <button
          type="button"
          disabled={!online}
          onClick={onEdit}
          className="px-3 py-1.5 text-label text-accent active:opacity-70 disabled:opacity-40"
        >
          {t('edit')}
        </button>
      </div>

      <h1 className="mt-5 text-title text-ink">{entry.title}</h1>
      {entry.entryDate ? (
        <p className="mt-1.5 text-caption tabular-nums text-faint">
          {entry.entryDate}{wd ? ` · ${wd}` : ''}
        </p>
      ) : null}

      {entry.body.trim() !== '' ? (
        <div className="mt-5 max-w-[65ch] leading-relaxed">
          <Markdown source={entry.body} />
        </div>
      ) : null}

      <PhotoGallery
        photos={entry.photos.map((p) => ({ id: p.id, width: p.width, height: p.height }))}
        placeName={entry.title}
        disabled
        onDelete={() => {}}
      />

      {deleteError ? (
        <p role="alert" className="mt-6 rounded-control bg-danger/10 px-3 py-2 text-caption text-danger">
          {t('mutationFailed')}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!online || isPending}
        onClick={handleDelete}
        className={`mt-6 w-full rounded-control px-4 py-2.5 text-label transition active:opacity-80 disabled:bg-surface disabled:text-faint ${
          confirmingDelete ? 'bg-danger text-white' : 'text-danger'
        }`}
      >
        {confirmingDelete ? t('confirmDelete') : t('delete')}
      </button>
    </main>
  );
}
