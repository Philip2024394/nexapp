// Screen 14a · My Trips.
"use client";

import type * as React from "react";
import Link from "next/link";
import { PageShell, TopBarBrand } from "../_components/_page-shell";
import { BottomNav } from "../_components/_bottom-nav";
import { Icon } from "../_components/_icons";
import { NEX } from "../_components/_palette";
import { USER_TRIPS, getPropertyById } from "../_components/_fixtures";

export default function TripsPage(): React.ReactElement {
  const pending = USER_TRIPS.filter((t) => t.status === "request_sent");
  const confirmed = USER_TRIPS.filter((t) => t.status === "confirmed");
  const past = USER_TRIPS.filter((t) => t.status === "past");

  return (
    <PageShell>
      <TopBarBrand />
      <section style={{ padding: "16px 18px 6px" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: NEX.text, letterSpacing: "-0.015em" }}>My Trips</h1>
        <div style={{ marginTop: 4, fontSize: 12, color: NEX.textMuted }}>
          Booking requests, confirmed stays and trip history.
        </div>
      </section>

      <TripBucket title="Pending owner reply" items={pending} />
      <TripBucket title="Confirmed" items={confirmed} />
      <TripBucket title="Past stays" items={past} />

      {USER_TRIPS.length === 0 ? (
        <section style={{ padding: 30, textAlign: "center", color: NEX.textMuted, fontSize: 13 }}>
          You don't have any trips yet. <Link href="/nex-native/dev/hotel-flow/discover" style={{ color: NEX.accent }}>Explore stays</Link>.
        </section>
      ) : null}

      <BottomNav active="trips" />
    </PageShell>
  );
}

function TripBucket({ title, items }: { readonly title: string; readonly items: readonly typeof USER_TRIPS[number][] }): React.ReactElement | null {
  if (items.length === 0) return null;
  return (
    <section style={{ padding: "16px 18px 6px" }}>
      <div style={{ fontSize: 11, color: NEX.textMuted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>
        {title} ({items.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((t) => {
          const p = getPropertyById(t.propertyId);
          if (!p) return null;
          return (
            <Link
              key={t.id}
              href={`/nex-native/dev/hotel-flow/detail/${p.id}`}
              style={{
                display: "flex",
                gap: 10,
                padding: 10,
                background: NEX.surface,
                border: `1px solid ${NEX.divider}`,
                borderRadius: 12,
                textDecoration: "none",
                color: "inherit",
                boxShadow: NEX.shadow,
              }}
            >
              <div style={{ width: 68, height: 68, borderRadius: 10, overflow: "hidden", background: NEX.surfaceAlt, flex: "0 0 auto" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.hero[0].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: NEX.text, lineHeight: 1.2 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: NEX.textMuted, marginTop: 2 }}>
                  {t.checkIn} → {t.checkOut} · {t.guests} guests
                </div>
                <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: statusColors(t.status).bg, color: statusColors(t.status).fg }}>
                  {statusColors(t.status).label}
                </div>
              </div>
              <span style={{ color: NEX.textMuted, display: "inline-flex", alignSelf: "center" }}>
                <Icon name="chevronRight" size={18} />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function statusColors(s: "request_sent" | "confirmed" | "past"): { bg: string; fg: string; label: string } {
  if (s === "request_sent") return { bg: NEX.warnSoft, fg: NEX.warn, label: "Request sent" };
  if (s === "confirmed") return { bg: NEX.verifiedSoft, fg: NEX.verified, label: "Confirmed" };
  return { bg: NEX.surfaceAlt, fg: NEX.textMuted, label: "Past" };
}
