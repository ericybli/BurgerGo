'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PlaceDTO } from '@/src/lib/planView';
import { placeUrl } from '@/src/lib/googleMapsUrl';
import { thumbForPlace } from '@/src/lib/planUrl';
import { withBase } from '@/src/lib/basePath';

/** Collapsible long-text block with show more / show less (≈3 lines collapsed). */
function Collapsible({ text }: { text: string }) {
  const t = useTranslations('plan');
  const [open, setOpen] = useState(false);
  const long = text.length > 160;
  return (
    <div>
      <p className={`whitespace-pre-wrap text-body text-ink ${!open && long ? 'line-clamp-3' : ''}`}>{text}</p>
      {long ? (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 text-caption font-medium text-teal">
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
}: {
  place: PlaceDTO;
  onClose: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations('plan');
  const tCat = useTranslations('placeCategory');
  const tMap = useTranslations('planMap');
  const thumb = thumbForPlace(place);
  const mapsHref = placeUrl({ name: place.name, lat: place.lat ?? 0, lng: place.lng ?? 0, googlePlaceId: place.googlePlaceId });

  return (
    <div className="pointer-events-auto max-h-[70vh] w-full overflow-y-auto rounded-card bg-card p-4 shadow-lift">
      <div className="flex items-start gap-3">
        {thumb.kind === 'glyph' ? (
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-paper text-2xl">{thumb.glyph}</span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-label font-semibold text-ink">{place.name}</h3>
          <p className="truncate text-caption text-ink-muted">{tCat(place.category)}{place.address ? ` · ${place.address}` : ''}</p>
        </div>
        <button type="button" aria-label={t('cancel')} onClick={onClose} className="-mr-1 -mt-1 shrink-0 rounded-chip p-1 text-ink-faint active:bg-line">✕</button>
      </div>

      {thumb.kind === 'photo' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb.src} alt={place.name} className="mt-3 h-48 w-full rounded-control object-cover" />
      ) : null}

      {place.aiSummary ? (
        <section className="mt-3">
          <h4 className="text-caption font-semibold uppercase tracking-wide text-ink-muted">{t('aiSummary')}</h4>
          <div className="mt-1"><Collapsible text={place.aiSummary} /></div>
        </section>
      ) : null}

      {place.notes ? (
        <section className="mt-3">
          <h4 className="text-caption font-semibold uppercase tracking-wide text-ink-muted">{t('notesLabel')}</h4>
          <div className="mt-1"><Collapsible text={place.notes} /></div>
        </section>
      ) : null}

      {place.links.length > 0 ? (
        <section className="mt-3">
          <h4 className="text-caption font-semibold uppercase tracking-wide text-ink-muted">{t('guidesLabel')}</h4>
          <ul className="mt-1 space-y-2">
            {place.links.map((l) => (
              <li key={l.id}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-control border border-line bg-paper px-2 py-1.5">
                  {l.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={withBase(`/api/links/thumb/${l.id}`)} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded object-cover" />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate text-caption text-ink">{l.title ?? l.url}</span>
                  <span aria-hidden="true" className="shrink-0 text-teal">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-4 flex gap-2">
        <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-control bg-teal px-3 py-2 text-center text-caption font-medium text-white">{tMap('openInMaps')}</a>
        <button type="button" onClick={onEdit} className="rounded-control border border-coral px-3 py-2 text-caption font-medium text-coral active:bg-coral-tint">{t('edit')}</button>
      </div>
    </div>
  );
}
