import { describe, it, expect, vi } from 'vitest';

// next-intl/server must be mocked in jsdom to avoid the "not supported in Client Components" error.
vi.mock('next-intl/server', () => ({
  getRequestConfig: (fn: (a: unknown) => unknown) => fn,
}));

import getRequestConfig from './request';

describe('i18n/request', () => {
  it('returns the static en locale and loads en messages (no cookie read)', async () => {
    // next-intl calls the default export with an internal arg object.
    const config = await (getRequestConfig as unknown as (a: unknown) => Promise<{
      locale: string;
      messages: Record<string, unknown>;
    }>)({});
    expect(config.locale).toBe('en');
    expect(config.messages).toBeTypeOf('object');
    expect((config.messages as Record<string, Record<string, string>>)['home']?.['title']).toBe(
      'BurgerGo',
    );
  });
});
