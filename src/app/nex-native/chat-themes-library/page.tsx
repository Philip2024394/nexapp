// src/app/nex-native/chat-themes-library/page.tsx
//
// NEX Themes Marketplace · PRIMARY ROUTE.
// Owner-authorised 2026-10-21 · prototype promoted to primary.
// -----------------------------------------------------------------------------
// Owner directive 2026-10-21 · the sealed Neon Marketplace surface
// has been replaced by the prototype marketplace built under
// `./marketplace-prototype/`. The prototype is now the primary
// themes-library experience · the sealed sibling files (`_marketplace-
// header.tsx`, `_load-library-data.ts`, `_category-grid.tsx` et al.)
// are left on disk as orphans so this change is cleanly reversible
// via git. They can be deleted in a follow-up cleanup pass once the
// prototype has been reviewed in the owner's own browser.
//
// Scope boundaries:
//   · Zero DB writes.
//   · Zero migrations.
//   · The prototype's own route (/chat-themes-library/marketplace-
//     prototype) is UNCHANGED and still works · lets us A/B the two
//     surfaces during owner review.
//   · The free-chat theme-handoff cookie integration (iteration 54 ·
//     the `nex-free-chat-wallpaper` cookie that paints the previously-
//     chosen wallpaper on this page) is NOT ported in this swap · the
//     prototype has its own catalog + routing. If you want the free-
//     chat wallpaper handoff restored on this surface, say so and I
//     will wire it in.
//
// Not touched:
//   · The sealed `/nex-native/free-chat` surface.
//   · The sealed `/nex-native/cover-themes-library/*` surfaces.
//   · `pricing-config.ts` approval statuses.
//   · The three-product doctrine draft (still DRAFT · nothing seals
//     by making this swap).

import type * as React from "react";
import { MarketplacePrototypeClient } from "./marketplace-prototype/_marketplace-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "#020914";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default function ChatThemesLibraryPage(): React.ReactElement {
  return (
    <>
      <style>{`html, body { background: ${NEX_BG} !important; }`}</style>
      <main
        data-nex-marketplace-prototype
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
        <MarketplacePrototypeClient />
      </main>
    </>
  );
}
