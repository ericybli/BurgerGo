# journal audit

Checked: 82

## Must-fix
- Scrim token deviates from Atlas Light (0.35 vs 0.42)
- Inputs and a few controls lack disabled/pressed visual states

## Accepted/platform
- EmptyState lacks the web's 112px mascot image and large primary action button [acceptable]
- Markdown renderer is a local subset (spec-blessed) — required elements all verified rendering [acceptable]
- Link-row/sheet delete labeled 'Delete' vs web's literal 'Delete entry' [acceptable]
- Link-row Edit/Delete disabled offline (web leaves them tappable) [acceptable]
- Reload failure after a successful load keeps stale data instead of the error screen [acceptable]
- Edit-sheet photo gallery live-refreshes (web's stays a stale snapshot until reopened) [acceptable]
- Full-screen viewer: tapping the photo itself closes in RN; web keeps it open [acceptable]
- Card fade-up stagger animation skipped [acceptable]
- Text date field replaces the native date input (spec-blessed) [acceptable]
- Micro style deviations (sheet heading size, busy label, handle spacing) [acceptable]

## Fix report
GAP STATUS:

1. "Scrim token deviates from Atlas Light (0.35 vs 0.42)" — NOT FIXED (out of assigned paths). The fix is in `/Users/eric/own/BurgerGo/expo-rn/lib/theme.ts:25` (`scrim: 'rgba(27, 31, 28, 0.35)'` → `'rgba(27, 31, 28, 0.42)'`), and the scrim is consumed only inside `expo-rn/components/ui/index.tsx` (sheetRoot line 488, selectBackdrop line 500) with no override prop on Sheet. Both `expo-rn/lib/**` and `expo-rn/components/ui/**` are explicitly forbidden to journal-section agents, so this global one-line token change must be applied by the foundation owner/orchestrator. It affects every section's sheets, not just Journal.

2. "Inputs and a few controls lack disabled/pressed visual states" — FIXED, all four sub-items:
   - `formBits.tsx` FormField: added `inputDisabled: { opacity: 0.6 }` applied when `editable === false` (web `disabled:opacity-60`). Covers EntrySheet title/date, LinkSheet URL/title/note, PhotoListSheet name — verified all FormField call sites pass `editable`.
   - `EntrySheet.tsx` bodyInput: added `bodyInputDisabled: { opacity: 0.6 }` applied when `!editable`.
   - `JournalScreen.tsx` link-row Edit/Delete Pressables: added pressed `opacity: 0.7` (web `active:opacity-70`); existing disabled opacity 0.4 kept (pressed state can't trigger while disabled).
   - `PhotoGallery.tsx` viewer ‹/›/Close chips: added `viewerChipPressed: { transform: [{ scale: 0.95 }] }` (web `active:scale-95`) on all three chips.

FILES CHANGED:
- /Users/eric/own/BurgerGo/expo-rn/screens/journal/formBits.tsx
- /Users/eric/own/BurgerGo/expo-rn/screens/journal/EntrySheet.tsx
- /Users/eric/own/BurgerGo/expo-rn/screens/journal/JournalScreen.tsx
- /Users/eric/own/BurgerGo/expo-rn/screens/journal/PhotoGallery.tsx

GATE: `npx tsc --noEmit` in expo-rn — zero errors (clean output, whole project).