// src/app/nex-native/call/preview/page.tsx
//
// NEX Calls & Video · master-layout PREVIEW surface.
// Owner-authorised 2026-10-19 (Phase 1 UI shell).
// -----------------------------------------------------------------------------
// Dedicated preview page the owner walks to approve the sealed
// visual concept. Composes the four calls-chrome primitives
// (CallsVideoHeader + VideoTile + CallControlBar + ConnectionFooter)
// with MOCK participants · zero WebRTC wiring.
//
// Per the audit shipped 2026-10-19:
//   WIRED controls here (Mute · Camera · End Call) are visibly
//   interactive · their state is local to this preview and resets
//   on reload. The NOT-WIRED controls (Audio · Chat · Participants ·
//   More · Add people) render with the same visual language but
//   carry "coming later" tooltips + the disabled attribute · same
//   discipline the sealed Calls hub uses for its Group-call /
//   Call-link tiles.
//
// Honesty invariants upheld:
//   · No fabricated participant data (names clearly tagged "mock")
//   · No fabricated connection quality · footer passes null → the
//     chrome renders "Measuring…" rather than lying about status
//   · The call timer is a static "04:32" matching the concept image
//     · the real timer wires up in Phase 2 when a session exists

import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { CallsVideoHeader } from "@/lib/nex-native/calls-chrome/calls-video-header";
import { VideoTile } from "@/lib/nex-native/calls-chrome/video-tile";
import { ConnectionFooter } from "@/lib/nex-native/calls-chrome/connection-footer";
import { CallControlBarShell } from "./_control-bar-shell";
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
 *  viewer or reader of the DOM can mistake these for real users. The
 *  participant shape IS the real `CallsParticipant` shape · what
 *  changes in the real surface is the data source, not the type. */
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
    micOn: true,
    videoOn: false,
    isSelf: false,
  },
  {
    id: "mock-sofia",
    name: "Sofia",
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

export default function CallPreviewPage() {
  // R4 production access-control gate · owner-authorised 2026-10-19.
  // Matches the sealed /dev/* convention used by:
  //   · /nex-native/dev/standard-experience-preview/page.tsx:34-36
  //   · /nex-native/dev/theme-preview-generated/page.tsx (A3)
  //   · /nex-native/dev/joker-bespoke-preview/page.tsx (A3.1)
  //
  // Production users typing /nex-native/call/preview directly now get
  // a clean 404. The owner reaches it in dev (NODE_ENV !== "production")
  // automatically, or in prod by setting NEX_DEV_ROUTES=1 in .env.local.
  //
  // The DEV-PREVIEW ribbon below remains · belt-and-braces honesty for
  // anyone running with NEX_DEV_ROUTES=1 who still needs to know this
  // is a mock surface, not a live call.
  const isDev = process.env.NODE_ENV !== "production";
  const prodOverride = process.env.NEX_DEV_ROUTES === "1";
  if (!isDev && !prodOverride) notFound();

  const alex = MOCK_PARTICIPANTS[0]!;
  const emma = MOCK_PARTICIPANTS[1]!;
  const daniel = MOCK_PARTICIPANTS[2]!;
  const sofia = MOCK_PARTICIPANTS[3]!;

  return (
    <main
      data-nex-call-preview-root
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
      {/* Owner directive 2026-10-19 · same background image as the
          sealed NEX directory search page (/nex-directory/directory-
          bg.png). Absolute-positioned behind all content with the
          same translucent-navy gradient overlay the directory uses,
          so the master Calls & Video chrome reads legibly on top.
          Image path · gradient stops · size · position are all
          byte-identical to _landing-directory-view.tsx:886-898. */}
      <div
        aria-hidden
        data-nex-call-preview-bg
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
      {/* Preview-mode disclosure ribbon retired 2026-10-19 (owner
          directive · "remove this from header · master Calls &
          Video chrome · mock participants · WebRTC wiring deferred
          to Phase 2 · Back to Calls hub"). */}

      {/* Content shell · position:relative + zIndex:1 so the master
          chrome stacks above the directory-bg layer. Mirrors the
          sealed `shellStyle` pattern used by
          _landing-directory-view.tsx:900-902. */}
      <div style={shellStyle} data-nex-call-preview-shell>
        {/* Phase 1B honesty ribbon · owner-authorised 2026-10-19.
            Reason · the preview is not dev-gated (follows /call/*
            convention, not /dev/*). The CallsVideoHeader below
            uses status="connected" + elapsed="04:32" so a direct-URL
            visitor could mistake this for a real call. This ribbon
            makes the preview intent unambiguous to a human viewer
            while leaving the composition visible for design review. */}
        <div
          data-nex-call-preview-dev-ribbon
          role="status"
          aria-label="Dev preview · not a live call"
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
          Dev preview · mock data · not a live call
        </div>
        {/* 1 · Header */}
        <CallsVideoHeader status="connected" elapsed="04:32" />

        {/* 2 · Video grid · asymmetric layout per the sealed concept */}
        <section style={gridScrollZoneStyle} aria-label="Participants">
          <div style={gridRowStyle}>
            <VideoTile participant={alex} size="primary" />
          </div>
          <div style={gridPairRowStyle}>
            <VideoTile participant={emma} size="medium" />
            <VideoTile participant={daniel} size="medium" />
          </div>
          <div style={gridPairRowStyle}>
            <VideoTile participant={sofia} size="medium" />
            <VideoTile participant={MOCK_SELF} size="small" />
          </div>
        </section>

        {/* 3 · Participant counter + Add People · Add People is NOT
              wired today (per the sealed audit) · rendered per spec
              but disabled with "coming later" tooltip. */}
        <ParticipantRow count={MOCK_PARTICIPANTS.length} />

        {/* 4 · Control bar · wired/placeholder discipline inside */}
        <CallControlBarShell />

        {/* 5 · Connection footer · passes null quality so the chrome
              honestly renders "Measuring…" (no WebRTC stats pipeline
              wired in this preview). */}
        <ConnectionFooter quality={null} />
      </div>
    </main>
  );
}

// PreviewRibbon component retired 2026-10-19 along with its text
// and the "Back to Calls hub" link · see comment at the main
// render for the owner directive.

function ParticipantRow({ count }: { count: number }) {
  return (
    <div style={participantRowStyle} data-nex-call-preview-add-row>
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
// `ribbonStyle` retired 2026-10-19 along with PreviewRibbon · see
// the comment at the main render for the owner directive.

// Owner directive 2026-10-19 · content shell · stacks above the
// directory-bg layer. Byte-identical pattern to the sealed
// `shellStyle` in _landing-directory-view.tsx:900-902 so the
// Calls preview reads with the same visual-layer discipline the
// Directory uses.
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
  gap: 5,
  color: NEX.cyan,
  fontSize: 12,
  fontWeight: 700,
};
const addPeopleStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 14px",
  minHeight: 32,
  borderRadius: 999,
  background: "transparent",
  color: NEX.cyan,
  border: `1px solid rgba(0, 175, 255, 0.42)`,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.3,
  cursor: "not-allowed",
  opacity: 0.55,
  fontFamily: "inherit",
  WebkitTapHighlightColor: "transparent",
};
