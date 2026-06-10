/**
 * Google Places autocomplete hook (web components/plan/useGooglePlaces parity).
 * One session token per search→select cycle — the same token goes to both
 * /api/google/autocomplete and /api/google/details so Google bills them as one
 * session; it rotates after select/clear. Debounced as-you-type (≥2 chars).
 * Degrades to an empty suggestion list when the proxy is unavailable (e.g. the
 * prod server key is IP-restricted away from localhost).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type AutocompletePrediction } from '../../lib/api';
import { placeDetails, type PlaceDetailsLite } from './planApi';

/** Random session token (crypto.randomUUID isn't guaranteed under Hermes). */
function newToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export function useAutocomplete(debounceMs = 300) {
  const [predictions, setPredictions] = useState<AutocompletePrediction[]>([]);
  const tokenRef = useRef<string>(newToken());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  /** Debounced search; <2 chars clears the list. */
  const search = useCallback(
    (input: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const value = input.trim();
      if (value.length < 2) {
        setPredictions([]);
        return;
      }
      const seq = ++seqRef.current;
      timerRef.current = setTimeout(() => {
        api.google
          .autocomplete(value, tokenRef.current)
          .then((r) => {
            if (seqRef.current === seq) setPredictions(r.predictions ?? []);
          })
          .catch(() => {
            if (seqRef.current === seq) setPredictions([]);
          });
      }, debounceMs);
    },
    [debounceMs],
  );

  /** Resolve a picked suggestion; completes (and rotates) the billing session. */
  const select = useCallback(async (placeId: string): Promise<PlaceDetailsLite | null> => {
    const details = await placeDetails(placeId, tokenRef.current);
    if (details) tokenRef.current = newToken();
    return details;
  }, []);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    seqRef.current += 1;
    setPredictions([]);
    tokenRef.current = newToken();
  }, []);

  return { predictions, search, select, clear };
}
