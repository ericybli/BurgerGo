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
      className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      tabIndex={-1}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
      >
        <h2 className="text-title font-bold text-ink">{t('exportTitle')}</h2>
        <textarea
          readOnly
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-3 h-64 w-full whitespace-pre rounded-control border border-line bg-paper px-3 py-2 text-caption text-ink [font-variant-numeric:tabular-nums]"
        />
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={copy}
            className="flex-1 rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card active:bg-coral-press"
          >
            {copied ? t('copied') : t('copy')}
          </button>
        </div>
      </div>
    </div>
  );
}
