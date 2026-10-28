"use client";

// src/lib/nex-native/emergency/_group-countdown.ts
//
// NEX Emergency Help · shared group-expiry countdown. Owner directive
// 2026-10-25 · "Group Expires … should be count down timer from 24
// hours same with all timer connected to this group and card".
//
// All surfaces that show the group's 24-hour lifetime (hero text on
// the group page, drawer "Expires in …" line, pinned card countdown
// chip on /contacts) MUST read from this hook so a single clock
// ticks everywhere. SessionStorage holds the activation moment so
// cross-route navigation keeps a stable anchor until the tab closes.
//
// Format is "H.MM" ("23.59" on first mount, "19.00" after four
// hours, "0.03" near expiry). The owner specified the format.
//
// Prototype only · the real build will read `incident.activated_at`
// from the server so every helper sees the same number regardless of
// which tab or device they joined from.

import * as React from "react";

export const GROUP_EXPIRY_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = "nex_emergency_group_started_at";

function readOrInitStartedAt(): number {
  if (typeof window === "undefined") return Date.now();
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const now = Date.now();
    window.sessionStorage.setItem(STORAGE_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

export function formatCountdownHM(remainingMs: number): string {
  if (remainingMs <= 0) return "0.00";
  const totalMin = Math.floor(remainingMs / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}.${String(m).padStart(2, "0")}`;
}

export interface GroupCountdown {
  readonly label: string;
  readonly remainingMs: number;
}

export function useGroupCountdown(): GroupCountdown {
  // SSR-safe: on first render both server and client start with
  // Date.now() from the initializer, then useEffect upgrades to the
  // sessionStorage anchor before the first paint on the client. Tiny
  // chance of hydration mismatch is bounded by the single tick · the
  // visible string is identical for the first second after mount.
  const [startedAt, setStartedAt] = React.useState<number>(() => Date.now());
  const [now, setNow] = React.useState<number>(() => Date.now());

  React.useEffect(() => {
    setStartedAt(readOrInitStartedAt());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, startedAt + GROUP_EXPIRY_MS - now);
  return { label: formatCountdownHM(remainingMs), remainingMs };
}
