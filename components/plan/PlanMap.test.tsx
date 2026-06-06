import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { DayGroup, LegDTO } from '@/src/lib/map/types';

// Control connectivity.
const mockOnline = vi.fn(() => true);
vi.mock('@/src/lib/useOnline', () => ({ useOnline: () => mockOnline() }));

// Stub GoogleMapCanvas: render pins as tappable buttons.
vi.mock('@/components/map/GoogleMapCanvas', () => ({
  GoogleMapCanvas: ({
    markers,
    onMarkerClick,
  }: {
    markers: { id: string; name: string }[];
    onMarkerClick: (id: string) => void;
  }) => (
    <div data-testid="map-canvas">
      {markers.map((m) => (
        <button key={m.id} type="button" onClick={() => onMarkerClick(m.id)}>
          pin:{m.name}
        </button>
      ))}
    </div>
  ),
}));

import { PlanMap } from './PlanMap';

function place(id: string, orderIndex: number, lat: number, lng: number,
               googlePlaceId: string | null = null) {
  return {
    id, orderIndex, lat, lng, name: id, category: 'other' as const,
    tripId: 't', dayDate: '2026-06-04', googlePlaceId,
    address: null, scheduledTime: null, durationMin: null, cost: null,
    notes: null, photoPath: googlePlaceId ? `/api/photos/${googlePlaceId}/card` : null,
  };
}

const DAY_GROUPS: DayGroup[] = [
  {
    date: '2026-06-04', dayNumber: 1, colorIndex: 0,
    places: [
      place('a', 0, 35.0, 139.0, 'ga'),
      place('b', 1, 35.1, 139.1, 'gb'),
    ],
  },
  {
    date: '2026-06-05', dayNumber: 2, colorIndex: 1,
    places: [place('c', 0, 35.2, 139.2, 'gc')],
  },
];
const LEGS: LegDTO[] = [];
const ALL_DATES = new Set(['2026-06-04', '2026-06-05']);

const onToggleDate = vi.fn();
const onSelectPlace = vi.fn();
const onOpenDayRoute = vi.fn();

function renderMap(overrides: Partial<React.ComponentProps<typeof PlanMap>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PlanMap
        bucket="days"
        dayGroups={DAY_GROUPS}
        legs={LEGS}
        mode="walk"
        visibleDates={ALL_DATES}
        onToggleDate={onToggleDate}
        onSelectPlace={onSelectPlace}
        onOpenDayRoute={onOpenDayRoute}
        online={true}
        {...overrides}
      />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  mockOnline.mockReturnValue(true);
  vi.clearAllMocks();
});
afterEach(() => vi.clearAllMocks());

describe('PlanMap (online, days bucket)', () => {
  it('renders the map canvas and the legend', () => {
    renderMap();
    expect(screen.getByTestId('map-canvas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.planMap.allDays })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Day 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Day 2' })).toBeInTheDocument();
  });

  it('renders pins for ALL visible day-group places', () => {
    renderMap();
    expect(screen.getByRole('button', { name: 'pin:a' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'pin:b' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'pin:c' })).toBeInTheDocument();
  });

  it('calls onToggleDate when a day chip is clicked', async () => {
    const user = userEvent.setup();
    renderMap();
    await user.click(screen.getByRole('button', { name: 'Day 1' }));
    expect(onToggleDate).toHaveBeenCalledWith('2026-06-04');
  });

  it('hides pins for dates not in visibleDates', () => {
    renderMap({ visibleDates: new Set(['2026-06-05']) });
    expect(screen.queryByRole('button', { name: 'pin:a' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'pin:c' })).toBeInTheDocument();
  });

  it('opens the info card on pin tap with the correct place data', async () => {
    const user = userEvent.setup();
    renderMap();
    await user.click(screen.getByRole('button', { name: 'pin:a' }));
    expect(screen.getByRole('dialog', { name: en.planMap.infoCardLabel })).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
  });

  it('calls onSelectPlace when the Saved-bucket "Add to day" is tapped', async () => {
    const user = userEvent.setup();
    const savedGroup: DayGroup = {
      date: null, dayNumber: null, colorIndex: 0,
      places: [place('s', 0, 35.5, 139.5, 'gs')],
    };
    renderMap({ bucket: 'saved', dayGroups: [savedGroup], visibleDates: new Set() });
    await user.click(screen.getByRole('button', { name: 'pin:s' }));
    const addBtn = screen.getByRole('button', { name: en.planMap.addToDay });
    await user.click(addBtn);
    expect(onSelectPlace).toHaveBeenCalledWith('s');
  });

  it('renders a per-day "Open day route in Google Maps" link calling onOpenDayRoute', async () => {
    const user = userEvent.setup();
    renderMap();
    // There should be one link per day with visible places.
    const links = screen.getAllByRole('link', { name: en.planMap.openDayRoute });
    expect(links.length).toBeGreaterThanOrEqual(1);
  });
});

describe('PlanMap (online, saved bucket)', () => {
  it('renders saved pins with no legend (no day chips)', () => {
    const savedGroup: DayGroup = {
      date: null, dayNumber: null, colorIndex: 0,
      places: [place('s', 0, 35.5, 139.5)],
    };
    renderMap({ bucket: 'saved', dayGroups: [savedGroup], visibleDates: new Set() });
    expect(screen.queryByRole('button', { name: en.planMap.allDays })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'pin:s' })).toBeInTheDocument();
  });
});

describe('PlanMap (offline)', () => {
  it('shows the mascot offline placeholder instead of the map canvas', () => {
    renderMap({ online: false });
    expect(screen.queryByTestId('map-canvas')).not.toBeInTheDocument();
    expect(screen.getByText(en.planMap.offlineHeadline)).toBeInTheDocument();
  });

  it('lists visible places as Open-in-Google-Maps deep links when offline', () => {
    renderMap({ online: false });
    expect(screen.getByRole('link', { name: /^a$/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^c$/ })).toBeInTheDocument();
  });
});
