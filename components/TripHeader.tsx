'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { RenameSheet } from '@/components/RenameSheet';
import { AiImportSheet } from '@/components/ai/AiImportSheet';

type TripHeaderProps = {
  tripId: string;
  name: string;
  dateSubtitle: string;
};

export function TripHeader({ tripId, name, dateSubtitle }: TripHeaderProps) {
  const t = useTranslations();
  const [renameOpen, setRenameOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <header className="flex items-center gap-2 px-2 py-3">
      <Link
        href="/"
        aria-label={t('trip.back')}
        className="flex h-11 w-11 items-center justify-center rounded-chip text-ink"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setRenameOpen(true)}
          className="block max-w-full truncate text-left text-title font-bold text-ink"
        >
          {name}
        </button>
        <p className="truncate text-caption text-ink-muted [font-variant-numeric:tabular-nums]">
          {dateSubtitle}
        </p>
      </div>

      <button
        type="button"
        aria-label={t('aiImport.openAria')}
        onClick={() => setAiOpen(true)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-chip text-coral active:bg-line"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
          <path d="M5 3v4" />
          <path d="M19 17v4" />
          <path d="M3 5h4" />
          <path d="M17 19h4" />
        </svg>
      </button>

      <RenameSheet
        key={renameOpen ? tripId : 'closed'}
        open={renameOpen}
        tripId={tripId}
        currentName={name}
        onClose={() => setRenameOpen(false)}
      />
      <AiImportSheet
        key={aiOpen ? `ai-${tripId}` : 'ai-closed'}
        open={aiOpen}
        tripId={tripId}
        onClose={() => setAiOpen(false)}
      />
    </header>
  );
}
