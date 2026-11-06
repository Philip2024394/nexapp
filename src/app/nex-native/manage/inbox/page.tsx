// src/app/nex-native/manage/inbox/page.tsx
//
// Shop owner order inbox · "customers who messaged my shop".
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Dedicated owner-side surface that lists every conversation where
// the signed-in account participates as `side='business'` — i.e.
// every customer who hit the owner's shop via Buy-Now-Chat, product
// taps, or the cart's sendCartOrderAction.
//
// The Business tab at /contacts already surfaces these rows as part
// of a mixed list. This page is the FOCUSED order inbox: one row per
// conversation, newest first, with the last message preview, unread
// count, business context, and a direct tap to the conversation.
//
// Reads are 100% fail-soft so a transient Supabase blip renders an
// empty inbox rather than crashing. No mutations happen here — tap
// a row to open the sealed /conversations/<id> surface where the
// owner reads + replies.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as conversationService from "@/lib/nex-native/conversation-service";
import * as businessService from "@/lib/nex-native/business-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "rgba(5, 15, 28, 0.72)";
const BORDER = "rgba(198, 161, 91, 0.25)";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
  });
}

export default async function ShopOrderInboxPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/inbox");
  }

  // Precondition: viewer owns at least one business. If not, there's
  // nothing to inbox — bounce to shop setup landing.
  const businesses = await businessService
    .listBusinessesByOwner(session.account.id)
    .catch(() => []);
  if (businesses.length === 0) {
    redirect("/nex-native/manage/shop/start");
  }

  const conversations = await conversationService
    .listConversationsForAccount(session.account.id, { limit: 200 })
    .catch(() => []);

  // Only business-side conversations — the owner reading as the shop.
  const businessConversations = conversations.filter(
    (c) => c.my_side === "business",
  );

  // Newest-first (listConversationsForAccount already orders this way
  // but we re-sort defensively in case of ties).
  businessConversations.sort((a, b) => {
    const aT = a.last_message?.created_at ?? a.conversation.created_at;
    const bT = b.last_message?.created_at ?? b.conversation.created_at;
    return new Date(bT).getTime() - new Date(aT).getTime();
  });

  const totalUnread = businessConversations.reduce(
    (sum, c) => sum + (c.unread_count ?? 0),
    0,
  );

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-shop-inbox
        style={{
          position: "absolute",
          inset: 0,
          background: NEX_BG,
          color: INK,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 18px) 20px calc(env(safe-area-inset-bottom, 0px) + 18px)",
          boxSizing: "border-box",
          gap: 14,
        }}
      >
        <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Link
            href="/nex-native/contacts?tab=business"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 700,
              color: GOLD,
              textDecoration: "none",
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
            }}
          >
            ← Contacts
          </Link>
        </nav>

        <header
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            paddingBottom: 8,
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: GOLD,
            }}
          >
            Shop inbox
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 900,
              color: CREAM,
              letterSpacing: "-0.01em",
            }}
          >
            Customers who messaged you
          </h1>
          <p style={{ margin: 0, fontSize: 11.5, color: INK_DIM }}>
            {businessConversations.length === 0
              ? "No customer messages yet."
              : `${businessConversations.length} conversation${
                  businessConversations.length === 1 ? "" : "s"
                } · ${totalUnread} unread`}
          </p>
        </header>

        {businessConversations.length === 0 ? <EmptyInbox /> : null}

        {businessConversations.map((c) => {
          const lastBody = c.last_message?.body ?? "";
          const lastPreview =
            lastBody.length > 80
              ? `${lastBody.slice(0, 80).trimEnd()}…`
              : lastBody;
          const lastAt =
            c.last_message?.created_at ?? c.conversation.created_at;
          const unread = c.unread_count ?? 0;
          const product = c.product;

          return (
            <Link
              key={c.conversation.id}
              href={`/nex-native/conversations/${c.conversation.id}`}
              data-nex-inbox-row={c.conversation.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "12px 14px",
                background: SURFACE,
                border: `1px solid ${unread > 0 ? GOLD : BORDER}`,
                borderRadius: 14,
                textDecoration: "none",
                color: INK,
                boxShadow:
                  unread > 0
                    ? "0 0 0 2px rgba(198, 161, 91, 0.14)"
                    : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, rgba(198,161,91,0.25), rgba(5,15,28,0.9))",
                    color: GOLD,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 14,
                    fontWeight: 900,
                    flexShrink: 0,
                  }}
                >
                  {(c.other_display_name ?? "?").slice(0, 1).toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 900,
                        color: CREAM,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.other_display_name ?? "Customer"}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 10.5,
                        color: INK_MUTED,
                        flexShrink: 0,
                      }}
                    >
                      {timeAgo(lastAt)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: GOLD,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      marginTop: 1,
                    }}
                  >
                    🏪 {c.business.display_name}
                    {product ? (
                      <span style={{ color: INK_MUTED, fontWeight: 600 }}>
                        {" · "}about {product.name}
                      </span>
                    ) : null}
                  </div>
                </div>
                {unread > 0 ? (
                  <span
                    aria-label={`${unread} unread`}
                    style={{
                      minWidth: 22,
                      height: 22,
                      padding: "0 7px",
                      borderRadius: 999,
                      background: "#CC1818",
                      color: "#FFF",
                      display: "inline-grid",
                      placeItems: "center",
                      fontSize: 10.5,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </div>
              {lastPreview ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 11.5,
                    color: INK_DIM,
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {lastPreview}
                </p>
              ) : null}
            </Link>
          );
        })}
      </main>
    </>
  );
}

function EmptyInbox(): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      <span aria-hidden style={{ fontSize: 34 }}>📭</span>
      <div style={{ maxWidth: 280 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 900,
            color: CREAM,
            letterSpacing: "-0.005em",
          }}
        >
          No customer messages yet
        </div>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 11.5,
            color: INK_DIM,
            lineHeight: 1.45,
          }}
        >
          When someone taps Chat on a product or sends an order via
          Checkout, the thread lands here.
        </p>
      </div>
      <Link
        href="/nex-native/manage/shop/themes"
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "10px 18px",
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: GOLD,
          background: "transparent",
          border: `1px solid ${GOLD}`,
          textDecoration: "none",
          borderRadius: 999,
        }}
      >
        Review your shop →
      </Link>
    </div>
  );
}
