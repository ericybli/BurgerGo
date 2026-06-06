'use client';

import { useState, useRef, useCallback } from 'react';
import { loadGoogleMaps, SessionTokenManager } from '@/src/lib/google/loader';

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
  select: (placeId: string, sessionToken?: string) => Promise<PlaceDetails | null>;
  clear: () => void;
}

/**
 * Autocomplete hook: one AutocompleteSessionToken per search→select cycle
 * (bundles the typing session + Details call into one billing unit). The
 * loader and fetch are mockable so tests need no real Maps JS or server key.
 */
export function usePlacesAutocomplete(): UsePlacesAutocompleteResult {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);

  // One session-token manager per hook instance; stable across renders.
  const tokenMgrRef = useRef<SessionTokenManager<{ id: string }> | null>(null);
  function getTokenMgr(): SessionTokenManager<{ id: string }> {
    if (!tokenMgrRef.current) {
      tokenMgrRef.current = new SessionTokenManager(() => ({ id: crypto.randomUUID() }));
    }
    return tokenMgrRef.current;
  }

  const search = useCallback(async (input: string) => {
    if (!input.trim()) { setPredictions([]); return; }
    setLoading(true);
    try {
      const google = await loadGoogleMaps();
      const maps = google.maps as {
        places: {
          AutocompleteService: new () => {
            getPlacePredictions: (
              req: { input: string; sessionToken: unknown },
              cb: (results: Array<{ place_id: string; description: string }>, status: string) => void,
            ) => void;
          };
          AutocompleteSessionToken: new () => unknown;
        };
      };
      const service = new maps.places.AutocompleteService();
      const token = new maps.places.AutocompleteSessionToken();
      // Stash the real Maps token for the select call.
      tokenMgrRef.current = new SessionTokenManager(() => token as { id: string });

      await new Promise<void>((resolve) => {
        service.getPlacePredictions({ input, sessionToken: token }, (results, status) => {
          if (status === 'OK' && results) {
            setPredictions(results.map((r) => ({ placeId: r.place_id, description: r.description })));
          } else {
            setPredictions([]);
          }
          resolve();
        });
      });
    } catch {
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const select = useCallback(async (placeId: string, _sessionToken?: string): Promise<PlaceDetails | null> => {
    const mgr = getTokenMgr();
    const token = mgr.current();
    try {
      const tokenId = (token as { id: string }).id;
      const res = await fetch(`/api/google/details?placeId=${encodeURIComponent(placeId)}&sessionToken=${encodeURIComponent(tokenId)}`);
      if (!res.ok) return null;
      const data = (await res.json()) as PlaceDetails;
      mgr.consume(); // session complete
      return data;
    } catch {
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    setPredictions([]);
    getTokenMgr().reset();
  }, []);

  return { predictions, loading, search, select, clear };
}
