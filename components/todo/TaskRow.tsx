'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { updateTaskAction, deleteTaskAction } from '@/app/_actions/tasks';
import type { Task } from '@/src/db/repos/tasks';

/**
 * One to-do task: a leading checkbox (toggles done → strikethrough title), an
 * inline-editable title, an optional note (textarea), and a delete button.
 * Title/note save on blur; the checkbox toggles immediately. Mutations are
 * online-only — `disabled` freezes every control. Local state re-syncs from the
 * prop after each reload so the server stays the source of truth.
 */
export function TaskRow({
  task,
  disabled,
  onChanged,
}: {
  task: Task;
  disabled: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations('tasks');
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => setNote(task.note ?? ''), [task.note]);

  async function save(patch: { title?: string; note?: string | null; done?: boolean }) {
    setBusy(true);
    try {
      await updateTaskAction(task.id, patch);
      onChanged();
    } catch {
      // A failed save leaves the row; the next reload re-syncs from the server.
    } finally {
      setBusy(false);
    }
  }

  function commitTitle() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === task.title) {
      setTitle(task.title);
      return;
    }
    void save({ title: trimmed });
  }

  function commitNote() {
    const next = note.trim() || null;
    if (next !== (task.note ?? null)) void save({ note: next });
  }

  function handleDelete() {
    setBusy(true);
    deleteTaskAction(task.id)
      .then(onChanged)
      .catch(() => {})
      .finally(() => setBusy(false));
  }

  return (
    <div className="rounded-card border border-line bg-bg px-3.5 py-[11px]">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-[21px] w-[21px] shrink-0 items-center justify-center">
          <input
            type="checkbox"
            checked={task.done}
            disabled={disabled || busy}
            aria-label={t('doneLabel', { title: task.title })}
            onChange={(e) => void save({ done: e.target.checked })}
            className="peer h-[21px] w-[21px] shrink-0 cursor-pointer appearance-none rounded-chip border-[1.5px] border-faint bg-bg transition checked:border-accent checked:bg-accent disabled:opacity-40"
          />
          <Check
            aria-hidden
            strokeWidth={3}
            className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 transition peer-checked:opacity-100"
          />
        </span>
        <input
          type="text"
          value={title}
          disabled={disabled || busy}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          className={`min-w-0 flex-1 rounded-control border border-transparent bg-transparent px-2 py-1 text-[14px] font-semibold transition-colors focus:border-line focus:bg-bg focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60 ${
            task.done ? 'text-faint line-through' : 'text-ink'
          }`}
        />
        <button
          type="button"
          disabled={disabled || busy}
          onClick={handleDelete}
          aria-label={t('deleteTask')}
          className="flex shrink-0 items-center justify-center rounded-chip p-1 text-faint transition hover:bg-surface active:scale-95 active:text-danger disabled:opacity-40"
        >
          ✕
        </button>
      </div>
      <textarea
        value={note}
        disabled={disabled || busy}
        placeholder={t('notePlaceholder')}
        onChange={(e) => setNote(e.target.value)}
        onBlur={commitNote}
        rows={note ? 2 : 1}
        className="mt-1.5 w-full resize-none rounded-control border border-transparent bg-surface px-3 py-2 text-[12.5px] text-ink placeholder:text-faint transition focus:border-accent focus:bg-bg focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
      />
    </div>
  );
}
