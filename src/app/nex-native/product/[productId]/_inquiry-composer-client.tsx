"use client";

// src/app/nex-native/product/[productId]/_inquiry-composer-client.tsx
//
// Product-inquiry composer · centered popup on the product detail page.
// Owner-authorised 2026-11-16 · Nov-16 execution block · Stream A.
// -----------------------------------------------------------------
// Opens when the buyer taps "Ask more details about this product".
//
// Shape (matches the Nov-16 brief):
//   · product preview (image + name + price) ABOVE
//   · textarea labelled "Your question" BELOW
//   · ONE "Send" button
//   · Cancel sends NOTHING · closes
//
// On Send we POST to the sealed sendProductInquiryAction (bound to
// peerAccountId = product owner's nex_account.id) with:
//   · product_id (the current product)
//   · body       (the trimmed question · validated non-empty)
//   · send_intent_id (crypto.randomUUID for idempotency · mirrors the
//                     action's existing double-tap guard)
//
// The action creates ONE nex_peer_message carrying BOTH the product
// snapshot (attachment_meta.product) AND the question body · so both
// participants see one linked inquiry after reload (verified via the
// chat page's "latest-pin" reader which reads attachment_meta.product).
//
// Draft preservation: if the action redirects us to the chat page with
// ?product_error= · we store the typed question in sessionStorage so
// the composer can re-hydrate on return. Submission removes the draft.

import * as React from "react";
import { createPortal } from "react-dom";
import { sendProductInquiryAction } from "../../_actions";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "rgba(5, 15, 28, 0.98)";
const BORDER = "rgba(198, 161, 91, 0.25)";
const BORDER_HI = "rgba(198, 161, 91, 0.55)";

const DRAFT_PREFIX = "nex_product_inquiry_draft::";

export interface InquiryComposerProps {
  readonly productId: string;
  readonly productName: string;
  readonly productImageUrl: string | null;
  readonly priceLabel: string;
  /** nex_account.id of the shop owner — target peerAccountId for the
   *  sealed sendProductInquiryAction. */
  readonly ownerAccountId: string;
  readonly ownerDisplayName: string;
}

export function InquiryComposerButton({
  productId,
  productName,
  productImageUrl,
  priceLabel,
  ownerAccountId,
  ownerDisplayName,
}: InquiryComposerProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        data-nex-product-inquiry-trigger
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: 12,
          background: "transparent",
          color: "#FF7200",
          border: "1px solid rgba(255,114,0,0.55)",
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: "0.04em",
          cursor: "pointer",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        Ask more details about this product
      </button>
      {open ? (
        <InquiryComposerModal
          productId={productId}
          productName={productName}
          productImageUrl={productImageUrl}
          priceLabel={priceLabel}
          ownerAccountId={ownerAccountId}
          ownerDisplayName={ownerDisplayName}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function InquiryComposerModal({
  productId,
  productName,
  productImageUrl,
  priceLabel,
  ownerAccountId,
  ownerDisplayName,
  onClose,
}: InquiryComposerProps & { readonly onClose: () => void }): React.JSX.Element | null {
  const [frameNode, setFrameNode] = React.useState<HTMLElement | null>(null);
  const [question, setQuestion] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);
  const dialogRef = React.useRef<HTMLFormElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  // send_intent_id is stable for the lifetime of this open · double-
  // clicks on Send submit the same id so the action dedupes.
  const sendIntentId = React.useMemo<string>(() => {
    try {
      if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
      }
    } catch {
      /* fallthrough */
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }, []);
  const draftKey = `${DRAFT_PREFIX}${productId}`;

  // Portal target · the .nex-native-frame so the backdrop stays
  // inside the phone shell on desktop. Falls back to document.body.
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const frame = document.querySelector<HTMLElement>(".nex-native-frame");
    setFrameNode(frame ?? document.body);
  }, []);

  // Restore draft (if present from a previous failed send).
  React.useEffect(() => {
    try {
      const prior = window.sessionStorage.getItem(draftKey);
      if (prior && prior.trim().length > 0) setQuestion(prior);
    } catch {
      /* session storage unavailable · ignore */
    }
  }, [draftKey]);

  // Mount lifecycle · scroll lock · focus trap · focus return.
  React.useEffect(() => {
    previouslyFocused.current =
      (document.activeElement as HTMLElement | null) ?? null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 20);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused.current) {
        try {
          previouslyFocused.current.focus();
        } catch {
          /* ignore */
        }
      }
    };
  }, [onClose]);

  function persistDraft(next: string) {
    try {
      if (next.trim().length > 0) {
        window.sessionStorage.setItem(draftKey, next);
      } else {
        window.sessionStorage.removeItem(draftKey);
      }
    } catch {
      /* ignore */
    }
  }

  function clearDraft() {
    try {
      window.sessionStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const trimmed = question.trim();
    if (trimmed.length === 0) {
      setError("Please type a short question before sending.");
      textareaRef.current?.focus();
      return;
    }
    setError(null);
    setSubmitting(true);

    const fd = new FormData();
    fd.set("product_id", productId);
    fd.set("intent", "ask");
    fd.set("body", trimmed);
    fd.set("send_intent_id", sendIntentId);
    // qty stays default 1 for an ask-for-info inquiry.

    try {
      // Server action throws a NEXT_REDIRECT on success · we route the
      // client-side navigation ourselves so Next.js picks up the
      // redirect cleanly.
      await sendProductInquiryAction(ownerAccountId, fd);
      // Normal path · unreachable because the action redirects. Kept
      // for defence-in-depth: clear the draft and dismiss.
      clearDraft();
      onClose();
    } catch (err) {
      const digest = (err as { digest?: string } | undefined)?.digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
        // Successful send · action is routing us to the chat page.
        // Clear the draft so a future open starts clean.
        clearDraft();
        // Let Next consume the redirect by rethrowing.
        throw err;
      }
      console.warn("[product-inquiry-composer] send failed", err);
      setError(
        "Send failed · your question stays saved. Please try again in a moment.",
      );
      setSubmitting(false);
    }
  }

  if (!frameNode) return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-product-inquiry-title"
      data-nex-product-inquiry-modal
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 280,
        display: "grid",
        placeItems: "center",
        padding: 12,
      }}
    >
      <div
        aria-hidden
        data-nex-product-inquiry-backdrop
        onClick={() => {
          if (submitting) return;
          onClose();
        }}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(2, 6, 14, 0.78)",
          backdropFilter: "blur(2px)",
        }}
      />
      <form
        onSubmit={onSubmit}
        ref={dialogRef}
        style={{
          position: "relative",
          width: "min(100%, 320px)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 14,
          background: SURFACE,
          color: CREAM,
          border: `1px solid ${BORDER_HI}`,
          borderRadius: 18,
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.55)",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2
            id="nex-product-inquiry-title"
            style={{
              margin: 0,
              flex: 1,
              fontSize: 14,
              fontWeight: 900,
              color: GOLD,
              letterSpacing: "-0.01em",
            }}
          >
            Ask the shop a question
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            disabled={submitting}
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: "transparent",
              border: `1px solid ${BORDER}`,
              color: CREAM,
              fontSize: 14,
              lineHeight: 1,
              cursor: submitting ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            ×
          </button>
        </header>

        {/* Product preview · image + name + price */}
        <div
          data-nex-product-inquiry-preview
          style={{
            display: "flex",
            gap: 10,
            padding: 10,
            background: "rgba(5, 15, 28, 0.6)",
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
          }}
        >
          <div
            aria-hidden
            style={{
              width: 56,
              height: 56,
              borderRadius: 10,
              backgroundImage: productImageUrl
                ? `url(${productImageUrl})`
                : undefined,
              background: productImageUrl
                ? undefined
                : "linear-gradient(135deg, rgba(198,161,91,0.22), rgba(5,15,28,0.9))",
              backgroundSize: "cover",
              backgroundPosition: "center",
              border: `1px solid ${BORDER}`,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: CREAM,
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                lineHeight: 1.25,
              }}
            >
              {productName}
            </div>
            <div style={{ fontSize: 12, color: GOLD, fontWeight: 900 }}>
              {priceLabel}
            </div>
            <div
              style={{
                fontSize: 10,
                color: INK_MUTED,
                marginTop: 2,
              }}
            >
              Reply arrives in your NEX chat with {ownerDisplayName}.
            </div>
          </div>
        </div>

        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontSize: 11,
            color: INK_DIM,
            fontWeight: 700,
            letterSpacing: "0.02em",
          }}
        >
          Your question
          <textarea
            ref={textareaRef}
            value={question}
            onChange={(e) => {
              const next = e.target.value;
              setQuestion(next);
              persistDraft(next);
              if (error) setError(null);
            }}
            placeholder="e.g. Is this still in stock? Can you deliver to Jakarta Pusat?"
            data-nex-product-inquiry-textarea
            maxLength={1000}
            rows={4}
            aria-required="true"
            style={{
              resize: "vertical",
              padding: "8px 10px",
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              background: "rgba(0, 0, 0, 0.35)",
              color: CREAM,
              fontSize: 12,
              fontFamily: "inherit",
              outline: "none",
              lineHeight: 1.5,
            }}
          />
        </label>

        {error ? (
          <p
            data-nex-product-inquiry-error
            role="alert"
            style={{
              margin: 0,
              fontSize: 11,
              color: "#FF6B6B",
            }}
          >
            {error}
          </p>
        ) : null}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              background: "transparent",
              color: INK_DIM,
              border: `1px solid ${BORDER}`,
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: "0.04em",
              cursor: submitting ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            data-nex-product-inquiry-send
            disabled={submitting}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              background: "#FF7200",
              color: "#0B0F1A",
              border: "none",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: "0.06em",
              cursor: submitting ? "wait" : "pointer",
              fontFamily: "inherit",
              opacity: submitting ? 0.75 : 1,
              boxShadow: "0 8px 18px rgba(255, 114, 0, 0.35)",
            }}
          >
            {submitting ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );

  return createPortal(content, frameNode);
}
