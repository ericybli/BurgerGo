'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Shows a day's plain-text itinerary in a selectable textarea with a one-tap
 * Copy (clipboard). The textarea stays selectable so the text can be copied
 * manually if the clipboard API is unavailable.
 */
export function ExportDaySheet({ text, onClose }: { text: string; onClose: () => void }) {
  const t = useTranslations('plan');
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked → user can select the textarea and copy manually */
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('exportTitle')}
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-[3px]"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      tabIndex={-1}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-bg p-[18px] pb-8 shadow-sheet"
      >
        <div className="mx-auto mb-3.5 h-1 w-10 rounded-chip bg-line" aria-hidden="true" />
        <h2 className="text-[18px] font-bold tracking-[-0.01em] text-ink">{t('exportTitle')}</h2>
        <textarea
          readOnly
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-3 h-64 w-full whitespace-pre rounded-control border border-line bg-bg px-3 py-2.5 text-caption text-ink [font-variant-numeric:tabular-nums] transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)]"
        />
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-[12px] border border-line bg-bg px-4 py-3 text-[14px] font-semibold text-ink transition hover:bg-surface active:opacity-70"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={copy}
            className="flex-1 rounded-[12px] bg-orange px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-orange-press active:bg-orange-press active:scale-[0.98]"
          >
            {copied ? t('copied') : t('copy')}
          </button>
        </div>
      </div>
    </div>
  );
}
