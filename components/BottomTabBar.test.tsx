import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

const usePathname = vi.fn(() => '/trip/t1/plan');
vi.mock('next/navigation', () => ({
  usePathname: () => usePathname(),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { BottomTabBar } from './BottomTabBar';

function renderBar() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <BottomTabBar tripId="t1" />
    </NextIntlClientProvider>,
  );
}

describe('BottomTabBar', () => {
  it('renders all four tabs with correct hrefs', () => {
    renderBar();
    expect(screen.getByRole('link', { name: en.tabs.plan }).getAttribute('href')).toBe(
      '/trip/t1/plan',
    );
    expect(screen.getByRole('link', { name: en.tabs.eats }).getAttribute('href')).toBe(
      '/trip/t1/eats',
    );
    expect(screen.getByRole('link', { name: en.tabs.budget }).getAttribute('href')).toBe(
      '/trip/t1/budget',
    );
    expect(screen.getByRole('link', { name: en.tabs.journal }).getAttribute('href')).toBe(
      '/trip/t1/journal',
    );
  });

  it('marks the active tab with aria-current based on the pathname', () => {
    usePathname.mockReturnValue('/trip/t1/eats');
    renderBar();
    expect(screen.getByRole('link', { name: en.tabs.eats })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: en.tabs.plan })).not.toHaveAttribute(
      'aria-current',
    );
  });
});
