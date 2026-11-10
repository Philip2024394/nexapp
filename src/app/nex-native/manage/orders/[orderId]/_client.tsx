"use client";

// src/app/nex-native/manage/orders/[orderId]/_client.tsx
//
// Order detail client · owner-sealed 2026-11-10 P3.
//
// Renders:
//   · Header · order id · state chip · created timestamp · shop name
//   · Money summary · currency · price
//   · Action strip · state-dependent buttons that call the sealed
//     commerce-service via /manage/orders/_actions.ts
//   · Cart snapshot · items read straight from the sealed
//     peer-message JSONB (NO normalized item table · condition #5)
//   · Delivery + buyer notes if present in the cart snapshot
//   · Audit trail · chronological nex_order_event rows
//
// Actions are strictly gated by current order state:
//   created  → Mark pending · Mark paid · Cancel
//   pending  → Mark paid · Cancel
//   paid     → Mark completed · Refund
//   completed, cancelled, refunded → no actions (read-only)

import * as React from "react";
import {
  sellerCancelOrderAction,
  sellerMarkOrderCompletedAction,
  sellerMarkOrderPaidAction,
} from "../_actions";
import type { NexOrderEventRow, NexOrderRow } from "@/lib/nex-native/types";

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

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function stateTone(state: string): { fg: string; label: string } {
  switch (state) {
    case "created":   return { fg: PALETTE.accent,         label: "New" };
    case "pending":   return { fg: PALETTE.pendingBlue,    label: "Pending payment" };
    case "paid":      return { fg: PALETTE.paid,           label: "Paid" };
    case "completed": return { fg: PALETTE.completedGrey,  label: "Completed" };
    case "cancelled": return { fg: PALETTE.danger,         label: "Cancelled" };
    case "refunded":  return { fg: PALETTE.warning,        label: "Refunded" };
    default:          return { fg: PALETTE.textMuted,      label: state };
  }
}

interface CartLine {
  readonly name?: string;
  readonly quantity?: number;
  readonly price_pence?: number;
  readonly currency?: string;
  readonly variants?: ReadonlyArray<{ name?: string; value?: string }>;
  readonly notes?: string | null;
}

interface CartSnapshot {
  readonly items?: ReadonlyArray<CartLine>;
  readonly delivery_address?: {
    readonly recipient?: string;
    readonly phone?: string;
    readonly street?: string;
    readonly city?: string;
    readonly postal?: string;
    readonly notes?: string;
  };
  readonly buyer_notes?: string;
  readonly shop_display_name?: string;
}

export function OrderDetailClient({
  initialOrder,
  initialEvents,
  cartSnapshot,
  shopDisplayName,
  shopSlug,
}: {
  readonly initialOrder: NexOrderRow;
  readonly initialEvents: ReadonlyArray<NexOrderEventRow>;
  readonly cartSnapshot: Record<string, unknown> | null;
  readonly shopDisplayName: string | null;
  readonly shopSlug: string | null;
}): React.ReactElement {
  void shopSlug;
  const [order, setOrder] = React.useState<NexOrderRow>(initialOrder);
  const [events, setEvents] = React.useState<ReadonlyArray<NexOrderEventRow>>(initialEvents);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [manualNote, setManualNote] = React.useState("");
  const [cancelReason, setCancelReason] = React.useState("");
  const [showCancelForm, setShowCancelForm] = React.useState(false);

  const cart = React.useMemo<CartSnapshot | null>(() => {
    if (!cartSnapshot) return null;
    const meta = cartSnapshot as Record<string, unknown>;
    // Cart snapshot shape varies depending on how the peer-message
    // was composed. Extract the known fields defensively.
    const cartRoot = (meta.cart ?? meta) as Record<string, unknown>;
    return {
      items: Array.isArray(cartRoot.items) ? (cartRoot.items as CartLine[]) : [],
      delivery_address:
        typeof cartRoot.delivery_address === "object"
          ? (cartRoot.delivery_address as CartSnapshot["delivery_address"])
          : undefined,
      buyer_notes:
        typeof cartRoot.buyer_notes === "string"
          ? (cartRoot.buyer_notes as string)
          : undefined,
      shop_display_name:
        typeof cartRoot.shop_display_name === "string"
          ? (cartRoot.shop_display_name as string)
          : undefined,
    };
  }, [cartSnapshot]);

  const tone = stateTone(order.state);

  const refreshFromActionResult = React.useCallback(
    async (next: { order: NexOrderRow }) => {
      setOrder(next.order);
      // Refetch events after state changes · lightweight client-side
      // call. Falls back to the stale list on failure.
      try {
        const res = await fetch(
          `/api/nex-native/manage/orders/${order.id}/events`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const payload = (await res.json()) as {
            events: NexOrderEventRow[];
          };
          setEvents(payload.events);
        }
      } catch {
        /* silent · existing events list stays */
      }
    },
    [order.id],
  );

  const onMarkPaid = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await sellerMarkOrderPaidAction({
        orderId: order.id,
        note: manualNote.trim() || undefined,
      });
      if (res.ok) {
        await refreshFromActionResult(res.value);
        setManualNote("");
        setNotice("Payment confirmed. Order marked PAID + ledger entry posted.");
      } else {
        setError(reasonLabel(res.reason));
      }
    } finally {
      setBusy(false);
    }
  }, [manualNote, order.id, refreshFromActionResult]);

  const onMarkCompleted = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await sellerMarkOrderCompletedAction({ orderId: order.id });
      if (res.ok) {
        await refreshFromActionResult(res.value);
        setNotice("Order marked COMPLETED.");
      } else {
        setError(reasonLabel(res.reason));
      }
    } finally {
      setBusy(false);
    }
  }, [order.id, refreshFromActionResult]);

  const onCancel = React.useCallback(async () => {
    if (!window.confirm("Cancel this order? Cannot be undone.")) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await sellerCancelOrderAction({
        orderId: order.id,
        reason: cancelReason.trim() || undefined,
      });
      if (res.ok) {
        await refreshFromActionResult(res.value);
        setCancelReason("");
        setShowCancelForm(false);
        setNotice("Order CANCELLED.");
      } else {
        setError(reasonLabel(res.reason));
      }
    } finally {
      setBusy(false);
    }
  }, [cancelReason, order.id, refreshFromActionResult]);

  const canPending = order.state === "created";
  const canPay = order.state === "created" || order.state === "pending";
  const canComplete = order.state === "paid";
  const canCancel = order.state === "created" || order.state === "pending";

  return (
    <>
      {/* Header */}
      <section
        style={{
          padding: 18,
          borderRadius: 14,
          background: PALETTE.cardBg,
          border: `1.5px solid ${PALETTE.cardBorder}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: 0.4,
              color: PALETTE.accent,
              fontFamily:
                "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
            }}
          >
            #{order.id.slice(0, 8).toUpperCase()}
          </span>
          <StateChip tone={tone} />
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 900,
            color: PALETTE.text,
            letterSpacing: "-0.01em",
          }}
        >
          {formatMoney(order.price_pence, order.currency)}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: PALETTE.textDim,
          }}
        >
          Created {formatDateTime(order.created_at)}
          {shopDisplayName ? ` · ${shopDisplayName}` : ""}
        </div>
      </section>

      {/* Action strip */}
      <section
        data-nex-order-actions
        style={{
          padding: 18,
          borderRadius: 14,
          background: PALETTE.cardBg,
          border: `1.5px solid ${PALETTE.cardBorder}`,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: PALETTE.accent,
          }}
        >
          Actions
        </h2>
        {!canPending && !canPay && !canComplete && !canCancel ? (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: PALETTE.textMuted,
              fontStyle: "italic",
            }}
          >
            Order is in a terminal state. No further actions available.
          </p>
        ) : null}

        {canPay ? (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: "rgba(22, 214, 107, 0.08)",
              border: `1px solid ${PALETTE.paid}55`,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: PALETTE.text,
                marginBottom: 6,
              }}
            >
              Confirm payment received
            </div>
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 11,
                color: PALETTE.textMuted,
                lineHeight: 1.45,
              }}
            >
              For manual payment methods (QR · bank transfer · cash on
              delivery). Marks the order PAID and posts the ledger
              entry. The audit trail records this is a manual confirm.
            </p>
            <input
              type="text"
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="Optional note · e.g. 'QRIS payment verified 10:34'"
              maxLength={500}
              data-nex-order-manual-note
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(0,0,0,0.35)",
                border: `1px solid ${PALETTE.cardBorder}`,
                color: PALETTE.text,
                fontFamily: "inherit",
                fontSize: 12,
                boxSizing: "border-box",
                outline: "none",
                marginBottom: 8,
              }}
            />
            <button
              type="button"
              onClick={onMarkPaid}
              disabled={busy}
              data-nex-order-mark-paid
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 999,
                background: PALETTE.paid,
                color: "#061710",
                border: "none",
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: 0.3,
                cursor: busy ? "not-allowed" : "pointer",
                textTransform: "uppercase",
              }}
            >
              {busy ? "…" : "Confirm payment received"}
            </button>
          </div>
        ) : null}

        {canComplete ? (
          <button
            type="button"
            onClick={onMarkCompleted}
            disabled={busy}
            data-nex-order-mark-completed
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              background: PALETTE.accent,
              color: "#061710",
              border: "none",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: 0.3,
              cursor: busy ? "not-allowed" : "pointer",
              textTransform: "uppercase",
            }}
          >
            Mark completed (fulfilled)
          </button>
        ) : null}

        {canCancel ? (
          !showCancelForm ? (
            <button
              type="button"
              onClick={() => setShowCancelForm(true)}
              disabled={busy}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                background: "transparent",
                border: `1.5px solid ${PALETTE.danger}`,
                color: PALETTE.danger,
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 0.3,
                cursor: busy ? "not-allowed" : "pointer",
                textTransform: "uppercase",
              }}
            >
              Cancel order
            </button>
          ) : (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: "rgba(139, 0, 0, 0.1)",
                border: `1px solid ${PALETTE.danger}55`,
              }}
            >
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation (optional)"
                maxLength={500}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "rgba(0,0,0,0.35)",
                  border: `1px solid ${PALETTE.cardBorder}`,
                  color: PALETTE.text,
                  fontFamily: "inherit",
                  fontSize: 12,
                  boxSizing: "border-box",
                  outline: "none",
                  marginBottom: 8,
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowCancelForm(false)}
                  disabled={busy}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: "transparent",
                    border: `1px solid ${PALETTE.cardBorder}`,
                    color: PALETTE.textMuted,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Keep order
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={busy}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: PALETTE.danger,
                    color: "#FFF",
                    border: "none",
                    fontSize: 11,
                    fontWeight: 900,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  Confirm cancel
                </button>
              </div>
            </div>
          )
        ) : null}

        {notice ? (
          <p
            role="status"
            style={{
              margin: 0,
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(22, 214, 107, 0.15)",
              border: `1px solid ${PALETTE.paid}`,
              color: PALETTE.paid,
              fontSize: 12,
            }}
          >
            {notice}
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            style={{
              margin: 0,
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(139,0,0,0.15)",
              border: `1px solid ${PALETTE.danger}`,
              color: "#FFB199",
              fontSize: 12,
            }}
          >
            {error}
          </p>
        ) : null}
      </section>

      {/* Cart snapshot · from the sealed peer-message JSONB */}
      {cart ? (
        <section
          data-nex-order-cart
          style={{
            padding: 18,
            borderRadius: 14,
            background: PALETTE.cardBg,
            border: `1.5px solid ${PALETTE.cardBorder}`,
          }}
        >
          <h2
            style={{
              margin: "0 0 10px",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: PALETTE.accent,
            }}
          >
            Items (from chat cart snapshot)
          </h2>
          {cart.items && cart.items.length > 0 ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {cart.items.map((item, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom:
                      i < (cart.items?.length ?? 0) - 1
                        ? `1px dashed ${PALETTE.cardBorder}`
                        : "none",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: PALETTE.text,
                      }}
                    >
                      {item.name ?? "(unnamed item)"}
                    </div>
                    {item.variants && item.variants.length > 0 ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: PALETTE.textDim,
                          marginTop: 2,
                        }}
                      >
                        {item.variants
                          .map((v) => `${v.name}: ${v.value}`)
                          .join(" · ")}
                      </div>
                    ) : null}
                    {item.notes ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: PALETTE.textDim,
                          marginTop: 2,
                          fontStyle: "italic",
                        }}
                      >
                        "{item.notes}"
                      </div>
                    ) : null}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: PALETTE.textMuted }}>
                      ×{item.quantity ?? 1}
                    </div>
                    {typeof item.price_pence === "number" && item.currency ? (
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: PALETTE.text,
                        }}
                      >
                        {formatMoney(
                          item.price_pence * (item.quantity ?? 1),
                          item.currency,
                        )}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: PALETTE.textMuted,
                fontStyle: "italic",
              }}
            >
              No item lines in the cart snapshot.
            </p>
          )}

          {cart.delivery_address ? (
            <div style={{ marginTop: 14 }}>
              <h3
                style={{
                  margin: "0 0 6px",
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: PALETTE.accent,
                }}
              >
                Delivery
              </h3>
              <div style={{ fontSize: 12, color: PALETTE.textMuted, lineHeight: 1.5 }}>
                {cart.delivery_address.recipient ? (
                  <div>{cart.delivery_address.recipient}</div>
                ) : null}
                {cart.delivery_address.phone ? (
                  <div>{cart.delivery_address.phone}</div>
                ) : null}
                {cart.delivery_address.street ? (
                  <div>{cart.delivery_address.street}</div>
                ) : null}
                {cart.delivery_address.city || cart.delivery_address.postal ? (
                  <div>
                    {cart.delivery_address.city ?? ""}{" "}
                    {cart.delivery_address.postal ?? ""}
                  </div>
                ) : null}
                {cart.delivery_address.notes ? (
                  <div style={{ fontStyle: "italic", marginTop: 4 }}>
                    "{cart.delivery_address.notes}"
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {cart.buyer_notes ? (
            <div style={{ marginTop: 14 }}>
              <h3
                style={{
                  margin: "0 0 6px",
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: PALETTE.accent,
                }}
              >
                Buyer note
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: PALETTE.textMuted,
                  fontStyle: "italic",
                  lineHeight: 1.5,
                }}
              >
                "{cart.buyer_notes}"
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Audit trail */}
      <section
        data-nex-order-events
        style={{
          padding: 18,
          borderRadius: 14,
          background: PALETTE.cardBg,
          border: `1.5px solid ${PALETTE.cardBorder}`,
        }}
      >
        <h2
          style={{
            margin: "0 0 10px",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: PALETTE.accent,
          }}
        >
          Audit trail ({events.length})
        </h2>
        {events.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: PALETTE.textMuted, fontStyle: "italic" }}>
            No events recorded.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {events.map((e) => (
              <li
                key={e.id}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "rgba(0,0,0,0.25)",
                  border: `1px solid ${PALETTE.cardBorder}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: PALETTE.text }}>
                    {e.event}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: PALETTE.textDim,
                      fontFamily:
                        "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
                    }}
                  >
                    {formatDateTime(e.created_at)}
                  </span>
                </div>
                {e.metadata && Object.keys(e.metadata).length > 0 ? (
                  <pre
                    style={{
                      margin: "4px 0 0",
                      fontSize: 10.5,
                      color: PALETTE.textDim,
                      fontFamily:
                        "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {JSON.stringify(e.metadata)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function StateChip({
  tone,
}: {
  readonly tone: { fg: string; label: string };
}): React.ReactElement {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 900,
        padding: "2px 8px",
        borderRadius: 999,
        background: PALETTE.chipBg,
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

function reasonLabel(reason: string): string {
  switch (reason) {
    case "not_authenticated": return "Sign in required.";
    case "not_owner":         return "You do not own this order.";
    case "not_found":         return "Order not found.";
    case "invalid_state_transition":
      return "This action is not valid from the current order state.";
    case "db_unavailable":    return "Database unavailable. Please try again shortly.";
    case "note_required_fast_confirm":
      return "This order has been pending for less than a minute. Add a short note explaining how you already know payment was received, then confirm.";
    default:                  return "Could not complete the action.";
  }
}
