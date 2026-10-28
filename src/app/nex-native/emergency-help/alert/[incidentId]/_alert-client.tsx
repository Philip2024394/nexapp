"use client";

// src/app/nex-native/emergency-help/alert/[incidentId]/_alert-client.tsx
//
// NEX Emergency Help · recipient-side Alert Screen.
// Owner directive 2026-10-25 (verbatim copy):
//   NEX EMERGENCY
//   HELP NEEDED
//   A NEX member has activated Emergency Help.
//   Member's Name · NEX ID: NEX-00000
//   Last recorded location
//   Date and time (Recorded at 10:00 PM · Example date)
//   How can you respond?
//   [I will help] [I will contact police] [Unavailable]
//   Illustrative design · Not a live emergency service
//
// Design rules:
//   · Full-height / full-width · occupies the whole viewer.
//   · 3 round buttons · user MUST select one before the screen closes.
//     No background scrim, no back-arrow, no window-close.
//   · Each tap writes a response via the server action, then shows
//     a brief confirmation; a Close button appears only after a
//     response is submitted.
//   · Honest "Illustrative design · Not a live emergency service"
//     footer stays until real delivery lands.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  acceptServerAction,
  declineServerAction,
  withdrawServerAction,
} from "@/app/nex-native/emergency-help/_actions";

// Placeholder incident data used in dev + until a real loader is wired.
// Owner-authored copy structure · the real page will replace these with
// the loaded incident snapshot. Illustrative values · covered by the
// "Illustrative design · Not a live emergency service" backstop at the
// foot of the page. Owner directive 2026-10-25 · the alert must give a
// responder what they need to identify + reach the person: Google Maps
// link, device IP (last-known), coordinates, age, sex, date / time.
const PLACEHOLDER = {
  memberName: "Member's Name",
  nexId: "NEX-00000",
  age: 34,
  sex: "Female",
  locationLabel: "Last recorded location",
  locationAddress: "Jl. Malioboro, Yogyakarta · Indonesia",
  locationCoords: "-7.792900, 110.365600",
  mapsUrl: "https://www.google.com/maps?q=-7.792900,110.365600",
  ipAddress: "203.0.113.42",
  timeLabel: "Date 00-00-0000 - 00-00pm",
};

// Owner directive 2026-10-25 · multi-select commitments.
//   · "I will help" and "Contacted police" are INDEPENDENT toggles ·
//     a responder can commit to both at once.
//   · "Pass" is a one-shot exit that fires decline + navigates away ·
//     the responder is removed from the emergency group (declined
//     recipients are filtered out of the derived group membership).
//
// Backend v1 pilot limitation (honest footnote): the DB response_status
// is a single enum (pending | accepted | declined | withdrawn). Both
// "I will help" and "Contacted police" collapse into the single
// `accepted` state. The help ↔ police distinction is UI-local only
// until migration 225 adds `nex.incident_recipient.accepted_as`. Flip
// either toggle on → one accept fires · flip the last one off →
// withdraw fires. The pilot UI reflects both commitments visually.

export interface AlertRecipientClientProps {
  readonly incidentId: string;
}

const NEX = {
  bg: "#060108",
  surface: "rgba(10, 2, 8, 0.78)",
  text: "#F2F5F8",
  textDim: "#C8D4E8",
  red: "#FF3355",
  redDeep: "#8B1A1A",
  cyan: "#00AFFF",
  gold: "#FFC24B",
  green: "#2BD47F",
  border: "rgba(255, 51, 85, 0.42)",
} as const;

export function AlertRecipientClient(
  props: AlertRecipientClientProps,
): React.JSX.Element {
  const router = useRouter();
  const [helpOn, setHelpOn] = React.useState(false);
  const [policeOn, setPoliceOn] = React.useState(false);
  const [busyKey, setBusyKey] = React.useState<
    "help" | "police" | "pass" | null
  >(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Collapse both UI toggles into the single server-side state. If
  // either is on, the responder is "accepted". If both are off, we
  // withdraw. See the honest footnote comment above the component for
  // the migration 225 plan that would preserve the distinction.
  //
  // The server actions return plain `{ incidentId, status, …}` payloads
  // and throw on failure (the current mock never throws). The try /
  // catch below is the complete error contract · when the real backend
  // lands, a 'invalid_state_transition' reject on withdraw-from-pending
  // can be filtered by inspecting err.message.
  const syncServerState = React.useCallback(
    async (nextHelp: boolean, nextPolice: boolean) => {
      const shouldBeAccepted = nextHelp || nextPolice;
      try {
        if (shouldBeAccepted) {
          await acceptServerAction(props.incidentId, 10);
        } else {
          await withdrawServerAction(props.incidentId);
        }
      } catch (err) {
        throw err instanceof Error
          ? err
          : new Error("Could not update response.");
      }
    },
    [props.incidentId],
  );

  // Owner directive 2026-10-25 · tapping "I will help" OR "Contact
  // police" opens the emergency group. The server-state sync fires
  // in the background so a slow API never blocks navigation; the
  // group page posts the responder's card + a system message that
  // reflects which action was taken (via the ?action query param).
  //
  // Toggle-off (untapping an already-active commitment) stays on the
  // alert screen and performs the server sync inline · we only
  // navigate when switching ON.
  const toggleHelp = React.useCallback(() => {
    if (busyKey !== null && busyKey !== "help") return;
    const next = !helpOn;
    setHelpOn(next);
    setSubmitError(null);
    if (next) {
      router.push(
        `/nex-native/emergency-help/group/${props.incidentId}?action=help`,
      );
      void syncServerState(true, policeOn).catch((err) => {
        setSubmitError(err instanceof Error ? err.message : "Error");
      });
      return;
    }
    setBusyKey("help");
    syncServerState(false, policeOn)
      .catch((err) =>
        setSubmitError(err instanceof Error ? err.message : "Error"),
      )
      .finally(() => setBusyKey(null));
  }, [helpOn, policeOn, busyKey, syncServerState, router, props.incidentId]);

  const togglePolice = React.useCallback(() => {
    if (busyKey !== null && busyKey !== "police") return;
    const next = !policeOn;
    setPoliceOn(next);
    setSubmitError(null);
    if (next) {
      router.push(
        `/nex-native/emergency-help/group/${props.incidentId}?action=police`,
      );
      void syncServerState(helpOn, true).catch((err) => {
        setSubmitError(err instanceof Error ? err.message : "Error");
      });
      return;
    }
    setBusyKey("police");
    syncServerState(helpOn, false)
      .catch((err) =>
        setSubmitError(err instanceof Error ? err.message : "Error"),
      )
      .finally(() => setBusyKey(null));
  }, [helpOn, policeOn, busyKey, syncServerState, router, props.incidentId]);

  const handlePass = React.useCallback(async () => {
    if (busyKey !== null) return;
    setBusyKey("pass");
    setSubmitError(null);
    try {
      // Pass = decline. Declined recipients are automatically removed
      // from the derived emergency group (membership = accepted only).
      // Server action throws on failure; the mock never throws.
      await declineServerAction(props.incidentId);
      router.push("/nex-native/contacts");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error");
      setBusyKey(null);
    }
  }, [busyKey, props.incidentId, router]);

  return (
    <div
      data-nex-emergency-alert-recipient
      data-testid="nex-emergency-alert-recipient"
      style={{
        // Owner directive 2026-10-25 · mobile-first fit. Absolute (not
        // fixed) so the modal-style overlay stays INSIDE the
        // .nex-native-frame (420×909 phone silhouette on desktop)
        // instead of escaping to the full browser viewport.
        position: "absolute",
        inset: 0,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        // Owner directive 2026-10-25 · Crimson Beacon rescue image as
        // the alert screen background. Dark gradient overlay sits on
        // top so headline / member identity / 3 buttons stay legible
        // over the vivid red photo.
        backgroundColor: NEX.bg,
        backgroundImage:
          "linear-gradient(180deg, rgba(6, 2, 8, 0.78) 0%, rgba(6, 2, 8, 0.5) 32%, rgba(6, 2, 8, 0.58) 60%, rgba(6, 2, 8, 0.88) 100%), url(/nex-emergency/countdown-background.png)",
        backgroundSize: "100% 100%, cover",
        backgroundPosition: "center, center",
        backgroundRepeat: "no-repeat, no-repeat",
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding:
          "max(20px, env(safe-area-inset-top, 0px)) 20px calc(env(safe-area-inset-bottom, 0px) + 20px)",
        boxSizing: "border-box",
        overflowY: "auto",
      }}
    >
      <style>{`
        @keyframes nexAlertRecipientPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 51, 85, 0.55); }
          50%      { box-shadow: 0 0 0 14px rgba(255, 51, 85, 0); }
        }
        @keyframes nexAlertRecipientRingSpin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-emergency-alert-recipient] * { animation: none !important; }
        }
      `}</style>

      {/* Hero band */}
      <div style={{ textAlign: "center", marginTop: 4 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: NEX.red,
            marginBottom: 4,
          }}
        >
          NEX Emergency
        </div>
        <h1
          data-testid="nex-alert-headline"
          style={{
            margin: 0,
            fontSize: 32,
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            color: NEX.text,
            textShadow: "0 2px 10px rgba(255, 51, 85, 0.55)",
          }}
        >
          HELP NEEDED
        </h1>
        <div
          style={{
            fontSize: 13,
            marginTop: 6,
            color: NEX.textDim,
          }}
        >
          A NEX member has activated Emergency Help.
        </div>
      </div>

      {/* Unified top container · owner directive 2026-10-25 ·
          avatar + name + age/sex + NEX ID AND location + maps link +
          IP + date/time live in a single card so a responder sees
          everything about the person in one place. */}
      <div
        data-nex-alert-top-container
        style={{
          marginTop: 18,
          padding: "16px 16px 18px",
          borderRadius: 16,
          background: NEX.surface,
          border: `1px solid ${NEX.border}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: 10,
        }}
      >
        {/* Avatar + headline identity · centered. Flat SVG person icon
            replaces the earlier 👤 emoji so the identity card reads as
            standard-grade (owner directive 2026-10-25 · "standard icons
            for trust"). The emergency profile face photo will slot into
            this placeholder once the face-enrol flow lands. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, rgba(255, 51, 85, 0.35), rgba(139, 26, 26, 0.65))",
              border: `2px solid ${NEX.red}`,
              display: "grid",
              placeItems: "center",
              color: "#FFFFFF",
              animation: "nexAlertRecipientPulse 1800ms ease-in-out infinite",
            }}
          >
            <PersonIcon size={42} />
          </div>
          <div
            data-testid="nex-alert-member-name"
            style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.01em" }}
          >
            {PLACEHOLDER.memberName}
          </div>
          <div
            data-testid="nex-alert-member-demographics"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: NEX.textDim,
              letterSpacing: "0.04em",
            }}
          >
            Age {PLACEHOLDER.age} · {PLACEHOLDER.sex}
          </div>
          <div
            data-testid="nex-alert-member-nex-id"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: NEX.gold,
              letterSpacing: "0.08em",
              fontFamily:
                "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
            }}
          >
            NEX ID: {PLACEHOLDER.nexId}
          </div>
        </div>

        {/* Soft divider between identity + evidence */}
        <div
          aria-hidden
          style={{
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)",
            margin: "6px 0 2px",
          }}
        />

        <div data-testid="nex-alert-location">
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.cyan,
              marginBottom: 4,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <MapPinIcon size={13} />
            {PLACEHOLDER.locationLabel}
          </div>
          <div
            style={{
              fontSize: 13.5,
              color: NEX.text,
              lineHeight: 1.4,
              marginBottom: 3,
            }}
          >
            {PLACEHOLDER.locationAddress}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: NEX.textDim,
              lineHeight: 1.4,
              marginBottom: 6,
              fontFamily:
                "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
            }}
          >
            {PLACEHOLDER.locationCoords}
          </div>
          <a
            data-testid="nex-alert-maps-link"
            href={PLACEHOLDER.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 700,
              color: NEX.cyan,
              textDecoration: "none",
              padding: "6px 10px",
              borderRadius: 8,
              border: `1px solid ${NEX.cyan}66`,
              background: "rgba(0, 175, 255, 0.08)",
            }}
          >
            Share location on Google Maps
            <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>→</span>
          </a>
        </div>

        <div data-testid="nex-alert-ip">
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.cyan,
              marginBottom: 3,
            }}
          >
            Last-known IP
          </div>
          <div
            style={{
              fontSize: 13,
              color: NEX.textDim,
              lineHeight: 1.4,
              fontFamily:
                "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
            }}
          >
            {PLACEHOLDER.ipAddress}
          </div>
        </div>

        <div data-testid="nex-alert-time">
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.cyan,
              marginBottom: 3,
            }}
          >
            Date and time
          </div>
          <div style={{ fontSize: 13.5, color: NEX.textDim, lineHeight: 1.4 }}>
            {PLACEHOLDER.timeLabel}
          </div>
        </div>
      </div>

      {/* Response buttons · 3 round · icon above, label underneath.
          Help + Contacted police are independent toggles. Pass is a
          one-shot that fires decline + navigates away. */}
      <div style={{ marginTop: 20 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: NEX.textDim,
            textAlign: "center",
            marginBottom: 14,
          }}
        >
          How can you respond?
        </div>

        <div
          data-nex-alert-recipient-buttons
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            alignItems: "start",
          }}
        >
          <IconLabelButton
            testId="nex-alert-respond-help"
            icon={<LifebuoyIcon />}
            label="I will help"
            color={NEX.green}
            selected={helpOn}
            busy={busyKey === "help"}
            disabled={busyKey !== null && busyKey !== "help"}
            onClick={() => void toggleHelp()}
          />
          <IconLabelButton
            testId="nex-alert-respond-police"
            icon={<ShieldCheckIcon />}
            label="Contact police"
            color={NEX.red}
            selected={policeOn}
            busy={busyKey === "police"}
            disabled={busyKey !== null && busyKey !== "police"}
            onClick={() => void togglePolice()}
          />
          <IconLabelButton
            testId="nex-alert-respond-pass"
            icon={<CloseXIcon />}
            label="Pass"
            color={NEX.textDim}
            selected={false}
            busy={busyKey === "pass"}
            disabled={busyKey !== null && busyKey !== "pass"}
            onClick={() => void handlePass()}
          />
        </div>

        {submitError !== null && (
          <div
            data-testid="nex-alert-respond-error"
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(255, 51, 85, 0.12)",
              border: "1px solid rgba(255, 51, 85, 0.4)",
              fontSize: 12,
              color: "#FF6B81",
              textAlign: "center",
            }}
          >
            Could not record response: {submitError}
          </div>
        )}
      </div>

      {/* Honest-concept footer · never cycles out */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: 20,
          fontSize: 10.5,
          lineHeight: 1.4,
          color: NEX.textDim,
          textAlign: "center",
          opacity: 0.85,
        }}
      >
        Illustrative design · Not a live emergency service
      </div>
    </div>
  );
}

// Owner directive 2026-10-25 · round icon circle with the LABEL
// rendered UNDERNEATH the circle (not inside it). `selected` draws
// a solid filled ring + glow so a tapped-on toggle reads clearly;
// unselected is a hollow outlined ring. Busy swaps the icon for a
// loading dot.

function IconLabelButton({
  icon,
  label,
  color,
  selected,
  busy,
  disabled,
  onClick,
  testId,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly color: string;
  readonly selected: boolean;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly testId: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <button
        type="button"
        data-testid={testId}
        data-nex-alert-button-selected={selected ? "true" : "false"}
        onClick={onClick}
        disabled={disabled}
        aria-pressed={selected}
        style={{
          display: "grid",
          placeItems: "center",
          aspectRatio: "1 / 1",
          width: "100%",
          borderRadius: "50%",
          background: selected
            ? `radial-gradient(circle at 35% 25%, ${color}CC 0%, ${color}66 70%)`
            : `radial-gradient(circle at 35% 25%, ${color}22 0%, rgba(0,0,0,0.6) 70%)`,
          color: "#FFFFFF",
          border: `2px solid ${color}`,
          fontSize: 28,
          lineHeight: 1,
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: selected
            ? `0 0 24px -2px ${color}CC, inset 0 0 0 2px rgba(255,255,255,0.12)`
            : disabled
              ? "none"
              : `0 0 16px -6px ${color}66`,
          opacity: busy ? 0.65 : 1,
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          fontFamily: "inherit",
          transition: "transform 90ms ease, opacity 160ms, background 180ms",
        }}
      >
        {busy ? "…" : <span aria-hidden style={{ display: "inline-flex" }}>{icon}</span>}
      </button>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1.2,
          color: selected ? "#FFFFFF" : NEX.textDim,
          textAlign: "center",
          letterSpacing: "0.02em",
          minHeight: 26,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// Owner directive 2026-10-25 · "change the images from icons 3d to
// standard icons for trust". Flat stroke-based SVGs replace the
// earlier emoji glyphs (🤝 👮 ✕ 👤) which were rendered as 3D images
// on iOS / Android and looked playful. These scale with the parent
// button and inherit color via currentColor so they tint with the
// per-button accent (green / red / dim grey) + the body white when
// used on the avatar.

function LifebuoyIcon({ size = 34 }: { readonly size?: number }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
      <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
      <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
      <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
    </svg>
  );
}

function ShieldCheckIcon({ size = 34 }: { readonly size?: number }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2 L4 5 v6 c0 5 3.5 9.5 8 11 c4.5-1.5 8-6 8-11 V5 l-8-3z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function CloseXIcon({ size = 34 }: { readonly size?: number }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.3}
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="6" y1="18" x2="18" y2="6" />
    </svg>
  );
}

function PersonIcon({ size = 42 }: { readonly size?: number }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MapPinIcon({ size = 14 }: { readonly size?: number }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 1 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
