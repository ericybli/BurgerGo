'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { withBase } from '@/src/lib/basePath';
import { personalPhotoUrl } from '@/src/lib/planUrl';
import { entrySnippet } from '@/src/lib/journalView';
import { EmptyState } from '@/components/EmptyState';
import { EntrySheet } from '@/components/journal/EntrySheet';
import { EntryReader } from '@/components/journal/EntryReader';
import type { EntryDTO } from '@/app/api/trips/[tripId]/journal/route';
import type { SavedLink } from '@/src/db/repos/savedLinks';

type Tab = 'entries' | 'links';
type JournalData = { entries: EntryDTO[]; links: SavedLink[] };
type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; data: JournalData };

/** Today's calendar date (YYYY-MM-DD) — default for new entries (en-CA idiom). */
function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function JournalClient({ tripId }: { tripId: string }) {
  const t = useTranslations('journal');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [online, setOnline] = useState(true);
  const [tab, setTab] = useState<Tab>('entries');
  const [reading, setReading] = useState<EntryDTO | null>(null);
  const [entrySheet, setEntrySheet] = useState<{ open: boolean; entry?: EntryDTO }>({ open: false });
  const mountedRef = useRef(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, [tripId]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(withBase(`/api/trips/${tripId}/journal`), { credentials: 'same-origin' });
      if (!res.ok) throw new Error('load failed');
      const { entries, links } = (await res.json()) as JournalData;
      if (mountedRef.current) setState({ status: 'loaded', data: { entries, links } });
    } catch {
      if (mountedRef.current) setState({ status: 'error' });
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return <p className="px-4 py-8 text-center text-body text-ink-muted">{t('loading')}</p>;
  }
  if (state.status === 'error') {
    return <EmptyState mascotAlt={t('entries')} headline={t('errorHeadline')} subtext={t('errorSubtext')} />;
  }

  const { entries } = state.data;

  // The reader is a full-view replacement (like opening a detail page).
  if (reading) {
    // Keep the reader bound to the latest loaded copy of this entry.
    const fresh = entries.find((e) => e.id === reading.id) ?? reading;
    return (
      <EntryReader
        entry={fresh}
        online={online}
        onClose={() => setReading(null)}
        onEdit={() => {
          setReading(null);
          setEntrySheet({ open: true, entry: fresh });
        }}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-24 pt-2">
      <div className="mt-2 flex items-center justify-between">
        <div role="group" className="flex rounded-control bg-card p-0.5 shadow-inset">
          <button
            type="button"
            aria-pressed={tab === 'entries'}
            onClick={() => setTab('entries')}
            className={`rounded-control px-3 py-1.5 text-caption font-medium ${tab === 'entries' ? 'bg-coral text-white' : 'text-ink-muted'}`}
          >
            {t('entries')}
          </button>
          <button
            type="button"
            aria-pressed={tab === 'links'}
            onClick={() => setTab('links')}
            className={`rounded-control px-3 py-1.5 text-caption font-medium ${tab === 'links' ? 'bg-coral text-white' : 'text-ink-muted'}`}
          >
            {t('readingList')}
          </button>
        </div>
        {tab === 'entries' ? (
          <button
            type="button"
            disabled={!online}
            onClick={() => setEntrySheet({ open: true })}
            className="rounded-control bg-coral px-4 py-2 text-caption font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
          >
            {t('newEntry')}
          </button>
        ) : null}
      </div>

      {tab === 'links' ? (
        // D2 replaces this placeholder with the LinkRow list + add-link sheet.
        <p className="mt-8 px-4 py-8 text-center text-body text-ink-muted">
          {t('readingListComingSoon')}
        </p>
      ) : entries.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            mascotAlt={t('entries')}
            headline={t('emptyHeadline')}
            subtext={t('emptySubtext')}
            actionLabel={online ? t('newEntry') : undefined}
            onAction={online ? () => setEntrySheet({ open: true }) : undefined}
          />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {entries.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setReading(e)}
                className="block w-full rounded-card bg-card p-4 text-left shadow-card"
              >
                <span className="block text-label font-semibold text-ink">{e.title}</span>
                {e.entryDate ? (
                  <span className="mt-0.5 block text-caption text-ink-muted">{e.entryDate}</span>
                ) : null}
                {e.body.trim() !== '' ? (
                  <span className="mt-1 block line-clamp-2 text-body text-ink-muted">
                    {entrySnippet(e.body)}
                  </span>
                ) : null}
                {e.photos.length > 0 ? (
                  <span className="mt-2 flex gap-2">
                    {e.photos.slice(0, 4).map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={p.id}
                        src={personalPhotoUrl(p.id, 'thumb')}
                        alt={e.title}
                        width={56}
                        height={56}
                        className="h-14 w-14 shrink-0 rounded-control object-cover"
                      />
                    ))}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      <EntrySheet
        key={`entry:${entrySheet.open ? (entrySheet.entry?.id ?? 'new') : 'closed'}`}
        open={entrySheet.open}
        tripId={tripId}
        entry={entrySheet.entry}
        disabled={!online}
        today={todayISO()}
        onClose={() => setEntrySheet({ open: false })}
        onSaved={() => {
          void load();
        }}
      />
    </main>
  );
}
