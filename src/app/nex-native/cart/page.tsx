// src/app/nex-native/cart/page.tsx
//
// NEX Cart · buyer's multi-shop cart view.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Thin server shell. Session is required (sendCartOrderAction needs a
// signed-in buyer); unauth → /sign-in. Cart content is 100% client-
// side (localStorage NEX_CART_STORAGE_KEY) so the page re-renders
// instantly on every Add/Remove without a server round-trip.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { CartPageClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function CartPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/cart");
  }

  return (
    <>
      {/* Owner directive 2026-11-09 · cart page locked to the frame
          viewport · no scrollbar bouncing on the side when the cart
          is empty. The sealed phone-frame default is `overflow-y:
          auto`; we override to `hidden` on cart routes so an empty
          state never shows a vestigial scrollbar track. */}
      <style>{`
        html, body { background: ${NEX_BG}; }
        .nex-native-frame { overflow: hidden !important; }
      `}</style>
      <main
        data-nex-cart
        style={{
          position: "absolute",
          inset: 0,
          background: NEX_BG,
          color: NEX_TEXT,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 18px) 20px calc(env(safe-area-inset-bottom, 0px) + 18px)",
          boxSizing: "border-box",
        }}
      >
        <CartPageClient />
      </main>
    </>
  );
}
