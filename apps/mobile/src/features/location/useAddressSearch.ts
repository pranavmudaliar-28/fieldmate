import { useEffect, useRef, useState } from 'react';
import { createOsmLocationProvider } from './osm-provider';
import type { LocationProvider, PlaceSuggestion } from './provider';

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 3;

export const SEARCH_UNAVAILABLE_MESSAGE =
  'Address search is unavailable. You can still type the address yourself.';

/** Swapped in one place when the provider changes (docs/07 §1). */
let provider: LocationProvider = createOsmLocationProvider();

export function setLocationProvider(next: LocationProvider): void {
  provider = next;
}

export function getLocationProvider(): LocationProvider {
  return provider;
}

export type AddressSearchState = {
  suggestions: PlaceSuggestion[];
  searching: boolean;
  /** Set when the service could not be reached; typing still works. */
  unavailable: boolean;
};

/**
 * Type-ahead address search. Waits for a pause in typing, and abandons an
 * in-flight request when the query changes, so results never arrive out of order.
 */
export function useAddressSearch(query: string, enabled = true): AddressSearchState {
  const [state, setState] = useState<AddressSearchState>({
    suggestions: [],
    searching: false,
    unavailable: false,
  });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();

    if (!enabled || trimmed.length < MIN_QUERY_LENGTH) {
      controller.current?.abort();
      setState({ suggestions: [], searching: false, unavailable: false });
      return;
    }

    setState((current) => ({ ...current, searching: true }));

    const timer = setTimeout(() => {
      controller.current?.abort();
      const active = new AbortController();
      controller.current = active;

      provider
        .search(trimmed, active.signal)
        .then((suggestions) => {
          if (active.signal.aborted) return;
          setState({ suggestions, searching: false, unavailable: false });
        })
        .catch(() => {
          if (active.signal.aborted) return;
          // The manager can always type the address instead.
          setState({ suggestions: [], searching: false, unavailable: true });
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, enabled]);

  useEffect(() => () => controller.current?.abort(), []);

  return state;
}
