"use client";

// src/app/nex-native/manage/shop/setup/policies/_client.tsx
//
// Shop Setup · Step 6 · Shipping scope + return policy client.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Two blocks, one save:
//   · Shipping scope · one-of enum from NEX_SHIPPING_SCOPES (sealed
//                       migration 108) · drives Visit Us + the
//                       cover section heading fallback.
//   · Returns       · accepts_returns toggle + window_days + notes.
//                     updateReturnPolicy enforces legal minimums
//                     server-side (window ≥ 7 · refund ≥ 3 · defective
//                     + wrong_item auto-accepted), so this client
//                     just sends the owner's preference.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  WizardShell,
  FIELD_STYLE,
  PRIMARY_CTA_STYLE,
  LABEL_STYLE,
  HINT_STYLE,
  SURFACE_CARD_STYLE,
} from "../_wizard-shell";
import { saveShopPoliciesAction } from "../_actions";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const BORDER = "rgba(198, 161, 91, 0.25)";

interface ShippingOption {
  readonly slug: string;
  readonly emoji: string;
  readonly label: string;
  readonly blurb: string;
}

const SHIPPING_OPTIONS: ReadonlyArray<ShippingOption> = [
  {
    slug: "local_delivery",
    emoji: "🛵",
    label: "Local delivery",
    blurb: "Rider or courier · your city / metro area.",
  },
  {
    slug: "local_and_export",
    emoji: "✈️",
    label: "Local + export",
    blurb: "Local delivery AND international shipping on request.",
  },
  {
    slug: "international_only",
    emoji: "🌏",
    label: "Ships worldwide",
    blurb: "Ships internationally · no local-only option.",
  },
  {
    slug: "pickup_only",
    emoji: "🏪",
    label: "Pickup only",
    blurb: "Buyer collects · no delivery, no shipping.",
  },
  {
    slug: "dine_in",
    emoji: "🍽",
    label: "Dine-in",
    blurb: "Seated at the venue · no delivery (food & drink only).",
  },
  {
    slug: "digital",
    emoji: "💾",
    label: "Digital delivery",
    blurb: "Downloadable / sent by link · no physical shipping.",
  },
];

export function PoliciesStepClient({
  initialShippingScope,
  initialAcceptsReturns,
  initialWindowDays,
  initialNotes,
}: {
  initialShippingScope: string | null;
  initialAcceptsReturns: boolean;
  initialWindowDays: number;
  initialNotes: string;
}): React.JSX.Element {
  const router = useRouter();
  const [shippingScope, setShippingScope] = React.useState<string | null>(
    initialShippingScope,
  );
  const [acceptsReturns, setAcceptsReturns] = React.useState(initialAcceptsReturns);
  const [windowDays, setWindowDays] = React.useState<number>(
    Math.max(7, Math.min(90, initialWindowDays || 14)),
  );
  const [notes, setNotes] = React.useState(initialNotes);
  const [status, setStatus] = React.useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "saving") return;
    if (!shippingScope) {
      setStatus({ kind: "error", message: "Pick a shipping option." });
      return;
    }
    setStatus({ kind: "saving" });
    const fd = new FormData();
    fd.set("shippingScope", shippingScope);
    fd.set("acceptsReturns", acceptsReturns ? "true" : "false");
    fd.set("windowDays", String(windowDays));
    fd.set("returnNotes", notes.trim());
    const result = await saveShopPoliciesAction(fd);
    if (result.ok) {
      router.push(result.nextHref);
    } else {
      setStatus({ kind: "error", message: result.error });
    }
  }

  async function onSkip() {
    router.push("/nex-native/manage/shop/themes");
  }

  return (
    <WizardShell
      stepNumber={6}
      stepTitle="How you ship + returns"
      stepLead="Shown on your Shipping & Returns sheet. You can edit any time from Shop settings."
      backHref="/nex-native/manage/shop/setup/story"
    >
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 18 }}
      >
        {/* ── Shipping scope ──────────────────────────────────── */}
        <div>
          <span style={LABEL_STYLE}>How you ship</span>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {SHIPPING_OPTIONS.map((opt) => {
              const isPicked = opt.slug === shippingScope;
              return (
                <button
                  key={opt.slug}
                  type="button"
                  onClick={() => setShippingScope(opt.slug)}
                  data-nex-shipping-option={opt.slug}
                  aria-pressed={isPicked}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: isPicked
                      ? "rgba(198, 161, 91, 0.18)"
                      : "rgba(5, 15, 28, 0.9)",
                    border: `1.5px solid ${isPicked ? GOLD : BORDER}`,
                    borderRadius: 10,
                    color: INK,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    boxShadow: isPicked
                      ? "0 0 0 3px rgba(198,161,91,0.14)"
                      : "none",
                  }}
                >
                  <span
                    aria-hidden
                    style={{ fontSize: 20, lineHeight: 1 }}
                  >
                    {opt.emoji}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 900,
                        color: isPicked ? GOLD : CREAM,
                      }}
                    >
                      {opt.label}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 10.5,
                        color: INK_DIM,
                        marginTop: 1,
                        lineHeight: 1.4,
                      }}
                    >
                      {opt.blurb}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Returns policy ───────────────────────────────────── */}
        <div
          style={{
            ...SURFACE_CARD_STYLE,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: CREAM,
                  letterSpacing: "-0.005em",
                }}
              >
                Accept returns
              </div>
              <span style={{ fontSize: 10.5, color: INK_DIM }}>
                Defective items are always accepted by law.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAcceptsReturns((v) => !v)}
              role="switch"
              aria-checked={acceptsReturns}
              style={{
                width: 48,
                height: 26,
                borderRadius: 999,
                border: "none",
                background: acceptsReturns ? GOLD : "rgba(198,161,91,0.22)",
                position: "relative",
                cursor: "pointer",
                flexShrink: 0,
                transition: "background 160ms ease",
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: 3,
                  left: acceptsReturns ? 24 : 3,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#1A120A",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
                  transition: "left 160ms ease",
                }}
              />
            </button>
          </div>

          {acceptsReturns ? (
            <>
              <div>
                <label htmlFor="shop-window-days" style={LABEL_STYLE}>
                  Return window
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <input
                    id="shop-window-days"
                    type="number"
                    min={7}
                    max={90}
                    step={1}
                    value={windowDays}
                    onChange={(e) =>
                      setWindowDays(
                        Math.max(
                          7,
                          Math.min(
                            90,
                            Math.floor(Number(e.currentTarget.value) || 7),
                          ),
                        ),
                      )
                    }
                    style={{ ...FIELD_STYLE, maxWidth: 110 }}
                  />
                  <span
                    style={{
                      fontSize: 12.5,
                      color: INK,
                      fontWeight: 700,
                    }}
                  >
                    days from delivery
                  </span>
                </div>
                <span style={HINT_STYLE}>
                  Minimum 7 days · maximum 90 days.
                </span>
              </div>

              <div>
                <label htmlFor="shop-return-notes" style={LABEL_STYLE}>
                  Notes (optional)
                </label>
                <textarea
                  id="shop-return-notes"
                  rows={3}
                  maxLength={1600}
                  placeholder="Original packaging required · item must be unused · refund within 5 business days of receipt."
                  value={notes}
                  onChange={(e) => setNotes(e.currentTarget.value)}
                  style={{
                    ...FIELD_STYLE,
                    fontFamily: "inherit",
                    resize: "vertical",
                    minHeight: 70,
                  }}
                />
              </div>
            </>
          ) : (
            <span
              style={{
                fontSize: 11,
                color: INK_MUTED,
                lineHeight: 1.5,
              }}
            >
              Returns off for change-of-mind. Defective / wrong-item
              returns still apply by law — NEX will show that to buyers
              automatically.
            </span>
          )}
        </div>

        {status.kind === "error" ? (
          <div
            style={{
              padding: 10,
              fontSize: 12,
              color: "#FF6B6B",
              background: "rgba(216, 42, 42, 0.08)",
              border: "1px solid rgba(216, 42, 42, 0.35)",
              borderRadius: 10,
            }}
          >
            {status.message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={status.kind === "saving"}
          style={{
            ...PRIMARY_CTA_STYLE,
            opacity: status.kind === "saving" ? 0.6 : 1,
            cursor: status.kind === "saving" ? "wait" : "pointer",
          }}
        >
          {status.kind === "saving" ? "Saving…" : "Save & continue →"}
        </button>

        <button
          type="button"
          onClick={onSkip}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            marginTop: 2,
            fontSize: 11,
            fontWeight: 700,
            color: INK_MUTED,
            textDecoration: "underline",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Skip, I&rsquo;ll set these later
        </button>
      </form>
    </WizardShell>
  );
}
