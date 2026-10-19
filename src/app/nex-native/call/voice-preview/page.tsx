// src/app/nex-native/call/voice-preview/page.tsx
//
// NEX Calls & Video · master-layout VOICE PREVIEW surface.
// Owner-authorised 2026-10-20 (Phase 1 UI shell · voice variant).
// -----------------------------------------------------------------------------
// Voice sibling of /call/preview/page.tsx. Composes the sealed
// calls-chrome primitives (CallsVideoHeader + VideoTile +
// CallControlBar + ConnectionFooter) with MOCK participants and
// honest `videoOn: false` across every tile · zero WebRTC wiring.
//
// Mirrors the sealed video preview's discipline per the 2026-10-19
// audit · composition sealed 2026-10-19:
//
//   WIRED controls here (Mute · End Call) are visibly interactive ·
//   their state is local to this preview and resets on reload.
//
//   Camera button is HIDDEN on this surface (showCamera={false}) ·
//   a voice call has no video track to toggle. The master chrome
//   stays unchanged · the voice shell just composes it with one
//   fewer control.
//
//   NOT-WIRED controls (Audio · More) render with the same visual
//   language but carry "coming later" tooltips + the disabled
//   attribute · same discipline the sealed Calls hub + video
//   preview use.
//
// Honesty invariants upheld (same as /call/preview):
//   · No fabricated participant data · names tagged "mock"
//   · No fabricated connection quality · footer passes null → the
//     chrome renders "Measuring…" rather than lying about status
//   · The call timer is a static "01:48" matching Phase 1 ·
//     the real timer wires up in Phase 2 when a session exists
//   · Every tile uses `videoOn: false` so the honest monogram
//     renders · voice calls do not carry a video track

import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { CallsVideoHeader } from "@/lib/nex-native/calls-chrome/calls-video-header";
import { VideoTile } from "@/lib/nex-native/calls-chrome/video-tile";
import { ConnectionFooter } from "@/lib/nex-native/calls-chrome/connection-footer";
import { VoiceCallControlBarShell } from "./_control-bar-shell";
import type { CallsParticipant } from "@/lib/nex-native/calls-chrome/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  cyan: "#00AFFF",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
};

/** Owner-authorised preview roster · explicitly tagged "mock" so no
 *  viewer or reader of the DOM can mistake these for real users.
 *  `videoOn: false` on every entry · this is a voice call, no video
 *  track exists on any participant. */
const MOCK_PARTICIPANTS: readonly CallsParticipant[] = [
  {
    id: "mock-alex",
    name: "Alex Morgan",
    imageUrl: null,
    micOn: true,
    videoOn: false,
    isSelf: false,
  },
  {
    id: "mock-emma",
    name: "Emma",
    imageUrl: null,
    micOn: true,
    videoOn: false,
    isSelf: false,
  },
  {
    id: "mock-daniel",
    name: "Daniel",
    imageUrl: null,
    micOn: false,
    videoOn: false,
    isSelf: false,
  },
];

const MOCK_SELF: CallsParticipant = {
  id: "mock-self",
  name: "You",
  imageUrl: null,
  micOn: true,
  videoOn: false,
  isSelf: true,
};

export default function VoiceCallPreviewPage() {
  // R4 production access-control gate · owner-authorised 2026-10-20.
  // Mirrors the sealed /call/preview gate (page.tsx:107-109) and the
  // /dev/* convention used by:
  //   · /nex-native/dev/standard-experience-preview/page.tsx:34-36
  //   · /nex-native/dev/theme-preview-generated/page.tsx (A3)
  //   · /nex-native/dev/joker-bespoke-preview/page.tsx (A3.1)
  //
  // Production users typing /nex-native/call/voice-preview directly
  // now get a clean 404. The owner reaches it in dev (NODE_ENV !==
  // "production") automatically, or in prod by setting NEX_DEV_ROUTES=1
  // in .env.local.
  const isDev = process.env.NODE_ENV !== "production";
  const prodOverride = process.env.NEX_DEV_ROUTES === "1";
  if (!isDev && !prodOverride) notFound();

  const alex = MOCK_PARTICIPANTS[0]!;
  const emma = MOCK_PARTICIPANTS[1]!;
  const daniel = MOCK_PARTICIPANTS[2]!;

  return (
    <main
      data-nex-call-voice-preview-root
      style={{
        position: "relative",
        height: "100dvh",
        maxHeight: "100dvh",
        background: NEX.bg,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        color: "#F2F5F8",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Background image · same directory-bg pattern as the sealed
          /call/preview surface (page.tsx:138-156) so the master chrome
          reads with identical visual-layer discipline. Absolute-
          positioned behind all content with the same translucent-navy
          gradient overlay. */}
      <div
        aria-hidden
        data-nex-call-voice-preview-bg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100svh",
          backgroundImage:
            `linear-gradient(180deg, rgba(2,9,20,0.35) 0%, rgba(2,9,20,0.55) 55%, rgba(2,9,20,0.82) 100%), url("/nex-directory/directory-bg.png")`,
          backgroundSize: "100% 100%, 100% 100%",
          backgroundRepeat: "no-repeat, no-repeat",
          backgroundPosition: "center, center",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Content shell · stacks above the directory-bg layer. */}
      <div style={shellStyle} data-nex-call-voice-preview-shell>
        {/* Phase 1 honesty ribbon · owner-authorised 2026-10-20.
            Same discipline as /call/preview (page.tsx:167-199) · the
            CallsVideoHeader uses status="connected" + elapsed="01:48"
            so a direct-URL visitor could mistake this for a real
            call. This ribbon makes the preview intent unambiguous. */}
        <div
          data-nex-call-voice-preview-dev-ribbon
          role="status"
          aria-label="Dev preview · not a live voice call"
          style={{
            position: "absolute",
            top: 10,
            left: 12,
            right: 12,
            zIndex: 10,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(255, 180, 0, 0.14)",
            border: "1px solid rgba(255, 180, 0, 0.55)",
            color: "#FFC95C",
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            textAlign: "center",
            lineHeight: 1.2,
            pointerEvents: "none",
          }}
        >
          Dev preview · voice · mock data · not a live call
        </div>

        {/* 1 · Header · identical primitive to the video preview */}
        <CallsVideoHeader status="connected" elapsed="01:48" />

        {/* 2 · Participant layout · voice variant.
              One primary tile (featured speaker) · the rest below as
              medium tiles · self-view bottom-right as "small".
              Every tile renders the honest monogram because
              videoOn: false on every participant · voice calls do
              not have a video track. */}
        <section style={gridScrollZoneStyle} aria-label="Participants">
          <div style={gridRowStyle}>
            <VideoTile participant={alex} size="primary" />
          </div>
          <div style={gridPairRowStyle}>
            <VideoTile participant={emma} size="medium" />
            <VideoTile participant={daniel} size="medium" />
          </div>
          <div style={gridPairRowStyle}>
            <VideoTile participant={MOCK_SELF} size="small" />
            <div aria-hidden style={{ visibility: "hidden" }} />
          </div>
        </section>

        {/* 3 · Participant counter + Add People · same honest
              "coming later" discipline as /call/preview */}
        <ParticipantRow count={MOCK_PARTICIPANTS.length} />

        {/* 4 · Control bar · voice variant hides the Camera button */}
        <VoiceCallControlBarShell />

        {/* 5 · Connection footer · passes null so the chrome honestly
              renders "Measuring…" · no WebRTC stats pipeline wired
              in this preview. */}
        <ConnectionFooter quality={null} />
      </div>
    </main>
  );
}

function ParticipantRow({ count }: { count: number }) {
  return (
    <div style={participantRowStyle} data-nex-call-voice-preview-add-row>
      <span style={participantCountStyle}>
        <PeopleGlyph />
        {count} people
      </span>
      <button
        type="button"
        disabled
        aria-label="Add people · coming later"
        title="Add people · coming later"
        data-nex-call-add-people
        data-nex-call-add-people-wired="false"
        style={addPeopleStyle}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
        <span>Add people</span>
      </button>
    </div>
  );
}

function PeopleGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="9" r="3" />
      <path d="M2 20 c0 -3.5 3 -6 7 -6 s7 2.5 7 6" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M15 14 c3 0 7 2 7 5" />
    </svg>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────
// Byte-identical patterns to /call/preview/page.tsx:292-348 so the
// voice preview reads with the same layer / tile / badge discipline
// the sealed video preview uses.

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
const participantRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "8px 14px",
  background: "rgba(2, 9, 20, 0.95)",
  borderTop: "1px solid rgba(0, 175, 255, 0.12)",
  flexShrink: 0,
};
const participantCountStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  fontWeight: 700,
  color: NEX.textDim,
};
const addPeopleStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  borderRadius: 999,
  background: "rgba(0, 175, 255, 0.08)",
  border: `1px solid ${NEX.cyan}`,
  color: NEX.cyan,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  cursor: "not-allowed",
  opacity: 0.55,
  fontFamily: "inherit",
};
