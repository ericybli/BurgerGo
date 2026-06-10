Journal section port complete. Report:

**Files created/changed (all under /Users/eric/own/BurgerGo/expo-rn/screens/journal/):**
- `JournalScreen.tsx` (rewritten) — 3-tab main screen, entry cards, link rows, sheet orchestration
- `EntryReader.tsx` (new) — full-view reader with markdown body, read-only gallery, two-tap delete
- `EntrySheet.tsx` (new) — add/edit with Formatting toolbar (selection wrap/insert/restore via transient controlled `selection`), edit-mode photos
- `LinkSheet.tsx` (new) — URL/Title/Note + OG preview on blur (add+online+valid only)
- `PhotographyTab.tsx` (new) — list cards (Pencil/Trash2 32px chips, two-tap list delete), per-list gallery, multi-pick sequential upload stopping at first failure
- `PhotoListSheet.tsx` (new) — create/rename ("Create"/"Save", Enter submits, autofocus)
- `PhotoGallery.tsx` (new) — shared 80×80 grid + full-screen viewer (black 0.85 scrim, wrap-around ‹/›, "Close photo", tap-outside closes), optional single-tap ✕ delete
- `MarkdownText.tsx` (new) — local dependency-free markdown renderer
- `formBits.tsx` (new) — micro-uppercase FormField, danger/10 ErrorBanner, small orange pill, accent outline button
- `strings.ts` (new) — verbatim en.json copy + photoCountLabel plural
- `photoUpload.ts` (new) — expo-image-picker wrapper + exact error-code→string mapping (too_large/too_many/not_image/invalid_image)

**Spec gaps closed:** 1 (Photography tab, full), 4 (markdown reader), 5 (md toolbar), 6 (reader two-tap delete), 7 (full-screen viewer everywhere), 8 (string parity incl. "Reading list"/"New entry"/"Add link"/empty states/error strings), 9 (edit-mode date defaults to today when null), 10 (entries hides header button when empty; links always shows), 11 (photo error mapping), 12 (Atlas restyle — no shadows, hairline cards, Instrument Sans only, orange=create/save, accent=Edit/links/Add-photos outline, lucide Pencil/Trash2 @16/1.75). Gaps 2–3 (REST routes + types/api.photoLists) were already present in lib/api — consumed, not edited.

**Not done / deviations:**
- Markdown renderer is a local subset (headings, lists, blockquotes, hr, bold/italic/code/links; single newlines collapse to spaces like GFM; raw HTML rendered as plain text). Skipped: tables, nested lists, fenced code blocks, hard line breaks (trailing-2-spaces), images. *Italic* may render upright on iOS (no italic face loaded; works on web).
- Card fade-up stagger animation skipped (spec marks it optional).
- Card-list entry feed staggered animation aside, link-row Edit/Delete are disabled offline (web leaves them enabled; spec's top-level offline rule wins).
- Link row/sheet delete label is "Delete" per spec line 40–41 (web's `t('delete')` would literally render "Delete entry" there — looks like a web copy quirk; followed spec).
- Two-tap armed states have no 3s auto-disarm (web parity: armed until second tap or failure; sheets reset via key-remount).

**Contract assumptions:** `GET journal` may omit `photoLists` on a stale server (`?? []` fallback); photo-list uploads reuse `journal.photoTooMany` copy ("…for this entry.") exactly as the web does; viewer/grid use `photoUrl.personal` sizes full/thumb.

**Gate:** `npx tsc --noEmit` → zero errors (TSC_CLEAN).