"use client";

// src/app/nex-native/home/_first-contact-share-handle.tsx
//
// Client-side share widget for the first-contact identity card ·
// 2026-10-14.
//
// Owner-approved behaviour (sealed 2026-10-14):
//   · one native share action (navigator.share) with safe copy
//     fallback (navigator.clipboard.writeText).
//   · when the viewer's profile is NOT discoverable, share only
//     the handle string (`nex-NNNNN`).
//   · when the viewer's profile IS discoverable, share the handle
//     AND the canonical `/u/{handle}` URL so recipients land on the
//     verified public profile.
//   · never fabricate a share URL that would 404 for the recipient.
//     The caller passes `canShareProfileUrl` as the authoritative
//     flag; this component does NOT re-check discoverability.
//
// Doctrinal boundaries this module MUST NEVER cross:
//   · no cookies, no DB write, no server action, no fetch.
//   · no reads of profile state (parent RSC owns that).
//   · no sealed-service imports.
//   · no composition with product-share, Bridge 17, or any other
//     surface. The payload is identity-only.

import * as React from "react";

export interface FirstContactShareHandleProps {
  /** The viewer's NEX handle · e.g. "nex-00123". Required. */
  readonly handle: string;
  /** When true the caller has verified `profile.is_discoverable === true`
   *  server-side · we may include the public-profile URL in the share. */
  readonly canShareProfileUrl: boolean;
  /** Theme accent for the button rim. Defaults to NEX cyan. */
  readonly accentHex?: string;
}

/** Build the share payload for a given state. Exported for unit tests. */
export function buildSharePayload(
  handle: string,
  canShareProfileUrl: boolean,
  origin: string,
): { title: string; text: string; url?: string } {
  if (canShareProfileUrl) {
    return {
      title: "My NEX identity",
      text: `I'm on NEX · my handle is ${handle}`,
      url: `${origin}/nex-native/u/${handle}`,
    };
  }
  return {
    title: "My NEX identity",
    text: `I'm on NEX · my handle is ${handle}. Find me by searching this handle in NEX.`,
  };
}

/** Choose what the clipboard fallback copies · just the identity
 *  identifier, so the user can paste it anywhere. */
export function buildClipboardPayload(
  handle: string,
  canShareProfileUrl: boolean,
  origin: string,
): string {
  return canShareProfileUrl ? `${origin}/nex-native/u/${handle}` : handle;
}

export function FirstContactShareHandle(
  props: FirstContactShareHandleProps,
): React.ReactElement {
  const { handle, canShareProfileUrl, accentHex = "#00AFFF" } = props;
  const [status, setStatus] = React.useState<"idle" | "copied" | "shared" | "error">(
    "idle",
  );

  async function handleShare(): Promise<void> {
    // Guarded `window` access · this handler only runs on the client
    // after a user tap, so `window` is defined.
    const origin = window.location.origin;
    const payload = buildSharePayload(handle, canShareProfileUrl, origin);
    const clipboardText = buildClipboardPayload(handle, canShareProfileUrl, origin);

    // Prefer the OS share sheet when available (mobile Safari /
    // Chrome / Android · consolidates WhatsApp, SMS, mail, etc.).
    const nav = typeof navigator !== "undefined" ? navigator : null;
    if (nav && typeof nav.share === "function") {
      try {
        await nav.share(payload);
        setStatus("shared");
        return;
      } catch (err) {
        // AbortError = user dismissed · not an error we should surface.
        if (err instanceof DOMException && err.name === "AbortError") {
          setStatus("idle");
          return;
        }
        // Fall through to clipboard fallback on NotAllowedError /
        // SecurityError (e.g. non-secure context).
      }
    }

    if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
      try {
        await nav.clipboard.writeText(clipboardText);
        setStatus("copied");
        return;
      } catch {
        setStatus("error");
        return;
      }
    }

    setStatus("error");
  }

  // Reset the transient confirmation chip after a short delay.
  React.useEffect(() => {
    if (status === "copied" || status === "shared") {
      const t = window.setTimeout(() => setStatus("idle"), 1800);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [status]);

  const statusCopy =
    status === "copied"
      ? "Copied to clipboard"
      : status === "shared"
        ? "Shared"
        : status === "error"
          ? "Share unavailable · copy the handle manually"
          : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        type="button"
        onClick={handleShare}
        data-nex-first-contact-share-button
        aria-label={`Share my NEX handle · ${handle}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          minHeight: 44,
          padding: "10px 18px",
          borderRadius: 12,
          background: `linear-gradient(180deg, ${accentHex}26 0%, ${accentHex}0a 100%)`,
          border: `1px solid ${accentHex}aa`,
          color: "#F2F5F8",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          cursor: "pointer",
          fontFamily: "inherit",
          boxShadow: `0 10px 24px ${accentHex}22`,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>
          ↗
        </span>
        <span>Share my NEX identity</span>
      </button>
      {statusCopy && (
        <div
          role="status"
          data-nex-first-contact-share-status={status}
          style={{
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: status === "error" ? "#FF7200" : accentHex,
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          {statusCopy}
        </div>
      )}
    </div>
  );
}
