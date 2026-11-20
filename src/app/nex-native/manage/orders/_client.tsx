"use client";

// src/app/nex-native/manage/orders/_client.tsx
//
// Seller orders list client · owner-sealed 2026-11-10 P3.
//
// Interactive layer on top of the server-rendered list:
//   · Status filter chips (All / Created / Pending / Paid / Completed /
//     Cancelled / Refunded)
//   · Free-text search over order id + customer note + merchant note
//   · Newest-first sort (sort switcher is scoped follow-up)
//   · Each row is a Link to /manage/orders/[orderId]

import * as React from "react";
import Link from "next/link";
import type { NexOrderRow } from "@/lib/nex-native/types";

const PALETTE = {
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  textDim: "#7D9BC0",
  accent: "#C6A15B",
  cardBg: "rgba(10, 28, 20, 0.72)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
  cardBorderStrong: "rgba(198, 161, 91, 0.6)",
  chipBg: "rgba(0,0,0,0.3)",
  danger: "#8B0000",
  warning: "#FFAF40",
  pendingBlue: "#3C8CFF",
  paid: "#16D66B",
  completedGrey: "#7D9BC0",
};

const STATE_ORDER = ["created", "pending", "paid", "completed", "cancelled", "refunded"] as const;
type OrderState = (typeof STATE_ORDER)[number];

function formatMoney(pence: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(pence / 100);
  } catch {
    return `${currency} ${(pence / 100).toFixed(2)}`;
  }
}

function formatRelTime(iso: string): string {
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}

function stateTone(state: string): { bg: string; fg: string; label: string } {
  switch (state) {
    case "created":
      return { bg: PALETTE.chipBg, fg: PALETTE.accent, label: "New" };
    case "pending":
      return { bg: PALETTE.chipBg, fg: PALETTE.pendingBlue, label: "Pending payment" };
    case "paid":
      return { bg: PALETTE.chipBg, fg: PALETTE.paid, label: "Paid" };
    case "completed":
      return { bg: PALETTE.chipBg, fg: PALETTE.completedGrey, label: "Completed" };
    case "cancelled":
      return { bg: PALETTE.chipBg, fg: PALETTE.danger, label: "Cancelled" };
    case "refunded":
      return { bg: PALETTE.chipBg, fg: PALETTE.warning, label: "Refunded" };
    default:
      return { bg: PALETTE.chipBg, fg: PALETTE.textMuted, label: state };
  }
}

export function OrdersListClient({
  initialOrders,
  businessId,
  productNameById,
}: {
  readonly initialOrders: ReadonlyArray<NexOrderRow>;
  readonly businessId: string;
  /** 2026-11-20 · product-name lookup supplied by the server page so
   *  each row can show what was ordered (not just a truncated id). */
  readonly productNameById?: Readonly<Record<string, string>>;
}): React.ReactElement {
  void businessId;
  const [filter, setFilter] = React.useState<"all" | OrderState>("all");
  const [search, setSearch] = React.useState("");

  const visible = React.useMemo(() => {
    let rows = [...initialOrders];
    if (filter !== "all") rows = rows.filter((r) => r.state === filter);
    const q = search.trim().toLowerCase();
    if (q.length > 0) {
      rows = rows.filter((r) => {
        const idPrefix = r.id.toLowerCase();
        const custNote = (r.customer_note ?? "").toLowerCase();
        const mercNote = (r.merchant_note ?? "").toLowerCase();
        return (
          idPrefix.startsWith(q) ||
          custNote.includes(q) ||
          mercNote.includes(q)
        );
      });
    }
    return rows;
  }, [initialOrders, filter, search]);

  const counts: Record<"all" | OrderState, number> = React.useMemo(() => {
    const base: Record<"all" | OrderState, number> = {
      all: initialOrders.length,
      created: 0,
      pending: 0,
      paid: 0,
      completed: 0,
      cancelled: 0,
      refunded: 0,
    };
    for (const o of initialOrders) {
      if (STATE_ORDER.includes(o.state as OrderState)) {
        base[o.state as OrderState] += 1;
      }
    }
    return base;
  }, [initialOrders]);

  return (
    <section
      data-nex-orders-list
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Status filter chips */}
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <FilterChip
          label={`All (${counts.all})`}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        {STATE_ORDER.map((s) => (
          <FilterChip
            key={s}
            label={`${stateTone(s).label} (${counts[s]})`}
            tone={stateTone(s).fg}
            active={filter === s}
            onClick={() => setFilter(s)}
          />
        ))}
      </div>

      {/* Search */}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search order id · customer note · merchant note"
        data-nex-orders-search
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.3)",
          border: `1px solid ${PALETTE.cardBorder}`,
          color: PALETTE.text,
          fontSize: 13,
          fontFamily: "inherit",
          outline: "none",
        }}
      />

      {/* List */}
      {visible.length === 0 ? (
        <div
          style={{
            padding: 22,
            borderRadius: 14,
            background: PALETTE.cardBg,
            border: `1px dashed ${PALETTE.cardBorder}`,
            textAlign: "center",
            color: PALETTE.textDim,
            fontSize: 13,
          }}
        >
          {initialOrders.length === 0
            ? "No orders yet. When a buyer checks out from your shop they'll appear here."
            : "No orders match this filter."}
        </div>
      ) : (
        <ul
          data-nex-orders-ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {visible.map((o) => (
            <OrderRow
              key={o.id}
              order={o}
              productName={productNameById?.[o.product_id] ?? null}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  tone,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly onClick: () => void;
  readonly tone?: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "5px 10px",
        borderRadius: 999,
        background: active ? "rgba(198, 161, 91, 0.2)" : "transparent",
        border: active
          ? `1px solid ${PALETTE.accent}`
          : `1px solid ${PALETTE.cardBorder}`,
        color: active ? PALETTE.text : tone ?? PALETTE.textMuted,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.04em",
        cursor: "pointer",
        fontFamily: "inherit",
        textTransform: "uppercase",
      }}
    >
      {label}
    </button>
  );
}

function OrderRow({
  order,
  productName,
}: {
  readonly order: NexOrderRow;
  readonly productName: string | null;
}): React.ReactElement {
  const tone = stateTone(order.state);
  return (
    <li>
      <Link
        href={`/nex-native/manage/orders/${order.id}`}
        data-nex-order-row={order.id.slice(0, 8)}
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
          padding: "12px 14px",
          borderRadius: 12,
          background: PALETTE.cardBg,
          border: `1px solid ${PALETTE.cardBorder}`,
          textDecoration: "none",
          color: PALETTE.text,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 0.3,
                color: PALETTE.accent,
                fontFamily:
                  "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
              }}
            >
              #{order.id.slice(0, 8).toUpperCase()}
            </span>
            <StateChip tone={tone} />
          </div>
          {productName ? (
            <div
              data-nex-order-row-product
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: PALETTE.text,
                lineHeight: 1.35,
                marginBottom: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {productName}
            </div>
          ) : null}
          <div style={{ fontSize: 13, color: PALETTE.textMuted, lineHeight: 1.4 }}>
            Customer{" "}
            <span style={{ color: PALETTE.textDim, fontFamily: "ui-monospace, Consolas, monospace", fontSize: 11 }}>
              {order.customer_account_id.slice(0, 8)}…
            </span>
          </div>
          {order.customer_note ? (
            <div
              style={{
                marginTop: 4,
                fontSize: 11.5,
                color: PALETTE.textDim,
                lineHeight: 1.45,
                fontStyle: "italic",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              "{order.customer_note}"
            </div>
          ) : null}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 900,
              color: PALETTE.text,
              letterSpacing: "-0.005em",
            }}
          >
            {formatMoney(order.price_pence, order.currency)}
          </div>
          <div style={{ marginTop: 4, fontSize: 10.5, color: PALETTE.textDim }}>
            {formatRelTime(order.created_at)}
          </div>
        </div>
      </Link>
    </li>
  );
}

function StateChip({
  tone,
}: {
  readonly tone: { bg: string; fg: string; label: string };
}): React.ReactElement {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 900,
        padding: "2px 8px",
        borderRadius: 999,
        background: tone.bg,
        color: tone.fg,
        border: `1px solid ${tone.fg}55`,
        textTransform: "uppercase",
        letterSpacing: 0.3,
      }}
    >
      {tone.label}
    </span>
  );
}
