// Screen 13 · Request Confirmation.
// Honest state: "Request SENT" is NOT the same as "booking confirmed".

"use client";

import type * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageShell, TopBarBack } from "../_components/_page-shell";
import { Icon } from "../_components/_icons";
import { NEX } from "../_components/_palette";
import { getPropertyById } from "../_components/_fixtures";

export default function ConfirmationPage(): React.ReactElement {
  return (
    <Suspense fallback={<PageShell><div style={{ padding: 24 }}>Loading…</div></PageShell>}>
      <ConfirmationInner />
    </Suspense>
  );
}

function ConfirmationInner(): React.ReactElement {
  const sp = useSearchParams();
  const propertyId = sp.get("property") ?? "";
  const property = getPropertyById(propertyId);
  const checkIn = sp.get("checkIn") ?? "";
  const checkOut = sp.get("checkOut") ?? "";
  const adults = sp.get("adults") ?? "2";
  const children = sp.get("children") ?? "0";

  return (
    <PageShell>
      <TopBarBack title="Request sent" onBackHref="/nex-native/dev/hotel-flow/discover" />
      <section style={{ padding: "24px 18px 10px", textAlign: "center" }}>
        <div
          aria-hidden
          style={{
            width: 72,
            height: 72,
            borderRadius: 999,
            background: NEX.verifiedSoft,
            color: NEX.verified,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
          }}
        >
          <Icon name="check" size={32} />
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: NEX.text, letterSpacing: "-0.015em" }}>
          Your request has been sent
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: NEX.textMid, lineHeight: 1.6, padding: "0 10px" }}>
          <strong style={{ color: NEX.text }}>This is not a confirmed booking.</strong> The owner receives your request now and will reply with price and availability for your dates.
        </p>
      </section>

      {property ? (
        <section style={{ padding: "16px 18px 10px" }}>
          <div style={{ padding: 16, background: NEX.surface, border: `1px solid ${NEX.divider}`, borderRadius: 14, boxShadow: NEX.shadow }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 70, height: 70, borderRadius: 10, overflow: "hidden", background: NEX.surfaceAlt, flex: "0 0 auto" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={property.hero[0].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: NEX.text }}>{property.name}</div>
                <div style={{ fontSize: 12, color: NEX.textMuted, marginTop: 2 }}>
                  {property.city}, {property.region}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <SummaryBox label="Check-in" value={checkIn || "—"} />
              <SummaryBox label="Check-out" value={checkOut || "—"} />
              <SummaryBox label="Adults" value={adults} />
              <SummaryBox label="Children" value={children} />
            </div>
            <div style={{ marginTop: 14, padding: 12, background: NEX.warnSoft, border: `1px solid ${NEX.warn}44`, borderRadius: 10, fontSize: 12, color: NEX.text, lineHeight: 1.6 }}>
              <strong style={{ color: NEX.warn, fontWeight: 700 }}>Request sent · not yet confirmed.</strong> Watch your Chat tab · the owner's response arrives there.
            </div>
          </div>
        </section>
      ) : null}

      <section style={{ padding: "16px 18px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {property ? (
          <Link
            href={`/nex-native/dev/hotel-flow/chat?property=${property.id}`}
            style={{ padding: "14px 16px", borderRadius: 12, background: NEX.accent, color: "#FFFFFF", fontSize: 14, fontWeight: 700, textAlign: "center", textDecoration: "none" }}
          >
            Open chat with owner
          </Link>
        ) : null}
        <Link href="/nex-native/dev/hotel-flow/trips" style={{ padding: "14px 16px", borderRadius: 12, background: NEX.surface, border: `1px solid ${NEX.divider}`, color: NEX.text, fontSize: 14, fontWeight: 700, textAlign: "center", textDecoration: "none" }}>
          Go to My Trips
        </Link>
        <Link href="/nex-native/dev/hotel-flow/discover" style={{ padding: "14px 16px", borderRadius: 12, background: "transparent", color: NEX.textMid, fontSize: 13, fontWeight: 600, textAlign: "center", textDecoration: "none" }}>
          Keep exploring
        </Link>
      </section>
    </PageShell>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div style={{ padding: "10px 12px", background: NEX.surfaceAlt, border: `1px solid ${NEX.divider}`, borderRadius: 10 }}>
      <div style={{ fontSize: 10, color: NEX.textMuted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 14, color: NEX.text, fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}
