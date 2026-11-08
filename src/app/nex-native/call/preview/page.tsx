// src/app/nex-native/call/preview/page.tsx
//
// NEX Call Center · preview surface.
// Owner-authorised 2026-10-19 (Phase 1) · round 15 redesign
// 2026-11-08 · session-aware · gold frames · no mock · themed
// footer with dark-red end-call.
// -----------------------------------------------------------------------------
// Scope on this round (owner directives · running list):
//   · Call Center title · icon + text only · NO container
//   · Emerald + gold background (self-contained gradient)
//   · Video frames with NEX gold border wrappers
//   · NO MOCK data · page reads real participants from
//     nex_group_call_participant when a ?session=<uuid> is present
//     · otherwise renders an empty "Waiting for contacts" state
//   · Footer buttons themed emerald · end-call dark red · via a
//     page-local control bar (sealed calls-chrome/CallControlBar
//     is left untouched · it's used by production peer-chat)
//   · Add people + Add contacts · both gold · NO row container
//     (buttons float directly over the backdrop)
//
// Ready-for-live-call posture
//   · The GroupCallEngine (src/lib/nex-native/calls/group-call-
//     engine.ts) owns getUserMedia + pairwise RTCPeerConnection.
//     It is NOT auto-mounted here · mounting it fires the camera +
//     microphone permission prompt. Gating via an explicit
//     ?live=1 query so a direct-URL visitor never gets surprised
//     with a permission dialog. The code structure + real
//     participant data are ready · flipping to live is a one-
//     path change once the owner says "turn it on".
//   · Still gap-listed in docs/doctrine/video-call-wiring-audit-
//     2026-11-08.md · the invite-in-chat + accept flow (new
//     call_invite attachment type + migration 306 + Accept button
//     in peer-chat message renderer + push notifications) is a
//     separate owner authorisation.

import type { CSSProperties } from "react";
import type * as React from "react";
import { notFound } from "next/navigation";
import { VideoTile } from "@/lib/nex-native/calls-chrome/video-tile";
import { ConnectionFooter } from "@/lib/nex-native/calls-chrome/connection-footer";
import { CallControlBarShell } from "./_control-bar-shell";
import { AddPeopleContactsRow } from "./_add-row-client";
import type { CallsParticipant } from "@/lib/nex-native/calls-chrome/types";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  ControlDrawer,
  type ControlDrawerSession,
} from "@/components/nex-native/control-drawer/control-drawer-client";
import { fetchPickerContacts } from "@/lib/nex-native/calls/invite-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Owner directive 2026-11-08 · emerald + gold palette · the local
// page tokens. Sealed calls-chrome/* primitives keep their own
// palette because they're reused by production peer-chat.
const NEX = {
  bg: "var(--nex-world-background-base, #040E09)",
  emerald: "#16D66B",
  emeraldSoft: "rgba(22,214,107,0.12)",
  emeraldBorder: "rgba(22,214,107,0.28)",
  emeraldBorderBright: "rgba(22,214,107,0.55)",
  gold: "#D9A83A",
  goldBright: "#F0C85A",
  goldSoft: "rgba(217,168,58,0.12)",
  goldBorder: "rgba(217,168,58,0.55)",
  endRed: "#8B1A24",
  endRedBright: "#A6212F",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
};

// ─── Server data fetch · live-ready real participant read ─────────

interface SessionShape {
  readonly id: string;
  readonly state: "ringing" | "live" | "ended";
  readonly media_type: "audio" | "video";
  readonly host_account_id: string;
}

interface RawParticipantRow {
  readonly account_id: string;
  readonly invited_at: string | null;
  readonly joined_at: string | null;
  readonly left_at: string | null;
}

interface RawAccountRow {
  readonly id: string;
  readonly display_name: string | null;
}

async function fetchSession(sessionId: string): Promise<SessionShape | null> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_group_call_session")
      .select("id, state, media_type, host_account_id")
      .eq("id", sessionId)
      .maybeSingle();
    if (error || !data) return null;
    return data as SessionShape;
  } catch {
    return null;
  }
}

// Owner directive 2026-11-08 (round 16) · participants have a
// lifecycle: `pending` (invited, awaiting Accept · shows the
// waiting animation in the center of their tile) → `live` (joined
// · real video/audio stream). Modelled on the sealed migration
// 133 columns · invited_at + joined_at.
type ParticipantCallState = "pending" | "live";
interface Participant extends CallsParticipant {
  readonly callState: ParticipantCallState;
}

async function fetchParticipants(
  sessionId: string,
  selfAccountId: string | null,
): Promise<readonly Participant[]> {
  try {
    const { data: rows, error } = await nexSupabaseAdmin
      .from("nex_group_call_participant")
      .select("account_id, invited_at, joined_at, left_at")
      .eq("session_id", sessionId)
      .is("left_at", null);
    if (error || !rows) return [];
    const parts = rows as RawParticipantRow[];
    const ids = parts.map((r) => r.account_id);
    if (ids.length === 0) return [];
    const { data: accounts } = await nexSupabaseAdmin
      .from("nex_account")
      .select("id, display_name")
      .in("id", ids);
    const byId = new Map<string, RawAccountRow>(
      ((accounts ?? []) as RawAccountRow[]).map((a) => [a.id, a]),
    );
    return parts.map<Participant>((p) => {
      const callState: ParticipantCallState =
        p.joined_at != null ? "live" : "pending";
      return {
        id: p.account_id,
        name: byId.get(p.account_id)?.display_name ?? "Member",
        imageUrl: null,
        // Live mic/camera state carries over Realtime presence,
        // not the DB row · at render time we display the honest
        // baseline: audio on, video off. The live client will
        // update these from the GroupCallEngine presence payload
        // once mounted.
        micOn: true,
        videoOn: false,
        isSelf: p.account_id === selfAccountId,
        callState,
      };
    });
  } catch {
    return [];
  }
}

// ─── Page ──────────────────────────────────────────────────────────

interface PageProps {
  readonly searchParams?: Promise<{
    readonly session?: string;
    readonly live?: string;
    readonly invited?: string;
    readonly invite_error?: string;
  }>;
}

export default async function CallPreviewPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  // R4 production access-control gate · preserved from 2026-10-19.
  const isDev = process.env.NODE_ENV !== "production";
  const prodOverride = process.env.NEX_DEV_ROUTES === "1";
  if (!isDev && !prodOverride) notFound();

  const sp = (await searchParams) ?? {};
  const sessionId = sp.session && UUID_SHAPE.test(sp.session) ? sp.session : null;

  // Session-aware read · only if a valid session id is in the URL.
  const session = sessionId ? await fetchSession(sessionId) : null;
  const selfSession = await resolveSessionWithDevOverride().catch(() => null);
  const selfAccountId = selfSession?.account?.id ?? null;
  const participants = session
    ? await fetchParticipants(session.id, selfAccountId)
    : [];

  const self: Participant | null = selfSession
    ? {
        id: selfSession.account.id,
        name: selfSession.account.display_name ?? "You",
        imageUrl: null,
        micOn: true,
        videoOn: false,
        isSelf: true,
        callState: "live",
      }
    : null;

  // Owner directive 2026-11-08 (round 20) · side drawer button on
  // the right of the Call Center header. Same ControlDrawer the
  // free-chat + chat-themes surfaces mount · passes the viewer's
  // ControlDrawerSession when signed in · null when anon (drawer
  // then surfaces the sealed sign-in prompt).
  const drawerSession: ControlDrawerSession | null = selfSession
    ? {
        displayName: selfSession.account.display_name ?? "You",
        nexHandle: selfSession.account.nex_handle ?? null,
        isBisnis:
          selfSession.account.tier === "bisnis" &&
          selfSession.account.tier !== null,
        activeChatThemeImageUrl: null,
      }
    : null;

  // Participant pool for the grid · real self + other participants,
  // de-duplicated (self might also be a row in the session).
  const others = participants.filter((p) => p.id !== selfAccountId);
  const grid: readonly Participant[] = self ? [self, ...others] : others;

  // Owner directive 2026-11-08 (round 22) · fetch real contact
  // picker data (friends vs business split) for the modal. Reader
  // bounds to 50 most-recent peer conversations · empty when the
  // viewer has none. Only call when a session resolved · anonymous
  // viewers see the sign-in prompt via the modal.
  const pickerContacts = selfSession
    ? await fetchPickerContacts(selfSession.account.id).catch(() => [])
    : [];

  return (
    <main
      data-nex-call-preview-root
      data-nex-call-session={session?.id ?? ""}
      data-nex-call-state={session?.state ?? "empty"}
      style={{
        position: "relative",
        height: "100dvh",
        maxHeight: "100dvh",
        background: NEX.bg,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Emerald + gold dual-tone backdrop. */}
      <div aria-hidden style={backdropStyle} />

      <div style={shellStyle} data-nex-call-preview-shell>
        {/* Dev-preview ribbon retired 2026-11-08 round 18 ·
            owner-exact: "remove the dev preview we are on account
            99901 id." The R4 production access gate above still
            applies (page is dev-only in production unless
            NEX_DEV_ROUTES=1). */}

        {/* Call Center title · icon + text on the left · side
            drawer trigger on the right (owner directive 2026-11-08
            round 20). Header still has NO container · just a flex
            row. */}
        <CallCenterHeader drawerSession={drawerSession} />

        {/* Video grid · gold-framed tiles · real data when a
            session is attached · empty state otherwise. */}
        <section style={gridScrollZoneStyle} aria-label="Participants">
          {grid.length === 0 ? (
            <EmptyState hasSession={!!session} signedIn={!!selfSession} />
          ) : (
            <GoldGrid participants={grid} />
          )}
        </section>

        {/* Row with Add people + Add contacts · both gold · NO
            container (owner directive · "with no back ground
            container"). The contact-picker modal receives real
            peer-chat contacts split by Friends vs Business. */}
        <AddPeopleContactsRow
          count={grid.length}
          sessionId={session?.id ?? null}
          contacts={pickerContacts}
        />

        {/* Themed footer · emerald + gold with dark-red end-call. */}
        <CallControlBarShell />

        {/* Honest footer · null quality → chrome renders "Measuring…" */}
        <ConnectionFooter quality={null} />
      </div>
    </main>
  );
}

// ─── Components ────────────────────────────────────────────────────

function CallCenterHeader({
  drawerSession,
}: {
  readonly drawerSession: ControlDrawerSession | null;
}): React.JSX.Element {
  return (
    <header
      data-nex-call-center-header
      role="banner"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "18px 18px 10px",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <span
          aria-hidden
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background:
              `linear-gradient(135deg, ${NEX.emerald} 0%, ${NEX.gold} 100%)`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <HeadsetGlyph />
        </span>
        <span
          style={{
            fontSize: 16,
            fontWeight: 900,
            color: NEX.goldBright,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Call Center
        </span>
      </div>

      {/* Right side · sealed ControlDrawer with Call Center-tuned
          trigger · emerald+gold ring over the dark backdrop so the
          button reads cleanly against the video area underneath. */}
      <ControlDrawer
        session={drawerSession}
        triggerIcon="plus"
        currentSurface="chat"
        triggerStyle={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "rgba(5,26,16,0.75)",
          border: `1px solid ${NEX.goldBorder}`,
          color: NEX.goldBright,
          boxShadow:
            "0 4px 14px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(22,214,107,0.25)",
        }}
      />
    </header>
  );
}

function GoldGrid({
  participants,
}: {
  readonly participants: readonly Participant[];
}): React.JSX.Element {
  // Keep the sealed asymmetric shape as long as we have ≥5 people.
  // For <5 people render a responsive grid that scales down cleanly.
  if (participants.length >= 5) {
    const [a, b, c, d, e] = participants;
    return (
      <>
        <div style={gridRowStyle}>
          <GoldFrame participant={a!} size="primary" />
        </div>
        <div style={gridPairRowStyle}>
          <GoldFrame participant={b!} size="medium" />
          <GoldFrame participant={c!} size="medium" />
        </div>
        <div style={gridPairRowStyle}>
          <GoldFrame participant={d!} size="medium" />
          <GoldFrame participant={e!} size="small" />
        </div>
      </>
    );
  }

  // 1-4 participants · responsive grid.
  const cols = participants.length <= 1 ? 1 : 2;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 10,
      }}
    >
      {participants.map((p, i) => (
        <GoldFrame
          key={p.id}
          participant={p}
          size={i === 0 && participants.length <= 2 ? "primary" : "medium"}
        />
      ))}
    </div>
  );
}

// Owner directive 2026-11-08 (round 16) · each tile overlays:
//   · "pending" → ring-pulse waiting animation centered on the tile
//     + caption "Ringing · waiting for accept". Switches to live
//     automatically when the GroupCallEngine presence flips the row
//     (or on page revalidation).
//   · "mic off" → mic icon top-right with a red strike-through
//     line · visible for any participant whose micOn===false.
function GoldFrame({
  participant,
  size,
}: {
  readonly participant: Participant;
  readonly size: "primary" | "medium" | "small";
}): React.JSX.Element {
  const pending = participant.callState === "pending";
  return (
    <div
      data-nex-call-video-frame
      data-nex-call-participant-id={participant.id}
      data-nex-call-state={participant.callState}
      data-nex-call-mic={participant.micOn ? "on" : "off"}
      style={{
        position: "relative",
        borderRadius: 16,
        // Owner directive 2026-11-08 (round 19) · solid gold frame
        // matching the "1 person" text colour (#F0C85A). Previous
        // gold-gradient wrapper produced a lighter edge that read
        // as a white line against the dark tile.
        border: `2px solid ${NEX.goldBright}`,
        overflow: "hidden",
        background: "#031109",
      }}
    >
      <VideoTile participant={participant} size={size} />

      {pending && <WaitingOverlay name={participant.name} />}
      {!participant.micOn && !pending && <MicOffBadge />}
    </div>
  );
}

function WaitingOverlay({ name }: { readonly name: string }): React.JSX.Element {
  return (
    <>
      <style>{`
        @keyframes nex-call-pulse {
          0%   { transform: scale(0.85); opacity: 0.85; }
          70%  { transform: scale(1.35); opacity: 0.0;  }
          100% { transform: scale(1.35); opacity: 0.0;  }
        }
        @keyframes nex-call-dots {
          0%   { opacity: 0.2; }
          50%  { opacity: 1;   }
          100% { opacity: 0.2; }
        }
      `}</style>
      <div
        role="status"
        aria-label={`Ringing ${name} · waiting for accept`}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          background:
            "radial-gradient(circle at center, rgba(5,26,16,0.45) 0%, rgba(3,17,9,0.85) 70%)",
          pointerEvents: "none",
        }}
      >
        {/* 3 concentric rings pulse outward · emerald → gold. */}
        <div style={{ position: "relative", width: 64, height: 64 }}>
          {[0, 0.6, 1.2].map((delay, i) => (
            <span
              key={i}
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: `2px solid ${i === 0 ? NEX.gold : i === 1 ? NEX.goldBright : NEX.emerald}`,
                animation: `nex-call-pulse 1.8s ease-out ${delay}s infinite`,
                opacity: 0,
              }}
            />
          ))}
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: 18,
              borderRadius: "50%",
              background:
                `linear-gradient(135deg, ${NEX.emerald} 0%, ${NEX.gold} 100%)`,
              boxShadow: "0 0 24px rgba(22,214,107,0.55)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PhoneGlyph />
          </span>
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: NEX.goldBright,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Ringing
          </div>
          <div style={{ fontSize: 11, color: NEX.textDim, marginTop: 2 }}>
            Waiting for {name} to accept
            <span style={{ display: "inline-block", marginLeft: 4 }}>
              <span style={{ animation: "nex-call-dots 1.2s ease-in-out infinite" }}>.</span>
              <span style={{ animation: "nex-call-dots 1.2s ease-in-out 0.2s infinite" }}>.</span>
              <span style={{ animation: "nex-call-dots 1.2s ease-in-out 0.4s infinite" }}>.</span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function MicOffBadge(): React.JSX.Element {
  // Owner directive 2026-11-08 (round 17) · if a participant has
  // their sound off we show a mic icon on their video with a red
  // strike-through line. The sealed VideoTile paints its own mic
  // indicator too · this overlay sits ABOVE it so the red-strike
  // is unmistakable at a glance.
  return (
    <div
      aria-label="Microphone off"
      data-nex-call-mic-off
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        width: 28,
        height: 28,
        borderRadius: 8,
        background: "rgba(2,9,20,0.85)",
        border: `1px solid ${NEX.goldBorder}`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#F2F5F8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11 v1 a7 7 0 0 0 14 0 v-1" />
        <path d="M12 19 v3" />
        {/* Red strike-through diagonal. */}
        <line x1="4" y1="4" x2="20" y2="20" stroke="#E53945" strokeWidth="2.6" />
      </svg>
    </div>
  );
}

function PhoneGlyph(): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#031109"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 4 h3 l2 5 l-3 2 a11 11 0 0 0 6 6 l2 -3 l5 2 v3 a2 2 0 0 1 -2 2 A17 17 0 0 1 3 6 a2 2 0 0 1 2 -2z" />
    </svg>
  );
}

function EmptyState({
  hasSession,
  signedIn,
}: {
  readonly hasSession: boolean;
  readonly signedIn: boolean;
}): React.JSX.Element {
  const title = !signedIn
    ? "Sign in to start a call"
    : hasSession
      ? "Waiting for participants to join…"
      : "No active call";
  const body = !signedIn
    ? "Call Center requires a signed-in NEX account. Head back to Chat and sign in."
    : hasSession
      ? "Your session is live. Invite contacts or share the call link to bring people in."
      : "Attach a session id to the URL (?session=<uuid>) to view a live call, or invite contacts from Chat to start one.";
  return (
    <div
      role="status"
      style={{
        margin: "20px 12px",
        padding: "28px 20px",
        borderRadius: 16,
        border: `1px dashed ${NEX.goldBorder}`,
        background: "rgba(5,26,16,0.55)",
        textAlign: "center",
        lineHeight: 1.6,
      }}
    >
      <div style={{ fontSize: 42, lineHeight: 1 }} aria-hidden>🌿</div>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 900,
          color: NEX.goldBright,
          margin: "10px 0 6px",
          letterSpacing: "0.04em",
        }}
      >
        {title}
      </h2>
      <p style={{ fontSize: 13, color: NEX.textDim, margin: 0, maxWidth: 420, marginInline: "auto" }}>
        {body}
      </p>
    </div>
  );
}

// ─── Glyphs ────────────────────────────────────────────────────────

function HeadsetGlyph(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#04140A"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 14 v-2 a8 8 0 0 1 16 0 v2" />
      <path d="M4 14 h3 v6 H5 a1 1 0 0 1 -1 -1 z" />
      <path d="M20 14 h-3 v6 h2 a1 1 0 0 0 1 -1 z" />
      <path d="M16 20 a4 3 0 0 1 -4 2" />
    </svg>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const backdropStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100svh",
  backgroundImage:
    `radial-gradient(900px 600px at 15% 10%, rgba(22,214,107,0.22), rgba(22,214,107,0) 60%), ` +
    `radial-gradient(900px 600px at 85% 90%, rgba(217,168,58,0.18), rgba(217,168,58,0) 60%), ` +
    `linear-gradient(180deg, #051A10 0%, #06231A 55%, #04140A 100%)`,
  pointerEvents: "none",
  zIndex: 0,
};

const shellStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minHeight: 0,
};

const gridScrollZoneStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  padding: "10px 12px 8px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};
const gridRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 10,
};
const gridPairRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

