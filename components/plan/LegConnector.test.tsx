import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { TravelMode } from '@/src/lib/googleMapsUrl';
import en from '@/messages/en.json';
import type { LegDTO } from '@/src/lib/planView';
import { LegConnector } from './LegConnector';

function leg(over: Partial<LegDTO> = {}): LegDTO {
  return {
    fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk',
    durationSeconds: 720, distanceMeters: 900, polyline: null, ...over,
  };
}

function renderLeg(
  l: LegDTO | undefined,
  opts: { mode?: TravelMode; disabled?: boolean; online?: boolean; onModeChange?: (m: TravelMode) => void } = {},
) {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LegConnector
        leg={l}
        mode={opts.mode ?? 'walk'}
        disabled={opts.disabled ?? false}
        online={opts.online ?? false}
        onModeChange={opts.onModeChange ?? vi.fn()}
      />
    </NextIntlClientProvider>,
  );
}

describe('LegConnector', () => {
  it('renders the formatted cached leg without the offline caption', () => {
    renderLeg(leg());
    expect(screen.getByText('🚶 12 min · 0.6 mi')).toBeInTheDocument();
    expect(screen.queryByText(en.plan.legNeedsConnection)).not.toBeInTheDocument();
  });

  it('renders the placeholder and the offline caption when the leg is absent and offline', () => {
    renderLeg(undefined, { online: false });
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText(en.plan.legNeedsConnection)).toBeInTheDocument();
    expect(screen.queryByText(en.plan.legNoRoute)).not.toBeInTheDocument();
  });

  it('renders the "no route" caption when the leg is absent but online (Google had no route)', () => {
    renderLeg(undefined, { online: true });
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText(en.plan.legNoRoute)).toBeInTheDocument();
    expect(screen.queryByText(en.plan.legNeedsConnection)).not.toBeInTheDocument();
  });

  it('marks the active mode and switches this leg on tap', async () => {
    const onModeChange = vi.fn();
    renderLeg(leg({ mode: 'drive' }), { mode: 'drive', onModeChange });
    expect(screen.getByRole('button', { name: en.plan.travelModeDrive })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: en.plan.travelModeWalk })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: en.plan.travelModeTransit }));
    expect(onModeChange).toHaveBeenCalledWith('transit');
  });

  it('disables the mode toggle when offline', () => {
    renderLeg(leg(), { disabled: true });
    expect(screen.getByRole('button', { name: en.plan.travelModeWalk })).toBeDisabled();
  });
});
