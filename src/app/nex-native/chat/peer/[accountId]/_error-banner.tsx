// src/app/nex-native/chat/peer/[accountId]/_error-banner.tsx
//
// Shared ChatErrorBanner · consumes the four URL-error params set by
// peer-chat server actions (message_error · sticker_error ·
// upload_error · delete_error) and renders one calm inline banner.
//
// Approved UX policy · 2026-10-28:
//   · Inline banner · never toast-only.
//   · Calm, actionable copy · explains what failed and what to do next.
//   · Blocking errors (contacts_only · not_allowed · too_late) stay
//     visible until the user acts or navigates away · no Dismiss.
//   · Non-blocking errors (send_failed · upload_error=failed etc.)
//     may be dismissed with a plain Link back to the base chat URL
//     (strips the error param · zero JS required).
//   · No Retry button today · the state needed to retry (composer
//     text, attached file, open modal) is lost across the redirect ·
//     user retries naturally by re-performing the action. Adding a
//     Retry affordance would require pre-redirect state preservation
//     (follow-up work · unauthorised here).
//   · role="alert" on blocking errors · role="status" on dismissible
//     errors · aria-live polite · keyboard-reachable dismiss link.
//
// Server component · reads params directly · no client state. The
// peer page mounts this at the top of the chat scrollable area.
//
// Known error contracts (sanitised at the setter · see _actions.ts):
//   · message_error  = contacts_only | send_failed | e2e_required
//   · sticker_error  = contacts_only | send_failed
//   · upload_error   = too_large | unsupported_type | failed
//   · delete_error   = not_found | not_allowed | too_late | failed
//
// Unknown enum values fall through to the generic failed-copy ·
// the banner never renders raw server error strings.
//
// Owner-authorised 2026-11-17 R3 · e2e_required added when
// sendPeerMessageAction refuses a plaintext body for a non-NEX1 peer.
// The device-only encrypted send path (Bridge 76) must handle the
// message; if it couldn't attach or was bypassed the user sees this.

import * as React from "react";
import Link from "next/link";

const KNOWN_MESSAGE_ERRORS = ["contacts_only", "send_failed", "e2e_required"] as const;
const KNOWN_STICKER_ERRORS = ["contacts_only", "send_failed"] as const;
const KNOWN_UPLOAD_ERRORS = ["too_large", "unsupported_type", "failed"] as const;
const KNOWN_DELETE_ERRORS = ["not_found", "not_allowed", "too_late", "failed"] as const;

interface ChatErrorBannerProps {
  readonly peerAccountId: string;
  readonly peerDisplayName: string;
  readonly messageError: string | null | undefined;
  readonly stickerError: string | null | undefined;
  readonly uploadError: string | null | undefined;
  readonly deleteError: string | null | undefined;
}

interface BannerContent {
  readonly severity: "blocking" | "non_blocking";
  readonly title: string;
  readonly body: string;
  /** Stage A · owner-authorised 2026-11-03 · when "retry", the
   *  banner renders a secondary CTA that dispatches a window event
   *  the composer picks up to reopen its attach modal. Non-upload
   *  errors omit this field · existing Dismiss-only UX preserved. */
  readonly action?: "retry";
}

function narrow<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
): T | "failed" | null {
  if (!value) return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : "failed";
}

function peerLabel(name: string): string {
  // First-name only on free-tier chat header (sealed 2026-09-27 ·
  // page.tsx:823). Keep the banner consistent so copy doesn't leak a
  // longer-than-displayed identity.
  return name.split(/\s+/)[0] ?? name;
}

function copyForMessage(code: ReturnType<typeof narrow>, peer: string): BannerContent | null {
  if (!code) return null;
  if (code === "contacts_only") {
    return {
      severity: "blocking",
      title: "Message not sent",
      body: `${peer} only accepts messages from their contacts. Send a connection request first, then try again.`,
    };
  }
  if (code === "e2e_required") {
    // Owner-authorised 2026-11-17 R3 · the server refused a plaintext
    // body because the encrypted send path didn't fire or ${peer}'s
    // device key wasn't ready. Calm honest copy · no retry affordance
    // because the state needed to re-encrypt lives in the composer.
    return {
      severity: "non_blocking",
      title: "Message didn't send",
      body: `Encryption is required for private chat. ${peer}'s device may not be ready yet, or your message couldn't be encrypted. Open the chat again and try sending.`,
    };
  }
  // send_failed · failed · unknown fallback
  return {
    severity: "non_blocking",
    title: "Message didn't send",
    body: "Something went wrong on our side. Your message wasn't delivered. Try sending it again.",
  };
}

function copyForSticker(code: ReturnType<typeof narrow>, peer: string): BannerContent | null {
  if (!code) return null;
  if (code === "contacts_only") {
    return {
      severity: "blocking",
      title: "Sticker not sent",
      body: `${peer} only accepts messages from their contacts. Send a connection request first, then try again.`,
    };
  }
  return {
    severity: "non_blocking",
    title: "Sticker didn't send",
    body: "Something went wrong on our side. The sticker wasn't delivered. Try tapping it again.",
  };
}

function copyForUpload(code: ReturnType<typeof narrow>): BannerContent | null {
  if (!code) return null;
  if (code === "too_large") {
    return {
      severity: "non_blocking",
      title: "File too large",
      body: "That file is bigger than the chat limit. Pick a smaller version and try again.",
      // Stage A · owner-authorised 2026-11-03 · retryable upload
      // errors surface a "Try again" affordance that reopens the
      // attach modal via the composer's `nex-peer-upload-retry`
      // event listener.
      action: "retry",
    };
  }
  if (code === "unsupported_type") {
    return {
      severity: "non_blocking",
      title: "File type not supported",
      // Stage A · copy updated to cover documents now that the
      // paperclip + Document tile route arbitrary files through
      // the plaintext upload path.
      body: "This chat accepts photos, videos, voice notes, and documents. Pick a different file and try again.",
      action: "retry",
    };
  }
  return {
    severity: "non_blocking",
    title: "Upload didn't finish",
    body: "The file didn't finish uploading. Check your connection and try again.",
    action: "retry",
  };
}

function copyForDelete(code: ReturnType<typeof narrow>): BannerContent | null {
  if (!code) return null;
  if (code === "not_allowed") {
    return {
      severity: "blocking",
      title: "Can't delete this message",
      body: "Only the person who sent a message can retract it. The message is still visible to both of you.",
    };
  }
  if (code === "too_late") {
    return {
      severity: "blocking",
      title: "Delete window has passed",
      body: "You can retract a message within an hour of sending it. After that, it stays in the chat.",
    };
  }
  if (code === "not_found") {
    return {
      severity: "non_blocking",
      title: "Message already gone",
      body: "That message isn't in the chat anymore. It may have already been retracted.",
    };
  }
  return {
    severity: "non_blocking",
    title: "Delete didn't complete",
    body: "Something went wrong on our side. The message wasn't retracted. Open it again and try.",
  };
}

const C = {
  bg: "rgba(10, 20, 36, 0.86)",
  border: "rgba(0, 175, 255, 0.42)",
  borderBlocking: "rgba(255, 115, 95, 0.55)",
  title: "#F2F5F8",
  body: "#B9CBE2",
  dismiss: "#8BA9D1",
  dismissHover: "#F2F5F8",
};

/** Reads the four URL-error params the chat server actions set,
 *  renders one inline banner at the top of the chat body. Returns
 *  null when no error param is present. */
export function ChatErrorBanner({
  peerAccountId,
  peerDisplayName,
  messageError,
  stickerError,
  uploadError,
  deleteError,
}: ChatErrorBannerProps): React.JSX.Element | null {
  const peer = peerLabel(peerDisplayName);
  const content: BannerContent | null =
    copyForMessage(narrow(messageError, KNOWN_MESSAGE_ERRORS), peer) ??
    copyForSticker(narrow(stickerError, KNOWN_STICKER_ERRORS), peer) ??
    copyForUpload(narrow(uploadError, KNOWN_UPLOAD_ERRORS)) ??
    copyForDelete(narrow(deleteError, KNOWN_DELETE_ERRORS));

  if (!content) return null;

  const isBlocking = content.severity === "blocking";
  const baseHref = `/nex-native/chat/peer/${peerAccountId}`;

  return (
    <div
      // alert for blocking (demands attention) · status for dismissible
      role={isBlocking ? "alert" : "status"}
      aria-live="polite"
      data-nex-chat-error-banner={content.severity}
      style={{
        position: "sticky",
        top: 8,
        zIndex: 24,
        margin: "8px 12px 0",
        padding: "10px 12px",
        background: C.bg,
        border: `1px solid ${isBlocking ? C.borderBlocking : C.border}`,
        borderRadius: 10,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        boxShadow: "0 6px 20px rgba(0, 0, 0, 0.32)",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.title,
            letterSpacing: "0.01em",
            marginBottom: 2,
          }}
        >
          {content.title}
        </div>
        <div style={{ fontSize: 12, color: C.body, lineHeight: 1.4 }}>
          {content.body}
        </div>
      </div>
      {!isBlocking && (
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 1,
          }}
        >
          {content.action === "retry" && (
            <Link
              href={baseHref}
              replace
              aria-label="Try the upload again"
              data-nex-chat-error-retry
              onClick={(e) => {
                // Dismiss the URL state first (Next replaces), then
                // dispatch a window event the composer picks up to
                // reopen its attach modal. Fire-and-forget · if the
                // composer isn't mounted the event is harmless.
                if (typeof window !== "undefined") {
                  // The <Link replace> navigates in the next tick, so
                  // dispatching here lands AFTER the URL settles and
                  // the composer re-reads sp.upload_error as null.
                  // requestAnimationFrame gives Next a frame to flush.
                  const w = window;
                  w.requestAnimationFrame(() => {
                    w.dispatchEvent(new CustomEvent("nex-peer-upload-retry"));
                  });
                }
                // Don't preventDefault · let <Link replace> do its job
                // of clearing the ?upload_error param from the URL.
                void e;
              }}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.title,
                textDecoration: "none",
                padding: "4px 10px",
                borderRadius: 999,
                lineHeight: 1,
                background: "#FF7200",
                border: "1px solid rgba(0, 0, 0, 0.35)",
                boxShadow: "0 2px 6px rgba(255, 114, 0, 0.45)",
              }}
            >
              Try again
            </Link>
          )}
          <Link
            href={baseHref}
            replace
            aria-label="Dismiss notice"
            data-nex-chat-error-dismiss
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.dismiss,
              textDecoration: "none",
              padding: "4px 6px",
              borderRadius: 6,
              lineHeight: 1,
            }}
          >
            Dismiss
          </Link>
        </div>
      )}
    </div>
  );
}
