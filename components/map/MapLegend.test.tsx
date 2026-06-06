import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { MapLegend } from './MapLegend';

interface LegendEntry {
  date: string;
  dayNumber: number;
  color: string;
  visible: boolean;
}

const ENTRIES: LegendEntry[] = [
  { date: '2026-06-04', dayNumber: 1, color: '#EE5B3C', visible: true  },
  { date: '2026-06-05', dayNumber: 2, color: '#4F8A86', visible: false },
];

function renderLegend(props: Partial<React.ComponentProps<typeof MapLegend>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <MapLegend
        entries={ENTRIES}
        allVisible={false}
        onToggleDay={vi.fn()}
        onToggleAll={vi.fn()}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

afterEach(() => vi.clearAllMocks());

describe('MapLegend', () => {
  it('renders an "All days" chip plus one chip per day', () => {
    renderLegend();
    expect(screen.getByRole('button', { name: en.planMap.allDays })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Day 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Day 2' })).toBeInTheDocument();
  });

  it('reflects each day visibility via aria-pressed', () => {
    renderLegend();
    expect(screen.getByRole('button', { name: 'Day 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Day 2' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks "All days" pressed only when allVisible is true', () => {
    renderLegend({ allVisible: true });
    expect(
      screen.getByRole('button', { name: en.planMap.allDays }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onToggleDay with the date when a day chip is tapped', async () => {
    const onToggleDay = vi.fn();
    const user = userEvent.setup();
    renderLegend({ onToggleDay });
    await user.click(screen.getByRole('button', { name: 'Day 2' }));
    expect(onToggleDay).toHaveBeenCalledWith('2026-06-05');
  });

  it('calls onToggleAll when the "All days" chip is tapped', async () => {
    const onToggleAll = vi.fn();
    const user = userEvent.setup();
    renderLegend({ onToggleAll });
    await user.click(screen.getByRole('button', { name: en.planMap.allDays }));
    expect(onToggleAll).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when there are no day entries (Saved bucket)', () => {
    const { container } = renderLegend({ entries: [] });
    expect(container).toBeEmptyDOMElement();
  });
});
