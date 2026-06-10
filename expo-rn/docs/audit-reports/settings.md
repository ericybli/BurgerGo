# settings audit

Checked: 40

## Must-fix


## Accepted/platform
- About-card version is a hardcoded RN constant, not the web's build-time package version [acceptable]
- 'Offline & install' body copy adapted for native (PWA/HTTPS sentence dropped) [acceptable]
- Currency control layout: full-width labeled Select instead of web's inline right-aligned select; out-of-list stored code prepended instead of appended [acceptable]
- Per-card busy flags instead of web's single shared isPending [acceptable]
- RN gates first render behind a Loading state; web renders defaults instantly [acceptable]
- Cluster row wires both the parent Pressable and the Switch — possible duplicate PATCH on react-native-web only [acceptable]
- Micro cosmetic disabled-state differences (Select dim 0.5 vs web 0.6; prompt field doesn't visually dim when offline; busy Save button shows '…') [acceptable]

## Fix report
NOTHING TO FIX