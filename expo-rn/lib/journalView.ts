/** Pure journal helpers, ported from the web `src/lib/journalView.ts`. */

/** Plain-text excerpt of markdown body for feed cards. */
export function entrySnippet(body: string, maxLen = 140): string {
  let s = body;
  s = s.replace(/`([^`]+)`/g, '$1'); // inline code
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ''); // images
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'); // links → text
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, ''); // ATX headings
  s = s.replace(/[*_]+/g, ''); // emphasis markers
  s = s.replace(/\s+/g, ' ').trim(); // collapse whitespace
  return s.length <= maxLen ? s : `${s.slice(0, maxLen)}…`;
}

/** Hostname without leading `www.`, lowercased; "" on parse failure. */
export function linkDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Card heading: the title if non-blank, else the URL's domain. */
export function linkHeading(title: string | null, url: string): string {
  return title && title.trim() ? title : linkDomain(url);
}

export function isHttpUrl(raw: string): boolean {
  try {
    const p = new URL(raw).protocol;
    return p === 'http:' || p === 'https:';
  } catch {
    return false;
  }
}

const WEEKDAYS_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

/** "YYYY-MM-DD · Weekday"; drops the weekday suffix if the date won't parse. */
export function entryDateLabel(entryDate: string): string {
  const d = new Date(`${entryDate}T00:00:00Z`);
  const wd = WEEKDAYS_LONG[d.getUTCDay()];
  return wd && !Number.isNaN(d.getTime()) ? `${entryDate} · ${wd}` : entryDate;
}
