// src/app/nex-native/chat-themes-library/marketplace-prototype/search/page.tsx
//
// Owner directive 2026-10-22 · prototype NEX search directory
// (MENU-ITEM CARDS SURFACE). Reads the localStorage editor data
// and surfaces every edited menu item as a searchable card. Lets
// the owner feel the end-state flow before the Supabase Persistence
// doctrine locks + the sealed Directory Canonical Spine is extended.
//
// Scope boundaries (unchanged from the broader prototype):
//   · Zero DB writes
//   · Zero sealed Directory Spine edits
//   · Reads localStorage data `nex-mp-editor-<brand>` set by the
//     prototype editor
//   · Falls back to the sealed brand mocks (CRISPY_CHICKEN_MOCK) so
//     the surface is useful even before the owner has run the editor
//
// What this is NOT:
//   · Not the sealed NEX Directory (which handles business-level
//     truth, not menu-item cards)
//   · Not persistent · not indexed by the real search engine
//   · Not entitlement-checked · anyone with the URL sees it

import type * as React from "react";
import { SearchClient } from "./_search-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-background-base, #020914)";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default function MarketplacePrototypeSearchPage(): React.ReactElement {
  return (
    <>
      <style>{`html, body { background: ${NEX_BG} !important; }`}</style>
      <main
        data-nex-marketplace-prototype-search
        style={{
          position: "absolute",
          inset: 0,
          background: NEX_BG,
          color: NEX_TEXT,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <SearchClient />
      </main>
    </>
  );
}
