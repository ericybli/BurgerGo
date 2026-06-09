'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { downscaleImageToDataUrl } from '@/src/lib/downscaleImage';
import { emitTripDataChanged } from '@/src/lib/events';
import {
  extractImportItemsAction,
  createImportItemsAction,
  type ImportPreviewItem,
} from '@/app/_actions/aiImport';

const MAX_IMAGES = 8;

type Phase = 'input' | 'extracting' | 'preview' | 'creating' | 'done';
type Img = { id: string; dataUrl: string };
type Row = ImportPreviewItem & { id: string };

let seq = 0;
const uid = () => `ai${(seq += 1)}`;

export function AiImportSheet({
  open,
  tripId,
  onClose,
  onCreated,
}: {
  open: boolean;
  tripId: string;
  onClose: () => void;
  /** Called after a successful create so the host can refresh its data. */
  onCreated?: () => void;
}) {
  const t = useTranslations('aiImport');
  const [online, setOnline] = useState(true);
  const [phase, setPhase] = useState<Phase>('input');
  const [images, setImages] = useState<Img[]>([]);
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ restaurants: number; places: number } | null>(null);
  const [isPending, startTransition] = useTransition();

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

  if (!open) return null;

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow re-picking the same file
    const room = Math.max(0, MAX_IMAGES - images.length);
    const added: Img[] = [];
    for (const file of files.slice(0, room)) {
      try {
        added.push({ id: uid(), dataUrl: await downscaleImageToDataUrl(file) });
      } catch {
        // skip an unreadable image
      }
    }
    if (added.length) setImages((cur) => [...cur, ...added]);
  }

  const canExtract = online && !isPending && (images.length > 0 || text.trim().length > 0);

  function extract() {
    setError(null);
    setPhase('extracting');
    startTransition(async () => {
      try {
        const { items } = await extractImportItemsAction({
          tripId,
          images: images.map((i) => i.dataUrl),
          text,
        });
        if (items.length === 0) {
          setError(t('nothingFound'));
          setPhase('input');
          return;
        }
        setRows(items.map((it) => ({ ...it, id: uid() })));
        setPhase('preview');
      } catch {
        setError(t('extractError'));
        setPhase('input');
      }
    });
  }

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRow(id: string) {
    setRows((cur) => cur.filter((r) => r.id !== id));
  }

  function create() {
    setError(null);
    setPhase('creating');
    startTransition(async () => {
      try {
        const res = await createImportItemsAction({
          tripId,
          items: rows.map((r) => ({
            type: r.type,
            name: r.name,
            address: r.address,
            lat: r.lat,
            lng: r.lng,
            googlePlaceId: r.googlePlaceId,
            cuisine: r.cuisine,
            category: r.category,
            notes: r.notes,
          })),
        });
        setResult(res);
        setPhase('done');
        emitTripDataChanged(); // make Plan/Eats re-fetch so the imports appear
        onCreated?.();
      } catch {
        setError(t('createError'));
        setPhase('preview');
      }
    });
  }

  const reviewing = phase === 'preview' || phase === 'creating';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full flex-col rounded-t-sheet bg-bg shadow-sheet animate-fade-up"
      >
        <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-chip bg-line" aria-hidden="true" />
        <header className="flex items-center justify-between px-5 pt-3">
          <h2 className="text-[18px] font-bold tracking-[-0.01em] text-ink">
            {phase === 'done' ? t('doneTitle') : t('title')}
          </h2>
          <button
            type="button"
            aria-label={t('close')}
            onClick={onClose}
            className="-mr-1 flex items-center justify-center rounded-chip p-1 text-faint transition hover:bg-surface active:bg-surface active:scale-95"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">
          {/* --- Done --- */}
          {phase === 'done' && result ? (
            <div className="py-6 text-center">
              <p className="text-body text-ink">
                {t('doneSummary', { restaurants: result.restaurants, places: result.places })}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 w-full rounded-[12px] bg-orange px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-orange-press active:bg-orange-press active:scale-[0.98]"
              >
                {t('close')}
              </button>
            </div>
          ) : reviewing ? (
            /* --- Preview --- */
            <>
              <p className="text-caption text-sub">{t('reviewTitle', { count: rows.length })}</p>
              <ul className="mt-3 flex flex-col gap-3">
                {rows.map((r, i) => (
                  <li
                    key={r.id}
                    className="rounded-card border border-line bg-bg p-3 animate-fade-up"
                    style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div role="group" className="flex gap-0.5 rounded-[10px] bg-surface p-[3px]">
                        {(['restaurant', 'place'] as const).map((tp) => (
                          <button
                            key={tp}
                            type="button"
                            aria-pressed={r.type === tp}
                            onClick={() => updateRow(r.id, { type: tp })}
                            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-label transition ${r.type === tp ? 'bg-bg text-ink shadow-thumb' : 'text-sub'}`}
                          >
                            {tp === 'restaurant' ? t('typeRestaurant') : t('typePlace')}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        aria-label={t('removeItem')}
                        onClick={() => removeRow(r.id)}
                        className="flex shrink-0 items-center justify-center rounded-chip p-1 text-faint transition hover:bg-surface active:bg-surface active:scale-95"
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      type="text"
                      value={r.name}
                      aria-label={t('namePlaceholder')}
                      placeholder={t('namePlaceholder')}
                      onChange={(e) => updateRow(r.id, { name: e.target.value })}
                      className="mt-2 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] font-medium text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)]"
                    />
                    <input
                      type="text"
                      value={r.address ?? ''}
                      aria-label={t('addressPlaceholder')}
                      placeholder={t('addressPlaceholder')}
                      onChange={(e) => updateRow(r.id, { address: e.target.value })}
                      className="mt-2 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[13px] text-sub placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)]"
                    />
                    {!r.resolved ? (
                      <p className="mt-1 text-caption text-faint">⚠ {t('unmatched')}</p>
                    ) : null}
                  </li>
                ))}
              </ul>

              {error ? <p role="alert" className="mt-3 text-caption font-medium text-danger">{error}</p> : null}

              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setPhase('input')}
                  disabled={isPending}
                  className="rounded-[12px] border border-line bg-bg px-4 py-3 text-[14px] font-semibold text-ink transition hover:bg-surface active:opacity-70 disabled:opacity-50"
                >
                  {t('back')}
                </button>
                <button
                  type="button"
                  onClick={create}
                  disabled={isPending || rows.length === 0 || !online}
                  className="flex-1 rounded-[12px] bg-orange px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-orange-press active:bg-orange-press active:scale-[0.98] disabled:opacity-50"
                >
                  {phase === 'creating' ? t('creating') : t('create', { count: rows.length })}
                </button>
              </div>
            </>
          ) : (
            /* --- Input --- */
            <>
              <p className="text-caption text-sub">{t('subtitle')}</p>

              {images.length > 0 ? (
                <ul className="mt-3 grid grid-cols-4 gap-2">
                  {images.map((img) => (
                    <li key={img.id} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.dataUrl} alt="" className="h-16 w-full rounded-control object-cover" />
                      <button
                        type="button"
                        aria-label={t('removeItem')}
                        onClick={() => setImages((cur) => cur.filter((i) => i.id !== img.id))}
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-caption text-white transition hover:bg-ink active:scale-95"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <label className="mt-3 flex cursor-pointer items-center justify-center rounded-control border border-dashed border-line bg-bg px-4 py-3 text-label text-accent transition hover:border-accent hover:bg-accent-tint active:scale-[0.99]">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  disabled={images.length >= MAX_IMAGES}
                  onChange={onPickFiles}
                />
                {t('addImages')}
                <span className="ml-2 text-caption text-faint">{t('imagesHint', { count: images.length, max: MAX_IMAGES })}</span>
              </label>

              <textarea
                rows={5}
                value={text}
                placeholder={t('textPlaceholder')}
                onChange={(e) => setText(e.target.value)}
                className="mt-3 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)]"
              />

              {error ? <p role="alert" className="mt-3 text-caption font-medium text-danger">{error}</p> : null}

              <button
                type="button"
                onClick={extract}
                disabled={!canExtract}
                className="mt-4 w-full rounded-[12px] bg-orange px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-orange-press active:bg-orange-press active:scale-[0.98] disabled:opacity-50"
              >
                {phase === 'extracting' ? t('extracting') : t('extract')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
