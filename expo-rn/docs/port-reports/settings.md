Gate passes (exit 0, zero errors). Final report:

FILES
- /Users/eric/own/BurgerGo/expo-rn/screens/settings/SettingsScreen.tsx — rewritten (Atlas restyle + new Map card + merged Offline/Data card)
- /Users/eric/own/BurgerGo/expo-rn/screens/settings/settingsApi.ts — new, local settings API contract (clusterPins-aware GET/PATCH built on lib/api/client's getJson/writeJson)

SPEC ITEMS COMPLETED
1. Map card "Cluster nearby pins" toggle: placed between Currency and AI cards; heading "Map"; whole row is the tap target (Pressable, pressed → accentTint bg) plus RN Switch (trackColor true=colors.accent, ios_backgroundColor=line); checked = `row?.clusterPins !== false`; optimistic PATCH `{ clusterPins: boolean }` with revert-on-failure; "Saved ✓" in accent / "Couldn't save — please try again." in danger / nothing when idle; disabled offline/busy + OfflineHint.
2–3. clusterPins typing: shared lib/api files are foundation-owned (forbidden to edit), so the widened types live locally in settingsApi.ts (`SettingsRow = Settings & { clusterPins?: boolean | null }`, `SettingsPatch` incl. clusterPins). Verified field names against web `app/api/settings/route.ts`: PATCH body keys are `currency`, `prompt`, `model`, `clusterPins`; AI save sends BOTH prompt+model (key-presence = intent).
4. "Offline & install" + "Your data" merged into ONE card with hairline divider; kept RN-appropriate offline copy ("Works offline for reading. Editing your trip needs a connection.") — intentional deviation from the web's PWA/HTTPS sentence, per spec.
5. Atlas restyle: all text uses `type.*` fragments (no bare fontWeight), legacy tokens (inkMuted/success) purged from the screen; status colors fixed per web mapping — currency "Currency saved ✓" and map "Saved ✓" = colors.accent, AI "Saved" = colors.sub, errors = colors.danger, idle hints = colors.faint; currency hint now faint; Language row = body ink / label sub; About card p-24 centered, logo now `assets/burgergo-logo.png` (transparent cat, matches web) 88×88 opacity 0.9, version tabular-nums; AI Save = solid orange kit Button, "Reset to default" switched from ghost(danger) to variant="text" (accent), AI status inline next to the buttons (web layout). The ui-kit recipes themselves were already Atlas Light (cards shadowless, orange primary, surface+faint disabled) — no kit changes needed or allowed.
6. Header parity: root stack (App.tsx) already renders the "Settings" title + back chevron natively — no in-screen title added (intentional adaptation, navigator is foundation-owned).
7. Edge cases preserved: blank prompt/model sent untrimmed (server NULLs them); unknown stored model coerced to default display-only (never auto-saved); currency save does NOT revert on error while cluster toggle DOES; stored-currency-outside-list prepended as bare-code option; per-card busy flags (spec-blessed RN adaptation of web's shared isPending); editing model/prompt resets AI status to idle; copy strings match web messages/en.json exactly (ASCII apostrophes: "Couldn't save — please try again.", "place's intro").

NOT DONE
- None functional. Layout note: the Currency control renders as the kit's labeled full-width Select (label above) rather than the web's inline right-aligned select — the spec's "Already in RN seed (works as-is)" section explicitly blesses this.

CONTRACT ASSUMPTIONS
- Importing (not editing) `lib/api/client`'s exported `getJson`/`writeJson` from my own folder is within the file-ownership rules; if the foundation later adds `clusterPins` to `lib/api/types.ts`, my local `SettingsRow` intersection stays compatible (`Settings & { clusterPins?: boolean | null }`).
- GET `/api/settings` may return `null` (no row yet) → defaults USD / cluster ON / empty prompt / gpt-5.4-mini, same as fetch failure.

GATE: `npx tsc --noEmit` in /Users/eric/own/BurgerGo/expo-rn → exit 0, no errors.