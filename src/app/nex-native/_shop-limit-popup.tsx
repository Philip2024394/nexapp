"use client";

// src/app/nex-native/_shop-limit-popup.tsx
//
// Owner-authorised 2026-11-08 (round 29e) · reusable popup shown
// when a seller hits a shop capacity limit. Owner directive:
// "when they hit storage limit they should see pop up window saying
// they have reached storage limit and to continue choose extra
// storage with button to divert to the storage page."
// -----------------------------------------------------------------------------
// Design:
//   · Plain-language copy · says "storage" for every kind (bandwidth
//     is not surfaced to users per the round 29d decision).
//   · One primary CTA → /nex-native/settings/storage.
//   · Secondary "Not now" dismiss.
//   · Phone-frame aware · renders as a modal inside the sealed
//     .nex-native-frame · does NOT portal to document.body because
//     the sealed phone-frame is the visual boundary.
//   · No server actions · pure presentation.
//
// Mount points (not wired yet · documented for the follow-up):
//   · /manage/shop/products · when a product upload server action
//     returns the "over-limit" code, the client catches it and
//     renders this popup.
//   · /settings/storage · currently supports `?preview=limit` query
//     to render the popup for demo/verification.
//   · Future: the sealed "closed shop URL · soft-landing + chat CTA"
//     flow for signed-out visitors browsing a shop whose owner is
//     over-quota; copy differs (customer-facing) and must be a
//     separate component.

import * as React from "react";
import Link from "next/link";

const NEX = {
  overlay: "rgba(2, 9, 20, 0.72)",
  panel: "linear-gradient(135deg, #123D2B 0%, rgba(5,15,28,0.96) 80%)",
  gold: "#C6A15B",
  goldBright: "#F0C85A",
  cream: "#FAF8F4",
  ink: "#F2F5F8",
  inkDim: "#B5C3D6",
  inkMuted: "#7D9BC0",
  border: "rgba(198, 161, 91, 0.45)",
  red: "#A60000",
};

export type LimitKind = "storage" | "products" | "videos";

export interface ShopLimitPopupProps {
  readonly visible: boolean;
  readonly kind: LimitKind;
  /** Current usage shown in the headline, e.g. "1.0 GB of 1.0 GB" ·
   *  caller formats for display. */
  readonly usageLabel?: string;
  readonly onDismiss?: () => void;
  /** Where the primary CTA routes · defaults to /settings/storage. */
  readonly upgradeHref?: string;
}

function headlineFor(kind: LimitKind): string {
  switch (kind) {
    case "storage":
      return "You've reached your storage limit";
    case "products":
      return "You've reached your product limit";
    case "videos":
      return "You've reached your video limit";
  }
}

function bodyFor(kind: LimitKind): string {
  switch (kind) {
    case "storage":
      return "Your shop can't take new photos or videos until you add more storage.";
    case "products":
      return "Your shop can't list another product until you add more storage.";
    case "videos":
      return "Your shop can't upload another video until you add more storage.";
  }
}

export function ShopLimitPopup({
  visible,
  kind,
  usageLabel,
  onDismiss,
  upgradeHref = "/nex-native/settings/storage",
}: ShopLimitPopupProps): React.JSX.Element | null {
  if (!visible) return null;

  const headline = headlineFor(kind);
  const body = bodyFor(kind);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={headline}
      data-nex-shop-limit
      style={{
        position: "absolute",
        inset: 0,
        background: NEX.overlay,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 80,
        padding: 16,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
      onClick={(e) => {
        // Click-outside dismisses · tapping the panel itself does not.
        if (e.target === e.currentTarget && onDismiss) {
          onDismiss();
        }
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 320,
          padding: "18px 20px 20px",
          background: NEX.panel,
          border: `1px solid ${NEX.border}`,
          borderRadius: 18,
          boxShadow: "0 20px 50px rgba(0,0,0,0.55)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 48,
            height: 48,
            borderRadius: 999,
            background: "rgba(166, 0, 0, 0.18)",
            border: `1px solid ${NEX.red}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            margin: "0 auto 4px",
          }}
        >
          📦
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 900,
            color: NEX.cream,
            textAlign: "center",
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
          }}
        >
          {headline}
        </h2>

        {usageLabel ? (
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: NEX.goldBright,
              textAlign: "center",
              letterSpacing: "0.04em",
            }}
          >
            {usageLabel}
          </div>
        ) : null}

        <p
          style={{
            margin: "4px 0 10px",
            fontSize: 12.5,
            color: NEX.inkDim,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          {body}
        </p>

        <Link
          href={upgradeHref}
          style={{
            display: "inline-flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "11px 16px",
            fontSize: 12.5,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#1A120A",
            background: NEX.gold,
            textDecoration: "none",
            borderRadius: 999,
          }}
        >
          Add more storage →
        </Link>

        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            style={{
              padding: "8px 14px",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: NEX.inkMuted,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Not now
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Convenience wrapper · a self-contained popup instance driven by
 *  its own visibility state. Call sites that just want the modal
 *  to appear once (e.g. a preview query param on /settings/storage)
 *  can mount this without managing state themselves. */
export function StandaloneShopLimitPopup({
  kind,
  usageLabel,
  upgradeHref,
}: {
  readonly kind: LimitKind;
  readonly usageLabel?: string;
  readonly upgradeHref?: string;
}): React.JSX.Element {
  const [visible, setVisible] = React.useState(true);
  return (
    <ShopLimitPopup
      visible={visible}
      kind={kind}
      usageLabel={usageLabel}
      onDismiss={() => setVisible(false)}
      upgradeHref={upgradeHref}
    />
  );
}
