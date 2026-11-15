// src/app/nex-native/orders/[orderId]/page.tsx
//
// Customer order status page · Slice 4b · offline payment doctrine.
// ------------------------------------------------------------------
// Server Component · shows:
//   · order state chip (created / paid / completed / cancelled / refunded)
//   · timeline of nex_order_event rows
//   · product name + price · business display_name + logo
//   · seller contact (public_phone / public_email / website_url)
//   · payment_instructions (bank details etc.)
//   · COD / pickup badges when the seller has activated them
//   · "Message seller" link to the source conversation (when present)
//   · buyer's own customer_note if they attached one
//
// Access: caller MUST be the customer on the order · owner-of-business is
// silently redirected to the merchant fulfilment queue instead.
//
// 2026-11-16 · Stream C B3 · dark-theme repaint. The page previously
// rendered light Tailwind (`bg-white`, `text-neutral-900`, `bg-red-50`
// etc.) inside the sealed NEX dark `.nex-native-stage > .nex-native-frame`
// shell, producing a stark white-on-dark mismatch against sibling
// customer surfaces (contacts, orders list, manage/orders/[orderId]).
// This pass repaints the PRESENTATION ONLY using the sealed NEX
// palette tokens (var(--nex-world-drawer-bg), cream gold accent,
// rgba(198,161,91,0.*) borders) mirrored verbatim from
// src/app/nex-native/manage/orders/[orderId]/page.tsx. Every data
// fetch, ownership check, server-action binding, state branch, and
// server-action form POST target is preserved VERBATIM — zero
// behaviour change beyond pixels.

import type * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import * as orderService from "@/lib/nex-native/order-service";
import type { NexOrderState } from "@/lib/nex-native/types";
import {
  customerCancelOrderAction,
  customerMarkPaymentSentAction,
} from "../../_actions";
import { SubmitButton } from "../../_submit-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sealed NEX dark palette · mirror of the tokens used by
// /manage/orders/[orderId]/page.tsx so this customer-facing page
// matches the merchant-facing sibling. These are CSS variables that
// the World stylesheet emits on `.nex-native-stage`; the fallbacks
// here are the documented defaults.
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const PALETTE = {
  bg: "var(--nex-world-drawer-bg, #123D2B)",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  textDim: "#7D9BC0",
  accent: "var(--nex-world-secondary, #C6A15B)",
  cream: "var(--nex-world-cream, #FAF8F4)",
  cardBg: "rgba(10, 28, 20, 0.72)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
  cardBorderDim: "rgba(198, 161, 91, 0.22)",
};

// State-badge colour map · each one tuned for dark-on-dark contrast.
// Kept as inline style objects so we don't need Tailwind arbitrary
// colour utilities that would compete with the sealed world palette.
const STATE_BADGE_STYLE: Record<NexOrderState, React.CSSProperties> = {
  created: {
    background: "rgba(74, 136, 230, 0.18)",
    color: "#9CC2FF",
    border: "1px solid rgba(74, 136, 230, 0.45)",
  },
  pending: {
    background: "rgba(214, 158, 46, 0.18)",
    color: "#F0CF84",
    border: "1px solid rgba(214, 158, 46, 0.45)",
  },
  paid: {
    background: "rgba(72, 187, 120, 0.22)",
    color: "#9CE5B5",
    border: "1px solid rgba(72, 187, 120, 0.5)",
  },
  completed: {
    background: "rgba(46, 160, 110, 0.22)",
    color: "#8DE0B6",
    border: "1px solid rgba(46, 160, 110, 0.5)",
  },
  cancelled: {
    background: "rgba(136, 152, 176, 0.18)",
    color: "#B5C3D6",
    border: "1px solid rgba(136, 152, 176, 0.4)",
  },
  refunded: {
    background: "rgba(245, 101, 101, 0.18)",
    color: "#FBB5B5",
    border: "1px solid rgba(245, 101, 101, 0.45)",
  },
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ e?: string; m?: string }>;
}) {
  const { orderId } = await params;
  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(`/nex-native/conversations?e=unauthenticated&m=${encodeURIComponent("sign in to view your order")}`);
  }

  const order = await orderService.getOrderById(orderId);
  if (!order) notFound();

  if (order.customer_account_id !== session.account.id) {
    const business = await businessService.getBusinessById(order.business_id);
    if (business && business.owner_account_id === session.account.id) {
      redirect("/nex-native/manage/orders");
    }
    return (
      <>
        <style>{`html, body { background: ${PALETTE.bg}; }`}</style>
        <main
          style={{
            minHeight: "100dvh",
            background: PALETTE.bg,
            color: PALETTE.text,
            fontFamily: SANS,
            padding: "calc(env(safe-area-inset-top, 0px) + 20px) 18px 48px",
          }}
        >
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            <div
              style={{
                borderRadius: 12,
                border: "1px solid rgba(245, 101, 101, 0.4)",
                background: "rgba(245, 101, 101, 0.12)",
                color: "#FBB5B5",
                padding: "14px 16px",
                fontSize: 13.5,
                lineHeight: 1.5,
              }}
              role="alert"
            >
              You are not authorised to view this order.
            </div>
          </div>
        </main>
      </>
    );
  }

  const [business, product, events] = await Promise.all([
    businessService.getBusinessById(order.business_id),
    productService.getProductById(order.product_id),
    orderService.listOrderEvents(order.id),
  ]);
  if (!business) notFound();

  const priceFormatted = `${order.currency} ${(order.price_pence / 100).toFixed(2)}`;

  return (
    <>
      <style>{`html, body { background: ${PALETTE.bg}; }`}</style>
      <main
        data-nex-order-detail-customer
        style={{
          minHeight: "100dvh",
          background: PALETTE.bg,
          color: PALETTE.text,
          fontFamily: SANS,
          padding: "calc(env(safe-area-inset-top, 0px) + 20px) 18px 48px",
        }}
      >
        <div
          style={{
            maxWidth: 560,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <header
            style={{
              borderBottom: `1px solid ${PALETTE.cardBorderDim}`,
              paddingBottom: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <Link
              href="/nex-native/orders"
              style={{
                fontSize: 11,
                color: PALETTE.accent,
                textDecoration: "none",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              ← your orders
            </Link>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                    color: PALETTE.cream,
                  }}
                >
                  {product?.name ?? "(product removed)"}
                </h1>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 12,
                    color: PALETTE.textMuted,
                  }}
                >
                  {priceFormatted} · order{" "}
                  <code
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      color: PALETTE.textDim,
                    }}
                  >
                    {order.id.slice(0, 8)}…
                  </code>{" "}
                  · placed {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
              <span
                style={{
                  display: "inline-block",
                  borderRadius: 999,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  ...STATE_BADGE_STYLE[order.state],
                }}
              >
                {order.state}
              </span>
            </div>
          </header>

          {banner && (
            <div
              style={{
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 12,
                lineHeight: 1.5,
                border:
                  banner.code === "cancelled" || banner.code === "payment_sent"
                    ? "1px solid rgba(72, 187, 120, 0.45)"
                    : "1px solid rgba(245, 101, 101, 0.45)",
                background:
                  banner.code === "cancelled" || banner.code === "payment_sent"
                    ? "rgba(72, 187, 120, 0.15)"
                    : "rgba(245, 101, 101, 0.15)",
                color:
                  banner.code === "cancelled" || banner.code === "payment_sent"
                    ? "#9CE5B5"
                    : "#FBB5B5",
              }}
              role="status"
            >
              {banner.message}
            </div>
          )}

          {order.customer_note && (
            <section
              style={{
                borderRadius: 12,
                border: `1px solid ${PALETTE.cardBorderDim}`,
                background: PALETTE.cardBg,
                padding: 14,
                fontSize: 13,
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: PALETTE.textDim,
                  marginBottom: 6,
                }}
              >
                Your note to the seller
              </div>
              <p
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  color: PALETTE.text,
                  lineHeight: 1.5,
                }}
              >
                {order.customer_note}
              </p>
            </section>
          )}

          {order.dispatch_tracking_url && (
            <section
              style={{
                borderRadius: 12,
                border: "1px solid rgba(74, 136, 230, 0.4)",
                background: "rgba(74, 136, 230, 0.12)",
                padding: 14,
                fontSize: 13,
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#9CC2FF",
                  marginBottom: 6,
                }}
              >
                Dispatch tracking
              </div>
              <a
                href={order.dispatch_tracking_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  wordBreak: "break-all",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: 12,
                  color: "#9CC2FF",
                  textDecoration: "underline",
                }}
              >
                {order.dispatch_tracking_url}
              </a>
            </section>
          )}

          <section
            style={{
              borderRadius: 12,
              border: `1px solid ${PALETTE.cardBorder}`,
              background: PALETTE.cardBg,
              padding: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              {business.logo_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={business.logo_url}
                  alt={`${business.display_name} logo`}
                  style={{
                    width: 48,
                    height: 48,
                    flexShrink: 0,
                    borderRadius: 10,
                    border: `1px solid ${PALETTE.cardBorderDim}`,
                    background: "#0A1C14",
                    objectFit: "contain",
                  }}
                />
              )}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: PALETTE.cream,
                  }}
                >
                  {business.display_name}
                </div>
                <div style={{ fontSize: 11.5, color: PALETTE.textMuted }}>
                  <Link
                    href={`/nex-native/${business.slug}`}
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      color: PALETTE.accent,
                      textDecoration: "underline",
                    }}
                  >
                    /nex-native/{business.slug}
                  </Link>
                </div>
              </div>
            </div>

            {(business.public_phone || business.public_email || business.website_url) && (
              <dl
                style={{
                  display: "grid",
                  gridTemplateColumns: "max-content 1fr",
                  columnGap: 12,
                  rowGap: 4,
                  marginTop: 12,
                  fontSize: 12,
                  color: PALETTE.text,
                }}
              >
                {business.public_phone && (
                  <>
                    <dt style={{ color: PALETTE.textDim }}>Phone</dt>
                    <dd style={{ margin: 0 }}>
                      <a
                        href={`tel:${business.public_phone}`}
                        style={{ color: PALETTE.accent, textDecoration: "underline" }}
                      >
                        {business.public_phone}
                      </a>
                    </dd>
                  </>
                )}
                {business.public_email && (
                  <>
                    <dt style={{ color: PALETTE.textDim }}>Email</dt>
                    <dd style={{ margin: 0 }}>
                      <a
                        href={`mailto:${business.public_email}`}
                        style={{ color: PALETTE.accent, textDecoration: "underline" }}
                      >
                        {business.public_email}
                      </a>
                    </dd>
                  </>
                )}
                {business.website_url && (
                  <>
                    <dt style={{ color: PALETTE.textDim }}>Website</dt>
                    <dd style={{ margin: 0 }}>
                      <a
                        href={business.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: PALETTE.accent, textDecoration: "underline" }}
                      >
                        {business.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    </dd>
                  </>
                )}
              </dl>
            )}
          </section>

          <section
            style={{
              borderRadius: 12,
              border: `1px solid ${PALETTE.cardBorderDim}`,
              background: PALETTE.cardBg,
              padding: 14,
            }}
          >
            <h2
              style={{
                margin: "0 0 8px",
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: PALETTE.textDim,
              }}
            >
              Paying the seller
            </h2>
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 13,
                lineHeight: 1.5,
                color: PALETTE.text,
              }}
            >
              NEX does not process payments. You settle directly with the seller.
            </p>
            {business.payment_instructions ? (
              <div
                style={{
                  borderRadius: 10,
                  border: `1px solid ${PALETTE.cardBorderDim}`,
                  background: "rgba(0, 0, 0, 0.22)",
                  padding: 10,
                  fontSize: 12,
                  color: PALETTE.text,
                  marginBottom: 10,
                }}
              >
                <div style={{ color: PALETTE.textDim, marginBottom: 4 }}>
                  Seller&apos;s instructions:
                </div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {business.payment_instructions}
                </div>
              </div>
            ) : (
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: 11.5,
                  color: PALETTE.textMuted,
                  lineHeight: 1.5,
                }}
              >
                The seller has not published payment instructions · use NEX
                Chat to ask them how to pay.
              </p>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {business.accepts_cod && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: 999,
                    border: "1px solid rgba(72, 187, 120, 0.5)",
                    background: "rgba(72, 187, 120, 0.15)",
                    color: "#9CE5B5",
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  Cash on delivery available
                </span>
              )}
              {business.accepts_pickup && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: 999,
                    border: "1px solid rgba(72, 187, 120, 0.5)",
                    background: "rgba(72, 187, 120, 0.15)",
                    color: "#9CE5B5",
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  Customer pickup available
                </span>
              )}
            </div>
            {order.source_conversation_id && (
              <Link
                href={`/nex-native/conversations/${order.source_conversation_id}`}
                style={{
                  display: "inline-block",
                  marginTop: 12,
                  borderRadius: 999,
                  background: PALETTE.accent,
                  color: "#0A1C14",
                  padding: "8px 16px",
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Message seller in NEX Chat
              </Link>
            )}
          </section>

          <section>
            <h2
              style={{
                margin: "0 0 8px",
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: PALETTE.textDim,
              }}
            >
              Timeline
            </h2>
            {events.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  borderRadius: 10,
                  border: `1px solid ${PALETTE.cardBorderDim}`,
                  background: PALETTE.cardBg,
                  padding: "8px 12px",
                  fontSize: 12,
                  color: PALETTE.textMuted,
                }}
              >
                No events yet.
              </p>
            ) : (
              <ol
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: 8,
                }}
              >
                {events.map((e) => (
                  <li
                    key={e.id}
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${PALETTE.cardBorderDim}`,
                      background: PALETTE.cardBg,
                      padding: "8px 12px",
                      fontSize: 13,
                      color: PALETTE.text,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontWeight: 600, color: PALETTE.cream }}>
                        {e.event}
                      </span>
                      <span style={{ fontSize: 11, color: PALETTE.textDim }}>
                        {new Date(e.created_at).toLocaleString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {order.state === "created" && (
            <section
              style={{
                borderRadius: 12,
                border: `1px solid ${PALETTE.cardBorderDim}`,
                background: PALETTE.cardBg,
                padding: 14,
              }}
            >
              <h2
                style={{
                  margin: "0 0 8px",
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: PALETTE.textDim,
                }}
              >
                Tell the seller you&apos;ve sent payment
              </h2>
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: 12,
                  color: PALETTE.textMuted,
                  lineHeight: 1.5,
                }}
              >
                Send the money to the seller (bank transfer · COD arranged ·
                pickup) then tap below. The seller confirms once they receive
                it.
              </p>
              <form
                action={customerMarkPaymentSentAction}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "flex-end",
                  gap: 8,
                }}
              >
                <input type="hidden" name="order_id" value={order.id} />
                <label
                  style={{
                    minWidth: 0,
                    flex: 1,
                    fontSize: 11.5,
                    color: PALETTE.textDim,
                  }}
                >
                  Note to seller (optional)
                  <input
                    type="text"
                    name="reason"
                    maxLength={200}
                    placeholder="e.g. paid by bank transfer · ref order id"
                    style={{
                      marginTop: 4,
                      display: "block",
                      minHeight: 44,
                      width: "100%",
                      borderRadius: 8,
                      border: `1px solid ${PALETTE.cardBorder}`,
                      background: "rgba(0, 0, 0, 0.3)",
                      color: PALETTE.text,
                      padding: "8px 10px",
                      fontSize: 13,
                    }}
                  />
                </label>
                <SubmitButton
                  label="I've sent payment"
                  pendingLabel="Notifying seller…"
                />
              </form>
            </section>
          )}

          {(order.state === "created" || order.state === "pending") && (
            <section
              style={{
                borderRadius: 12,
                border: `1px solid ${PALETTE.cardBorderDim}`,
                background: PALETTE.cardBg,
                padding: 14,
              }}
            >
              <h2
                style={{
                  margin: "0 0 8px",
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: PALETTE.textDim,
                }}
              >
                Cancel this order
              </h2>
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: 12,
                  color: PALETTE.textMuted,
                  lineHeight: 1.5,
                }}
              >
                You can cancel while the order is still pre-payment. After the
                seller marks it paid, contact them for a refund instead.
              </p>
              <form
                action={customerCancelOrderAction}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "flex-end",
                  gap: 8,
                }}
              >
                <input type="hidden" name="order_id" value={order.id} />
                <label
                  style={{
                    minWidth: 0,
                    flex: 1,
                    fontSize: 11.5,
                    color: PALETTE.textDim,
                  }}
                >
                  Reason (optional)
                  <input
                    type="text"
                    name="reason"
                    maxLength={200}
                    placeholder="Changed my mind · anything the seller should know"
                    style={{
                      marginTop: 4,
                      display: "block",
                      minHeight: 44,
                      width: "100%",
                      borderRadius: 8,
                      border: `1px solid ${PALETTE.cardBorder}`,
                      background: "rgba(0, 0, 0, 0.3)",
                      color: PALETTE.text,
                      padding: "8px 10px",
                      fontSize: 13,
                    }}
                  />
                </label>
                <SubmitButton
                  label="Cancel order"
                  pendingLabel="Cancelling…"
                  variant="secondary"
                />
              </form>
            </section>
          )}

          <p
            style={{
              margin: 0,
              fontSize: 11.5,
              color: PALETTE.textDim,
              lineHeight: 1.5,
            }}
          >
            Once the seller receives payment they will mark this order paid ·
            the state chip above updates automatically.
          </p>
        </div>
      </main>
    </>
  );
}
