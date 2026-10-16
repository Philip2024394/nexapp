// Screen 10 · Around Your Stay (local NEX services, dedup against hotel).
"use client";

import type * as React from "react";
import { use } from "react";
import Link from "next/link";
import { PageShell, TopBarBack } from "../../../_components/_page-shell";
import { Icon } from "../../../_components/_icons";
import { NEX } from "../../../_components/_palette";
import {
  getPropertyById,
  visibleLocalCategoriesFor,
  providersForCategory,
} from "../../../_components/_fixtures";

export default function AroundPage({ params }: { params: Promise<{ id: string }> }): React.ReactElement {
  const { id } = use(params);
  const property = getPropertyById(id);
  if (!property) return <PageShell><div style={{ padding: 24 }}>Not found.</div></PageShell>;

  const categories = visibleLocalCategoriesFor(property);

  return (
    <PageShell>
      <TopBarBack title="Around your stay" onBackHref={`/nex-native/dev/hotel-flow/detail/${property.id}`} />
      <section style={{ padding: "16px 18px 10px" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: NEX.text, letterSpacing: "-0.015em" }}>
          Make the most of your stay
        </h1>
        <div style={{ marginTop: 4, fontSize: 12, color: NEX.textMuted, lineHeight: 1.5 }}>
          Independent local NEX businesses near {property.name} ·
          services the hotel itself provides are hidden.
        </div>
      </section>

      {categories.length === 0 ? (
        <section style={{ padding: "16px 18px 30px" }}>
          <div style={{ padding: 20, background: NEX.surfaceAlt, border: `1px solid ${NEX.divider}`, borderRadius: 12, textAlign: "center", color: NEX.textMuted, fontSize: 13 }}>
            Not enough nearby providers to show yet.
          </div>
        </section>
      ) : (
        <section style={{ padding: "4px 0 24px", display: "flex", flexDirection: "column", gap: 20 }}>
          {categories.map((cat) => {
            const providers = providersForCategory(cat.id).slice(0, 3);
            if (providers.length === 0) return null;
            return (
              <div key={cat.id}>
                <div style={{ padding: "0 18px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: NEX.accentMuted, color: NEX.accent, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name={cat.icon} size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: NEX.text }}>{cat.label}</div>
                      <div style={{ fontSize: 11, color: NEX.textMuted }}>{cat.hint}</div>
                    </div>
                  </div>
                  <Link href="/nex-native/dev/hotel-flow/more" style={{ fontSize: 11, color: NEX.accent, fontWeight: 700, textDecoration: "none" }}>
                    See more
                  </Link>
                </div>
                <div
                  className="nex-no-scrollbar"
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "0 18px",
                    overflowX: "auto",
                    scrollSnapType: "x mandatory",
                  }}
                >
                  {providers.map((p) => (
                    <article
                      key={p.id}
                      style={{
                        flex: "0 0 180px",
                        scrollSnapAlign: "start",
                        background: NEX.surface,
                        border: `1px solid ${NEX.divider}`,
                        borderRadius: 12,
                        overflow: "hidden",
                        boxShadow: NEX.shadow,
                      }}
                    >
                      <div style={{ aspectRatio: "4 / 3", background: NEX.surfaceAlt }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.imageUrl} alt={`${p.name} · illustrative`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      </div>
                      <div style={{ padding: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: NEX.text, lineHeight: 1.2 }}>{p.name}</div>
                        <div style={{ marginTop: 2, fontSize: 11, color: NEX.textMuted }}>
                          {p.distanceKm === 0 ? "Delivered to hotel" : `${p.distanceKm.toFixed(1)} km`} · {p.city}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 11, color: NEX.textMid, lineHeight: 1.4 }}>{p.oneLiner}</div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <div style={{ padding: "0 18px 30px", fontSize: 11, color: NEX.textSoft, lineHeight: 1.5 }}>
        Providers shown are prototype fixtures. In production, only
        verified NEX businesses with ≥2 providers per category appear.
      </div>
    </PageShell>
  );
}
