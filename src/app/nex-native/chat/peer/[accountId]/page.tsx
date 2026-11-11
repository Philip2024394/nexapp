// src/app/nex-native/chat/peer/[accountId]/page.tsx
//
// NEX peer-to-peer chat · Portrait Bloom shell.
// ---------------------------------------------
// Renders friend↔friend conversations using the sealed Portrait Bloom
// design language shared with business chat. The peer's identity
// dominates the visual space (their avatar becomes the environment)
// and messages float over the fade zone.
//
// Refinements included:
//   · portrait breathes on an 8-second loop
//   · one-shot chat-theme ripple when the last inbound is < 15s old
//   · offline desaturation via ?online=0 (until presence Bridge lands)
//
// Backend is Bridge 3 (peer-conversation-service + peer-message-service).

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as accountService from "@/lib/nex-native/account-service";
import * as friendService from "@/lib/nex-native/friend-service";
import * as relationshipService from "@/lib/nex-native/relationship-service";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as peerMessageService from "@/lib/nex-native/peer-message-service";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { listThemeEmojis } from "@/lib/nex-native/theme-emoji-service";
import { listThemeStickers } from "@/lib/nex-native/theme-sticker-service";
import { getThemeAssets } from "@/lib/nex-native/theme-assets";
import { ThemeAtmosphereLayer } from "../../_theme-atmosphere-layer";
import {
  sendPeerMessageAction,
  sendPeerMessageOrShareProductAction,
  sendPeerStickerAction,
  deletePeerMessageAction,
  uploadPeerAttachmentAction,
  sendProductInquiryAction,
  sendCartOrderAction,
  toggleMessageReactionAction,
} from "../../../_actions";
// Bridge 96 · CORE + CHROME registry (see
// src/lib/nex-native/chat-render/README.md · Founder-set 2026-09-29
// for 100+ theme scalability). The peer-chat page never imports a
// chrome directly — it calls resolveChromeSet(layoutStyle) and
// renders what comes back. Every existing chrome (bubbles / sky_cards
// / timeline_ribbon / terminal) currently delegates to
// PortraitBloomShell so Phase 1 is behaviour-preserving. Phase 2+
// lifts individual chromes into their own implementations.
import { type PortraitBloomPresenceKind } from "../../_portrait-bloom-shell";
import { resolveChromeSet } from "@/lib/nex-native/chat-render/registry";
import { PeerCallLauncher } from "./_call-launcher";
// Owner directive 2026-11-04 later-same-day · NEX Global Chat UI
// Standard (Chat 9001) · the 3-dots Call Center drawer FAB from
// free-chat is also mounted on peer-chat so every chat surface
// carries the same bottom-right floating action button.
import { FreeChatCallCenterDrawerClient } from "../../../free-chat/_call-center-drawer-client";
// Owner-authorised 2026-11-05 · prototype UX promoted to production.
// FreeChatHeader (shared Chat 9001 identity row + grid + "+" drawer),
// NotificationsDrawer, ShopDrawer, and the floating scroll-to-bottom
// button are layered on top of the sealed PortraitBloomShell · Shell's
// internal ChatIdentityHeader + HeaderRightCluster are hidden via
// scoped CSS so only ONE top chrome shows. Shell keeps rendering
// bubbles + composer + theme wallpaper + all production features.
import { FreeChatHeader } from "@/components/nex-native/chat-chrome/free-chat-header";
import { NotificationsDrawer } from "@/components/nex-native/notifications-drawer/notifications-drawer-client";
// Owner directive 2026-11-06 · when the peer owns a shop render a
// 🏪 badge inline with their chat name · tap opens the shop. peer
// business is already loaded above (peerBusiness) · ShopBadge just
// renders the resolved info.
import { ShopBadge } from "@/components/nex-native/shop-badge";
// Owner-authored 2026-11-05 · real incoming-invite notifications ·
// replaces the mock "follows" section with live pending-incoming
// friend-edges so the viewer sees who's inviting them.
import {
  MOCK_NOTIFICATIONS,
  type NotificationItem,
} from "@/lib/nex-native/notifications/mock-notifications-data";
import { ShopDrawer } from "@/components/nex-native/shop-drawer/shop-drawer-client";
import { ScrollToBottomButton } from "@/components/nex-native/chat-chrome/scroll-to-bottom-button";
import { effectiveTier } from "@/lib/nex-native/account-service";
import { ChatErrorBanner } from "./_error-banner";
import { PeerTypingClient } from "./_typing-client";
import { PeerPresenceClient } from "./_presence-client";
import { PeerMessageEventsClient } from "./_message-events-client";
import { DeviceKeyHub } from "./_device-key-hub";
import { E2eDecryptor } from "./_e2e-decryptor";
import { E2eComposerIntercept } from "./_e2e-composer-intercept";
import { ArchivePanel } from "./_archive-panel";
import { FocusedShopSheet } from "./_focused-shop-sheet";
// Owner fix 2026-11-05 · ContactPickerLauncher retired · import removed.
// Owner-authored 2026-11-05 · fresh-conversation welcome pill (Option B)
// with time + delivery ticks + peer presence dot.
import { WelcomePillClient } from "./_welcome-pill-client";
// Toast host moved to /nex-native/layout.tsx (global) · owner-authored 2026-11-05.
// Owner-authored 2026-11-05 · world-class chat parity · jump the viewer
// to the first unread message when they open a chat with unread history.
import { JumpToUnreadClient } from "./_jump-to-unread-client";
// Owner-authored 2026-11-05 later-same-day iter 7 · world-class chat
// parity · long-press / right-click bubble action menu (Reply + Copy)
// as an external overlay · zero Shell modification.
import { BubbleActionMenuClient } from "./_bubble-action-menu-client";
// Owner-authored 2026-11-05 later-same-day iter 10 · edit sent message
// server action · depends on migration 279 (DRAFT · not yet applied).
import { editPeerMessageAction } from "./_edit-actions";
// Owner-authored 2026-11-05 later-same-day iter 11 · in-chat search ·
// pure client overlay · Cmd/Ctrl+K · zero Shell edit.
import { SearchClient } from "./_search-client";
import type {
  SideNavContact,
  PendingInvite,
} from "../../_side-nav-panel";
import * as businessService from "@/lib/nex-native/business-service";
import {
  hasCurrentSafeTradeConsent,
  CURRENT_SAFE_TRADE_TERMS_VERSION,
} from "@/lib/nex-native/safe-trade-consent-service";
import {
  resolveLocale,
  SAFE_TRADE_STRINGS,
} from "@/lib/nex-native/i18n/safe-trade-strings";
import { headers } from "next/headers";
import {
  acknowledgeSafeTradeAction,
  toggleLikeProductAction,
} from "../../../_actions";
import { SafeTradeConsentModal } from "./_safe-trade-consent-modal";
import * as productService from "@/lib/nex-native/product-service";
import * as menuService from "@/lib/nex-native/menu-service";
import * as productSectionService from "@/lib/nex-native/product-section-service";
import { isVenueCategory } from "@/lib/nex-native/types";
import { isNexOfficialAccount } from "@/lib/nex-native/nex-official";
// R9 Stage 4 (2026-10-15 · migration 199 unapplied) · server-resolve
// the viewer's chat preferences so the sealed typing/presence client
// components can honour them. getChatPreferencesSafe never throws ·
// on service error returns PRIVACY-MAXIMUM (typing + online status
// both disabled) which is the correct fail-closed stance.
import { getChatPreferencesSafe } from "@/lib/nex-native/chat-preferences-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Peer's chat theme now resolves via chat-theme-service (Bridge 4 ·
// nex_chat_theme table) so admin-created themes light up on any
// existing peer's chat without a code change. Fallback baked in for
// unknown / inactive rows.

export default async function PeerChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{
    online?: string;
    reply?: string;
    /** Set by sendPeerMessageAction when sender hits recipient's
     *  contacts-only wall or the send pipeline fails. Enum:
     *  contacts_only | send_failed. Rendered by ChatErrorBanner. */
    message_error?: string;
    /** Set by sendPeerStickerAction · same classes as message_error. */
    sticker_error?: string;
    delete_error?: string;
    attachment_url?: string;
    attachment_type?: string;
    attachment_encrypted?: string;
    /** Stage A · owner-authorised 2026-11-03 · document meta forwarded
     *  by uploadPeerAttachmentAction on the redirect query string so
     *  the composer can smuggle filename/size/mime through to the
     *  send form. Only populated when attachment_type === "document";
     *  image/video/audio continue to omit these fields. */
    attachment_filename?: string;
    attachment_size?: string;
    attachment_mime?: string;
    upload_error?: string;
    lang?: string;
    /** Phase 3 · product id to auto-open the shop sheet focused on.
     *  When present, the FocusedShopSheet mounts and scrolls that
     *  card into view with a 2px accent border. Honest-null · an
     *  unknown id still mounts the sheet but no card is highlighted. */
    focus_product?: string;
    /** Owner directive 2026-10-22 · Ask-Seller slice 2 · product id
     *  the buyer wants to ask the owner about. When present AND the
     *  product resolves to a valid snapshot, the composer renders a
     *  product-card chip above the pill (buyer can type an optional
     *  question or send the card alone). Slice 3 will route send
     *  through shareProductToContactAction. Unknown id falls through
     *  silently · no chip appears · no error. */
    pending_product?: string;
    /** Owner directive 2026-10-22 · Live Commerce · when the viewer
     *  taps "Order now" on a product overlay during a live stream,
     *  the live_session_id is carried into chat as context. The
     *  composer renders a small "📺 From Live" badge next to the
     *  product chip so the owner knows the enquiry originated from
     *  a live stream (vs organic shop browsing). Session id is a
     *  client-generated uuid · no server lookup needed. */
    live_session_id?: string;
  }>;
}) {
  const { accountId: peerAccountId } = await params;
  const sp = await searchParams;
  // Bridge 16c · locale resolution for the consent modal. URL param
  // wins, then Accept-Language, then Bahasa Indonesia (launch market).
  const acceptLanguage = (await headers()).get("accept-language");
  // Presence Bridge isn't built yet · query param toggle for preview.
  const isOffline = sp.online === "0";
  const replyId = sp.reply?.trim() || null;
  // Bridge 6 · surfaced by deletePeerMessageAction on retract failure.
  // Consumed by <ChatErrorBanner /> below · raw Error.message is
  // sanitised to a bounded enum at the setter (_actions.ts).

  // Phase 3 · deep-link preservation across sign-in. When an unsigned
  // visitor taps a product thumbnail on a business page, their path
  // is `/nex-native/chat/peer/<peer>?focus_product=<id>`. We hand
  // that exact URL to sign-in via `?next=…`; the sign-in action
  // reads it back and redirects after a successful login, so the
  // selected product survives the auth round-trip. The reconstructed
  // url re-encodes to avoid injection; only chat-page params are
  // whitelisted here.
  const focusProductIdFromUrl =
    typeof sp.focus_product === "string" && sp.focus_product.length > 0
      ? sp.focus_product
      : null;
  // C-08 fix 2026-10-28 · pending_product must survive the sign-in
  // redirect so an unsigned Ask-Seller tap still routes the buyer
  // back to the exact product chip. Whitelist is explicit · only
  // these two chat-page params are rebuilt into `next=…` to avoid
  // reflecting attacker-supplied values back into the sign-in URL.
  const pendingProductIdFromUrl =
    typeof sp.pending_product === "string" && sp.pending_product.length > 0
      ? sp.pending_product
      : null;
  // Owner directive 2026-10-26 · dev persona impersonation.
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    const base = `/nex-native/chat/peer/${peerAccountId}`;
    const nextParams = new URLSearchParams();
    if (focusProductIdFromUrl) nextParams.set("focus_product", focusProductIdFromUrl);
    if (pendingProductIdFromUrl) nextParams.set("pending_product", pendingProductIdFromUrl);
    const nextQs = nextParams.toString();
    const nextUrl = nextQs ? `${base}?${nextQs}` : base;
    redirect(`/nex-native/sign-in?next=${encodeURIComponent(nextUrl)}`);
  }
  if (peerAccountId === session.account.id) redirect("/nex-native/chat");

  // Owner directive 2026-11-07 · guard against non-UUID peerAccountId
  // (e.g. "preview-account" from a template-preview iframe mock).
  // Postgres rejects non-UUID shapes with a hard 22P02 that surfaces
  // as a runtime error page; we'd rather treat it like a missing
  // peer and redirect cleanly.
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(peerAccountId)) {
    redirect("/nex-native/chat");
  }

  // R9 Stage 4 (2026-10-15 · migration 199 unapplied as of this commit)
  // · resolve the viewer's chat privacy preferences server-side.
  // getChatPreferencesSafe reads nex_account columns; when the migration
  // is not yet applied, every column is null → sealed defaults apply
  // (typing=true, last_seen='nobody', online='nobody'). The props below
  // flow through to PeerTypingClient + PeerPresenceClient so the client-
  // side gates match the server-side preference without an extra fetch.
  const chatPrefs = await getChatPreferencesSafe(session.account.id);

  // Bridge 16d · locale resolution now considers the account's
  // persisted preference (migration 071). URL param > account > header
  // > Indonesian market default.
  const locale = resolveLocale({
    urlParam: sp.lang ?? null,
    accountLocale: session.account.locale ?? null,
    acceptLanguage,
  });
  const safeTradeStrings = SAFE_TRADE_STRINGS[locale];

  const peer = await accountService.getAccountById(peerAccountId);
  if (!peer) redirect("/nex-native/chat");

  const profile = await (async () => {
    try {
      const svc = await import("@/lib/nex-native/account-profile-service");
      return await svc.getProfileByAccountId(peer.id);
    } catch {
      return null;
    }
  })();

  const conversation =
    await peerConversationService.getOrCreatePeerConversation(
      session.account.id,
      peer.id,
    );

  const [messages] = await Promise.all([
    peerMessageService.listPeerMessages(conversation.id),
    peerMessageService.markPeerMessagesRead(conversation.id, session.account.id),
  ]);

  // Owner-authored 2026-11-05 · first-unread id computed BEFORE the mark
  // flips read_at · passed to <JumpToUnreadClient> so the viewer lands
  // on the first message they haven't seen yet. Null when every message
  // is already read or the viewer is the sole sender.
  const firstUnreadMessageId: string | null =
    messages.find(
      (m) => m.sender_account_id !== session.account.id && !m.read_at,
    )?.id ?? null;

  // Owner directive 2026-10-22 · Ask-Seller slice 3 · composer-send
  // uses the dispatcher so a form carrying `product_id` (the pending-
  // product chip from Slice 2) routes through shareProductToContactAction.
  // Normal text/attachment sends pass through unchanged · the dispatcher
  // delegates to sendPeerMessageAction when product_id is absent.
  const bind = sendPeerMessageOrShareProductAction.bind(null, peer.id);
  // Keep a direct reference to the normal action available for callers
  // that bypass the dispatcher (e.g. sticker, reaction, or any future
  // code path that doesn't flow through the composer form).
  void sendPeerMessageAction;
  const bindDelete = deletePeerMessageAction.bind(null, peer.id);
  const bindUpload = uploadPeerAttachmentAction.bind(null, peer.id);
  const bindProductInquiry = sendProductInquiryAction.bind(null, peer.id);
  const bindReaction = toggleMessageReactionAction.bind(null, peer.id);
  // Bridge ThemeSticker · bind the peer id so the live action knows
  // which conversation to post into. Server-side validation then
  // resolves the sticker from the peer's chat_theme.
  const bindSticker = sendPeerStickerAction.bind(null, peer.id);

  // Bridge · shop icon in header · when the peer owns a business
  // with live products, the header renders a shop button that
  // opens the product grid modal. Fully fails safe · any service
  // error just hides the shop icon.
  const peerBusinesses = await businessService
    .listBusinessesByOwner(peer.id)
    .catch(() => [] as Awaited<ReturnType<typeof businessService.listBusinessesByOwner>>);
  const peerBusiness = peerBusinesses[0] ?? null;

  // Sealed 2026-10-01 · first-time shop-setup chooser · when the
  // VIEWER has no business of their own, tapping the shop icon
  // opens the 3-button chooser (Sell Products / Sell Food / Affiliate)
  // so new NEX users have an obvious on-ramp to selling. Viewers who
  // already run a shop go straight to the peer's product grid.
  const viewerBusinesses = await businessService
    .listBusinessesByOwner(session.account.id)
    .catch(() => [] as Awaited<ReturnType<typeof businessService.listBusinessesByOwner>>);
  const viewerHasBusiness = viewerBusinesses.length > 0;
  const peerProducts = peerBusiness
    ? await productService
        .listProductsByBusiness(peerBusiness.id, "live")
        .catch(() => [] as Awaited<ReturnType<typeof productService.listProductsByBusiness>>)
    : [];
  // Bridge 51 · food sellers (restaurant / cafe / bakery / bar / …)
  // keep their SKUs in nex_menu_item, not nex_product. Load menu items
  // when the peer's business is a venue category so the same slider
  // populates for every seller · one unified "browse what they sell"
  // grid regardless of whether they're a product seller or a food
  // seller. Founder direction 2026-09-29.
  const peerMenuItems =
    peerBusiness && isVenueCategory(peerBusiness.business_category)
      ? await menuService
          .listMenuItemsByBusiness(peerBusiness.id, { status: "live" })
          .catch(() => [] as Awaited<ReturnType<typeof menuService.listMenuItemsByBusiness>>)
      : [];
  // Bridge 16b · JIT safe-trade consent gate. Fires only when the
  // peer owns a business (i.e. this is a commerce chat) AND the
  // viewer hasn't yet acknowledged the current terms version. The
  // modal blocks the surface until they tick + submit.
  const needsSafeTradeConsent = peerBusiness
    ? !(await hasCurrentSafeTradeConsent(session.account.id).catch(() => true))
    : false;

  // Bridge 17e · report affordance moved to /nex-native/report/[id]
  // and surfaced from the /friends list next to Remove / Block · no
  // longer rendered on the peer chat surface.

  // Bridge 17b · shop button in the chat header shows whenever the
  // peer owns a business, even if they have no products (a cafe or
  // restaurant carries menu items in nex_menu_item, not products ·
  // sellers of services may have zero SKUs at all). When there are
  // products the grid modal renders · otherwise the button just
  // navigates straight to the shop landing.
  const peerIsVenue =
    !!peerBusiness && isVenueCategory(peerBusiness.business_category);
  const peerShop = peerBusiness
    ? {
        name: peerBusiness.display_name,
        href: peerBusiness.slug
          ? `/nex-native/${peerBusiness.slug}`
          : null,
        isVenue: peerIsVenue,
        // Bridge 52 · shopContext threads through to the in-chat
        // detail sheet · Add-to-cart writes localStorage using these
        // fields · Send-in-chat posts a cart_order to the seller.
        context: {
          shop_id: peerBusiness.id,
          shop_slug: peerBusiness.slug ?? null,
          shop_owner_account_id: peer.id,
          shop_display_name: peerBusiness.display_name,
        },
        products: [
          ...peerProducts.map((p) => ({
            id: p.id,
            kind: "product" as const,
            name: p.name,
            description: p.description ?? null,
            price_pence: p.price_pence,
            currency: p.currency,
            image_url: p.image_url ?? null,
            tags: p.tags ?? null,
            stock_status: p.stock_status ?? null,
            // Category Tabs sealed 2026-09-30 · nex_product.section_id
            // (migration 107). NULL = uncategorised.
            section_id: p.section_id ?? null,
          })),
          // Bridge 51 · food-seller menu items ride the same slider ·
          // dietary tags surface as the tag chips · availability
          // becomes the stock-status heuristic ("in_stock" vs "sold").
          ...peerMenuItems.map((m) => ({
            id: m.id,
            kind: "menu_item" as const,
            name: m.name,
            description: m.description ?? null,
            price_pence: m.price_pence,
            currency: m.currency,
            image_url: m.image_url ?? null,
            tags: m.dietary_tags.length > 0 ? m.dietary_tags : null,
            stock_status: m.is_available ? "in_stock" : "sold",
            // Category Tabs sealed 2026-09-30 · nex_menu_item.section_id
            // (migration 066). NULL = uncategorised.
            section_id: m.section_id ?? null,
          })),
        ],
        // Category Tabs sealed 2026-09-30 · auto-detect by product kind.
        // Menu items present → surface nex_menu_section (Bridge 15a
        // sealed vocabulary). Otherwise → surface nex_product_section
        // (Migration 107). Doctrine: chat-native shop = same UI as
        // cover shop; tabs cascade automatically.
        sections:
          peerMenuItems.length > 0
            ? (
                await menuService
                  .listSectionsByBusiness(peerBusiness.id)
                  .catch(() => [])
              ).map((s) => ({
                id: s.id,
                name: s.name,
                sort_order: s.sort_order,
              }))
            : (
                await productSectionService
                  .listSectionsByBusiness(peerBusiness.id)
                  .catch(() => [])
              ).map((s) => ({
                id: s.id,
                name: s.name,
                sort_order: s.sort_order,
              })),
      }
    : null;

  // Bridge 8+9 · resolve the pending attachment from URL state.
  // Stage A · owner-authorised 2026-11-03 · 'document' joins the
  // accepted kinds + filename / size / mime project through from
  // uploadPeerAttachmentAction's redirect query string so the
  // composer can smuggle them into the send form.
  const attachUrl = sp.attachment_url?.trim() || null;
  const attachTypeRaw = sp.attachment_type?.trim() || null;
  const attachKind: "image" | "video" | "audio" | "document" | null =
    attachTypeRaw === "image" ||
    attachTypeRaw === "video" ||
    attachTypeRaw === "audio" ||
    attachTypeRaw === "document"
      ? attachTypeRaw
      : null;
  const attachFilename =
    attachKind === "document" ? sp.attachment_filename?.slice(0, 256) : undefined;
  const attachSizeBytesRaw =
    attachKind === "document" ? sp.attachment_size : undefined;
  const attachSizeBytes = (() => {
    if (!attachSizeBytesRaw) return undefined;
    const n = Number.parseInt(attachSizeBytesRaw, 10);
    if (!Number.isFinite(n) || n < 0 || n > 25 * 1024 * 1024 + 1024) {
      return undefined;
    }
    return n;
  })();
  const attachMime =
    attachKind === "document" ? sp.attachment_mime?.slice(0, 128) : undefined;
  const pendingAttachment =
    attachUrl && attachKind
      ? {
          url: attachUrl,
          kind: attachKind,
          clearHref: `/nex-native/chat/peer/${peer.id}`,
          // Bridge 88 · flag encrypted so the composer smuggles a
          // hidden field and E2eComposerIntercept looks up the
          // stashed content key in sessionStorage.
          encrypted: sp.attachment_encrypted === "1",
          filename: attachFilename,
          sizeBytes: attachSizeBytes,
          mime: attachMime,
        }
      : null;

  // Owner directive 2026-10-22 · Ask-Seller slice 2 · resolve the
  // pending product snapshot from ?pending_product=<id>. Honest-null
  // on any failure (unknown id, product deleted, missing business) ·
  // the composer silently omits the chip. The product must belong to
  // the peer's business so viewers can't inject arbitrary product
  // ids into another person's chat (belt-and-braces · the next slice
  // adds the server-side authorisation on send too).
  const pendingProductIdRaw = sp.pending_product?.trim() ?? "";
  // Owner directive 2026-10-22 · Live Commerce · optional
  // live-session context carried through from the live viewer's
  // "Order now" tap. Validated as strict UUID shape (same regex as
  // the live-viewer page `?product=` guard and
  // shareProductToContactAction's live_session_id guard). A malformed
  // value is dropped silently · chip renders without the "From Live"
  // badge · the server action also drops it on send.
  const LIVE_SESSION_UUID_SHAPE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const liveSessionIdRaw = sp.live_session_id?.trim() ?? "";
  const liveSessionIdValid =
    liveSessionIdRaw.length > 0 && LIVE_SESSION_UUID_SHAPE.test(liveSessionIdRaw)
      ? liveSessionIdRaw
      : null;
  const pendingProduct = await (async () => {
    if (!pendingProductIdRaw || !peerBusiness) return null;
    const product = await productService
      .getProductById(pendingProductIdRaw)
      .catch(() => null);
    if (!product) return null;
    if (product.business_id !== peerBusiness.id) return null;
    const priceLabel = (() => {
      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: product.currency,
          maximumFractionDigits: 0,
        }).format(product.price_pence / 100);
      } catch {
        return `${product.currency} ${(product.price_pence / 100).toFixed(0)}`;
      }
    })();
    const clearParams = liveSessionIdValid
      ? `?live_session_id=${encodeURIComponent(liveSessionIdValid)}`
      : "";
    return {
      productId: product.id,
      name: product.name,
      priceLabel,
      imageUrl: product.image_url ?? null,
      shopName: peerBusiness.display_name,
      clearHref: `/nex-native/chat/peer/${peer.id}${clearParams}`,
      liveSessionId: liveSessionIdValid,
    };
  })();

  // See-My-Theme gate (sealed 2026-10-16) · AND-rule mutual visibility.
  // When either participant has disabled theme visibility for this
  // specific friend, both sides see the NEX default. Grandfathered
  // when no prefs row exists so pre-feature relationships keep their
  // theme experience. Server-authoritative · fail-closed on friend-
  // edge resolution, fail-open on prefs resolution. Owner directive:
  // the viewer's SELECTED theme (nex_account.chat_theme) is never
  // modified by this gate · only its visibility in this one
  // conversation changes.
  const canShowPeerTheme =
    await relationshipService.isThemeMutuallyVisibleSafe(
      session.account.id,
      peer.id,
    );

  // Resolve peer's theme colours · bubble rims + composer rim +
  // ripple. Multi-colour themes (Rose etc.) supply per-element hex
  // overrides · single-accent themes fall back to accent for every
  // slot. Sealed 2026-09-27 · migration 051. When the See-My-Theme
  // gate forbids visibility, `peerThemeRow` stays null and every
  // downstream dependent (emoji set, sticker set, intro video,
  // atmosphere layer) cascades to the sealed NEX default.
  const peerThemeRow =
    canShowPeerTheme && peer.chat_theme
      ? await chatThemeService.getThemeById(peer.chat_theme).catch(() => null)
      : null;
  const themeColours = peerThemeRow
    ? chatThemeService.resolveThemeColours(peerThemeRow)
    : { accent: "#00AFFF", bubbleRim: "#00AFFF", composerRim: "#00AFFF" };

  // Bridge ThemeEmoji-C · sealed 2026-10-01 · load the peer theme's
  // emoji set (nex_theme_emoji · Migration 116) so both the composer
  // picker AND the bubble reaction rail paint the theme's own tiles.
  // Fails soft to an empty list · the shell falls back to the default
  // unicode set when nothing is returned.
  const peerThemeEmojis = peerThemeRow
    ? await listThemeEmojis(peerThemeRow.id)
        .then((rows) =>
          rows.map((r) => ({
            slug: r.slug,
            imageUrl: r.image_url,
            label: r.label,
          })),
        )
        .catch(() => [])
    : [];

  // Bridge ThemeSticker · sealed 2026-10-01 · load the peer theme's
  // sticker set so the composer exposes the Stickers tab. Mirrors the
  // emoji lookup above · same sealed theme-ownership doctrine · the
  // viewer sees the peer's sticker set because the peer's chat_theme
  // is their public appearance.
  const peerThemeStickers = peerThemeRow
    ? await listThemeStickers(peerThemeRow.id)
        .then((rows) =>
          rows.map((r) => ({
            slug: r.slug,
            imageUrl: r.image_url,
            label: r.label,
            stickerType: r.sticker_type,
            aspectRatio: r.aspect_ratio,
          })),
        )
        .catch(() => [])
    : [];

  // Phase 4A · premium theme intro-video resolution. Sealed with the
  // founder 2026-10-04. Two signals flow to the shell:
  //   · peerThemeIntro · present iff the peer's theme has a non-null
  //     intro_video_url AND the viewer is NOT the theme's owner. If
  //     NULL the shell renders immediately with zero gate.
  //   · viewerHasSeenThemeIntro · true iff the viewer already saw
  //     this specific theme's intro at any point in the past. The
  //     shell uses this to skip the interstitial for returning
  //     viewers.
  //
  // OWNER BYPASS (founder-sealed 2026-10-04):
  //   The chat-entry interstitial is for OTHER participants discovering
  //   the peer's theme for the first time. Theme owners (i.e., users
  //   whose own nex_account.chat_theme matches this theme) never see
  //   the intro at chat entry · they get fast entry from the first
  //   open. Theme owners experience the intro via the theme gallery /
  //   /nex-native/chat-themes-library (separate surface · unchanged). The intro must
  //   NEVER be an obstacle for the owner.
  //
  //   We do NOT fake a nex_theme_intro_seen row for the owner — we
  //   simply null `peerThemeIntro` upstream so the shell has no gate
  //   to apply. Keeps the seen-state table a clean record of actual
  //   viewings · also keeps the gallery replay flow unaffected.
  //
  // Fails soft on both sides: if either lookup errors, the intro
  // simply plays or doesn't · entry is never blocked.
  const viewerIsThemeOwner =
    !!peerThemeRow && session.account.chat_theme === peerThemeRow.id;
  // Phase 1.0 · the peer (chat owner) can disable their World Intro
  // entirely via /settings/world-intro · default TRUE preserves the
  // prior behaviour. When FALSE, no intro plays for any visitor
  // regardless of whether a standard or custom intro is configured.
  const peerWantsIntro = peer.world_intro_enabled !== false;
  // Phase 1.0 · Custom Intro takes precedence over Standard Intro when
  // the peer has an active entitlement AND an uploaded video. Owners
  // still bypass. "Always-when-on" policy · we never consult the
  // nex_theme_intro_seen tracker for custom intros.
  const peerCustomIntro =
    peerWantsIntro && !viewerIsThemeOwner
      ? await (async () => {
          try {
            const svc = await import("@/lib/nex-native/custom-intro-service");
            return await svc.getActiveCustomIntroForOwner(peer.id);
          } catch {
            return null;
          }
        })()
      : null;
  const peerThemeIntro = peerCustomIntro
    ? {
        themeId: `custom-${peer.id}`,
        themeName: "Custom Intro",
        videoUrl: peerCustomIntro.video_url,
        durationMs: peerCustomIntro.duration_ms,
        posterUrl: null as string | null,
      }
    : peerWantsIntro && peerThemeRow?.intro_video_url && !viewerIsThemeOwner
      ? {
          themeId: peerThemeRow.id,
          themeName: peerThemeRow.name,
          videoUrl: peerThemeRow.intro_video_url,
          durationMs: peerThemeRow.intro_duration_ms,
          posterUrl: peerThemeRow.intro_poster_url,
        }
      : null;
  const viewerHasSeenThemeIntro = peerCustomIntro
    ? // Custom intros use the "always-when-on" play policy · the
      // seen-state tracker does not apply (it only tracks standard
      // themes). Return false so the intro plays every time.
      false
    : peerThemeIntro
      ? await (async () => {
          try {
            const svc = await import("@/lib/nex-native/theme-intro-service");
            return await svc.hasSeenThemeIntro(session.account.id, peerThemeIntro.themeId);
          } catch {
            // Safe default · let the intro play. We never falsely claim
            // the user has seen something.
            return false;
          }
        })()
      : true;

  // Header contacts menu · list of accepted friends so the user can
  // hop between peer chats without leaving the chat surface. Best-
  // effort · if any lookup fails we return an empty list rather than
  // block the page render.
  // Owner directive 2026-11-11 (Cycle 22 · P1 N+1 fix) · side-drawer
  // contacts + pending-invite hydration now runs in TWO batch queries
  // per group (accounts + profiles) regardless of friend count.
  // Previously this fired 2 × N DB round-trips per render inside
  // Promise.all. Behaviour preserved: missing accounts filter out,
  // missing profiles fall back to null. Both groups' lookups share the
  // same accountProfileService batch.
  const [contacts, pendingInvites]: [SideNavContact[], PendingInvite[]] =
    await (async () => {
      try {
        // Kick both friend + pending-edge list queries in parallel so
        // neither blocks the other.
        const [friendIds, pendingEdges] = await Promise.all([
          friendService.listFriends(session.account.id),
          friendService.listPendingIncoming(session.account.id),
        ]);
        const pendingOtherIds = pendingEdges.map((edge) =>
          edge.a_account_id === session.account.id
            ? edge.b_account_id
            : edge.a_account_id,
        );
        // All account IDs we need in ONE batch · dedupe handled inside
        // the batch helper.
        const allIds = [peer.id, ...friendIds, ...pendingOtherIds];
        const svcProfile = await import(
          "@/lib/nex-native/account-profile-service"
        );
        const [accountMap, profileMap] = await Promise.all([
          accountService.getAccountsByIds(allIds).catch(() => new Map()),
          svcProfile
            .getProfilesByAccountIds(allIds)
            .catch(() => new Map()),
        ]);
        const professionShort = (
          profession: string | null | undefined,
        ): string | null =>
          profession
            ? profession.split(/[\s·,/-]+/).filter(Boolean)[0] ?? null
            : null;

        // Build side-drawer contacts · peer first, then everyone else.
        const others = friendIds.filter((id) => id !== peer.id);
        const orderedIds = [peer.id, ...others];
        const contactsList: SideNavContact[] = orderedIds
          .map((id) => {
            const acc = accountMap.get(id);
            if (!acc) return null;
            const profile = profileMap.get(id) ?? null;
            return {
              id: acc.id,
              name: acc.display_name,
              profession: professionShort(profile?.profession),
              avatarUrl: profile?.avatar_url ?? null,
              href: `/nex-native/chat/peer/${acc.id}`,
              isCurrent: acc.id === peer.id,
            };
          })
          .filter((c): c is SideNavContact => c !== null);

        // Build pending-invites list · dedupe on other-account id.
        const invitesList: PendingInvite[] = pendingEdges
          .map((edge) => {
            const otherId =
              edge.a_account_id === session.account.id
                ? edge.b_account_id
                : edge.a_account_id;
            const acc = accountMap.get(otherId);
            if (!acc) return null;
            const profile = profileMap.get(otherId) ?? null;
            return {
              otherAccountId: acc.id,
              name: acc.display_name,
              avatarUrl: profile?.avatar_url ?? null,
              profession: professionShort(profile?.profession),
            };
          })
          .filter((r): r is PendingInvite => r !== null);

        return [contactsList, invitesList];
      } catch {
        return [[], []];
      }
    })();

  const presenceKind: PortraitBloomPresenceKind = isOffline
    ? "offline"
    : "online";
  const presenceLabel = isOffline
    ? "Away · will see later"
    : "NEX · chatting with";

  // Bridge 5 · resolve reply-preview snippets so bubbles can render
  // their quote header without an extra client round-trip. O(n²) but
  // conversations are small · we can index later if this ever gets hot.
  const byId = new Map(messages.map((m) => [m.id, m]));
  const bloomMessages = messages.map((m) => {
    const quoted = m.reply_to_id ? byId.get(m.reply_to_id) : null;
    return {
      id: m.id,
      body: m.body,
      sent_at: m.sent_at,
      read_at: m.read_at,
      mine: m.sender_account_id === session.account.id,
      reply_to_id: m.reply_to_id ?? null,
      reply_preview: quoted
        ? {
            body: quoted.deleted_for_everyone
              ? "🚫 This message was deleted"
              : quoted.body,
            mine: quoted.sender_account_id === session.account.id,
          }
        : null,
      deleted_for_everyone: !!m.deleted_for_everyone,
      attachment_url: m.attachment_url ?? null,
      attachment_type: m.attachment_type ?? null,
      // Owner directive 2026-11-08 (round 22) · Call Center invite
      // flow · project the migration-306 attachment into a typed
      // slot so the message bubble can render an inline Accept
      // button. host_account_id lets the bubble renderer check
      // whether the viewer is the receiver (not the host · host
      // doesn't need a button on their own invite).
      attachment_call_invite:
        m.attachment_type === "call_invite" &&
        m.attachment_meta &&
        typeof m.attachment_meta === "object" &&
        "session_id" in m.attachment_meta
          ? (() => {
              const meta = m.attachment_meta as Record<string, unknown>;
              const safeCountry = (
                v: unknown,
              ):
                | "ireland"
                | "indonesia"
                | "worldwide"
                | "global"
                | null => {
                if (
                  v === "ireland" ||
                  v === "indonesia" ||
                  v === "worldwide" ||
                  v === "global"
                )
                  return v;
                return null;
              };
              return {
                session_id: String(meta.session_id ?? ""),
                media_type:
                  meta.media_type === "audio"
                    ? ("audio" as const)
                    : ("video" as const),
                host_account_id: String(meta.host_account_id ?? ""),
                accept_href: m.attachment_url ?? null,
                // Round 25 · Option C · cross-country disclosure
                // signal rides attachment_meta so the bubble shows
                // the chip without a second DB read.
                cross_country: meta.cross_country === true,
                host_country: safeCountry(meta.host_country),
                invitee_country: safeCountry(meta.invitee_country),
              };
            })()
          : null,
      attachment_product:
        m.attachment_type === "product" &&
        m.attachment_meta &&
        typeof m.attachment_meta === "object" &&
        "product" in m.attachment_meta &&
        m.attachment_meta.product
          ? m.attachment_meta.product
          : null,
      attachment_menu_item:
        m.attachment_type === "menu_item" &&
        m.attachment_meta &&
        typeof m.attachment_meta === "object" &&
        "menu_item" in m.attachment_meta &&
        m.attachment_meta.menu_item
          ? m.attachment_meta.menu_item
          : null,
      attachment_cart:
        m.attachment_type === "cart_order" &&
        m.attachment_meta &&
        typeof m.attachment_meta === "object" &&
        "cart" in m.attachment_meta &&
        m.attachment_meta.cart
          ? {
              ...m.attachment_meta.cart,
              // Bridge 49b-final · pass through direct_price so the
              // cart-order card renders the discount chip.
              direct_price:
                m.attachment_meta.cart.direct_price ?? null,
            }
          : null,
      attachment_product_share:
        m.attachment_type === "product_share" &&
        m.attachment_meta &&
        typeof m.attachment_meta === "object" &&
        "product_share" in m.attachment_meta &&
        m.attachment_meta.product_share
          ? m.attachment_meta.product_share
          : null,
      // Bridge ThemeSticker · project the frozen sticker snapshot so
      // the bubble renders ~140px tall. Same pattern as product /
      // menu_item / cart_order / product_share above.
      attachment_sticker:
        m.attachment_type === "sticker" &&
        m.attachment_meta &&
        typeof m.attachment_meta === "object" &&
        "sticker" in m.attachment_meta &&
        m.attachment_meta.sticker
          ? m.attachment_meta.sticker
          : null,
      // Bridge 66 · reactions map · defaults to {} when the column
      // is absent (older rows before migration 091 landed).
      reactions: m.reactions ?? {},
      // Bridge Reactions-Order · migration 117 · insertion-ordered
      // emoji keys · last entry renders as the newest big stamp.
      reactions_order: m.reactions_order ?? [],
      // Bridge 81 · project the attachment envelope (if any) as
      // base64-encoded JSON for the _e2e-decryptor to consume from
      // a data attribute. Base64 keeps the DOM attribute compact
      // and side-steps quoting issues.
      attachment_envelope_b64: (() => {
        const meta = m.attachment_meta;
        if (!meta || typeof meta !== "object") return null;
        const env = (meta as Record<string, unknown>).envelope;
        if (!env || typeof env !== "object") return null;
        try {
          return Buffer.from(JSON.stringify(env), "utf-8").toString("base64");
        } catch {
          return null;
        }
      })(),
      // Bridge 76 · encryption fields · null on legacy plaintext rows
      // and on rows addressed to a different recipient device (the
      // decryptor will drop those from the visible bubble list once
      // Bridge 76b lands the dedupe).
      encrypted: m.encrypted ?? false,
      ciphertext_b64: m.ciphertext ?? null,
      nonce_b64: m.nonce ?? null,
      sender_public_key: m.sender_public_key ?? null,
      sender_device_id: m.sender_device_id ?? null,
      recipient_device_id: m.recipient_device_id ?? null,
      sender_account_id: m.sender_account_id,
      message_group_id: m.message_group_id ?? null,
    };
  });

  // Owner-authorised 2026-11-05 · drawer identity for the shared "+"
  // ControlDrawer rendered inside FreeChatHeader. Sourced from the
  // server-resolved session · null if session resolution failed (would
  // have redirected earlier, so this is defensive).
  const drawerSession = {
    displayName: session.account.display_name,
    nexHandle: session.account.nex_handle,
    isBisnis: effectiveTier(session.account) === "bisnis",
  };

  // Owner-authored 2026-11-05 · incoming invites feed · pending-edges
  // where b_account_id === viewer AND requested_by !== viewer. Rendered
  // in the NotificationsDrawer's "follows" section. Other sections
  // keep mock data until the owner authorises wiring each real source
  // (chats · live · shop · orders).
  let incomingInviteNotifs: NotificationItem[] = [];
  try {
    const incomingEdges = await friendService.listPendingIncoming(
      session.account.id,
    );
    const inviterAccountsSettled = await Promise.allSettled(
      incomingEdges.map((edge) => {
        const inviterId =
          edge.a_account_id === session.account.id
            ? edge.b_account_id
            : edge.a_account_id;
        return accountService.getAccountById(inviterId);
      }),
    );
    incomingInviteNotifs = inviterAccountsSettled
      .map((r, i) => ({
        account: r.status === "fulfilled" ? r.value : null,
        edge: incomingEdges[i]!,
      }))
      .filter(
        (x): x is { account: NonNullable<typeof x.account>; edge: typeof x.edge } =>
          x.account !== null,
      )
      .map((x) => ({
        id: `invite-${x.edge.a_account_id}-${x.edge.b_account_id}`,
        section: "follows" as const,
        title: x.account.display_name,
        subtitle: "invited you to connect",
        href: x.account.nex_handle
          ? `/chat/${x.account.nex_handle}`
          : `/nex-native/chat/peer/${x.account.id}`,
        createdAt: x.edge.created_at ?? new Date().toISOString(),
        unread: true,
        thumbnailUrl: null,
        // Owner directive 2026-11-06 · carry sender account id so the
        // drawer can resolve + paint the shop rim badge · profileHref
        // lets the viewer tap the avatar to see who they deal with
        // without first opening the chat.
        senderAccountId: x.account.id,
        profileHref: x.account.nex_handle
          ? `/nex-native/u/${x.account.nex_handle}`
          : null,
      }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "peer-chat · friendService.listPendingIncoming failed:",
      err,
    );
  }
  // Owner-authored 2026-11-05 · real unread-chat source for the
  // NotificationsDrawer's "chats" section. Queries every peer-
  // conversation the viewer is part of, counts unread messages per
  // conversation, and emits one NotificationItem per conversation
  // with unread > 0. The CURRENT peer's conversation is excluded
  // because the viewer is already looking at it (would be weird to
  // notify them about a chat they have open).
  //
  // Privacy: subtitle is a metadata string ("3 unread messages"), NEVER
  // the plaintext body. Honours the sealed Phase 1 E2E posture.
  // Owner directive 2026-11-11 (Cycle 22 · P1 N+1 fix) · unread-chat
  // notification hydration now batches the per-conversation
  // `getAccountById` into ONE `getAccountsByIds` lookup. The unread
  // counts still fire per-conversation (no batch RPC for that yet),
  // but the account hydration is N → 1. Semantics preserved: zero-
  // unread conversations still filter out, missing accounts filter out.
  let unreadChatNotifs: NotificationItem[] = [];
  try {
    const myConversations =
      await peerConversationService.listPeerConversationsForAccount(
        session.account.id,
      );
    const otherConvos = myConversations.filter(
      (c) => c.id !== conversation.id,
    );
    // First pass · parallel unread counts (still N queries · service
    // doesn't expose a batch count RPC yet · tracked as REMAINING).
    const unreadCounts = await Promise.all(
      otherConvos.map((c) =>
        peerMessageService
          .countUnreadPeerMessages(c.id, session.account.id)
          .catch(() => 0),
      ),
    );
    // Build the "has unread > 0" subset + batch-load their other-
    // participant accounts in ONE query.
    const withUnread = otherConvos
      .map((c, i) => ({
        conv: c,
        unread: unreadCounts[i] ?? 0,
        otherId:
          c.participant_a_id === session.account.id
            ? c.participant_b_id
            : c.participant_a_id,
      }))
      .filter((r) => r.unread > 0);
    const otherAccountsMap = await accountService
      .getAccountsByIds(withUnread.map((r) => r.otherId))
      .catch(() => new Map());
    unreadChatNotifs = withUnread
      .map((r) => {
        const other = otherAccountsMap.get(r.otherId);
        if (!other) return null;
        return {
          id: `unread-${r.conv.id}`,
          section: "chats" as const,
          title: other.display_name,
          subtitle:
            r.unread === 1 ? "1 new message" : `${r.unread} new messages`,
          href: other.nex_handle
            ? `/chat/${other.nex_handle}`
            : `/nex-native/chat/peer/${other.id}`,
          createdAt: r.conv.last_message_at ?? r.conv.created_at,
          unread: true,
          thumbnailUrl: null,
          senderAccountId: other.id,
          profileHref: other.nex_handle
            ? `/nex-native/u/${other.nex_handle}`
            : null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("peer-chat · unread-chats build failed:", err);
  }

  // Owner directive 2026-11-06 (revised): "notivications go to
  // notivications and messages from chat to chat · we dont need
  // any inbox". Customer messages to shops live in the regular
  // chat list, NOT in a dedicated inbox section.
  //
  // Owner directive 2026-11-06 · also batch-resolve shop badges for
  // every notification sender so the drawer paints a 🏪 gold pip on
  // the avatar rim when the sender owns a shop. One query per render
  // regardless of notification count.
  const notifSenderIds = [
    ...incomingInviteNotifs,
    ...unreadChatNotifs,
  ]
    .map((n) => n.senderAccountId)
    .filter((id): id is string => Boolean(id));
  const notifShopBadges = await (await import(
    "@/lib/nex-native/shop-badge-service"
  )).resolveShopBadges(notifSenderIds);
  const enrichSenderShop = <T extends NotificationItem>(n: T): T => {
    const sid = n.senderAccountId;
    if (!sid) return n;
    const badge = notifShopBadges.get(sid);
    if (!badge) return n;
    return { ...n, senderHasShop: true };
  };
  const notifications: NotificationItem[] = [
    ...incomingInviteNotifs.map(enrichSenderShop),
    ...unreadChatNotifs.map(enrichSenderShop),
    ...MOCK_NOTIFICATIONS.filter(
      (n) => n.section !== "follows" && n.section !== "chats",
    ),
  ];
  const peerFirstName =
    peer.display_name.split(/\s+/)[0] ?? peer.display_name;
  // Owner directive 2026-11-06 · identity swap · customer viewing a
  // shop owner sees the SHOP's face (display_name + logo_url) instead
  // of the owner's personal chat identity. Owner viewing a customer
  // sees the customer's face PLUS a "Replying as <my shop>" chip so
  // they know which hat they're wearing. One rule: if the peer owns
  // a shop AND the viewer isn't the peer, we show the shop face.
  const viewerBusiness = viewerBusinesses[0] ?? null;
  const showShopFace =
    peerBusiness && peer.id !== session.account.id;
  const effectivePeerDisplayName = showShopFace
    ? peerBusiness!.display_name
    : peerFirstName;
  const effectivePeerAvatarUrl = showShopFace
    ? peerBusiness!.logo_url ?? null
    : (profile?.avatar_url ?? null);
  const headerSubtitle = showShopFace
    ? "Shop · tap to open"
    : (profile?.profession ?? presenceLabel ?? "Online");
  // Owner-side "Replying as" context strip · renders only when the
  // VIEWER owns a shop (any kind of peer chat where they might send
  // a shop-authored reply). Separate concept from showShopFace: the
  // customer sees the shop face; the owner sees this chip.
  const replyingAsChip =
    viewerBusiness && !showShopFace ? viewerBusiness.display_name : null;

  // Owner-sealed 2026-11-07 · Chat Settings Hub Sections 5+6 · viewer-
  // side protection + font preferences. Fail-safe: when migration 285
  // is unapplied the service returns sealed defaults (protection OFF,
  // font = default / medium) · the shell renders a no-op style. See
  // src/lib/nex-native/chat-view-preferences-service.ts.
  const { getChatViewPreferencesSafe } = await import(
    "@/lib/nex-native/chat-view-preferences-service"
  );
  const { ChatViewPreferencesShell } = await import(
    "@/components/nex-native/chat-view-preferences-shell"
  );
  const chatViewPrefs = await getChatViewPreferencesSafe(session.account.id);

  return (
    <div data-nex-peer-chat-prototype-wrap>
      <ChatViewPreferencesShell
        screenshot_copy_protection_enabled={
          chatViewPrefs.screenshot_copy_protection_enabled
        }
        chat_font_family={chatViewPrefs.chat_font_family}
        chat_font_size={chatViewPrefs.chat_font_size}
      />
      {/* Owner-authorised 2026-11-05 · scoped CSS hides the sealed
          PortraitBloomShell native identity header + home/cart/shop
          right cluster so only the layered FreeChatHeader renders.
          Shell internals stay mounted (preserving hook order + theme
          wallpaper + bubble renderer) · they are visually hidden only.
          The :has() selector also collapses the padding-containing
          parent wrapper so bubbles start from the top of the viewport
          rather than leaving a ~80 px blank strip where Shell's
          native header used to pad its space. Owner fix 2026-11-05 · full
          height viewport. */}
      <style>{`
        [data-nex-peer-chat-prototype-wrap] [data-nex-chat-identity-header],
        [data-nex-peer-chat-prototype-wrap] [data-nex-header-cluster],
        [data-nex-peer-chat-prototype-wrap] div:has(> [data-nex-chat-identity-header]),
        [data-nex-peer-chat-prototype-wrap] [data-nex-universal-chat-controls],
        [data-nex-peer-chat-prototype-wrap] [data-nex-free-chat-call-center-trigger],
        [data-nex-peer-chat-prototype-wrap] [data-nex-free-chat-call-center-panel],
        [data-nex-peer-chat-prototype-wrap] [data-nex-free-chat-call-center-backdrop] {
          display: none !important;
        }
        /* Owner fix 2026-11-05 · composer-off-screen report. Shell's
           composer wrapper uses padding-bottom: calc(safe-area-inset-
           bottom + 10px). On browsers where safe-area-inset-bottom is
           not applied (desktop Chrome in device-mode, some Android
           webviews, PWAs not configured for the gesture bar), the
           input sits only 10 px above the viewport edge · with keyboard
           chrome it reads as "off screen". Forcing a floor of 32 px
           keeps the composer safely visible regardless. */
        [data-nex-peer-chat-prototype-wrap] div:has(> [data-nex-peer-composer]) {
          padding-bottom: max(env(safe-area-inset-bottom, 0), 32px) !important;
        }
      `}</style>
      {/* Chat 9001 header · fixed top · overlays Shell's hidden header. */}
      <div
        data-nex-peer-chat-prototype-header-slot
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
        }}
      >
        <FreeChatHeader
          displayName={effectivePeerDisplayName}
          nameBadge={
            // When showing the shop face, the whole header IS the shop
            // · a secondary badge would duplicate. Only render the
            // inline shop badge for non-swapped (regular peer) chats
            // with a shop owner, so the viewer still sees the signal
            // if they happen to be chatting with a shop-owning friend.
            !showShopFace && peerBusiness ? (
              <ShopBadge
                badge={{
                  accountId: peer.id,
                  businessId: peerBusiness.id,
                  displayName: peerBusiness.display_name,
                  slug: peerBusiness.slug,
                  logoUrl: peerBusiness.logo_url,
                }}
                variant="inline"
              />
            ) : null
          }
          subtitle={headerSubtitle}
          avatarUrl={effectivePeerAvatarUrl}
          drawerSession={drawerSession}
          peerAccountId={peer.id}
          peerSharedMediaHref={`/nex-native/chat/peer/${peer.id}/media`}
          hideMagnifier={true}
          currentSurface="chat"
          notificationsSlot={
            <NotificationsDrawer
              inline
              initialNotifications={notifications}
            />
          }
        />
      </div>

      {/* Owner directive 2026-11-06 · identity-swap chip · the viewer
          owns a shop and is replying to a non-shop peer · thin gold
          strip just under the header reminds them which hat they're
          wearing. Positions fixed under the header slot so it never
          competes with chat bubbles. */}
      {replyingAsChip ? (
        <div
          data-nex-replying-as-chip
          style={{
            position: "fixed",
            top: 58,
            left: 0,
            right: 0,
            zIndex: 9,
            padding: "5px 14px",
            background: "rgba(198, 161, 91, 0.14)",
            borderBottom: "1px solid rgba(198, 161, 91, 0.35)",
            color: "var(--nex-world-secondary, #C6A15B)",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textAlign: "center",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          🏪 Replying as {replyingAsChip}
        </div>
      ) : null}

      {/* Owner-authorised 2026-11-05 · fresh-conversation empty state.
          When the thread has zero messages, render a centered welcome
          pill over the chat body so the viewer sees a friendly nudge
          rather than a blank scroll area. Disappears automatically on
          the first inserted message (next render, messages.length > 0).
          Pure client-side · no DB write · see Option B in the design
          decision 2026-11-05. */}
      {messages.length === 0 ? (
        <WelcomePillClient
          peerFirstName={peerFirstName}
          peerAccountId={peer.id}
          conversationCreatedAt={conversation.created_at ?? new Date().toISOString()}
        />
      ) : null}

      {/* 2026-11-05 · world-class chat parity · if the viewer opens a
          chat with unread messages, scroll the first unread bubble
          into view + brief gold-ring flash so they land where they
          left off. No-op when firstUnreadMessageId is null. */}
      <JumpToUnreadClient firstUnreadMessageId={firstUnreadMessageId} />

      {/* 2026-11-05 iter 7-10 · long-press / right-click a bubble opens
          a small Reply + Copy + Forward (+ Edit for own, sender-only)
          menu above it · pure overlay, no Shell edit · uses the sealed
          data-nex-msg-id + data-nex-bloom-msg-mine anchors. */}
      <BubbleActionMenuClient editAction={editPeerMessageAction} />

      {/* 2026-11-05 iter 11 · in-chat search overlay. Cmd/Ctrl+K opens
          the top-anchored bar · matches highlight with gold ring,
          non-matches dim to opacity 0.25 · ↑/↓ or Enter/Shift+Enter
          cycle · Esc or × closes. */}
      <SearchClient />

      {needsSafeTradeConsent && (
        <SafeTradeConsentModal
          action={acknowledgeSafeTradeAction}
          nextHref={`/nex-native/chat/peer/${peer.id}`}
          termsVersion={CURRENT_SAFE_TRADE_TERMS_VERSION}
          strings={safeTradeStrings}
        />
      )}
      {/* 2026-10-28 · Chat error banner consumer (C-01…C-04) · surfaces
          sanitised message_error / sticker_error / upload_error /
          delete_error with calm, actionable copy. Renders null when
          no error param is set. */}
      <ChatErrorBanner
        peerAccountId={peer.id}
        peerDisplayName={peer.display_name}
        messageError={sp.message_error}
        stickerError={sp.sticker_error}
        uploadError={sp.upload_error}
        deleteError={sp.delete_error}
      />
      {/* Bridge 17e · Report affordance moved from the peer chat to
          /nex-native/report/[accountId] · reachable from /friends
          next to Remove / Block · keeps the chat surface clean.
          Bridge 96 · Shell component now comes from the chrome
          registry keyed by the peer's layout_style. Every existing
          chrome is a bubbles-delegating stub at Phase 1 so
          behaviour is bit-identical. */}
      {(() => {
        const Shell = resolveChromeSet(peerThemeRow?.layout_style).PeerChatShell;
        return (
      <Shell
        scope="peer-chat"
      /* Free accounts display only the first name on the chat
         header per Founder direction 2026-09-27 · full name lives
         on friend cards + directory. Splits on any whitespace so
         "Maria Santos" → "Maria", "Philip J. Wright" → "Philip".
         Bisnis tier will get full-name rendering when tier gating
         lands (migration 046 pending). */
      displayName={peer.display_name.split(/\s+/)[0] ?? peer.display_name}
      isOfficialPeer={isNexOfficialAccount(peer.id)}
      layoutStyle={peerThemeRow?.layout_style ?? "bubbles"}
      subtitle={profile?.profession ?? null}
      portraitUrl={profile?.avatar_url ?? null}
      presenceKind={presenceKind}
      presenceLabel={presenceLabel}
      rippleColor={themeColours.accent}
      bubbleRimColor={themeColours.bubbleRim}
      composerRimColor={themeColours.composerRim}
      wallpaperUrl={peerThemeRow?.hero_image_url ?? null}
      wallpaperConfig={peerThemeRow?.wallpaper_config ?? null}
      backHref="/nex-native/chat"
      messages={bloomMessages}
      composerAction={bind}
      deleteAction={bindDelete}
      uploadAction={bindUpload}
      pendingAttachment={pendingAttachment}
      pendingProduct={pendingProduct}
      encryptedUploadEnabled={!isNexOfficialAccount(peer.id)}
      themeEmojis={peerThemeEmojis}
      themeStickers={peerThemeStickers}
      themeIntro={peerThemeIntro}
      viewerHasSeenThemeIntro={viewerHasSeenThemeIntro}
      sendStickerAction={bindSticker}
      shopBackgroundImageUrl={
        getThemeAssets(peerThemeRow?.id).shopBackgroundUrl
      }
      themeSendButtonUrl={getThemeAssets(peerThemeRow?.id).sendButtonUrl}
      showShopSetupChooser={!viewerHasBusiness}
      peerShop={peerShop}
      sendCartOrderAction={sendCartOrderAction}
      productInquiryAction={bindProductInquiry}
      tradeAgreementSellerName={
        peerBusiness
          ? peer.display_name.split(/\s+/)[0] ?? peer.display_name
          : null
      }
      tradeAgreementActivated={!!peerBusiness?.safe_trade_activated}
      likeProductAction={toggleLikeProductAction}
      toggleReactionAction={bindReaction}
      selfAccountId={session.account.id}
      scannedAccountId={peer.id}
      viewerAccountId={session.account.id}
      composerPlaceholder={`Message ${peer.display_name}…`}
      headerTag="NEX Chat"
      contacts={contacts}
      pendingInvites={pendingInvites}
      replyTarget={(() => {
        if (!replyId) return null;
        const target = messages.find((m) => m.id === replyId);
        // Silently drop the reply target when the message is gone
        // or has been retracted · quoting a deleted message would
        // leak the original body back into the send flow.
        if (!target || target.deleted_for_everyone) return null;
        return {
          id: target.id,
          body: target.body,
          mine: target.sender_account_id === session.account.id,
          peerName: peer.display_name,
          clearHref: `/nex-native/chat/peer/${peer.id}`,
        };
      })()}
      />
        );
      })()}
      {/* Stage 1 universal-chrome convergence (sealed 2026-10-05) ·
         declarative atmosphere mount. Replaces the two theme-id
         if-branches that previously lived here (theme-0 →
         JokerChatOverlays · haunted-hotel → HauntedHotelChrome). The
         registry at `src/lib/nex-native/chat-render/atmosphere-registry.ts`
         decides which atmosphere component mounts for a given theme id;
         this page carries no theme-specific knowledge. Trust Scan +
         call / video / mic / status are now universal · they live in
         `UniversalChatControls` natively inside PortraitBloomShell, not
         inside any atmosphere bundle. */}
      <ThemeAtmosphereLayer
        themeId={peerThemeRow?.id ?? null}
        subjectId={peer.id}
      />
      {/* Owner directive 2026-11-04 later-same-day · NEX Global Chat
          UI Standard (Chat 9001) · the floating PeerCallLauncher is
          retired from peer-chat so the header matches the free-chat
          2-button cluster. Voice / video calls remain fully reachable
          via the + attach panel's Call Centre tile → /nex-native/
          call-centre decision page (sealed PeerCall engine still
          mounts there · zero WebRTC code lost · add-to-call wiring
          test unaffected · the launcher component file is retained
          for direct deep-links at /chat/peer/<id>?start_call=voice
          if any surface needs that entry). */}
      {/* <PeerCallLauncher
        conversationId={conversation.id}
        selfAccountId={session.account.id}
        selfDisplayName={session.account.display_name}
        peerAccountId={peer.id}
        peerDisplayName={peer.display_name}
        peerAvatarUrl={profile?.avatar_url ?? null}
        disabled={isNexOfficialAccount(peer.id)}
      /> */}
      {/* Owner directive 2026-11-04 later-same-day · NEX Global Chat
          UI Standard (Chat 9001) · the shared 3-dots Call Center
          drawer FAB. Same component free-chat mounts · absolute-
          positioned bottom-right · opens left-slide Call Center
          panel with Voice/Video/Dial/Recent/Contacts rows. */}
      <FreeChatCallCenterDrawerClient />
      {/* Bridge 70 · typing indicator · disabled for NEX1 (support
          agents typing is not a signal buyers need). Same conversation
          channel keyed on conversation.id.
          R9 Stage 4 (2026-10-15) · typingEnabled prop sourced from
          chat-preferences-service · when the viewer has set
          typing_indicator_enabled=false, the channel never opens and
          no ping ever broadcasts. */}
      <PeerTypingClient
        conversationId={conversation.id}
        selfAccountId={session.account.id}
        selfDisplayName={session.account.display_name}
        peerDisplayName={peer.display_name}
        typingEnabled={chatPrefs.typing_indicator_enabled}
        disabled={isNexOfficialAccount(peer.id)}
      />
      {/* Bridge 71 · live presence · publishes self on global roster,
          renders "Online now" pill when peer is active. Also fires
          window CustomEvents ("nex-peer-presence") for future ring/dot
          consumers. Disabled for NEX1 support.
          R9 Stage 4 (2026-10-15) · publishPresence prop sourced from
          chat-preferences-service · when online_status_visibility is
          'nobody', the client opens the channel in receive-only mode
          and never publishes a tracked presence state. */}
      <PeerPresenceClient
        conversationId={conversation.id}
        selfAccountId={session.account.id}
        selfDisplayName={session.account.display_name}
        peerAccountId={peer.id}
        publishPresence={chatPrefs.online_status_visibility !== "nobody"}
        peerDisplayName={peer.display_name}
        disabled={isNexOfficialAccount(peer.id)}
      />
      {/* Bridge 73 · live read-receipt propagation · broadcasts our
          read cursor on mount so the peer's outgoing ticks flip to
          double-blue instantly. Also enabled for NEX1 so support-
          initiated messages get proper receipts. */}
      <PeerMessageEventsClient
        conversationId={conversation.id}
        selfAccountId={session.account.id}
      />
      {/* Bridge 74 · ensure this browser has a Curve25519 device key
          + its public key is registered on the server. Foundation for
          E2E encryption (Bridges 75-78). Silent · no user-visible UI. */}
      <DeviceKeyHub />
      {/* Bridge 76 · decrypt inbound E2E messages on hydration and
          replace the '(encrypted)' sentinel with plaintext in the
          bubble body · fires delivered-ack on success · Bridge 77
          caches the plaintext to IndexedDB for post-purge survival. */}
      <E2eDecryptor conversationId={conversation.id} />
      {/* Bridge 76 · intercept composer submits · encrypt + POST when
          both parties have device keys · silent plaintext fallback
          when they don't. Disabled for NEX1 per doctrine. */}
      <E2eComposerIntercept
        conversationId={conversation.id}
        peerAccountId={peer.id}
        selfAccountId={session.account.id}
        disabled={isNexOfficialAccount(peer.id)}
      />
      {/* Bridge 79 · surface IDB-only archived messages (Bridge 77
          cached rows the server has since purged via Bridge 78) as a
          floating pill + modal. Non-invasive · doesn't touch the shell. */}
      <ArchivePanel
        conversationId={conversation.id}
        peerDisplayName={peer.display_name}
        selfAccountId={session.account.id}
        disabled={isNexOfficialAccount(peer.id)}
      />
      {/* Owner fix 2026-11-05 · ContactPickerLauncher retired · the
          floating button inside the shell is no longer part of the
          chat design. Contact-picker functionality remains reachable
          via the + attach panel's Contact tile. */}
      {/* Phase 3 · auto-opening shop sheet triggered by
          `?focus_product=<id>`. Mounts only when the peer owns a
          business AND the business has live products · otherwise the
          server-side guard here hides the sheet entirely. The sheet
          handles honest-null stale ids by rendering without an accent
          card. The server passes a plain `name_canonical / price_pence
          / currency / image_url` projection so the client bundle
          stays small. */}
      {focusProductIdFromUrl && peerBusiness && peerProducts.length > 0 ? (
        <FocusedShopSheet
          focusProductId={focusProductIdFromUrl}
          products={peerProducts.map((p) => ({
            id: p.id,
            name: p.name,
            priceLabel:
              typeof p.price_pence === "number" && p.currency
                ? formatProductPriceLabel(p.price_pence, p.currency)
                : null,
            imageUrl: p.image_url ?? null,
          }))}
        />
      ) : null}

      {/* Owner-authorised 2026-11-05 · prototype UX siblings.
          Notifications bell top-left · ShopDrawer FAB bottom-right ·
          floating scroll-to-bottom pill when scrolled > 120 px above
          newest. The existing FreeChatCallCenterDrawerClient (3-dot
          FAB, Call Centre entry) stays mounted for now · Call Centre
          is also reachable via the + attach panel's Call Centre tile. */}
      {/* NotificationsDrawer bell moved into FreeChatHeader's right nav
          (notificationsSlot prop) · owner fix 2026-11-05 · prevents the
          standalone absolute-positioned trigger from sitting over the
          ping-badge avatar. Drawer panel still portals globally. */}
      {/* Owner fix 2026-11-05 · prototype UX expects the shop 3-dot FAB
          visible for every viewer (empty state renders cleanly when
          the viewer has no products). Earlier gate `viewerHasBusiness`
          hid the FAB for founder nex-99901 who has no nex_business row. */}
      <ShopDrawer
        viewerHasShop={true}
        peerDisplayName={peer.display_name}
        shareAction={bind}
      />
      <ScrollToBottomButton />
    </div>
  );
}

/** Pure · format `price_pence` + currency as a short label. Falls back
 *  to the raw integer when `Intl.NumberFormat` doesn't accept the
 *  currency string (never fabricates currency metadata). */
function formatProductPriceLabel(pricePence: number, currency: string): string {
  const whole = pricePence / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: whole % 1 === 0 ? 0 : 2,
    }).format(whole);
  } catch {
    return `${currency} ${whole.toLocaleString()}`;
  }
}
