'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { withBase } from '@/src/lib/basePath';
import { isHttpUrl } from '@/src/lib/linkPreview';
import { addLinkAction, deleteLinkAction } from '@/app/_actions/savedLinks';

type LinkLite = { id: string; url: string; title: string | null; thumbnail: string | null };

export function PlaceLinks({
  tripId,
  placeId,
  links,
  disabled,
  onChanged,
}: {
  tripId: string;
  placeId: string;
  links: LinkLite[];
  disabled: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations('plan');
  const [url, setUrl] = useState('');
  const [isPending, startTransition] = useTransition();

  async function handleAdd() {
    const value = url.trim();
    if (!isHttpUrl(value) || disabled) return;
    let title: string | null = null;
    let thumbnail: string | null = null;
    try {
      const res = await fetch(withBase('/api/links/preview'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ url: value, tripId }),
      });
      const data = (await res.json()) as { title?: string; thumbnailPath?: string };
      title = data.title ?? null;
      thumbnail = data.thumbnailPath ?? null;
    } catch { /* preview optional */ }
    startTransition(async () => {
      try {
        await addLinkAction({ tripId, placeId, url: value, title, thumbnail });
        setUrl('');
        onChanged();
      } catch { /* surfaced by caller reload */ }
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      try {
        await deleteLinkAction(id);
        onChanged();
      } catch { /* ignore */ }
    });
  }

  return (
    <div className="mt-3">
      <label className="block text-label font-medium text-ink" htmlFor="pl-url">{t('guidesLabel')}</label>
      {links.length > 0 ? (
        <ul className="mt-1 space-y-2">
          {links.map((l) => (
            <li key={l.id} className="flex items-center gap-2 rounded-control border border-line bg-paper px-2 py-1.5">
              {l.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={withBase(`/api/links/thumb/${l.id}`)} alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded object-cover" />
              ) : null}
              <span className="min-w-0 flex-1 truncate text-caption text-ink">{l.title ?? l.url}</span>
              <button type="button" disabled={disabled || isPending} onClick={() => handleRemove(l.id)} className="shrink-0 text-caption font-medium text-danger disabled:opacity-40">{t('delete')}</button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex gap-2">
        <input
          id="pl-url" type="url" inputMode="url" value={url} disabled={disabled}
          aria-label={t('addGuideLink')} placeholder={t('guideUrlPlaceholder')}
          onChange={(e) => setUrl(e.target.value)}
          className="min-w-0 flex-1 rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />
        <button type="button" disabled={disabled || isPending} onClick={handleAdd} className="shrink-0 rounded-control border border-teal px-3 py-2 text-caption font-medium text-teal disabled:opacity-40">{t('addGuideLink')}</button>
      </div>
    </div>
  );
}
