// src/app/nex-native/dev/hotel-flow/_components/_bottom-nav.tsx
// Bottom tab bar · Home · Trips · Chat · Profile.

"use client";

import type * as React from "react";
import Link from "next/link";
import { NEX, MOBILE_SHELL_MAX_WIDTH } from "./_palette";
import { Icon } from "./_icons";

export type BottomTab = "home" | "trips" | "chat" | "profile" | "more";

const TABS: readonly {
  readonly id: BottomTab;
  readonly label: string;
  readonly icon: string;
  readonly href: string;
}[] = [
  { id: "home", label: "Home", icon: "home", href: "/nex-native/dev/hotel-flow/discover" },
  { id: "trips", label: "Trips", icon: "trips", href: "/nex-native/dev/hotel-flow/trips" },
  { id: "chat", label: "Chat", icon: "message", href: "/nex-native/dev/hotel-flow/chat" },
  { id: "profile", label: "Profile", icon: "profile", href: "/nex-native/dev/hotel-flow/profile" },
  { id: "more", label: "More", icon: "more", href: "/nex-native/dev/hotel-flow/more" },
];

export function BottomNav({ active }: { readonly active: BottomTab }): React.ReactElement {
  return (
    <nav
      aria-label="Primary navigation"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 90,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          width: "100%",
          maxWidth: MOBILE_SHELL_MAX_WIDTH,
          background: NEX.bg,
          borderTop: `1px solid ${NEX.divider}`,
          display: "grid",
          gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
          padding: "6px 2px 10px",
        }}
      >
        {TABS.map((t) => {
          const isActive = t.id === active;
          return (
            <Link
              key={t.id}
              href={t.href}
              aria-current={isActive ? "page" : undefined}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                padding: "6px 4px",
                color: isActive ? NEX.accent : NEX.textMuted,
                textDecoration: "none",
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                letterSpacing: 0.2,
              }}
            >
              <Icon name={t.icon} size={22} />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
