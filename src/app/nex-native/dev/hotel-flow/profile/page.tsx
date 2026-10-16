// Screen 14b · Profile.
"use client";

import type * as React from "react";
import Link from "next/link";
import { PageShell, TopBarBrand } from "../_components/_page-shell";
import { BottomNav } from "../_components/_bottom-nav";
import { Icon } from "../_components/_icons";
import { NEX } from "../_components/_palette";

const PROFILE_ITEMS: readonly { readonly label: string; readonly icon: string; readonly href: string; readonly sub?: string }[] = [
  { label: "Saved places", icon: "heart", href: "#", sub: "Favorites and shortlists" },
  { label: "Payment methods", icon: "wallet", href: "#", sub: "Cards and preferred methods" },
  { label: "Preferences", icon: "profile", href: "#", sub: "Language, currency, travel preferences" },
  { label: "Security", icon: "shield", href: "#", sub: "Password, devices, sign-out" },
  { label: "Owner / claim my business", icon: "key", href: "#", sub: "Claim and verify your business on NEX" },
];

export default function ProfilePage(): React.ReactElement {
  return (
    <PageShell>
      <TopBarBrand />
      <section style={{ padding: "20px 18px 16px", display: "flex", alignItems: "center", gap: 14 }}>
        <div
          aria-hidden
          style={{
            width: 60,
            height: 60,
            borderRadius: 999,
            background: NEX.accentMuted,
            color: NEX.accent,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            fontWeight: 800,
          }}
        >
          NG
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: NEX.text }}>NEX Guest</div>
          <div style={{ fontSize: 12, color: NEX.textMuted }}>Prototype account · fixture data</div>
        </div>
      </section>

      <section style={{ padding: "0 18px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
        {PROFILE_ITEMS.map((it) => (
          <Link
            key={it.label}
            href={it.href}
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
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: NEX.accentMuted, color: NEX.accent, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name={it.icon} size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: NEX.text }}>{it.label}</div>
              {it.sub ? <div style={{ fontSize: 11, color: NEX.textMuted, marginTop: 2 }}>{it.sub}</div> : null}
            </div>
            <span style={{ color: NEX.textMuted, display: "inline-flex" }}>
              <Icon name="chevronRight" size={18} />
            </span>
          </Link>
        ))}
      </section>

      <section style={{ padding: "20px 18px 30px" }}>
        <button
          type="button"
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: `1px solid ${NEX.divider}`,
            background: NEX.surface,
            color: NEX.danger,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </section>

      <BottomNav active="profile" />
    </PageShell>
  );
}
