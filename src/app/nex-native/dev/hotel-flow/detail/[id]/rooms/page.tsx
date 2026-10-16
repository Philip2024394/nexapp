// Screen 7 · Rooms. Prices HONEST-NULL (on request).
"use client";

import type * as React from "react";
import { use } from "react";
import Link from "next/link";
import { PageShell, TopBarBack } from "../../../_components/_page-shell";
import { Icon } from "../../../_components/_icons";
import { NEX } from "../../../_components/_palette";
import { getPropertyById } from "../../../_components/_fixtures";

export default function RoomsPage({ params }: { params: Promise<{ id: string }> }): React.ReactElement {
  const { id } = use(params);
  const property = getPropertyById(id);
  if (!property) return <PageShell><div style={{ padding: 24 }}>Not found.</div></PageShell>;

  const rooms = property.rooms.length > 0 ? property.rooms : [];

  return (
    <PageShell>
      <TopBarBack title="Rooms" onBackHref={`/nex-native/dev/hotel-flow/detail/${property.id}`} />
      <section style={{ padding: "16px 18px 10px" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: NEX.text, letterSpacing: "-0.015em" }}>
          Available rooms
        </h1>
        <div style={{ marginTop: 4, fontSize: 12, color: NEX.textMuted, lineHeight: 1.5 }}>
          Prices confirmed by the owner when you send a booking request.
        </div>
      </section>
      <section style={{ padding: "6px 18px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {rooms.length === 0 ? (
          <div style={{ padding: 20, background: NEX.surfaceAlt, border: `1px solid ${NEX.divider}`, borderRadius: 12, textAlign: "center", color: NEX.textMuted, fontSize: 13 }}>
            Room details not published yet · ask the owner.
          </div>
        ) : (
          rooms.map((r) => (
            <article
              key={r.id}
              style={{
                background: NEX.surface,
                border: `1px solid ${NEX.divider}`,
                borderRadius: 14,
                overflow: "hidden",
                boxShadow: NEX.shadow,
              }}
            >
              <div style={{ aspectRatio: "16 / 9", background: NEX.surfaceAlt }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.imageUrl} alt={`${r.name} · illustrative`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: NEX.text }}>{r.name}</div>
                <div style={{ marginTop: 4, fontSize: 13, color: NEX.textMid }}>{r.bedConfig}</div>
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: NEX.textMuted }}>
                  <Icon name="users" size={14} /> sleeps {r.maxOccupancy}
                </div>
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {r.facilities.map((f) => (
                    <span
                      key={f}
                      style={{
                        padding: "3px 8px",
                        background: NEX.accentMuted,
                        color: NEX.accent,
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      {f.replace("_", " ")}
                    </span>
                  ))}
                </div>
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontSize: 12, color: NEX.textMuted }}>
                    Price confirmed on request
                  </div>
                  <Link
                    href={`/nex-native/dev/hotel-flow/booking/${property.id}?room=${r.id}`}
                    style={{
                      padding: "9px 14px",
                      borderRadius: 10,
                      background: NEX.accent,
                      color: "#FFFFFF",
                      fontSize: 13,
                      fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    Request
                  </Link>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </PageShell>
  );
}
