// src/app/nex-native/contacts/_create-group-flip-state.ts
//
// Owner directive 2026-10-23 · "when the create groups flip · clear
// the groups cards and toggle from under the page so user can easy
// create their group". The flipped state of the Create Group hero
// needs to be visible to the filter pills + the contact list so
// they can hide themselves while the form is open. This tiny
// singleton holds the flag · same pattern as the discovery filter
// state so we don't bleed React Context through a server page.

type Listener = (flipped: boolean) => void;

let flipped = false;
const listeners = new Set<Listener>();

export function getCreateGroupFlipped(): boolean {
  return flipped;
}

export function setCreateGroupFlipped(next: boolean): void {
  if (next === flipped) return;
  flipped = next;
  for (const l of listeners) {
    try {
      l(flipped);
    } catch {
      /* ignore · don't poison the fan-out */
    }
  }
}

export function subscribeCreateGroupFlipped(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
