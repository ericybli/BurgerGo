import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const updateCurrencyAction = vi.fn(async (..._a: any[]) => ({}));
vi.mock('@/app/_actions/settings', () => ({
  updateAiSettingsAction: vi.fn(async () => ({})),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateCurrencyAction: (...a: any[]) => updateCurrencyAction(...a),
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
  delete process.env.NEXT_PUBLIC_APP_VERSION;
  vi.resetModules();
});

describe('SettingsClient', () => {
  it('renders the static chrome (title + back link) immediately', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})) as unknown as typeof fetch);
    renderSettings();
    expect(screen.getByText(en.settings.title)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.trip.back }).getAttribute('href')).toBe('/');
  });

  it('shows English (fixed) + the stored currency in the editable select', async () => {
    mockFetchSettings({ language: 'zh', currency: 'JPY' });
    renderSettings();
    // Language is English-only now (fixed display); currency is an editable select.
    expect(await screen.findByText(en.settings.languageEnglish)).toBeInTheDocument();
    const cur = (await screen.findByRole('combobox', { name: en.settings.currency })) as HTMLSelectElement;
    await waitFor(() => expect(cur.value).toBe('JPY'));
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
    const cur = (await screen.findByRole('combobox', { name: en.settings.currency })) as HTMLSelectElement;
    await waitFor(() => expect(cur.value).toBe('JPY'));
    expect(fetchMock).toHaveBeenCalledWith('/burgergo/api/settings', { credentials: 'same-origin' });
  });

  it('falls back to USD when settings are not yet seeded (null)', async () => {
    mockFetchSettings(null);
    renderSettings();
    expect(await screen.findByText(en.settings.languageEnglish)).toBeInTheDocument();
    const cur = (await screen.findByRole('combobox', { name: en.settings.currency })) as HTMLSelectElement;
    expect(cur.value).toBe('USD');
  });

  it('shows the USD fallback and does not crash when fetch throws (offline, no cache)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => { throw new Error('Failed to fetch'); }) as unknown as typeof fetch,
    );
    renderSettings();
    // The static chrome renders immediately regardless.
    expect(screen.getByText(en.settings.title)).toBeInTheDocument();
    // Fallback default is displayed — no crash.
    const cur = (await screen.findByRole('combobox', { name: en.settings.currency })) as HTMLSelectElement;
    expect(cur.value).toBe('USD');
  });

  it('saves the chosen currency via updateCurrencyAction', async () => {
    mockFetchSettings({ language: 'en', currency: 'USD' });
    renderSettings();
    const cur = (await screen.findByRole('combobox', { name: en.settings.currency })) as HTMLSelectElement;
    await userEvent.selectOptions(cur, 'EUR');
    await waitFor(() => expect(updateCurrencyAction).toHaveBeenCalledWith({ currency: 'EUR' }));
    expect(cur.value).toBe('EUR');
  });

  it('renders the AI model as a dropdown with the four options, defaulting to gpt-5.4-mini', async () => {
    mockFetchSettings({ language: 'en', currency: 'USD' });
    renderSettings();
    const select = (await screen.findByRole('combobox', { name: en.settings.aiModelLabel })) as HTMLSelectElement;
    expect(select.value).toBe('gpt-5.4-mini');
    expect([...select.querySelectorAll('option')].map((o) => o.value)).toEqual([
      'gpt-5.5-pro', 'gpt-5.5', 'gpt-5.4-mini', 'gpt-5.4-nano',
    ]);
  });

  it('selects a stored model that is one of the options', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, json: async () => ({ language: 'en', currency: 'USD', aiPrompt: null, aiModel: 'gpt-5.5-pro' }),
    })) as unknown as typeof fetch);
    renderSettings();
    const select = (await screen.findByRole('combobox', { name: en.settings.aiModelLabel })) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('gpt-5.5-pro'));
  });

  it('renders the About block: wordmark, tagline, version, and both info rows', () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '9.9.9';
    mockFetchSettings({ language: 'en', currency: 'USD' });
    renderSettings();

    // Wordmark + tagline (mascot image + app name).
    expect(screen.getByText(en.app.name)).toBeInTheDocument();
    expect(screen.getByText(en.settings.aboutTagline)).toBeInTheDocument();

    // Version line — value is the inlined literal at module-eval time. The
    // string is formatted as `Version {version}`; assert the label prefix and
    // that some version token is shown (env is read at import; see note below).
    expect(screen.getByText(/^Version\b/)).toBeInTheDocument();

    // Both quiet info rows render their titles + bodies.
    expect(screen.getByText(en.settings.offlineInstallTitle)).toBeInTheDocument();
    expect(screen.getByText(en.settings.offlineInstallBody)).toBeInTheDocument();
    expect(screen.getByText(en.settings.yourDataTitle)).toBeInTheDocument();
    expect(screen.getByText(en.settings.yourDataBody)).toBeInTheDocument();
    expect(screen.getByText(en.settings.yourDataBackup)).toBeInTheDocument();
  });

  it('shows the "dev" version fallback when NEXT_PUBLIC_APP_VERSION is unset', async () => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    const { SettingsClient: Fresh } = await import('./SettingsClient');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ language: 'en', currency: 'USD' }) })) as unknown as typeof fetch,
    );
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Fresh />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('Version dev')).toBeInTheDocument();
  });
});
