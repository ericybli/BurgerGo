/**
 * DateField / TimeField — tap-to-pick date & time controls (Atlas Light).
 *
 * Replaces the free-text "YYYY-MM-DD" / "HH:MM" inputs across the app with
 * proper pickers: tapping the field opens a calendar (DateField) or an
 * hour/minute wheel (TimeField). Pure JS — no native module — so it ships over
 * OTA and renders identically on iOS and web. The stored value stays the exact
 * server format (`YYYY-MM-DD`, 24h `HH:MM`); only the *display* is humanized.
 *
 * The picker opens in a centered <Modal> (same pattern as the kit `Select`,
 * which already nests fine inside the bottom-sheet Modals these forms live in).
 */
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react-native';
import { colors, font, radius, type as typeScale } from '../../lib/theme';
import { todayLocal } from '../../lib/days';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const pad = (n: number) => String(n).padStart(2, '0');

/** Parse "YYYY-MM-DD" → {y,m,d} (m is 0-based) or null. */
function parseDate(v: string): { y: number; m: number; d: number } | null {
  if (!DATE_RE.test(v)) return null;
  const [y, m, d] = v.split('-').map(Number);
  return { y: y!, m: m! - 1, d: d! };
}

/** Human display for a stored date, e.g. "Sat, Jun 6, 2026". */
function formatDateDisplay(v: string): string | null {
  const p = parseDate(v);
  if (!p) return null;
  // UTC construction keeps the weekday stable regardless of device timezone.
  const wd = WEEKDAYS[new Date(Date.UTC(p.y, p.m, p.d)).getUTCDay()]!;
  return `${wd}, ${MONTHS_SHORT[p.m]} ${p.d}, ${p.y}`;
}

/** Human display for a stored 24h time, e.g. "6:30 PM". */
function formatTimeDisplay(v: string): string | null {
  if (!TIME_RE.test(v)) return null;
  const [h, m] = v.split(':').map(Number);
  const ampm = h! >= 12 ? 'PM' : 'AM';
  const h12 = h! % 12 || 12;
  return `${h12}:${pad(m!)} ${ampm}`;
}

// --- Shared field shell (label + tappable control box) ----------------------

function FieldShell({
  label,
  labelStyle,
  containerStyle,
  controlStyle,
  disabled,
  hasValue,
  displayText,
  placeholder,
  icon,
  onPress,
}: {
  label?: string;
  labelStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  controlStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  hasValue: boolean;
  displayText: string;
  placeholder: string;
  icon: 'calendar' | 'clock';
  onPress: () => void;
}) {
  const Icon = icon === 'calendar' ? Calendar : Clock;
  return (
    <View style={[label ? s.field : null, containerStyle]}>
      {label ? <Text style={[s.label, labelStyle]}>{label}</Text> : null}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[s.control, disabled && s.controlDisabled, controlStyle]}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${hasValue ? displayText : placeholder}` : undefined}
      >
        <Text style={[s.controlText, !hasValue && s.controlPlaceholder]} numberOfLines={1}>
          {hasValue ? displayText : placeholder}
        </Text>
        <Icon size={16} strokeWidth={1.75} color={colors.faint} />
      </Pressable>
    </View>
  );
}

// --- DateField --------------------------------------------------------------

export function DateField({
  label,
  labelStyle,
  value,
  onChange,
  placeholder = 'Select date',
  disabled,
  clearable = true,
  minDate,
  containerStyle,
  style,
}: {
  label?: string;
  labelStyle?: StyleProp<TextStyle>;
  /** Stored value: '' or "YYYY-MM-DD". */
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Show a Clear button in the picker (default true). */
  clearable?: boolean;
  /** Optional lower bound "YYYY-MM-DD"; earlier days render disabled. */
  minDate?: string;
  containerStyle?: StyleProp<ViewStyle>;
  /** Style for the control box (e.g. flex:1 for inline rows). */
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDate(value);
  // Calendar viewport month, seeded from the value (or today).
  const seed = selected ?? parseDate(todayLocal())!;
  const [view, setView] = useState({ y: seed.y, m: seed.m });

  function openPicker() {
    // Re-seed the viewport each open so it lands on the selected month.
    const s2 = parseDate(value) ?? parseDate(todayLocal())!;
    setView({ y: s2.y, m: s2.m });
    setOpen(true);
  }

  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
  const today = todayLocal();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function pick(day: number) {
    onChange(`${view.y}-${pad(view.m + 1)}-${pad(day)}`);
    setOpen(false);
  }
  function shiftMonth(delta: number) {
    setView((v) => {
      const total = v.y * 12 + v.m + delta;
      return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
    });
  }

  return (
    <>
      <FieldShell
        label={label}
        labelStyle={labelStyle}
        containerStyle={containerStyle}
        controlStyle={style}
        disabled={disabled}
        hasValue={!!selected}
        displayText={formatDateDisplay(value) ?? ''}
        placeholder={placeholder}
        icon="calendar"
        onPress={openPicker}
      />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          {/* Stop propagation so taps inside the card don't dismiss. */}
          <Pressable style={s.card} onPress={() => {}}>
            <View style={s.calHeader}>
              <Pressable onPress={() => shiftMonth(-1)} hitSlop={8} style={s.calArrow}>
                <ChevronLeft size={20} strokeWidth={2} color={colors.ink} />
              </Pressable>
              <Text style={s.calMonth}>{`${MONTHS[view.m]} ${view.y}`}</Text>
              <Pressable onPress={() => shiftMonth(1)} hitSlop={8} style={s.calArrow}>
                <ChevronRight size={20} strokeWidth={2} color={colors.ink} />
              </Pressable>
            </View>

            <View style={s.weekRow}>
              {WEEKDAY_INITIALS.map((w, i) => (
                <Text key={i} style={s.weekLabel}>
                  {w}
                </Text>
              ))}
            </View>

            <View style={s.grid}>
              {cells.map((day, i) => {
                if (day === null) return <View key={i} style={s.cell} />;
                const iso = `${view.y}-${pad(view.m + 1)}-${pad(day)}`;
                const isSelected = value === iso;
                const isToday = today === iso;
                const isDisabled = minDate ? iso < minDate : false;
                return (
                  <Pressable
                    key={i}
                    onPress={() => pick(day)}
                    disabled={isDisabled}
                    style={s.cell}
                  >
                    <View
                      style={[
                        s.dayDot,
                        isToday && !isSelected && s.dayToday,
                        isSelected && s.daySelected,
                      ]}
                    >
                      <Text
                        style={[
                          s.dayText,
                          isSelected && s.dayTextSelected,
                          isDisabled && s.dayTextDisabled,
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={s.pickerFooter}>
              {clearable && selected ? (
                <Pressable
                  onPress={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  hitSlop={6}
                >
                  <Text style={s.footerClear}>Clear</Text>
                </Pressable>
              ) : (
                <View />
              )}
              <Pressable
                onPress={() => {
                  onChange(today);
                  setOpen(false);
                }}
                hitSlop={6}
              >
                <Text style={s.footerAction}>Today</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// --- TimeField --------------------------------------------------------------

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0..59

export function TimeField({
  label,
  labelStyle,
  value,
  onChange,
  placeholder = 'Select time',
  disabled,
  clearable = true,
  containerStyle,
  style,
}: {
  label?: string;
  labelStyle?: StyleProp<TextStyle>;
  /** Stored value: '' or 24h "HH:MM". */
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  const valid = TIME_RE.test(value);
  // Working state (12h) — seeded from the value or a sensible 9:00 AM default.
  const [h12, setH12] = useState(9);
  const [minute, setMinute] = useState(0);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');

  function openPicker() {
    if (valid) {
      const [h, m] = value.split(':').map(Number);
      setAmpm(h! >= 12 ? 'PM' : 'AM');
      setH12(h! % 12 || 12);
      setMinute(m!);
    } else {
      setH12(9);
      setMinute(0);
      setAmpm('AM');
    }
    setOpen(true);
  }

  function commit(nextH12: number, nextMin: number, nextAmpm: 'AM' | 'PM') {
    const h24 = nextAmpm === 'PM' ? (nextH12 % 12) + 12 : nextH12 % 12;
    onChange(`${pad(h24)}:${pad(nextMin)}`);
    setOpen(false);
  }

  return (
    <>
      <FieldShell
        label={label}
        labelStyle={labelStyle}
        containerStyle={containerStyle}
        controlStyle={style}
        disabled={disabled}
        hasValue={valid}
        displayText={formatTimeDisplay(value) ?? ''}
        placeholder={placeholder}
        icon="clock"
        onPress={openPicker}
      />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.card} onPress={() => {}}>
            <Text style={s.timePreview}>
              {h12}:{pad(minute)} {ampm}
            </Text>
            <View style={s.wheels}>
              <WheelColumn
                data={HOURS}
                selected={h12}
                format={(n) => String(n)}
                onSelect={setH12}
              />
              <Text style={s.wheelColon}>:</Text>
              <WheelColumn
                data={MINUTES}
                selected={minute}
                format={(n) => pad(n)}
                onSelect={setMinute}
              />
              <View style={s.ampmCol}>
                {(['AM', 'PM'] as const).map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setAmpm(p)}
                    style={[s.ampmBtn, ampm === p && s.ampmBtnActive]}
                  >
                    <Text style={[s.ampmText, ampm === p && s.ampmTextActive]}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={s.pickerFooter}>
              {clearable && valid ? (
                <Pressable
                  onPress={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  hitSlop={6}
                >
                  <Text style={s.footerClear}>Clear</Text>
                </Pressable>
              ) : (
                <View />
              )}
              <Pressable onPress={() => commit(h12, minute, ampm)} hitSlop={6}>
                <Text style={s.footerAction}>Set time</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** One scrollable column of the time wheel (hour or minute). */
function WheelColumn({
  data,
  selected,
  format,
  onSelect,
}: {
  data: number[];
  selected: number;
  format: (n: number) => string;
  onSelect: (n: number) => void;
}) {
  return (
    <ScrollView style={s.wheel} showsVerticalScrollIndicator={false}>
      {data.map((n) => {
        const active = n === selected;
        return (
          <Pressable key={n} onPress={() => onSelect(n)} style={s.wheelItem}>
            <Text style={[s.wheelText, active && s.wheelTextActive]}>{format(n)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  field: { marginTop: 14 },
  label: { marginBottom: 6, fontSize: 13, fontFamily: font.semibold, color: colors.ink },

  control: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  controlDisabled: { opacity: 0.5 },
  controlText: { fontSize: 15, color: colors.ink, fontFamily: font.regular, flexShrink: 1 },
  controlPlaceholder: { color: colors.faint },

  // Centered modal card (matches the kit Select backdrop).
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.bg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    shadowColor: '#14181A',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },

  // Calendar
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calArrow: {
    width: 32,
    height: 32,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calMonth: { fontFamily: font.bold, fontSize: 15.5, color: colors.ink, letterSpacing: -0.2 },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    ...typeScale.micro,
    color: colors.faint,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayToday: { borderWidth: 1.5, borderColor: colors.accent },
  daySelected: { backgroundColor: colors.accent },
  dayText: { fontSize: 14.5, color: colors.ink, fontFamily: font.medium },
  dayTextSelected: { color: colors.white, fontFamily: font.bold },
  dayTextDisabled: { color: colors.faint, opacity: 0.5 },

  // Time wheels
  timePreview: {
    fontFamily: font.bold,
    fontSize: 26,
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 12,
    fontVariant: ['tabular-nums'],
  },
  wheels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  wheel: {
    height: 168,
    width: 58,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
  wheelItem: { paddingVertical: 9, alignItems: 'center' },
  wheelText: { fontSize: 17, color: colors.sub, fontFamily: font.medium, fontVariant: ['tabular-nums'] },
  wheelTextActive: { color: colors.accent, fontFamily: font.bold, fontSize: 19 },
  wheelColon: { fontFamily: font.bold, fontSize: 20, color: colors.ink },
  ampmCol: { marginLeft: 8, gap: 8 },
  ampmBtn: {
    width: 52,
    paddingVertical: 10,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  ampmBtnActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  ampmText: { fontSize: 14, color: colors.sub, fontFamily: font.semibold },
  ampmTextActive: { color: colors.white },

  // Shared picker footer
  pickerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  footerClear: { fontSize: 14, fontFamily: font.semibold, color: colors.danger },
  footerAction: { fontSize: 14, fontFamily: font.bold, color: colors.accent },
});
