import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { SettingsClient } from './SettingsClient';

function mockFetchSettings(settings: { language: string; currency: string } | null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => settings })) as unknown as typeof fetch,
  );
}

function renderSettings() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <SettingsClient />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_BASE_PATH;
  vi.resetModules();
});

describe('SettingsClient', () => {
  it('renders the static chrome (title + back link) immediately', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})) as unknown as typeof fetch);
    renderSettings();
    expect(screen.getByText(en.settings.title)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.trip.back }).getAttribute('href')).toBe('/');
  });

  it('fetches /api/settings and shows the language + currency', async () => {
    mockFetchSettings({ language: 'zh', currency: 'JPY' });
    renderSettings();
    expect(await screen.findByText('zh')).toBeInTheDocument();
    expect(screen.getByText('JPY')).toBeInTheDocument();
  });

  it('fetches the base-path-prefixed /api/settings when NEXT_PUBLIC_BASE_PATH is set', async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_BASE_PATH = '/burgergo';
    const { SettingsClient: Prefixed } = await import('./SettingsClient');
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ language: 'zh', currency: 'JPY' }) }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Prefixed />
      </NextIntlClientProvider>,
    );
    await screen.findByText('zh');
    expect(fetchMock).toHaveBeenCalledWith('/burgergo/api/settings', { credentials: 'same-origin' });
  });

  it('falls back to en/USD when settings are not yet seeded (null)', async () => {
    mockFetchSettings(null);
    renderSettings();
    expect(await screen.findByText('en')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
  });

  it('shows en/USD fallback and does not crash when fetch throws (offline, no cache)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => { throw new Error('Failed to fetch'); }) as unknown as typeof fetch,
    );
    renderSettings();
    // The static chrome renders immediately regardless.
    expect(screen.getByText(en.settings.title)).toBeInTheDocument();
    // Fallback defaults are displayed — no crash.
    expect(await screen.findByText('en')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
  });
});
