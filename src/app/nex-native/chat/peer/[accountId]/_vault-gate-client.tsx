"use client";

// src/app/nex-native/chat/peer/[accountId]/_vault-gate-client.tsx
//
// Owner-authorised 2026-11-14 · Vault Privacy Completion Pass.
// -----------------------------------------------------------------
// UI gate for the standard peer-chat surface when the viewer has
// moved this conversation into their Vault. Enforces:
//   · while locked: no readable plaintext, no decrypted media,
//     no outbound send (composer is blocked by _e2e-composer-intercept
//     via the same useVaultSession() hook).
//   · on lock transition: scrub DOM text, revoke blob URLs, drop the
//     local plaintext cache for this conversation.
//   · on unlock transition: router.refresh() so the server re-renders
//     the ciphertext and the sealed decryptor repopulates plaintext.
//
// HONEST BOUNDARY (do not misrepresent this as a cryptographic gate):
//   Standard peer-chat ciphertext is encrypted with the recipient's
//   PER-DEVICE Curve25519 key stored in IndexedDB `nex-native-crypto >
//   device > self`. That key is NOT wrapped by the VMK. Lock Now
//   clears the VMK only. If an attacker has local access to the
//   browser profile they can still decrypt the ciphertext with the
//   device key regardless of Vault state. This gate is a UI-level
//   privacy boundary against shoulder-surfing and already-loaded
//   plaintext in memory; it is NOT a cryptographic barrier.

import * as React from "react";
import { useRouter } from "next/navigation";
import { useVaultSession } from "@/lib/nex-native/vault/client/vault-session";
import { forgetConversation } from "@/lib/nex-native/crypto/message-store";

export interface PeerChatVaultGateClientProps {
  readonly isVaultedForViewer: boolean;
  readonly conversationId: string;
}

export function PeerChatVaultGateClient(
  props: PeerChatVaultGateClientProps,
): React.JSX.Element | null {
  const { isVaultedForViewer, conversationId } = props;
  const router = useRouter();
  const { unlocked } = useVaultSession();
  const prevUnlockedRef = React.useRef<boolean>(unlocked);

  const gated = isVaultedForViewer && !unlocked;

  // Side-effect pass · runs on every transition that could flip the
  // gate on or off. On lock: scrub DOM + revoke blob URLs + drop IDB
  // plaintext cache for this conversation. On unlock: refresh so the
  // decryptor re-runs against the server's ciphertext.
  React.useEffect(() => {
    const wasUnlocked = prevUnlockedRef.current;
    prevUnlockedRef.current = unlocked;
    if (!isVaultedForViewer) return;

    if (!unlocked) {
      // LOCK PASS
      scrubRenderedPlaintext();
      revokeBlobMediaUrls();
      // Fire-and-forget · surviving failure of IDB clear does NOT
      // weaken the in-memory gate · it only means older plaintext
      // rows may still sit in IDB until the next clear.
      void forgetConversation(conversationId).catch(() => {});
      return;
    }
    // UNLOCK PASS · only refresh when the transition is lock→unlock
    // (not on initial mount when already unlocked).
    if (!wasUnlocked && unlocked) {
      try {
        router.refresh();
      } catch {
        /* no-op */
      }
    }
  }, [unlocked, isVaultedForViewer, conversationId, router]);

  // Also run a scrub pass continuously while gated, so any late-
  // arriving decryption cycle that writes plaintext between the lock
  // side-effect and the next render gets wiped. Cheap guard.
  React.useEffect(() => {
    if (!gated) return;
    const interval = window.setInterval(() => {
      scrubRenderedPlaintext();
      revokeBlobMediaUrls();
    }, 500);
    return () => window.clearInterval(interval);
  }, [gated]);

  if (!gated) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vault locked"
      data-nex-peer-chat-vault-gate
      data-nex-peer-chat-vault-gate-state="locked"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "28px 24px",
        background:
          "linear-gradient(180deg, rgba(10,12,22,0.96) 0%, rgba(10,12,22,0.98) 100%)",
        color: "#fff",
        textAlign: "center",
        gap: 18,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 64,
          height: 64,
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid rgba(255,255,255,0.16)",
          fontSize: 28,
        }}
      >
        {"\u{1F512}"}
      </div>
      <h2
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "0.01em",
        }}
      >
        Vault locked
      </h2>
      <p
        data-nex-peer-chat-vault-gate-body
        style={{
          margin: 0,
          maxWidth: 320,
          fontSize: 14,
          lineHeight: 1.5,
          color: "rgba(255,255,255,0.78)",
        }}
      >
        This conversation is in your Vault. Unlock to read messages and
        continue chatting.
      </p>
      <a
        href="/nex-native/vault"
        data-nex-peer-chat-vault-gate-unlock
        style={{
          marginTop: 6,
          padding: "12px 22px",
          borderRadius: 999,
          background: "#fff",
          color: "#0a0c16",
          fontWeight: 700,
          fontSize: 14,
          textDecoration: "none",
        }}
      >
        Unlock Vault
      </a>
    </div>
  );
}

// ── side-effect helpers ────────────────────────────────────────────

/** Replace plaintext bubble body content with the (locked) sentinel
 *  so a lurker who flipped the DOM after a lock transition sees
 *  nothing. Honest limitation: the ciphertext is still in the server
 *  render and will re-populate on router.refresh after unlock. */
function scrubRenderedPlaintext(): void {
  if (typeof document === "undefined") return;
  const scope =
    document.querySelector<HTMLElement>(
      "[data-nex-peer-chat-prototype-wrap]",
    ) ?? document.body;
  const nodes = scope.querySelectorAll<HTMLElement>("[data-nex-msg-id]");
  for (const node of Array.from(nodes)) {
    const bodyEl = node.querySelector<HTMLElement>("[data-nex-msg-body]");
    if (bodyEl) {
      bodyEl.textContent = "";
    } else {
      node.textContent = "";
    }
    node.setAttribute("data-nex-msg-encrypted", "false");
  }
}

/** Walk the chat scope for every <img>, <video>, <audio> carrying a
 *  blob: URL and revoke it so the Blob backing it can be collected.
 *  We also clear the src so the element can't re-fetch the revoked
 *  URL (browsers tolerate that but it's cleanest). */
function revokeBlobMediaUrls(): void {
  if (typeof document === "undefined") return;
  const scope =
    document.querySelector<HTMLElement>(
      "[data-nex-peer-chat-prototype-wrap]",
    ) ?? document.body;
  const selectors = [
    "img[src^='blob:']",
    "video[src^='blob:']",
    "audio[src^='blob:']",
    "source[src^='blob:']",
    "a[href^='blob:']",
  ];
  for (const sel of selectors) {
    const els = scope.querySelectorAll<HTMLElement>(sel);
    for (const el of Array.from(els)) {
      const url =
        el.getAttribute("src") ?? el.getAttribute("href") ?? "";
      if (url.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* no-op */
        }
      }
      if (el.hasAttribute("src")) el.removeAttribute("src");
      if (el.hasAttribute("href")) el.removeAttribute("href");
    }
  }
}
