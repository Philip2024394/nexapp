// src/app/nex-native/contacts/_group-discovery-filter-state.ts
//
// Owner directive 2026-10-23 · "search bar and country flag round
// under the header area" · the search chrome lives at page level
// while the OPEN groups results list lives inside the Groups tab.
// This tiny singleton holds the shared filter state so both can
// subscribe without a React Context (which would require promoting
// a server component to client).
//
// Zero persistence · state resets on page reload. Country defaults
// to Indonesia (base NEX market); query starts empty.

export interface GroupDiscoveryFilterState {
  readonly country: string; // ISO alpha-2, uppercase
  readonly query: string;
}

type Listener = (state: GroupDiscoveryFilterState) => void;

let state: GroupDiscoveryFilterState = {
  country: "ID",
  query: "",
};

const listeners = new Set<Listener>();

export function getGroupDiscoveryFilterState(): GroupDiscoveryFilterState {
  return state;
}

export function setGroupDiscoveryFilterState(
  patch: Partial<GroupDiscoveryFilterState>,
): void {
  const normalisedCountry = patch.country
    ? patch.country.toUpperCase()
    : state.country;
  const next: GroupDiscoveryFilterState = {
    country: normalisedCountry,
    query: patch.query ?? state.query,
  };
  if (next.country === state.country && next.query === state.query) return;
  state = next;
  for (const l of listeners) {
    try {
      l(state);
    } catch {
      /* ignore listener failure · don't poison the fan-out */
    }
  }
}

export function subscribeGroupDiscoveryFilterState(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
