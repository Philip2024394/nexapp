// src/components/nex-native/emergency/EmergencyConfirmationScreen.tsx
//
// "Do you need help?" · pending-alert + early-location client ·
// re-architected 2026-10-10 (L1).
// --------------------------------------------------------------------
// Load-bearing invariants (sealed by L1 pending-confirmation seal):
//   · Safety-warning acknowledgment gate (phase="acknowledging-policy")
//     is the FIRST interactive step. Enforcement policy summarised in
//     docs/doctrine/nex-emergency-help-abuse-policy-2026-10-10.md.
//     Acknowledgment is remembered via sessionStorage for the current
//     session so repeat use is not slowed down · never persisted beyond
//     the session · the warning text stays reachable via the Settings
//     entry.
//   · Geolocation is requested ONLY on the first tap of "I NEED HELP".
//     Never request on mount, never request from the entry card, never
//     before the policy ack.
//   · Tapping "I NEED HELP" after a category pick now:
//       1. Captures a location snapshot (as today),
//       2. IMMEDIATELY calls createPendingAlert · the alert row is
//          REAL and the fan-out hook fires on the server at T=0,
//       3. Enters phase="counting-down" with a 10-second window,
//       4. Starts watchPosition streaming updates to the server via
//          updateIncidentLocation (debounced to ≥2 s client-side ·
//          server-side 10 s rate limit still protects the service).
//   · The 10-second window is a REVOCATION window, not a submission
//     delay. If the user does nothing, the countdown hits 0 and
//     confirmPendingAlert flips the state pending_confirmation →
//     active · the viewer navigates to the active page. If the user
//     taps CANCEL, revokePendingAlert flips the state to
//     revoked_within_window · the viewer returns to idle with an
//     honest "Alert revoked within safety window" message.
//   · Component unmount during the countdown fires revokePendingAlert
//     fire-and-forget to avoid orphan pending incidents.
//   · The Skip countdown link calls confirmPendingAlert immediately.
//   · Honest failure states for: offline, geolocation denied / errored,
//     no-eligible-responders. Never fabricate "success" when the stack
//     refused.
//   · SIMULATED · v1 badge visible at the top of every state.
//
// Anti-patterns:
//   · Do NOT create the pending alert row before the countdown enters.
//     The server-side effect fires at T=0 (start of counting-down)
//     and the countdown REMAINS the revocation window.
//   · Do NOT leave a running interval or watchPosition if the phase
//     leaves counting-down. Cleanup is mandatory on both.
//   · Do NOT silently proceed when geolocation is denied · surface the
//     explicit "we cannot share your location" message and let the user
//     decide whether to proceed with location unset.
//   · Do NOT persist the policy acknowledgment beyond sessionStorage.
//     A new session re-shows the warning. Deliberately brief enough not
//     to deter a genuine emergency.

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EMERGENCY_PALETTE } from "./_palette";
import { SimulatedBadge } from "./SimulatedBadge";
import type { IncidentCategory } from "./types";
// Owner directive 2026-10-25 · 3-dot side-drawer trigger pinned to the
// top-right of every emergency phase so the user can access the NEX
// Center drawer without leaving the flow.
import { ControlDrawer } from "@/components/nex-native/control-drawer/control-drawer-client";

type Phase =
  | "acknowledging-policy"
  | "idle"
  | "awaiting-geolocation"
  | "counting-down"
  | "submitting"
  // Owner directive 2026-10-25 · stay on the page after the countdown
  // completes · show a matrix-processing animation + "Alert Is Active
  // And Will Not Be Long" + Close button. No navigation.
  | "active-matrix"
  | "revoked"
  | "error"
  | "no-responders";

const POLICY_ACK_SESSION_KEY = "nex-emergency-policy-ack-v1";
// Owner directive 2026-10-25 · 10 → 5 seconds. Fast enough for a real
// emergency, long enough for an accidental tap to recover + find Cancel.
const COUNTDOWN_SECONDS = 5;
/** Client-side debounce for watchPosition updates during the safety
 *  window. Faster than the active-view 15 s because every second of
 *  the safety window is load-bearing. The server-side service also
 *  enforces a 10 s rate limit so bursts never land. */
const LOCATION_STREAM_MIN_INTERVAL_MS = 2000;

export interface EmergencyServiceResult {
  readonly ok: true;
  readonly incidentId?: string;
  readonly state?: string;
}
export interface EmergencyServiceFailure {
  readonly ok: false;
  readonly reason: string;
}

export interface EmergencyConfirmationScreenProps {
  /** Server actions · ONE object so tests can swap all seven at once.
   *  Legacy createDraft/activate stay for backward compat during the
   *  migration wave (never called by the pending-confirmation flow). */
  services: {
    createDraft: (args: {
      category: IncidentCategory;
      locationLat: number | null;
      locationLng: number | null;
      locationAccuracyMeters: number | null;
    }) => Promise<{ incidentId: string }>;
    activate: (
      incidentId: string,
    ) => Promise<{ incidentId: string; state: string }>;
    createPending: (args: {
      category: IncidentCategory;
      locationLat: number | null;
      locationLng: number | null;
      locationAccuracyMeters: number | null;
    }) => Promise<{ ok: true; incidentId: string } | { ok: false; reason: string }>;
    confirmPending: (args: {
      incidentId: string;
    }) => Promise<{ ok: true; state: string } | { ok: false; reason: string }>;
    revokePending: (args: {
      incidentId: string;
      reason?: string;
    }) => Promise<{ ok: true; state: string } | { ok: false; reason: string }>;
    updateLocation: (args: {
      incidentId: string;
      lat: number;
      lng: number;
      accuracyMeters: number | null;
      capturedAt: string;
    }) => Promise<{ ok: true } | { ok: false; reason: string }>;
  };
  /** Optional override for `navigator.geolocation` · tests inject a stub. */
  geolocation?: {
    getCurrentPosition: (
      success: (position: {
        coords: {
          latitude: number;
          longitude: number;
          accuracy: number;
        };
      }) => void,
      error: (err: { code: number; message: string }) => void,
      options?: unknown,
    ) => void;
    watchPosition?: (
      success: (position: {
        coords: {
          latitude: number;
          longitude: number;
          accuracy: number;
        };
        timestamp: number;
      }) => void,
      error?: (err: { code: number; message: string }) => void,
      options?: unknown,
    ) => number;
    clearWatch?: (watchId: number) => void;
  } | null;
  /** Online flag · defaults to `navigator.onLine`. Tests may override. */
  isOnline?: boolean;
  /** Simulated · v1 flag. Defaults to true (live mode is off in v1). */
  simulated?: boolean;
  /**
   * TEST-ONLY · forces an initial phase so unit tests can snapshot the
   * countdown block via renderToStaticMarkup without a DOM event loop.
   * Never set this from production code paths.
   */
  __testInitialPhase?: Phase;
  /**
   * TEST-ONLY · initial category used only when `__testInitialPhase` is
   * also provided. Allows countdown-phase snapshots to exist for a
   * selected category without a full interaction sequence.
   */
  __testInitialCategory?: IncidentCategory;
  /**
   * TEST-ONLY · initial incident id used only when `__testInitialPhase`
   * is also provided. Lets a snapshot test surface the pending-id
   * data attribute without walking the full flow.
   */
  __testInitialIncidentId?: string;
}

export function EmergencyConfirmationScreen({
  services,
  geolocation,
  isOnline,
  simulated = true,
  __testInitialPhase,
  __testInitialCategory,
  __testInitialIncidentId,
}: EmergencyConfirmationScreenProps): React.JSX.Element {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>(
    __testInitialPhase ?? "acknowledging-policy",
  );
  // Owner directive 2026-10-25 · "remove Medical concern / Safety
  // concern" + "must be click and active". The category tiles are
  // gone · every incident starts as `general_assistance` so the
  // "I NEED HELP" button is active from the moment the user lands
  // on the page. The owner can still choose a category later by
  // bringing the tiles back behind a quick-tap variant if needed.
  const [category, setCategory] = React.useState<IncidentCategory | null>(
    __testInitialCategory ?? "general_assistance",
  );
  const [geoError, setGeoError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [location, setLocation] = React.useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(null);
  const [secondsRemaining, setSecondsRemaining] =
    React.useState<number>(COUNTDOWN_SECONDS);
  const [incidentId, setIncidentId] = React.useState<string | null>(
    __testInitialIncidentId ?? null,
  );

  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const watchIdRef = React.useRef<number | null>(null);
  const lastStreamedAtRef = React.useRef<number>(0);
  // Guard against double-fire if the interval tick and an explicit
  // "Skip countdown" happen in the same frame.
  const firedRef = React.useRef<boolean>(false);
  // Ref-latched incident id so the countdown driver + unmount cleanup
  // can revoke without re-running on each incidentId state change.
  const incidentIdRef = React.useRef<string | null>(incidentId);
  React.useEffect(() => {
    incidentIdRef.current = incidentId;
  }, [incidentId]);

  const clearCountdownInterval = React.useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const clearLocationWatch = React.useCallback(() => {
    if (watchIdRef.current !== null) {
      const g =
        geolocation ??
        (typeof navigator !== "undefined" && "geolocation" in navigator
          ? (navigator.geolocation as EmergencyConfirmationScreenProps["geolocation"])
          : null);
      try {
        if (g && typeof g.clearWatch === "function") {
          g.clearWatch(watchIdRef.current);
        }
      } catch {
        /* non-fatal */
      }
      watchIdRef.current = null;
    }
  }, [geolocation]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (__testInitialPhase) return;
    try {
      const prior = window.sessionStorage.getItem(POLICY_ACK_SESSION_KEY);
      if (prior === "true") setPhase("idle");
    } catch {
      // sessionStorage disabled · stay on ack gate · still correct behaviour.
    }
  }, [__testInitialPhase]);

  const acknowledgePolicy = React.useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(POLICY_ACK_SESSION_KEY, "true");
      } catch {
        /* non-fatal */
      }
    }
    setPhase("idle");
  }, []);

  // Hydration-safe online detection. Server always returns `true` (no
  // `navigator`), so the first client render MUST also return `true`
  // or React tears the tree. We mirror the server initial state and
  // only read `navigator.onLine` after mount, swapping the header
  // from "Do you need help?" to "You are offline" if the browser is
  // actually offline. Fixes the Oct-25 hydration mismatch where a
  // mid-flight disconnected client painted "You are offline" over the
  // server's "NEX Emergency Help".
  const [browserOnline, setBrowserOnline] = React.useState<boolean>(true);
  React.useEffect(() => {
    if (typeof navigator === "undefined") return;
    setBrowserOnline(navigator.onLine);
    const on = (): void => setBrowserOnline(true);
    const off = (): void => setBrowserOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  const online = typeof isOnline === "boolean" ? isOnline : browserOnline;

  const geo =
    geolocation ??
    (typeof navigator !== "undefined" && "geolocation" in navigator
      ? (navigator.geolocation as unknown as EmergencyConfirmationScreenProps["geolocation"])
      : null);

  // Confirm the pending alert · reached by the natural T=0 tick or by
  // the explicit Skip countdown tap. Both paths flip the row's state
  // to active · owner directive 2026-10-25 keeps the user on THIS
  // page instead of routing to /active · phase moves to
  // "active-matrix" and the Shell renders a matrix-processing
  // animation + "Alert Is Active And Will Not Be Long" + Close.
  const confirmAlertFromCountdown = React.useCallback(async () => {
    if (firedRef.current) return;
    const id = incidentIdRef.current;
    if (id === null) {
      // Defensive · should never happen because createPending runs
      // before we enter counting-down. Surface an honest error.
      firedRef.current = false;
      clearCountdownInterval();
      clearLocationWatch();
      setSubmitError("Alert row missing · please try again.");
      setPhase("error");
      return;
    }
    firedRef.current = true;
    clearCountdownInterval();
    clearLocationWatch();
    setSubmitError(null);
    setPhase("submitting");
    try {
      const r = await services.confirmPending({ incidentId: id });
      if (!r.ok) {
        setSubmitError(`Could not confirm alert · ${r.reason}`);
        setPhase("error");
        firedRef.current = false;
        return;
      }
      setPhase("active-matrix");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error confirming alert.";
      if (/no.?responders/i.test(message)) {
        setPhase("no-responders");
      } else {
        setSubmitError(message);
        setPhase("error");
      }
      firedRef.current = false;
    }
  }, [services, router, clearCountdownInterval, clearLocationWatch]);

  // Countdown driver · owns the single interval. Any transition OUT of
  // counting-down clears the interval. Component unmount clears via the
  // cleanup return. This is the ONLY place a setInterval is started.
  React.useEffect(() => {
    if (phase !== "counting-down") {
      clearCountdownInterval();
      return;
    }
    // Entering counting-down · (re)initialise.
    setSecondsRemaining(COUNTDOWN_SECONDS);
    firedRef.current = false;
    clearCountdownInterval();
    intervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearCountdownInterval();
          // Defer OUTSIDE the React updater so router.push doesn't
          // trigger a Router setState during this component's update
          // cycle (fixes the Oct-25 "Cannot update a component Router
          // while rendering a different component" warning).
          setTimeout(() => {
            void confirmAlertFromCountdown();
          }, 0);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => {
      clearCountdownInterval();
    };
  }, [phase, clearCountdownInterval, confirmAlertFromCountdown]);

  // Belt-and-braces · hard unmount sweeps intervals + watchers and
  // fires revokePendingAlert fire-and-forget if we still hold a
  // pending incident id. This prevents orphan pending_confirmation
  // rows if the user closes the tab mid-countdown.
  React.useEffect(() => {
    return () => {
      clearCountdownInterval();
      clearLocationWatch();
      const id = incidentIdRef.current;
      // Only revoke if we never confirmed/revoked explicitly (firedRef
      // false means confirm was not called; the revoked phase sets
      // incidentIdRef.current to null before unmount).
      if (id !== null && !firedRef.current) {
        try {
          void services.revokePending({
            incidentId: id,
            reason: "component_unmounted_during_countdown",
          });
        } catch {
          /* best-effort fire-and-forget */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inject the heartbeat keyframes once per document. Self-contained so
  // the component has no global CSS dependency.
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "nex-emergency-countdown-heartbeat-keyframes";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      @keyframes nexEmergencyHeartbeat {
        0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgba(220,38,38,0.55); opacity: 1; }
        35%  { transform: scale(1.08); box-shadow: 0 0 0 18px rgba(220,38,38,0.00); opacity: 0.92; }
        70%  { transform: scale(1.00); box-shadow: 0 0 0 0 rgba(220,38,38,0.00); opacity: 1; }
        100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(220,38,38,0.00); opacity: 1; }
      }
      @keyframes nexEmergencyHeartbeatText {
        0%   { opacity: 1; }
        45%  { opacity: 0.55; }
        100% { opacity: 1; }
      }
    `;
    document.head.appendChild(el);
  }, []);

  const startLocationStreaming = React.useCallback(
    (idForStream: string) => {
      if (!geo || typeof geo.watchPosition !== "function") return;
      try {
        const watchId = geo.watchPosition(
          (pos) => {
            const now = Date.now();
            if (now - lastStreamedAtRef.current < LOCATION_STREAM_MIN_INTERVAL_MS) {
              return;
            }
            lastStreamedAtRef.current = now;
            const capturedAt = new Date(pos.timestamp ?? now).toISOString();
            try {
              void services.updateLocation({
                incidentId: idForStream,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracyMeters: pos.coords.accuracy,
                capturedAt,
              });
            } catch {
              /* streaming is best-effort during the safety window */
            }
          },
          () => {
            /* non-fatal · we already have the snapshot location */
          },
          { enableHighAccuracy: true, maximumAge: 0 },
        );
        if (typeof watchId === "number") {
          watchIdRef.current = watchId;
        }
      } catch {
        /* watchPosition unsupported · snapshot location still landed */
      }
    },
    [geo, services],
  );

  const requestLocationThenStart = React.useCallback(() => {
    setGeoError(null);
    setPhase("awaiting-geolocation");
    const beginPendingFlow = async (
      snapshot: { lat: number; lng: number; accuracy: number } | null,
    ) => {
      if (!category) {
        setSubmitError("No emergency category selected · please choose one.");
        setPhase("error");
        return;
      }
      try {
        const r = await services.createPending({
          category,
          locationLat: snapshot?.lat ?? null,
          locationLng: snapshot?.lng ?? null,
          locationAccuracyMeters: snapshot?.accuracy ?? null,
        });
        if (!r.ok) {
          setSubmitError(`Could not start alert · ${r.reason}`);
          setPhase("error");
          return;
        }
        setIncidentId(r.incidentId);
        incidentIdRef.current = r.incidentId;
        lastStreamedAtRef.current = 0;
        setPhase("counting-down");
        // Start the location stream · best-effort.
        startLocationStreaming(r.incidentId);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error starting alert.";
        setSubmitError(message);
        setPhase("error");
      }
    };
    if (!geo) {
      setGeoError("Your device does not expose geolocation. Alert can still be sent without a shared location.");
      void beginPendingFlow(null);
      return;
    }
    geo.getCurrentPosition(
      (pos) => {
        const snapshot = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setLocation(snapshot);
        void beginPendingFlow(snapshot);
      },
      (err) => {
        const reason =
          err.code === 1
            ? "Location permission denied. You can still send the alert · responders will not see your position."
            : `Location unavailable (${err.message}). You can still send the alert without a shared position.`;
        setGeoError(reason);
        void beginPendingFlow(null);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }, [geo, services, category, startLocationStreaming]);

  const cancelCountdown = React.useCallback(async () => {
    clearCountdownInterval();
    clearLocationWatch();
    firedRef.current = true; // suppress unmount revoke retry
    const id = incidentIdRef.current;
    setSecondsRemaining(COUNTDOWN_SECONDS);
    setPhase("submitting");
    if (id !== null) {
      try {
        await services.revokePending({ incidentId: id });
      } catch {
        /* best-effort · we still surface the revoked phase */
      }
    }
    setIncidentId(null);
    incidentIdRef.current = null;
    setPhase("revoked");
  }, [services, clearCountdownInterval, clearLocationWatch]);

  const skipCountdownAndFire = React.useCallback(() => {
    // Explicit opt-in · same destination as the natural 0 transition.
    void confirmAlertFromCountdown();
  }, [confirmAlertFromCountdown]);

  const returnToIdle = React.useCallback(() => {
    setSecondsRemaining(COUNTDOWN_SECONDS);
    setGeoError(null);
    setSubmitError(null);
    setLocation(null);
    setPhase("idle");
    firedRef.current = false;
  }, []);

  // Early guard · offline is honest, not a bug.
  if (!online) {
    return (
      <Shell>
        <SimulatedBadge live={!simulated} />
        <Header>You are offline</Header>
        <p
          style={{
            margin: "12px 0 0",
            color: EMERGENCY_PALETTE.textSecondary,
            lineHeight: 1.55,
          }}
        >
          NEX Emergency Help needs an internet connection to notify
          responders. Please reconnect and reopen this page. For a real
          emergency, call your local emergency services right away.
        </p>
      </Shell>
    );
  }

  if (phase === "acknowledging-policy") {
    return (
      <Shell>
        <SimulatedBadge live={!simulated} />
        <Header>NEX Emergency Help</Header>
        <p
          style={{
            margin: "10px 0 16px",
            color: EMERGENCY_PALETTE.textSecondary,
            fontSize: 14,
            lineHeight: 1.55,
          }}
        >
          Before sending an emergency alert, please read the following.
        </p>
        <section
          data-testid="nex-emergency-safety-warning"
          aria-labelledby="nex-emergency-warning-title"
          style={{
            padding: "18px",
            background: EMERGENCY_PALETTE.emergencyMuted,
            border: `1px solid ${EMERGENCY_PALETTE.emergencyBorder}`,
            borderRadius: 12,
            margin: "0 0 20px",
          }}
        >
          <h2
            id="nex-emergency-warning-title"
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: EMERGENCY_PALETTE.textPrimary,
              letterSpacing: "0.01em",
            }}
          >
            Important Safety Warning
          </h2>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: EMERGENCY_PALETTE.textSecondary,
            }}
          >
            Emergency alerts are intended for genuine situations where
            you need urgent assistance.
          </p>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: EMERGENCY_PALETTE.textSecondary,
            }}
          >
            False, fabricated, or deliberately misleading emergency
            alerts are strictly prohibited. Users who misuse this
            feature may have their NEX accounts suspended or
            permanently removed from the NEX community.
          </p>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: EMERGENCY_PALETTE.textSecondary,
            }}
          >
            If you are genuinely in danger, do not hesitate to request
            help. If you activate an alert by mistake, cancel it
            immediately and notify the recipients.
          </p>
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: EMERGENCY_PALETTE.textPrimary,
              fontWeight: 600,
            }}
          >
            By continuing, you confirm that you understand and agree
            to use Emergency Help responsibly.
          </p>
        </section>
        {/* Owner directive 2026-10-25 · "over button add - How It Works
            and link to page" · routes to the detailed emergency guide
            at /nex-native/emergency-help/how-it-works. */}
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <Link
            href="/nex-native/emergency-help/how-it-works"
            data-nex-emergency-how-it-works-link
            style={{
              display: "inline-block",
              fontSize: 13,
              fontWeight: 800,
              color: EMERGENCY_PALETTE.textPrimary,
              textDecoration: "underline",
            }}
          >
            How It Works →
          </Link>
        </div>
        <PrimaryButton
          onClick={acknowledgePolicy}
          data-testid="nex-emergency-policy-ack"
        >
          Activate System
        </PrimaryButton>
      </Shell>
    );
  }

  if (phase === "no-responders") {
    return (
      <Shell>
        <SimulatedBadge live={!simulated} />
        <Header>No eligible responders nearby</Header>
        <p
          style={{
            margin: "12px 0 0",
            color: EMERGENCY_PALETTE.textSecondary,
            lineHeight: 1.55,
          }}
        >
          We could not find any trusted contacts or opted-in responders
          within range. Your alert was NOT sent. For a real emergency,
          call your local emergency services.
        </p>
        <PrimaryButton onClick={returnToIdle}>Try again</PrimaryButton>
      </Shell>
    );
  }

  if (phase === "active-matrix") {
    return (
      <Shell>
        <SimulatedBadge live={!simulated} />
        <Header>Alert Active</Header>
        <ActiveMatrixPanel />
        <p
          data-testid="nex-emergency-active-matrix-copy"
          style={{
            margin: "16px 0 0",
            fontSize: 15,
            fontWeight: 800,
            color: EMERGENCY_PALETTE.textPrimary,
            textAlign: "center",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Processing
        </p>
        <button
          type="button"
          onClick={returnToIdle}
          data-testid="nex-emergency-active-matrix-close"
          aria-label="Close emergency alert view"
          style={{
            display: "block",
            width: "100%",
            marginTop: 20,
            padding: "14px 18px",
            background: "transparent",
            color: EMERGENCY_PALETTE.textPrimary,
            border: "2px solid rgba(0, 175, 255, 0.65)",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "inherit",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Close
        </button>
        {/* Owner directive 2026-10-25 · "counter at bottom of the alert
            is active page showing from the time the alert was activated
            · this could also make bad people afraid that time has
            passed". Honest counter: time since the active-matrix phase
            was entered. Updates once per second. Red + monospace reads
            as "clock is ticking, system remembers." */}
        <ElapsedSinceActivation />
      </Shell>
    );
  }

  if (phase === "revoked") {
    return (
      <Shell>
        <SimulatedBadge live={!simulated} />
        <Header>Alert Canceled</Header>
        {/* Owner directive 2026-10-25 · "bad guys" deterrent copy. The
            cancel aborts the fan-out, but NEX still keeps the record
            of the attempt (incident row with revoked_within_window
            state, timestamp, requester id, IP, location pin) so a bad
            actor who thinks "cancel = nothing happened" is wrong. */}
        <div
          data-testid="nex-emergency-revoked-copy"
          data-nex-emergency-revoked-deterrent
          style={{
            marginTop: 16,
            padding: "16px 16px 14px",
            borderRadius: 14,
            background: "rgba(6, 2, 6, 0.68)",
            border: "1px solid rgba(0, 175, 255, 0.45)",
            color: EMERGENCY_PALETTE.textPrimary,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#00AFFF",
              marginBottom: 8,
            }}
          >
            On the record
          </div>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: EMERGENCY_PALETTE.textSecondary,
            }}
          >
            Your alert has been saved with NEX — including your device
            IP, your location pin, and the exact time of the attempt.
          </div>
        </div>
        <PrimaryButton
          onClick={returnToIdle}
          data-testid="nex-emergency-revoked-return"
        >
          Return
        </PrimaryButton>
      </Shell>
    );
  }

  return (
    <Shell>
      <SimulatedBadge live={!simulated} />
      <Header>Do you need help?</Header>
      {/* Owner-authored 2026-10-25 · sub-tagline under the header. */}
      <div
        data-nex-emergency-header-subtagline
        style={{
          margin: "4px 0 0",
          fontSize: 13.5,
          fontWeight: 600,
          color: EMERGENCY_PALETTE.textSecondary,
          letterSpacing: "0.01em",
        }}
      >
        Help is closer than you think
      </div>

      {phase === "idle" || phase === "awaiting-geolocation" ? (
        /* Owner directive 2026-10-25 · square help button · reduced
           to ~50% of the original tap target per the "help button
           50% smaller" update. The button still carries all sealed
           action bindings · onClick, disabled, data-testid remain
           untouched so Playwright + vitest hooks keep working. */
        <button
          type="button"
          onClick={requestLocationThenStart}
          disabled={
            phase === "awaiting-geolocation" || category === null
          }
          data-testid="nex-emergency-primary-cta"
          data-nex-emergency-primary-ready={
            category !== null && phase !== "awaiting-geolocation"
              ? "true"
              : "false"
          }
          style={{
            display: "block",
            width: "100%",
            maxWidth: 160,
            aspectRatio: "1 / 1",
            // Owner directive 2026-10-25 · "move down - i need help
            // button 80px" · 80px of breathing room above the button
            // pushes it into a more deliberate tap zone, below the
            // header band.
            margin: "80px auto 0",
            background:
              phase === "awaiting-geolocation" || category === null
                ? EMERGENCY_PALETTE.emergencyMuted
                : EMERGENCY_PALETTE.emergency,
            color: "#FFFFFF",
            border: `2px solid ${EMERGENCY_PALETTE.emergency}`,
            borderRadius: 16,
            fontSize: 18,
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textAlign: "center",
            cursor:
              phase === "awaiting-geolocation" || category === null
                ? "default"
                : "pointer",
            boxShadow:
              phase === "awaiting-geolocation" || category === null
                ? undefined
                : "0 10px 28px -6px rgba(220, 38, 38, 0.55), inset 0 0 0 1px rgba(255,255,255,0.12)",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
            fontFamily: "inherit",
            transition: "transform 90ms ease, box-shadow 180ms ease",
          }}
        >
          {phase === "awaiting-geolocation"
            ? "Capturing location…"
            : "I NEED HELP"}
        </button>
      ) : null}

      {/* Owner directive 2026-10-25 · "hero area with ip container
          bottom" · the LocationReadyPanel (pulsing rings + device IP +
          "Activate Help · Press the Button" title + reassurance) now
          sits BELOW the help button as a hero-footer. The pulsing ring
          is still a readiness signal only · NEX does NOT request
          geolocation before the button tap (sealed doctrine, line 14).
          Added spacing above so it reads as a separate hero band. */}
      <div style={{ marginTop: 24 }}>
        <LocationReadyPanel />
      </div>
      {phase === "counting-down" ? (
        <div
          data-testid="nex-emergency-countdown"
          data-nex-emergency-seconds-remaining={secondsRemaining}
          data-nex-emergency-pending-incident-id={incidentId ?? ""}
          role="alert"
          aria-live="assertive"
          style={{
            marginTop: 4,
            padding: "22px 18px 20px",
            background: EMERGENCY_PALETTE.emergencyMuted,
            border: `1px solid ${EMERGENCY_PALETTE.emergencyBorder}`,
            borderRadius: 14,
            textAlign: "center",
          }}
        >
          {incidentId ? (
            <span
              data-testid="nex-emergency-pending-incident-id"
              data-nex-emergency-pending-incident-id={incidentId}
              style={{ display: "none" }}
            >
              {incidentId}
            </span>
          ) : null}
          <div
            aria-hidden="true"
            data-testid="nex-emergency-countdown-heartbeat"
            style={{
              width: 96,
              height: 96,
              margin: "0 auto 14px",
              borderRadius: "50%",
              background: EMERGENCY_PALETTE.emergency,
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: "0.02em",
              animation: "nexEmergencyHeartbeat 0.9s ease-in-out infinite",
              boxShadow: "0 0 0 0 rgba(220,38,38,0.55)",
            }}
          >
            {secondsRemaining}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: EMERGENCY_PALETTE.textPrimary,
              animation: "nexEmergencyHeartbeatText 0.9s ease-in-out infinite",
            }}
          >
            Sending alert in {secondsRemaining}
          </div>
          {geoError ? (
            <p
              data-testid="nex-emergency-geo-note"
              style={{
                margin: "10px 0 0",
                fontSize: 12.5,
                color: EMERGENCY_PALETTE.amber,
                lineHeight: 1.45,
              }}
            >
              {geoError}
            </p>
          ) : location ? (
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 12.5,
                color: EMERGENCY_PALETTE.textSecondary,
              }}
            >
              Location captured ({location.accuracy.toFixed(0)}m accuracy).
            </p>
          ) : null}
          <p
            style={{
              margin: "12px 0 16px",
              fontSize: 12.5,
              color: EMERGENCY_PALETTE.textSecondary,
              lineHeight: 1.5,
            }}
          >
            If this was a mistake, cancel now.
          </p>
          {/* Owner directive 2026-10-25 · pulsing cyan glow on CANCEL
              so a user who tapped by mistake sees the escape instantly
              under countdown pressure. Animation is CSS-only · respects
              prefers-reduced-motion via the inline @media below. */}
          <style>{`
            @keyframes nexEmergencyCancelGlow {
              0%, 100% {
                box-shadow:
                  0 0 0 0 rgba(0, 175, 255, 0.55),
                  0 4px 14px rgba(220, 38, 38, 0.25);
              }
              50% {
                box-shadow:
                  0 0 0 10px rgba(0, 175, 255, 0),
                  0 4px 20px rgba(0, 175, 255, 0.4);
              }
            }
            @media (prefers-reduced-motion: reduce) {
              [data-nex-emergency-countdown-cancel-glow] {
                animation: none !important;
              }
            }
          `}</style>
          <button
            type="button"
            onClick={() => void cancelCountdown()}
            data-testid="nex-emergency-countdown-cancel"
            data-nex-emergency-countdown-cancel-glow
            aria-label="Cancel emergency countdown"
            style={{
              display: "block",
              width: "100%",
              padding: "16px 18px",
              background: "transparent",
              color: EMERGENCY_PALETTE.textPrimary,
              border: `2px solid #00AFFF`,
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
              animation: "nexEmergencyCancelGlow 1600ms ease-in-out infinite",
            }}
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={skipCountdownAndFire}
            data-testid="nex-emergency-countdown-skip"
            style={{
              marginTop: 12,
              background: "transparent",
              border: "none",
              padding: "4px 8px",
              color: EMERGENCY_PALETTE.textDim,
              fontSize: 12,
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Skip countdown — send now
          </button>
        </div>
      ) : null}

      {phase === "submitting" ? (
        <p
          data-testid="nex-emergency-submitting"
          style={{
            marginTop: 14,
            color: EMERGENCY_PALETTE.textSecondary,
            fontSize: 13,
          }}
        >
          Sending alert…
        </p>
      ) : null}

      {phase === "error" && submitError ? (
        <p
          data-testid="nex-emergency-error"
          role="alert"
          style={{
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: 10,
            background: EMERGENCY_PALETTE.emergencyMuted,
            border: `1px solid ${EMERGENCY_PALETTE.emergencyBorder}`,
            color: EMERGENCY_PALETTE.textPrimary,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {submitError}
        </p>
      ) : null}

      <p
        style={{
          marginTop: 20,
          fontSize: 11.5,
          color: EMERGENCY_PALETTE.textDim,
          lineHeight: 1.5,
        }}
      >
        {/* Owner directive 2026-10-25 · consent + privacy reassurance.
            Replaces the earlier "Share your location and emergency
            profile details..." line. Owner-reworded for a calmer,
            opt-in privacy posture. */}
        You have activated this service. NEX will never monitor your
        location unless you opt in to a feature that could save your
        life — or a loved one&apos;s.
      </p>

    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <main
      data-testid="nex-emergency-confirmation-screen"
      style={{
        position: "relative",
        // Owner directive 2026-10-25 · mobile-first fit · "100%" so
        // we fill the .nex-native-frame (viewport on mobile, 909px
        // phone silhouette on desktop) instead of escaping to the real
        // browser viewport.
        minHeight: "100%",
        // Owner directive 2026-10-25 · unified emergency background ·
        // the Futuristic Red Cross Rescue Shield image (already used
        // on the activation page) now also stands behind the
        // countdown surface so the two emergency intro surfaces read
        // as one visual family. Dark gradient overlay keeps the
        // SIMULATED · v1 badge, the countdown + Cancel copy and the
        // category buttons legible over the shield.
        backgroundColor: EMERGENCY_PALETTE.bg,
        backgroundImage:
          "linear-gradient(180deg, rgba(6, 2, 6, 0.78) 0%, rgba(6, 2, 6, 0.5) 32%, rgba(6, 2, 6, 0.55) 65%, rgba(6, 2, 6, 0.86) 100%), url(/nex-emergency/activate-background.png)",
        backgroundSize: "100% 100%, cover",
        backgroundPosition: "center, center",
        backgroundRepeat: "no-repeat, no-repeat",
        color: EMERGENCY_PALETTE.textPrimary,
        padding: "20px 20px 40px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Owner directive 2026-10-25 · side-drawer trigger pinned to
          the top-right so every emergency phase keeps the "⋮ NEX
          Center" affordance. `session={null}` mirrors the
          activate/welcome pages · the drawer renders its guest-state
          (Sign in to NEX bar + locked rows + Live/Vault/Socials
          quick-access) and the full user state once auth lands. */}
      <div
        data-nex-emergency-header-drawer-slot
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 5,
        }}
      >
        <ControlDrawer session={null} />
      </div>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>{children}</div>
    </main>
  );
}

function Header({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <h1
      style={{
        margin: "20px 0 0",
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: "0.005em",
      }}
    >
      {children}
    </h1>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  "data-testid": testId,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  "data-testid"?: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      style={{
        display: "block",
        width: "100%",
        padding: "16px 18px",
        marginTop: 4,
        background: disabled
          ? EMERGENCY_PALETTE.emergencyMuted
          : EMERGENCY_PALETTE.emergency,
        color: "#FFFFFF",
        border: `1px solid ${EMERGENCY_PALETTE.emergency}`,
        borderRadius: 12,
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        cursor: disabled ? "default" : "pointer",
        boxShadow: disabled
          ? undefined
          : "0 6px 18px rgba(220,38,38,0.35)",
      }}
    >
      {children}
    </button>
  );
}

function CategoryIconButton({
  value,
  label,
  imageSrc,
  selected,
  onSelect,
  disabled,
}: {
  value: IncidentCategory;
  label: string;
  imageSrc: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}): React.JSX.Element {
  // Flashing glow styles live inline as a keyframe + animation so the
  // component is self-contained · no global CSS needed. The glow sits
  // UNDER the card (box-shadow outside the border) and pulses between
  // cyan at low opacity and emergency red at higher opacity when the
  // card is selected. Unselected cards show a static muted border.
  const styleTagId = "nex-emergency-category-glow-keyframes";
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(styleTagId)) return;
    const el = document.createElement("style");
    el.id = styleTagId;
    el.textContent = `
      @keyframes nexEmergencyCategoryGlow {
        0%   { box-shadow: 0 0 0 1px ${EMERGENCY_PALETTE.emergency}, 0 10px 24px -4px rgba(0,175,255,0.35); }
        50%  { box-shadow: 0 0 0 1px ${EMERGENCY_PALETTE.emergency}, 0 18px 40px -4px rgba(220,38,38,0.70); }
        100% { box-shadow: 0 0 0 1px ${EMERGENCY_PALETTE.emergency}, 0 10px 24px -4px rgba(0,175,255,0.35); }
      }
    `;
    document.head.appendChild(el);
  }, []);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onSelect}
      disabled={disabled}
      data-testid={`nex-emergency-category-button-${value}`}
      data-nex-emergency-category-value={value}
      data-nex-emergency-category-selected={selected ? "true" : "false"}
      style={{
        position: "relative",
        padding: 10,
        background: EMERGENCY_PALETTE.surface,
        border: `1px solid ${
          selected
            ? EMERGENCY_PALETTE.emergency
            : "rgba(0, 175, 255, 0.25)"
        }`,
        borderRadius: 14,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled && !selected ? 0.6 : 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        transition: "transform 120ms ease",
        transform: selected ? "translateY(-2px)" : "translateY(0)",
        animation: selected
          ? "nexEmergencyCategoryGlow 1.4s ease-in-out infinite"
          : "none",
      }}
    >
      <img
        src={imageSrc}
        alt=""
        aria-hidden="true"
        width={120}
        height={120}
        style={{
          width: "100%",
          height: "auto",
          maxWidth: 160,
          display: "block",
          borderRadius: 10,
          imageRendering: "auto",
        }}
      />
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: selected
            ? EMERGENCY_PALETTE.textPrimary
            : EMERGENCY_PALETTE.textSecondary,
        }}
      >
        {label}
      </span>
    </button>
  );
}

// ─── LocationReadyPanel ────────────────────────────────────────────
//
// Owner directive 2026-10-25 · "location monitoring animation and
// phone ip address and text Activate Help Press the Button . your
// exact location will be shared when button is activated".
//
// What this component honestly represents:
//   · Pulsing concentric rings = the device is READY to share location
//     on tap. NEX is NOT tracking the user before they press. The
//     sealed doctrine at line 14 of this file forbids geolocation
//     requests before the "I NEED HELP" tap · this animation is a
//     readiness signal, not an active tracker.
//   · The IP line fetches the device's public IP from ipify.org on
//     mount so the user sees a concrete device identifier. If the
//     fetch fails (network, blocker), the line shows "unavailable"
//     rather than inventing a value.
//   · The title + reassurance text are owner-authored verbatim.
//
// If the owner later authorises a server-action variant, swap the
// client-side ipify call for a server-side `req.headers['x-forwarded-
// for']` read.

function LocationReadyPanel(): React.JSX.Element {
  const [ip, setIp] = React.useState<string | null>(null);
  const [ipState, setIpState] = React.useState<
    "loading" | "ok" | "unavailable"
  >("loading");

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    fetch("https://api.ipify.org?format=json", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http"))))
      .then((j: { ip?: unknown }) => {
        if (cancelled) return;
        const value = typeof j.ip === "string" ? j.ip : "";
        if (value.length === 0) {
          setIpState("unavailable");
          return;
        }
        setIp(value);
        setIpState("ok");
      })
      .catch(() => {
        if (!cancelled) setIpState("unavailable");
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  const ringKeyframes = `
    @keyframes nexEmergencyPulseRing {
      0%   { transform: scale(0.6); opacity: 0.85; }
      70%  { transform: scale(1.6); opacity: 0;    }
      100% { transform: scale(1.6); opacity: 0;    }
    }
    @keyframes nexEmergencyCoreGlow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255, 51, 85, 0.65); }
      50%      { box-shadow: 0 0 0 10px rgba(255, 51, 85, 0); }
    }
    @media (prefers-reduced-motion: reduce) {
      [data-nex-emergency-location-ready] *,
      [data-nex-emergency-location-ready]::before,
      [data-nex-emergency-location-ready]::after {
        animation: none !important;
      }
    }
  `;

  return (
    <div
      data-nex-emergency-location-ready
      data-testid="nex-emergency-location-ready-panel"
      style={{
        margin: "0 0 18px",
        padding: "16px 16px 14px",
        borderRadius: 14,
        background: "rgba(6, 2, 6, 0.68)",
        border: "1px solid rgba(255, 51, 85, 0.45)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      <style>{ringKeyframes}</style>

      {/* Pulsing concentric rings · readiness, not tracking */}
      <div
        aria-hidden
        style={{
          position: "relative",
          width: 72,
          height: 72,
          display: "grid",
          placeItems: "center",
        }}
      >
        {[0, 500, 1000].map((delay) => (
          <span
            key={delay}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "2px solid rgba(255, 51, 85, 0.55)",
              animationName: "nexEmergencyPulseRing",
              animationDuration: "1500ms",
              animationIterationCount: "infinite",
              animationTimingFunction: "ease-out",
              animationDelay: `${delay}ms`,
            }}
          />
        ))}
        <span
          style={{
            position: "relative",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#FF3355",
            animationName: "nexEmergencyCoreGlow",
            animationDuration: "1500ms",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
          }}
        />
      </div>

      {/* Device IP · honest fallback when unreachable */}
      <div
        data-testid="nex-emergency-location-ready-ip"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: EMERGENCY_PALETTE.textSecondary,
          fontFamily:
            "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
        }}
      >
        {ipState === "loading"
          ? "Device IP · detecting…"
          : ipState === "ok"
            ? `Device IP · ${ip}`
            : "Device IP · unavailable"}
      </div>

      {/* Owner-authored title · 2026-10-25 */}
      <div
        style={{
          fontSize: 15,
          fontWeight: 900,
          color: EMERGENCY_PALETTE.textPrimary,
          textAlign: "center",
          letterSpacing: "0.01em",
        }}
      >
        Activate Help · Press the Button
      </div>

      {/* Owner-authored reassurance · 2026-10-25 */}
      <div
        style={{
          fontSize: 12.5,
          lineHeight: 1.45,
          color: EMERGENCY_PALETTE.textSecondary,
          textAlign: "center",
        }}
      >
        Your exact location will be shared when the button is activated.
      </div>
    </div>
  );
}

// ─── ActiveMatrixPanel ─────────────────────────────────────────────
//
// Owner directive 2026-10-25 · "longer matrix animation, add some
// details in red color Police - yellow accepted alert · if bad guy
// was watching we need he think nex has made contact and nex community
// are active · we don't say that just the animation · make sure the
// animation is not showing same all the time."
//
// What this component honestly represents:
//   · DECORATIVE. The scrolling lines are not real server logs. They
//     signal that the system is doing substantial work after the
//     button press · a deterrent against bad actors who assume
//     "pressed and no visible fallout = nothing happened."
//   · The pool rotates: a cycling window of lines is drawn from a
//     ~25-entry pool each tick, so the panel never shows the same
//     frame twice. Hex noise reshuffles every tick.
//   · The honest backstop line "simulated=true · no real alerts sent
//     in pilot" is PINNED at the bottom of every frame · it never
//     cycles out. The deterrent framing stays within an honest
//     perimeter.
//
// Color code:
//   · green  (#00FF66) · default NEX system log
//   · yellow (#FFC24B) · accepted-alert / responder-join events
//   · red    (#FF3355) · police / emergency-services routing lines
//   · dim    (opacity 0.55) · metadata / noise
//
// The sealed doctrine at line 14 of this file holds: the fan-out hook
// is a NO-OP, no real alerts dispatch, no real police contact. This
// panel is the user-facing "working" indicator while the pilot
// completes · once real delivery lands these lines can be swapped for
// real event streams.

type MatrixColor = "green" | "yellow" | "red";
interface MatrixLine {
  readonly text: string;
  readonly color?: MatrixColor;
  readonly dim?: boolean;
}

const MATRIX_FAKE_NEX_IDS = [
  "NEX-7F3A2", "NEX-C1B84", "NEX-9D2E1", "NEX-4B8C0",
  "NEX-2A6E5", "NEX-E70D9", "NEX-5F13C", "NEX-A2B47",
  "NEX-D08EF", "NEX-61C3A",
] as const;

function ActiveMatrixPanel(): React.JSX.Element {
  const [tick, setTick] = React.useState(0);
  const [startedAt] = React.useState<number>(() => Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 180);
    return () => clearInterval(id);
  }, []);

  const hexNoise = React.useMemo(() => {
    const chars = "0123456789abcdef";
    const line = Array.from({ length: 44 }, (_, i) => {
      const seed = (tick + i * 7) % 16;
      return chars[seed] ?? "0";
    }).join("");
    return line.match(/.{1,4}/g)?.join(" ") ?? line;
  }, [tick]);

  const elapsedSec = Math.max(
    0,
    Math.floor((Date.now() - startedAt) / 1000),
  );

  // Pool of all possible lines. Each cycle picks a subset so the
  // visible frame never repeats exactly. Honest-fact lines carry
  // `dim: true` so the eye is drawn to the colored action lines.
  const nexId = (offset: number): string =>
    MATRIX_FAKE_NEX_IDS[(tick + offset) % MATRIX_FAKE_NEX_IDS.length]!;

  const pool: ReadonlyArray<MatrixLine> = [
    { text: `[nex] alert.channel: open`, dim: true },
    { text: `[nex] incident.id: sim-${hexNoise.slice(0, 11)}`, dim: true },
    { text: `[nex] device.ip: logged`, dim: true },
    { text: `[nex] location.pin: shared with recipients`, dim: true },
    { text: `[nex] t+${elapsedSec}s · acquiring responder list` },
    { text: `[nex] trusted_contact.notified: 3/3` },
    { text: `[nex] nearby_responder.scan: in progress` },
    { text: `[nex] nearby_responder.radius: 3 km` },
    { text: `[nex] nearby_responder.found: ${((tick * 3) % 14) + 2}` },
    { text: `[nex] community.beacon: broadcasting` },
    { text: `[nex] handshake: encrypted` },
    { text: `[nex] response_group.open: standby` },
    { text: `${nexId(0)} · accepted alert`, color: "yellow" },
    { text: `${nexId(2)} · responding · eta 4 min`, color: "yellow" },
    { text: `${nexId(5)} · joining response group`, color: "yellow" },
    { text: `${nexId(1)} · standing by`, color: "yellow" },
    { text: `${nexId(7)} · acknowledged`, color: "yellow" },
    { text: `[police] dispatch.channel: contact.pending`, color: "red" },
    { text: `[police] jurisdiction: resolving`, color: "red" },
    { text: `[police] routing: nearest.unit`, color: "red" },
    { text: `[police] on.record: incident ref sim-${hexNoise.slice(0, 6)}`, color: "red" },
    { text: `[hex] ${hexNoise}`, dim: true },
    { text: `[nex] dispatch.channel: in_app · sms · email · whatsapp`, dim: true },
  ];

  // Rotating window · 14 lines visible out of ~23 in the pool. The
  // starting offset advances every ~4 ticks so the window glides
  // slowly instead of flashing random content.
  const WINDOW = 14;
  const start = Math.floor(tick / 4) % pool.length;
  const windowed: MatrixLine[] = [];
  for (let i = 0; i < WINDOW; i++) {
    windowed.push(pool[(start + i) % pool.length]!);
  }

  const colorFor = (c: MatrixColor | undefined): string => {
    if (c === "yellow") return "#FFC24B";
    if (c === "red") return "#FF3355";
    return "#00FF66";
  };

  return (
    <div
      data-nex-emergency-active-matrix
      data-testid="nex-emergency-active-matrix-panel"
      style={{
        marginTop: 16,
        padding: "16px 16px 14px",
        borderRadius: 14,
        background: "rgba(0, 10, 2, 0.9)",
        border: "1px solid rgba(0, 220, 90, 0.45)",
        boxShadow: "inset 0 0 32px rgba(0, 220, 90, 0.08)",
        overflow: "hidden",
        maxHeight: 360,
      }}
    >
      <style>{`
        @keyframes nexEmergencyMatrixFlicker {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.72; }
        }
        [data-nex-emergency-active-matrix-cursor] {
          display: inline-block;
          width: 7px;
          height: 12px;
          background: #00FF66;
          margin-left: 2px;
          vertical-align: baseline;
          animation: nexEmergencyMatrixFlicker 900ms steps(2) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-emergency-active-matrix] * {
            animation: none !important;
          }
          [data-nex-emergency-active-matrix-cursor] { opacity: 1; }
        }
      `}</style>
      <div
        style={{
          fontFamily:
            "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
          fontSize: 11,
          lineHeight: 1.55,
          whiteSpace: "pre",
          overflow: "hidden",
        }}
      >
        {windowed.map((l, i) => (
          <div
            // Keyed by position + tick-slice so React recycles rows as
            // the window slides · smooth, not jarring.
            key={`${start}-${i}`}
            style={{
              color: colorFor(l.color),
              opacity: l.dim ? 0.55 : 1,
              fontWeight: l.color === "red" ? 700 : 400,
              animation: `nexEmergencyMatrixFlicker ${900 + (i % 4) * 180}ms ease-in-out infinite`,
            }}
          >
            {l.text}
          </div>
        ))}

        {/* Honest backstop · pinned, never cycles out. */}
        <div
          style={{
            marginTop: 6,
            paddingTop: 6,
            borderTop: "1px dashed rgba(0, 220, 90, 0.2)",
            color: "#00FF66",
            opacity: 0.5,
          }}
        >
          [nex] simulated=true · no real alerts sent in pilot
        </div>
        <div style={{ color: "#00FF66" }}>
          <span style={{ opacity: 0.65 }}>[nex]&nbsp;processing</span>
          <span data-nex-emergency-active-matrix-cursor aria-hidden />
        </div>
      </div>
    </div>
  );
}

// ─── ElapsedSinceActivation ────────────────────────────────────────
//
// Owner directive 2026-10-25 · counter at the bottom of the Alert
// Active phase showing time since activation. Honest (reads a real
// Date.now() diff) · ticks every second · red + monospace so a bad
// actor watching sees the clock advancing + understands NEX has
// retained the moment of activation.

function ElapsedSinceActivation(): React.JSX.Element {
  const [startedAt] = React.useState<number>(() => Date.now());
  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <div
      data-testid="nex-emergency-elapsed-since-activation"
      style={{
        marginTop: 18,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 10,
        background: "rgba(6, 2, 6, 0.68)",
        border: "1px solid rgba(255, 51, 85, 0.45)",
        fontFamily:
          "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#FF3355",
          boxShadow: "0 0 0 2px rgba(255, 51, 85, 0.25)",
          animation: "nexEmergencyElapsedDot 1200ms ease-in-out infinite",
        }}
      />
      <style>{`
        @keyframes nexEmergencyElapsedDot {
          0%, 100% { opacity: 1;   transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(0.86); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="nex-emergency-elapsed-since-activation"] span {
            animation: none !important;
          }
        }
      `}</style>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#FF6B81",
        }}
      >
        Active for
      </span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: "0.08em",
          color: EMERGENCY_PALETTE.textPrimary,
          minWidth: 72,
          textAlign: "center",
        }}
      >
        {mm}:{ss}
      </span>
    </div>
  );
}
