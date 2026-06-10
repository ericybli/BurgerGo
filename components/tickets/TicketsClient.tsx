'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Image as ImageIcon } from 'lucide-react';
import { withBase } from '@/src/lib/basePath';
import { EmptyState } from '@/components/EmptyState';
import { TicketSheet } from '@/components/tickets/TicketSheet';
import { deleteTicketAction } from '@/app/_actions/tickets';
import type { TicketDTO } from '@/app/api/trips/[tripId]/tickets/route';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; tickets: TicketDTO[] };

/** URL for one ticket attachment (inline view / download). */
export function ticketFileUrl(fileId: string): string {
  return withBase(`/api/tickets/files/${fileId}`);
}

/**
 * Tickets tab: reservations with optional date/time/location, a note, and
 * attachments (booking PDFs, QR-code images). Cards sort by (date, time)
 * ascending with undated tickets last (server-sorted).
 */
export function TicketsClient({ tripId }: { tripId: string }) {
  const t = useTranslations('tickets');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [online, setOnline] = useState(true);
  const [sheet, setSheet] = useState<{ open: boolean; ticket?: TicketDTO }>({ open: false });
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
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
      const res = await fetch(withBase(`/api/trips/${tripId}/tickets`), { credentials: 'same-origin' });
      if (!res.ok) throw new Error('load failed');
      const { tickets } = (await res.json()) as { tickets: TicketDTO[] };
      if (mountedRef.current) setState({ status: 'loaded', tickets });
    } catch {
      if (mountedRef.current) setState({ status: 'error' });
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleDelete(id: string) {
    if (confirmingDelete !== id) {
      setConfirmingDelete(id);
      return;
    }
    setConfirmingDelete(null);
    void (async () => {
      try {
        await deleteTicketAction(id);
        await load();
      } catch {
        /* transient — the list reload below shows the truth */
        await load();
      }
    })();
  }

  if (state.status === 'loading') {
    return <p className="px-4 py-8 text-center text-body text-sub">{t('loading')}</p>;
  }
  if (state.status === 'error') {
    return <EmptyState mascotAlt={t('title')} headline={t('errorHeadline')} subtext={t('errorSubtext')} />;
  }

  const { tickets } = state;

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-24 pt-2">
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-[21px] font-bold tracking-[-0.02em] text-ink">{t('title')}</h1>
        <button
          type="button"
          disabled={!online}
          onClick={() => setSheet({ open: true })}
          className="rounded-[10px] bg-orange px-3.5 py-2 text-label text-white hover:bg-orange-press active:bg-orange-press disabled:bg-surface disabled:text-faint"
        >
          {t('add')}
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            mascotAlt={t('title')}
            headline={t('emptyHeadline')}
            subtext={t('emptySubtext')}
            actionLabel={online ? t('add') : undefined}
            onAction={online ? () => setSheet({ open: true }) : undefined}
          />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {tickets.map((tk, i) => (
            <li
              key={tk.id}
              className="animate-fade-up rounded-[14px] border border-line bg-bg p-[12px_14px]"
              style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
            >
              <h2 className="text-[15.5px] font-bold tracking-[-0.01em] text-ink">{tk.title}</h2>
              {tk.date || tk.time ? (
                <p className="mt-0.5 text-caption tabular-nums text-faint">
                  {[tk.date, tk.time].filter(Boolean).join(' · ')}
                </p>
              ) : null}
              {tk.location ? <p className="mt-1 text-caption text-sub">{tk.location}</p> : null}
              {tk.note ? (
                <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-[19px] text-sub">{tk.note}</p>
              ) : null}

              {tk.files.length > 0 ? (
                <ul className="mt-2.5 space-y-1.5">
                  {tk.files.map((f) => (
                    <li key={f.id}>
                      <a
                        href={ticketFileUrl(f.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-[10px] border border-line px-3 py-2 transition hover:bg-surface active:opacity-70"
                      >
                        {f.mime === 'application/pdf' ? (
                          <FileText size={15} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden="true" />
                        ) : (
                          <ImageIcon size={15} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden="true" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-caption font-semibold text-ink">{f.name}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  disabled={!online}
                  onClick={() => setSheet({ open: true, ticket: tk })}
                  className="text-label text-accent transition active:opacity-70 disabled:text-faint"
                >
                  {t('edit')}
                </button>
                <button
                  type="button"
                  disabled={!online}
                  onClick={() => handleDelete(tk.id)}
                  className={`text-label transition active:opacity-70 disabled:text-faint ${
                    confirmingDelete === tk.id ? 'rounded-control bg-danger px-2.5 py-1 text-white' : 'text-danger'
                  }`}
                >
                  {confirmingDelete === tk.id ? t('confirmDelete') : t('delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TicketSheet
        key={`ticket:${sheet.open ? (sheet.ticket?.id ?? 'new') : 'closed'}`}
        open={sheet.open}
        tripId={tripId}
        ticket={sheet.ticket}
        disabled={!online}
        onClose={() => setSheet({ open: false })}
        onSaved={() => {
          void load();
        }}
      />
    </main>
  );
}
