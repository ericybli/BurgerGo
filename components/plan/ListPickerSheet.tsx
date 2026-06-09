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
    'w-full rounded-control border border-line bg-paper px-3 py-2.5 text-left text-body text-ink transition hover:bg-line active:bg-line active:scale-[0.98]';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('moveToListTitle')}
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[75vh] w-full flex-col rounded-t-sheet bg-card p-6 shadow-lift"
      >
        <div className="mx-auto mt-2 mb-1 h-1 w-9 rounded-chip bg-line" aria-hidden="true" />
        <h2 className="font-serif text-title text-ink">{t('moveToListTitle')}</h2>
        <ul className="mt-4 flex min-h-0 flex-col gap-2 overflow-y-auto">
          {lists.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                aria-pressed={l.id === currentListId}
                onClick={() => { onPick(l.id); onClose(); }}
                className={`${itemClass} ${l.id === currentListId ? 'font-semibold text-coral' : ''}`}
              >
                {l.name}{l.id === currentListId ? ' ✓' : ''}
              </button>
            </li>
          ))}
          {currentListId !== null ? (
            <li>
              <button type="button" onClick={() => { onPick(null); onClose(); }} className={itemClass}>
                {t('removeFromList')}
              </button>
            </li>
          ) : null}
          <li>
            <button type="button" onClick={onNewList} className={`${itemClass} text-teal`}>
              {t('newListOption')}
            </button>
          </li>
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset transition hover:bg-line active:bg-line active:scale-[0.98]"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
