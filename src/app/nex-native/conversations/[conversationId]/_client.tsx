"use client";

// src/app/nex-native/conversations/[conversationId]/_client.tsx
//
// Owner-sealed 2026-11-13 · client shell for the business-scoped shop
// conversation.
// -----------------------------------------------------------------------------
// Owns the composer, realtime subscription, encrypted send, and the
// 3-dot shop products drawer. Mounted beneath the server-rendered
// shop identity header (see page.tsx).

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import naclUtil from "tweetnacl-util";
import {
  sendEncryptedBusinessMessage,
} from "@/lib/nex-native/crypto/encrypted-business-send";
import {
  ensureDeviceKey,
} from "@/lib/nex-native/crypto/device-key";
import {
  getSharedSecret,
  openWithSharedSecret,
} from "@/lib/nex-native/crypto/shared-secret";
// Owner directive 2026-11-13 (iter 2) · reuses the sealed Bridge 73
// broadcast pattern already serving peer chat. The channel carries
// ROUTING METADATA ONLY (conversation_id + group_id + timestamp) ·
// zero plaintext + zero ciphertext travels over the broadcast · on
// arrival the client fetches new rows via /api/nex-native/chat/
// encrypted/since (participant-guarded, server-side) and appends to
// liveMessages locally. Reconnection handled by openNexChannel's
// built-in lifecycle + onSubscribed catch-up (same as peer chat).
import {
  openMessageEventsChannel,
  type MessageEventsChannel,
} from "@/lib/nex-native/realtime/message-events";

const BIZ_CATEGORY_ICON: Record<string, string> = {
  "product-brand": "👜",
  ecommerce: "🛍️",
  "cafe": "☕",
  restaurant: "🍽️",
  bakery: "🥐",
  salon: "💇",
  beauty: "💄",
  fitness: "🏋️",
  consultant: "💼",
  "jewellery-watches": "⌚",
  creator: "🎨",
};

function categoryIcon(category: string | null | undefined): string {
  if (!category) return "🛍️";
  return BIZ_CATEGORY_ICON[category] ?? "🛍️";
}

interface Props {
  readonly conversationId: string;
  readonly selfAccountId: string;
  readonly peerAccountId: string | null;
  readonly businessId: string;
  readonly businessDisplayName: string;
  readonly businessCategory: string | null;
  // Owner directive 2026-11-13 (iter 8) · shop theme accent · drives
  // the gold/brand hex used in the products drawer (section label,
  // chevron tails, placeholder glyph, hover border). Resolved on the
  // server from business.shop_cover_tint_hex ?? themeRow.accent_hex
  // so the shop chat visually matches the shop surface.
  readonly accentHex: string;
  // Owner directive 2026-11-13 (iter 15) · owner-view only · the
  // customer's avatar + handle · used to render a tiny 28px avatar
  // beside the customer's bubbles (OWNER viewing) · tap routes to
  // /profile/<handle>. On the customer face these stay null · we do
  // NOT render the shop's avatar beside each shop bubble (the header
  // already carries the shop identity).
  readonly peerAvatarUrl: string | null;
  readonly peerHandle: string | null;
  readonly peerDisplayName: string | null;
  readonly shopProducts: ReadonlyArray<{
    id: string;
    name: string;
    description: string | null;
    price_pence: number;
    currency: string;
    image_url: string | null;
    status: string;
  }>;
  readonly initialMessages: ReadonlyArray<{
    id: string;
    conversation_id: string;
    sender_account_id: string;
    body: string | null;
    created_at: string;
    encrypted: boolean;
    ciphertext: string | null;
    nonce: string | null;
    sender_public_key: string | null;
    sender_device_id: string | null;
    recipient_device_id: string | null;
    attachment_type: string | null;
    attachment_meta: unknown;
    message_group_id: string | null;
  }>;
  readonly viewerSide: "customer" | "business";
}

type MessageRow = Props["initialMessages"][number];

export function BusinessConversationClient({
  conversationId,
  selfAccountId,
  peerAccountId,
  businessId: _businessId,
  businessDisplayName,
  businessCategory,
  accentHex,
  peerAvatarUrl,
  peerHandle,
  peerDisplayName,
  shopProducts,
  initialMessages,
  viewerSide,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [draft, setDraft] = React.useState("");
  const [sendState, setSendState] = React.useState<
    "idle" | "sending" | "error"
  >("idle");
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [productsDrawerOpen, setProductsDrawerOpen] = React.useState(false);
  const [plaintextById, setPlaintextById] = React.useState<
    Record<string, string>
  >({});
  // Owner directive 2026-11-13 (iter 2) · live messages array owned by
  // the client · seeded from server-rendered initialMessages, then
  // appended via Supabase Realtime INSERT events scoped to this
  // conversation_id. Dedup by id · no refresh needed.
  const [liveMessages, setLiveMessages] = React.useState<MessageRow[]>(
    () => [...initialMessages],
  );
  const seenIds = React.useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)));

  const peerReady = !!peerAccountId;

  // Owner directive 2026-11-13 (iter 13) · product-share cooldown.
  // Once the viewer sends a product card, the "open products" trigger
  // stays LOCKED until the other side replies with ANY message. This
  // stops the user from spam-sharing the same product (or different
  // products) before the shop owner has had a chance to respond.
  //
  // Derivation (reactive · reads liveMessages):
  //   · find my most recent product-share timestamp
  //   · if no peer message has arrived after it → locked
  //   · if peer has replied (any message) after it → unlocked
  //   · never any self-product-share → unlocked
  const productShareLocked = React.useMemo(() => {
    let lastMineProductAt: string | null = null;
    for (const m of liveMessages) {
      if (
        m.sender_account_id === selfAccountId &&
        m.attachment_type === "product"
      ) {
        if (!lastMineProductAt || m.created_at > lastMineProductAt) {
          lastMineProductAt = m.created_at;
        }
      }
    }
    if (!lastMineProductAt) return false;
    for (const m of liveMessages) {
      if (
        m.sender_account_id !== selfAccountId &&
        m.created_at > lastMineProductAt
      ) {
        return false;
      }
    }
    return true;
  }, [liveMessages, selfAccountId]);

  // ── Helper · decrypt one row if addressed to this device ─────────
  const decryptRow = React.useCallback(
    async (m: MessageRow): Promise<string | null> => {
      if (!m.encrypted) return m.body;
      if (
        !m.ciphertext ||
        !m.nonce ||
        !m.sender_public_key ||
        !m.sender_device_id
      ) {
        return null;
      }
      try {
        const self = await ensureDeviceKey();
        if (m.recipient_device_id !== self.deviceId) return null;
        const secret = getSharedSecret(
          self.secretKey,
          m.sender_account_id,
          m.sender_device_id,
          m.sender_public_key,
        );
        const ct = naclUtil.decodeBase64(m.ciphertext);
        const nonce = naclUtil.decodeBase64(m.nonce);
        const pt = openWithSharedSecret(ct, nonce, secret);
        return pt ? naclUtil.encodeUTF8(pt) : null;
      } catch {
        return null;
      }
    },
    [],
  );

  // ── Decrypt INITIAL messages (first paint) ───────────────────────
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const m of liveMessages) {
        const pt = await decryptRow(m);
        if (pt !== null) next[m.id] = pt;
      }
      if (!cancelled) setPlaintextById((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
    // initialMessages is captured on mount · live rows get decrypted
    // in the Realtime handler below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Live delivery · arrival nudge → /since fetch → append ────────
  const watermarkRef = React.useRef<string>(
    initialMessages.length > 0
      ? initialMessages[initialMessages.length - 1]!.created_at
      : new Date(0).toISOString(),
  );
  const inFlightFetchRef = React.useRef<boolean>(false);

  const fetchSince = React.useCallback(async () => {
    if (inFlightFetchRef.current) return;
    inFlightFetchRef.current = true;
    try {
      const resp = await fetch(
        `/api/nex-native/chat/encrypted/since?conversationId=${encodeURIComponent(
          conversationId,
        )}&since=${encodeURIComponent(watermarkRef.current)}`,
        { credentials: "include" },
      );
      if (!resp.ok) return;
      const json = (await resp.json()) as {
        ok: boolean;
        messages?: MessageRow[];
        watermark?: string;
      };
      if (!json.ok || !json.messages) return;
      const fresh = json.messages.filter((m) => !seenIds.current.has(m.id));
      if (fresh.length === 0) {
        if (json.watermark) watermarkRef.current = json.watermark;
        return;
      }
      for (const m of fresh) seenIds.current.add(m.id);
      setLiveMessages((prev) => [...prev, ...fresh]);
      if (json.watermark) watermarkRef.current = json.watermark;
      // Decrypt new rows locally.
      void (async () => {
        const next: Record<string, string> = {};
        for (const m of fresh) {
          const pt = await decryptRow(m);
          if (pt !== null) next[m.id] = pt;
        }
        if (Object.keys(next).length > 0) {
          setPlaintextById((p) => ({ ...p, ...next }));
        }
      })();
    } catch {
      /* fail-soft · next arrival nudge or visibility change retries */
    } finally {
      inFlightFetchRef.current = false;
    }
  }, [conversationId, decryptRow]);

  React.useEffect(() => {
    const channel: MessageEventsChannel = openMessageEventsChannel({
      conversationId,
      selfAccountId,
      onPeerMessageArrival: () => {
        void fetchSince();
      },
      // onSubscribed fires on initial subscribe + every reconnect ·
      // triggers a catch-up fetch so a tab that was asleep or lost
      // its WebSocket immediately reconciles.
      onSubscribed: () => {
        void fetchSince();
      },
    });
    const onVisibility = () => {
      if (document.visibilityState === "visible") void fetchSince();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void channel.close();
    };
  }, [conversationId, selfAccountId, fetchSince]);

  // ── Send encrypted message ────────────────────────────────────────
  async function doSend(
    body: string,
    opts?: {
      attachmentType?: "product";
      attachmentMeta?: Record<string, unknown>;
    },
  ): Promise<void> {
    if (!peerAccountId) {
      setSendState("error");
      setSendError("No business participant resolved · cannot send");
      return;
    }
    const trimmed = body.trim();
    if (!trimmed && !opts?.attachmentType) return;
    setSendState("sending");
    setSendError(null);
    const outcome = await sendEncryptedBusinessMessage({
      conversationId,
      peerAccountId,
      selfAccountId,
      plaintext: trimmed,
      attachmentType: opts?.attachmentType ?? null,
      attachmentMeta: opts?.attachmentMeta ?? null,
    });
    if (outcome.ok) {
      setDraft("");
      setSendState("idle");
      // Owner directive 2026-11-13 (iter 2) · router.refresh() retired.
      // Realtime subscription above picks up the INSERTed row and
      // appends it to liveMessages · no reload needed.
      return;
    }
    setSendState("error");
    setSendError(
      outcome.error === "no_peer_devices"
        ? "This shop hasn't set up encryption yet · they need to open NEX once"
        : outcome.error === "no_self_devices"
          ? "Your device hasn't published its key yet · retry in a moment"
          : (outcome.message ?? outcome.error),
    );
  }

  const canSend = sendState !== "sending" && draft.trim().length > 0 && peerReady;

  return (
    <>
      {/* ── Message list ─────────────────────────────────────────── */}
      <div
        data-nex-business-conv-messages
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "16px 16px 90px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* Owner directive 2026-11-13 (iter 15) · welcome panel always
            at the TOP of the thread. System primer · client-rendered
            only · NEVER written to nex_message so we don't fake-sign
            a message from the shop. Muted panel style so it reads as
            onboarding, not a message. Visible even once the thread
            has real messages · stays as the thread's intro card. */}
        <WelcomeBubble
          businessDisplayName={businessDisplayName}
          businessCategory={businessCategory}
          accentHex={accentHex}
          viewerSide={viewerSide}
        />

        {liveMessages.length === 0 ? null : (
          liveMessages.map((m, i) => {
            const mine = m.sender_account_id === selfAccountId;
            const prev = i > 0 ? liveMessages[i - 1] : null;
            const firstInRun =
              !prev || prev.sender_account_id !== m.sender_account_id;
            // Owner directive 2026-11-13 (iter 15) · owner-view only ·
            // show the customer's avatar on the first bubble of each
            // of their runs so the shop can see WHO is writing and
            // tap through to their profile. Customer face NEVER sees
            // avatars beside shop bubbles (header already shows the
            // shop).
            const showPeerAvatar =
              !mine &&
              viewerSide === "business" &&
              firstInRun &&
              !!peerAvatarUrl;
            const decrypted = plaintextById[m.id] ?? (m.encrypted ? null : m.body);
            // Owner directive 2026-11-13 (iter 2) · product envelope
            // lives INSIDE the decrypted plaintext · only decoded on
            // this device after local decryption. attachment_type on
            // the row is the server-visible marker; the actual
            // product data (name/price/image) is private payload.
            let productEnvelope:
              | {
                  kind: "product";
                  product_id: string;
                  name?: string;
                  price_pence?: number;
                  currency?: string;
                  image_url?: string | null;
                }
              | null = null;
            let renderedText: string = "";
            if (m.attachment_type === "product" && decrypted) {
              try {
                const parsed = JSON.parse(decrypted);
                if (parsed && parsed.kind === "product" && typeof parsed.product_id === "string") {
                  productEnvelope = parsed;
                }
              } catch {
                // not a product envelope · fall through to plain text
                renderedText = decrypted;
              }
            } else {
              renderedText = decrypted ?? "⋯";
            }
            const isProductCard = !!productEnvelope;
            // Avatar lane reserved only on OWNER view so customer's
            // bubbles align consistently (first-of-run shows avatar,
            // rest show a 28px spacer).
            const reserveAvatarLane = viewerSide === "business" && !mine;
            return (
              <div
                key={m.id}
                data-nex-business-conv-row={m.id}
                style={{
                  alignSelf: mine ? "flex-end" : "flex-start",
                  maxWidth: "88%",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-end",
                  gap: 6,
                }}
              >
                {reserveAvatarLane ? (
                  showPeerAvatar && peerAvatarUrl && peerHandle ? (
                    <Link
                      href={`/nex-native/profile/${peerHandle}`}
                      aria-label={`Open ${peerDisplayName ?? "customer"} profile`}
                      data-nex-business-conv-peer-avatar
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        overflow: "hidden",
                        flexShrink: 0,
                        display: "block",
                        textDecoration: "none",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                        border: `1.5px solid ${accentHex}`,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={peerAvatarUrl}
                        alt={peerDisplayName ?? "customer"}
                        width={28}
                        height={28}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    </Link>
                  ) : (
                    <div aria-hidden style={{ width: 28, flexShrink: 0 }} />
                  )
                ) : null}
              <div
                data-nex-business-conv-bubble={m.id}
                data-nex-bubble-mine={mine ? "true" : "false"}
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  // Owner directive 2026-11-13 (iter 11) · chat bubbles
                  // tinted BLACK · mine is deeper opacity (owns the
                  // thread edge) · theirs slightly softer so the two
                  // sides remain distinguishable on the same wallpaper.
                  background: mine
                    ? "rgba(0, 0, 0, 0.78)"
                    : "rgba(0, 0, 0, 0.58)",
                  color: "#F2F5F8",
                  fontSize: 14,
                  lineHeight: 1.4,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                  flex: "0 1 auto",
                  minWidth: 0,
                }}
              >
                {isProductCard && productEnvelope ? (
                  <ProductCardBubble
                    name={productEnvelope.name ?? "Product"}
                    pricePence={productEnvelope.price_pence ?? 0}
                    currency={productEnvelope.currency ?? "IDR"}
                    imageUrl={productEnvelope.image_url ?? null}
                  />
                ) : m.attachment_type === "product" ? (
                  // Encrypted product share · we can't decrypt the
                  // product envelope on this device · render a muted
                  // placeholder so the viewer knows "a product was
                  // shared" without exposing anything.
                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: "rgba(0,0,0,0.12)",
                      fontSize: 12,
                      opacity: 0.7,
                      marginBottom: 4,
                    }}
                  >
                    🛍️ Product shared · open on this device to view
                  </div>
                ) : null}
                {renderedText ? (
                  <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {renderedText}
                  </div>
                ) : null}
                {/* Owner directive 2026-11-13 (iter 9) · product cards
                    get a full date + time stamp so the shop + buyer can
                    see exactly when the item was shared. Plain-text
                    bubbles stay time-only to avoid timeline noise. */}
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 10,
                    opacity: 0.6,
                    textAlign: "right",
                  }}
                >
                  {/* Owner directive 2026-11-13 (iter 19) · locked
                      locale "en-US" · the default [] locale picked
                      the server's system locale (24-hour, dot
                      separator) while the browser used 12-hour, so
                      server + client disagreed and React threw a
                      hydration mismatch. Pinning "en-US" produces
                      the same "06:35 PM" string on both sides. */}
                  {isProductCard
                    ? new Date(m.created_at).toLocaleString("en-US", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : new Date(m.created_at).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                </div>
              </div>
              </div>
            );
          })
        )}
      </div>

      {/* Owner directive 2026-11-13 (iter 10) · composer layout:
            [ 3-dots button · ORANGE ]  [ text pill with embedded send ]
          The 3-dots lives outside the pill as a solid orange
          circle (overrides the shop accent so the trigger is always
          visible against any shop theme). The send button sits
          INSIDE the input pill, pinned to the right. */}
      <style>{`
        @keyframes nex-biz-dots-flash {
          0%   { opacity: 0.55; transform: scale(1); }
          50%  { opacity: 1;    transform: scale(1.08); }
          100% { opacity: 0.55; transform: scale(1); }
        }
      `}</style>
      <div
        style={{
          position: "sticky",
          bottom: 0,
          width: "100%",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px calc(env(safe-area-inset-bottom, 0px) + 10px)",
          background: "transparent",
          borderTop: "none",
        }}
      >
        <button
          type="button"
          aria-label={
            productShareLocked
              ? "Waiting for shop reply before sharing another product"
              : productsDrawerOpen
                ? "Close shop products"
                : "Open shop products"
          }
          aria-expanded={productsDrawerOpen}
          title={
            productShareLocked
              ? "Waiting for the shop to reply before you can share again"
              : undefined
          }
          disabled={productShareLocked}
          onClick={() => {
            if (productShareLocked) return;
            setProductsDrawerOpen((v) => !v);
          }}
          data-nex-business-conv-dots
          data-nex-business-conv-dots-locked={productShareLocked ? "true" : "false"}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            padding: 0,
            display: "grid",
            placeItems: "center",
            // Owner directive 2026-11-13 (iter 10 + iter 17) · ORANGE
            // override · overrides the shop accent so the products
            // trigger is always obvious + brand-consistent across
            // themes. iter 17 · circle stays SOLID orange in every
            // state · the cooldown lock still disables tap (handler
            // + `disabled` + aria-label), but the colour never dims.
            // The pulse animation is the only visible state tell ·
            // it stops when locked or the drawer is already open.
            background: "#F97316",
            border: "none",
            color: "#FFFFFF",
            cursor: productShareLocked ? "not-allowed" : "pointer",
            flexShrink: 0,
            boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
            animation:
              productShareLocked || productsDrawerOpen
                ? "none"
                : "nex-biz-dots-flash 1800ms ease-in-out infinite",
          }}
        >
          <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="12" cy="5" r="2.6" />
            <circle cx="12" cy="12" r="2.6" />
            <circle cx="12" cy="19" r="2.6" />
          </svg>
        </button>
        {/* Composer pill · relative wrapper so the send button can sit
            absolutely INSIDE the input on the right. padding-right on
            the input reserves room for the embedded circle. */}
        <div
          style={{
            position: "relative",
            flex: 1,
            display: "flex",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            // Owner directive 2026-11-13 (iter 18) · maximise mobile
            // keypad behaviour · inputMode + enterKeyHint help iOS +
            // Android pick the right layout and labelled Enter key.
            // autoComplete off so password managers don't hijack.
            inputMode="text"
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="on"
            spellCheck
            placeholder={peerReady ? "Message…" : "Loading…"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && canSend) {
                e.preventDefault();
                void doSend(draft);
              }
            }}
            disabled={!peerReady}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 46px 10px 14px",
              borderRadius: 999,
              background: "#FFFFFF",
              border: "1px solid rgba(198,161,91,0.55)",
              color: "#0A1526",
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.28)",
            }}
          />
          <button
            type="button"
            onClick={() => void doSend(draft)}
            disabled={!canSend}
            data-nex-business-conv-send
            aria-label="Send message"
            style={{
              position: "absolute",
              right: 4,
              top: "50%",
              transform: "translateY(-50%)",
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "none",
              // Owner directive 2026-11-13 (iter 14 + iter 17) · send
              // button is SOLID ORANGE with a play/arrow glyph ·
              // matches the orange 3-dots trigger so the composer
              // reads as one pair of branded controls. iter 17 ·
              // colour + opacity stay constant regardless of enabled
              // state · the `disabled` attribute still blocks tap
              // when the draft is empty · we never dim the fill.
              background: "#F97316",
              color: "#FFFFFF",
              cursor: canSend ? "pointer" : "default",
              padding: 0,
              display: "grid",
              placeItems: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
            }}
          >
            {/* play/arrow triangle · points right · reads as "send" */}
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6 4l14 8-14 8V4z" />
            </svg>
          </button>
        </div>
      </div>

      {sendError ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 72,
            left: 16,
            right: 16,
            padding: "10px 14px",
            background: "rgba(127, 29, 29, 0.92)",
            border: "1px solid rgba(255,100,100,0.5)",
            borderRadius: 10,
            color: "#FFEAEA",
            fontSize: 12,
            textAlign: "center",
            zIndex: 20,
          }}
        >
          {sendError}
        </div>
      ) : null}

      {/* ── Products drawer (left-side slide-in) ─────────────────── */}
      {productsDrawerOpen ? (
        <ShopProductsDrawer
          businessDisplayName={businessDisplayName}
          businessCategory={businessCategory}
          accentHex={accentHex}
          products={shopProducts}
          onClose={() => setProductsDrawerOpen(false)}
          onSelect={(product) => {
            setProductsDrawerOpen(false);
            // Owner directive 2026-11-13 (iter 2) · minimum public
            // product reference in attachment_meta (server-visible)
            // · full product snapshot lives ONLY inside the encrypted
            // plaintext body. On decrypt, the client parses the JSON
            // envelope and renders the product card. If a viewer
            // can't decrypt, they see the attachment_type='product'
            // marker + id (opaque reference) but NOT the product's
            // name/price/image unless they fetch it themselves from
            // the public shop catalogue.
            const productEnvelope = JSON.stringify({
              kind: "product",
              product_id: product.id,
              name: product.name,
              price_pence: product.price_pence,
              currency: product.currency,
              image_url: product.image_url ?? null,
            });
            void doSend(productEnvelope, {
              attachmentType: "product",
              attachmentMeta: {
                // Server sees ONLY the bare reference. Enough for
                // "look up this product in the public catalogue"
                // but not the private pricing snapshot at send-time.
                product_id: product.id,
              },
            });
          }}
        />
      ) : null}
    </>
  );
}

// ─── Product card bubble (inline product share) ─────────────────────

function ProductCardBubble({
  name,
  pricePence,
  currency,
  imageUrl,
}: {
  name: string;
  pricePence: number;
  currency: string;
  imageUrl: string | null;
}): React.JSX.Element {
  // IDR is zero-decimal · the price_pence IS the whole-rupiah amount.
  // Everything else is minor-unit · divide by 100 for display.
  const zeroDecimal = currency === "IDR" || currency === "JPY";
  const displayPrice = zeroDecimal
    ? pricePence
    : (pricePence / 100).toFixed(2);
  return (
    <div
      data-nex-business-conv-product-card
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        marginBottom: 6,
        padding: 8,
        borderRadius: 10,
        background: "rgba(0,0,0,0.12)",
      }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name}
          width={48}
          height={48}
          style={{
            width: 48,
            height: 48,
            objectFit: "cover",
            borderRadius: 8,
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            background: "rgba(255,255,255,0.08)",
            flexShrink: 0,
          }}
        />
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {currency} {displayPrice}
        </div>
      </div>
    </div>
  );
}

// ─── Shop products drawer (left-side slide-in) ──────────────────────

function ShopProductsDrawer({
  businessDisplayName,
  businessCategory,
  accentHex,
  products,
  onClose,
  onSelect,
}: {
  businessDisplayName: string;
  businessCategory: string | null;
  accentHex: string;
  products: Props["shopProducts"];
  onClose: () => void;
  onSelect: (p: Props["shopProducts"][number]) => void;
}): React.JSX.Element {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      data-nex-shop-products-drawer
      role="dialog"
      aria-modal="true"
      aria-label={`${businessDisplayName} products`}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        display: "flex",
        // Owner directive 2026-11-13 (iter 8) · shop accent surfaced
        // as a CSS variable so the :hover rule in the style block
        // below can use it without inline-style gymnastics.
        ["--nex-biz-accent" as string]: accentHex,
      } as React.CSSProperties}
    >
      {/* Backdrop · tap to close */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />
      {/* Drawer panel · slides from the left · owner directive
          2026-11-13 (iter 6) · palette now matches the sealed
          ContactsPlusDrawer: dark-green glass body, gold section
          label, gold-tinted hover left-border, softened subcopy ink. */}
      <aside
        style={{
          position: "relative",
          width: "min(320px, 85%)",
          height: "100%",
          background: "var(--nex-world-drawer-bg, #123D2B)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "6px 0 32px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "#F2F5F8",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "calc(env(safe-area-inset-top, 0) + 18px) 18px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>
              {categoryIcon(businessCategory)}
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: "0.03em",
                // Owner directive 2026-11-13 (iter 12) · drawer shop name
                // ORANGE · matches the orange 3-dots trigger that
                // opens this drawer · the two are a visual pair.
                color: "#F97316",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {businessDisplayName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close products"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              // Owner directive 2026-11-13 (iter 12) · close (×) button
              // BLACK · solid black circle so it reads as a decisive
              // dismiss control against the green drawer.
              background: "#000000",
              color: "#FFFFFF",
              border: "1px solid rgba(255,255,255,0.18)",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
            }}
          >
            ×
          </button>
        </header>
        <nav
          data-nex-shop-products-drawer-list
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 0",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {products.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "var(--nex-world-primary-ink, #AFC5B5)",
                fontSize: 13,
              }}
            >
              This shop has no live products yet.
            </div>
          ) : (
            products.map((p) => {
              const zeroDecimal = p.currency === "IDR" || p.currency === "JPY";
              const price = zeroDecimal
                ? p.price_pence
                : (p.price_pence / 100).toFixed(2);
              return (
                // Owner directive 2026-11-13 (iter 7) · each product
                // sits in its own WHITE card with BLACK name text ·
                // reads like a proper product card against the dark-
                // green drawer body. When image_url is null we paint
                // a cream placeholder tile with a shopping-bag glyph
                // so empty rows still read as "product".
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelect(p)}
                  data-nex-shop-products-drawer-item={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: 8,
                    margin: "6px 12px",
                    width: "calc(100% - 24px)",
                    background: "#FFFFFF",
                    color: "#0A1526",
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    textAlign: "left",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                    transition: "transform 120ms ease-out, box-shadow 120ms ease-out",
                  }}
                >
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.name}
                      width={48}
                      height={48}
                      style={{
                        width: 48,
                        height: 48,
                        objectFit: "cover",
                        borderRadius: 8,
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      aria-hidden
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        // Owner directive 2026-11-13 (iter 8) · placeholder
                        // tile tints toward the shop accent (semi-transparent)
                        // so even the missing-image fallback reads as part
                        // of the shop brand.
                        background: `${accentHex}22`,
                        display: "grid",
                        placeItems: "center",
                        color: accentHex,
                        flexShrink: 0,
                      }}
                    >
                      {/* shopping-bag glyph · stand-in product image */}
                      <svg width={26} height={26} viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M6 7h12l-1 13H7L6 7z M9 7a3 3 0 1 1 6 0"
                          stroke="currentColor"
                          strokeWidth={1.75}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                  <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span
                      style={{
                        color: "#000000",
                        fontSize: 14,
                        fontWeight: 700,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.name}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#5A6578",
                      }}
                    >
                      {p.currency} {price}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: accentHex,
                    }}
                  >
                    ›
                  </span>
                </button>
              );
            })
          )}
        </nav>
        <style>{`
          [data-nex-shop-products-drawer-list] button:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
            border-color: var(--nex-biz-accent, #C6A15B) !important;
          }
          [data-nex-shop-products-drawer-list] button:active {
            transform: translateY(0);
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
          }
        `}</style>
      </aside>
    </div>
  );
}

// ─── Welcome / onboarding bubble ────────────────────────────────────
//
// Owner directive 2026-11-13 (iter 15) · system primer always at the
// top of the thread. Client-rendered only · NEVER persisted in
// nex_message so we never fake-sign a message from the shop. On the
// customer face the copy prompts the visitor to ask about any product
// AND reminds them that a free NEX account is what unlocks receiving
// replies. On the owner (business) face the primer tells the shop
// owner that the thread is encrypted and replies route back to the
// customer's chat.

function WelcomeBubble({
  businessDisplayName,
  businessCategory,
  accentHex,
  viewerSide,
}: {
  businessDisplayName: string;
  businessCategory: string | null;
  accentHex: string;
  viewerSide: "customer" | "business";
}): React.JSX.Element {
  const isCustomer = viewerSide === "customer";
  return (
    <div
      data-nex-business-conv-welcome
      style={{
        alignSelf: "center",
        maxWidth: "92%",
        padding: "14px 16px",
        borderRadius: 14,
        // Owner directive 2026-11-13 (iter 16) · welcome panel SOLID
        // BLACK · reads as a decisive onboarding card over any shop
        // wallpaper · accent border keeps the shop brand touch.
        background: "#000000",
        border: `1px solid ${accentHex}55`,
        color: "#F2F5F8",
        fontSize: 12.5,
        lineHeight: 1.5,
        textAlign: "center",
        marginBottom: 6,
        boxShadow: "0 3px 10px rgba(0,0,0,0.5)",
      }}
    >
      <div
        aria-hidden
        style={{ fontSize: 28, marginBottom: 6, lineHeight: 1 }}
      >
        {categoryIcon(businessCategory)}
      </div>
      <div
        style={{
          fontWeight: 800,
          color: accentHex,
          fontSize: 14,
          marginBottom: 4,
          letterSpacing: "0.01em",
        }}
      >
        Welcome to {businessDisplayName}
      </div>
      {isCustomer ? (
        <>
          <div style={{ marginBottom: 6 }}>
            Ask about any product · the shop will reply right here.
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.85 }}>
            Tip · create your free NEX account so you can receive replies
            and pick the conversation back up next time you visit. All
            messages are end-to-end encrypted.
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12 }}>
          A customer is reaching out · reply here to answer their
          questions. Messages are end-to-end encrypted on both sides.
        </div>
      )}
    </div>
  );
}
