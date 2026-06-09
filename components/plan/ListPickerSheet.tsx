'use client';

import { useTranslations } from 'next-intl';
import type { SavedListItem } from '@/src/lib/planView';

/**
 * Pick which list a saved place goes into: an existing list, "remove from list"
 * (back to loose, only when currently in one), or "+ New list…" (which hands off
 * to the name sheet, then creates + moves).
 */
export function ListPickerSheet({
  open,
  lists,
  currentListId,
  onPick,
  onNewList,
  onClose,
}: {
  open: boolean;
  lists: SavedListItem[];
  currentListId: string | null;
  onPick: (listId: string | null) => void;
  onNewList: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('savedLists');
  if (!open) return null;

  const itemClass =
    'w-full rounded-control border border-line bg-bg px-3 py-2.5 text-left text-body transition hover:bg-surface active:opacity-70';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('moveToListTitle')}
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[75vh] w-full flex-col rounded-t-sheet bg-bg p-[18px] pb-8 shadow-sheet"
      >
        <div className="mx-auto mb-3.5 h-1 w-10 rounded-chip bg-line" aria-hidden="true" />
        <h2 className="text-[18px] font-bold tracking-[-0.01em] text-ink">{t('moveToListTitle')}</h2>
        <ul className="mt-4 flex min-h-0 flex-col gap-2 overflow-y-auto">
          {lists.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                aria-pressed={l.id === currentListId}
                onClick={() => { onPick(l.id); onClose(); }}
                className={`${itemClass} ${l.id === currentListId ? 'font-semibold text-accent' : 'text-ink'}`}
              >
                {l.name}{l.id === currentListId ? ' ✓' : ''}
              </button>
            </li>
          ))}
          {currentListId !== null ? (
            <li>
              <button type="button" onClick={() => { onPick(null); onClose(); }} className={`${itemClass} text-ink`}>
                {t('removeFromList')}
              </button>
            </li>
          ) : null}
          <li>
            <button type="button" onClick={onNewList} className={`${itemClass} font-semibold text-orange`}>
              {t('newListOption')}
            </button>
          </li>
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-[12px] border border-line bg-bg px-4 py-3 text-[14px] font-semibold text-ink transition hover:bg-surface active:opacity-70"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
