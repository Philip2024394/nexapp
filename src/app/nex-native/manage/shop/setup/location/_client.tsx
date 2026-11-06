"use client";

// src/app/nex-native/manage/shop/setup/location/_client.tsx
//
// Shop Setup · Step 2 · Location client.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Captures:
//   · Address → nex_business.address
//   · City    → nex_business.city
//   · Country → Ireland (implicit from NEX_APP_COUNTRY env · migration-
//               free per the scope discussion)
//
// Both fields optional at this step · owner can skip and fill later.
// Save → autosave through saveShopLocationAction · routes to Step 3
// (currently the themes picker while the remaining steps are built).

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
import { saveShopLocationAction } from "../_actions";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";

export function LocationStepClient({
  initialAddress,
  initialCity,
}: {
  initialAddress: string;
  initialCity: string;
}): React.JSX.Element {
  const router = useRouter();
  const [address, setAddress] = React.useState(initialAddress);
  const [city, setCity] = React.useState(initialCity);
  const [status, setStatus] = React.useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "saving") return;
    setStatus({ kind: "saving" });
    const fd = new FormData();
    fd.set("address", address.trim());
    fd.set("city", city.trim());
    const result = await saveShopLocationAction(fd);
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
      stepNumber={2}
      stepTitle="Where you're based"
      stepLead="Shown to buyers on the Visit Us panel and used for the 'Get Directions' link. Skip if you sell online only."
      backHref="/nex-native/manage/shop/setup/identity"
      skipHref={undefined /* skip wired to its own button below */}
    >
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        {/* Country badge · Ireland fixed for this launch (env-derived). */}
        <div
          style={{
            ...SURFACE_CARD_STYLE,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span aria-hidden style={{ fontSize: 22 }}>🇮🇪</span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: CREAM,
                letterSpacing: "-0.005em",
              }}
            >
              Ireland
            </div>
            <span style={{ fontSize: 10.5, color: INK_MUTED }}>
              NEX Ireland launch · country is fixed per app identity.
            </span>
          </div>
          <span
            style={{
              padding: "4px 10px",
              fontSize: 9.5,
              fontWeight: 900,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: GOLD,
              background: "rgba(198, 161, 91, 0.12)",
              border: "1px solid rgba(198, 161, 91, 0.55)",
              borderRadius: 999,
            }}
          >
            IE · default
          </span>
        </div>

        {/* City. */}
        <div>
          <label htmlFor="shop-city" style={LABEL_STYLE}>
            City
          </label>
          <input
            id="shop-city"
            type="text"
            maxLength={80}
            placeholder="Dublin · Cork · Galway · Limerick · …"
            value={city}
            onChange={(e) => setCity(e.currentTarget.value)}
            style={FIELD_STYLE}
          />
          <span style={HINT_STYLE}>
            Shown as a small pin row under your shop name.
          </span>
        </div>

        {/* Address. */}
        <div>
          <label htmlFor="shop-address" style={LABEL_STYLE}>
            Street address
          </label>
          <textarea
            id="shop-address"
            rows={2}
            maxLength={500}
            placeholder="12 Francis Street, Dublin 8, D08 XXXX"
            value={address}
            onChange={(e) => setAddress(e.currentTarget.value)}
            style={{
              ...FIELD_STYLE,
              fontFamily: "inherit",
              resize: "vertical",
              minHeight: 60,
            }}
          />
          <span style={HINT_STYLE}>
            Used for the Visit Us + Get Directions deep-link. Leave blank
            for online-only shops.
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
          {status.kind === "saving" ? "Saving…" : "Save & continue →"}
        </button>

        {/* Skip row · explicit button so the shell's skipHref can stay
            null (we want the skip to feel like a secondary action in
            the form flow, not an escape-hatch link). */}
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
          Skip, I&rsquo;ll add my address later
        </button>

        <span
          style={{
            display: "block",
            textAlign: "center",
            fontSize: 10.5,
            color: INK_DIM,
          }}
        >
          Saved on nex_business · editable from /manage/shop any time.
        </span>
      </form>
    </WizardShell>
  );
}
