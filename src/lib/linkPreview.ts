/**
 * Pure URL/SSRF guard primitives for the link-preview route (Plan 3 §6.4).
 * These are synchronous and dependency-free so they unit-test in isolation;
 * the route does DNS resolution and calls `isBlockedAddress` on every resolved
 * IP (initial host + each redirect hop). Helpers fail CLOSED: anything we
 * cannot parse is treated as blocked.
 */

/** True only for absolute http:/https: URLs. */
export function isHttpUrl(raw: string): boolean {
  try {
    const proto = new URL(raw).protocol;
    return proto === 'http:' || proto === 'https:';
  } catch {
    return false;
  }
}

/** Parse a dotted-quad IPv4 string to a 32-bit number, or null if invalid. */
function parseIPv4(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

/** True if `value` is inside the CIDR block `base/prefix` (IPv4, 32-bit ints). */
function inV4Cidr(value: number, base: string, prefix: number): boolean {
  const baseNum = parseIPv4(base);
  if (baseNum === null) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (baseNum & mask);
}

/**
 * True if the IP is one we must never fetch: loopback (127/8, ::1), RFC1918
 * private (10/8, 172.16/12, 192.168/16), link-local (169.254/16, fe80::/10),
 * IPv6 unique-local (fc00::/7), CGNAT (100.64/10), or the cloud-metadata
 * address 169.254.169.254. Unparseable input returns true (fail closed).
 */
export function isBlockedAddress(ip: string): boolean {
  const v4 = parseIPv4(ip);
  if (v4 !== null) {
    return (
      inV4Cidr(v4, '127.0.0.0', 8) || // loopback
      inV4Cidr(v4, '10.0.0.0', 8) || // private
      inV4Cidr(v4, '172.16.0.0', 12) || // private
      inV4Cidr(v4, '192.168.0.0', 16) || // private
      inV4Cidr(v4, '169.254.0.0', 16) || // link-local (incl. 169.254.169.254)
      inV4Cidr(v4, '100.64.0.0', 10) // CGNAT
    );
  }

  // IPv6 (and IPv4-mapped) — normalize and inspect the leading hextets.
  const lower = ip.toLowerCase();
  if (lower === '::1') return true; // loopback

  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — re-check the embedded IPv4.
  const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped && mapped[1]) return isBlockedAddress(mapped[1]);

  const firstHextet = lower.split(':')[0] ?? ''; // '' → fails the test below → blocked
  if (!/^[0-9a-f]{1,4}$/.test(firstHextet)) return true; // unparseable → blocked
  const block = parseInt(firstHextet, 16);

  // fc00::/7 unique-local → first 7 bits are 1111110.
  if ((block & 0xfe00) === 0xfc00) return true;
  // fe80::/10 link-local → first 10 bits are 1111111010.
  if ((block & 0xffc0) === 0xfe80) return true;

  return false;
}
