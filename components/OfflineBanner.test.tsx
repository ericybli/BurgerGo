import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { OfflineBanner } from './OfflineBanner';
import messages from '../messages/en.json';

function renderBanner() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OfflineBanner />
    </NextIntlClientProvider>,
  );
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

describe('OfflineBanner', () => {
  beforeEach(() => setOnline(true));
  afterEach(() => setOnline(true));

  it('is hidden while online', () => {
    renderBanner();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the localized Teal banner when going offline', () => {
    renderBanner();
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    const banner = screen.getByRole('status');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(messages.offline.banner);
    // Teal strip (spec §3.7 / §9.2) — applied via the `bg-teal` Tailwind token.
    expect(banner).toHaveClass('bg-teal');
  });

  it('renders offline immediately if the page mounts already offline', () => {
    setOnline(false);
    renderBanner();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('hides again when connectivity returns', () => {
    setOnline(false);
    renderBanner();
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
