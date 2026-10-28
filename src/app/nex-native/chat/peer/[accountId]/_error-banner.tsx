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
//   · message_error  = contacts_only | send_failed
//   · sticker_error  = contacts_only | send_failed
//   · upload_error   = too_large | unsupported_type | failed
//   · delete_error   = not_found | not_allowed | too_late | failed
//
// Unknown enum values fall through to the generic failed-copy ·
// the banner never renders raw server error strings.

import * as React from "react";
import Link from "next/link";

const KNOWN_MESSAGE_ERRORS = ["contacts_only", "send_failed"] as const;
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
    };
  }
  if (code === "unsupported_type") {
    return {
      severity: "non_blocking",
      title: "File type not supported",
      body: "This chat accepts photos, videos, and voice notes. Pick a different file and try again.",
    };
  }
  return {
    severity: "non_blocking",
    title: "Upload didn't finish",
    body: "The file didn't finish uploading. Check your connection and try again.",
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
        <Link
          href={baseHref}
          replace
          aria-label="Dismiss notice"
          data-nex-chat-error-dismiss
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 600,
            color: C.dismiss,
            textDecoration: "none",
            padding: "4px 6px",
            borderRadius: 6,
            lineHeight: 1,
            marginTop: 1,
          }}
        >
          Dismiss
        </Link>
      )}
    </div>
  );
}
