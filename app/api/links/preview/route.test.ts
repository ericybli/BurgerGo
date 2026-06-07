// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));
vi.mock('@/src/db/ids', () => ({ newId: () => 'thumb-fixed' }));

// Mock DNS: default → a public address; override per-test via dnsMap.
// Use vi.hoisted so the lookup fn is available inside vi.mock factory.
const { lookup, dnsMap } = vi.hoisted(() => {
  const dnsMap: Record<string, string> = {};
  const lookup = vi.fn(async (host: string) => {
    const addr = dnsMap[host] ?? '93.184.216.34'; // example.com (public)
    return [{ address: addr, family: addr.includes(':') ? 6 : 4 }];
  });
  return { lookup, dnsMap };
});
vi.mock('node:dns/promises', () => ({ default: { lookup }, lookup }));

// Mock the sharp pipeline for the OG-image derivative.
const writeThumb = vi.fn(async (..._a: unknown[]) => ({ relPath: 'trip-1/links/thumb-fixed.webp' }));
vi.mock('@/src/lib/links/thumbPipeline', () => ({
  writeLinkThumb: (...a: unknown[]) => writeThumb(...(a as [unknown])),
}));

import { POST } from '@/app/api/links/preview/route';

function req(body: unknown) {
  return new Request('http://x/api/links/preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Drive global fetch per-test.
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  lookup.mockClear();
  writeThumb.mockClear();
  for (const k of Object.keys(dnsMap)) delete dnsMap[k];
  vi.stubGlobal('fetch', fetchMock);
});

function htmlResponse(html: string, _finalUrl = 'https://example.com/post') {
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    // node's fetch sets res.url; emulate via a plain object property.
  }) as Response & { url: string };
}

describe('POST /api/links/preview', () => {
  it('returns 400 for a non-http(s) scheme', async () => {
    const res = await POST(req({ url: 'javascript:alert(1)', tripId: 'trip-1' }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 400 when url or tripId is missing', async () => {
    expect((await POST(req({ tripId: 'trip-1' }))).status).toBe(400);
    expect((await POST(req({ url: 'https://example.com' }))).status).toBe(400);
  });

  it('rejects a host that resolves to a loopback/private address (SSRF) with {}', async () => {
    dnsMap['internal.example.com'] = '127.0.0.1';
    const res = await POST(req({ url: 'https://internal.example.com/x', tripId: 'trip-1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a literal private-IP host (SSRF) with {}', async () => {
    const res = await POST(req({ url: 'http://169.254.169.254/latest/meta-data', tripId: 'trip-1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
    // Literal IP → no DNS needed, no fetch.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a redirect to a blocked host with {} (re-validates each hop)', async () => {
    // First hop: a 302 to an internal host. The route follows manually and
    // must re-resolve+reject the redirect target before fetching it.
    dnsMap['evil.example.com'] = '93.184.216.34'; // public (passes first check)
    dnsMap['metadata.internal'] = '169.254.169.254'; // blocked on the hop
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'https://metadata.internal/secret' } }),
    );
    const res = await POST(req({ url: 'https://evil.example.com/start', tripId: 'trip-1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
    // Only the first hop was fetched; the blocked hop was never requested.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('parses og:title + og:image, stores a thumbnail, and returns title + thumbnailPath', async () => {
    const html = `<html><head>
      <meta property="og:title" content="Great Post" />
      <meta property="og:image" content="https://example.com/cover.jpg" />
      <title>fallback</title></head><body>hi</body></html>`;
    fetchMock
      .mockResolvedValueOnce(htmlResponse(html))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }),
      );
    const res = await POST(req({ url: 'https://example.com/post', tripId: 'trip-1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ title: 'Great Post', thumbnailPath: 'trip-1/links/thumb-fixed.webp' });
    expect(writeThumb).toHaveBeenCalledWith(expect.objectContaining({ tripId: 'trip-1' }));
  });

  it('falls back to <title> when og:title is absent and omits thumbnail when no og:image', async () => {
    const html = `<html><head><title>Just A Title</title></head><body>hi</body></html>`;
    fetchMock.mockResolvedValueOnce(htmlResponse(html));
    const res = await POST(req({ url: 'https://example.com/post', tripId: 'trip-1' }));
    expect(await res.json()).toEqual({ title: 'Just A Title' });
    expect(writeThumb).not.toHaveBeenCalled();
  });

  it('returns {} when the page is not HTML', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('PK...', { status: 200, headers: { 'content-type': 'application/zip' } }),
    );
    const res = await POST(req({ url: 'https://example.com/file.zip', tripId: 'trip-1' }));
    expect(await res.json()).toEqual({});
  });

  it('returns {} on a fetch timeout/network error (non-fatal)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('aborted'));
    const res = await POST(req({ url: 'https://example.com/post', tripId: 'trip-1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it('still returns the title when the og:image fetch fails (thumbnail is best-effort)', async () => {
    const html = `<html><head>
      <meta property="og:title" content="Has Image" />
      <meta property="og:image" content="https://example.com/cover.jpg" /></head></html>`;
    fetchMock
      .mockResolvedValueOnce(htmlResponse(html))
      .mockRejectedValueOnce(new Error('image fetch failed'));
    const res = await POST(req({ url: 'https://example.com/post', tripId: 'trip-1' }));
    expect(await res.json()).toEqual({ title: 'Has Image' });
  });
});
