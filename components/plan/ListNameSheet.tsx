'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Name-input sheet for creating or renaming a saved list. Stateless about which
 * mode it is — the host passes the title + submit label and keys the component
 * so its input resets on each open.
 */
export function ListNameSheet({
  open,
  title,
  submitLabel,
  initialName = '',
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  submitLabel: string;
  initialName?: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('savedLists');
  const [name, setName] = useState(initialName);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full rounded-t-sheet bg-card p-6 shadow-lift"
      >
        <h2 className="text-title font-bold text-ink">{title}</h2>
        <input
          type="text"
          aria-label={t('namePlaceholder')}
          placeholder={t('namePlaceholder')}
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          className="mt-4 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink"
        />
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={name.trim().length === 0}
            className="flex-1 rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
