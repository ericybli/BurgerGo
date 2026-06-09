'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { withBase } from '@/src/lib/basePath';
import { isHttpUrl } from '@/src/lib/linkPreview';
import {
  addLinkAction,
  updateLinkAction,
  deleteLinkAction,
} from '@/app/_actions/savedLinks';
import type { SavedLink } from '@/src/db/repos/savedLinks';

type Props = {
  open: boolean;
  tripId: string;
  /** Present → edit mode; absent → add mode. */
  link?: SavedLink;
  disabled: boolean; // offline → true
  onClose: () => void;
  onSaved: () => void;
};

export function LinkSheet({ open, tripId, link, disabled, onClose, onSaved }: Props) {
  const t = useTranslations('journal');
  const isEdit = !!link;
  const [url, setUrl] = useState(link?.url ?? '');
  const [title, setTitle] = useState(link?.title ?? '');
  const [note, setNote] = useState(link?.note ?? '');
  // Thumbnail path is preserved in edit mode; refreshed by a preview in add mode.
  const [thumbnail, setThumbnail] = useState<string | null>(link?.thumbnail ?? null);
  const [previewing, setPreviewing] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onClose();
  }

  async function handleUrlBlur() {
    // Preview only in add mode, online, with a valid http(s) URL.
    if (isEdit || disabled) return;
    const value = url.trim();
    if (!isHttpUrl(value)) return;
    setPreviewing(true);
    setPreviewFailed(false);
    try {
      const res = await fetch(withBase('/api/links/preview'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ url: value, tripId }),
      });
      const data = (await res.json()) as { title?: string; thumbnailPath?: string };
      if (data.title && title.trim() === '') setTitle(data.title);
      if (data.thumbnailPath) setThumbnail(data.thumbnailPath);
      if (!data.title && !data.thumbnailPath) setPreviewFailed(true);
    } catch {
      setPreviewFailed(true);
    } finally {
      setPreviewing(false);
    }
  }

  function handleSave() {
    setError(null);
    const value = url.trim();
    if (!isHttpUrl(value)) {
      setError(t('invalidUrl'));
      return;
    }
    const payload = {
      url: value,
      title: title.trim() === '' ? null : title.trim(),
      note: note.trim() === '' ? null : note.trim(),
      thumbnail,
    };
    startTransition(async () => {
      try {
        if (isEdit && link) {
          await updateLinkAction(link.id, payload);
        } else {
          await addLinkAction({ tripId, ...payload });
        }
        onSaved();
        onClose();
      } catch {
        setError(t('saveFailed'));
      }
    });
  }

  function handleDelete() {
    if (!link) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteLinkAction(link.id);
        onSaved();
        onClose();
      } catch {
        setError(t('mutationFailed'));
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? t('editLink') : t('addLink')}
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-[3px]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-bg p-[18px] pb-8 shadow-sheet"
      >
        <div className="mx-auto mb-3.5 h-1 w-10 rounded-chip bg-line" aria-hidden="true" />
        <h2 className="mb-3 text-[18px] font-bold tracking-[-0.01em] text-ink">
          {isEdit ? t('editLink') : t('addLink')}
        </h2>

        {error ? (
          <p role="alert" className="mb-3 rounded-control bg-danger/10 px-3 py-2 text-caption text-danger">
            {error}
          </p>
        ) : null}

        {disabled ? (
          <p className="mb-3 text-caption text-sub">{t('offlineHint')}</p>
        ) : null}

        <label className="block text-micro uppercase text-faint" htmlFor="link-url">
          {t('urlLabel')}
        </label>
        <input
          id="link-url"
          type="url"
          inputMode="url"
          value={url}
          disabled={disabled}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={handleUrlBlur}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        />

        {previewing ? (
          <p className="mt-1 text-caption text-faint">{t('previewFetching')}</p>
        ) : null}
        {previewFailed ? (
          <p className="mt-1 text-caption text-faint">{t('previewFailed')}</p>
        ) : null}

        <label className="mt-3 block text-micro uppercase text-faint" htmlFor="link-title">
          {t('titleLabel')}
        </label>
        <input
          id="link-title"
          type="text"
          value={title}
          disabled={disabled}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        />

        <label className="mt-3 block text-micro uppercase text-faint" htmlFor="link-note">
          {t('noteLabel')}
        </label>
        <input
          id="link-note"
          type="text"
          value={note}
          disabled={disabled}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        />

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled || isPending}
            className="flex-1 rounded-[12px] bg-orange py-3 text-[14px] font-semibold text-white hover:bg-orange-press active:bg-orange-press disabled:opacity-40"
          >
            {t('save')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-[90px] rounded-[12px] border border-line bg-bg py-3 text-[14px] font-semibold text-ink hover:bg-surface active:opacity-70"
          >
            {t('cancel')}
          </button>
        </div>

        {isEdit ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={disabled || isPending}
            className="mt-3 w-full rounded-control px-4 py-2.5 text-label text-danger active:opacity-70 disabled:opacity-40"
          >
            {t('delete')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
