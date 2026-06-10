'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Image as ImageIcon, X } from 'lucide-react';
import { withBase } from '@/src/lib/basePath';
import { useFocusTrap } from '@/src/lib/useFocusTrap';
import { addTicketAction, updateTicketAction, deleteTicketFileAction } from '@/app/_actions/tickets';
import type { TicketDTO } from '@/app/api/trips/[tripId]/tickets/route';

type TicketSheetProps = {
  open: boolean;
  tripId: string;
  /** Present → edit mode; absent → create mode. */
  ticket?: TicketDTO;
  disabled: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const inputCls =
  'mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60';
const labelCls = 'mt-3 block text-micro uppercase text-faint';

/**
 * Create / edit a ticket (reservation). Attachments (images / PDFs, multiple)
 * are picked into a pending list and uploaded AFTER the ticket row saves —
 * one submit covers everything. Edit mode also lists + deletes existing files.
 */
export function TicketSheet({ open, tripId, ticket, disabled, onClose, onSaved }: TicketSheetProps) {
  const t = useTranslations('tickets');
  const isEdit = !!ticket;
  const [title, setTitle] = useState(ticket?.title ?? '');
  const [date, setDate] = useState(ticket?.date ?? '');
  const [time, setTime] = useState(ticket?.time ?? '');
  const [location, setLocation] = useState(ticket?.location ?? '');
  const [note, setNote] = useState(ticket?.note ?? '');
  const [pending, setPending] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState(ticket?.files ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  if (!open) return null;

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    setError(null);
    const ok = files.filter((f) => f.type === 'application/pdf' || f.type.startsWith('image/'));
    if (ok.length < files.length) setError(t('badFileType'));
    setPending((p) => [...p, ...ok]);
  }

  function handleDeleteExisting(fileId: string) {
    setError(null);
    void (async () => {
      try {
        await deleteTicketFileAction(fileId);
        setExistingFiles((fs) => fs.filter((f) => f.id !== fileId));
        onSaved();
      } catch {
        setError(t('saveFailed'));
      }
    })();
  }

  function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError(t('titleRequired'));
      return;
    }
    setError(null);
    setSaving(true);
    void (async () => {
      try {
        const payload = {
          title: trimmed,
          date: date || null,
          time: time || null,
          location: location.trim() || null,
          note: note.trim() || null,
        };
        const saved = isEdit
          ? await updateTicketAction(ticket!.id, payload)
          : await addTicketAction({ tripId, ...payload });

        // Upload pending attachments sequentially; stop + surface the first failure.
        for (const file of pending) {
          const fd = new FormData();
          fd.set('file', file);
          fd.set('tripId', tripId);
          fd.set('ticketId', saved.id);
          const res = await fetch(withBase('/api/tickets/files'), { method: 'POST', body: fd });
          if (!res.ok) throw new Error('upload failed');
        }
        onSaved();
        onClose();
      } catch {
        setError(t('saveFailed'));
        onSaved(); // partial uploads may have landed — refresh the list
      } finally {
        setSaving(false);
      }
    })();
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? t('editTitle') : t('newTitle')}
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-[3px]"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-bg p-[18px] pb-8 shadow-sheet"
      >
        <div className="mx-auto mb-3.5 h-1 w-10 rounded-chip bg-line" aria-hidden="true" />
        <h2 className="mb-3 text-[18px] font-bold tracking-[-0.01em] text-ink">
          {isEdit ? t('editTitle') : t('newTitle')}
        </h2>

        {error ? (
          <p role="alert" className="mb-3 rounded-control bg-danger/10 px-3 py-2 text-caption text-danger">
            {error}
          </p>
        ) : null}

        <label className="block text-micro uppercase text-faint" htmlFor="tk-title">{t('titleLabel')}</label>
        <input id="tk-title" type="text" value={title} disabled={disabled} onChange={(e) => setTitle(e.target.value)} className={inputCls} />

        <label className={labelCls} htmlFor="tk-date">{t('dateLabel')}</label>
        <input id="tk-date" type="date" value={date} disabled={disabled} onChange={(e) => setDate(e.target.value)} className={`${inputCls} tabular-nums`} />

        <label className={labelCls} htmlFor="tk-time">{t('timeLabel')}</label>
        <input id="tk-time" type="time" value={time} disabled={disabled} onChange={(e) => setTime(e.target.value)} className={`${inputCls} tabular-nums`} />

        <label className={labelCls} htmlFor="tk-location">{t('locationLabel')}</label>
        <input id="tk-location" type="text" value={location} disabled={disabled} onChange={(e) => setLocation(e.target.value)} className={inputCls} />

        <label className={labelCls} htmlFor="tk-note">{t('noteLabel')}</label>
        <textarea id="tk-note" rows={3} value={note} disabled={disabled} onChange={(e) => setNote(e.target.value)} className={inputCls} />

        <p className={labelCls}>{t('filesLabel')}</p>
        {existingFiles.length > 0 ? (
          <ul className="mt-1 space-y-1.5">
            {existingFiles.map((f) => (
              <li key={f.id} className="flex items-center gap-2 rounded-[10px] border border-line px-3 py-2">
                {f.mime === 'application/pdf' ? (
                  <FileText size={15} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden="true" />
                ) : (
                  <ImageIcon size={15} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate text-caption font-semibold text-ink">{f.name}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleDeleteExisting(f.id)}
                  aria-label={t('removeFile')}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-chip text-faint transition hover:bg-line hover:text-danger active:scale-90"
                >
                  <X size={13} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {pending.length > 0 ? (
          <ul className="mt-1 space-y-1.5">
            {pending.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-[10px] border border-dashed border-line px-3 py-2">
                {f.type === 'application/pdf' ? (
                  <FileText size={15} strokeWidth={1.75} className="shrink-0 text-faint" aria-hidden="true" />
                ) : (
                  <ImageIcon size={15} strokeWidth={1.75} className="shrink-0 text-faint" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate text-caption text-sub">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                  aria-label={t('removeFile')}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-chip text-faint transition hover:bg-line active:scale-90"
                >
                  <X size={13} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <label className={`mt-2 inline-flex cursor-pointer items-center justify-center rounded-control border border-line bg-bg px-3.5 py-2 text-label text-accent transition hover:bg-accent-tint active:opacity-70 ${disabled ? 'pointer-events-none opacity-40' : ''}`}>
          {t('addFiles')}
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            disabled={disabled}
            onChange={handlePick}
            className="sr-only"
          />
        </label>
        <p className="mt-1 text-caption text-faint">{t('filesHint')}</p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={disabled || saving}
            onClick={handleSave}
            className="flex-1 rounded-[12px] bg-orange py-3 text-[14px] font-semibold text-white hover:bg-orange-press active:bg-orange-press disabled:bg-surface disabled:text-faint"
          >
            {saving ? t('saving') : t('save')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-[90px] rounded-[12px] border border-line bg-bg py-3 text-[14px] font-semibold text-ink hover:bg-surface active:opacity-70"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
