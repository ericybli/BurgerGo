/**
 * App version surfaced in Settings → About.
 *
 * `NEXT_PUBLIC_APP_VERSION` is populated from `package.json` `version` in
 * `next.config.ts` and inlined as a string literal at build time (same
 * mechanism as `NEXT_PUBLIC_BASE_PATH`). Because this is a build-time literal
 * with no runtime/server I/O, reading it in a client component does NOT
 * force-dynamic the static settings route. Falls back to `'dev'` in test/dev
 * runs where the var is unset.
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';
