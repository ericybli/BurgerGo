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
    <div className="flex items-stretch gap-3 rounded-[14px] border border-line bg-bg p-[10px_12px]">
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={heading}
        className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-70"
      >
        {link.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbSrc}
            alt={heading}
            className="h-12 w-12 shrink-0 rounded-[10px] object-cover"
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-cream">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbSrc} alt={heading} className="w-9" />
          </span>
        )}
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[13.5px] font-semibold text-ink">{heading}</span>
          <span className="truncate text-[11.5px] text-faint">{domain}</span>
          {link.note ? (
            <span className="truncate text-[11.5px] text-faint">{link.note}</span>
          ) : null}
        </span>
      </a>

      <div className="flex shrink-0 flex-col justify-center gap-1">
        <button
          type="button"
          onClick={() => onEdit(link.id)}
          className="rounded-control px-2 py-1 text-[12px] font-semibold text-accent active:opacity-70"
        >
          {t('edit')}
        </button>
        <button
          type="button"
          onClick={() => onDelete(link.id)}
          className="rounded-control px-2 py-1 text-[12px] font-semibold text-danger active:opacity-70"
        >
          {t('delete')}
        </button>
      </div>
    </div>
  );
}
