'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import type { PlaceDTO } from '@/src/lib/planView';
import { placeUrl } from '@/src/lib/googleMapsUrl';
import { thumbForPlace } from '@/src/lib/planUrl';
import { withBase } from '@/src/lib/basePath';

/** Collapsible long-text block with show more / show less (≈6 lines collapsed). */
function Collapsible({ text }: { text: string }) {
  const t = useTranslations('plan');
  const [open, setOpen] = useState(false);
  const long = text.length > 400;
  return (
    <div>
      <p className={`whitespace-pre-wrap text-body leading-[21px] text-ink ${!open && long ? 'line-clamp-6' : ''}`}>{text}</p>
      {long ? (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 text-[12.5px] font-semibold text-accent transition active:opacity-70">
          {open ? t('showLess') : t('showMore')}
        </button>
      ) : null}
    </div>
  );
}

export function PlaceReadCard({
  place,
  onClose,
  onEdit,
  onAddToDay,
}: {
  place: PlaceDTO;
  onClose: () => void;
  onEdit: () => void;
  /** Saved-bucket places only: opens the day picker to schedule this place. */
  onAddToDay?: () => void;
}) {
  const t = useTranslations('plan');
  const tCat = useTranslations('placeCategory');
  const tMap = useTranslations('planMap');
  const thumb = thumbForPlace(place);
  const mapsHref = placeUrl({ name: place.name, lat: place.lat ?? 0, lng: place.lng ?? 0, googlePlaceId: place.googlePlaceId, address: place.address });

  return (
    <div className="pointer-events-auto max-h-[70vh] w-full overflow-y-auto rounded-card border border-line bg-bg p-4 shadow-lift">
      <div className="flex items-start gap-3">
        {thumb.kind === 'glyph' ? (
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-surface text-2xl">{thumb.glyph}</span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[18px] font-bold tracking-[-0.01em] text-ink">{place.name}</h3>
          <p className="truncate text-caption text-sub">{tCat(place.category)}{place.address ? ` · ${place.address}` : ''}</p>
        </div>
        <button type="button" aria-label={t('cancel')} onClick={onClose} className="-mr-1 -mt-1 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-chip bg-surface text-sub transition hover:bg-line active:bg-line active:scale-95">✕</button>
      </div>

      {thumb.kind === 'photo' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb.src} alt={place.name} className="mt-3 h-[165px] w-full rounded-[14px] object-cover" />
      ) : null}

      {place.aiSummary ? (
        <section className="mt-3">
          <h4 className="mb-1.5 text-micro uppercase text-faint">{t('aiSummary')}</h4>
          <Collapsible text={place.aiSummary} />
        </section>
      ) : null}

      {place.notes ? (
        <section className="mt-3">
          <h4 className="mb-1.5 text-micro uppercase text-faint">{t('notesLabel')}</h4>
          <Collapsible text={place.notes} />
        </section>
      ) : null}

      {place.links.length > 0 ? (
        <section className="mt-3">
          <h4 className="mb-1.5 text-micro uppercase text-faint">{t('guidesLabel')}</h4>
          <ul className="space-y-2">
            {place.links.map((l) => (
              <li key={l.id}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-[10px] border border-line bg-bg px-3 py-2 transition hover:bg-surface active:opacity-70">
                  {l.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={withBase(`/api/links/thumb/${l.id}`)} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded object-cover" />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">{l.title ?? l.url}</span>
                  <ExternalLink size={13} aria-hidden="true" className="shrink-0 text-accent" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-4 flex gap-2">
        <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-[12px] bg-accent px-3 py-3 text-center text-[14px] font-semibold text-white transition active:scale-[0.98]">{tMap('openInMaps')}</a>
        <button type="button" onClick={onEdit} className="w-[76px] rounded-[12px] border border-line bg-bg px-3 py-3 text-center text-[14px] font-semibold text-ink transition hover:bg-surface active:opacity-70">{t('edit')}</button>
      </div>

      {onAddToDay ? (
        <button
          type="button"
          onClick={onAddToDay}
          className="mt-2 w-full rounded-[12px] bg-orange px-3 py-3 text-center text-[14px] font-semibold text-white transition hover:bg-orange-press active:bg-orange-press active:scale-[0.98]"
        >
          {t('addToDay')}
        </button>
      ) : null}
    </div>
  );
}
