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
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import * as productService from "@/lib/nex-native/product-service";
import * as businessService from "@/lib/nex-native/business-service";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { getAccountById } from "@/lib/nex-native/account-service";
import { getProfileByAccountId } from "@/lib/nex-native/account-profile-service";
import { listBusinessMessages } from "@/lib/nex-native/business-message-service";
// Owner directive 2026-11-13 (iter 14) · fallback flag resolver ·
// when nex_business.operating_country_code is missing (sandbox has
// not applied migration 286) we derive the ISO2 from the owner's
// phone dialling prefix. Keeps the rim flag honest without needing
// a schema migration.
import { iso2FromPhoneCountryCode } from "@/lib/nex-native/country-catalogue";

// Owner directive 2026-11-13 · ISO 3166-1 alpha-2 → regional-indicator
// flag emoji · same mechanic the rest of the app uses to render
// country flags without a CDN hit. Returns "" for unknown codes.
function countryCodeToFlag(iso2: string | null | undefined): string {
  if (!iso2 || iso2.length !== 2) return "";
  const up = iso2.toUpperCase();
  const base = 0x1f1e6;
  const a = up.charCodeAt(0);
  const b = up.charCodeAt(1);
  if (a < 65 || a > 90 || b < 65 || b > 90) return "";
  return (
    String.fromCodePoint(base + (a - 65)) +
    String.fromCodePoint(base + (b - 65))
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ conversationId: string }>;
  // Owner directive 2026-11-14 · optional product id carried in from
  // the Product Detail Sheet's "More Details" button. Resolved to a
  // snapshot below · only accepted when the product belongs to THIS
  // conversation's shop so an attacker can't force-render a card
  // from an unrelated shop by hand-editing the URL.
  searchParams?: Promise<{ product?: string }>;
}

export default async function BusinessConversationPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { conversationId } = await params;
  const sp = searchParams ? await searchParams : {};

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

  // ── Load the shop + its live products + fallback theme (parallel) ─
  // Owner directive 2026-11-13 · wallpaper must match what the public
  // shop page paints · same fallback chain
  // `shop_cover_image_url ?? themeRow.hero_image_url` as the shop
  // surface at /[businessSlug] uses.
  const [business, products, otherAccount, themeRow] = await Promise.all([
    businessService.getBusinessById(conversation.business_id).catch(() => null),
    productService
      .listProductsByBusiness(conversation.business_id, "live")
      .catch(() => [] as Awaited<ReturnType<typeof productService.listProductsByBusiness>>),
    otherParticipant
      ? getAccountById(otherParticipant.account_id).catch(() => null)
      : Promise.resolve(null),
    chatThemeService.getThemeById("nex-flat").catch(() => null),
  ]);

  if (!business) {
    throw new Error("conversations page · business row missing");
  }

  // ── Load the message history (participant guard happens inside) ───
  const messages = await listBusinessMessages(
    conversationId,
    session.account.id,
  );

  // ── Resolve the optional ?product=<id> context card ────────────────
  // Owner directive 2026-11-14 · "More Details" on the Product Detail
  // Sheet brings the customer here with `?product=<id>`. We validate
  // the shape, reject when the product doesn't belong to THIS shop,
  // and hand a serialisable snapshot to the client shell so it can
  // render a pinned context chip above the composer.
  //
  // Stage 10 · item 18 · 2026-11-14 · when the URL CARRIED a product
  // id but we couldn't resolve it (bad shape, deleted product, or
  // cross-shop tamper), the client now gets `productResolutionFailed
  // = true` so it can paint a non-alarming banner explaining the
  // customer can just describe their question instead. Honest failure
  // · never silently loses the user's intent.
  const PRODUCT_UUID_SHAPE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const pendingProductIdRaw = sp.product?.trim() ?? "";
  const pendingProduct = await (async () => {
    if (
      !pendingProductIdRaw ||
      !PRODUCT_UUID_SHAPE.test(pendingProductIdRaw)
    ) {
      return null;
    }
    // Shop-scope ownership check · the product MUST belong to this
    // conversation's business or we refuse to render it (prevents URL
    // tampering from showing a foreign-shop card in this chat).
    const match = products.find((p) => p.id === pendingProductIdRaw);
    if (match) {
      return {
        id: match.id,
        name: match.name,
        price_pence: match.price_pence,
        currency: match.currency,
        image_url: match.image_url ?? null,
        description: match.description ?? null,
      };
    }
    // Fall back to a direct lookup for products that may not be in
    // the "live" list (archived / sold-out · still valid for a chat
    // context card so the owner can answer questions about them).
    const direct = await productService
      .getProductById(pendingProductIdRaw)
      .catch(() => null);
    if (!direct || direct.business_id !== business.id) return null;
    return {
      id: direct.id,
      name: direct.name,
      price_pence: direct.price_pence,
      currency: direct.currency,
      image_url: direct.image_url ?? null,
      description: direct.description ?? null,
    };
  })();
  // Stage 10 · item 18 · 2026-11-14 · "we tried but couldn't" marker
  // so the client can render a soft banner instead of silently
  // dropping the customer's intent. True when the URL carried a
  // product id but we refused it (bad shape, foreign shop, deleted).
  const productResolutionFailed =
    pendingProductIdRaw.length > 0 && pendingProduct === null;

  // ── Resolve viewer-side identity framing ──────────────────────────
  // Customer viewing the shop    → sees shop name/logo + shop wallpaper
  // Owner viewing their customer → sees customer's name/avatar
  const viewerIsCustomer = viewerParticipant.side === "customer";
  const headerName = viewerIsCustomer
    ? business.display_name
    : (otherAccount?.display_name ?? "Customer");
  // Owner directive 2026-11-13 · subtitle shows the shop's city (was
  // the fixed "Shop · tap to open" string). Falls back to a quiet
  // "Shop" when the owner hasn't filled the city field yet.
  const headerSubtitle = viewerIsCustomer
    ? ((business.city ?? "").trim() || "Shop")
    : (business.display_name
        ? `Customer · ${business.display_name}`
        : "Customer");
  const otherProfile = otherAccount
    ? await getProfileByAccountId(otherAccount.id).catch(() => null)
    : null;
  const headerAvatarUrl = viewerIsCustomer
    ? (business.logo_url ?? null)
    : (otherProfile?.avatar_url ?? null);
  // Owner directive 2026-11-13 · match the shop page wallpaper fallback
  // chain · shop_cover_image_url → themeRow.hero_image_url → none.
  const wallpaperUrl =
    business.shop_cover_image_url ?? themeRow?.hero_image_url ?? null;
  // Owner directive 2026-11-13 (iter 8) · same accent-resolution formula
  // as the public shop surface (`/[businessSlug]/page.tsx` line 258-262)
  // · shop_cover_tint_hex when the owner set one · else themeRow accent
  // · else the sealed NEX gold fallback. Validates the hex shape before
  // accepting a user-set tint so a malformed value can't paint a broken
  // gradient.
  const accentHex =
    business.shop_cover_tint_hex &&
    /^#[0-9A-Fa-f]{6}$/.test(business.shop_cover_tint_hex)
      ? business.shop_cover_tint_hex
      : (themeRow?.accent_hex ?? "#C6A15B");
  // Owner directive 2026-11-13 · country flag badge on the avatar rim.
  // Customer view · shop's operating country if set · else derive from
  // the owner's phone dialling prefix (handles sandbox rows that
  // pre-date mig 286). Owner view · customer's profile country first,
  // then phone-prefix fallback.
  const flagIso = viewerIsCustomer
    ? (business.operating_country_code ??
        iso2FromPhoneCountryCode(otherAccount?.phone_country_code ?? null))
    : (otherProfile?.country_code ??
        iso2FromPhoneCountryCode(otherAccount?.phone_country_code ?? null));
  const flagEmoji = countryCodeToFlag(flagIso);
  // Owner directive 2026-11-13 (iter 14) · tapping the avatar opens
  // the relevant profile page. Customer side → shop public surface
  // (/<slug>). Owner side → customer's nex-handle profile.
  const avatarHref = viewerIsCustomer
    ? `/nex-native/${business.slug}`
    : otherAccount?.nex_handle
      ? `/nex-native/profile/${otherAccount.nex_handle}`
      : null;

  // Owner directive 2026-11-13 (iter 4) · shop name sits on ONE line
  // when it fits next to the shop icon · CSS wraps to 2 lines only when
  // the title column is too tight. Previously we hard-forced a newline
  // between the first two words (pre-line + \n) which always rendered
  // two rows even when a single row fit comfortably. Now we let CSS do
  // the work via `overflow-wrap: break-word` on a `min-width: 0` title
  // column — natural word-boundary wrapping, no manual splitting.
  const displayNameStacked = viewerIsCustomer
    ? (business.display_name ?? "")
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
      {/* Owner directive 2026-11-13 (iter 3) · header carries three
          affordances:
            · Avatar w/ green ring + pulsing ping (presence tell) + a
              small round country-flag badge pinned to the rim.
            · Title sized up a notch · subtitle now reads the shop city.
            · Right-side shop-glyph button that routes the customer to
              the shop's public surface (/nex-native/<slug>).
          Container chrome (dark backdrop-blur bar + border) retired
          earlier · header still paints transparently over the shop
          wallpaper. */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px",
          background: "transparent",
          borderBottom: "none",
        }}
      >
        {/* Avatar block · 48px square so the green ring + ping sit
            correctly without clipping. The ping is a sibling ring that
            animates scale + opacity · the solid ring is the inner
            green border on the avatar itself.
            Owner directive 2026-11-13 (iter 14) · when the viewer is
            the customer the whole avatar routes to the shop public
            surface. Owner-side routes to the customer's nex-handle
            profile. No href = non-tappable (fallback). */}
        {(() => {
          const avatarInner = (
            <>
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  inset: -2,
                  borderRadius: "50%",
                  border: "2px solid #22C55E",
                  opacity: 0.85,
                  animation:
                    "nex-biz-conv-ping 1600ms cubic-bezier(0.22, 1, 0.36, 1) infinite",
                  pointerEvents: "none",
                }}
              />
              {headerAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={headerAvatarUrl}
                  alt={headerName}
                  width={48}
                  height={48}
                  style={{
                    position: "relative",
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    border: "2.5px solid #22C55E",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  aria-hidden
                  style={{
                    position: "relative",
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.08)",
                    border: "2.5px solid #22C55E",
                  }}
                />
              )}
              {flagEmoji ? (
                <span
                  aria-label={flagIso ?? undefined}
                  title={flagIso ?? undefined}
                  style={{
                    position: "absolute",
                    right: -2,
                    bottom: -2,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "#FFFFFF",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 13,
                    lineHeight: 1,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
                    border: "1.5px solid rgba(0,0,0,0.15)",
                    overflow: "hidden",
                  }}
                >
                  {flagEmoji}
                </span>
              ) : null}
            </>
          );
          const wrapperStyle: React.CSSProperties = {
            position: "relative",
            width: 48,
            height: 48,
            flexShrink: 0,
          };
          return avatarHref ? (
            <Link
              href={avatarHref}
              aria-label={`Open ${headerName} profile`}
              data-nex-business-conv-avatar-link
              style={{ ...wrapperStyle, display: "block", textDecoration: "none" }}
            >
              {avatarInner}
            </Link>
          ) : (
            <div data-nex-business-conv-avatar style={wrapperStyle}>
              {avatarInner}
            </div>
          );
        })()}
        {/* Keyframes for the ping · scoped inline so we don't touch any
            global stylesheet · identical cadence/easing to the sealed
            heartbeat on the contacts page. */}
        <style>{`
          @keyframes nex-biz-conv-ping {
            0%   { transform: scale(1);    opacity: 0.85; }
            70%  { transform: scale(1.35); opacity: 0;    }
            100% { transform: scale(1.35); opacity: 0;    }
          }
        `}</style>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            data-nex-business-conv-header-title
            style={{
              fontSize: 16,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.005em",
              // Owner directive 2026-11-13 (iter 5) · natural wrap.
              // Title stays on one row when it fits · wraps on word
              // boundary only when the column is too narrow for the
              // shop-icon column.
              whiteSpace: "normal",
              wordBreak: "normal",
              overflowWrap: "break-word",
              textShadow: "0 1px 3px rgba(0,0,0,0.6)",
            }}
          >
            {displayNameStacked}
          </div>
          <div
            style={{
              marginTop: 3,
              fontSize: 12,
              fontWeight: 500,
              color: "#B5C3D6",
              letterSpacing: "0.02em",
              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {/* Owner directive 2026-11-13 (iter 18) · red map-pin
                icon beside the city line · same visual language the
                shop page uses in its About block. */}
            {viewerIsCustomer ? (
              <svg
                width={12}
                height={12}
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
                style={{ flexShrink: 0 }}
              >
                <path
                  d="M12 22s-7-7.5-7-13a7 7 0 1 1 14 0c0 5.5-7 13-7 13z"
                  fill="#EF4444"
                  stroke="#000000"
                  strokeWidth={1}
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="9" r="2.5" fill="#FFFFFF" />
              </svg>
            ) : null}
            {headerSubtitle}
          </div>
        </div>
        {/* Right-side shop icon · taps through to the public shop page
            for the business the customer is chatting with. Only shown
            on the CUSTOMER face (an owner in their own thread doesn't
            need a shortcut to their own shop surface). */}
        {viewerIsCustomer ? (
          <Link
            href={`/nex-native/${business.slug}`}
            aria-label={`Open ${business.display_name} shop page`}
            data-nex-business-conv-shop-link
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              // Owner directive 2026-11-13 (iter 11) · shop button
              // header BLACK · solid black circle, gold glyph reads
              // over it cleanly regardless of wallpaper behind.
              background: "#000000",
              border: "1px solid rgba(255,255,255,0.12)",
              display: "grid",
              placeItems: "center",
              color: "#C6A15B",
              flexShrink: 0,
              textDecoration: "none",
              boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
            }}
          >
            {/* storefront glyph · currentColor so it inherits the gold */}
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 9l1.2-4h13.6L20 9M4 9h16M4 9v10h6v-6h4v6h6V9"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        ) : null}
      </header>

      {/* Bridge 74 · ensure this browser has a Curve25519 device key
          AND its public key is registered on the server. Without this
          mount, a fresh browser context (Playwright, incognito, new
          device) generates a local keypair that the server never
          learns about · outgoing fan-out addresses old devices only ·
          incoming rows can't be decrypted. DeviceKeyHub is session-
          aware (upsertDeviceKeyAction gates on resolveNexAppSession
          FromContext) and idempotent (refreshes last_seen_at on
          repeat calls). Same mount used at /chat/peer/[accountId]
          — see that page.tsx:1919. */}
      <DeviceKeyHub />

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
        accentHex={accentHex}
        // Owner directive 2026-11-13 (iter 20) · peer identity on BOTH
        // viewer sides · customer face sees the SHOP LOGO beside shop
        // bubbles (matches the header avatar) · owner face sees the
        // CUSTOMER's profile avatar beside customer bubbles. Tap →
        // relevant profile surface (shop slug for customer, nex-handle
        // for owner).
        peerAvatarUrl={
          viewerParticipant.side === "customer"
            ? (business.logo_url ?? null)
            : (otherProfile?.avatar_url ?? null)
        }
        peerLinkHref={
          viewerParticipant.side === "customer"
            ? `/nex-native/${business.slug}`
            : otherAccount?.nex_handle
              ? `/nex-native/profile/${otherAccount.nex_handle}`
              : null
        }
        peerDisplayName={
          viewerParticipant.side === "customer"
            ? business.display_name
            : (otherAccount?.display_name ?? null)
        }
        shopProducts={products}
        initialMessages={messages}
        viewerSide={viewerParticipant.side}
        pendingProduct={pendingProduct}
        productResolutionFailed={productResolutionFailed}
        /* Stage 7 · item 4 · 2026-11-14 · universal chat-controls
           contract. scannedAccountId is intentionally NULL for the
           business-scoped conversation (the subject is the SHOP, not
           a peer account · there is no profile to "scan" into).
           viewerAccountId carries the signed-in viewer identity so
           universal chat-chrome can resolve its POV without a second
           server lookup. Closes _universal-chat-controls.test.ts §D. */
        scannedAccountId={null}
        viewerAccountId={session.account.id}
      />
    </main>
  );
}

// ─── Client shell · dynamically imported to keep server tree lean ──

import { BusinessConversationClient } from "./_client";
import { DeviceKeyHub } from "../../chat/peer/[accountId]/_device-key-hub";
