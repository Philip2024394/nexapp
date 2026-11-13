"use client";

// src/app/nex-native/manage/shop/setup/first-product/_client.tsx
//
// Shop Setup · Step 3 · First Product · Client.
// Owner-authorised 2026-11-12.
// -----------------------------------------------------------------------------
// No forms. One primary CTA to the sealed product-creation flow, a
// "I'll add products later" skip, and a reassurance line that the
// existing product tooling will be reused (no new product system).

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

interface Props {
  readonly productCount: number;
}

export function FirstProductClient({
  productCount,
}: Props): React.JSX.Element {
  return (
    <WizardShell
      stepNumber={3}
      stepTitle="Add your first product"
      stepLead="Give customers something to discover. You can add more products any time from Manage Shop."
      backHref="/nex-native/manage/shop/setup/appearance"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {productCount > 0 ? (
          <div
            data-nex-first-product-already-set
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
              Nice ·
            </strong>{" "}
            you&rsquo;ve added {productCount} product
            {productCount === 1 ? "" : "s"}. Keep going, or continue to
            review.
          </div>
        ) : null}

        <div style={SURFACE_CARD_STYLE}>
          <span style={LABEL_STYLE}>What you&rsquo;ll fill in</span>
          <ul
            style={{
              margin: "6px 0 0",
              padding: "0 0 0 18px",
              color: CREAM,
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            <li>Product photos</li>
            <li>Name + short description</li>
            <li>Price</li>
            <li>Stock status</li>
          </ul>
          <span style={HINT_STYLE}>
            Uses the existing product tool · same fields you&rsquo;ll see
            on Manage Products.
          </span>
        </div>

        <Link
          href="/nex-native/create/product/category"
          data-nex-first-product-start
          style={{
            ...PRIMARY_CTA_STYLE,
            textDecoration: "none",
            display: "flex",
            justifyContent: "center",
          }}
        >
          + Add your first product
        </Link>

        {productCount > 0 ? (
          <Link
            href="/nex-native/manage/shop/setup/review"
            data-nex-first-product-continue
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "12px 20px",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: GOLD,
              background: "transparent",
              border: `1px solid ${GOLD}`,
              borderRadius: 999,
              textDecoration: "none",
            }}
          >
            Continue to review →
          </Link>
        ) : (
          <Link
            href="/nex-native/manage/shop/setup/review"
            data-nex-first-product-skip
            style={{
              display: "flex",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: INK_MUTED,
              textDecoration: "underline",
              padding: "4px 0",
            }}
          >
            I&rsquo;ll add products later
          </Link>
        )}

        <div
          style={{
            textAlign: "center",
            fontSize: 10.5,
            color: INK_DIM,
            marginTop: 4,
          }}
        >
          We don&rsquo;t publish anything automatically · existing
          publishing + payment gates still apply.
        </div>
      </div>
    </WizardShell>
  );
}
