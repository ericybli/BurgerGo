import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DayPickerSheet } from './DayPickerSheet';
import type { DerivedDay } from '@/src/lib/days';

const DAYS: DerivedDay[] = [
  { date: '2026-06-05', dayNumber: 1, weekday: 'Friday', isToday: false },
  { date: '2026-06-06', dayNumber: 2, weekday: 'Saturday', isToday: true },
];

describe('DayPickerSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <DayPickerSheet open={false} title="Move to which day?" days={DAYS} onPick={vi.fn()} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('lists the days and fires onPick + onClose on selection', async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(
      <DayPickerSheet open title="Move to which day?" days={DAYS} onPick={onPick} onClose={onClose} />,
    );
    expect(screen.getByRole('dialog', { name: 'Move to which day?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Day 1 · Fri/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Day 2 · Sat/ }));
    expect(onPick).toHaveBeenCalledWith('2026-06-06');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on backdrop click', async () => {
    const onClose = vi.fn();
    render(
      <DayPickerSheet open title="Copy to which day?" days={DAYS} onPick={vi.fn()} onClose={onClose} />,
    );
    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalled();
  });
});
