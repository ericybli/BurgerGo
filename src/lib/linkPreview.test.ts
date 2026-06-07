import { describe, it, expect } from 'vitest';
import { isHttpUrl, isBlockedAddress } from '@/src/lib/linkPreview';

describe('isHttpUrl', () => {
  it('accepts http and https', () => {
    expect(isHttpUrl('http://example.com')).toBe(true);
    expect(isHttpUrl('https://example.com/path')).toBe(true);
  });

  it('rejects other schemes', () => {
    expect(isHttpUrl('ftp://example.com')).toBe(false);
    expect(isHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/html,x')).toBe(false);
  });

  it('rejects non-URLs', () => {
    expect(isHttpUrl('not a url')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
  });
});

describe('isBlockedAddress', () => {
  it('blocks IPv4 loopback (127/8)', () => {
    expect(isBlockedAddress('127.0.0.1')).toBe(true);
    expect(isBlockedAddress('127.255.255.254')).toBe(true);
  });

  it('blocks IPv6 loopback (::1)', () => {
    expect(isBlockedAddress('::1')).toBe(true);
  });

  it('blocks RFC1918 private 10/8', () => {
    expect(isBlockedAddress('10.0.0.1')).toBe(true);
    expect(isBlockedAddress('10.255.255.255')).toBe(true);
  });

  it('blocks RFC1918 private 172.16/12', () => {
    expect(isBlockedAddress('172.16.0.1')).toBe(true);
    expect(isBlockedAddress('172.31.255.255')).toBe(true);
  });

  it('does not block 172.15/172.32 (just outside 172.16/12)', () => {
    expect(isBlockedAddress('172.15.255.255')).toBe(false);
    expect(isBlockedAddress('172.32.0.1')).toBe(false);
  });

  it('blocks RFC1918 private 192.168/16', () => {
    expect(isBlockedAddress('192.168.0.1')).toBe(true);
    expect(isBlockedAddress('192.168.255.255')).toBe(true);
  });

  it('blocks IPv4 link-local 169.254/16', () => {
    expect(isBlockedAddress('169.254.1.1')).toBe(true);
  });

  it('blocks the cloud-metadata address 169.254.169.254', () => {
    expect(isBlockedAddress('169.254.169.254')).toBe(true);
  });

  it('blocks IPv6 link-local fe80::/10', () => {
    expect(isBlockedAddress('fe80::1')).toBe(true);
    expect(isBlockedAddress('febf::1')).toBe(true);
  });

  it('blocks IPv6 unique-local fc00::/7', () => {
    expect(isBlockedAddress('fc00::1')).toBe(true);
    expect(isBlockedAddress('fd12:3456::1')).toBe(true);
  });

  it('blocks CGNAT 100.64/10', () => {
    expect(isBlockedAddress('100.64.0.1')).toBe(true);
    expect(isBlockedAddress('100.127.255.255')).toBe(true);
  });

  it('does not block 100.63/100.128 (just outside CGNAT 100.64/10)', () => {
    expect(isBlockedAddress('100.63.255.255')).toBe(false);
    expect(isBlockedAddress('100.128.0.1')).toBe(false);
  });

  it('blocks RFC1122 "this host" 0.0.0.0/8', () => {
    expect(isBlockedAddress('0.0.0.0')).toBe(true);
    expect(isBlockedAddress('0.0.0.1')).toBe(true);
    expect(isBlockedAddress('0.255.255.255')).toBe(true);
  });

  it('blocks IPv6 unspecified address :: and all-zero form', () => {
    expect(isBlockedAddress('::')).toBe(true);
    expect(isBlockedAddress('0:0:0:0:0:0:0:0')).toBe(true);
  });

  it('blocks IPv4-compatible ::a.b.c.d (loopback, private)', () => {
    expect(isBlockedAddress('::127.0.0.1')).toBe(true);   // loopback
    expect(isBlockedAddress('::10.0.0.1')).toBe(true);    // private
  });

  it('blocks broadcast address 255.255.255.255', () => {
    expect(isBlockedAddress('255.255.255.255')).toBe(true);
  });

  it('allows ordinary public IPv4 addresses', () => {
    expect(isBlockedAddress('8.8.8.8')).toBe(false);
    expect(isBlockedAddress('1.1.1.1')).toBe(false);
    expect(isBlockedAddress('93.184.216.34')).toBe(false);
  });

  it('allows ordinary public IPv6 addresses', () => {
    expect(isBlockedAddress('2606:4700:4700::1111')).toBe(false);
  });

  it('blocks IPv4-mapped IPv6 of private/metadata addresses, allows a public one', () => {
    expect(isBlockedAddress('::ffff:10.0.0.1')).toBe(true);
    expect(isBlockedAddress('::ffff:192.168.1.1')).toBe(true);
    expect(isBlockedAddress('::ffff:169.254.169.254')).toBe(true);
    expect(isBlockedAddress('::ffff:8.8.8.8')).toBe(false);
  });

  it('blocks IPv4-mapped IPv6 in hex notation (::ffff:7f00:1 → 127.0.0.1)', () => {
    expect(isBlockedAddress('::ffff:7f00:1')).toBe(true);    // 127.0.0.1
    expect(isBlockedAddress('::ffff:a00:1')).toBe(true);     // 10.0.0.1
  });

  it('blocks IPv4-mapped IPv6 in fully-expanded notation', () => {
    expect(isBlockedAddress('0:0:0:0:0:ffff:7f00:1')).toBe(true); // 127.0.0.1
  });

  it('allows public IPv4-mapped IPv6 in hex notation', () => {
    expect(isBlockedAddress('::ffff:0808:0808')).toBe(false); // 8.8.8.8
  });

  it('treats unparseable input as blocked (fail closed)', () => {
    expect(isBlockedAddress('not an ip')).toBe(true);
    expect(isBlockedAddress('')).toBe(true);
  });
});
