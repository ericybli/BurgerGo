# todo audit

Checked: 50

## Must-fix
- Segmented-control inactive label color is `faint` instead of web `sub`
- Tasks done-checkbox is a 7px rounded square; web renders a circle

## Accepted/platform
- Two-tap 'Sure?' confirm added to all three deletes (web deletes immediately) [acceptable]
- Loading state adds an ActivityIndicator spinner; web is text-only [acceptable]
- Inline edits can double-fire the PATCH on native keyboard 'done' (submit + blur both commit) [acceptable]
- No 3px accent-tint focus ring on focused inputs (border-color change only) [acceptable]

## Fix report
GATE: `npx tsc --noEmit` in expo-rn — zero errors.

Per-gap status:

1. Segmented-control inactive label color (`faint` → `sub`) — FIXED. One-line token change at the audit's explicitly-granted rnTarget: `segmentText` color now `colors.sub` (#6E746E), matching web `text-sub` on inactive segments (verified against components/todo/ToDoClient.tsx lines 27/35). Active segment unchanged (`colors.ink`). Applies to all sections using the shared SegmentedControl, as the audit states is correct.

2. Tasks done-checkbox circle vs 7px square — FIXED. Added optional `round` prop to the section-owned CheckBox (`checkboxRound: { borderRadius: 999 }`); TasksView passes `round` (web TaskRow.tsx `rounded-chip` = 999px circle). PackingView untouched, keeps radius 7 (web PackingItemRow.tsx `rounded-[7px]`). All other checkbox specs (21×21, 1.5px faint border, accent fill, white Check strokeWidth 3, opacity-40 disabled, a11y) unchanged.

Acceptable/platform items (two-tap confirm, spinner, double-fire PATCH, focus ring) — skipped per instructions.

Files changed:
- /Users/eric/own/BurgerGo/expo-rn/screens/todo/shared.tsx (CheckBox `round` prop + `checkboxRound` style + doc comment)
- /Users/eric/own/BurgerGo/expo-rn/screens/todo/TasksView.tsx (pass `round` on Tasks CheckBox)
- /Users/eric/own/BurgerGo/expo-rn/components/ui/index.tsx (segmentText `colors.faint` → `colors.sub`; edited under the gap's explicit rnTarget grant)