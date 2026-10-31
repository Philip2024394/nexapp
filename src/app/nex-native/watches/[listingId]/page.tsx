// src/app/nex-native/watches/[listingId]/page.tsx
//
// NEX Watches v1 · public listing surface · RSC.
// ----------------------------------------------------------------------------
// Reads via `getPublicWatchListingById` · returns null unless
// status='published' AND entitlement_expires_at > now() (per G3
// amendment and migration 227 public SELECT policy). Any other state
// renders a lightweight 404.
//
// Chat CTA
//   · Routes to the existing peer-chat surface at
//     `/nex-native/chat/peer/[accountId]`. NEX never handles buyer-
//     seller payment · the chat is the deferred rail (sealed §2.4
//     clause 3 · payment-doctrine amendment 2026-10-26).
//
// Not covered in v1 (deferred by design)
//   · Favoriting / like persistence.
//   · Image lightbox.
//   · Seller profile preview card.

import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatIdrPence,
  getPublicWatchListingById,
  type WatchListingRow,
} from "@/lib/nex-native/watches/watch-listing-service";

export const dynamic = "force-dynamic";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  text: "#F2F5F8",
  textDim: "#C8D4E8",
  textFaint: "#7D9BC0",
  cyan: "#00AFFF",
  gold: "#C8A24B",
  warn: "#FF7200",
  panelBg: "rgba(6,16,30,0.9)",
  panelBorder: "rgba(0,175,255,0.3)",
  rowBg: "rgba(255,255,255,0.04)",
  rowBorder: "rgba(255,255,255,0.08)",
} as const;

interface PageProps {
  readonly params: Promise<{ readonly listingId: string }>;
}

export default async function WatchListingPage(props: PageProps): Promise<React.JSX.Element> {
  const { listingId } = await props.params;
  const listing = await getPublicWatchListingById(listingId);
  if (!listing) notFound();

  const brandBig = listing.brand.toUpperCase();
  const title = `${listing.brand} ${listing.model_name}`;
  const priceLabel = listing.pricing_mode === "chat"
    ? "Price on request"
    : formatIdrPence(listing.price_pence);
  const expiresLabel = listing.entitlement_expires_at
    ? formatExpires(listing.entitlement_expires_at)
    : null;

  return (
    <main
      data-nex-watch-listing
      data-nex-listing-id={listing.id}
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "9 / 16",
          maxHeight: "72dvh",
          background: "#000",
          overflow: "hidden",
        }}
      >
        {listing.cover_image_url ? (
          <img
            src={listing.cover_image_url}
            alt={title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "linear-gradient(135deg, #0b1a30 0%, #1a2f55 50%, #0b1a30 100%)",
              color: NEX.textFaint,
              fontSize: 14,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            No image provided
          </div>
        )}

        {/* Back pill */}
        <Link
          href="/nex-native/watches"
          data-nex-watch-listing-back
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            padding: "8px 12px",
            borderRadius: 999,
            background: "rgba(2,9,20,0.7)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            color: NEX.text,
            fontSize: 12,
            fontWeight: 700,
            textDecoration: "none",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          ← Watches
        </Link>

        {/* Brand strip */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "20px 20px 18px",
            background:
              "linear-gradient(0deg, rgba(2,9,20,0.95) 0%, rgba(2,9,20,0) 100%)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.22em",
              color: NEX.gold,
              textTransform: "uppercase",
            }}
          >
            {brandBig}
          </div>
          <h1
            style={{
              margin: "6px 0 10px",
              fontSize: 26,
              fontWeight: 900,
              color: "#FFFFFF",
              lineHeight: 1.1,
            }}
          >
            {listing.model_name}
          </h1>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: NEX.text,
            }}
          >
            {priceLabel}
          </div>
          {listing.reference_number ? (
            <div
              style={{
                marginTop: 4,
                fontSize: 11.5,
                color: NEX.textFaint,
                letterSpacing: "0.06em",
              }}
            >
              Ref · {listing.reference_number}
            </div>
          ) : null}
        </div>
      </section>

      {/* ── CTA · chat with seller (NEX never handles payment) ──── */}
      <section
        style={{
          padding: "18px 16px 10px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <Link
          href={`/nex-native/chat/peer/${listing.owner_account_id}?pending_watch=${listing.id}`}
          data-nex-watch-listing-chat
          style={{
            minHeight: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            background: "linear-gradient(135deg, #FF3355 0%, #FF7200 100%)",
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: 900,
            textDecoration: "none",
          }}
        >
          💬 Message seller
        </Link>
        <div
          data-nex-watch-listing-expires
          style={{
            minHeight: 48,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            background: NEX.rowBg,
            border: `1px solid ${NEX.rowBorder}`,
            color: NEX.textDim,
            fontSize: 11.5,
            lineHeight: 1.3,
            padding: "0 10px",
            textAlign: "center",
          }}
        >
          {expiresLabel ? (
            <>
              <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: NEX.textFaint }}>Listed until</span>
              <span style={{ fontWeight: 800, color: NEX.text, marginTop: 2 }}>{expiresLabel}</span>
            </>
          ) : (
            <span>Listed on NEX</span>
          )}
        </div>
      </section>

      <p
        style={{
          padding: "0 16px",
          fontSize: 11,
          color: NEX.textFaint,
          lineHeight: 1.5,
          margin: "0 0 6px",
        }}
      >
        NEX connects you with the seller. Payment and delivery are
        agreed between buyer and seller · NEX does not intermediate.
      </p>

      {/* ── Description ─────────────────────────────────────── */}
      {listing.description ? (
        <Section title="About this watch">
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.65,
              color: NEX.textDim,
              whiteSpace: "pre-wrap",
              margin: 0,
            }}
          >
            {listing.description}
          </p>
        </Section>
      ) : null}

      {/* ── Essential spec grid ────────────────────────────── */}
      <Section title="Specification">
        <SpecGrid listing={listing} />
      </Section>

      {/* ── Trust ──────────────────────────────────────────── */}
      {(listing.authenticity || listing.warranty_note || listing.provenance_note || listing.seller_type) ? (
        <Section title="Trust & authenticity">
          {listing.seller_type ? (
            <SpecRow label="Seller type" value={pretty(listing.seller_type)} />
          ) : null}
          {listing.authenticity ? (
            <SpecRow label="Authenticity" value={pretty(listing.authenticity)} />
          ) : null}
          {listing.warranty_note ? (
            <SpecRow label="Warranty" value={listing.warranty_note} />
          ) : null}
          {listing.provenance_note ? (
            <SpecRow label="Service history" value={listing.provenance_note} />
          ) : null}
        </Section>
      ) : null}

      {/* ── Shipping ───────────────────────────────────────── */}
      {(listing.shipping_scope || listing.availability) ? (
        <Section title="Shipping & availability">
          {listing.shipping_scope ? (
            <SpecRow label="Shipping scope" value={pretty(listing.shipping_scope)} />
          ) : null}
          {listing.availability ? (
            <SpecRow label="Availability" value={pretty(listing.availability)} />
          ) : null}
          {listing.packaging_items && listing.packaging_items.length > 0 ? (
            <SpecRow
              label="Included"
              value={listing.packaging_items.map(pretty).join(" · ")}
            />
          ) : null}
        </Section>
      ) : null}

      <footer
        style={{
          padding: "20px 16px 32px",
          fontSize: 10,
          color: NEX.textFaint,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        Listed on NEX
      </footer>
    </main>
  );
}

// ─── Internal components ────────────────────────────────────────────────────

function Section(props: { readonly title: string; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <section
      style={{
        padding: "6px 16px 18px",
        borderTop: `1px solid ${NEX.rowBorder}`,
        marginTop: 14,
      }}
    >
      <h2
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: NEX.gold,
          margin: "16px 0 10px",
        }}
      >
        {props.title}
      </h2>
      {props.children}
    </section>
  );
}

function SpecRow(props: { readonly label: string; readonly value: string | number | null | undefined }): React.JSX.Element | null {
  if (props.value === null || props.value === undefined || props.value === "") return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 14,
        padding: "9px 0",
        borderBottom: `1px solid ${NEX.rowBorder}`,
      }}
    >
      <div
        style={{
          fontSize: 11.5,
          color: NEX.textFaint,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          flexShrink: 0,
        }}
      >
        {props.label}
      </div>
      <div
        style={{
          fontSize: 13.5,
          color: NEX.text,
          fontWeight: 600,
          textAlign: "right",
          flex: "1 1 auto",
        }}
      >
        {String(props.value)}
      </div>
    </div>
  );
}

function SpecGrid(props: { readonly listing: WatchListingRow }): React.JSX.Element {
  const l = props.listing;
  return (
    <div>
      <SpecRow label="Type" value={pretty(l.watch_type)} />
      <SpecRow label="Movement" value={pretty(l.movement)} />
      <SpecRow label="Condition" value={pretty(l.condition)} />
      <SpecRow label="Case diameter" value={l.case_diameter_mm != null ? `${l.case_diameter_mm} mm` : null} />
      <SpecRow label="Dial colour" value={l.dial_color} />
      <SpecRow label="Strap" value={l.strap_material ? pretty(l.strap_material) : null} />
      <SpecRow label="Case material" value={l.case_material_category ? pretty(l.case_material_category) : null} />
      <SpecRow label="Case shape" value={l.case_shape ? pretty(l.case_shape) : null} />
      <SpecRow label="Crystal" value={l.crystal_material ? pretty(l.crystal_material) : null} />
      <SpecRow label="Clasp" value={l.clasp_type ? pretty(l.clasp_type) : null} />
      <SpecRow
        label="Water resistance"
        value={l.water_resistance_m != null ? (l.water_resistance_m === 0 ? "Not rated" : `${l.water_resistance_m} m`) : null}
      />
      <SpecRow label="Bezel" value={l.bezel_style ? pretty(l.bezel_style) : null} />
      <SpecRow label="Dial finish" value={l.dial_finish ? pretty(l.dial_finish) : null} />
      <SpecRow label="Hands" value={l.hand_style ? pretty(l.hand_style) : null} />
      <SpecRow label="Case finish" value={l.case_finish ? pretty(l.case_finish) : null} />
      <SpecRow label="Style" value={l.style_audience ? pretty(l.style_audience) : null} />
    </div>
  );
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

function pretty(raw: string): string {
  return raw
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatExpires(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const date = new Date(ms);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
