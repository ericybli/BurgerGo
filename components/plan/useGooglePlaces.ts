'use client';

import { useState, useRef, useCallback } from 'react';
import { withBase } from '@/src/lib/basePath';

export interface Prediction {
  placeId: string;
  description: string;
}

export interface PlaceDetails {
  googlePlaceId: string;
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  categoryGuess: string | null;
  photoRef: string | null;
  photoLocalPath: string | null;
  cached: boolean;
}

export interface UsePlacesAutocompleteResult {
  predictions: Prediction[];
  loading: boolean;
  search: (input: string) => Promise<void>;
  select: (placeId: string) => Promise<PlaceDetails | null>;
  clear: () => void;
}

/**
 * Autocomplete hook: one client-generated UUID session token per search→select
 * cycle. The same UUID is passed to GET /api/google/autocomplete?sessionToken=
 * and GET /api/google/details?sessionToken= so Google bundles the Autocomplete +
 * Details calls into a single billing session. Both calls are server-proxied
 * (server key), so suggestions work without a live browser Maps-JS key.
 */
export function usePlacesAutocomplete(): UsePlacesAutocompleteResult {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);

  // UUID string for the current billing session; rotated after select/clear.
  const sessionTokenRef = useRef<string>(crypto.randomUUID());

  const rotateToken = () => { sessionTokenRef.current = crypto.randomUUID(); };

  const search = useCallback(async (input: string) => {
    const value = input.trim();
    if (!value) {
      setPredictions([]);
      return;
    }
    setLoading(true);
    try {
      // Server-proxied autocomplete (uses the server key), so suggestions work
      // even when the browser Maps-JS key is unavailable. Same session token as
      // the eventual /api/google/details select → one Google billing session.
      const res = await fetch(
        withBase(
          `/api/google/autocomplete?input=${encodeURIComponent(value)}&sessionToken=${encodeURIComponent(sessionTokenRef.current)}`,
        ),
        { credentials: 'same-origin' },
      );
      if (!res.ok) {
        setPredictions([]);
        return;
      }
      const data = (await res.json()) as { predictions?: Prediction[] };
      setPredictions(data.predictions ?? []);
    } catch {
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const select = useCallback(async (placeId: string): Promise<PlaceDetails | null> => {
    const sessionToken = sessionTokenRef.current;
    try {
      const res = await fetch(
        withBase(`/api/google/details?placeId=${encodeURIComponent(placeId)}&sessionToken=${encodeURIComponent(sessionToken)}`),
      );
      if (!res.ok) return null;
      const data = (await res.json()) as PlaceDetails;
      rotateToken(); // session complete → next search starts a fresh session
      return data;
    } catch {
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    setPredictions([]);
    rotateToken();
  }, []);

  return { predictions, loading, search, select, clear };
}
