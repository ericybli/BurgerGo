FILES
- `/Users/eric/own/BurgerGo/expo-rn/screens/todo/shared.tsx` (NEW) — section-local helpers: `MascotEmpty` (bundled `assets/burgergo-logo.png`, 112px @ 0.9 opacity, heading/body copy layout matching web `components/EmptyState.tsx`), `CheckBox` (21×21, radius 7, 1.5px faint border; checked = accent fill + white lucide `Check` strokeWidth 3), `useTwoTapConfirm` (arm → danger "Sure?", 3s auto-disarm, timer cleanup), `FadeUp` (entrance stagger, delay = min(i,6)×40ms), `SureLabel`.
- `/Users/eric/own/BurgerGo/expo-rn/screens/todo/TodoScreen.tsx` — segment label "Packing" → "Packing list"; default tab stays Packing.
- `/Users/eric/own/BurgerGo/expo-rn/screens/todo/PackingView.tsx` (REWRITE) — Atlas restyle + all spec gaps.
- `/Users/eric/own/BurgerGo/expo-rn/screens/todo/TasksView.tsx` (REWRITE) — Atlas restyle + all spec gaps.

SPEC ITEMS COMPLETED (parity-spec gaps 1–13)
1. Exact copy parity for all strings from `messages/en.json` (placeholders, buttons, loading/empty/error states).
2. Add-input clear timing — category/task/item inputs now clear only on success; failures keep text.
3. Add buttons disabled on empty trimmed input (visual disabled states, not just early-return).
4. Per-row busy — each TaskCard/CategoryCard/ItemRow owns its busy flag; top-level busy guards only its own add row; offline is the only global freeze.
5. Error state early-returns and replaces the whole tab including the add row.
6. Mascot empty/error states for both tabs (accessibilityLabel "Packing list" / "Tasks").
7. Button hierarchy — tasks Add = orange solid (press orangePress, disabled = surface bg + faint text, no opacity); Add category = secondary (line border, bg fill, sub text, press surface); item Add = accent outline (press accentTint); outline/secondary disabled = 0.4 opacity.
8. Category header = micro uppercase faint truncated; counter 12px semibold sub tabular-nums; lucide `Trash2` 14px faint; lucide `Check` in checkboxes; item/task delete keeps literal ✕.
9. 1px `line` dividers between item rows (none above first); empty items block hidden.
10. Note field = surface bg, radius 10, 12.5px ink, padding 12/8, grows (minHeight 33 empty / 52 filled), focus = bg + accent border, saves trimmed-or-null on blur only if changed.
11. Checkboxes 21×21 / radius 7 / 1.5px faint border / accent fill; accessibilityLabels "Done: {title}", "Packed: {name}", "Delete task", "Delete item", "Delete {name} and its items".
12. (optional) Task fade-up stagger implemented via `Animated` (mount-only, safe — plain .map, no list recycling).
13. Client clamps: qty 1–9999 (`coerceQty` + maxLength 4), name/category maxLength 100, title 300, note 2000.
Also: input focus states (accent border on bordered inputs; transparent→line+bg on inline name/title; surface→bg+accent on qty), disabled inputs dim to 0.6 like web.

PLUS (from section summary, diverging from web by instruction): two-tap delete on all three destructive actions (task ✕, category Trash2, item ✕) — first tap arms to danger "Sure?", second executes, 3s reset. Web has no confirm; the section brief and cross-platform rules required it.

NOT DONE (with reason)
- Category rename UI — spec item 14 explicitly forbids it ("web exposes no rename; parity = absent") despite the section summary mentioning "rename". Followed the spec.
- Tasks "progress count" and packing "overall progress" (section summary) — spec's exhaustive web inventory states tasks have "no count badge" and packing shows only per-category `{packed}/{total}`; summary's "per spec" qualifier resolved in favor of web parity. Per-category counters ARE implemented.

CONTRACT ASSUMPTIONS / NOTES
- Spec said en.json apostrophes are typographic (’); actual file uses straight ASCII 0x27 (verified) — strings match en.json byte-for-byte ("Couldn't load tasks", "Couldn't load your packing list").
- Web TaskRow checkbox is literally `rounded-chip` (circle) but spec mandates "identical recipe to packing" (radius 7) — used radius 7 for both.
- Mascot EmptyState built locally in `screens/todo/shared.tsx` (spec suggested extending `components/ui` EmptyState, which file-ownership rules forbid); asset already bundled at `expo-rn/assets/burgergo-logo.png`.
- Mutation architecture mirrors web exactly: rows call `api.*` directly, swallow failures, invoke parent `onChanged=load` to re-sync.

GATE: `npx tsc --noEmit` in /Users/eric/own/BurgerGo/expo-rn → ZERO errors referencing `screens/todo/**`. One transient error exists in `screens/home/TripCard.tsx` (concurrent agent's file, outside my paths).