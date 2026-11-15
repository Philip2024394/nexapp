// src/app/nex-native/create/product/page.tsx
//
// Business picker / shop router for the "Create product" flow.
// Owner-authorised engineering pass 2026-11-15 · fills the 404 that
// the "← Change shop" link on /create/product/category produces when
// the seller has zero or multiple businesses.
//
// Behaviour
// -----------------------------------------------------------------
//   · Unauthenticated → /sign-in?next=/nex-native/create/product
//   · Zero businesses → redirect to /manage/shop/setup (the sealed
//     setup wizard · owner directive: "funnel sellers to setup if
//     they haven't got a shop yet").
//   · Exactly one business → auto-redirect to the category picker
//     pre-bound to that business (avoids a pointless one-item list).
//   · Two+ businesses → render a small picker · each row jumps to
//     /create/product/category?business=<id>.
//
// This page is intentionally thin. The real product-creation surface
// is /create/product/category (sealed) + /create/product/form
// (sealed). This landing exists purely to answer "which shop are we
// adding to?" when the seller arrives from a global entry point like
// the "← Change shop" back-link.

import type * as React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INK = "var(--nex-world-primary-ink, #F2F5F8)";
const INK_DIM = "var(--nex-world-muted-ink, #AFC5B5)";
const ACCENT = "var(--nex-world-secondary, #C6A15B)";
const PAGE_BG = "var(--nex-world-drawer-bg, #123D2B)";
const TILE_BG = "rgba(2, 20, 12, 0.55)";

export default async function CreateProductLandingPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect(
      "/nex-native/sign-in?next=" +
        encodeURIComponent("/nex-native/create/product"),
    );
  }

  const owned = await listBusinessesByOwner(session.account.id).catch(
    () => [] as Awaited<ReturnType<typeof listBusinessesByOwner>>,
  );

  if (owned.length === 0) {
    // Owner directive 2026-11-15 · a seller with zero businesses has
    // nothing to add a product to. Funnel them into the sealed shop
    // setup wizard rather than silently dropping them on a blank
    // category picker.
    redirect("/nex-native/manage/shop/setup");
  }

  if (owned.length === 1) {
    const only = owned[0]!;
    redirect(
      `/nex-native/create/product/category?business=${encodeURIComponent(only.id)}`,
    );
  }

  // 2+ businesses · present a picker. Ordered by created_at desc
  // (listBusinessesByOwner default), so the most recent business is
  // the most visually prominent at the top.
  return (
    <main
      data-nex-create-product-landing-root
      style={{
        minHeight: "100dvh",
        background: PAGE_BG,
        color: INK,
        fontFamily: "Inter, system-ui, sans-serif",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link
          href="/nex-native/manage"
          style={{
            display: "inline-block",
            marginBottom: 12,
            color: ACCENT,
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          ← Back to your shops
        </Link>
        <h1
          data-nex-create-product-landing-heading
          style={{ fontSize: 22, fontWeight: 800, margin: 0, marginBottom: 8 }}
        >
          Which shop are you adding to?
        </h1>
        <p
          style={{
            fontSize: 13,
            color: INK_DIM,
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          Pick the shop that will own this product. You can switch
          back from the department picker on the next screen.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 10,
          }}
        >
          {owned.map((b) => (
            <Link
              key={b.id}
              href={`/nex-native/create/product/category?business=${encodeURIComponent(b.id)}`}
              data-nex-create-product-landing-tile={b.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: "16px 18px",
                background: TILE_BG,
                border:
                  "1.5px solid color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 42%, transparent)",
                borderRadius: 14,
                color: INK,
                textDecoration: "none",
                minHeight: 72,
                boxShadow: "0 6px 14px rgba(0,0,0,0.25)",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700 }}>
                {b.display_name}
              </span>
              <span style={{ fontSize: 11, color: INK_DIM, fontWeight: 600 }}>
                /{b.slug}
              </span>
              <span style={{ color: ACCENT, alignSelf: "flex-end" }}>→</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
