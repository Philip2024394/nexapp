"use client";

// src/components/nex-native/chat-chrome/discovery-overlay-host.tsx
//
// Owner-authored 2026-11-05 later-same-day iter 12 · global mount for
// the sealed SearchOverlay (6 round "Live …" tiles) that opens when
// the drawer's Discovery row dispatches `nex-discovery-overlay-open`.
//
// Lives in /nex-native/layout.tsx alongside <ActionToastHost /> so
// every /nex-native page can surface the overlay without each page
// re-mounting it.

import * as React from "react";
import { SearchOverlay } from "@/components/nex-native/chat-chrome/header-search";

const OPEN_EVENT = "nex-discovery-overlay-open";

export function DiscoveryOverlayHost(): React.JSX.Element | null {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  if (!open) return null;
  return <SearchOverlay onClose={() => setOpen(false)} />;
}
