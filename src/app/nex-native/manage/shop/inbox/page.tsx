// src/app/nex-native/manage/shop/inbox/page.tsx
//
// Stage 8 · item 8 · 2026-11-14 · owner-authorised build.
// -----------------------------------------------------------------------------
// Owner-side "Shop Chat inbox" · lists every conversation where the
// signed-in viewer sits on the BUSINESS side, grouped by shop. Closes
// the launch-readiness gap flagged by the owner-journey scan: a
// multi-shop owner previously had no way to triage pending replies
// across their shops · they had to visit each conversation by direct
// URL from the HQ chrome.
//
// Data path:
//   1. resolveSessionWithDevOverride() · sealed 2026-11-12 parity rule.
//   2. listConversationsForAccount(session.account.id)
//      · returns every business-scoped conversation the viewer is a
//        participant on (customer AND business sides).
//      · we filter server-side to `my_side === 'business'` so only
//        shop-owner threads are shown.
//   3. Group by `business.id` so the UI reads
//        "Shop Name"
//          · Customer A · 2 unread · 2 min ago
//          · Customer B · · · · · · 1 unread · yesterday
//
// Phone-frame compliant · dark backdrop like the rest of the Shop
// management chrome · tap any row → /nex-native/conversations/<id>
// which routes straight into the sealed Shop Chat shell.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listConversationsForAccount } from "@/lib/nex-native/conversation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_INK = "#F2F5F8";
const NEX_INK_DIM = "#8BA9D1";
const NEX_ACCENT = "var(--nex-world-secondary, #C6A15B)";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffSec = Math.round((now - then) / 1000);
    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    const diffDays = Math.floor(diffSec / 86400);
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default async function ShopChatInboxPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/shop/inbox");
  }

  // Load every conversation the viewer participates in · filter to
  // the BUSINESS side (where they are the shop owner). Honest empty
  // state when the owner has no shop-side threads yet.
  const conversations = await listConversationsForAccount(session.account.id).catch(
    () => [],
  );
  const businessThreads = conversations.filter((c) => c.my_side === "business");

  // Group by shop id. Map preserves insertion order; since
  // listConversationsForAccount already sorts newest-first by
  // activity, the first conversation we see for a shop pins that
  // shop's group to the top-most position in the inbox.
  const byShop = new Map<
    string,
    {
      shopId: string;
      shopName: string;
      shopSlug: string | null;
      shopLogoUrl: string | null;
      threads: Array<{
        conversationId: string;
        customerName: string;
        lastMessageAtIso: string | null;
        unread: number;
      }>;
      totalUnread: number;
    }
  >();
  for (const c of businessThreads) {
    const bucket =
      byShop.get(c.business.id) ??
      ({
        shopId: c.business.id,
        shopName: c.business.display_name,
        shopSlug: c.business.slug ?? null,
        shopLogoUrl: c.business.logo_url ?? null,
        threads: [],
        totalUnread: 0,
      } as const);
    const nextBucket = {
      ...bucket,
      threads: [
        ...bucket.threads,
        {
          conversationId: c.conversation.id,
          customerName: c.other_display_name ?? "Customer",
          lastMessageAtIso: c.last_message?.created_at ?? null,
          unread: c.unread_count ?? 0,
        },
      ],
      totalUnread: bucket.totalUnread + (c.unread_count ?? 0),
    };
    byShop.set(c.business.id, nextBucket);
  }
  const shopGroups = Array.from(byShop.values());

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-shop-inbox
        style={{
          position: "absolute",
          inset: 0,
          background: NEX_BG,
          color: NEX_INK,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 14px) 16px calc(env(safe-area-inset-bottom, 0px) + 14px)",
          boxSizing: "border-box",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 12,
            borderBottom: "1px solid rgba(198, 161, 91, 0.25)",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 900,
                color: NEX_INK,
                letterSpacing: "-0.01em",
              }}
            >
              Shop Chat Inbox
            </h1>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: NEX_INK_DIM,
              }}
            >
              Every customer conversation across your shops · newest first
            </p>
          </div>
          <Link
            href="/nex-native/manage/shop"
            aria-label="Back to shop management"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: NEX_ACCENT,
              textDecoration: "none",
              padding: "6px 10px",
              borderRadius: 999,
              border: `1px solid ${NEX_ACCENT}55`,
            }}
          >
            ← Manage
          </Link>
        </header>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            marginTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {shopGroups.length === 0 ? (
            <div
              data-nex-shop-inbox-empty
              style={{
                padding: "48px 20px",
                textAlign: "center",
                color: NEX_INK_DIM,
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              No customer conversations yet.
              <br />
              When a customer taps <strong>More Details</strong> on a product or
              opens your Shop Chat, their thread lands here.
            </div>
          ) : (
            shopGroups.map((group) => (
              <section
                key={group.shopId}
                data-nex-shop-inbox-group={group.shopId}
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    paddingBottom: 6,
                    borderBottom: "1px dashed rgba(198, 161, 91, 0.2)",
                  }}
                >
                  {group.shopLogoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={group.shopLogoUrl}
                      alt={group.shopName}
                      width={28}
                      height={28}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      aria-hidden
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "rgba(198, 161, 91, 0.15)",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 15,
                      fontWeight: 800,
                      color: NEX_INK,
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {group.shopName}
                  </h2>
                  {group.totalUnread > 0 ? (
                    <span
                      data-nex-shop-inbox-group-unread
                      style={{
                        fontSize: 11,
                        fontWeight: 900,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "#E64D4D",
                        color: "#FFFFFF",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {group.totalUnread}
                    </span>
                  ) : null}
                </div>

                {group.threads.map((t) => (
                  <Link
                    key={t.conversationId}
                    href={`/nex-native/conversations/${t.conversationId}`}
                    data-nex-shop-inbox-thread={t.conversationId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "rgba(255, 255, 255, 0.03)",
                      color: NEX_INK,
                      textDecoration: "none",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: NEX_INK,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t.customerName}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: NEX_INK_DIM,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatRelativeTime(t.lastMessageAtIso)}
                      </span>
                    </div>
                    {t.unread > 0 ? (
                      <span
                        data-nex-shop-inbox-thread-unread
                        style={{
                          fontSize: 11,
                          fontWeight: 900,
                          padding: "2px 7px",
                          borderRadius: 999,
                          background: "#E64D4D",
                          color: "#FFFFFF",
                          flexShrink: 0,
                        }}
                      >
                        {t.unread}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </section>
            ))
          )}
        </div>
      </main>
    </>
  );
}
