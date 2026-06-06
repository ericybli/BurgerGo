import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { DerivedDay } from '@/src/lib/days';
import { DayStrip } from './DayStrip';

const days: DerivedDay[] = [
  { date: '2026-05-03', dayNumber: 1, weekday: 'Sunday', isToday: false },
  { date: '2026-05-04', dayNumber: 2, weekday: 'Monday', isToday: true },
  { date: '2026-05-05', dayNumber: 3, weekday: 'Tuesday', isToday: false },
];

function renderStrip(selectedDate = '2026-05-04') {
  const onSelect = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DayStrip days={days} selectedDate={selectedDate} onSelect={onSelect} />
    </NextIntlClientProvider>,
  );
  return { onSelect };
}

describe('DayStrip', () => {
  it('renders a chip per day with the day number', () => {
    renderStrip();
    expect(screen.getByRole('button', { name: /Day 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Day 2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Day 3/ })).toBeInTheDocument();
  });

  it('marks the selected chip as current', () => {
    renderStrip('2026-05-05');
    expect(screen.getByRole('button', { name: /Day 3/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /Day 1/ })).not.toHaveAttribute('aria-current');
  });

  it('shows a today dot on the active day', () => {
    renderStrip();
    expect(screen.getByLabelText(en.plan.todayDot)).toBeInTheDocument();
  });

  it('calls onSelect with the chip date', async () => {
    const { onSelect } = renderStrip();
    await userEvent.click(screen.getByRole('button', { name: /Day 3/ }));
    expect(onSelect).toHaveBeenCalledWith('2026-05-05');
  });
});
