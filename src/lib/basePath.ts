/**
 * Single source of truth for the deploy sub-path (spec: configurable URL prefix).
 *
 * `NEXT_PUBLIC_BASE_PATH` is inlined as a string literal at build time, so this
 * resolves identically on the server and in the client bundle. Empty (`''`) =
 * root deployment (today's behaviour); `/burgergo` = mounted under that prefix.
 *
 * Next's `basePath` already auto-prefixes pages, route handlers, `_next` assets,
 * `<Link>`, next/font, next/image and `public/` files — but NOT raw `fetch()`
 * strings, SW registration, the SW's own matchers, or manifest member URLs.
 * Those call sites use `withBase()` (or the runtime-derived base in the SW).
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Prefix an absolute, root-relative path (must start with `/`) with the base path. */
export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
