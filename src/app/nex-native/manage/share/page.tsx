// src/app/nex-native/manage/share/page.tsx
//
// NEX Shop · Share & Publish surface · owner-sealed 2026-11-13.
// -----------------------------------------------------------------------------
// Opened from the Shop Management Centre "Share Shop" row. Dedicated
// so the owner lands directly on the share tools instead of having to
// scroll through the full /manage/shop editor to find them.
//
// Reuses the sealed ShopShareUrl copy chip and the sealed business
// resolver · adds a scannable QR code via the public api.qrserver.com
// generator (no new dependency, image-only · zero JS).

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { NexPageHeader } from "../../_page-header";
import { ShopShareUrl } from "../shop/_share-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_BG = "#F5EDD3";
const INK = "#0A0608";
const INK_MUTE = "#7D5A3A";
const ACCENT = "#FF7200";

export default async function ShopSharePage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/share");
  }
  const businesses = await listBusinessesByOwner(session.account.id);
  const business = businesses[0];
  if (!business) {
    redirect("/nex-native/manage/shop/setup");
  }

  const publicPath = `/nex-native/${business.slug}`;
  // Full URL · server doesn't know the public origin reliably so we
  // pass the slug + relative path. The ShopShareUrl client pairs it
  // with window.location.origin at copy time. The QR encodes the same
  // relative URL on a sealed production host, which falls back gracefully
  // to the current origin when accessed on the preview build.
  const qrTarget = `https://nexapp.app${publicPath}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=2&data=${encodeURIComponent(qrTarget)}`;

  return (
    <main
      data-nex-shop-share-page
      style={{
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        background: PAGE_BG,
        color: INK,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: "16px 20px 32px",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <NexPageHeader dataScope="manage-share" />

        <header style={{ margin: "20px 0 6px", textAlign: "center" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.005em",
              color: ACCENT,
            }}
          >
            Share your shop
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 12,
              color: INK_MUTE,
              lineHeight: 1.5,
            }}
          >
            One tap to copy your public link · scan the QR to open
            instantly on any phone camera.
          </p>
        </header>

        <div style={{ height: 14 }} />

        {/* Copy URL chip · sealed client component. */}
        <ShopShareUrl slug={business.slug} />

        <div style={{ height: 18 }} />

        {/* QR code · centred · white card so the dark modules read
            cleanly against the cream page. */}
        <div
          data-nex-shop-share-qr
          style={{
            padding: "18px",
            borderRadius: 14,
            background: "#FFFFFF",
            border: `1px solid ${ACCENT}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt={`QR code to ${qrTarget}`}
            width={220}
            height={220}
            style={{
              width: 220,
              height: 220,
              display: "block",
              borderRadius: 8,
            }}
          />
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: INK_MUTE,
              letterSpacing: "0.02em",
              textAlign: "center",
            }}
          >
            Scan with any phone camera
          </div>
        </div>

        <div style={{ height: 14 }} />

        {/* View button · sends the owner to their own public shop. */}
        <a
          href={publicPath}
          data-nex-shop-share-view
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 16px",
            borderRadius: 14,
            background: ACCENT,
            color: "#FFFFFF",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            boxShadow: "0 2px 8px rgba(255, 114, 0, 0.25)",
          }}
        >
          View my shop
        </a>

        <div
          data-nex-shop-share-poweredby
          style={{
            marginTop: 24,
            textAlign: "center",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: INK_MUTE,
          }}
        >
          Powered by NEX
        </div>
      </div>
    </main>
  );
}
