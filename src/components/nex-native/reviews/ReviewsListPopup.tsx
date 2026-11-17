"use client";

// src/components/nex-native/reviews/ReviewsListPopup.tsx
//
// NEX · Review-demo · Reviews list (landscape) popup.
// Owner-authorised 2026-11-16 · MOCK-ONLY checkpoint.
// -----------------------------------------------------------------
// Opens from the product page star row. Shows average + count +
// reviewer cards (handle · stars · body · date). Includes a
// "Leave a review" CTA that swaps into the Post popup.

import * as React from "react";
import { createPortal } from "react-dom";
import {
  useProductReviewSummary,
  useProductReviews,
} from "@/lib/nex-native/reviews/review-store-provider";
import { ReviewPostPopup } from "./ReviewPostPopup";

const ORANGE = "#FF7A00";
const INK = "#1A1F2B";
const INK_DIM = "#5F6773";
const STAR_GOLD = "#F6A51A";
const STAR_OFF = "#E5E7EB";
const PANEL_BG = "#FFFFFF";
const BACKDROP = "rgba(10, 20, 30, 0.55)";

interface ReviewsListPopupProps {
  readonly open: boolean;
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly thumbnailUrl: string;
  };
  readonly onClose: () => void;
}

export function ReviewsListPopup({
  open,
  product,
  onClose,
}: ReviewsListPopupProps): React.JSX.Element | null {
  const summary = useProductReviewSummary(product.id);
  const reviews = useProductReviews(product.id);
  const [frameNode, setFrameNode] = React.useState<HTMLElement | null>(null);
  const [postOpen, setPostOpen] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!open) return;
    if (typeof document !== "undefined") {
      const frame = document.querySelector<HTMLElement>(".nex-native-frame");
      setFrameNode(frame ?? document.body);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open || !frameNode) return null;

  const overlay = (
    <>
      <button
        type="button"
        aria-label="Close reviews"
        onClick={onClose}
        data-nex-reviews-list-backdrop
        style={{
          position: "absolute",
          inset: 0,
          background: BACKDROP,
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          border: "none",
          padding: 0,
          cursor: "pointer",
          zIndex: 70,
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Reviews for ${product.name}`}
        data-nex-reviews-list-popup
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: "82%",
          background: PANEL_BG,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          boxShadow: "0 -16px 48px rgba(0,0,0,0.3)",
          zIndex: 71,
          display: "flex",
          flexDirection: "column",
          color: INK,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {/* Grab handle */}
        <div
          aria-hidden
          style={{
            width: 42,
            height: 4,
            borderRadius: 999,
            background: "#E5E7EB",
            margin: "10px auto 2px auto",
          }}
        />
        {/* Header · average + close */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "10px 16px 8px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: INK }}>
              {summary.averageScore > 0 ? summary.averageScore.toFixed(1) : "–"}
            </span>
            <span
              aria-hidden
              style={{ display: "inline-flex", color: STAR_GOLD, gap: 1 }}
            >
              {[0, 1, 2, 3, 4].map((i) => {
                const filled = summary.averageScore - i;
                const pct = filled >= 1 ? 100 : filled <= 0 ? 0 : Math.round(filled * 100);
                return <PartialStar key={i} fillPct={pct} />;
              })}
            </span>
            <span style={{ fontSize: 12, color: INK_DIM, fontWeight: 700 }}>
              {summary.count} review{summary.count === 1 ? "" : "s"}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close reviews"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: "transparent",
              border: "1px solid #E5E7EB",
              color: INK,
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </header>

        {/* Reviews scroll area */}
        <div
          data-nex-reviews-list-scroll
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "4px 16px 10px 16px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {reviews.length === 0 ? (
            <div
              style={{
                padding: "28px 8px",
                textAlign: "center",
                color: INK_DIM,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              No reviews yet · be the first to write one.
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {reviews.map((r) => (
                <li
                  key={r.id}
                  data-nex-reviews-list-row
                  style={{
                    padding: "12px 0",
                    borderBottom: "1px solid #F1F2F4",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 800, color: INK }}>
                      {r.authorHandle}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: INK_DIM,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatShortDate(r.createdAt)}
                    </span>
                  </div>
                  <div
                    aria-hidden
                    style={{ display: "inline-flex", color: STAR_GOLD, gap: 1 }}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SolidStar key={n} filled={n <= r.stars} size={14} />
                    ))}
                  </div>
                  {r.body ? (
                    <p
                      style={{
                        margin: "6px 0 0 0",
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: INK,
                      }}
                    >
                      {r.body}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer · Leave a review */}
        <footer
          style={{
            padding: "10px 16px calc(env(safe-area-inset-bottom, 0px) + 14px) 16px",
            borderTop: "1px solid #F1F2F4",
            background: PANEL_BG,
          }}
        >
          <button
            type="button"
            data-nex-reviews-list-leave
            onClick={() => setPostOpen(true)}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 999,
              background: ORANGE,
              border: "none",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 6px 14px rgba(255,122,0,0.35)",
            }}
          >
            Leave a review
          </button>
        </footer>
      </aside>

      <ReviewPostPopup
        open={postOpen}
        product={product}
        onClose={() => setPostOpen(false)}
      />
    </>
  );

  return createPortal(overlay, frameNode);
}

function PartialStar({ fillPct }: { fillPct: number }): React.JSX.Element {
  const id = React.useId();
  const clipId = `nex-rl-star-${id}`;
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={(24 * fillPct) / 100} height="24" />
        </clipPath>
      </defs>
      <path
        d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7.3L12 17.8l-6.3 3.7 1.7-7.3L2 9.5l7.1-.6z"
        fill={STAR_OFF}
      />
      <path
        d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7.3L12 17.8l-6.3 3.7 1.7-7.3L2 9.5l7.1-.6z"
        fill={STAR_GOLD}
        clipPath={`url(#${clipId})`}
      />
    </svg>
  );
}

function SolidStar({
  filled,
  size = 14,
}: {
  filled: boolean;
  size?: number;
}): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      fill={filled ? STAR_GOLD : STAR_OFF}
    >
      <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7.3L12 17.8l-6.3 3.7 1.7-7.3L2 9.5l7.1-.6z" />
    </svg>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const deltaDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (deltaDays < 1) return "today";
  if (deltaDays < 2) return "yday";
  if (deltaDays < 7) return `${deltaDays}d ago`;
  return iso.slice(0, 10);
}
