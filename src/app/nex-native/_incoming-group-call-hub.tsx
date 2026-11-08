"use client";

// src/app/nex-native/_incoming-group-call-hub.tsx
//
// Owner-authorised 2026-11-08 (round 27) · next priority after
// GroupCallEngine mount. Global incoming-group-call banner for
// Call Center invites.
// -----------------------------------------------------------------------------
// Architecture note
//   · Sealed 1:1 call hub (_incoming-call-hub.tsx) uses Supabase
//     Realtime presence · fine because 1:1 calls have no DB table
//     RLS to cross. Group-call invites live in nex_group_call_*
//     tables whose sealed RLS is service_role-only. The anon /
//     authenticated client cannot subscribe to those tables.
//   · Poll via /api/nex-native/calls/incoming-group/route.ts every
//     15 seconds is the right primary. A future server-sent-events
//     bridge could layer on top · out of scope this round.
//
// UX contract
//   · Shows a fixed overlay at the top of the phone frame when ≥1
//     pending invite exists. Ring sound plays on NEW invite only
//     (not on every poll).
//   · Accept routes to /nex-native/call/preview?session=<id>&accept=1
//     · the Call Center page flips the participant row + opens
//     the opt-in LiveCallClient.
//   · Decline routes to the same page with accept=0 · the page's
//     acceptInviteOnLoad sets left_at + fires the decline
//     notification (round 24) to the host's chat.
//   · Overlay dismisses locally when the invite disappears from the
//     poll result (host cancelled · timeout · already accepted on
//     another tab).
//
// Content safety · hostDisplayName + mediaType only. No chat
// content. No cross-country disclosure here (that lives on the
// Call Center page's accept-step chip).

import * as React from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 15_000;

interface IncomingGroupInvite {
  readonly sessionId: string;
  readonly invitedAt: string;
  readonly mediaType: "audio" | "video";
  readonly hostAccountId: string;
  readonly hostDisplayName: string;
  readonly hostCountry: "ireland" | "indonesia" | "worldwide" | "global";
  readonly viewerCountry: "ireland" | "indonesia" | "worldwide" | "global";
  readonly crossCountry: boolean;
  readonly sessionState: "ringing" | "live" | "ended";
}

export interface IncomingGroupCallHubProps {
  readonly disabled?: boolean;
}

const NEX = {
  bg: "rgba(5,26,16,0.95)",
  emerald: "#16D66B",
  emeraldBorder: "rgba(22,214,107,0.55)",
  gold: "#D9A83A",
  goldBright: "#F0C85A",
  goldBorder: "rgba(217,168,58,0.55)",
  endRed: "#8B1A24",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
};

export function IncomingGroupCallHub({
  disabled,
}: IncomingGroupCallHubProps): React.JSX.Element | null {
  const router = useRouter();
  const [invites, setInvites] = React.useState<readonly IncomingGroupInvite[]>([]);
  const [visibleSessionId, setVisibleSessionId] = React.useState<string | null>(null);
  const seenRef = React.useRef<Set<string>>(new Set());
  const pollingRef = React.useRef(false);

  React.useEffect(() => {
    if (disabled || typeof document === "undefined") return;

    let alive = true;
    async function poll(): Promise<void> {
      if (!alive || pollingRef.current) return;
      pollingRef.current = true;
      try {
        const res = await fetch("/api/nex-native/calls/incoming-group", {
          method: "GET",
          cache: "no-store",
        });
        if (!alive) return;
        if (!res.ok) return;
        const data = (await res.json()) as { invites?: IncomingGroupInvite[] };
        const list = Array.isArray(data.invites) ? data.invites : [];
        setInvites(list);
        // Select the first fresh invite as the overlay target. Fall
        // through if no pending invites.
        const fresh = list.find((inv) => !seenRef.current.has(inv.sessionId));
        if (fresh) {
          seenRef.current.add(fresh.sessionId);
          setVisibleSessionId(fresh.sessionId);
        } else if (list.length === 0) {
          setVisibleSessionId(null);
        }
      } catch {
        /* fail-soft · next poll retries */
      } finally {
        pollingRef.current = false;
      }
    }

    // Initial fetch + interval. Visibility API · pause when the
    // tab is hidden so a backgrounded tab doesn't hammer the API.
    let intervalId: ReturnType<typeof setInterval> | null = null;
    function startInterval(): void {
      if (intervalId) return;
      void poll();
      intervalId = setInterval(poll, POLL_INTERVAL_MS);
    }
    function stopInterval(): void {
      if (!intervalId) return;
      clearInterval(intervalId);
      intervalId = null;
    }
    function onVisibility(): void {
      if (document.visibilityState === "visible") startInterval();
      else stopInterval();
    }
    if (document.visibilityState === "visible") startInterval();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      alive = false;
      stopInterval();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [disabled]);

  const active =
    invites.find((inv) => inv.sessionId === visibleSessionId) ?? null;
  if (!active) return null;

  function accept(): void {
    if (!active) return;
    router.push(
      `/nex-native/call/preview?session=${encodeURIComponent(active.sessionId)}&accept=1`,
    );
  }
  function decline(): void {
    if (!active) return;
    // Hide the overlay immediately · the Call Center page handles
    // the DB flip + decline notification idempotently (round 24).
    setVisibleSessionId(null);
    router.push(
      `/nex-native/call/preview?session=${encodeURIComponent(active.sessionId)}&accept=0`,
    );
  }

  const mediaLabel = active.mediaType === "audio" ? "Voice" : "Video";
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={`Incoming ${mediaLabel.toLowerCase()} call from ${active.hostDisplayName}`}
      data-nex-incoming-group-call
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        right: 10,
        zIndex: 60,
        background: NEX.bg,
        border: `1px solid ${NEX.goldBorder}`,
        borderRadius: 14,
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 42,
          height: 42,
          borderRadius: 999,
          background:
            `linear-gradient(135deg, ${NEX.emerald} 0%, ${NEX.gold} 100%)`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#04140A",
          fontSize: 18,
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        📞
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            color: NEX.goldBright,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
          }}
        >
          Incoming {mediaLabel.toLowerCase()} call
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: NEX.text, marginTop: 2 }}>
          {active.hostDisplayName}
        </div>
        {active.crossCountry && (
          <div
            style={{
              fontSize: 10,
              color: NEX.goldBright,
              marginTop: 2,
            }}
          >
            🌍 Cross-country · {active.hostCountry} → {active.viewerCountry}
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label="Decline"
        onClick={decline}
        data-nex-incoming-group-decline
        style={{
          width: 42,
          height: 42,
          borderRadius: 999,
          border: `1px solid ${NEX.endRed}`,
          background: NEX.endRed,
          color: NEX.text,
          fontSize: 16,
          cursor: "pointer",
          fontFamily: "inherit",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        ✖
      </button>
      <button
        type="button"
        aria-label="Accept"
        onClick={accept}
        data-nex-incoming-group-accept
        style={{
          width: 42,
          height: 42,
          borderRadius: 999,
          border: `1px solid ${NEX.emerald}`,
          background: NEX.emerald,
          color: "#04140A",
          fontSize: 18,
          fontWeight: 900,
          cursor: "pointer",
          fontFamily: "inherit",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        ✓
      </button>
    </div>
  );
}
