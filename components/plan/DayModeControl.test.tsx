import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { DayModeControl } from './DayModeControl';

function renderControl(props: Partial<React.ComponentProps<typeof DayModeControl>> = {}) {
  const onChange = vi.fn();
  const onRecompute = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DayModeControl mode="walk" disabled={false} onChange={onChange} onRecompute={onRecompute} {...props} />
    </NextIntlClientProvider>,
  );
  return { onChange, onRecompute };
}

describe('DayModeControl', () => {
  it('marks the current mode as pressed', () => {
    renderControl({ mode: 'drive' });
    expect(screen.getByRole('button', { name: en.plan.travelModeDrive })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: en.plan.travelModeWalk })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the chosen mode', async () => {
    const { onChange } = renderControl();
    await userEvent.click(screen.getByRole('button', { name: en.plan.travelModeTransit }));
    expect(onChange).toHaveBeenCalledWith('transit');
  });

  it('disables mode buttons and hides recompute when offline', () => {
    renderControl({ disabled: true });
    expect(screen.getByRole('button', { name: en.plan.travelModeWalk })).toBeDisabled();
    expect(screen.queryByRole('button', { name: en.plan.recompute })).not.toBeInTheDocument();
  });

  it('fires onRecompute online', async () => {
    const { onRecompute } = renderControl();
    await userEvent.click(screen.getByRole('button', { name: en.plan.recompute }));
    expect(onRecompute).toHaveBeenCalledTimes(1);
  });
});
