import { describe, it, expect } from 'vitest';
import en from '@/messages/en.json';

describe('en.json settings namespace', () => {
  // Existing 1A keys plus the new Plan 3 About strings.
  const required = [
    'title', 'language', 'currency', 'comingSoon', 'aboutTagline',
    'aboutVersion',
    'offlineInstallTitle', 'offlineInstallBody',
    'yourDataTitle', 'yourDataBody', 'yourDataBackup',
  ];

  it('defines every settings UI key', () => {
    const s: Record<string, unknown> = en.settings as unknown as Record<string, unknown>;
    expect(s).toBeDefined();
    for (const k of required) expect(s[k], `settings.${k}`).toBeTypeOf('string');
  });

  it('formats the version label with a {version} placeholder', () => {
    const s = en.settings as unknown as Record<string, string>;
    expect(s.aboutVersion).toContain('{version}');
  });
});
