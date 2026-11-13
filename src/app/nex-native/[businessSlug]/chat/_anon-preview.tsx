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
import { createPortal } from "react-dom";

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
    // Stash the current draft so the signup href carries it in ?next.
    // Only capture on "send" · product shares don't carry a draft.
    if (reason === "send") setPendingDraft(draft);
    else setPendingDraft("");
    setPopupOpen(true);
    setProductsDrawerOpen(false);
  }

  // Owner directive 2026-11-13 (iter 22) · draft stash in URL. When
  // the visitor opens the signup popup, carry the typed draft (and
  // optional product_id if a product-share is pending) so the
  // conversation page can auto-send after the account + device key
  // are provisioned. Base64url encode the draft so arbitrary text
  // (emoji, line breaks) survives the URL hops.
  const [pendingDraft, setPendingDraft] = React.useState<string>("");
  // base64url-encode the draft (btoa handles ASCII · wrap in encodeURIComponent
  // + unescape so non-ASCII utf-8 roundtrips cleanly). Keeps emoji intact.
  const draftB64 = pendingDraft
    ? btoa(unescape(encodeURIComponent(pendingDraft)))
    : "";
  const returnPath =
    `/nex-native/${businessSlug}/chat` +
    (draftB64 ? `?draft=${encodeURIComponent(draftB64)}` : "");
  const signUpHref = `/nex-native/sign-up?next=${encodeURIComponent(returnPath)}`;
  const signInHref = `/nex-native/sign-in?next=${encodeURIComponent(returnPath)}`;

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
        <SignupPopup
          shopName={businessDisplayName}
          signUpHref={signUpHref}
          signInHref={signInHref}
          accentHex={accentHex}
          onClose={() => setPopupOpen(false)}
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

// ─── Signup / sign-in registration popup ─────────────────────────────

function SignupPopup({
  shopName,
  signUpHref,
  signInHref,
  accentHex,
  onClose,
}: {
  shopName: string;
  signUpHref: string;
  signInHref: string;
  accentHex: string;
  onClose: () => void;
}): React.JSX.Element | null {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-anon-chat-signup-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgba(10, 21, 38, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 360,
          background: "#FFFFFF",
          borderRadius: 18,
          padding: "24px 20px 20px",
          color: "#0A1526",
          boxShadow: "0 24px 56px rgba(0, 0, 0, 0.45)",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "transparent",
            border: "none",
            fontSize: 20,
            lineHeight: 1,
            cursor: "pointer",
            color: "#4B5468",
          }}
        >
          ×
        </button>

        <h2
          id="nex-anon-chat-signup-title"
          style={{
            margin: "0 0 10px",
            fontSize: 18,
            fontWeight: 800,
            color: "#0A1526",
            textAlign: "center",
          }}
        >
          Create your free account to send
        </h2>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 13,
            lineHeight: 1.5,
            color: "#4B5468",
            textAlign: "center",
          }}
        >
          A free NEX account is what lets {shopName} reply to your message
          and deliver it securely. Takes under a minute.
        </p>

        <Link
          href={signUpHref}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "14px 16px",
            borderRadius: 14,
            background: accentHex,
            color: "#FAF8F4",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            textDecoration: "none",
            boxShadow: `0 4px 12px ${accentHex}40`,
            marginBottom: 10,
          }}
        >
          Create Free Account
        </Link>

        <Link
          href={signInHref}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 16px",
            borderRadius: 14,
            background: "transparent",
            color: "#0A1526",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.02em",
            textDecoration: "none",
            border: "1px solid rgba(75,84,104,0.27)",
          }}
        >
          Sign In
        </Link>
      </div>
    </div>,
    document.body,
  );
}

// ─── Shared: category → glyph ─────────────────────────────────────────
// Mirrors the business-category → emoji table used elsewhere in the
// conversation surface. Keeps anonymous preview visually in sync.

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
