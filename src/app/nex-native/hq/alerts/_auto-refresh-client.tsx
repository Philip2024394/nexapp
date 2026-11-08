"use client";

// src/app/nex-native/hq/alerts/_auto-refresh-client.tsx
//
// NEX HQ Alerts · auto-refresh · owner-authorised 2026-11-08 (round 9)
// Priority 3.
// -----------------------------------------------------------------------------
// Architecture note · why polling, not Supabase realtime.
//
// The sealed RLS pattern on nex_incident (migration 300 + 304) is
// service_role INSERT + SELECT + UPDATE · ZERO policies for anon or
// authenticated. A browser-side Supabase realtime subscription needs
// the anon key AND an RLS policy that allows the browser to SELECT
// the rows it subscribes to. Granting that would weaken the sealed
// access model · the HQ UI would no longer be the ONLY surface that
// can read the incident table.
//
// Owner directive explicit · "Implement reliable updates with realtime
// and polling fallback." The reliable path within the sealed RLS is
// polling via Next's router.refresh(). A future owner-authorised
// change could add a server-sent-events bridge where service_role
// reads events server-side and streams redacted updates to the
// HQ-authorised browser · that work is OUT OF SCOPE for Priority 3
// and documented so the trade-off is explicit.
//
// Behaviour
//   · First interval fires at REFRESH_INTERVAL_MS after mount.
//   · router.refresh() re-renders the server component · existing
//     server-rendered content stays visible between refreshes (Next
//     does not blank the page).
//   · Visibility API · we pause when the tab is hidden · resume on
//     visibilitychange. Prevents background load on an idle tab.
//   · A stop/start toggle lets the operator pause the loop (e.g. when
//     reading a specific incident for a long time).

import * as React from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 30_000;

export function AlertsAutoRefresh(): React.JSX.Element {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(true);
  const [tick, setTick] = React.useState(0);
  const [visibleNow, setVisibleNow] = React.useState<boolean>(
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );

  React.useEffect(() => {
    if (!enabled || !visibleNow) return;
    const id = window.setInterval(() => {
      // Bump the tick counter FIRST so the "last refreshed" UI
      // updates even when router.refresh() is a no-op (e.g. the
      // server-rendered output hasn't changed).
      setTick((t) => t + 1);
      router.refresh();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [enabled, visibleNow, router]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    function onVisibility(): void {
      setVisibleNow(document.visibilityState === "visible");
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const label = !enabled
    ? "Auto-refresh paused"
    : !visibleNow
      ? "Auto-refresh resumes when tab is active"
      : `Auto-refresh every ${REFRESH_INTERVAL_MS / 1000}s · tick ${tick}`;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid rgba(22,214,107,0.22)",
        background: "rgba(22,214,107,0.04)",
        fontSize: 11,
        color: "#B5C3D6",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: enabled && visibleNow ? "#16D66B" : "#7D9BC0",
          boxShadow: enabled && visibleNow ? "0 0 8px #16D66B" : "none",
        }}
      />
      <span style={{ flex: 1 }}>{label}</span>
      <button
        type="button"
        onClick={() => {
          setEnabled((e) => !e);
          if (!enabled) {
            // Resuming · fire a refresh immediately so the operator
            // gets fresh state without waiting a full interval.
            router.refresh();
          }
        }}
        style={{
          padding: "4px 10px",
          borderRadius: 6,
          border: "1px solid rgba(22,214,107,0.3)",
          background: "transparent",
          color: enabled ? "#16D66B" : "#7D9BC0",
          fontSize: 10.5,
          fontWeight: 800,
          cursor: "pointer",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {enabled ? "Pause" : "Resume"}
      </button>
      <button
        type="button"
        onClick={() => {
          setTick((t) => t + 1);
          router.refresh();
        }}
        style={{
          padding: "4px 10px",
          borderRadius: 6,
          border: "1px solid rgba(22,214,107,0.3)",
          background: "transparent",
          color: "#B5C3D6",
          fontSize: 10.5,
          fontWeight: 800,
          cursor: "pointer",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        Refresh now
      </button>
    </div>
  );
}
