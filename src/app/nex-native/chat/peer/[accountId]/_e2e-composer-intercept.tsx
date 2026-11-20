"use client";

// src/app/nex-native/chat/peer/[accountId]/_e2e-composer-intercept.tsx
//
// Bridge 76 · Intercept composer submits and route them through the
// encrypted path when both parties have device keys.
// -----------------------------------------------------------------
// Attaches a capture-phase `submit` listener on the form containing
// the composer textarea (marked with `data-nex-composer-textarea`).
// When the form is submitted:
//   · If E2E is ready (peer has ≥ 1 device key AND we have one),
//     prevent the default Server-Action submit, encrypt client-side,
//     POST to /api/nex-native/peer-message/encrypted, then reload the
//     chat via router.refresh().
//   · If the peer or self has no device key, the encrypted path is
//     impossible. Bridge 90 · SHOW A CONFIRMATION MODAL before
//     downgrading to plaintext. Previously we silently fell back to
//     the plaintext server action, which contradicted the privacy
//     pledge (users believed their message was encrypted when it
//     wasn't). Now the user gets an explicit prompt: Cancel keeps
//     the message in the composer, Send anyway ships plaintext with
//     eyes open.
//
// Attachments (image / video / voice) still route through the
// plaintext path in v1 — encrypting binary payloads through the same
// pipeline is a follow-up. The intercept detects an attachment on the
// URL and steps aside so nothing breaks.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  sendEncryptedPeerMessage,
} from "@/lib/nex-native/crypto/encrypted-send";
import {
  readEncryptedAttachmentKey,
  clearEncryptedAttachmentKey,
} from "@/lib/nex-native/crypto/encrypted-attachment-stash";
// Owner-authorised 2026-11-14 · Vault Privacy Completion Pass.
// When the viewer has vaulted this conversation AND the Vault is
// locked, the intercept blocks outbound send so no new plaintext or
// ciphertext is minted from a locked tab. Defense in depth · the
// surface-level gate overlay also prevents interaction.
import { useVaultSession } from "@/lib/nex-native/vault/client/vault-session";

const ATTACH_MAX_ATTEMPTS = 5;
const ATTACH_INTERVAL_MS = 200;

export interface E2eComposerInterceptProps {
  conversationId: string;
  peerAccountId: string;
  selfAccountId: string;
  /** Skip entirely for NEX1 (no E2E for support chat per doctrine). */
  disabled?: boolean;
  /** Owner-authorised 2026-11-14 · when true, the viewer has vaulted
   *  this conversation · the intercept gates send on the Vault being
   *  unlocked in this tab. Locked sends are preventDefault()-ed. */
  isVaultedForViewer?: boolean;
}

export function E2eComposerIntercept(
  props: E2eComposerInterceptProps,
): React.JSX.Element | null {
  const router = useRouter();
  const { unlocked: vaultUnlocked } = useVaultSession();
  const vaultGated = !!props.isVaultedForViewer && !vaultUnlocked;
  const vaultGatedRef = React.useRef(vaultGated);
  React.useEffect(() => {
    vaultGatedRef.current = vaultGated;
  }, [vaultGated]);
  const [status, setStatus] = React.useState<
    "idle" | "sending" | "fallback" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [e2eReady, setE2eReady] = React.useState<boolean | null>(null);
  // Bridge 90 · when the encrypted path is unavailable, we hold the
  // form here and prompt the user to confirm before downgrading to
  // plaintext. Cancel clears it (message stays in composer) · Confirm
  // triggers the plaintext server action (see fallbackFormRef below).
  const [fallbackPrompt, setFallbackPrompt] = React.useState<
    | null
    | { reason: "no_peer_devices" | "no_self_devices" }
  >(null);
  const fallbackFormRef = React.useRef<HTMLFormElement | null>(null);
  const onSubmitRef = React.useRef<((e: SubmitEvent) => void) | null>(null);

  React.useEffect(() => {
    if (props.disabled) return;
    let attached: HTMLFormElement | null = null;
    let attempt = 0;

    const onSubmit = (evt: SubmitEvent) => {
      const form = evt.currentTarget as HTMLFormElement | null;
      if (!form) return;

      // Owner-authorised 2026-11-14 · Vault Privacy Completion Pass.
      // Halt any submit from a vault-locked tab. The surface-level
      // gate overlay already covers the composer visually; this is
      // defense in depth against programmatic submits (test harnesses,
      // assistive tech, keyboard-driven forms).
      if (vaultGatedRef.current) {
        evt.preventDefault();
        evt.stopImmediatePropagation();
        return;
      }

      const fd = new FormData(form);
      const bodyText = String(fd.get("body") ?? "").trim();
      const attachmentUrl = String(fd.get("attachment_url") ?? "").trim() || null;
      // P1.T05 2026-11-13 · encrypted uploads now carry a stable
      // storage_path (not a URL). Read both so legacy stashes keyed
      // by URL still resolve.
      const attachmentPath = String(fd.get("attachment_path") ?? "").trim() || null;
      const attachmentType = String(fd.get("attachment_type") ?? "").trim() || null;
      const attachmentEncrypted = String(fd.get("attachment_encrypted") ?? "") === "1";

      // Bridge 88 · If the form has a plaintext attachment (no
      // encrypted flag), we can't E2E-send it without re-uploading ·
      // defer to the plaintext path so binary bytes still ship.
      if (attachmentUrl && !attachmentEncrypted) return;

      // Nothing to send · defer.
      if (!bodyText && !attachmentUrl && !attachmentPath) return;

      // Bridge 88 · pull the stashed content key if this is an
      // encrypted attachment · falls back to plaintext form if the
      // stash is missing (tab expired / user cleared sessionStorage).
      let encryptedAttachment = null as null | {
        storageUrl?: string;
        storagePath: string;
        contentType: string;
        sizeBytes: number;
        contentKey: Uint8Array;
        contentNonce: Uint8Array;
        // P1.T04 Phase 3 · 2026-11-13 · "document" now flows through
        // the same encrypted send path as media. The stash carries
        // the encrypted filename for document kind · the composer
        // intercept passes it through unchanged.
        kind: "image" | "video" | "audio" | "document";
        /** P1.T04 Phase 3 · optional · documents carry filename
         *  ciphertext here · the envelope builder stuffs it in. */
        encryptedFilename?: Uint8Array;
        filenameNonce?: Uint8Array;
      };
      if (attachmentEncrypted) {
        // P1.T05 · prefer path (sealed new identifier) · fall back to
        // URL for stash records written before the key-rename.
        const stashKey = attachmentPath ?? attachmentUrl;
        if (!stashKey) return;
        const stashed = readEncryptedAttachmentKey(stashKey);
        if (!stashed) return; // fall through to plaintext form (unlikely path)
        encryptedAttachment = {
          ...(attachmentUrl ? { storageUrl: attachmentUrl } : {}),
          storagePath: attachmentPath ?? attachmentUrl ?? "",
          contentType: stashed.contentType,
          sizeBytes: stashed.sizeBytes,
          contentKey: new Uint8Array(stashed.contentKey),
          contentNonce: new Uint8Array(stashed.contentNonce),
          kind: stashed.kind,
          ...(stashed.encryptedFilename
            ? { encryptedFilename: new Uint8Array(stashed.encryptedFilename) }
            : {}),
          ...(stashed.filenameNonce
            ? { filenameNonce: new Uint8Array(stashed.filenameNonce) }
            : {}),
        };
      }

      // Speculative: intercept, try encrypted send; on any signal that
      // E2E isn't available fall back to the plaintext path by
      // re-submitting the form programmatically.
      evt.preventDefault();
      evt.stopImmediatePropagation();
      setStatus("sending");
      setErrorMsg(null);

      const replyToId = (fd.get("reply_to_id") as string | null) || null;

      void (async () => {
        const outcome = await sendEncryptedPeerMessage({
          conversationId: props.conversationId,
          peerAccountId: props.peerAccountId,
          selfAccountId: props.selfAccountId,
          plaintext: bodyText || (encryptedAttachment ? "" : bodyText),
          replyToId,
          encryptedAttachment,
        });
        if (outcome.ok) {
          setStatus("idle");
          setE2eReady(true);
          // Owner-visible bug 2026-11-13 · the composer is now wrapped
          // in a custom NexInput · the marker landed on a non-textarea
          // host element, so Object.getOwnPropertyDescriptor(
          // HTMLTextAreaElement.prototype, "value").set.call(host, "")
          // threw TypeError: Illegal invocation AFTER the encrypted
          // POST had already succeeded, which the dev-server logged as
          // unhandledRejection. Narrow the clear to real native text
          // controls · when the marker is on a custom host we just
          // skip (NexInput owns its own value state and clears via
          // the native InputEvent that still dispatches below).
          const el = form.querySelector(
            "[data-nex-composer-textarea]",
          );
          const nativeField =
            el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement
              ? el
              : null;
          if (nativeField) {
            const proto =
              nativeField instanceof HTMLTextAreaElement
                ? HTMLTextAreaElement.prototype
                : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
            try {
              setter?.call(nativeField, "");
            } catch {
              // Last-resort fallback · some custom descriptors may
              // still reject · assign directly.
              nativeField.value = "";
            }
            nativeField.dispatchEvent(new Event("input", { bubbles: true }));
          } else if (el) {
            // Custom composer host · dispatch the input event anyway
            // so controlled components tied to the marker react.
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }
          // Bridge 88 · clear the sessionStorage stash for this
          // attachment · the content key is no longer needed once
          // the wrapped copies are on the wire, and holding it in
          // sessionStorage past send is a small leak surface.
          if (encryptedAttachment) {
            // P1.T05 2026-11-13 · stash key is storage_path for new
            // uploads · fall back to storage_url for legacy stashes
            // written before the rename.
            clearEncryptedAttachmentKey(
              encryptedAttachment.storagePath || encryptedAttachment.storageUrl || "",
            );
            // Also clear the URL query state so a browser back doesn't
            // re-attach the ciphertext.
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, "", cleanUrl);
          }
          // Bring the conversation back from the server so the new
          // (encrypted) row lands in the message list.
          router.refresh();
          return;
        }
        if (outcome.error === "no_peer_devices" || outcome.error === "no_self_devices") {
          // Bridge 90 · NO silent fallback. Stash the form ref and
          // show a confirmation modal · user chooses Cancel (message
          // stays in composer) or Send anyway (plaintext ships with
          // explicit user consent).
          setStatus("idle");
          setE2eReady(false);
          fallbackFormRef.current = form;
          setFallbackPrompt({ reason: outcome.error });
          return;
        }
        setStatus("error");
        setErrorMsg(outcome.message ?? String(outcome.error));
      })();
    };

    onSubmitRef.current = onSubmit;

    const tryAttach = () => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        "[data-nex-composer-textarea]",
      );
      const form = textarea?.form ?? null;
      if (form) {
        attached = form;
        form.addEventListener("submit", onSubmit, true);
        return;
      }
      attempt += 1;
      if (attempt < ATTACH_MAX_ATTEMPTS) {
        setTimeout(tryAttach, ATTACH_INTERVAL_MS);
      }
    };
    tryAttach();

    return () => {
      if (attached) attached.removeEventListener("submit", onSubmit, true);
    };
  }, [
    props.conversationId,
    props.peerAccountId,
    props.selfAccountId,
    props.disabled,
    router,
  ]);

  if (props.disabled) return null;

  const cancelFallback = () => {
    fallbackFormRef.current = null;
    setFallbackPrompt(null);
  };
  // Owner-authorised 2026-11-17 R3 · plaintext fallback RETIRED.
  // The modal used to offer "Send anyway" which would detach the
  // capture listener and call form.requestSubmit() to ship the body
  // through sendPeerMessageAction. Under the sealed device-only E2E
  // doctrine that path is now server-side-refused too (see the
  // body/NEX1 check in _actions.ts). This handler is retained only
  // as a dismiss shim so any stale subscribers still get a clean
  // close · it never writes plaintext. The modal UI below no longer
  // renders a "Send anyway" button.
  const dismissFallback = () => {
    fallbackFormRef.current = null;
    setFallbackPrompt(null);
  };

  return (
    <>
      {/* Status chip · surfaces sending / error / E2E-active / fallback
          states. Tucked above the composer, small footprint. Bridge
          90 · "fallback" chip briefly flashes "⚠ Standard message"
          when the user confirmed a plaintext send, so the state
          transition is visible even though the page will re-render
          after the server-action redirect. */}
      {(status === "sending" || status === "error" || status === "fallback" || e2eReady === true) && (
        <StatusChip
          state={
            status === "error" ? "error"
            : status === "sending" ? "sending"
            : status === "fallback" ? "standard"
            : "on"
          }
          errorMsg={errorMsg}
        />
      )}
      {/* Bridge 90 · plaintext-fallback confirmation modal. Replaces
          the silent downgrade that used to fire when either party had
          no device key. Users now know when they're leaving E2E. */}
      {fallbackPrompt && (
        <FallbackConfirmModal
          reason={fallbackPrompt.reason}
          onCancel={cancelFallback}
          onDismiss={dismissFallback}
        />
      )}
    </>
  );
}

function FallbackConfirmModal({
  reason,
  onCancel,
  onDismiss,
}: {
  reason: "no_peer_devices" | "no_self_devices";
  onCancel: () => void;
  // Owner-authorised 2026-11-17 R3 · plaintext fallback retired. The
  // modal is now dismiss-only · no path exists to ship plaintext from
  // this surface. The handler is passed in so parent state can clear.
  onDismiss: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const headline =
    reason === "no_peer_devices"
      ? "Secure chat isn't available yet"
      : "This device isn't ready for secure chat";
  // Owner-authorised 2026-11-17 R3 · copy updated to reflect that
  // plaintext fallback no longer exists on this surface. Private peer
  // chat is end-to-end encrypted or it does not send.
  const body =
    reason === "no_peer_devices"
      ? "This contact hasn't opened NEX on any device yet, so we can't encrypt for them. Your message hasn't been sent. Try again once they've opened NEX on a device."
      : "This browser hasn't finished setting up your encryption key yet. Your message hasn't been sent. Reload the chat and try again in a moment.";

  return (
    <>
      <div
        onClick={onCancel}
        aria-label="Cancel"
        role="button"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2,9,20,0.72)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          zIndex: 1099,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={headline}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(340px, calc(100vw - 24px))",
          padding: "22px 22px 18px",
          background: "#050f1e",
          border: "1px solid rgba(255,180,0,0.55)",
          borderRadius: 20,
          zIndex: 1100,
          boxShadow: "0 24px 60px rgba(0,0,0,0.7), 0 0 40px rgba(255,180,0,0.18)",
          color: "#F4F7FC",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-grid",
              placeItems: "center",
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(255,180,0,0.14)",
              border: "1px solid rgba(255,180,0,0.45)",
              fontSize: 16,
            }}
          >
            ⚠
          </span>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>
            {headline}
          </div>
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#DDE9FA",
            lineHeight: 1.5,
            marginBottom: 18,
          }}
        >
          {body}
        </div>
        {/* Owner-authorised 2026-11-17 R3 · "Send anyway" plaintext
            button retired. The dialog is now dismiss-only. The server
            action enforces the same boundary · even if a stale client
            tried to force-submit, the server rejects. */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              onCancel();
              onDismiss();
            }}
            autoFocus
            style={{
              flex: 1,
              minHeight: 44,
              padding: "10px 14px",
              borderRadius: 10,
              background: "#FFB400",
              border: "1px solid #FFB400",
              color: "#160F00",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.02em",
              cursor: "pointer",
            }}
          >
            OK
          </button>
        </div>
      </div>
    </>
  );
}

function StatusChip({
  state,
  errorMsg,
}: {
  state: "on" | "sending" | "error" | "standard";
  errorMsg: string | null;
}): React.JSX.Element {
  const label =
    state === "sending"
      ? "🔒 Encrypting…"
      : state === "error"
        ? `🔒 Encrypt failed · ${errorMsg ?? "unknown"}`
        : state === "standard"
          ? "⚠ Standard message · not encrypted"
          : "🔒 End-to-end encrypted";
  const color =
    state === "error" ? "#FFB4C0"
    : state === "sending" ? "#DDE9FA"
    : state === "standard" ? "#FFD277"
    : "#16D66B";
  const bg =
    state === "error" ? "rgba(255,51,85,0.10)"
    : state === "sending" ? "rgba(4,20,36,0.85)"
    : state === "standard" ? "rgba(255,180,0,0.14)"
    : "rgba(22,214,107,0.10)";
  const border =
    state === "error" ? "rgba(255,51,85,0.35)"
    : state === "sending" ? "rgba(139,169,209,0.30)"
    : state === "standard" ? "rgba(255,180,0,0.45)"
    : "rgba(22,214,107,0.35)";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: "calc(env(safe-area-inset-bottom, 0) + 148px)",
        zIndex: 5,
        padding: "4px 10px",
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
        pointerEvents: "none",
        backdropFilter: "blur(6px)",
      }}
    >
      {label}
    </div>
  );
}
