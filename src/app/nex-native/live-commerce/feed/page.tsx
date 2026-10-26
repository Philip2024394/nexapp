// src/app/nex-native/live-commerce/feed/page.tsx
//
// Phase 2 · G2 · §5.1 · Central NEX Live discovery feed.
// -----------------------------------------------------------------------------
// Owner-authorised 2026-10-24 per saved plan §5.1 (mixed swipeable
// discovery feed covering Live broadcasts + uploaded videos +
// community posts). This file ships the LIVE-broadcasts section only ·
// the mixed uploaded-video + community-post integrations are tagged
// as TBD per the saved plan §5.1 (upload-surface integration not yet
// specified · community-post integration shape not yet decided).
//
// Honest labelling (§5.1 security-copy prohibition)
// -----------------------------------------------------------------------------
// This surface does NOT expose the Community Notice location
// mechanism in user-facing copy. No "2km", "radius", "near you",
// "auto-assigned". Only broadcaster display-name / business-name is
// surfaced. Phase 2 Slice 1 ships the Live-sessions list only · the
// mixed-content composition clause (§5.1) is reserved for the slice
// that resolves the uploaded-video + community-post integrations.
//
// Data model
// -----------------------------------------------------------------------------
// Reads nex_live_session where status='open' via the fail-open
// listOpenSessionsPublic() service helper. Joins the broadcaster's
// nex_account for display-name and (if business-attached) the
// nex_business.display_name. Empty state renders cleanly when no
// sessions are live.
//
// Realtime
// -----------------------------------------------------------------------------
// First-pass render is server-side (SSR). The page `dynamic` setting
// forces re-render per request so a viewer refreshing sees fresh
// sessions. A future client-side refinement can subscribe to
// nex_live_session changes via Supabase Realtime for live counter
// updates · that is not strictly required for the feed to work.

import type * as React from "react";
import Link from "next/link";
import { LiveProductIndicator } from "@/components/nex-native/live-commerce/LiveProductIndicator";
import { ShuffledRecordedVideos } from "./_shuffled-recorded-videos";
import { listOpenSessionsPublic, getActiveSessionForBroadcaster } from "@/lib/nex-native/live-broadcast/live-session-service";
import { evaluateLiveness } from "@/lib/nex-native/live-broadcast/stale-session-policy";
import {
  listPublishedUploadedVideos,
  type UploadedVideoRow,
} from "@/lib/nex-native/live-broadcast/uploaded-video-service";
import {
  listDevUploadedVideos,
  isDevManifestActive,
} from "@/lib/nex-native/live-broadcast/dev-video-manifest";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
// Owner-authorised 2026-10-27 (D-C integration slice 1) · bridge the
// sealed Live-feed category toggles into the server-rendered feed.
// Reads a URL-encoded JSON cookie (`nex-feed-prefs`) that mirrors
// the device-local localStorage state in `_live-feed-preferences.tsx`.
// Honours only the AI category today · the predicate documents the
// honest limit for the other 14 categories (no server-side classifier).
import { cookies } from "next/headers";
import {
  FEED_PREFS_COOKIE_NAME,
  parseFeedPrefs,
} from "@/lib/nex-native/live-feed/feed-preferences-cookie";
import { filterUploadedVideosByCategoryPrefs } from "@/lib/nex-native/live-feed/feed-preferences-filter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "NEX · Live",
  description: "People broadcasting live on NEX right now.",
};

const NEX = {
  bg: "#020914",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.42)",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  red: "#FF3355",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

interface FeedEntry {
  readonly sessionId: string;
  readonly broadcasterAccountId: string;
  readonly broadcasterDisplayName: string;
  readonly businessId: string | null;
  readonly businessDisplayName: string | null;
  readonly startedAt: string;
  /** Plan v4 · AC-3 · server-computed relative TTL (ms) so the
   *  per-card LIVE pill can decay client-side via
   *  `useLiveClockTick`. Computed with the SAME nowMs that filtered
   *  the sessions. If `evaluateLiveness` returns `{ isLive: false }`
   *  (fail-safe), the row is omitted from the feed entirely rather
   *  than carrying a non-positive TTL. */
  readonly liveExpiresInMs: number;
}

async function hydrateFeed(nowMs: number): Promise<readonly FeedEntry[]> {
  const sessions = await listOpenSessionsPublic({ limit: 50, nowMs });
  if (sessions.length === 0) return [];

  const accountIds = Array.from(
    new Set(sessions.map((s) => s.broadcaster_account_id)),
  );
  const businessIds = Array.from(
    new Set(
      sessions
        .map((s) => s.business_id)
        .filter((v): v is string => v !== null),
    ),
  );

  // Hydrate broadcaster display names (fail-open).
  const accountMap = new Map<string, string>();
  try {
    const { data } = await nexSupabaseAdmin
      .from("nex_account")
      .select("id, display_name")
      .in("id", accountIds);
    for (const row of (data ?? []) as Array<{
      id: string;
      display_name: string | null;
    }>) {
      accountMap.set(row.id, row.display_name ?? "NEX user");
    }
  } catch {
    // Keep empty · we fall back to "NEX user" below.
  }

  const businessMap = new Map<string, string>();
  if (businessIds.length > 0) {
    try {
      const { data } = await nexSupabaseAdmin
        .from("nex_business")
        .select("id, display_name")
        .in("id", businessIds);
      for (const row of (data ?? []) as Array<{
        id: string;
        display_name: string | null;
      }>) {
        businessMap.set(row.id, row.display_name ?? "NEX business");
      }
    } catch {
      // Keep empty.
    }
  }

  // Plan v4 · AC-2 + AC-3 + AC-10 · re-evaluate each session using
  // the SAME nowMs so each feed card carries its own `liveExpiresInMs`.
  // Rows that no longer satisfy the policy (edge-case internal drift,
  // or a mock that bypassed the filter) are OMITTED from the feed so
  // no card displays a LIVE pill without a positive TTL.
  const out: FeedEntry[] = [];
  for (const s of sessions) {
    const verdict = evaluateLiveness(s, nowMs);
    if (!verdict.isLive) continue;
    out.push({
      sessionId: s.id,
      broadcasterAccountId: s.broadcaster_account_id,
      broadcasterDisplayName:
        accountMap.get(s.broadcaster_account_id) ?? "NEX user",
      businessId: s.business_id,
      businessDisplayName: s.business_id
        ? (businessMap.get(s.business_id) ?? null)
        : null,
      startedAt: s.started_at,
      liveExpiresInMs: verdict.liveExpiresInMs,
    });
  }
  return out;
}

export default async function LiveFeedPage(): Promise<React.JSX.Element> {
  // Plan v4 · AC-1 · one nowMs per request flows through hydrateFeed
  // AND the viewer-session eligibility check below.
  const nowMs = Date.now();
  const entries = await hydrateFeed(nowMs);

  /* Context-aware Go Live CTA.
     - Signed-in viewer with an existing open session → "Return to
       Live" (routes back to /go-live so the broadcaster surface
       resumes). The eligibility is derived from the actual DB state
       via getActiveSessionForBroadcaster.
     - Signed-in viewer with no open session → "Go Live" (routes to
       /go-live which handles device-eligibility + sign-up gating).
     - Guest → NO Go Live CTA; the drawer surfaces its own
       sign-in-required chrome. Rendering a Go Live for guests would
       mislead · tapping lands on sign-in.
     The eligibility logic reuses existing primitives · we do NOT
     invent a new eligibility API. */
  const session = await resolveNexAppSessionFromContext().catch(() => null);
  const viewerAccountId = session?.account.id ?? null;
  let viewerHasActiveBroadcast = false;
  if (viewerAccountId !== null) {
    const activeOwn = await getActiveSessionForBroadcaster(
      viewerAccountId,
      nowMs,
    );
    viewerHasActiveBroadcast = activeOwn !== null;
  }

  return (
    <main
      data-nex-live-feed
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        paddingBottom: 80,
      }}
    >
      <header
        style={{
          padding: "calc(env(safe-area-inset-top, 0px) + 14px) 20px 12px",
          borderBottom: `1px solid ${NEX.border}`,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: NEX.cyan,
            }}
          >
            NEX Live
          </div>
          <h1 style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 800 }}>
            Who&apos;s live now
          </h1>
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: NEX.textDim,
              lineHeight: 1.4,
            }}
          >
            People broadcasting on NEX right now. Tap any card to watch.
          </div>
        </div>
        {viewerAccountId !== null && (
          <Link
            href="/nex-native/live-commerce/go-live"
            data-nex-live-feed-go-live-cta
            data-nex-live-feed-go-live-state={
              viewerHasActiveBroadcast ? "resume" : "start"
            }
            aria-label={
              viewerHasActiveBroadcast
                ? "Return to your live broadcast"
                : "Start a new live broadcast"
            }
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 14px",
              borderRadius: 999,
              background: viewerHasActiveBroadcast
                ? "linear-gradient(135deg, #FF7200 0%, #FF3355 100%)"
                : "linear-gradient(135deg, #FF3355 0%, #FF7200 100%)",
              color: "#FFFFFF",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.02em",
              boxShadow: "0 8px 20px -8px rgba(255, 51, 85, 0.5)",
              whiteSpace: "nowrap",
            }}
          >
            <span aria-hidden style={{ fontSize: 14 }}>●</span>
            {viewerHasActiveBroadcast ? "Return to Live" : "Go Live"}
          </Link>
        )}
      </header>

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <section
          aria-label="Live sessions"
          style={{
            padding: "16px 20px 20px",
            display: "grid",
            gap: 12,
          }}
        >
          {entries.map((e) => (
            <LiveFeedCard key={e.sessionId} entry={e} />
          ))}
        </section>
      )}

      {/* Recorded videos section · owner directive 2026-10-24.
          Distinct from Live sessions · NEVER labelled as currently
          Live. Fail-open · when Migration 223 is unapplied OR when
          no videos are published, the section renders nothing. The
          UPLOADED chip is grey (not red) · the red LIVE pill is
          reserved for Live sessions only. */}
      <RecordedVideosSection />

      {/* Community posts · still TBD per saved plan §5.1 */}
      <section
        aria-label="Community posts"
        data-nex-live-feed-community-tbd
        style={{
          padding: "0 20px 20px",
        }}
      >
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: NEX.panelSoft,
            border: `1px solid ${NEX.border}`,
            color: NEX.textMute,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: NEX.textDim, fontWeight: 700 }}>
            Coming next ·
          </strong>{" "}
          community posts will appear in this feed alongside live
          broadcasts and recorded videos. We&apos;ll bring them in
          once their visibility rules are finalised.
        </div>
      </section>
    </main>
  );
}

async function RecordedVideosSection(): Promise<React.JSX.Element | null> {
  const rawVideos = isDevManifestActive()
    ? listDevUploadedVideos({ limit: 20 })
    : await listPublishedUploadedVideos({ limit: 20 });
  if (rawVideos.length === 0) return null;

  // D-C integration slice 1 · honour the viewer's category toggles.
  // Fail-open · if the cookie is missing or malformed, the predicate
  // falls back to "all allowed" and the viewer sees the full pool
  // (same behaviour as before this slice landed).
  const prefCookieValue =
    (await cookies()).get(FEED_PREFS_COOKIE_NAME)?.value ?? null;
  const prefs = parseFeedPrefs(prefCookieValue);
  const videos = filterUploadedVideosByCategoryPrefs(rawVideos, prefs);
  if (videos.length === 0) return null;

  return (
    <section
      aria-label="Recorded videos"
      data-nex-live-feed-recorded-videos
      style={{
        padding: "0 20px 20px",
      }}
    >
      <h2
        style={{
          margin: "0 0 10px",
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "0.04em",
          color: NEX.textDim,
        }}
      >
        Recorded videos
      </h2>
      <div
        style={{
          display: "grid",
          gap: 10,
        }}
      >
        {/* Owner directive 2026-10-25 · per-tab shuffle-no-repeat.
            The server emits the full set in manifest order; the
            client shuffles once per browser tab via sessionStorage
            so each visit sees a fresh order and no video appears
            twice within one tab. See
            `_shuffled-recorded-videos.tsx` for the storage contract. */}
        <ShuffledRecordedVideos
          videos={videos}
          cards={videos.map((v) => ({
            id: v.id,
            node: <RecordedVideoCard key={v.id} video={v} />,
          }))}
        />
      </div>
    </section>
  );
}

function RecordedVideoCard({
  video,
}: {
  readonly video: UploadedVideoRow;
}): React.JSX.Element {
  // The watch URL is a dedicated recorded-video surface distinct
  // from the Live viewer (which carries a WebRTC+Realtime payload
  // this one does not need). Phase A ships the DB row + feed card;
  // the dedicated viewer surface is a follow-up slice.
  const watchHref = `/nex-native/videos/${video.id}`;
  return (
    <Link
      href={watchHref}
      data-nex-recorded-video-card={video.id}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 14,
        background: NEX.panelSoft,
        // Distinct border colour from Live cards (red/cyan) so the
        // visual chrome never conflates with an active broadcast.
        border: `1px solid ${NEX.border}`,
        color: NEX.text,
        textDecoration: "none",
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 56,
          height: 56,
          borderRadius: 10,
          background: "linear-gradient(135deg, #0E1526 0%, #182540 100%)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          color: NEX.textDim,
        }}
      >
        ▷
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: NEX.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {video.title}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 11,
            color: NEX.textDim,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            data-nex-recorded-video-chip
            style={{
              padding: "1px 6px",
              borderRadius: 6,
              background: "rgba(139, 169, 209, 0.14)",
              color: NEX.textDim,
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Recorded
          </span>
          {video.duration_seconds !== null && (
            <span>{formatDuration(video.duration_seconds)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function LiveFeedCard({ entry }: { readonly entry: FeedEntry }): React.JSX.Element {
  const watchHref = `/nex-native/live-commerce/${entry.sessionId}`;
  const title = entry.businessDisplayName ?? entry.broadcasterDisplayName;
  const subtitle = entry.businessDisplayName
    ? entry.broadcasterDisplayName
    : "Live on NEX";
  return (
    <Link
      href={watchHref}
      data-nex-live-feed-card={entry.sessionId}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 14,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.cyanSoft}`,
        color: NEX.text,
        textDecoration: "none",
        boxShadow: "0 6px 16px -8px rgba(0, 0, 0, 0.6)",
      }}
    >
      {/* Plan v4 · AC-6 + AC-8 · the per-card LIVE pill is the shared
          LiveProductIndicator so the server-computed TTL decays
          client-side consistently across every DB-heartbeat-derived
          surface. The watchHref is intentionally omitted here — the
          whole card is already a Link, so wrapping the pill in a
          nested Link would be invalid. */}
      <LiveProductIndicator
        isFeaturedLive={true}
        liveExpiresInMs={entry.liveExpiresInMs}
        label={`${title} is live now`}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 15,
            fontWeight: 700,
            color: NEX.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </span>
        <span
          style={{
            display: "block",
            marginTop: 2,
            fontSize: 11,
            color: NEX.textDim,
          }}
        >
          {subtitle}
        </span>
      </span>
      <span
        aria-hidden
        style={{
          color: NEX.textDim,
          fontSize: 14,
        }}
      >
        →
      </span>
    </Link>
  );
}

function EmptyState(): React.JSX.Element {
  return (
    <section
      data-nex-live-feed-empty
      style={{
        padding: "40px 20px",
        textAlign: "center",
        color: NEX.textDim,
      }}
    >
      <div style={{ fontSize: 42, marginBottom: 10 }} aria-hidden>
        📺
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: NEX.text }}>
        No one&apos;s live right now
      </div>
      <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5 }}>
        Check back later or go live yourself.
      </div>
      <Link
        href="/nex-native/live-commerce/go-live"
        data-nex-live-feed-cta-go-live
        style={{
          display: "inline-block",
          marginTop: 16,
          padding: "10px 18px",
          borderRadius: 999,
          background: NEX.cyan,
          color: "#031018",
          fontSize: 13,
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        Go live
      </Link>
    </section>
  );
}
