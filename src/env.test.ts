import { describe, it, expect } from 'vitest';
import { parseEnv } from '@/src/env';

describe('parseEnv', () => {
  it('applies test-safe defaults when nothing is provided', () => {
    const env = parseEnv({});
    expect(env.DATABASE_PATH).toBe('./burgergo.db');
    expect(env.UPLOADS_DIR).toBe('./uploads');
    expect(env.DEFAULT_CURRENCY).toBe('USD');
    expect(env.DEFAULT_LANGUAGE).toBe('en');
    expect(env.TZ).toBe('UTC');
    expect(env.GOOGLE_MAPS_SERVER_KEY).toBeUndefined();
    expect(env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).toBe('');
  });

  it('reads provided values', () => {
    const env = parseEnv({
      DATABASE_PATH: '/data/app.db',
      UPLOADS_DIR: '/data/uploads',
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: 'browser-key',
      GOOGLE_MAPS_SERVER_KEY: 'server-key',
      DEFAULT_CURRENCY: 'JPY',
      DEFAULT_LANGUAGE: 'zh',
      TZ: 'Asia/Tokyo',
    });
    expect(env.DATABASE_PATH).toBe('/data/app.db');
    expect(env.UPLOADS_DIR).toBe('/data/uploads');
    expect(env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).toBe('browser-key');
    expect(env.GOOGLE_MAPS_SERVER_KEY).toBe('server-key');
    expect(env.DEFAULT_CURRENCY).toBe('JPY');
    expect(env.DEFAULT_LANGUAGE).toBe('zh');
    expect(env.TZ).toBe('Asia/Tokyo');
  });

  it('rejects an invalid DEFAULT_LANGUAGE', () => {
    expect(() => parseEnv({ DEFAULT_LANGUAGE: 'fr' })).toThrow();
  });

  it('uppercases and rejects a malformed DEFAULT_CURRENCY', () => {
    expect(parseEnv({ DEFAULT_CURRENCY: 'usd' }).DEFAULT_CURRENCY).toBe('USD');
    expect(() => parseEnv({ DEFAULT_CURRENCY: 'US' })).toThrow();
  });

  it('exposes a ready-to-use singleton `env`', async () => {
    const mod = await import('@/src/env');
    expect(typeof mod.env.DATABASE_PATH).toBe('string');
  });
});
