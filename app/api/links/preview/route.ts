import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { NextResponse } from 'next/server';
import { parse } from 'node-html-parser';
import { env } from '@/src/env';
import { newId } from '@/src/db/ids';
import { isHttpUrl, isBlockedAddress } from '@/src/lib/linkPreview';
import { writeLinkThumb } from '@/src/lib/links/thumbPipeline';

export const dynamic = 'force-dynamic';

const FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 2 * 1024 * 1024; // ~2 MB HTML cap
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // OG-image cap before sharp
const MAX_REDIRECTS = 3;

/** Resolve a host to addresses and reject if any address is SSRF-blocked. */
async function assertHostAllowed(host: string): Promise<boolean> {
  // Literal IP host → check directly, no DNS.
  if (isIP(host)) return !isBlockedAddress(host);
  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true });
  } catch {
    return false;
  }
  if (records.length === 0) return false;
  return records.every((r) => !isBlockedAddress(r.address));
}

/** Read a response body with a hard byte cap; returns null if exceeded. */
async function readCapped(res: Response, cap: number): Promise<Buffer | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > cap) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks);
}

/**
 * Fetch a URL following up to MAX_REDIRECTS manual redirects, re-validating
 * every hop's host against the SSRF blocklist. Returns the final Response, or
 * null if a hop is blocked / too many redirects / a network error occurs.
 */
async function safeFetch(initialUrl: string): Promise<Response | null> {
  let current = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return null;
    }
    if (!isHttpUrl(current)) return null;
    if (!(await assertHostAllowed(parsed.hostname))) return null;

    let res: Response;
    try {
      res = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { accept: 'text/html,application/xhtml+xml' },
      });
    } catch {
      return null;
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return null;
      current = new URL(loc, current).toString();
      continue; // re-validate the redirect target host on the next iteration
    }
    return res;
  }
  return null; // too many redirects
}

export async function POST(req: Request): Promise<Response> {
  let body: { url?: unknown; tripId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const url = body.url;
  const tripId = body.tripId;
  if (typeof url !== 'string' || typeof tripId !== 'string' || tripId === '') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!isHttpUrl(url)) {
    return NextResponse.json({ error: 'bad_scheme' }, { status: 400 });
  }

  // Everything past validation is best-effort: any failure → {} with 200.
  try {
    const pageRes = await safeFetch(url);
    if (!pageRes || !pageRes.ok) return NextResponse.json({});
    const ct = pageRes.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml\+xml/.test(ct)) return NextResponse.json({});

    const htmlBuf = await readCapped(pageRes, MAX_HTML_BYTES);
    if (!htmlBuf) return NextResponse.json({});
    const root = parse(htmlBuf.toString('utf8'));

    const ogTitle = root
      .querySelector('meta[property="og:title"]')
      ?.getAttribute('content')
      ?.trim();
    const docTitle = root.querySelector('title')?.text?.trim();
    const title = ogTitle || docTitle || undefined;

    const ogImage = root
      .querySelector('meta[property="og:image"]')
      ?.getAttribute('content')
      ?.trim();

    const result: { title?: string; thumbnailPath?: string } = {};
    if (title) result.title = title;

    if (ogImage) {
      try {
        const imageUrl = new URL(ogImage, url).toString();
        const imgRes = await safeFetch(imageUrl);
        if (imgRes && imgRes.ok) {
          const imgCt = imgRes.headers.get('content-type') ?? '';
          if (imgCt.startsWith('image/')) {
            const imgBuf = await readCapped(imgRes, MAX_IMAGE_BYTES);
            if (imgBuf) {
              const { relPath } = await writeLinkThumb({
                buffer: imgBuf,
                uploadsDir: env.UPLOADS_DIR,
                tripId,
                thumbId: newId(),
              });
              result.thumbnailPath = relPath;
            }
          }
        }
      } catch {
        // Thumbnail is best-effort; keep the title-only result.
      }
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({});
  }
}
