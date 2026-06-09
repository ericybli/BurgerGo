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
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-[3px]"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full rounded-t-sheet bg-bg p-[18px] pb-8 shadow-sheet"
      >
        <div className="mx-auto mb-3.5 h-1 w-10 rounded-chip bg-line" aria-hidden="true" />
        <h2 className="text-[18px] font-bold tracking-[-0.01em] text-ink">{title}</h2>
        <input
          type="text"
          aria-label={t('namePlaceholder')}
          placeholder={t('namePlaceholder')}
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          className="mt-4 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)]"
        />
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-[12px] border border-line bg-bg px-4 py-3 text-[14px] font-semibold text-ink transition hover:bg-surface active:opacity-70"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={name.trim().length === 0}
            className="flex-1 rounded-[12px] bg-orange px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-orange-press active:bg-orange-press active:scale-[0.98] disabled:bg-surface disabled:text-faint"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
