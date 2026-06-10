import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { PlaceDTO, LegDTO } from '@/src/lib/planView';
import { indexLegs } from '@/src/lib/legView';
import { TodayHero } from './TodayHero';

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 'a', tripId: 't1', dayDate: '2026-05-04', googlePlaceId: 'g-a',
    name: 'A', address: null, lat: 1, lng: 2, category: 'sightseeing',
    scheduledTime: '09:00', durationMin: null, cost: null, notes: null,
    orderIndex: 0, photoPath: null, photos: [], aiSummary: null, links: [], legMode: null, listId: null, ...over,
  };
}

const walkLeg: LegDTO = {
  fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk',
  durationSeconds: 720, distanceMeters: 900, polyline: null,
};

function renderHero(props: Partial<React.ComponentProps<typeof TodayHero>> = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <TodayHero
        stops={[
          place({ id: 'a', orderIndex: 0, name: 'Stop A', scheduledTime: '09:00', googlePlaceId: 'g-a' }),
          place({ id: 'b', orderIndex: 1, name: 'Stop B', scheduledTime: '13:00', googlePlaceId: 'g-b' }),
        ]}
        legs={indexLegs([walkLeg])}
        mode="walk"
        nowHHMM="08:00"
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

describe('TodayHero', () => {
  it('shows the Up next label and the default next stop with an Open in Maps link', () => {
    // now 08:00 → first future timed stop is Stop A (09:00).
    renderHero();
    expect(screen.getByText(en.plan.upNext)).toBeInTheDocument();
    expect(screen.getByText('Stop A')).toBeInTheDocument();
    expect(screen.getByText('09:00')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: en.plan.openInGoogleMaps });
    expect(link).toHaveAttribute('href', expect.stringContaining('query_place_id=g-a'));
  });

  it('selects the first future-timed stop when an earlier stop is already past', () => {
    // now 11:00 → Stop A (09:00) past, Stop B (13:00) is next.
    renderHero({ nowHHMM: '11:00' });
    expect(screen.getByText('Stop B')).toBeInTheDocument();
    // Stop B is the last stop → no Skip control.
    expect(screen.queryByRole('button', { name: en.plan.skip })).not.toBeInTheDocument();
    // The leg into Stop B is shown.
    expect(screen.getByText('🚶 12 min · 0.6 mi')).toBeInTheDocument();
  });

  it('Skip advances the transient pointer and clamps at the last stop', async () => {
    renderHero();
    await userEvent.click(screen.getByRole('button', { name: en.plan.skip }));
    expect(screen.getByText('Stop B')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: en.plan.openInGoogleMaps }),
    ).toHaveAttribute('href', expect.stringContaining('query_place_id=g-b'));
    // Clamped at the last stop → control gone.
    expect(screen.queryByRole('button', { name: en.plan.skip })).not.toBeInTheDocument();
  });

  it('shows "No time set" when the next stop has no scheduledTime', () => {
    renderHero({
      stops: [place({ id: 'a', orderIndex: 0, name: 'Stop A', scheduledTime: null })],
      nowHHMM: '08:00',
    });
    expect(screen.getByText(en.plan.noTimeSet)).toBeInTheDocument();
  });

  it('renders nothing for an empty day', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <TodayHero stops={[]} legs={indexLegs([])} mode="walk" nowHHMM="08:00" />
      </NextIntlClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
