/**
 * Tasks tab (web parity: components/todo/TaskList.tsx + TaskRow.tsx). Add a
 * task by title; each card has a done checkbox (→ strikethrough), an
 * inline-editable title, a note field (saves on blur), and delete. Mutations
 * are online-only; offline is the only global freeze — each card owns its own
 * busy flag. Atlas Light: orange "Add" (the section's create action), white
 * cards with hairline borders, surface note field, fade-up entrance stagger.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, type Task } from '../../lib/api';
import { useTrip } from '../../navigation/TripContext';
import { useOnline } from '../../lib/online';
import { colors, font, radius, type } from '../../lib/theme';
import { Loading } from '../../components/ui';
import { CheckBox, FadeUp, MascotEmpty, SureLabel, useTwoTapConfirm } from './shared';

export function TasksView() {
  const { tripId } = useTrip();
  const online = useOnline();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false); // guards only the add-task row
  const [newTask, setNewTask] = useState('');
  const [addFocused, setAddFocused] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.tasks.list(tripId);
      setTasks(r.tasks);
      setError(false);
    } catch {
      setError(true);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addTask() {
    const title = newTask.trim();
    if (!title || !online || busy) return;
    setBusy(true);
    try {
      await api.tasks.create(tripId, title);
      setNewTask(''); // clear only after success — failed adds keep the text
      await load();
    } catch {
      // Surfaced via the next reload.
    } finally {
      setBusy(false);
    }
  }

  // Error replaces the WHOLE tab, add row included (web early-return).
  if (error) {
    return (
      <MascotEmpty alt="Tasks" headline="Couldn't load tasks" subtext="Check your connection and try again." />
    );
  }
  if (tasks === null) return <Loading label="Loading your tasks…" />;

  const addFrozen = busy || !online;
  const canAdd = !addFrozen && newTask.trim() !== '';

  return (
    <View>
      <View style={st.addRow}>
        <TextInput
          style={[st.addInput, addFocused && { borderColor: colors.accent }, addFrozen && st.dim60]}
          value={newTask}
          onChangeText={setNewTask}
          placeholder="Add a task"
          placeholderTextColor={colors.faint}
          maxLength={300}
          editable={!addFrozen}
          onFocus={() => setAddFocused(true)}
          onBlur={() => setAddFocused(false)}
          onSubmitEditing={addTask}
          returnKeyType="done"
        />
        <Pressable
          onPress={addTask}
          disabled={!canAdd}
          style={({ pressed }) => [
            st.addBtn,
            pressed && canAdd && { backgroundColor: colors.orangePress },
            // Disabled solid = surface bg + faint text — never an opacity wash.
            !canAdd && { backgroundColor: colors.surface },
          ]}
        >
          <Text style={[st.addBtnText, !canAdd && { color: colors.faint }]}>Add</Text>
        </Pressable>
      </View>

      {tasks.length === 0 ? (
        <MascotEmpty
          alt="Tasks"
          headline="No tasks yet"
          subtext="Add things you need to get done for this trip."
        />
      ) : (
        <View style={{ gap: 10 }}>
          {tasks.map((task, i) => (
            <FadeUp key={task.id} index={i}>
              <TaskCard task={task} disabled={!online} onChanged={load} tripId={tripId} />
            </FadeUp>
          ))}
        </View>
      )}
    </View>
  );
}

function TaskCard({
  task,
  disabled,
  onChanged,
  tripId,
}: {
  task: Task;
  disabled: boolean; // offline — the only global freeze
  onChanged: () => void;
  tripId: string;
}) {
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note ?? '');
  const [busy, setBusy] = useState(false);
  const [titleFocused, setTitleFocused] = useState(false);
  const [noteFocused, setNoteFocused] = useState(false);

  // Re-seed from props after each reload (server is the source of truth).
  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => setNote(task.note ?? ''), [task.note]);

  const frozen = disabled || busy;

  async function save(patch: Partial<{ title: string; note: string | null; done: boolean }>) {
    setBusy(true);
    try {
      await api.tasks.update(tripId, task.id, patch);
      onChanged();
    } catch {
      // A failed save leaves the row; the next reload re-syncs.
    } finally {
      setBusy(false);
    }
  }

  function commitTitle() {
    setTitleFocused(false);
    const trimmed = title.trim();
    if (!trimmed || trimmed === task.title) {
      setTitle(task.title); // revert empty/unchanged edits
      return;
    }
    void save({ title: trimmed });
  }

  function commitNote() {
    setNoteFocused(false);
    const next = note.trim() || null;
    if (next !== (task.note ?? null)) void save({ note: next });
  }

  const del = useTwoTapConfirm(() => {
    setBusy(true);
    api.tasks
      .remove(tripId, task.id)
      .then(onChanged)
      .catch(() => {})
      .finally(() => setBusy(false));
  });

  return (
    <View style={st.taskCard}>
      <View style={st.taskTop}>
        <CheckBox
          checked={task.done}
          onToggle={() => void save({ done: !task.done })}
          disabled={frozen}
          accessibilityLabel={`Done: ${task.title}`}
        />
        <TextInput
          style={[st.title, task.done && st.titleDone, titleFocused && st.titleFocus, frozen && st.dim60]}
          value={title}
          onChangeText={setTitle}
          maxLength={300}
          editable={!frozen}
          onFocus={() => setTitleFocused(true)}
          onBlur={commitTitle}
          onSubmitEditing={commitTitle}
          returnKeyType="done"
        />
        <Pressable
          hitSlop={8}
          disabled={frozen}
          onPress={del.fire}
          accessibilityLabel="Delete task"
          style={frozen ? st.dim40 : undefined}
        >
          {del.armed ? <SureLabel /> : <Text style={st.removeX}>✕</Text>}
        </Pressable>
      </View>
      <TextInput
        style={[
          st.note,
          // Web textarea: rows = note ? 2 : 1.
          { minHeight: note ? 52 : 33 },
          noteFocused && st.noteFocus,
          frozen && st.dim60,
        ]}
        value={note}
        onChangeText={setNote}
        placeholder="Add a note"
        placeholderTextColor={colors.faint}
        maxLength={2000}
        editable={!frozen}
        multiline
        textAlignVertical="top"
        onFocus={() => setNoteFocused(true)}
        onBlur={commitNote}
      />
    </View>
  );
}

const st = StyleSheet.create({
  dim40: { opacity: 0.4 },
  dim60: { opacity: 0.6 },

  // Add-task row
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  addInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: font.regular,
    color: colors.ink,
  },
  addBtn: {
    backgroundColor: colors.orange,
    borderRadius: radius.control,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  addBtnText: { ...type.label, color: colors.white },

  // Task card
  taskCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  taskTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontFamily: font.semibold,
    color: colors.ink,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.control,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  titleDone: { textDecorationLine: 'line-through', color: colors.faint },
  titleFocus: { borderColor: colors.line, backgroundColor: colors.bg },
  removeX: { fontSize: 15, fontFamily: font.regular, color: colors.faint, paddingHorizontal: 2 },

  // Note field — surface box that lifts to white with accent border on focus.
  note: {
    marginTop: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: font.regular,
    color: colors.ink,
  },
  noteFocus: { backgroundColor: colors.bg, borderColor: colors.accent },
});
