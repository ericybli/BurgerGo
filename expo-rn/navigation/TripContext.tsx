/**
 * Trip context — provides the current trip's identity + derived day list to every
 * section tab, so screens don't thread route params through nested navigators.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { deriveDays, type Day } from '../lib/days';

export type TripContextValue = {
  tripId: string;
  name: string;
  startDate: string;
  endDate: string;
  days: Day[];
};

const TripContext = createContext<TripContextValue | null>(null);

export function TripProvider({
  trip,
  children,
}: {
  trip: { tripId: string; name: string; startDate: string; endDate: string };
  children: ReactNode;
}) {
  const value = useMemo<TripContextValue>(
    () => ({ ...trip, days: deriveDays(trip.startDate, trip.endDate) }),
    [trip.tripId, trip.startDate, trip.endDate, trip.name],
  );
  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripContextValue {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used within a TripProvider');
  return ctx;
}
