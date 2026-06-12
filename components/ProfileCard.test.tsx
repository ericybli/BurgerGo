import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/src/lib/authClient', () => ({
  authClient: { signOut: vi.fn(async () => {}) },
}));

import { ProfileCard } from './ProfileCard';

function renderCard() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ProfileCard />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProfileCard', () => {
  it('renders nothing while /api/me is pending', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})) as unknown as typeof fetch);
    const { container } = renderCard();
    expect(container.firstChild).toBeNull();
  });

  it('renders name, email, and sign-out button once /api/me resolves', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ user: { id: 'u1', name: 'Alice', email: 'alice@example.com', image: null } }),
      })) as unknown as typeof fetch,
    );
    renderCard();
    expect(await screen.findByDisplayValue('Alice')).toBeInTheDocument();
    expect(await screen.findByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.profile.signOut })).toBeInTheDocument();
  });

  it('stays hidden when /api/me returns a non-user shape (e.g. settings fetch mock)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ language: 'en', currency: 'USD' }),
      })) as unknown as typeof fetch,
    );
    const { container } = renderCard();
    // Give it a tick to resolve
    await new Promise((r) => setTimeout(r, 10));
    expect(container.firstChild).toBeNull();
  });
});
