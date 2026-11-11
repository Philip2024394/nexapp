// src/app/nex-native/library/backgrounds/_client.tsx
//
// NEX Unified Visual Library · browsing + preview + save client.
// Owner-authorised 2026-11-11 · Phase 1 implementation.
// -----------------------------------------------------------------------------
// Mobile-first (sealed phone-frame). Renders:
//   · Header with "NEX Visual Library" title + context pill (Shop / Chat)
//   · Category chip row
//   · 2-per-row grid of asset tiles with preview
//   · Tap a tile → preview modal (shows destination-specific preview
//     via _shop-preview or _chat-preview)
//   · Apply button → calls the context-appropriate server action
//
// Independence: the client never calls both actions. The action to call is
// determined entirely by the `context` prop which is a server-origin value.

"use client";

import * as React from "react";
import Link from "next/link";
import {
  applyFromLibraryShopAction,
  applyFromLibraryChatAction,
} from "./_actions";
import { ShopPreview } from "./_shop-preview";
import { ChatPreview } from "./_chat-preview";
import type { BackgroundContext } from "@/lib/nex-native/library/catalog-service";

interface ClientAsset {
  readonly id: string;
  readonly storageUrl: string;
  readonly previewUrl: string | null;
  readonly label: string;
  readonly tintHex: string | null;
  readonly categories: string[];
  readonly contexts: string[];
  readonly tier: "gratis" | "bisnis" | "pro";
}

interface ClientCategory {
  readonly id: string;
  readonly label: string;
  readonly emoji: string;
}

interface Props {
  readonly context: BackgroundContext;
  readonly categories: readonly ClientCategory[];
  readonly initialCategory: string;
  readonly assets: readonly ClientAsset[];
  readonly businessId: string | null;
  readonly selectedShopAssetUrl: string | null;
  readonly selectedShopTintHex: string | null;
  readonly selectedChatThemeId: string | null;
  readonly returnTo: string | null;
  readonly viewerTier: string;
}

const NEX = {
  bg:     "var(--nex-world-drawer-bg, #0A1526)",
  card:   "#F5EDD3",
  ink:    "#2A1F0F",
  mute:   "rgba(42, 31, 15, 0.62)",
  accent: "#C6A15B",
  orange: "#FF7200",
  black:  "#000000",
  white:  "#FFFFFF",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function LibraryClient(props: Props): React.JSX.Element {
  const { context, categories, initialCategory, assets } = props;
  const [category, setCategory] = React.useState(initialCategory);
  const [focused, setFocused] = React.useState<ClientAsset | null>(null);
  const [applying, setApplying] = React.useState(false);
  const [applyResult, setApplyResult] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    if (category === "all") return assets;
    return assets.filter((a) => a.categories.includes(category));
  }, [assets, category]);

  const currentSelectedId = context === "chat" ? props.selectedChatThemeId : null;
  const currentSelectedUrl = context === "shop" ? props.selectedShopAssetUrl : null;

  function isSelected(a: ClientAsset): boolean {
    if (context === "chat") {
      return a.id.replace(/^chat:/, "") === currentSelectedId;
    }
    return a.storageUrl === currentSelectedUrl;
  }

  async function handleApply(a: ClientAsset) {
    if (applying) return;
    setApplying(true);
    setApplyResult(null);
    try {
      let result;
      if (context === "shop") {
        if (!props.businessId) {
          setApplyResult("No business to apply to.");
          return;
        }
        result = await applyFromLibraryShopAction(props.businessId, a.id);
      } else {
        result = await applyFromLibraryChatAction(a.id);
      }
      if (result.ok) {
        setApplyResult(`Applied · ${a.label}`);
      } else {
        setApplyResult(`Could not apply · ${result.error}`);
      }
    } finally {
      setApplying(false);
    }
  }

  return (
    <main
      data-nex-library-root
      data-nex-library-context={context}
      style={{
        position: "absolute",
        inset: 0,
        background: NEX.bg,
        color: NEX.white,
        fontFamily: SANS,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "calc(env(safe-area-inset-top, 0) + 14px) 16px 10px",
          background: "rgba(10, 21, 38, 0.82)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          flexShrink: 0,
          borderBottom: `1px solid ${NEX.accent}22`,
        }}
      >
        {props.returnTo ? (
          <Link
            href={props.returnTo}
            aria-label="Back"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: NEX.black,
              color: NEX.white,
              display: "grid",
              placeItems: "center",
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            ←
          </Link>
        ) : null}
        <h1
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: "0.02em",
            flex: 1,
          }}
        >
          NEX Visual Library
        </h1>
        <span
          data-nex-library-context-pill={context}
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            background: context === "shop" ? NEX.orange : NEX.accent,
            color: context === "shop" ? NEX.white : NEX.black,
            fontSize: 11,
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {context}
        </span>
      </header>

      {/* Category chips */}
      <nav
        aria-label="Categories"
        style={{
          display: "flex",
          gap: 8,
          padding: "10px 14px",
          overflowX: "auto",
          flexShrink: 0,
          borderBottom: `1px solid ${NEX.accent}15`,
        }}
      >
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            data-nex-library-category-chip={c.id}
            data-nex-library-category-active={category === c.id ? "true" : "false"}
            style={{
              all: "unset",
              cursor: "pointer",
              padding: "6px 12px",
              borderRadius: 999,
              background: category === c.id ? NEX.card : "transparent",
              color: category === c.id ? NEX.ink : NEX.white,
              border: `1px solid ${category === c.id ? NEX.card : NEX.accent + "44"}`,
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </nav>

      {/* Asset count */}
      <div
        style={{
          padding: "8px 14px",
          fontSize: 11,
          color: "rgba(255,255,255,0.6)",
          flexShrink: 0,
        }}
      >
        {filtered.length} {filtered.length === 1 ? "image" : "images"}
      </div>

      {/* Grid */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 14px 24px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <ul
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {filtered.map((a) => (
            <li key={a.id} style={{ minWidth: 0 }}>
              <button
                type="button"
                onClick={() => setFocused(a)}
                data-nex-library-tile={a.id}
                data-nex-library-tile-selected={isSelected(a) ? "true" : "false"}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "block",
                  width: "100%",
                  borderRadius: 12,
                  overflow: "hidden",
                  border: isSelected(a)
                    ? `2px solid ${NEX.orange}`
                    : `1px solid ${NEX.accent}33`,
                  background: NEX.card,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "3 / 4",
                    background: NEX.bg,
                    overflow: "hidden",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.previewUrl ?? a.storageUrl}
                    alt={a.label}
                    loading="lazy"
                    decoding="async"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  {isSelected(a) ? (
                    <span
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: NEX.orange,
                        color: NEX.white,
                        fontSize: 10,
                        fontWeight: 900,
                        letterSpacing: "0.06em",
                      }}
                    >
                      SELECTED
                    </span>
                  ) : null}
                </div>
                <div
                  style={{
                    padding: "6px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: NEX.ink,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {a.label}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Preview modal */}
      {focused ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setFocused(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: NEX.bg,
              borderRadius: 16,
              maxWidth: 420,
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              padding: 16,
              border: `1px solid ${NEX.accent}44`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 800 }}>{focused.label}</div>
              <button
                type="button"
                onClick={() => setFocused(null)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  padding: "4px 10px",
                  fontSize: 20,
                }}
              >
                ×
              </button>
            </div>

            {context === "shop" ? (
              <ShopPreview
                imageUrl={focused.storageUrl}
                tintHex={focused.tintHex}
              />
            ) : (
              <ChatPreview
                imageUrl={focused.storageUrl}
                tintHex={focused.tintHex}
              />
            )}

            <button
              type="button"
              onClick={() => handleApply(focused)}
              disabled={applying}
              data-nex-library-apply={context}
              style={{
                marginTop: 14,
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                background: applying ? "rgba(255,114,0,0.5)" : NEX.orange,
                color: NEX.white,
                border: "none",
                cursor: applying ? "default" : "pointer",
                fontWeight: 900,
                fontSize: 14,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {applying
                ? "Applying..."
                : context === "shop"
                  ? "Apply as shop background"
                  : "Apply as chat theme"}
            </button>

            {applyResult ? (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  textAlign: "center",
                  color: applyResult.startsWith("Applied")
                    ? "#16D66B"
                    : "#FF6B6B",
                }}
              >
                {applyResult}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
