'use client';

import { useTranslations } from 'next-intl';
import { withBase } from '@/src/lib/basePath';
import { linkDomain } from '@/src/lib/journalView';
import type { SavedLink } from '@/src/db/repos/savedLinks';

type Props = {
  link: SavedLink;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

export function LinkRow({ link, onEdit, onDelete }: Props) {
  const t = useTranslations('journal');
  const domain = linkDomain(link.url);
  const heading = link.title?.trim() ? link.title : domain;
  // Bundled mascot → always renders offline; the served thumb is SW-cached.
  const thumbSrc = link.thumbnail
    ? withBase(`/api/links/thumb/${link.id}`)
    : withBase('/burgergo-logo.png');

  return (
    <div className="flex items-stretch gap-3 rounded-card bg-card p-3 shadow-card">
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={heading}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbSrc}
          alt={heading}
          className={`h-14 w-14 shrink-0 rounded-control object-cover ${
            link.thumbnail ? 'bg-paper' : 'bg-sun/20 p-1'
          }`}
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-body font-bold text-ink">{heading}</span>
          <span className="truncate text-caption text-ink-muted">{domain}</span>
          {link.note ? (
            <span className="truncate text-caption text-ink-muted">{link.note}</span>
          ) : null}
        </span>
      </a>

      <div className="flex shrink-0 flex-col justify-center gap-1">
        <button
          type="button"
          onClick={() => onEdit(link.id)}
          className="rounded-control px-2 py-1 text-caption font-medium text-ink shadow-inset"
        >
          {t('edit')}
        </button>
        <button
          type="button"
          onClick={() => onDelete(link.id)}
          className="rounded-control px-2 py-1 text-caption font-medium text-red-600 shadow-inset"
        >
          {t('delete')}
        </button>
      </div>
    </div>
  );
}
