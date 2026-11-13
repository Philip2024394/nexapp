"use client";

// src/app/nex-native/manage/shop/setup/review/_client.tsx
//
// Shop Setup · Step 4 · Review · Client.
// Owner-authorised 2026-11-12.
// -----------------------------------------------------------------------------
// Pure summary view · no forms, no writes. Shows a checklist of
// what's saved vs optional, plus the public shop URL and a primary
// "Open your shop" CTA to /manage/shop.

import * as React from "react";
import Link from "next/link";
import {
  WizardShell,
  LABEL_STYLE,
  PRIMARY_CTA_STYLE,
  SURFACE_CARD_STYLE,
} from "../_wizard-shell";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SAVED = "#16D66B";
const OPTIONAL = "#F3C56B";
const BORDER = "rgba(198, 161, 91, 0.25)";

interface Summary {
  shopName: string | null;
  hasLogo: boolean;
  country: string | null;
  city: string | null;
  category: string | null;
  hasBackground: boolean;
  hasHours: boolean;
  hasStory: boolean;
  hasShipping: boolean;
  hasContact: boolean;
  productCount: number;
  shopUrl: string | null;
}

interface Props {
  readonly summary: Summary;
}

export function ReviewClient({ summary }: Props): React.JSX.Element {
  const essentialsDone =
    Boolean(summary.shopName) &&
    Boolean(summary.country) &&
    Boolean(summary.category) &&
    summary.hasBackground;

  return (
    <WizardShell
      stepNumber={4}
      stepTitle={
        essentialsDone
          ? "Your shop is ready"
          : "Finish a few details to open your shop"
      }
      stepLead="Here's what you've set up so far. Anything marked optional can be added later from Manage Shop."
      backHref="/nex-native/manage/shop/setup/first-product"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Identity row. */}
        <ChecklistRow
          state={summary.shopName ? "done" : "missing"}
          label="Shop name"
          detail={summary.shopName ?? "Not set"}
          fixHref="/nex-native/manage/shop/setup/business-details"
        />
        <ChecklistRow
          state={summary.hasLogo ? "done" : "optional"}
          label="Shop logo"
          detail={summary.hasLogo ? "Saved" : "Add later"}
          fixHref="/nex-native/manage/shop/setup/business-details"
        />
        <ChecklistRow
          state={summary.country ? "done" : "missing"}
          label="Country"
          detail={summary.country ?? "Not set"}
          fixHref="/nex-native/manage/shop/setup/business-details"
        />
        <ChecklistRow
          state={summary.city ? "done" : "optional"}
          label="City"
          detail={summary.city ?? "Optional"}
          fixHref="/nex-native/manage/shop/setup/business-details"
        />
        <ChecklistRow
          state={summary.category ? "done" : "missing"}
          label="Category"
          detail={summary.category ?? "Not set"}
          fixHref="/nex-native/manage/shop/setup/business-details"
        />
        <ChecklistRow
          state={summary.hasBackground ? "done" : "missing"}
          label="Template & background"
          detail={summary.hasBackground ? "Saved" : "Not picked"}
          fixHref="/nex-native/manage/shop/setup/appearance"
        />
        <ChecklistRow
          state={summary.productCount > 0 ? "done" : "optional"}
          label="First product"
          detail={
            summary.productCount > 0
              ? `${summary.productCount} product${summary.productCount === 1 ? "" : "s"}`
              : "Optional"
          }
          fixHref="/nex-native/manage/shop/setup/first-product"
        />

        {/* Optional-later block · the 4 pages we moved out of required. */}
        <div style={SURFACE_CARD_STYLE}>
          <span style={LABEL_STYLE}>Optional · add any time</span>
          <ul
            style={{
              margin: "6px 0 0",
              padding: "0 0 0 18px",
              color: CREAM,
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            <li>
              Opening hours ·{" "}
              <Link
                href="/nex-native/manage/shop/setup/hours"
                style={{ color: GOLD, textDecoration: "none" }}
              >
                {summary.hasHours ? "Edit" : "Add"}
              </Link>
            </li>
            <li>
              Your story ·{" "}
              <Link
                href="/nex-native/manage/shop/setup/story"
                style={{ color: GOLD, textDecoration: "none" }}
              >
                {summary.hasStory ? "Edit" : "Add"}
              </Link>
            </li>
            <li>
              Shipping & returns ·{" "}
              <Link
                href="/nex-native/manage/shop/setup/policies"
                style={{ color: GOLD, textDecoration: "none" }}
              >
                {summary.hasShipping ? "Edit" : "Add"}
              </Link>
            </li>
            <li>
              Contact & social ·{" "}
              <Link
                href="/nex-native/manage/shop/setup/contact"
                style={{ color: GOLD, textDecoration: "none" }}
              >
                {summary.hasContact ? "Edit" : "Add"}
              </Link>
            </li>
          </ul>
        </div>

        {/* Shop URL. */}
        {summary.shopUrl ? (
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(198, 161, 91, 0.08)",
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: GOLD,
                  marginBottom: 2,
                }}
              >
                Your shop URL
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: CREAM,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                }}
              >
                {summary.shopUrl}
              </div>
            </div>
            <Link
              href={summary.shopUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flexShrink: 0,
                padding: "6px 12px",
                fontSize: 10.5,
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
              Open
            </Link>
          </div>
        ) : null}

        <Link
          href="/nex-native/manage/shop"
          data-nex-review-finish
          style={{
            ...PRIMARY_CTA_STYLE,
            textDecoration: "none",
            display: "flex",
            justifyContent: "center",
            marginTop: 4,
          }}
        >
          Open your shop →
        </Link>

        <div
          style={{
            textAlign: "center",
            fontSize: 10.5,
            color: INK_DIM,
            marginTop: 4,
          }}
        >
          Existing publishing + payment gates still apply · adding a
          product doesn&rsquo;t publish the shop automatically.
        </div>
      </div>
    </WizardShell>
  );
}

function ChecklistRow({
  state,
  label,
  detail,
  fixHref,
}: {
  state: "done" | "optional" | "missing";
  label: string;
  detail: string;
  fixHref: string;
}): React.JSX.Element {
  const dotColor =
    state === "done" ? SAVED : state === "optional" ? OPTIONAL : "#FF6B6B";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        background: "rgba(5, 15, 28, 0.6)",
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: dotColor,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 800,
            color: CREAM,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 10.5,
            color: INK_MUTED,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {detail}
        </div>
      </div>
      <Link
        href={fixHref}
        style={{
          flexShrink: 0,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: GOLD,
          textDecoration: "none",
        }}
      >
        {state === "done" ? "Edit" : "Fix"}
      </Link>
    </div>
  );
}
