import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { DayGroup, LegDTO } from '@/src/lib/map/types';

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
    notes: null, photoPath: googlePlaceId ? `/api/photos/${googlePlaceId}/card` : null, photos: [], aiSummary: null, links: [], legMode: null,
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

const onShowOnlyDate = vi.fn();
const onShowAllDays = vi.fn();
const onOpenDayRoute = vi.fn();
const onViewPlace = vi.fn();
const onViewRestaurant = vi.fn();

function renderMap(overrides: Partial<React.ComponentProps<typeof PlanMap>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PlanMap
        bucket="days"
        dayGroups={DAY_GROUPS}
        legs={LEGS}
        mode="walk"
        visibleDates={ALL_DATES}
        onShowOnlyDate={onShowOnlyDate}
        onShowAllDays={onShowAllDays}
        onOpenDayRoute={onOpenDayRoute}
        onViewPlace={onViewPlace}
        onViewRestaurant={onViewRestaurant}
        online={true}
        {...overrides}
      />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  onShowOnlyDate.mockClear();
  onShowAllDays.mockClear();
  onViewPlace.mockClear();
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

  it('calls onShowOnlyDate when a day chip is clicked', async () => {
    const user = userEvent.setup();
    renderMap();
    await user.click(screen.getByRole('button', { name: 'Day 1' }));
    expect(onShowOnlyDate).toHaveBeenCalledWith('2026-06-04');
  });

  it('hides pins for dates not in visibleDates', () => {
    renderMap({ visibleDates: new Set(['2026-06-05']) });
    expect(screen.queryByRole('button', { name: 'pin:a' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'pin:c' })).toBeInTheDocument();
  });

  it('calls onViewPlace when a day-bucket pin is tapped', async () => {
    const user = userEvent.setup();
    renderMap();
    await user.click(screen.getByRole('button', { name: 'pin:a' }));
    expect(onViewPlace).toHaveBeenCalledWith('a');
  });

  it('calls onViewPlace when a Saved-bucket pin is tapped (opens the rich read card)', async () => {
    const user = userEvent.setup();
    const savedGroup: DayGroup = {
      date: null, dayNumber: null, colorIndex: 0,
      places: [place('s', 0, 35.5, 139.5, 'gs')],
    };
    renderMap({ bucket: 'saved', dayGroups: [savedGroup], visibleDates: new Set() });
    await user.click(screen.getByRole('button', { name: 'pin:s' }));
    expect(onViewPlace).toHaveBeenCalledWith('s');
  });

  it('overlays Saved-places pins only after enabling the Layers toggle', async () => {
    const user = userEvent.setup();
    const saved = [place('saved1', 0, 35.9, 139.9, 'gs')];
    renderMap({ savedPlaces: saved });

    // Hidden until the user opts in.
    expect(screen.queryByRole('button', { name: 'pin:saved1' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: en.planMap.layers }));
    await user.click(screen.getByRole('checkbox', { name: en.planMap.layerSaved }));

    expect(screen.getByRole('button', { name: 'pin:saved1' })).toBeInTheDocument();
    // Day pins remain visible alongside the overlay.
    expect(screen.getByRole('button', { name: 'pin:a' })).toBeInTheDocument();
  });

  it('overlays Restaurant pins (and taps route to onViewRestaurant) after enabling the toggle', async () => {
    const user = userEvent.setup();
    const restaurants = [
      { id: 'rest1', name: 'Ichiran', lat: 35.8, lng: 139.8, googlePlaceId: null,
        cuisine: 'Ramen', address: '1-2-3 Shibuya', notes: 'Tonkotsu', photoPath: null, photos: [] },
    ];
    renderMap({ restaurants });

    expect(screen.queryByRole('button', { name: 'pin:Ichiran' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: en.planMap.layers }));
    await user.click(screen.getByRole('checkbox', { name: en.planMap.layerRestaurants }));

    expect(screen.getByRole('button', { name: 'pin:Ichiran' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'pin:a' })).toBeInTheDocument();

    // Tapping the restaurant pin routes to onViewRestaurant (not the place lookup).
    await user.click(screen.getByRole('button', { name: 'pin:Ichiran' }));
    expect(onViewRestaurant).toHaveBeenCalledWith('rest1');
    expect(onViewPlace).not.toHaveBeenCalledWith('rest1');
  });

  it('does not show the Layers menu in the saved bucket', () => {
    const savedGroup: DayGroup = {
      date: null, dayNumber: null, colorIndex: 0,
      places: [place('s', 0, 35.5, 139.5, 'gs')],
    };
    renderMap({ bucket: 'saved', dayGroups: [savedGroup], visibleDates: new Set() });
    expect(screen.queryByRole('button', { name: en.planMap.layers })).not.toBeInTheDocument();
  });

  it('clicking a day-route link calls onOpenDayRoute once and does NOT call window.open', async () => {
    const user = userEvent.setup();
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderMap();
    const links = screen.getAllByRole('link', { name: en.planMap.openDayRoute });
    expect(links.length).toBeGreaterThanOrEqual(1);
    await user.click(links[0]!);
    expect(onOpenDayRoute).toHaveBeenCalledTimes(1);
    expect(onOpenDayRoute).toHaveBeenCalledWith('2026-06-04');
    expect(windowOpenSpy).not.toHaveBeenCalled();
    windowOpenSpy.mockRestore();
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
