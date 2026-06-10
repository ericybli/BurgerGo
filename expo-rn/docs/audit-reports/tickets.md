# tickets audit

Checked: 66

## Must-fix
- Empty/error states missing the mascot image (and undersized empty-state CTA)
- Photo attachments are recompressed — web stores original bytes

## Accepted/platform
- Single 'Add files' picker replaced by 'Add photo' + 'Add PDF' buttons [acceptable]
- Date/time as free-text fields with RN-only pre-validation messages [acceptable]
- RN-only enhancements: Retry button, friendly upload-error mapping, 15 MB pre-flight, spinner, OfflineHint, stale-list-preserved-on-reload-failure [acceptable]
- Attachments open in the external browser instead of an in-page tab [platform-constraint]

## Fix report
GAP 1 — Empty/error states missing mascot + undersized empty-state CTA: FIXED
- Added local `MascotState` in TicketsScreen.tsx mirroring web components/EmptyState.tsx (bundled assets/burgergo-logo.png at 112x112, opacity 0.9, mb 24; headline type.heading/ink; subtext type.body/sub mt 8 maxWidth 320; action mt 24) — same recipe as the todo MascotEmpty pattern.
- Error state now renders the mascot with headline "Couldn't load tickets" / subtext, keeping the audit-approved RN-only Retry (kit secondary Button).
- 0-tickets state now renders the mascot, and the CTA is the kit primary Button ("Add ticket", radius 12 / py 12 / 14px semibold orange — matches web's large CTA) instead of the small header AddTicketButton; CTA hidden offline exactly like web. Kit EmptyState/ErrorState imports removed; header AddTicketButton untouched.

GAP 2 — Photo attachments recompressed: FIXED
- TicketSheet.tsx addPhotos(): removed `quality: 0.85` (defaults to max quality; iOS passes PNG/BMP through untouched per expo-image-picker 17.0.11) and added `preferredAssetRepresentationMode: UIImagePickerPreferredAssetRepresentationMode.Current` so iOS hands back the asset's current representation without transcoding; react-native-web already returns the original File blob unmodified. Kept ImagePicker (not DocumentPicker) so iOS photo-library access — the common QR-screenshot source — is preserved; the two-button picker split is audit-approved as acceptable.
- Filename fallback (iOS platform constraint, kept per audit) improved: extension now derived from the real mimeType so PNG picks aren't labeled `.jpg`; real `fileName` still used when the picker provides it. PDF path (DocumentPicker) unchanged.

GATE: `npx tsc --noEmit` in expo-rn → zero errors.

Files changed:
- /Users/eric/own/BurgerGo/expo-rn/screens/tickets/TicketsScreen.tsx
- /Users/eric/own/BurgerGo/expo-rn/screens/tickets/TicketSheet.tsx

No missing endpoints; no out-of-scope paths touched.