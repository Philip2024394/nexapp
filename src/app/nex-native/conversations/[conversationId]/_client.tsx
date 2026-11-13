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
        {liveMessages.length === 0 ? (
          <div
            style={{
              margin: "auto",
              textAlign: "center",
              color: "rgba(242,245,248,0.65)",
              fontSize: 13,
              lineHeight: 1.5,
              padding: "32px 20px",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 8 }}>
              {categoryIcon(businessCategory)}
            </div>
            <div style={{ fontWeight: 700, color: "#F2F5F8", marginBottom: 6 }}>
              {businessDisplayName}
            </div>
            <div>
              Say hello · ask about a product · all messages end-to-end
              encrypted.
            </div>
          </div>
        ) : (
          liveMessages.map((m) => {
            const mine = m.sender_account_id === selfAccountId;
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
            return (
              <div
                key={m.id}
                data-nex-business-conv-bubble={m.id}
                data-nex-bubble-mine={mine ? "true" : "false"}
                style={{
                  alignSelf: mine ? "flex-end" : "flex-start",
                  maxWidth: "78%",
                  padding: "10px 14px",
                  borderRadius: 14,
                  background: mine
                    ? "rgba(198, 161, 91, 0.92)"
                    : "rgba(10, 21, 38, 0.82)",
                  color: mine ? "#0A1526" : "#F2F5F8",
                  fontSize: 14,
                  lineHeight: 1.4,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
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
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 10,
                    opacity: 0.6,
                    textAlign: "right",
                  }}
                >
                  {new Date(m.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Owner directive 2026-11-13 (iter 2) · composer strip stays
          transparent (no full-width dark bar) but the controls get a
          solid white input + solid gold send button so they read
          clearly over the shop wallpaper. Previous "lift the paint"
          made the input + buttons effectively invisible. */}
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
        <input
          type="text"
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
            flex: 1,
            padding: "10px 14px",
            borderRadius: 999,
            // Solid white pill · reads clearly over the shop wallpaper.
            background: "#FFFFFF",
            border: "1px solid rgba(198,161,91,0.55)",
            color: "#0A1526",
            fontSize: 14,
            fontFamily: "inherit",
            outline: "none",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.28)",
          }}
        />
        {/* 3-dot products trigger · bare glyph, flashing, right side. */}
        <style>{`
          @keyframes nex-biz-dots-flash {
            0%   { opacity: 0.55; transform: scale(1); }
            50%  { opacity: 1;    transform: scale(1.08); }
            100% { opacity: 0.55; transform: scale(1); }
          }
        `}</style>
        <button
          type="button"
          aria-label={productsDrawerOpen ? "Close shop products" : "Open shop products"}
          aria-expanded={productsDrawerOpen}
          onClick={() => setProductsDrawerOpen((v) => !v)}
          data-nex-business-conv-dots
          style={{
            width: 44,
            height: 44,
            padding: 0,
            display: "grid",
            placeItems: "center",
            background: "transparent",
            border: "none",
            color: "#C6A15B",
            cursor: "pointer",
            animation: productsDrawerOpen
              ? "none"
              : "nex-biz-dots-flash 1800ms ease-in-out infinite",
          }}
        >
          <svg width={28} height={28} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="12" cy="5" r="2.6" />
            <circle cx="12" cy="12" r="2.6" />
            <circle cx="12" cy="19" r="2.6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => void doSend(draft)}
          disabled={!canSend}
          data-nex-business-conv-send
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "none",
            background: canSend ? "#C6A15B" : "rgba(198,161,91,0.35)",
            color: "#0A1526",
            cursor: canSend ? "pointer" : "default",
            fontSize: 18,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          ↑
        </button>
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
  products,
  onClose,
  onSelect,
}: {
  businessDisplayName: string;
  businessCategory: string | null;
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
      }}
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
                color: "var(--nex-world-secondary, #C6A15B)",
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
              background: "transparent",
              color: "#F2F5F8",
              border: "1px solid rgba(255,255,255,0.2)",
              fontSize: 16,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
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
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelect(p)}
                  data-nex-shop-products-drawer-item={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 20px",
                    width: "100%",
                    background: "transparent",
                    color: "#F2F5F8",
                    border: "none",
                    borderLeft: "3px solid transparent",
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "background 150ms ease-out",
                  }}
                >
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.name}
                      width={44}
                      height={44}
                      style={{
                        width: 44,
                        height: 44,
                        objectFit: "cover",
                        borderRadius: 8,
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      aria-hidden
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.08)",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.name}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "var(--nex-world-primary-ink, #AFC5B5)",
                        opacity: 0.85,
                      }}
                    >
                      {p.currency} {price}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    style={{
                      fontSize: 14,
                      color: "var(--nex-world-secondary, #C6A15B)",
                      opacity: 0.5,
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
            background: color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 8%, transparent);
            border-left-color: var(--nex-world-secondary, #C6A15B) !important;
          }
        `}</style>
      </aside>
    </div>
  );
}
