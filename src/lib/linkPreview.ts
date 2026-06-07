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
    if (v4 === 0xffffffff) return true; // 255.255.255.255 broadcast
    return (
      inV4Cidr(v4, '0.0.0.0', 8) || // RFC1122 "this host" (0.0.0.0–0.255.255.255)
      inV4Cidr(v4, '127.0.0.0', 8) || // loopback
      inV4Cidr(v4, '10.0.0.0', 8) || // private
      inV4Cidr(v4, '172.16.0.0', 12) || // private
      inV4Cidr(v4, '192.168.0.0', 16) || // private
      inV4Cidr(v4, '169.254.0.0', 16) || // link-local (incl. 169.254.169.254)
      inV4Cidr(v4, '100.64.0.0', 10) // CGNAT
    );
  }

  // IPv6 — expand to 8 hextets so we can inspect all notations uniformly.
  const hextets = expandIPv6(ip.toLowerCase());
  if (hextets === null) return true; // unparseable → fail closed

  // ::1 loopback (all-zero except last === 1).
  if (hextets.every((h, i) => (i === 7 ? h === 1 : h === 0))) return true;

  // IPv4-mapped ::ffff:x:y (hextets[0..4] === 0, hextets[5] === 0xffff).
  // Covers compressed dotted (::ffff:1.2.3.4), hex (::ffff:7f00:1),
  // and fully-expanded (0:0:0:0:0:ffff:7f00:1) forms.
  if (
    hextets[0] === 0 && hextets[1] === 0 && hextets[2] === 0 &&
    hextets[3] === 0 && hextets[4] === 0 && hextets[5] === 0xffff
  ) {
    // Also accept the compressed dotted notation ::ffff:a.b.c.d directly.
    const dottedMapped = ip.toLowerCase().match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (dottedMapped && dottedMapped[1]) return isBlockedAddress(dottedMapped[1]);
    // Hex form: reconstruct embedded IPv4 from hextets[6] and hextets[7].
    const h6 = hextets[6]!;
    const h7 = hextets[7]!;
    const embeddedIPv4 = `${h6 >> 8}.${h6 & 255}.${h7 >> 8}.${h7 & 255}`;
    return isBlockedAddress(embeddedIPv4);
  }

  const block = hextets[0]!;
  // fc00::/7 unique-local → first 7 bits are 1111110.
  if ((block & 0xfe00) === 0xfc00) return true;
  // fe80::/10 link-local → first 10 bits are 1111111010.
  if ((block & 0xffc0) === 0xfe80) return true;

  return false;
}

/**
 * Expand an IPv6 address string (lower-cased) into exactly 8 16-bit hextets.
 * Handles a single `::` zero-compression run. Returns null if unparseable.
 */
function expandIPv6(lower: string): number[] | null {
  // Handle embedded IPv4 in dotted form (::ffff:a.b.c.d) by converting the
  // dotted quad to two hex hextets before expanding.
  const withDotted = lower.replace(
    /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
    (_, a, b, c, d) => {
      const hi = (Number(a) << 8) | Number(b);
      const lo = (Number(c) << 8) | Number(d);
      return `${hi.toString(16)}:${lo.toString(16)}`;
    },
  );

  const halves = withDotted.split('::');
  if (halves.length > 2) return null; // multiple :: → invalid

  const parseGroup = (s: string): number[] | null => {
    if (s === '') return [];
    const parts = s.split(':');
    const nums: number[] = [];
    for (const p of parts) {
      if (!/^[0-9a-f]{1,4}$/.test(p)) return null;
      nums.push(parseInt(p, 16));
    }
    return nums;
  };

  if (halves.length === 1) {
    // No :: compression.
    const result = parseGroup(halves[0]!);
    if (result === null || result.length !== 8) return null;
    return result;
  }

  // Has :: compression.
  const left = parseGroup(halves[0]!);
  const right = parseGroup(halves[1]!);
  if (left === null || right === null) return null;
  const zeros = 8 - left.length - right.length;
  if (zeros < 0) return null;
  return [...left, ...Array(zeros).fill(0) as number[], ...right];
}
