"use client";

// src/components/nex-native/reviews/OrderPlacedNotificationRow.tsx
//
// NEX · Review-demo · Order-placed drawer row.
// Owner-authorised 2026-11-16 · MOCK-ONLY checkpoint.
// -----------------------------------------------------------------
// Renders inside the left notifications drawer when the demo flag
// is on. Collapsed · shop + item-count + total + time-ago. Tap to
// expand IN PLACE · each product shows thumb/name/qty/price and a
// per-product "Leave a review" button that opens the ReviewPostPopup.

import * as React from "react";
import Link from "next/link";
import type { OrderPlacedRecord } from "@/lib/nex-native/reviews/types";
import {
  useMyReviewFor,
  useProductReviewSummary,
} from "@/lib/nex-native/reviews/review-store-provider";
import { ReviewPostPopup } from "./ReviewPostPopup";

const INK = "var(--nex-world-primary-ink, #F2F5F8)";
const MUTED = "var(--nex-world-muted-ink, #7D9BC0)";
const ORANGE = "#FF7A00";
const CYAN = "var(--nex-world-secondary, #00AFFF)";
const PANEL_BORDER =
  "color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 18%, transparent)";
const STAR_GOLD = "#F6A51A";

interface OrderPlacedNotificationRowProps {
  readonly order: OrderPlacedRecord;
}

export function OrderPlacedNotificationRow({
  order,
}: OrderPlacedNotificationRowProps): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(false);
  const itemCount = order.items.reduce((acc, it) => acc + it.qty, 0);
  const total = order.items.reduce(
    (acc, it) => acc + it.pricePence * it.qty,
    0,
  );
  const totalLabel = formatPrice(total, order.currency);

  return (
    <div
      data-nex-order-placed-row
      data-nex-order-placed-row-expanded={expanded ? "true" : "false"}
      style={{
        padding: "10px 12px",
        borderLeft: `3px solid ${ORANGE}`,
        background: "rgba(255,122,0,0.06)",
        borderBottom: `1px solid ${PANEL_BORDER}`,
      }}
    >
      {/* Header · tap to toggle */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        data-nex-order-placed-toggle
        style={{
          display: "flex",
          width: "100%",
          alignItems: "flex-start",
          gap: 10,
          background: "transparent",
          border: "none",
          padding: 2,
          cursor: "pointer",
          color: INK,
          textAlign: "left",
          minHeight: 44,
        }}
      >
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${PANEL_BORDER}`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: ORANGE,
            fontSize: 16,
          }}
        >
          🧾
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: INK,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              Order placed · {order.shopName}
            </span>
            <span
              style={{
                fontSize: 11,
                color: MUTED,
                fontVariantNumeric: "tabular-nums",
                flexShrink: 0,
              }}
            >
              {relativeAgo(order.placedAt)}
            </span>
          </span>
          <span
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              marginTop: 2,
              fontSize: 12,
              color: MUTED,
            }}
          >
            <span>
              {itemCount} item{itemCount === 1 ? "" : "s"} · {totalLabel}
            </span>
            <span
              aria-hidden
              style={{
                color: CYAN,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: 0.4,
                textTransform: "uppercase",
              }}
            >
              {expanded ? "Hide" : "View"}
            </span>
          </span>
          <span
            data-nex-order-placed-demo-tag
            style={{
              display: "inline-block",
              marginTop: 4,
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(255,122,0,0.18)",
              color: ORANGE,
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Demo data
          </span>
        </span>
      </button>

      {expanded ? (
        <div
          data-nex-order-placed-body
          style={{
            paddingTop: 10,
            marginTop: 6,
            borderTop: `1px solid ${PANEL_BORDER}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: MUTED,
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Placed {formatFullTime(order.placedAt)}
          </div>
          <ul
            style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}
          >
            {order.items.map((it) => (
              <OrderItemRow
                key={`${order.id}:${it.productId}`}
                productId={it.productId}
                name={it.name}
                thumbnailUrl={it.thumbnailUrl}
                qty={it.qty}
                pricePence={it.pricePence}
                currency={order.currency}
              />
            ))}
          </ul>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginTop: 12,
              paddingTop: 8,
              borderTop: `1px solid ${PANEL_BORDER}`,
              fontSize: 13,
              color: INK,
              fontWeight: 700,
            }}
          >
            <span>Order total</span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 900 }}>
              {totalLabel}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface OrderItemRowProps {
  readonly productId: string;
  readonly name: string;
  readonly thumbnailUrl: string;
  readonly qty: number;
  readonly pricePence: number;
  readonly currency: string;
}

function OrderItemRow({
  productId,
  name,
  thumbnailUrl,
  qty,
  pricePence,
  currency,
}: OrderItemRowProps): React.JSX.Element {
  const [postOpen, setPostOpen] = React.useState(false);
  const mine = useMyReviewFor(productId);
  const summary = useProductReviewSummary(productId);

  return (
    <>
      <li
        data-nex-order-item-row
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <Link
          href={`/nex-native/product/${productId}?reviewDemo=1`}
          data-nex-order-item-thumb
          style={{
            flexShrink: 0,
            width: 44,
            height: 44,
            borderRadius: 8,
            overflow: "hidden",
            display: "inline-block",
            border: `1px solid ${PANEL_BORDER}`,
          }}
        >
          <img
            src={thumbnailUrl}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: INK,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: MUTED,
              marginTop: 2,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            Qty {qty} · {formatPrice(pricePence, currency)}
            {summary.count > 0 ? (
              <span style={{ marginLeft: 6 }}>
                · {summary.averageScore.toFixed(1)}★ ({summary.count})
              </span>
            ) : null}
          </div>
          <button
            type="button"
            data-nex-order-item-review
            onClick={(e) => {
              e.stopPropagation();
              setPostOpen(true);
            }}
            style={{
              marginTop: 6,
              padding: "6px 10px",
              borderRadius: 999,
              background: mine ? "transparent" : ORANGE,
              border: mine ? `1px solid ${STAR_GOLD}` : "none",
              color: mine ? STAR_GOLD : "#FFFFFF",
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
              minHeight: 32,
              letterSpacing: 0.2,
            }}
          >
            {mine ? `Reviewed ★${mine.stars} · edit` : "Leave a review"}
          </button>
        </div>
      </li>

      <ReviewPostPopup
        open={postOpen}
        product={{ id: productId, name, thumbnailUrl }}
        onClose={() => setPostOpen(false)}
      />
    </>
  );
}

// ─── Format helpers ───────────────────────────────────────────────

function formatPrice(pence: number, currency: string): string {
  const major = (pence / 100).toFixed(2);
  const sym = currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency === "USD" ? "$" : `${currency} `;
  return `${sym}${major}`;
}

function relativeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const delta = Math.max(0, Date.now() - then);
  const mins = Math.floor(delta / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yday";
  return `${days}d`;
}

function formatFullTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number): string => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
