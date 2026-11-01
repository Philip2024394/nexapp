"use client";

// src/components/nex-native/nex-feed/FeedModeEntryOverlay.tsx
//
// Owner-authorised 2026-11-01 · NEX Feed-mode entry overlay.
// --------------------------------------------------------------------
// When the viewer taps the CountryFeedSwitcher button, the next feed
// URL is loaded with `?entering=1`. On mount, this overlay reads that
// flag and fires a country-flavoured entry effect behind a dark scrim
// with the large `pillLabel` ("Live Ireland", "Live World") text.
//
// Design (owner-authorised 2026-11-01):
//   · Scrim fades to 55% opacity (150ms)
//   · Country-specific burst fires:
//       - worldId "ireland"      → IrishShamrockBurst (sealed primitive)
//       - worldId "nex-original" → WorldGlobeSpin (cyan globe + rays)
//     Future country worlds register their own burst component and
//     extend the dispatch map below. One file, one place.
//   · Large pillLabel text ("Live Ireland" / "Live World") springs in
//     via framer-motion and lingers 900ms
//   · Total: ~1900ms
//   · Tap anywhere OR press Esc dismisses early
//   · prefers-reduced-motion → crossfade only (no spring, no burst,
//     the pill still shows briefly so the viewer gets the signal)
//
// URL-state model:
//   The CountryFeedSwitcher appends `&entering=1` to the switcher's
//   destination URL. On overlay mount the flag is detected, the
//   trigger fires once, and `router.replace` strips the flag so a
//   refresh / back-forward does not retrigger. One-shot per switch.
//
// Honours the sealed Global Development Scope Rule (2026-11-01):
//   · Shared framework (this file + dispatch map) applies globally
//   · Country-specific burst components stay country-scoped
//   · Adding Indonesia later is a dispatch-map entry, not a rewrite

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { IrishShamrockBurst } from "@/components/nex-native/country-flare/IrishShamrockBurst";
import { WorldGlobeSpin } from "./_world-globe-spin";

export interface FeedModeEntryOverlayProps {
  /** Current world id (resolved from NEX_APP_IDENTITY or current feed
   *  mode). Example: "ireland", "nex-original", future codes. */
  readonly worldId: string;
  /** Short pill label shown as the large overlay text. Example:
   *  "Live Ireland", "Live World". */
  readonly pillLabel: string;
}

// Owner directive 2026-11-01 · "slow down the time when notification
// change to live ireland user should see for 2 seconds and when
// effect live world with image badge 1 second then image world 2
// seconds · so user can see". Dismiss duration now per-world:
//   · Ireland         → 2000 ms (owner-directed 2 s hold)
//   · Worldwide feed  → 3000 ms (1 s burst + 2 s pill display per
//                                 owner directive · WorldGlobeSpin's
//                                 own SPIN_DURATION_MS is 1000 ms so
//                                 the burst completes at 1 s and the
//                                 pill stays visible for 2 more s)
//   · Any other world → 1900 ms default fallback
const AUTO_DISMISS_BY_WORLD: Record<string, number> = {
  ireland: 2000,
  "nex-original": 3000,
};
const AUTO_DISMISS_DEFAULT_MS = 1900;
const PILL_HOLD_START_MS = 350;

/** Trigger-only burst dispatch. Returns a single burst component for
 *  the active worldId. Future worlds register here with a one-liner. */
function CountryBurst(props: {
  readonly worldId: string;
  readonly trigger: number;
}): React.JSX.Element | null {
  switch (props.worldId) {
    case "ireland":
      return <IrishShamrockBurst trigger={props.trigger} />;
    case "nex-original":
      return <WorldGlobeSpin trigger={props.trigger} />;
    default:
      return null;
  }
}

export function FeedModeEntryOverlay(
  props: FeedModeEntryOverlayProps,
): React.JSX.Element | null {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  const [trigger, setTrigger] = React.useState(0);
  const [visible, setVisible] = React.useState(false);
  const firedForUrlRef = React.useRef<string | null>(null);

  const entering = searchParams?.get("entering") === "1";
  const urlKey = `${pathname}?${searchParams?.toString() ?? ""}`;

  const stripEnteringParam = React.useCallback(() => {
    if (!searchParams) return;
    const next = new URLSearchParams(searchParams.toString());
    if (!next.has("entering")) return;
    next.delete("entering");
    const q = next.toString();
    router.replace(q.length > 0 ? `${pathname}?${q}` : pathname, {
      scroll: false,
    });
  }, [router, pathname, searchParams]);

  const dismiss = React.useCallback(() => {
    setVisible(false);
    stripEnteringParam();
  }, [stripEnteringParam]);

  const autoDismissMs =
    AUTO_DISMISS_BY_WORLD[props.worldId] ?? AUTO_DISMISS_DEFAULT_MS;

  React.useEffect(() => {
    if (!entering) return;
    if (firedForUrlRef.current === urlKey) return;
    firedForUrlRef.current = urlKey;
    setTrigger(Date.now());
    setVisible(true);
    const t = window.setTimeout(dismiss, autoDismissMs);
    return () => window.clearTimeout(t);
  }, [entering, urlKey, dismiss, autoDismissMs]);

  React.useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, dismiss]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={`entry-overlay-${trigger}`}
        data-nex-feed-mode-entry-overlay
        data-nex-world={props.worldId}
        role="status"
        aria-live="polite"
        aria-label={`Entering ${props.pillLabel} feed`}
        onClick={dismiss}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(2, 9, 20, 0.55)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          pointerEvents: "auto",
        }}
      >
        <CountryBurst worldId={props.worldId} trigger={trigger} />

        {prefersReducedMotion ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={pillStyleFor(props.worldId)}
          >
            {props.pillLabel}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.3, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            transition={{
              delay: PILL_HOLD_START_MS / 1000,
              type: "spring",
              stiffness: 180,
              damping: 20,
              mass: 0.8,
            }}
            style={pillStyleFor(props.worldId)}
          >
            {props.pillLabel}
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function pillStyleFor(worldId: string): React.CSSProperties {
  // Owner directive 2026-11-01 (sizing follow-up) · pill must have
  // visible gutter from both screen edges. Reduced fontSize 44 → 32,
  // horizontal padding 36 → 22, and clamped the overall width so
  // narrow phones always keep ≥ 24px on each side without the text
  // wrapping (whiteSpace: nowrap preserved).
  const base: React.CSSProperties = {
    position: "relative",
    zIndex: 2,
    padding: "12px 22px",
    borderRadius: 999,
    fontSize: 32,
    fontWeight: 900,
    letterSpacing: 0.3,
    fontFamily: "Inter, system-ui, sans-serif",
    color: "#F2F5F8",
    textShadow: "0 2px 20px rgba(0, 0, 0, 0.6)",
    textAlign: "center",
    userSelect: "none",
    whiteSpace: "nowrap",
    maxWidth: "calc(100vw - 48px)",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
  if (worldId === "ireland") {
    return {
      ...base,
      background:
        "linear-gradient(135deg, rgba(27, 81, 56, 0.9) 0%, rgba(2, 173, 4, 0.75) 100%)",
      border: "2px solid rgba(198, 161, 91, 0.7)",
      boxShadow: "0 0 48px rgba(2, 173, 4, 0.45)",
    };
  }
  return {
    ...base,
    background:
      "linear-gradient(135deg, rgba(10, 27, 54, 0.9) 0%, rgba(0, 175, 255, 0.3) 100%)",
    border: "2px solid rgba(0, 175, 255, 0.6)",
    boxShadow: "0 0 48px rgba(0, 175, 255, 0.45)",
  };
}
