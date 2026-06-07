/**
 * Pure Journal view helpers (Plan 3 §4–§5). Shared by JournalClient, the entry
 * feed, and LinkRow so UI and tests use one source of truth. No DB / DOM access.
 */

const DEFAULT_SNIPPET_LEN = 140;

/**
 * Plain-text excerpt of a markdown body for feed cards. Strips the common
 * inline/block markdown syntax (heading `#`, emphasis `*`/`_`, inline code
 * backticks, and `[text](url)` links → `text`), collapses whitespace, and
 * truncates to `maxLen` with a trailing ellipsis when it had to cut.
 */
export function entrySnippet(body: string, maxLen = DEFAULT_SNIPPET_LEN): string {
  const plain = body
    .replace(/`([^`]*)`/g, '$1') // inline code → its contents
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images → drop
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → link text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // ATX heading markers
    .replace(/[*_]+/g, '') // bold/italic markers
    .replace(/\s+/g, ' ') // collapse whitespace/newlines
    .trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen)}…`;
}

/**
 * Display domain for a saved link: the URL hostname without a leading `www.`,
 * lowercased. Returns '' when the input is not a parseable absolute URL.
 */
export function linkDomain(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.replace(/^www\./, '');
  } catch {
    return '';
  }
}
