"use client";

// src/app/nex-native/manage/shop/setup/request-category/_client.tsx
//
// Shop Setup · side flow · Request a missing business category.
// Owner-authorised 2026-11-07.
// -----------------------------------------------------------------------------
// Three-field form matching the Step 2/3 SURFACE_CARD aesthetic:
//   · Business name           (2-120 chars, required)
//   · Describe your business  (10-1000 chars, required)
//   · Closest category         (dropdown of 5 Rev 6 categories +
//                               "I'm not sure", optional)
//   · Suggested subcategory    (plain text 0-120 chars, optional)
// Success state replaces the form with a confirmation card · the
// seller then has two choices: continue the wizard with the closest
// existing match OR go back to the category picker.

import * as React from "react";
import Link from "next/link";
import {
  WizardShell,
  FIELD_STYLE,
  PRIMARY_CTA_STYLE,
  LABEL_STYLE,
  HINT_STYLE,
  SURFACE_CARD_STYLE,
} from "../_wizard-shell";
import { requestMissingCategoryAction } from "../_actions";
import {
  BUSINESS_CATEGORIES,
  BUSINESS_CATEGORY_LABEL,
} from "@/lib/nex-native/business/categories";
import type { BusinessCategory } from "@/lib/nex-native/business/types";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK_MUTED = "#7D9BC0";
const EMERALD = "#16D66B";

const CATEGORY_EMOJI: Record<BusinessCategory, string> = {
  food:          "🍽",
  accommodation: "🏨",
  property:      "🏠",
  products:      "📦",
  services:      "🛎",
};

export function RequestCategoryClient({
  prefilledCategory,
}: {
  prefilledCategory: BusinessCategory | null;
}): React.JSX.Element {
  const [businessName, setBusinessName] = React.useState("");
  const [businessDescription, setBusinessDescription] = React.useState("");
  const [requestedCategory, setRequestedCategory] = React.useState<string>(
    prefilledCategory ?? "",
  );
  const [requestedSubtypeLabel, setRequestedSubtypeLabel] = React.useState("");
  const [status, setStatus] = React.useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "success" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "saving") return;
    setStatus({ kind: "saving" });
    const fd = new FormData();
    fd.set("businessName", businessName.trim());
    fd.set("businessDescription", businessDescription.trim());
    fd.set("requestedCategory", requestedCategory);
    fd.set("requestedSubtypeLabel", requestedSubtypeLabel.trim());
    const result = await requestMissingCategoryAction(fd);
    if (result.ok) {
      setStatus({ kind: "success" });
    } else {
      setStatus({ kind: "error", message: errorCopy(result.error) });
    }
  }

  if (status.kind === "success") {
    return (
      <WizardShell
        stepNumber={3}
        stepTitle="Thanks — we've got your request"
        stepLead="Our team reviews every submission. Meanwhile, pick the closest existing category so your shop can go live."
        backHref="/nex-native/manage/shop/setup/category"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              ...SURFACE_CARD_STYLE,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              border: `1px solid ${EMERALD}66`,
              background: "rgba(22, 214, 107, 0.08)",
            }}
          >
            <span aria-hidden style={{ fontSize: 24 }}>✅</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  color: CREAM,
                  letterSpacing: "-0.005em",
                }}
              >
                Request received
              </div>
              <div style={{ fontSize: 11.5, color: INK_MUTED, marginTop: 2 }}>
                We&rsquo;ll let you know when a dedicated category for
                your business ships.
              </div>
            </div>
          </div>

          <Link
            href="/nex-native/manage/shop/setup/category"
            style={{
              ...PRIMARY_CTA_STYLE,
              textDecoration: "none",
              textAlign: "center",
              display: "block",
            }}
          >
            Back to category picker →
          </Link>

          <span
            style={{
              display: "block",
              textAlign: "center",
              fontSize: 10.5,
              color: INK_MUTED,
            }}
          >
            Logged on nex_category_request · reviewed by the NEX team.
          </span>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell
      stepNumber={3}
      stepTitle="Request a new category"
      stepLead="Tell us about your business. We review every request — if your category is a fit for NEX, we'll ship it."
      backHref="/nex-native/manage/shop/setup/category"
    >
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div>
          <label htmlFor="req-business-name" style={LABEL_STYLE}>
            Business name
          </label>
          <input
            id="req-business-name"
            type="text"
            maxLength={120}
            placeholder="My Business Co."
            value={businessName}
            onChange={(e) => setBusinessName(e.currentTarget.value)}
            style={FIELD_STYLE}
            required
          />
          <span style={HINT_STYLE}>Up to 120 characters.</span>
        </div>

        <div>
          <label htmlFor="req-business-description" style={LABEL_STYLE}>
            Describe your business
          </label>
          <textarea
            id="req-business-description"
            rows={4}
            maxLength={1000}
            placeholder="What do you do? Who are your customers? How does your business make money?"
            value={businessDescription}
            onChange={(e) => setBusinessDescription(e.currentTarget.value)}
            style={{
              ...FIELD_STYLE,
              fontFamily: "inherit",
              resize: "vertical",
              minHeight: 100,
            }}
            required
          />
          <span style={HINT_STYLE}>
            10–1000 characters. The more specific, the better the match.
          </span>
        </div>

        <div>
          <label htmlFor="req-closest-category" style={LABEL_STYLE}>
            Closest existing category (optional)
          </label>
          <div
            style={{
              ...SURFACE_CARD_STYLE,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
            }}
          >
            <span aria-hidden style={{ fontSize: 22, minWidth: 24 }}>
              {requestedCategory && BUSINESS_CATEGORIES.includes(requestedCategory as BusinessCategory)
                ? CATEGORY_EMOJI[requestedCategory as BusinessCategory]
                : "🤔"}
            </span>
            <select
              id="req-closest-category"
              value={requestedCategory}
              onChange={(e) => setRequestedCategory(e.currentTarget.value)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: CREAM,
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
              }}
            >
              <option value="" style={{ background: "#000" }}>
                I&rsquo;m not sure
              </option>
              {BUSINESS_CATEGORIES.map((c) => (
                <option key={c} value={c} style={{ background: "#000" }}>
                  {CATEGORY_EMOJI[c]} &nbsp;{BUSINESS_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <span style={HINT_STYLE}>
            Helps our reviewers understand where your business fits.
          </span>
        </div>

        <div>
          <label htmlFor="req-subtype-label" style={LABEL_STYLE}>
            Suggested subcategory name (optional)
          </label>
          <input
            id="req-subtype-label"
            type="text"
            maxLength={120}
            placeholder="e.g. Yoga retreat · Artisan cheese · Pet grooming"
            value={requestedSubtypeLabel}
            onChange={(e) => setRequestedSubtypeLabel(e.currentTarget.value)}
            style={FIELD_STYLE}
          />
          <span style={HINT_STYLE}>
            What would you call it if you could name it?
          </span>
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
          {status.kind === "saving" ? "Sending…" : "Send request →"}
        </button>

        <Link
          href="/nex-native/manage/shop/setup/category"
          style={{
            display: "block",
            textAlign: "center",
            fontSize: 11,
            fontWeight: 700,
            color: INK_MUTED,
            textDecoration: "underline",
            marginTop: 2,
          }}
        >
          Back to category picker
        </Link>

        <span
          style={{
            display: "block",
            textAlign: "center",
            fontSize: 10.5,
            color: INK_MUTED,
          }}
        >
          Request saved to nex_category_request for NEX team review.
        </span>
      </form>
    </WizardShell>
  );
}

function errorCopy(code: string): string {
  switch (code) {
    case "not-authenticated":
      return "You've been signed out · please sign in again.";
    case "name-length":
      return "Business name must be 2–120 characters.";
    case "description-length":
      return "Description must be 10–1000 characters.";
    case "unknown-category":
      return "That category isn't recognised. Pick from the dropdown.";
    default:
      return code;
  }
}

