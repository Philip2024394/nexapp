// Screen 15 · More / Menu.
"use client";

import type * as React from "react";
import Link from "next/link";
import { PageShell, TopBarBrand } from "../_components/_page-shell";
import { BottomNav } from "../_components/_bottom-nav";
import { Icon } from "../_components/_icons";
import { NEX } from "../_components/_palette";
import { LOCAL_SERVICE_CATALOG } from "../_components/_fixtures";

export default function MorePage(): React.ReactElement {
  return (
    <PageShell>
      <TopBarBrand />
      <section style={{ padding: "16px 18px 6px" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: NEX.text, letterSpacing: "-0.015em" }}>More</h1>
      </section>

      {/* Local services */}
      <section style={{ padding: "16px 18px 6px" }}>
        <div style={{ fontSize: 11, color: NEX.textMuted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 10 }}>Local services</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {LOCAL_SERVICE_CATALOG.map((c) => (
            <Link
              key={c.id}
              href="#"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 12px",
                background: NEX.surface,
                border: `1px solid ${NEX.divider}`,
                borderRadius: 12,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: NEX.accentMuted, color: NEX.accent, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={c.icon} size={18} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: NEX.text }}>{c.label}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Help & settings */}
      <section style={{ padding: "16px 18px 6px" }}>
        <div style={{ fontSize: 11, color: NEX.textMuted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 10 }}>Help & settings</div>
        {[
          { label: "Help centre", icon: "info" },
          { label: "Settings", icon: "profile" },
          { label: "Privacy", icon: "shield" },
          { label: "About NEX", icon: "globe" },
        ].map((it) => (
          <Link
            key={it.label}
            href="#"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 14px",
              background: NEX.surface,
              border: `1px solid ${NEX.divider}`,
              borderRadius: 12,
              textDecoration: "none",
              color: "inherit",
              marginBottom: 8,
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: NEX.accentMuted, color: NEX.accent, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name={it.icon} size={18} />
            </div>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: NEX.text }}>{it.label}</div>
            <span style={{ color: NEX.textMuted, display: "inline-flex" }}>
              <Icon name="chevronRight" size={18} />
            </span>
          </Link>
        ))}
      </section>

      <div style={{ padding: "20px 18px", fontSize: 10, color: NEX.textSoft, textAlign: "center" }}>
        NEX prototype · fixture data · no production writes.
      </div>

      <BottomNav active="more" />
    </PageShell>
  );
}
