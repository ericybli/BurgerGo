// STUB — Group B3 replaces this with the real Google map.
'use client';

import type { PlanBucket, DayGroup } from '@/src/lib/planUrl';
import type { LegDTO } from '@/src/lib/planView';
import type { TravelMode } from '@/src/lib/googleMapsUrl';

export interface PlanMapProps {
  bucket: PlanBucket;
  dayGroups: DayGroup[];
  legs: LegDTO[];
  mode: TravelMode;
  visibleDates: Set<string>;
  onToggleDate: (date: string) => void;
  onSelectPlace: (placeId: string) => void;
  onOpenDayRoute: (date: string) => void;
  online: boolean;
}

export function PlanMap(_props: PlanMapProps) {
  return null;
}
