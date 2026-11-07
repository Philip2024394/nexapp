"use client";

// src/app/nex-native/manage/shop/setup/policies/_client.tsx
//
// Shop Setup · Step 6 · Shipping methods + dispatch time + returns.
// Owner-authorised 2026-11-06 · multi-method rework 2026-11-07.
// -----------------------------------------------------------------------------
// Owner directive 2026-11-07:
//   · Shipping is a MULTI-SELECT across four methods · Postal, Pick-up,
//     Sea Freight, Airfreight. Any of {sea_freight · airfreight}
//     implicitly means the shop exports (shown as a live inline note).
//   · Postal + Pick-up stay on the local side.
//   · Add Dispatch Time in days (shop-level default).
//   · Returns Notes field pre-filled with a sensible default the
//     seller edits.
// The legacy single-value shipping_scope column is derived on save
// so Directory + cover + search readers keep working unchanged.

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
const BORDER_HI = "rgba(198, 161, 91, 0.55)";
const AMBER = "#F3C56B";

export const RETURNS_DEFAULT_NOTES =
  "Returns accepted within 14 days provided items are in their original packaging and unused. Any damage on arrival must be noted on the delivery docket at the time of receipt to support a claim.";

type MethodSlug = "postal" | "pickup" | "sea_freight" | "airfreight";

interface MethodOption {
  readonly slug: MethodSlug;
  readonly emoji: string;
  readonly label: string;
  readonly blurb: string;
  readonly category: "local" | "export";
}

const METHOD_OPTIONS: ReadonlyArray<MethodOption> = [
  {
    slug: "postal",
    emoji: "📮",
    label: "Postal service",
    blurb: "Local and international small parcels.",
    category: "local",
  },
  {
    slug: "pickup",
    emoji: "🏪",
    label: "Pick-up",
    blurb: "Customers collect their order.",
    category: "local",
  },
  {
    slug: "sea_freight",
    emoji: "🚢",
    label: "Sea Freight",
    blurb: "Cost-effective on volume.",
    category: "export",
  },
  {
    slug: "airfreight",
    emoji: "✈️",
    label: "Airfreight",
    blurb: "Fastest delivery time.",
    category: "export",
  },
];

export function PoliciesStepClient({
  initialMethods,
  initialDispatchDays,
  initialAcceptsReturns,
  initialWindowDays,
  initialNotes,
}: {
  initialMethods: MethodSlug[];
  initialDispatchDays: number | null;
  initialAcceptsReturns: boolean;
  initialWindowDays: number;
  initialNotes: string;
}): React.JSX.Element {
  const router = useRouter();
  const [methods, setMethods] = React.useState<Set<MethodSlug>>(
    () => new Set<MethodSlug>(initialMethods),
  );
  const [dispatchDays, setDispatchDays] = React.useState<string>(
    initialDispatchDays === null || initialDispatchDays === undefined
      ? ""
      : String(initialDispatchDays),
  );
  const [acceptsReturns, setAcceptsReturns] = React.useState(initialAcceptsReturns);
  const [windowDays, setWindowDays] = React.useState<number>(
    Math.max(7, Math.min(90, initialWindowDays || 14)),
  );
  const [notes, setNotes] = React.useState(
    initialNotes.length > 0 ? initialNotes : RETURNS_DEFAULT_NOTES,
  );
  const [status, setStatus] = React.useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  function toggleMethod(slug: MethodSlug) {
    setMethods((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  const exportsInternationally =
    methods.has("sea_freight") || methods.has("airfreight");
  const servesLocal = methods.has("postal") || methods.has("pickup");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "saving") return;
    if (methods.size === 0) {
      setStatus({ kind: "error", message: "Pick at least one shipping method." });
      return;
    }
    setStatus({ kind: "saving" });
    const fd = new FormData();
    for (const opt of METHOD_OPTIONS) {
      fd.set(`ship_${opt.slug}`, methods.has(opt.slug) ? "true" : "false");
    }
    fd.set("dispatchDays", dispatchDays);
    fd.set("acceptsReturns", acceptsReturns ? "true" : "false");
    fd.set("windowDays", String(windowDays));
    fd.set("returnNotes", notes.trim());
    const result = await saveShopPoliciesAction(fd);
    if (result.ok) {
      router.push(result.nextHref);
    } else {
      setStatus({ kind: "error", message: errorCopy(result.error) });
    }
  }

  async function onSkip() {
    router.push("/nex-native/manage/shop/themes");
  }

  return (
    <WizardShell
      stepNumber={6}
      stepTitle="How you ship + returns"
      stepLead="Tick every shipping method you offer. We'll show this on your Shipping & Returns sheet — editable any time from Shop settings."
      backHref="/nex-native/manage/shop/setup/story"
    >
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        {/* ── Shipping methods · multi-select ─────────────────── */}
        <div>
          <span style={LABEL_STYLE}>Shipping methods · pick any that apply</span>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {METHOD_OPTIONS.map((opt) => {
              const checked = methods.has(opt.slug);
              return (
                <label
                  key={opt.slug}
                  data-nex-shipping-method={opt.slug}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: checked
                      ? "rgba(198, 161, 91, 0.18)"
                      : "rgba(5, 15, 28, 0.9)",
                    border: `1.5px solid ${checked ? GOLD : BORDER}`,
                    borderRadius: 10,
                    color: INK,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    boxShadow: checked
                      ? "0 0 0 3px rgba(198,161,91,0.14)"
                      : "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleMethod(opt.slug)}
                    style={{
                      width: 20,
                      height: 20,
                      accentColor: GOLD,
                      flexShrink: 0,
                      cursor: "pointer",
                    }}
                  />
                  <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>
                    {opt.emoji}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13.5,
                        fontWeight: 900,
                        color: checked ? GOLD : CREAM,
                        letterSpacing: "-0.005em",
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
                </label>
              );
            })}
          </div>

          {/* Live note: freight = exports. */}
          {exportsInternationally ? (
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                fontSize: 11.5,
                lineHeight: 1.45,
                color: AMBER,
                background: "rgba(243, 197, 107, 0.08)",
                border: "1px solid rgba(243, 197, 107, 0.4)",
                borderRadius: 10,
              }}
            >
              <strong style={{ color: AMBER, fontWeight: 900 }}>Exports internationally ·</strong>{" "}
              you&rsquo;ve ticked a freight method, so your shop will be
              listed as exporting.
              {servesLocal
                ? ` You also serve local buyers via ${localMethodsSummary(methods)}.`
                : " No local methods ticked — your shop is export-only."}
            </div>
          ) : null}
        </div>

        {/* ── Dispatch time ──────────────────────────────────── */}
        <div>
          <label htmlFor="shop-dispatch-days" style={LABEL_STYLE}>
            Dispatch time
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <input
              id="shop-dispatch-days"
              type="number"
              min={0}
              max={365}
              step={1}
              placeholder="e.g. 2"
              value={dispatchDays}
              onChange={(e) => setDispatchDays(e.currentTarget.value)}
              style={{ ...FIELD_STYLE, maxWidth: 110 }}
            />
            <span
              style={{
                fontSize: 12.5,
                color: INK,
                fontWeight: 700,
              }}
            >
              day(s) to dispatch
            </span>
          </div>
          <span style={HINT_STYLE}>
            How many days between order and dispatch · 0 means
            same-day. Shown on your product pages as a default.
          </span>
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
                  Returns policy
                </label>
                <textarea
                  id="shop-return-notes"
                  rows={4}
                  maxLength={1600}
                  value={notes}
                  onChange={(e) => setNotes(e.currentTarget.value)}
                  style={{
                    ...FIELD_STYLE,
                    fontFamily: "inherit",
                    resize: "vertical",
                    minHeight: 100,
                    borderColor: BORDER_HI,
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    marginTop: 4,
                  }}
                >
                  <span style={HINT_STYLE}>
                    Pre-filled with a sensible default · edit freely.
                  </span>
                  {notes.trim() !== RETURNS_DEFAULT_NOTES ? (
                    <button
                      type="button"
                      onClick={() => setNotes(RETURNS_DEFAULT_NOTES)}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        fontSize: 11,
                        fontWeight: 700,
                        color: GOLD,
                        textDecoration: "underline",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        flexShrink: 0,
                      }}
                    >
                      Reset to default
                    </button>
                  ) : null}
                </div>
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

/** "Postal service", "Pick-up", or "Postal service and Pick-up" —
 *  mirrors the on-card labels so the banner stays consistent. */
function localMethodsSummary(methods: Set<MethodSlug>): string {
  const hasPostal = methods.has("postal");
  const hasPickup = methods.has("pickup");
  if (hasPostal && hasPickup) return "Postal service and Pick-up";
  if (hasPostal) return "Postal service";
  return "Pick-up";
}

function errorCopy(code: string): string {
  switch (code) {
    case "shipping-methods-required":
      return "Pick at least one shipping method.";
    case "not-authenticated":
      return "You've been signed out · please sign in again.";
    default:
      return code;
  }
}
