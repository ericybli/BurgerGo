import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * `basePath.ts` reads `process.env.NEXT_PUBLIC_BASE_PATH` once at module load
 * (Next inlines it as a literal in the real build). To exercise both the default
 * and a configured prefix we re-import the module with `vi.resetModules()` after
 * mutating the env, mirroring the build-time inlining.
 */
async function loadWithBasePath(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = value;
  return import('./basePath');
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_BASE_PATH;
  vi.resetModules();
});

describe('basePath', () => {
  it('defaults BASE_PATH to "" and withBase is a no-op prefix when unset', async () => {
    const { BASE_PATH, withBase } = await loadWithBasePath(undefined);
    expect(BASE_PATH).toBe('');
    expect(withBase('/api/trips')).toBe('/api/trips');
    expect(withBase('/sw.js')).toBe('/sw.js');
  });

  it('treats an explicit empty string the same as unset (root deployment)', async () => {
    const { BASE_PATH, withBase } = await loadWithBasePath('');
    expect(BASE_PATH).toBe('');
    expect(withBase('/api/settings')).toBe('/api/settings');
  });

  it('prefixes every path with a configured sub-path', async () => {
    const { BASE_PATH, withBase } = await loadWithBasePath('/burgergo');
    expect(BASE_PATH).toBe('/burgergo');
    expect(withBase('/api/trips')).toBe('/burgergo/api/trips');
    expect(withBase('/api/trips/abc-123')).toBe('/burgergo/api/trips/abc-123');
    expect(withBase('/manifest.webmanifest')).toBe('/burgergo/manifest.webmanifest');
    expect(withBase('/sw.js')).toBe('/burgergo/sw.js');
  });
});
