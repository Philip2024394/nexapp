"use client";

// src/app/nex-native/manage/shop/setup/appearance/_client.tsx
//
// Shop Setup · Step 2 · Appearance · Client.
// Owner-authorised 2026-11-12.
// -----------------------------------------------------------------------------
// Two primary buttons: pick a template · pick a background. When the
// seller has already confirmed a background we show a subtle "already
// picked" badge + a "Continue to first product" CTA so they can
// advance without redoing the work. No writes · all persistence
// happens on the sealed themes/backgrounds surfaces.

import * as React from "react";
import Link from "next/link";
import {
  WizardShell,
  LABEL_STYLE,
  HINT_STYLE,
  PRIMARY_CTA_STYLE,
  SURFACE_CARD_STYLE,
} from "../_wizard-shell";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const BORDER = "rgba(198, 161, 91, 0.25)";

interface Props {
  readonly hasConfirmedBackground: boolean;
}

export function AppearanceClient({
  hasConfirmedBackground,
}: Props): React.JSX.Element {
  return (
    <WizardShell
      stepNumber={2}
      stepTitle="Make your shop look right"
      stepLead="Pick a template and a background so customers see your brand the moment they land."
      backHref="/nex-native/manage/shop/setup/business-details"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {hasConfirmedBackground ? (
          <div
            data-nex-appearance-already-set
            style={{
              padding: "12px 14px",
              background: "rgba(22, 214, 107, 0.08)",
              border: "1px solid rgba(22, 214, 107, 0.45)",
              borderRadius: 10,
              color: CREAM,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "#16D66B", fontWeight: 900 }}>
              Already set ·
            </strong>{" "}
            your shop template and background are saved. You can refine
            them below, or continue.
          </div>
        ) : null}

        {/* Pick template tile. */}
        <Link
          href="/nex-native/manage/shop/themes"
          data-nex-appearance-pick-template
          style={{
            ...SURFACE_CARD_STYLE,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            textDecoration: "none",
            color: CREAM,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <span style={LABEL_STYLE}>Step 1 · Template</span>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: CREAM,
                marginBottom: 2,
              }}
            >
              Pick a shop template
            </div>
            <span style={HINT_STYLE}>
              11 sealed cover layouts · pick the one that fits your shop
              best. You can change it later.
            </span>
          </div>
          <span
            aria-hidden
            style={{
              fontSize: 14,
              fontWeight: 900,
              color: GOLD,
              flexShrink: 0,
            }}
          >
            →
          </span>
        </Link>

        {/* Pick background tile. */}
        <Link
          href="/nex-native/manage/shop/backgrounds"
          data-nex-appearance-pick-background
          style={{
            ...SURFACE_CARD_STYLE,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            textDecoration: "none",
            color: CREAM,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <span style={LABEL_STYLE}>Step 2 · Background</span>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: CREAM,
                marginBottom: 2,
              }}
            >
              Pick a background
            </div>
            <span style={HINT_STYLE}>
              Browse 279 bundled presets · the theme colour auto-
              matches each image. Or upload your own.
            </span>
          </div>
          <span
            aria-hidden
            style={{
              fontSize: 14,
              fontWeight: 900,
              color: GOLD,
              flexShrink: 0,
            }}
          >
            →
          </span>
        </Link>

        {/* Continue CTA · only appears once a background is confirmed. */}
        {hasConfirmedBackground ? (
          <Link
            href="/nex-native/manage/shop/setup"
            data-nex-appearance-continue
            style={{
              ...PRIMARY_CTA_STYLE,
              textDecoration: "none",
              marginTop: 4,
              display: "flex",
              justifyContent: "center",
            }}
          >
            Continue to first product →
          </Link>
        ) : (
          <div
            style={{
              padding: "10px 12px",
              fontSize: 11.5,
              lineHeight: 1.5,
              color: INK_MUTED,
              border: `1px dashed ${BORDER}`,
              borderRadius: 10,
            }}
          >
            Pick a background to unlock the next step. You can swap
            template + background any time from Manage Shop.
          </div>
        )}

        <div
          style={{
            textAlign: "center",
            fontSize: 10.5,
            color: INK_DIM,
            marginTop: 4,
          }}
        >
          Templates + backgrounds save on your shop · changes propagate
          immediately to your public shop URL.
        </div>
      </div>
    </WizardShell>
  );
}
