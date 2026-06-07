import { describe, it, expect, afterEach, vi } from 'vitest';

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_VERSION;
  vi.resetModules();
});

describe('APP_VERSION', () => {
  it('reads the inlined NEXT_PUBLIC_APP_VERSION literal', async () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '1.2.3';
    const { APP_VERSION } = await import('./appVersion');
    expect(APP_VERSION).toBe('1.2.3');
  });

  it('falls back to "dev" when the env var is unset', async () => {
    vi.resetModules();
    const { APP_VERSION } = await import('./appVersion');
    expect(APP_VERSION).toBe('dev');
  });
});
