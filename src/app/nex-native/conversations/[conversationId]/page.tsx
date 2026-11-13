// src/app/nex-native/conversations/[conversationId]/page.tsx
//
// Owner-sealed 2026-11-13 · Business-scoped shop chat UI route.
// -----------------------------------------------------------------------------
// This is the MISSING route Contacts has been linking to for business
// conversations (customer ↔ shop owner, keyed to nex_business.id via
// nex_conversation.business_id). Supersedes the shop-FAB's previous
// detour through /chat/peer/<ownerAccountId> which collapsed every
// shop a single owner runs into one personal thread.
//
// Independence contract:
//   · Each (customer, business) pair gets its OWN nex_conversation.
//     Owners with multiple shops get independent threads per shop
//     with the same customer · zero cross-talk between shops.
//   · Identity shown to the customer is the SHOP (nex_business),
//     not the owner's personal NEX ID or display name.
//   · Chat wallpaper reads from the shop's shop_cover_image_url so
//     the customer visually continues the shop they were browsing.
//
// Encryption contract:
//   · Messages use the nex_message table extended by mig 345 with the
//     sealed device-only E2E crypto columns (ciphertext / nonce /
//     sender_public_key / sender_device_id / recipient_device_id).
//   · Server NEVER sees plaintext bodies. Clients decrypt locally.
//   · Product attachments ride attachment_type='product' +
//     attachment_meta.product_id · same shape as the peer-message
//     product-share attachment contract (mig 059 shape).
//
// Guards:
//   · Caller must be a participant of the conversation
//     (nex_conversation_participant row for this account_id) · else
//     403-equivalent via notFound() so we don't leak conversation
//     existence.
//   · Shop owner viewing a conversation with their OWN shop sees the
//     CUSTOMER face · opposite side from the customer's view.

import type * as React from "react";
import { notFound, redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import * as productService from "@/lib/nex-native/product-service";
import * as businessService from "@/lib/nex-native/business-service";
import { getAccountById } from "@/lib/nex-native/account-service";
import { getProfileByAccountId } from "@/lib/nex-native/account-profile-service";
import { listBusinessMessages } from "@/lib/nex-native/business-message-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ conversationId: string }>;
}

export default async function BusinessConversationPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { conversationId } = await params;

  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect(
      `/nex-native/sign-in?next=${encodeURIComponent(
        `/nex-native/conversations/${conversationId}`,
      )}`,
    );
  }

  // ── Load the conversation + participants ──────────────────────────
  const convRes = await nexSupabaseAdmin
    .from("nex_conversation")
    .select("id, business_id, about_product_id, created_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (convRes.error || !convRes.data) {
    notFound();
  }
  const conversation = convRes.data as {
    id: string;
    business_id: string;
    about_product_id: string | null;
    created_at: string;
  };

  const partsRes = await nexSupabaseAdmin
    .from("nex_conversation_participant")
    .select("account_id, side, last_read_at")
    .eq("conversation_id", conversationId);
  if (partsRes.error) {
    throw new Error(
      `conversations page · participants load failed: ${partsRes.error.message}`,
    );
  }
  const participants = (partsRes.data ?? []) as Array<{
    account_id: string;
    side: "customer" | "business";
    last_read_at: string | null;
  }>;

  const viewerParticipant = participants.find(
    (p) => p.account_id === session.account.id,
  );
  if (!viewerParticipant) {
    // 403-equivalent · don't leak existence
    notFound();
  }
  const otherParticipant = participants.find(
    (p) => p.account_id !== session.account.id,
  );

  // ── Load the shop + its live products (parallel) ──────────────────
  const [business, products, otherAccount] = await Promise.all([
    businessService.getBusinessById(conversation.business_id).catch(() => null),
    productService
      .listProductsByBusiness(conversation.business_id, "live")
      .catch(() => [] as Awaited<ReturnType<typeof productService.listProductsByBusiness>>),
    otherParticipant
      ? getAccountById(otherParticipant.account_id).catch(() => null)
      : Promise.resolve(null),
  ]);

  if (!business) {
    throw new Error("conversations page · business row missing");
  }

  // ── Load the message history (participant guard happens inside) ───
  const messages = await listBusinessMessages(
    conversationId,
    session.account.id,
  );

  // ── Resolve viewer-side identity framing ──────────────────────────
  // Customer viewing the shop    → sees shop name/logo + shop wallpaper
  // Owner viewing their customer → sees customer's name/avatar
  const viewerIsCustomer = viewerParticipant.side === "customer";
  const headerName = viewerIsCustomer
    ? business.display_name
    : (otherAccount?.display_name ?? "Customer");
  const headerSubtitle = viewerIsCustomer
    ? "Shop · tap to open"
    : (business.display_name
        ? `Customer · ${business.display_name}`
        : "Customer");
  const otherProfile = otherAccount
    ? await getProfileByAccountId(otherAccount.id).catch(() => null)
    : null;
  const headerAvatarUrl = viewerIsCustomer
    ? (business.logo_url ?? null)
    : (otherProfile?.avatar_url ?? null);
  const wallpaperUrl = business.shop_cover_image_url ?? null;

  // Apply the 2-word stack rule when framing shows the SHOP name.
  const displayNameStacked = viewerIsCustomer
    ? (() => {
        const w = (business.display_name ?? "").trim().split(/\s+/);
        if (w.length <= 1) return business.display_name ?? "";
        return `${w[0]}\n${w[1]}`;
      })()
    : headerName;

  return (
    <main
      data-nex-business-conversation
      data-nex-conversation-id={conversationId}
      data-nex-business-id={business.id}
      style={{
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        backgroundColor: "#0A1526",
        backgroundImage: wallpaperUrl ? `url(${wallpaperUrl})` : undefined,
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "local",
        color: "#F2F5F8",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Sticky shop identity header. */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px",
          background: "rgba(10, 21, 38, 0.78)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {headerAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={headerAvatarUrl}
            alt={headerName}
            width={44}
            height={44}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "1.5px solid rgba(198, 161, 91, 0.55)",
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            data-nex-business-conv-header-title
            style={{
              fontSize: 17,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.005em",
              whiteSpace: "pre-line",
              textShadow: "0 1px 3px rgba(0,0,0,0.6)",
            }}
          >
            {displayNameStacked}
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 12,
              fontWeight: 500,
              color: "#B5C3D6",
              letterSpacing: "0.02em",
              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            }}
          >
            {headerSubtitle}
          </div>
        </div>
      </header>

      {/* Message list + composer are wired through a client component
          that owns the realtime subscription, encrypted send, and the
          3-dot products drawer. Mount below. */}
      <BusinessConversationClient
        conversationId={conversationId}
        selfAccountId={session.account.id}
        peerAccountId={otherParticipant?.account_id ?? null}
        businessId={business.id}
        businessDisplayName={business.display_name}
        businessCategory={business.business_category ?? null}
        shopProducts={products}
        initialMessages={messages}
        viewerSide={viewerParticipant.side}
      />
    </main>
  );
}

// ─── Client shell · dynamically imported to keep server tree lean ──

import { BusinessConversationClient } from "./_client";
