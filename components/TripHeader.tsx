'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronLeft, Sparkles } from 'lucide-react';
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
    <header className="flex items-center gap-3 px-4 py-2.5">
      <Link
        href="/"
        aria-label={t('trip.back')}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-surface text-ink transition hover:bg-line active:scale-95"
      >
        <ChevronLeft size={19} strokeWidth={2.2} aria-hidden="true" />
      </Link>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setRenameOpen(true)}
          className="block max-w-full truncate rounded-control text-left text-title text-ink transition active:scale-[0.99]"
        >
          {name}
        </button>
        <p className="truncate text-caption text-sub [font-variant-numeric:tabular-nums]">
          {dateSubtitle}
        </p>
      </div>

      <button
        type="button"
        aria-label={t('aiImport.openAria')}
        onClick={() => setAiOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-accent-tint text-accent transition hover:bg-line active:scale-95"
      >
        <Sparkles size={18} strokeWidth={2} aria-hidden="true" />
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
