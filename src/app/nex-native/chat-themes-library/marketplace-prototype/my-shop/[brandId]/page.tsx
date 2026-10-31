// src/app/nex-native/chat-themes-library/marketplace-prototype/my-shop/[brandId]/page.tsx
//
// Owner directive 2026-10-22 · My Shop · owner-facing product
// management surface. Lets the business owner add, edit, delete,
// and turn off products in their shop. Scoped to PRODUCTS ONLY
// (identity · hours · address · story live in the full editor).
//
// Honest discipline:
//   · Prototype only · reads + writes localStorage under
//     `nex-mp-editor-{brandId}` · owner-authored product state only
//   · Zero DB writes · zero Supabase storage uploads
//   · Deletion propagates to menu drawer + NEX search directory
//     on next read (storage event dispatches automatically)
//   · "Turn off" sets stock_status to "sold_out" · reversible by
//     switching back to in_stock
//
// What's promised to the owner (from the sealed Shop preview
// ⓘ Info modal · Menu field group):
//   · Category toggles · add/rename/reorder
//   · Menu item name · price · description
//   · Upload up to 4 photos per item (owner directive 2026-10-22)
//   · In-stock · low-stock · sold-out states
//
// Supabase persistence remains gated on the DRAFT doctrine at
// `docs/doctrine/nex-supabase-persistence-data-loss-protection-
// draft-2026-10-22.md` locking + the Theme Commerce Purchase
// Journey doctrine sealing ownership + entitlement rules.

import type * as React from "react";
import { MyShopClient } from "./_my-shop-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-background-base, #020914)";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function MyShopPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}): Promise<React.ReactElement> {
  const { brandId } = await params;
  return (
    <>
      <style>{`html, body { background: ${NEX_BG} !important; }`}</style>
      <main
        data-nex-marketplace-prototype-my-shop
        data-nex-marketplace-prototype-my-shop-brand={brandId}
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
        <MyShopClient brandId={brandId} />
      </main>
    </>
  );
}
