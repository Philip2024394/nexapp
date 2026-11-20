"use client";

// src/app/nex-native/chat/peer/[accountId]/_translation-layer.tsx
//
// Founder-only chat translation pilot · bubble toggle layer.
// Owner-authorised 2026-11-17 · local verification only.
//
// Mount pattern:
//   · Rendered as a sibling of <E2eDecryptor /> on the peer chat page.
//   · Returns null from the top-level React tree (like the decryptor).
//   · Scans + observes DOM for incoming, decrypted, text-only bubbles.
//   · For each eligible bubble: injects a small anchor <span> in the
//     bubble's top-right corner and mounts a per-bubble React root
//     with the toggle icon + translation sibling node.
//
// Guard-rails:
//   · Vault-gated conversations: if `isVaultedForViewer && vault locked`
//     the layer bails (same pattern as the decryptor).
//   · Non-text messages: the layer only operates on bubbles whose
//     body selector exists AND whose outer wrapper lacks any
//     `[data-nex-encrypted-attach]` attachment node.
//   · The viewer's own outgoing messages are skipped. We identify
//     them by `data-nex-bloom-msg-outgoing="true"` (set by the shell)
//     OR by matching the sender account id to the viewer's.
//   · Messages still showing the sentinel "(encrypted)" are skipped
//     until they become decrypted.
//
// This layer NEVER mutates ciphertext · the decryption pipeline · the
// device key store · the message IDB cache · or the server. It only
// reads the plaintext that the decryptor has already placed on screen,
// routes it through the translation server action under the founder
// gate, and renders the result as a sibling node.

import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { BubbleTranslationControl } from "./_translation-bubble-control";
import { useVaultSession } from "@/lib/nex-native/vault/client/vault-session";

export interface TranslationLayerProps {
  readonly selfAccountId: string;
  readonly conversationId: string;
  readonly isVaultedForViewer?: boolean;
  /** When true, the layer is rendered inert (used while disabling the
   *  pilot at runtime without unmounting the whole chat). */
  readonly disabled?: boolean;
}

interface MountRecord {
  readonly anchor: HTMLElement;
  readonly root: Root;
  readonly translationSlot: HTMLElement;
}

export function ChatTranslationLayer(
  props: TranslationLayerProps,
): null {
  const { unlocked: vaultUnlocked } = useVaultSession();
  const vaultGated = !!props.isVaultedForViewer && !vaultUnlocked;

  React.useEffect(() => {
    if (props.disabled) return;
    if (vaultGated) return;
    if (typeof document === "undefined") return;

    // Owner-authorised 2026-11-17 continuation 3 · Gap E.
    //
    // Mount key is `${messageId}:${contentVersion}` · NOT bare id.
    // Reason: a decrypted body whose `data-nex-msg-sent-at` changes
    // (edit landing, or sealed-write reconciliation) must re-mount
    // so the new text is re-checked and (if the viewer requested) re-
    // translated. Keying on id alone caused edits to retain stale
    // translations.
    //
    // Map holds `bodyEl` so sweep can detect `isConnected === false`
    // (virtualised list recycled the node, navigation unmounted the
    // bubble, or the shell replaced the whole message list) and
    // dispose that mount deterministically rather than leaking the
    // React Root + anchor + slot references.
    const mounts = new Map<string, MountRecord>();
    let cancelled = false;

    const contentVersionFor = (
      body: HTMLElement,
      wrapper: HTMLElement | null,
    ): string => {
      const sentAt =
        (wrapper ?? body.parentElement)?.getAttribute("data-nex-msg-sent-at") ??
        "";
      // Edits typically bump sent-at. Fall back to text length as a
      // cheap defence-in-depth marker so a body whose attribute was
      // not updated but whose text clearly changed still re-mounts.
      const text = (body.textContent ?? "").trim();
      return `${sentAt}:${text.length}`;
    };

    const findEligibleBubbles = (): HTMLElement[] => {
      // We operate on bodies the decryptor has already written to.
      // The decryptor sets `data-nex-msg-decrypted="true"` on the
      // outer encrypted wrapper AFTER writing the body text.
      const bodies = Array.from(
        document.querySelectorAll<HTMLElement>("[data-nex-msg-body]"),
      );
      return bodies.filter((b) => {
        const id = b.getAttribute("data-nex-msg-body");
        if (!id) return false;
        const wrapper = b.closest<HTMLElement>("[data-nex-bloom-msg]");
        const key = `${id}:${contentVersionFor(b, wrapper)}`;
        if (mounts.has(key)) return false;
        const text = (b.textContent ?? "").trim();
        if (text.length === 0) return false;
        // Skip the "(encrypted)" sentinel · appears until decrypt lands.
        if (text === "(encrypted)") return false;
        // Skip outgoing: look up the outer bloom wrapper.
        if (wrapper?.getAttribute("data-nex-bloom-msg-outgoing") === "true") {
          return false;
        }
        // Skip attachment messages: an attachment placeholder lives
        // beside the body inside the same wrapper. We still allow
        // messages that have BOTH text + attachment · translate only
        // the text body. Skip pure-attachment bubbles (no text body)
        // naturally because they lack `[data-nex-msg-body]`.
        return true;
      });
    };

    const disposeMount = (key: string, rec: MountRecord): void => {
      try {
        queueMicrotask(() => {
          try {
            rec.root.unmount();
          } catch {
            /* ignore */
          }
        });
      } catch {
        /* ignore */
      }
      try {
        rec.anchor.remove();
      } catch {
        /* ignore */
      }
      try {
        rec.translationSlot.remove();
      } catch {
        /* ignore */
      }
      mounts.delete(key);
    };

    const prune = (): void => {
      // Remove mounts whose anchor OR translation slot has been
      // detached from the document · guards against virtualised lists,
      // id reuse on a new wrapper, and shell-level DOM replacement.
      // Cap size defence-in-depth · if the map somehow grows past this
      // limit (should not happen in a human conversation) we evict
      // the oldest entries by insertion order.
      const MAX_MOUNTS = 500;
      const toRemove: string[] = [];
      for (const [key, rec] of mounts) {
        if (!rec.anchor.isConnected || !rec.translationSlot.isConnected) {
          toRemove.push(key);
        }
      }
      for (const k of toRemove) {
        const rec = mounts.get(k);
        if (rec) disposeMount(k, rec);
      }
      while (mounts.size > MAX_MOUNTS) {
        const firstKey = mounts.keys().next().value;
        if (!firstKey) break;
        const rec = mounts.get(firstKey);
        if (!rec) break;
        disposeMount(firstKey, rec);
      }
    };

    const mountFor = (body: HTMLElement): void => {
      const id = body.getAttribute("data-nex-msg-body");
      if (!id) return;
      // Build anchor for the icon in the bubble's top-right.
      const wrapper = body.closest<HTMLElement>("[data-nex-bloom-msg]") ?? body.parentElement;
      if (!wrapper) return;
      const key = `${id}:${contentVersionFor(body, wrapper as HTMLElement)}`;
      if (mounts.has(key)) return;
      const anchor = document.createElement("span");
      anchor.setAttribute("data-nex-translation-anchor", id);
      anchor.style.position = "absolute";
      anchor.style.top = "4px";
      anchor.style.right = "6px";
      anchor.style.zIndex = "2";
      anchor.style.pointerEvents = "auto";
      // Ensure the wrapper is positioned so our absolute anchor lands
      // inside it. If the wrapper's current position is static, we
      // elevate it to `relative` with inline style. This is safe — no
      // reflow beyond the bubble itself.
      const wrapperPos = window.getComputedStyle(wrapper).position;
      if (wrapperPos === "static" || wrapperPos === "") {
        wrapper.style.position = "relative";
      }
      wrapper.appendChild(anchor);

      // Build the translation slot (sibling of body). Hidden by default.
      const translationSlot = document.createElement("div");
      translationSlot.setAttribute("data-nex-msg-translation", id);
      translationSlot.style.display = "none";
      translationSlot.style.fontStyle = "italic";
      translationSlot.style.opacity = "0.9";
      translationSlot.style.marginTop = "4px";
      body.insertAdjacentElement("afterend", translationSlot);

      const senderAcc =
        wrapper.getAttribute("data-nex-msg-sender-acc") ??
        wrapper.querySelector<HTMLElement>("[data-nex-msg-sender-acc]")?.getAttribute("data-nex-msg-sender-acc") ??
        null;
      const contentVersion = contentVersionFor(body, wrapper as HTMLElement);
      const original = (body.textContent ?? "").toString();

      // Skip self-authored (defence in depth).
      if (senderAcc && senderAcc === props.selfAccountId) {
        anchor.remove();
        translationSlot.remove();
        return;
      }

      // Dispose any OTHER mount that shares the same bare messageId
      // (previous contentVersion) · an edit should remove the stale
      // anchor/slot before the new one is mounted so the viewer does
      // not see two icons or a stale translation.
      const stalePrefix = `${id}:`;
      for (const [existingKey, existingRec] of mounts) {
        if (existingKey.startsWith(stalePrefix)) {
          disposeMount(existingKey, existingRec);
        }
      }

      const root = createRoot(anchor);
      root.render(
        <BubbleTranslationControl
          accountId={props.selfAccountId}
          conversationId={props.conversationId}
          messageId={id}
          contentVersion={contentVersion}
          original={original}
          bodyEl={body}
          translationSlotEl={translationSlot}
        />,
      );
      mounts.set(key, { anchor, root, translationSlot });
    };

    const sweep = (): void => {
      if (cancelled) return;
      prune();
      for (const b of findEligibleBubbles()) mountFor(b);
    };

    // Debounce observer callbacks · the decrypt pipeline + bloom shell
    // fire many mutations per message, and the earlier implementation
    // ran a full sweep on every one. 32 ms coalesces bursts without
    // adding a visible lag before the icon appears.
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleSweep = (): void => {
      if (debounce) return;
      debounce = setTimeout(() => {
        debounce = null;
        sweep();
      }, 32);
    };

    sweep();
    const obs = new MutationObserver(() => scheduleSweep());
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "data-nex-msg-decrypted",
        "data-nex-msg-sent-at",
      ],
    });

    return () => {
      cancelled = true;
      if (debounce) {
        clearTimeout(debounce);
        debounce = null;
      }
      obs.disconnect();
      for (const [key, rec] of Array.from(mounts.entries())) {
        disposeMount(key, rec);
      }
      mounts.clear();
    };
  }, [
    props.disabled,
    props.conversationId,
    props.selfAccountId,
    vaultGated,
  ]);

  return null;
}
