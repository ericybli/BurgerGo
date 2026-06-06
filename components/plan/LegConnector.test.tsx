import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { LegDTO } from '@/src/lib/planView';
import { LegConnector } from './LegConnector';

function leg(over: Partial<LegDTO> = {}): LegDTO {
  return {
    fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk',
    durationSeconds: 720, distanceMeters: 900, polyline: null, ...over,
  };
}

function renderLeg(l: LegDTO | undefined) {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LegConnector leg={l} />
    </NextIntlClientProvider>,
  );
}

describe('LegConnector', () => {
  it('renders the formatted cached leg without the offline caption', () => {
    renderLeg(leg());
    expect(screen.getByText('🚶 12 min · 0.9 km')).toBeInTheDocument();
    expect(screen.queryByText(en.plan.legNeedsConnection)).not.toBeInTheDocument();
  });

  it('renders the placeholder and caption when the leg is absent', () => {
    renderLeg(undefined);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText(en.plan.legNeedsConnection)).toBeInTheDocument();
  });
});
