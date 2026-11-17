"use client";

// src/components/nex-native/reviews/ReviewPostPopup.tsx
//
// NEX · Review-demo · Post popup.
// Owner-authorised 2026-11-16 · MOCK-ONLY checkpoint.
// -----------------------------------------------------------------
// Centered modal · product thumb + name + average · 1..5 star
// picker (tap to set) · 500-char textarea · Post + Cancel. Post is
// disabled until stars are selected. On submit calls the store's
// `postOrUpdate` (idempotent per user per product) and closes.

import * as React from "react";
import { createPortal } from "react-dom";
import {
  usePostReview,
  useProductReviewSummary,
  useMyReviewFor,
} from "@/lib/nex-native/reviews/review-store-provider";

const ORANGE = "#FF7A00";
const INK = "#1A1F2B";
const INK_DIM = "#5F6773";
const STAR_GOLD = "#F6A51A";
const STAR_OFF = "#E5E7EB";
const PANEL_BG = "#FFFFFF";
const BACKDROP = "rgba(10, 20, 30, 0.55)";

const MAX_BODY = 500;

interface ReviewPostPopupProps {
  readonly open: boolean;
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly thumbnailUrl: string;
  };
  readonly onClose: () => void;
}

export function ReviewPostPopup({
  open,
  product,
  onClose,
}: ReviewPostPopupProps): React.JSX.Element | null {
  const post = usePostReview();
  const mine = useMyReviewFor(product.id);
  const summary = useProductReviewSummary(product.id);
  const [frameNode, setFrameNode] = React.useState<HTMLElement | null>(null);
  const [stars, setStars] = React.useState<number>(mine?.stars ?? 0);
  const [body, setBody] = React.useState<string>(mine?.body ?? "");
  const [posted, setPosted] = React.useState<boolean>(false);

  // Reset when the popup is opened for a different product / or re-opened.
  React.useEffect(() => {
    if (!open) return;
    setStars(mine?.stars ?? 0);
    setBody(mine?.body ?? "");
    setPosted(false);
  }, [open, mine, product.id]);

  React.useEffect(() => {
    if (!open) return;
    if (typeof document !== "undefined") {
      const frame = document.querySelector<HTMLElement>(".nex-native-frame");
      setFrameNode(frame ?? document.body);
    }
  }, [open]);

  // Escape closes
  React.useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open || !frameNode) return null;

  const canPost = stars >= 1 && stars <= 5;
  const remaining = MAX_BODY - body.length;

  function handlePost(): void {
    if (!canPost) return;
    post({ productId: product.id, stars, body: body.trim() });
    setPosted(true);
    // Short delay so the user sees the "Posted" state before close.
    setTimeout(onClose, 650);
  }

  const overlay = (
    <>
      <button
        type="button"
        aria-label="Close review popup"
        onClick={onClose}
        data-nex-review-post-backdrop
        style={{
          position: "absolute",
          inset: 0,
          background: BACKDROP,
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          border: "none",
          padding: 0,
          cursor: "pointer",
          zIndex: 80,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Write a review for ${product.name}`}
        data-nex-review-post-popup
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(320px, calc(100% - 32px))",
          maxWidth: 360,
          background: PANEL_BG,
          borderRadius: 16,
          boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
          padding: 18,
          zIndex: 81,
          color: INK,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <img
            src={product.thumbnailUrl}
            alt=""
            width={48}
            height={48}
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              objectFit: "cover",
              flexShrink: 0,
              border: "1px solid #EEE",
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {product.name}
            </div>
            <div
              style={{
                fontSize: 11,
                color: INK_DIM,
                marginTop: 3,
                fontWeight: 600,
              }}
            >
              {summary.count > 0
                ? `${summary.averageScore.toFixed(1)} ★ · ${summary.count} review${
                    summary.count === 1 ? "" : "s"
                  }`
                : "No reviews yet · be the first"}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: "transparent",
              border: "1px solid #E5E7EB",
              color: INK,
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </header>

        {/* Star picker · 44px tap targets */}
        <div
          data-nex-review-post-stars
          role="radiogroup"
          aria-label="Star rating"
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 4,
            marginBottom: 12,
          }}
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const active = n <= stars;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={stars === n}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                onClick={() => setStars(n)}
                data-nex-review-post-star={n}
                style={{
                  width: 44,
                  height: 44,
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: active ? STAR_GOLD : STAR_OFF,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <StarGlyph size={30} />
              </button>
            );
          })}
        </div>

        <textarea
          data-nex-review-post-body
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
          placeholder="Share what you liked (optional)…"
          rows={4}
          maxLength={MAX_BODY}
          style={{
            width: "100%",
            boxSizing: "border-box",
            resize: "vertical",
            padding: 10,
            borderRadius: 10,
            border: "1px solid #E5E7EB",
            background: "#FAFAFA",
            fontSize: 13,
            lineHeight: 1.45,
            color: INK,
            fontFamily: "inherit",
            minHeight: 80,
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 11,
            color: INK_DIM,
            marginTop: 4,
            marginBottom: 12,
          }}
        >
          <span>{mine ? "Editing your previous review" : "One review per product"}</span>
          <span data-nex-review-post-remaining>{remaining} left</span>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 999,
              background: "#F2F3F5",
              border: "1px solid #E5E7EB",
              color: INK,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            data-nex-review-post-submit
            onClick={handlePost}
            disabled={!canPost || posted}
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 999,
              background: canPost ? ORANGE : "#F2C498",
              border: "none",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: 14,
              cursor: canPost && !posted ? "pointer" : "default",
              opacity: posted ? 0.75 : 1,
              boxShadow: canPost ? "0 6px 14px rgba(255,122,0,0.35)" : "none",
            }}
          >
            {posted ? "Posted ✓" : mine ? "Update review" : "Post review"}
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(overlay, frameNode);
}

function StarGlyph({ size = 18 }: { size?: number }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7.3L12 17.8l-6.3 3.7 1.7-7.3L2 9.5l7.1-.6z" />
    </svg>
  );
}
