'use client';

import { useState, useRef, useCallback } from 'react';
import { loadGoogleMaps } from '@/src/lib/google/loader';
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
 * cycle. The same UUID is passed to getPlacePredictions (as the sessionToken
 * field) and to GET /api/google/details?sessionToken= so Google's backend can
 * bundle the Autocomplete + Details calls into a single billing unit.
 *
 * Using a plain UUID string (not the opaque AutocompleteSessionToken object)
 * avoids the serialization bug where (token as {id}).id === undefined, which
 * caused every session to be billed as individual per-keystroke calls.
 */
export function usePlacesAutocomplete(): UsePlacesAutocompleteResult {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);

  // UUID string for the current billing session; rotated after select/clear.
  const sessionTokenRef = useRef<string>(crypto.randomUUID());

  const rotateToken = () => { sessionTokenRef.current = crypto.randomUUID(); };

  const search = useCallback(async (input: string) => {
    if (!input.trim()) { setPredictions([]); return; }
    setLoading(true);
    try {
      const maps = await loadGoogleMaps();
      const places = (maps as {
        places: {
          AutocompleteService: new () => {
            getPlacePredictions: (
              req: { input: string; sessionToken: string },
              cb: (results: Array<{ place_id: string; description: string }>, status: string) => void,
            ) => void;
          };
        };
      }).places;
      const service = new places.AutocompleteService();

      await new Promise<void>((resolve) => {
        service.getPlacePredictions(
          { input, sessionToken: sessionTokenRef.current },
          (results, status) => {
            if (status === 'OK' && results) {
              setPredictions(results.map((r) => ({ placeId: r.place_id, description: r.description })));
            } else {
              setPredictions([]);
            }
            resolve();
          },
        );
      });
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
