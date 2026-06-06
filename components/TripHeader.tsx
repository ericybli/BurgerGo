'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { RenameSheet } from '@/components/RenameSheet';

type TripHeaderProps = {
  tripId: string;
  name: string;
  dateSubtitle: string;
};

export function TripHeader({ tripId, name, dateSubtitle }: TripHeaderProps) {
  const t = useTranslations();
  const [renameOpen, setRenameOpen] = useState(false);

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

      <RenameSheet
        open={renameOpen}
        tripId={tripId}
        currentName={name}
        onClose={() => setRenameOpen(false)}
      />
    </header>
  );
}
