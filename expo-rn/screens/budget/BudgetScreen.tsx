/**
 * Budget section — Atlas Light port of the web `components/budget/*`.
 * Summary card (overall headline + 6 category bars), By category / By day
 * expense feeds with flat hairline rows + swipe actions, ExpenseSheet and
 * SetBudgetSheet equivalents. Money is integer minor units end to end; the
 * display currency always comes from the budget response (user Settings).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import {
  api,
  type BudgetCategory,
  type BudgetResponse,
  type Expense,
  type PlaceOption,
} from '../../lib/api';
import { useTrip } from '../../navigation/TripContext';
import { useOnline } from '../../lib/online';
import { colors, font, radius, type } from '../../lib/theme';
import { todayLocal } from '../../lib/days';
import {
  Button,
  Field,
  Loading,
  SegmentedControl,
  SheetPanel,
} from '../../components/ui';
import { inputToMinor, minorToInput } from '../../lib/currency';
import { formatMoney } from './money';
import { BudgetSelect, BudgetSheet, MascotState, OfflineNote, sheetShadow } from './ui';
import {
  BUDGET_CATEGORIES,
  CATEGORY_LABELS,
  buildCategoryBudgets,
  buildOverallBudget,
  clampPercent,
  groupByDate,
  targetMap,
  type BudgetRow,
} from '../../lib/budgetView';
import { SwipeRow } from './SwipeRow';

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; data: BudgetResponse };

type Grouping = 'category' | 'day';

const CATEGORY_OPTIONS = BUDGET_CATEGORIES.map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c],
}));

export function BudgetScreen() {
  const { tripId } = useTrip();
  const online = useOnline();
  // Transparent glass stack header (Task 5) — scroll content starts below it.
  const headerHeight = useHeaderHeight();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [grouping, setGrouping] = useState<Grouping>('day');
  const [expenseForm, setExpenseForm] = useState<{ expense: Expense | null } | null>(null);
  // Counter keys the targets form so every open re-seeds from current targets.
  const [budgetForm, setBudgetForm] = useState(0);

  const load = useCallback(() => {
    let active = true;
    api.budget
      .get(tripId)
      .then((data) => active && setState({ status: 'loaded', data }))
      .catch(() => active && setState((s) => (s.status === 'loaded' ? s : { status: 'error' })));
    return () => {
      active = false;
    };
  }, [tripId]);

  useFocusEffect(load);

  if (state.status === 'loading') return <Loading label="Loading your budget…" />;
  if (state.status === 'error') {
    return (
      <MascotState
        fill
        alt="Budget"
        headline="Couldn't load this budget"
        subtext="Connect to the internet and try again."
        action={
          <Button
            title="Retry"
            variant="secondary"
            onPress={() => {
              setState({ status: 'loading' });
              load();
            }}
          />
        }
      />
    );
  }

  const { expenses, targets, places, currency } = state.data;
  const overall = buildOverallBudget(expenses, targets);
  const categoryRows = buildCategoryBudgets(expenses, targets);

  /** Online-only delete + refresh; always refetch, even on failure (web parity). */
  function deleteExpense(id: string) {
    if (!online) return;
    api.budget
      .deleteExpense(tripId, id)
      .catch(() => {})
      .finally(() => load());
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={[styles.list, { paddingTop: headerHeight + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        <SummaryCard
          overall={overall}
          categoryRows={categoryRows}
          currency={currency}
          onEdit={() => setBudgetForm((n) => n + 1)}
        />

        <View style={styles.controls}>
          <View style={styles.segmentWrap}>
            <SegmentedControl<Grouping>
              options={[
                { value: 'category', label: 'By category' },
                { value: 'day', label: 'By day' },
              ]}
              value={grouping}
              onChange={setGrouping}
            />
          </View>
          <Button
            title="Add expense"
            onPress={() => setExpenseForm({ expense: null })}
            disabled={!online}
          />
        </View>

        {expenses.length === 0 ? (
          <MascotState
            alt="Budget"
            headline="No expenses yet"
            subtext="Tap Add expense to start tracking what you spend."
          />
        ) : grouping === 'day' ? (
          <ByDayFeed
            expenses={expenses}
            currency={currency}
            online={online}
            onEdit={(expense) => setExpenseForm({ expense })}
            onDelete={deleteExpense}
          />
        ) : (
          <ByCategoryFeed
            expenses={expenses}
            currency={currency}
            online={online}
            onEdit={(expense) => setExpenseForm({ expense })}
            onDelete={deleteExpense}
          />
        )}
      </ScrollView>

      <BudgetSheet visible={expenseForm !== null} onClose={() => setExpenseForm(null)}>
        {expenseForm ? (
          <ExpenseForm
            key={expenseForm.expense?.id ?? 'new'}
            tripId={tripId}
            expense={expenseForm.expense}
            places={places}
            currency={currency}
            online={online}
            onClose={() => setExpenseForm(null)}
            onSaved={() => {
              setExpenseForm(null);
              load();
            }}
          />
        ) : null}
      </BudgetSheet>

      <BudgetSheet visible={budgetForm > 0} onClose={() => setBudgetForm(0)}>
        {budgetForm > 0 ? (
          <SetBudgetForm
            key={`budget-${budgetForm}`}
            tripId={tripId}
            targets={targets}
            currency={currency}
            online={online}
            onClose={() => setBudgetForm(0)}
            onSaved={() => {
              setBudgetForm(0);
              load();
            }}
          />
        ) : null}
      </BudgetSheet>
    </View>
  );
}

// --- Summary card -----------------------------------------------------------

function SummaryCard({
  overall,
  categoryRows,
  currency,
  onEdit,
}: {
  overall: BudgetRow;
  categoryRows: BudgetRow[];
  currency: string;
  onEdit: () => void;
}) {
  return (
    <View style={styles.summary}>
      <View style={styles.summaryHead}>
        <Text style={styles.summaryTitle}>OVERALL</Text>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          style={({ pressed }) => [styles.editBtn, pressed && { backgroundColor: colors.surface }]}
        >
          <Text style={styles.editBtnText}>
            {overall.planned === null ? 'Set budget' : 'Edit budget'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.headline}>
        {overall.planned === null
          ? formatMoney(overall.spent, currency)
          : `${formatMoney(overall.spent, currency)} of ${formatMoney(overall.planned, currency)}`}
      </Text>
      <Bar row={overall} label="Overall" />
      <RemainingLabel row={overall} currency={currency} align="left" />

      <View style={styles.catList}>
        {categoryRows.map((row, i) => (
          <View
            key={row.category}
            style={[styles.catRow, i === categoryRows.length - 1 && styles.catRowLast]}
          >
            <View style={styles.lineTop}>
              <Text style={styles.catLabel} numberOfLines={1}>
                {CATEGORY_LABELS[row.category as BudgetCategory]}
              </Text>
              <Text style={styles.catAmount}>
                {row.planned === null
                  ? formatMoney(row.spent, currency)
                  : `${formatMoney(row.spent, currency)} of ${formatMoney(row.planned, currency)}`}
              </Text>
            </View>
            <Bar row={row} label={CATEGORY_LABELS[row.category as BudgetCategory]} />
            <RemainingLabel row={row} currency={currency} align="right" />
          </View>
        ))}
      </View>
    </View>
  );
}

/** 5px progress bar — accent fill, danger when over; width animates 500ms. */
function Bar({ row, label }: { row: BudgetRow; label: string }) {
  const width = clampPercent(row.percent);
  const anim = useRef(new Animated.Value(width)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: width, duration: 500, useNativeDriver: false }).start();
  }, [anim, width]);
  return (
    <View
      style={styles.barTrack}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: width }}
    >
      <Animated.View
        style={[
          styles.barFill,
          { width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
          row.over && { backgroundColor: colors.danger },
        ]}
      />
    </View>
  );
}

function RemainingLabel({
  row,
  currency,
  align,
}: {
  row: BudgetRow;
  currency: string;
  align: 'left' | 'right';
}) {
  const alignStyle = { textAlign: align } as const;
  if (row.planned === null) {
    return <Text style={[styles.remainFaint, alignStyle]}>No budget set</Text>;
  }
  if (row.over) {
    return (
      <Text style={[styles.remainOver, alignStyle]}>
        {`${formatMoney(Math.abs(row.remaining ?? 0), currency)} over`}
      </Text>
    );
  }
  return (
    <Text style={[styles.remainFaint, alignStyle]}>
      {`${formatMoney(row.remaining ?? 0, currency)} left`}
    </Text>
  );
}

// --- Feeds ------------------------------------------------------------------

type FeedProps = {
  expenses: Expense[];
  currency: string;
  online: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
};

/** Sections fade-up with a small stagger, like the web `animate-fade-up`. */
function FadeUp({ index, children }: { index: number; children: ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 6) * 40,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [anim, index]);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

function ByDayFeed({ expenses, currency, online, onEdit, onDelete }: FeedProps) {
  const groups = useMemo(() => groupByDate(expenses), [expenses]);
  return (
    <View style={styles.feed}>
      {groups.map((g, i) => (
        <FadeUp key={g.date} index={i}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionDate}>{g.date}</Text>
            <Text style={styles.sectionTotal}>{formatMoney(g.total, currency)}</Text>
          </View>
          {g.items.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              currency={currency}
              online={online}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </FadeUp>
      ))}
    </View>
  );
}

function ByCategoryFeed({ expenses, currency, online, onEdit, onDelete }: FeedProps) {
  const groups = BUDGET_CATEGORIES.map((c) => ({
    category: c,
    items: expenses.filter((e) => e.category === c),
  })).filter((g) => g.items.length > 0);
  return (
    <View style={styles.feed}>
      {groups.map((g, i) => (
        <FadeUp key={g.category} index={i}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionDate}>{CATEGORY_LABELS[g.category].toUpperCase()}</Text>
          </View>
          {g.items.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              currency={currency}
              online={online}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </FadeUp>
      ))}
    </View>
  );
}

// --- Expense row ------------------------------------------------------------

function ExpenseRow({
  expense,
  currency,
  online,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  currency: string;
  online: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}) {
  // Two-tap delete on the swipe action: first tap arms ("Sure?"), second fires.
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function disarm() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setArmed(false);
  }
  function handleDeleteAction() {
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 3000);
      return;
    }
    disarm();
    onDelete(expense.id);
  }

  const primary = expense.note ?? CATEGORY_LABELS[expense.category];

  return (
    <SwipeRow
      disabled={!online}
      onClose={disarm}
      actions={[
        { label: 'Edit', onPress: () => onEdit(expense) },
        { label: armed ? 'Sure?' : 'Delete', danger: true, keepOpen: !armed, onPress: handleDeleteAction },
      ]}
    >
      <Pressable
        onPress={() => onEdit(expense)}
        disabled={!online}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }, !online && { opacity: 0.6 }]}
      >
        <View style={styles.rowMain}>
          <Text style={styles.rowPrimary} numberOfLines={1}>
            {primary}
          </Text>
          {expense.placeName ? (
            <View style={styles.placeChip}>
              <Text style={styles.placeChipText} numberOfLines={1}>
                {expense.placeName}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.rowAmount}>{formatMoney(expense.amount, currency)}</Text>
      </Pressable>
    </SwipeRow>
  );
}

// --- Expense form (add / edit) ---------------------------------------------

function ExpenseForm({
  tripId,
  expense,
  places,
  currency,
  online,
  onClose,
  onSaved,
}: {
  tripId: string;
  expense: Expense | null;
  places: PlaceOption[];
  currency: string;
  online: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { height } = useWindowDimensions();
  const [amount, setAmount] = useState(expense ? minorToInput(expense.amount, currency) : '');
  const [category, setCategory] = useState<BudgetCategory>(expense?.category ?? 'food');
  const [spentOn, setSpentOn] = useState(expense?.spentOn ?? todayLocal());
  const [note, setNote] = useState(expense?.note ?? '');
  const [linkedPlaceId, setLinkedPlaceId] = useState<string>(expense?.linkedPlaceId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Two-tap delete (no Alert.alert — it is a no-op on web).
  const [deleteArmed, setDeleteArmed] = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
    },
    [],
  );

  const placeOptions = [
    { value: '', label: 'None' },
    ...places.map((p) => ({ value: p.id, label: p.name })),
  ];

  async function save() {
    setError(null);
    const minor = inputToMinor(amount, currency);
    if (minor === null) return setError('Enter an amount greater than zero.');
    setBusy(true);
    const payload = {
      amount: minor,
      category,
      spentOn,
      note: note.trim() === '' ? null : note.trim(),
      linkedPlaceId: linkedPlaceId === '' ? null : linkedPlaceId,
    };
    try {
      if (expense) {
        await api.budget.updateExpense(tripId, expense.id, payload);
      } else {
        await api.budget.addExpense(tripId, payload);
      }
      onSaved();
    } catch {
      setBusy(false);
      setError("Couldn't save — please try again.");
    }
  }

  async function handleDelete() {
    if (!expense) return;
    if (!deleteArmed) {
      setDeleteArmed(true);
      deleteTimer.current = setTimeout(() => setDeleteArmed(false), 3000);
      return;
    }
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    setDeleteArmed(false);
    setBusy(true);
    setError(null);
    try {
      await api.budget.deleteExpense(tripId, expense.id);
      onSaved();
    } catch {
      setBusy(false);
      setError('Something went wrong — please try again.');
    }
  }

  const editable = !busy && online;
  return (
    <SheetPanel title={expense ? 'Edit expense' : 'Add expense'} style={sheetShadow}>
      <ScrollView
        style={{ maxHeight: Math.round(height * 0.85) - 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.errorBox} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {!online ? <OfflineNote /> : null}
        <Field
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          editable={editable}
          keyboardType="decimal-pad"
          placeholder="0.00"
          autoFocus={!expense}
          style={{ fontVariant: ['tabular-nums'] }}
        />
        <BudgetSelect
          label="Category"
          value={category}
          options={CATEGORY_OPTIONS}
          onChange={setCategory}
          disabled={!editable}
        />
        <Field
          label="Date"
          value={spentOn}
          onChangeText={setSpentOn}
          editable={editable}
          autoCapitalize="none"
          placeholder="YYYY-MM-DD"
          style={{ fontVariant: ['tabular-nums'] }}
        />
        <Field label="Note" value={note} onChangeText={setNote} editable={editable} />
        <BudgetSelect
          label="Link a place"
          value={linkedPlaceId}
          options={placeOptions}
          onChange={setLinkedPlaceId}
          disabled={!editable}
          placeholder="None"
        />
        <Button
          title="Save"
          onPress={save}
          busy={busy}
          disabled={!online}
          style={{ marginTop: 20 }}
        />
        {expense ? (
          <Button
            title={deleteArmed ? 'Sure? Tap again to delete' : 'Delete'}
            variant="ghost"
            onPress={handleDelete}
            disabled={busy || !online}
            style={{ marginTop: 8 }}
          />
        ) : null}
        <Button title="Cancel" variant="secondary" onPress={onClose} style={{ marginTop: 8 }} />
      </ScrollView>
    </SheetPanel>
  );
}

// --- Set-budget form --------------------------------------------------------

type TargetKey = 'overall' | BudgetCategory;
const TARGET_KEYS: TargetKey[] = ['overall', ...BUDGET_CATEGORIES];

function SetBudgetForm({
  tripId,
  targets,
  currency,
  online,
  onClose,
  onSaved,
}: {
  tripId: string;
  targets: BudgetResponse['targets'];
  currency: string;
  online: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { height } = useWindowDimensions();
  const current = useMemo(() => targetMap(targets), [targets]);
  const [values, setValues] = useState<Record<TargetKey, string>>(() => {
    const init = {} as Record<TargetKey, string>;
    for (const key of TARGET_KEYS) {
      const planned = current[key];
      init[key] = planned !== null ? minorToInput(planned, currency) : '';
    }
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setValue(key: TargetKey, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  // Diff-based save: skip unchanged keys; empty/invalid clears (DELETE), a new
  // value upserts (PUT). `overall` maps to category null.
  async function save() {
    setBusy(true);
    setError(null);
    try {
      for (const key of TARGET_KEYS) {
        const category = key === 'overall' ? null : key;
        const next = inputToMinor(values[key] ?? '', currency);
        const prev = current[key] ?? null;
        if (next === prev) continue;
        if (next === null) {
          await api.budget.clearTarget(tripId, category);
        } else {
          await api.budget.setTarget(tripId, category, next);
        }
      }
      onSaved();
    } catch {
      setBusy(false);
      setError("Couldn't save — please try again.");
    }
  }

  const editable = !busy && online;
  return (
    <SheetPanel title="Set budget" style={sheetShadow}>
      <ScrollView
        style={{ maxHeight: Math.round(height * 0.85) - 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.errorBox} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {!online ? <OfflineNote /> : null}
        <Field
          label="Overall budget"
          value={values.overall}
          onChangeText={(t) => setValue('overall', t)}
          editable={editable}
          keyboardType="decimal-pad"
          placeholder="0.00"
          style={{ fontVariant: ['tabular-nums'] }}
        />
        {BUDGET_CATEGORIES.map((cat) => (
          <Field
            key={cat}
            label={`${CATEGORY_LABELS[cat]} budget`}
            value={values[cat]}
            onChangeText={(t) => setValue(cat, t)}
            editable={editable}
            keyboardType="decimal-pad"
            placeholder="0.00"
            style={{ fontVariant: ['tabular-nums'] }}
          />
        ))}
        <Button
          title="Save"
          onPress={save}
          busy={busy}
          disabled={!online}
          style={{ marginTop: 20 }}
        />
        <Button title="Cancel" variant="secondary" onPress={onClose} style={{ marginTop: 8 }} />
      </ScrollView>
    </SheetPanel>
  );
}

const styles = StyleSheet.create({
  // Bottom padding clears the floating glass tab bar (content scrolls under it).
  list: { padding: 16, paddingBottom: 150, gap: 16 },

  // Summary card: white, 1px line border, radius 16, px-4 py-3.5 — no shadow.
  summary: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryTitle: { ...type.micro, color: colors.faint },
  editBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editBtnText: { ...type.label, color: colors.ink },
  headline: {
    marginTop: 8,
    fontFamily: font.bold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.9,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },

  catList: { marginTop: 12 },
  catRow: {
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  catRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  lineTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  catLabel: { flex: 1, fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  catAmount: {
    fontFamily: font.semibold,
    fontSize: 13.5,
    color: colors.sub,
    fontVariant: ['tabular-nums'],
  },

  barTrack: {
    marginTop: 6,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  barFill: { height: 5, borderRadius: 3, backgroundColor: colors.accent },

  remainFaint: { marginTop: 4, ...type.caption, color: colors.faint },
  remainOver: { marginTop: 4, ...type.caption, fontFamily: font.semibold, color: colors.danger },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  segmentWrap: { flex: 1, maxWidth: 250 },

  feed: { gap: 16 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionDate: { ...type.micro, color: colors.faint, fontVariant: ['tabular-nums'] },
  sectionTotal: { ...type.caption, color: colors.sub, fontVariant: ['tabular-nums'] },

  // Flat list row: full-width, hairline bottom border, no card/shadow.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowPrimary: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  placeChip: {
    alignSelf: 'flex-start',
    marginTop: 2,
    borderRadius: radius.chip,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.surface,
    maxWidth: '100%',
  },
  placeChipText: { ...type.caption, color: colors.sub },
  rowAmount: {
    marginLeft: 12,
    fontFamily: font.bold,
    fontSize: 14,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },

  errorBox: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: { ...type.caption, color: colors.danger },
});
