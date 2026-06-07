'use client';

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
  loading: () => <p className="mt-2 text-body text-ink-muted">…</p>,
});

type Props = {
  entry: EntryDTO;
  online: boolean;
  onEdit: () => void;
  onClose: () => void;
};

/** Human weekday for an ISO date, e.g. "Friday". Empty string if unparseable. */
function weekday(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en', { weekday: 'long' }).format(d);
}

/** Full-bleed entry reader: title, date, sanitized markdown body, photo gallery. */
export function EntryReader({ entry, online, onEdit, onClose }: Props) {
  const t = useTranslations('journal');
  const wd = entry.entryDate ? weekday(entry.entryDate) : '';

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-24 pt-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="rounded-control bg-paper px-3 py-1.5 text-caption font-medium text-ink shadow-inset"
        >
          {t('back')}
        </button>
        <button
          type="button"
          disabled={!online}
          onClick={onEdit}
          className="rounded-control bg-coral px-4 py-1.5 text-caption font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
        >
          {t('edit')}
        </button>
      </div>

      <h1 className="mt-4 text-heading font-semibold text-ink">{entry.title}</h1>
      {entry.entryDate ? (
        <p className="mt-1 text-caption text-ink-muted">
          {entry.entryDate}{wd ? ` · ${wd}` : ''}
        </p>
      ) : null}

      {entry.body.trim() !== '' ? (
        <div className="mt-4">
          <Markdown source={entry.body} />
        </div>
      ) : null}

      <PhotoGallery
        photos={entry.photos.map((p) => ({ id: p.id, width: p.width, height: p.height }))}
        placeName={entry.title}
        disabled
        onDelete={() => {}}
      />
    </main>
  );
}
