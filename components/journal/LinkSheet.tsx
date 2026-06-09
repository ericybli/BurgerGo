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
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
      >
        <div className="mx-auto mt-2 mb-1 h-1 w-9 rounded-chip bg-line" aria-hidden="true" />
        <h2 className="mb-3 font-serif text-title font-semibold text-ink">
          {isEdit ? t('editLink') : t('addLink')}
        </h2>

        {error ? (
          <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
            {error}
          </p>
        ) : null}

        {disabled ? (
          <p className="mb-3 text-caption text-ink-muted">{t('offlineHint')}</p>
        ) : null}

        <label className="block text-label font-medium text-ink" htmlFor="link-url">
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
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink transition focus:border-coral focus:outline-none focus:shadow-[0_0_0_3px_var(--coral-tint)] disabled:opacity-60"
        />

        {previewing ? (
          <p className="mt-1 text-caption text-ink-muted">{t('previewFetching')}</p>
        ) : null}
        {previewFailed ? (
          <p className="mt-1 text-caption text-ink-muted">{t('previewFailed')}</p>
        ) : null}

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="link-title">
          {t('titleLabel')}
        </label>
        <input
          id="link-title"
          type="text"
          value={title}
          disabled={disabled}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink transition focus:border-coral focus:outline-none focus:shadow-[0_0_0_3px_var(--coral-tint)] disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="link-note">
          {t('noteLabel')}
        </label>
        <input
          id="link-note"
          type="text"
          value={note}
          disabled={disabled}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink transition focus:border-coral focus:outline-none focus:shadow-[0_0_0_3px_var(--coral-tint)] disabled:opacity-60"
        />

        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || isPending}
          className="mt-5 w-full rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card transition hover:bg-coral-press hover:shadow-lift active:scale-[0.98] active:bg-coral-press disabled:opacity-40"
        >
          {t('save')}
        </button>

        {isEdit ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={disabled || isPending}
            className="mt-2 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-red-600 shadow-inset transition hover:bg-line active:scale-[0.98] disabled:opacity-40"
          >
            {t('delete')}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset transition hover:bg-line active:scale-[0.98]"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
