The gate passes — the only error is in `screens/home/TripCard.tsx` (another agent's file, outside my assigned paths). Zero errors reference `screens/tickets/**`.

REPORT — tickets section port

Files created/changed:
- /Users/eric/own/BurgerGo/expo-rn/screens/tickets/TicketsScreen.tsx — replaced placeholder with the full list screen
- /Users/eric/own/BurgerGo/expo-rn/screens/tickets/TicketSheet.tsx — new create/edit sheet

Spec items completed:
- Header row: "Tickets" (21px bold ink) + small orange "Add ticket" button (px 14 / py 8, radius 10, label type), offline-disabled (surface bg + faint text, no opacity wash).
- Load states with exact en.json strings: Loading "Loading your tickets…"; error "Couldn't load tickets" / "Check your connection and try again." (ErrorState with Retry, Budget convention); empty "No tickets yet" / "Keep reservations, booking PDFs, and QR codes in one place." with "Add ticket" action only when online.
- Cards (flat hairline, radius 14, p 12×14, no shadow): title 15.5 bold; `[date, time].filter(Boolean).join(' · ')` caption faint tabular-nums; location caption sub; note 13/19 sub multi-line; attachment rows (hairline radius 10, lucide FileText/Image 15/1.75 accent, semibold ink name truncated, upload order) opening via `Linking.openURL(api.tickets.fileUrl(f.id))`.
- Action row: "Edit" accent text → sheet pre-filled; "Delete" two-tap → "Tap again to delete" danger pill (radius 10, px 10/py 4, white text), single pending confirm moves between cards, NO timeout (web-exact), delete failure swallowed + reload either way; both disabled offline.
- Sort: `(date ?? '9999-99-99')T(time ?? '99:99')` string-compare asc (stable sort preserves server createdAt tiebreak). Refetch on focus + after every mutation.
- Staggered fade-up entrance (delay min(i,6)×40ms, `useNativeDriver` off on web).
- Sheet: key-remount per open (`ticket:{id|new}`); "New ticket"/"Edit ticket" heading; danger 10%-bg error banner; Title/Date/Time/Location/Note fields with MICRO uppercase faint labels, YYYY-MM-DD / HH:MM text placeholders, tabular-nums, accent focus border; all inputs disabled offline/saving.
- Attachments: existing-file rows with × → immediate `api.tickets.removeFile` + local removal + `onSaved()` (sheet stays open; failure → "Couldn't save. Try again."); pending rows dashed border / faint icon / sub name with local-only ×; "Add photo" (expo-image-picker, images, quality 0.85, multi-select) and "Add PDF" (expo-document-picker, application/pdf, multiple, copyToCacheDirectory) accent hairline pick buttons, offline-disabled; hint "Images or PDFs — booking confirmations, QR codes."; non-image/PDF picks dropped with "Only images and PDFs are supported." while valid ones keep appending; client pre-flight >15 MB rejection.
- Save flow (web-exact): trimmed-title required ("Add a title for this ticket."), `'' → null` payload, create/update → `saved.ticket.id`, sequential `api.tickets.uploadFile` stopping at first failure, success → onSaved + close, failure → inline error + onSaved (partial uploads) + sheet stays open; "Saving…" label while busy; Save disabled offline/saving, Cancel (90px secondary) never disabled.
- Backend error surfacing: too_large → "That file is too big (max 15 MB).", too_many → "Max reached (12 files per ticket).", unsupported_type → badFileType string, else "Couldn't save. Try again." (postForm throws the error code as the message).
- Ticket delete uses `api.tickets.remove` (backend cleans bytes).

Spec items NOT done (with reason):
- Spec gaps 1–3 (web REST routes, RN api namespace, tab registration) were already present — `api.tickets.*` exists in lib/api, the Tickets tab is registered in navigation/TripTabs.tsx between Eats and Budget; both are outside my ownership anyway.
- Single combined "Add files" picker (spec gap 6): replaced by the two buttons "Add photo" + "Add PDF" per the explicit section instructions in this task (instructions override the spec's single-picker suggestion).

Contract assumptions:
- `api.tickets.create/update` return `{ ticket: { id, … } }`; upload field name `file` handled inside `api.tickets.uploadFile` (postForm fileField param).
- Upload/file errors arrive as `Error(message=code)` from postForm (`too_large`/`too_many`/`unsupported_type`); writeJson errors are generic `HTTP nnn` → fall back to the generic saveFailed string.
- Date/time pre-validated client-side with the server regexes; RN-only messages "Use YYYY-MM-DD for the date." / "Use HH:MM for the time." (no web equivalent since web uses native date/time inputs).
- Built a local FormField (micro uppercase faint labels) and small AddTicketButton instead of the shared kit Field/Button, whose label/padding recipes don't match this section's Atlas spec; both live inside screens/tickets/.