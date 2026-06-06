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

afterEach(() => vi.unstubAllGlobals());

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

  it('falls back to en/USD when settings are not yet seeded (null)', async () => {
    mockFetchSettings(null);
    renderSettings();
    expect(await screen.findByText('en')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
  });
});
