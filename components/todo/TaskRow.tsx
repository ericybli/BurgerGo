'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
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
    <div className="rounded-card bg-card p-3 shadow-card">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={task.done}
          disabled={disabled || busy}
          aria-label={t('doneLabel', { title: task.title })}
          onChange={(e) => void save({ done: e.target.checked })}
          className="h-5 w-5 shrink-0 accent-teal"
        />
        <input
          type="text"
          value={title}
          disabled={disabled || busy}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          className={`min-w-0 flex-1 rounded-control border border-transparent bg-transparent px-2 py-1 text-body text-ink focus:border-line focus:bg-paper disabled:opacity-60 ${
            task.done ? 'text-ink-faint line-through' : ''
          }`}
        />
        <button
          type="button"
          disabled={disabled || busy}
          onClick={handleDelete}
          aria-label={t('deleteTask')}
          className="shrink-0 rounded-chip p-1 text-ink-faint active:bg-line disabled:opacity-40"
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
        className="mt-1 w-full resize-none rounded-control border border-line bg-paper px-2 py-1 text-caption text-ink-muted disabled:opacity-60"
      />
    </div>
  );
}
