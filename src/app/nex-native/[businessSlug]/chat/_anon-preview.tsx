"use client";

// src/app/nex-native/[businessSlug]/chat/_anon-preview.tsx
//
// Owner-sealed 2026-11-13 (iter 21) · anonymous chat preview shell.
// -----------------------------------------------------------------------------
// Renders the same visual chrome as the real /conversations/<id> page
// (header with ping-rimmed shop logo + flag + city + shop-glyph button,
// welcome bubble, orange 3-dots + products drawer, white pill composer
// with inline orange send). The ONLY difference is the composer send
// tap · instead of encrypting + posting, it opens the NEX sign-up /
// sign-in registration popup so the visitor completes auth before the
// first message leaves the device.
//
// Why a separate component: BusinessConversationClient owns the
// encrypted-send pipeline + realtime subscription + device-key resolve.
// Anonymous visitors have no device key AND no conversation row, so
// routing them through that client would require conditional branches
// in a dozen places. A dedicated shell is tiny and clearer.

import * as React from "react";
import Link from "next/link";
// Stage 7 · item 5 · 2026-11-14 · shared polished Stage-4 modal ·
// replaces the inline SignupPopup that used to live at the bottom
// of this file. Same honesty copy as the Product Detail Sheet and
// the shop cover FAB · one shape across every anon entry point.
import { ShopChatRegistrationPopup } from "@/components/nex-native/business-chat/ShopChatRegistrationPopup";

interface Props {
  readonly businessSlug: string;
  readonly businessId: string;
  readonly businessDisplayName: string;
  readonly businessCategory: string | null;
  readonly businessCity: string | null;
  readonly businessLogoUrl: string | null;
  readonly wallpaperUrl: string | null;
  readonly accentHex: string;
  readonly flagEmoji: string;
  readonly flagIso: string | null;
  readonly shopProducts: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly price_pence: number;
    readonly currency: string;
    readonly image_url: string | null;
  }>;
}

export function AnonymousChatPreview({
  businessSlug,
  businessId,
  businessDisplayName,
  businessCategory,
  businessCity,
  businessLogoUrl,
  wallpaperUrl,
  accentHex,
  flagEmoji,
  flagIso,
  shopProducts,
}: Props): React.JSX.Element {
  const [draft, setDraft] = React.useState("");
  const [popupOpen, setPopupOpen] = React.useState(false);
  const [productsDrawerOpen, setProductsDrawerOpen] = React.useState(false);

  function requestSignup(reason: "send" | "product"): void {
    // Owner directive 2026-11-13 (iter 23) · stash draft in SAME-ORIGIN
    // sessionStorage, not the URL. sessionStorage survives in-tab
    // navigation (including the signup roundtrip) but is wiped on
    // tab/browser close · recovery across tab close is NOT guaranteed
    // and must not be claimed. Keyed by businessId so one shop can
    // never read another shop's draft.
    if (reason === "send" && draft.trim().length > 0) {
      try {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            `nex-anon-chat-draft:${businessId}`,
            draft,
          );
        }
      } catch {
        /* sessionStorage disabled (private mode quota, etc.) · fall
           through · the user will simply need to retype after signup */
      }
    }
    setPopupOpen(true);
    setProductsDrawerOpen(false);
  }

  // Stage 7 · item 5 · 2026-11-14 · the sealed Stage-4 popup builds
  // its own `?next=` hrefs from the shop slug (and optional product
  // id) via `buildShopChatRegistrationHrefs`. The local signUpHref /
  // signInHref variables + returnPath are no longer needed · the
  // ShopChatRegistrationPopup mounted below reads businessSlug and
  // generates the same shape (just like the Product Detail Sheet
  // and the shop cover FAB).

  return (
    <main
      data-nex-anon-chat-preview
      data-nex-business-slug={businessSlug}
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
      <style>{`
        @keyframes nex-anon-ping {
          0%   { transform: scale(1);    opacity: 0.85; }
          70%  { transform: scale(1.35); opacity: 0;    }
          100% { transform: scale(1.35); opacity: 0;    }
        }
        @keyframes nex-anon-dots-flash {
          0%   { opacity: 0.55; transform: scale(1); }
          50%  { opacity: 1;    transform: scale(1.08); }
          100% { opacity: 0.55; transform: scale(1); }
        }
      `}</style>

      {/* Header · mirrors the signed-in conversation page */}
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
        <Link
          href={`/nex-native/${businessSlug}`}
          aria-label={`Open ${businessDisplayName} shop`}
          style={{
            position: "relative",
            width: 48,
            height: 48,
            flexShrink: 0,
            display: "block",
            textDecoration: "none",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: -2,
              borderRadius: "50%",
              border: "2px solid #22C55E",
              opacity: 0.85,
              animation:
                "nex-anon-ping 1600ms cubic-bezier(0.22, 1, 0.36, 1) infinite",
              pointerEvents: "none",
            }}
          />
          {businessLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={businessLogoUrl}
              alt={businessDisplayName}
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
        </Link>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.005em",
              whiteSpace: "normal",
              wordBreak: "normal",
              overflowWrap: "break-word",
              textShadow: "0 1px 3px rgba(0,0,0,0.6)",
            }}
          >
            {businessDisplayName}
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
            {(businessCity ?? "").trim() || "Shop"}
          </div>
        </div>

        <Link
          href={`/nex-native/${businessSlug}`}
          aria-label={`Open ${businessDisplayName} shop page`}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
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
      </header>

      {/* Message area · only the welcome bubble, no history */}
      <div
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
        <div
          data-nex-anon-chat-welcome
          style={{
            alignSelf: "center",
            maxWidth: "92%",
            padding: "14px 16px",
            borderRadius: 14,
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
          <div aria-hidden style={{ fontSize: 28, marginBottom: 6, lineHeight: 1 }}>
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
          <div style={{ marginBottom: 6 }}>
            Ask about any product · the shop will reply right here.
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.85 }}>
            Tip · create your free NEX account so you can send your message
            and receive the shop's reply. All messages are end-to-end
            encrypted.
          </div>
        </div>
      </div>

      {/* Composer · solid white pill + orange 3-dots + inline orange send */}
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
          aria-label={productsDrawerOpen ? "Close shop products" : "Open shop products"}
          aria-expanded={productsDrawerOpen}
          onClick={() => setProductsDrawerOpen((v) => !v)}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            padding: 0,
            display: "grid",
            placeItems: "center",
            background: "#F97316",
            border: "none",
            color: "#FFFFFF",
            cursor: "pointer",
            flexShrink: 0,
            boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
            animation: productsDrawerOpen
              ? "none"
              : "nex-anon-dots-flash 1800ms ease-in-out infinite",
          }}
        >
          <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="12" cy="5" r="2.6" />
            <circle cx="12" cy="12" r="2.6" />
            <circle cx="12" cy="19" r="2.6" />
          </svg>
        </button>

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
            inputMode="text"
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="on"
            spellCheck
            placeholder="Message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && draft.trim().length > 0) {
                e.preventDefault();
                requestSignup("send");
              }
            }}
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
            onClick={() => requestSignup("send")}
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
              background: "#F97316",
              color: "#FFFFFF",
              cursor: "pointer",
              padding: 0,
              display: "grid",
              placeItems: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6 4l14 8-14 8V4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Products drawer (left-slide) · tap any product also fires
          requestSignup since sending a product share is a send. */}
      {productsDrawerOpen ? (
        <AnonProductsDrawer
          businessDisplayName={businessDisplayName}
          businessCategory={businessCategory}
          accentHex={accentHex}
          products={shopProducts}
          onClose={() => setProductsDrawerOpen(false)}
          onSelect={() => requestSignup("product")}
        />
      ) : null}

      {popupOpen ? (
        <ShopChatRegistrationPopup
          shopName={businessDisplayName}
          shopSlug={businessSlug}
          productId={null}
          accent={accentHex}
          onDismiss={() => setPopupOpen(false)}
        />
      ) : null}
    </main>
  );
}

// ─── Minimal products drawer (anonymous · no encryption pipeline) ───

function AnonProductsDrawer({
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
  onSelect: () => void;
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
      data-nex-anon-shop-products-drawer
      role="dialog"
      aria-modal="true"
      aria-label={`${businessDisplayName} products`}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        display: "flex",
        ["--nex-biz-accent" as string]: accentHex,
      } as React.CSSProperties}
    >
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
                  onClick={onSelect}
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
                        background: `${accentHex}22`,
                        display: "grid",
                        placeItems: "center",
                        color: accentHex,
                        flexShrink: 0,
                      }}
                    >
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
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#5A6578" }}>
                      {p.currency} {price}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    style={{ fontSize: 16, fontWeight: 800, color: accentHex }}
                  >
                    ›
                  </span>
                </button>
              );
            })
          )}
        </nav>
      </aside>
    </div>
  );
}

// Stage 7 · item 5 · 2026-11-14 · inline SignupPopup removed. The
// polished Stage-4 modal now lives at
// `@/components/nex-native/business-chat/ShopChatRegistrationPopup`
// and is imported at the top of this file. One shape across the
// Product Detail Sheet, the shop cover FAB, and this anon preview.

// Owner directive 2026-11-13 · category → glyph · drives the anon
// products-drawer header + the welcome-bubble icon. Preserved from
// the pre-Stage-7 file after the inline SignupPopup was deleted.
function categoryIcon(category: string | null): string {
  if (!category) return "🛍";
  const c = category.toLowerCase();
  if (c.includes("food") || c.includes("restaurant") || c.includes("cafe")) return "🍜";
  if (c.includes("accommodation") || c.includes("hotel") || c.includes("stay")) return "🛏";
  if (c.includes("property")) return "🏠";
  if (c.includes("fashion") || c.includes("clothing")) return "👗";
  if (c.includes("brand") || c.includes("product")) return "🛍";
  if (c.includes("service")) return "🔧";
  return "🛍";
}
