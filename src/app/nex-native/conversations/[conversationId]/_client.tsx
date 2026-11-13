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

  const peerReady = !!peerAccountId;

  // ── Decrypt messages addressed to THIS device ─────────────────────
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const self = await ensureDeviceKey();
        const nextMap: Record<string, string> = {};
        for (const m of initialMessages) {
          if (!m.encrypted) {
            if (m.body) nextMap[m.id] = m.body;
            continue;
          }
          if (
            !m.ciphertext ||
            !m.nonce ||
            !m.sender_public_key ||
            !m.sender_device_id ||
            m.recipient_device_id !== self.deviceId
          ) {
            continue; // not addressed to this device · skip quietly
          }
          try {
            const senderPub = naclUtil.decodeBase64(m.sender_public_key);
            const senderAccountId = m.sender_account_id;
            const secret = getSharedSecret(
              self.secretKey,
              senderAccountId,
              m.sender_device_id,
              naclUtil.encodeBase64(senderPub),
            );
            const ct = naclUtil.decodeBase64(m.ciphertext);
            const nonce = naclUtil.decodeBase64(m.nonce);
            const pt = openWithSharedSecret(ct, nonce, secret);
            if (pt) nextMap[m.id] = naclUtil.encodeUTF8(pt);
          } catch {
            // Decryption failed · the row stays hidden from this
            // viewer (classic behaviour · don't surface ciphertext)
          }
        }
        if (!cancelled) setPlaintextById(nextMap);
      } catch {
        /* no local device key yet · initial paint shows ciphertext
         * placeholders · a page reload after key publish will decrypt */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialMessages]);

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
      router.refresh();
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
        {initialMessages.length === 0 ? (
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
          initialMessages.map((m) => {
            const mine = m.sender_account_id === selfAccountId;
            const text = plaintextById[m.id] ?? (m.encrypted ? "⋯" : (m.body ?? ""));
            const meta = m.attachment_meta as
              | {
                  product_id?: string;
                  name?: string;
                  price_pence?: number;
                  currency?: string;
                  image_url?: string;
                }
              | null
              | undefined;
            const isProductCard =
              m.attachment_type === "product" && meta && meta.product_id;
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
                {isProductCard ? (
                  <ProductCardBubble
                    name={meta?.name ?? "Product"}
                    pricePence={meta?.price_pence ?? 0}
                    currency={meta?.currency ?? "IDR"}
                    imageUrl={meta?.image_url ?? null}
                  />
                ) : null}
                {text ? (
                  <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {text}
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

      {/* ── Composer + 3-dot products trigger ────────────────────── */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px calc(env(safe-area-inset-bottom, 0px) + 10px)",
          background: "rgba(10, 21, 38, 0.92)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
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
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(198,161,91,0.35)",
            color: "#F2F5F8",
            fontSize: 14,
            fontFamily: "inherit",
            outline: "none",
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
            void doSend("", {
              attachmentType: "product",
              attachmentMeta: {
                product_id: product.id,
                name: product.name,
                price_pence: product.price_pence,
                currency: product.currency,
                image_url: product.image_url ?? null,
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
      {/* Drawer panel · slides from the left */}
      <aside
        style={{
          position: "relative",
          width: "78%",
          maxWidth: 320,
          height: "100%",
          background: "#0A1526",
          borderRight: "1.5px solid rgba(198,161,91,0.4)",
          boxShadow: "6px 0 24px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 14px 10px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span aria-hidden style={{ fontSize: 22 }}>
            {categoryIcon(businessCategory)}
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 0.2,
              color: "#F2F5F8",
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {businessDisplayName}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "transparent",
              border: "none",
              color: "#8BA9D1",
              fontSize: 20,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </header>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 8px 16px",
          }}
        >
          {products.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "rgba(242,245,248,0.65)",
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
                    width: "100%",
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: 8,
                    marginBottom: 6,
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#F2F5F8",
                    fontFamily: "inherit",
                    textAlign: "left",
                    cursor: "pointer",
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
                        background: "rgba(255,255,255,0.08)",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#8BA9D1" }}>
                      {p.currency} {price}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
