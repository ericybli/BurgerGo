'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MoreHorizontal } from 'lucide-react';
import type { PlaceDTO, SavedListItem } from '@/src/lib/planView';
import type { DerivedDay } from '@/src/lib/days';
import { categoryGlyph, thumbForPlace } from '@/src/lib/planUrl';
import { PhotoPlaceholder } from '@/components/plan/PhotoPlaceholder';
import { EmptyState } from '@/components/EmptyState';
import { DayPickerSheet } from '@/components/plan/DayPickerSheet';
import { ListPickerSheet } from '@/components/plan/ListPickerSheet';
import { ListNameSheet } from '@/components/plan/ListNameSheet';

type SavedListProps = {
  saved: PlaceDTO[];
  lists: SavedListItem[];
  days: DerivedDay[];
  disabled: boolean;
  onPromote: (placeId: string, date: string) => void;
  onTapPlace: (placeId: string) => void;
  onAddPlace: () => void;
  onMoveToList: (placeId: string, listId: string | null) => void;
  onDelete: (placeId: string) => void;
  /** Resolves with the created list so the caller can move a place into it. */
  onCreateList: (name: string) => Promise<SavedListItem>;
  onRenameList: (listId: string, name: string) => void;
  onDeleteList: (listId: string) => void;
};

/** One saved-place card: tap to edit, plus a Manage menu (Add to day / Move / Delete). */
function SavedPlaceCard({
  place,
  disabled,
  onTap,
  onAddToDay,
  onMoveToList,
  onDelete,
}: {
  place: PlaceDTO;
  disabled: boolean;
  onTap: (id: string) => void;
  onAddToDay: (id: string) => void;
  onMoveToList: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations('plan');
  const tCat = useTranslations('placeCategory');
  const tL = useTranslations('savedLists');
  const [managing, setManaging] = useState(false);
  const thumb = thumbForPlace(place);

  return (
    <div className="overflow-hidden rounded-card border border-line bg-bg">
      <button type="button" onClick={() => onTap(place.id)} className="block w-full text-left transition active:opacity-70">
        {thumb.kind === 'photo' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb.src} alt={place.name} className="h-[130px] w-full object-cover" />
        ) : (
          <PhotoPlaceholder category={place.category} className="!mb-0 h-[130px] !rounded-none !shadow-none" />
        )}
        <span className="block min-w-0 px-3 pt-2.5">
          <span className="flex items-center gap-1">
            <span aria-hidden="true">{categoryGlyph(place.category)}</span>
            <span className="truncate text-heading text-ink">{place.name}</span>
          </span>
          <span className="block truncate text-[12px] text-sub">
            {tCat(place.category)}{place.address ? ` · ${place.address}` : ''}
          </span>
          {place.notes ? (
            <span className="mt-1 line-clamp-1 text-[12.5px] text-sub">{place.notes}</span>
          ) : null}
        </span>
      </button>

      <div className="mt-2.5 flex flex-wrap gap-2 px-3 pb-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAddToDay(place.id)}
          className="rounded-[10px] bg-orange px-4 py-[7px] text-[12.5px] font-semibold text-white transition hover:bg-orange-press active:bg-orange-press disabled:opacity-40"
        >
          {t('addToDay')}
        </button>
        <button
          type="button"
          aria-expanded={managing}
          onClick={() => setManaging((v) => !v)}
          className="rounded-[10px] border border-line bg-bg px-4 py-[7px] text-[12.5px] font-semibold text-sub transition hover:bg-surface active:opacity-70"
        >
          {t('manage')}
        </button>
      </div>

      {managing ? (
        <div className="-mt-1 flex flex-wrap gap-2 px-3 pb-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onMoveToList(place.id)}
            className="rounded-[10px] border border-line bg-bg px-3 py-[7px] text-[12.5px] font-semibold text-accent transition hover:bg-accent-tint active:opacity-70 disabled:opacity-40"
          >
            {tL('moveToList')}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onDelete(place.id)}
            className="rounded-[10px] border border-line bg-bg px-3 py-[7px] text-[12.5px] font-semibold text-danger transition hover:bg-surface active:opacity-70 disabled:opacity-40"
          >
            {t('delete')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

type NameSheetState =
  | { mode: 'createTop' }
  | { mode: 'createForPlace'; placeId: string }
  | { mode: 'rename'; listId: string; initialName: string }
  | null;

export function SavedList({
  saved,
  lists,
  days,
  disabled,
  onPromote,
  onTapPlace,
  onAddPlace,
  onMoveToList,
  onDelete,
  onCreateList,
  onRenameList,
  onDeleteList,
}: SavedListProps) {
  const t = useTranslations('plan');
  const tL = useTranslations('savedLists');
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // lists collapsed by default
  const [dayPickerFor, setDayPickerFor] = useState<string | null>(null);
  const [listPickerFor, setListPickerFor] = useState<string | null>(null);
  const [nameSheet, setNameSheet] = useState<NameSheetState>(null);
  const [listMenuFor, setListMenuFor] = useState<string | null>(null);
  const [confirmDeleteList, setConfirmDeleteList] = useState<string | null>(null);

  if (saved.length === 0 && lists.length === 0) {
    return (
      <EmptyState
        mascotAlt={t('addPlace')}
        headline={t('emptySavedHeadline')}
        subtext={t('emptySavedSubtext')}
        actionLabel={disabled ? undefined : t('addPlace')}
        onAction={disabled ? undefined : onAddPlace}
      />
    );
  }

  const loose = saved.filter((p) => (p.listId ?? null) === null);
  const placesInList = (listId: string) => saved.filter((p) => p.listId === listId);
  const pickerPlace = listPickerFor ? saved.find((p) => p.id === listPickerFor) ?? null : null;

  function handleNameSubmit(name: string) {
    if (!nameSheet) return;
    if (nameSheet.mode === 'rename') {
      onRenameList(nameSheet.listId, name);
    } else if (nameSheet.mode === 'createForPlace') {
      const placeId = nameSheet.placeId;
      void onCreateList(name).then((l) => onMoveToList(placeId, l.id));
    } else {
      void onCreateList(name);
    }
  }

  const cardProps = (p: PlaceDTO) => ({
    place: p,
    disabled,
    onTap: onTapPlace,
    onAddToDay: (id: string) => setDayPickerFor(id),
    onMoveToList: (id: string) => setListPickerFor(id),
    onDelete,
  });

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setNameSheet({ mode: 'createTop' })}
        className="mb-3 w-full rounded-[12px] border-[1.5px] border-dashed border-line bg-bg px-4 py-2.5 text-center text-label text-accent transition hover:bg-accent-tint active:opacity-70 disabled:opacity-40"
      >
        {tL('newListOption')}
      </button>

      {/* Lists first, each a collapsible section. */}
      {lists.map((list) => {
        const items = placesInList(list.id);
        const isOpen = expanded.has(list.id);
        return (
          <section key={list.id} className="mt-4">
            <div className="flex items-center gap-2 rounded-[12px] border border-line bg-bg px-3 py-2.5">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() =>
                  setExpanded((cur) => {
                    const next = new Set(cur);
                    if (next.has(list.id)) next.delete(list.id);
                    else next.add(list.id);
                    return next;
                  })
                }
                className="flex min-w-0 flex-1 items-center gap-2 text-left transition active:opacity-70"
              >
                <span aria-hidden="true" className="text-[13px] text-faint">{isOpen ? '▾' : '▸'}</span>
                <span className="truncate text-[14px] font-semibold text-ink">{list.name}</span>
                <span className="ml-auto shrink-0 text-[12.5px] text-faint [font-variant-numeric:tabular-nums]">
                  {items.length}
                </span>
              </button>
              <button
                type="button"
                aria-label={tL('listActions')}
                disabled={disabled}
                onClick={() => { setListMenuFor((cur) => (cur === list.id ? null : list.id)); setConfirmDeleteList(null); }}
                className="-my-1.5 -mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-chip text-faint transition hover:bg-surface active:scale-95 disabled:opacity-40"
              >
                <MoreHorizontal size={15} aria-hidden="true" />
              </button>
            </div>

            {listMenuFor === list.id ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setNameSheet({ mode: 'rename', listId: list.id, initialName: list.name }); setListMenuFor(null); }}
                  className="rounded-[10px] border border-line bg-bg px-3 py-[7px] text-[12.5px] font-semibold text-accent transition hover:bg-accent-tint active:opacity-70"
                >
                  {tL('rename')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmDeleteList === list.id) { onDeleteList(list.id); setListMenuFor(null); setConfirmDeleteList(null); }
                    else setConfirmDeleteList(list.id);
                  }}
                  className="rounded-[10px] border border-line bg-bg px-3 py-[7px] text-[12.5px] font-semibold text-danger transition hover:bg-surface active:opacity-70"
                >
                  {confirmDeleteList === list.id ? tL('deleteListConfirm') : tL('deleteList')}
                </button>
              </div>
            ) : null}

            {isOpen ? (
              items.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-3">
                  {items.map((p) => (
                    <li key={p.id}>
                      <SavedPlaceCard {...cardProps(p)} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 px-3 text-caption text-faint">{tL('emptyListHint')}</p>
              )
            ) : null}
          </section>
        );
      })}

      {/* Loose (ungrouped) places, after the lists. */}
      {loose.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3">
          {loose.map((p) => (
            <li key={p.id}>
              <SavedPlaceCard {...cardProps(p)} />
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        disabled={disabled}
        onClick={onAddPlace}
        className="mt-4 w-full rounded-[12px] bg-orange px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-orange-press active:bg-orange-press disabled:opacity-40"
      >
        {t('addPlace')}
      </button>

      <DayPickerSheet
        open={dayPickerFor !== null}
        title={t('dayPickerTitle')}
        days={days}
        onPick={(date) => { if (dayPickerFor) onPromote(dayPickerFor, date); }}
        onClose={() => setDayPickerFor(null)}
      />

      <ListPickerSheet
        open={listPickerFor !== null}
        lists={lists}
        currentListId={pickerPlace?.listId ?? null}
        onPick={(listId) => { if (listPickerFor) onMoveToList(listPickerFor, listId); }}
        onNewList={() => {
          const placeId = listPickerFor;
          setListPickerFor(null);
          if (placeId) setNameSheet({ mode: 'createForPlace', placeId });
        }}
        onClose={() => setListPickerFor(null)}
      />

      <ListNameSheet
        key={nameSheet ? `${nameSheet.mode}-${'listId' in nameSheet ? nameSheet.listId : 'placeId' in nameSheet ? nameSheet.placeId : 'top'}` : 'closed'}
        open={nameSheet !== null}
        title={nameSheet?.mode === 'rename' ? tL('renameTitle') : tL('createTitle')}
        submitLabel={nameSheet?.mode === 'rename' ? tL('save') : tL('create')}
        initialName={nameSheet?.mode === 'rename' ? nameSheet.initialName : ''}
        onSubmit={handleNameSubmit}
        onClose={() => setNameSheet(null)}
      />
    </div>
  );
}
