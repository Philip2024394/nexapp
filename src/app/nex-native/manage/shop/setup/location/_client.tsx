"use client";

// src/app/nex-native/manage/shop/setup/location/_client.tsx
//
// Shop Setup · Step 2 · Location client.
// Owner-authorised 2026-11-06 · country-dropdown rework 2026-11-07.
// -----------------------------------------------------------------------------
// Captures:
//   · Country → nex_business.operating_country_code (migration 286)
//   · City    → nex_business.city
//   · Address → nex_business.address
//
// Country is PRE-FILLED from the signed-in owner's account profile /
// phone country code / env and is OVERRIDEABLE · expat sellers +
// dropshippers who run a shop out of another country can pick the
// right one. A subtle hint banner appears when the pick differs from
// the owner's personal country so the override is explicit, not
// accidental. All three fields optional at this step · owner can skip
// and fill later.

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
import {
  COUNTRY_CATALOGUE_SORTED,
  lookupCountry,
} from "@/lib/nex-native/country-catalogue";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const AMBER = "#F3C56B";

export function LocationStepClient({
  initialAddress,
  initialCity,
  initialCountryCode,
  accountProfileCountryCode,
}: {
  initialAddress: string;
  initialCity: string;
  initialCountryCode: string | null;
  accountProfileCountryCode: string | null;
}): React.JSX.Element {
  const router = useRouter();
  const [countryCode, setCountryCode] = React.useState<string>(
    initialCountryCode ?? "",
  );
  const [address, setAddress] = React.useState(initialAddress);
  const [city, setCity] = React.useState(initialCity);
  const [status, setStatus] = React.useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  const selectedCountry = lookupCountry(countryCode);
  const divergesFromAccount =
    accountProfileCountryCode !== null &&
    countryCode !== "" &&
    countryCode !== accountProfileCountryCode;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "saving") return;
    setStatus({ kind: "saving" });
    const fd = new FormData();
    fd.set("operatingCountryCode", countryCode);
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
      stepTitle="Where your shop is based"
      stepLead="Pick the country your shop operates in — we use it to set your currency default, SEO region and consumer-rights copy. You can override your personal country if you run a shop abroad."
      backHref="/nex-native/manage/shop/setup/identity"
      skipHref={undefined /* skip wired to its own button below */}
    >
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        {/* Country dropdown · pre-filled · overrideable. */}
        <div>
          <label htmlFor="shop-country" style={LABEL_STYLE}>
            Country your shop operates in
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
              {selectedCountry ? selectedCountry.flag : "🌐"}
            </span>
            <select
              id="shop-country"
              value={countryCode}
              onChange={(e) => setCountryCode(e.currentTarget.value)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: CREAM,
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "-0.005em",
                cursor: "pointer",
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                padding: "4px 0",
              }}
            >
              <option value="" style={{ background: "#0A1526" }}>
                Select country…
              </option>
              {COUNTRY_CATALOGUE_SORTED.map((c, i, arr) => {
                // Insert a visual divider after launch markets so the
                // list reads as "launch markets · rest" without a
                // disabled divider row that some mobile browsers skip.
                const prev = arr[i - 1];
                const separator =
                  prev && prev.launchMarket && !c.launchMarket ? "─── Other countries ───" : null;
                return (
                  <React.Fragment key={c.code}>
                    {separator ? (
                      <option disabled style={{ background: "#0A1526", color: INK_MUTED }}>
                        {separator}
                      </option>
                    ) : null}
                    <option value={c.code} style={{ background: "#0A1526" }}>
                      {c.flag} &nbsp;{c.label} · {c.currency}
                    </option>
                  </React.Fragment>
                );
              })}
            </select>
            {selectedCountry ? (
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
                {selectedCountry.code}
              </span>
            ) : null}
          </div>
          <span style={HINT_STYLE}>
            Pre-filled from your account. Pick a different country if your
            shop operates abroad.
          </span>
        </div>

        {/* Override hint · only when country differs from account profile. */}
        {divergesFromAccount ? (
          <div
            style={{
              padding: "10px 12px",
              fontSize: 11.5,
              lineHeight: 1.45,
              color: AMBER,
              background: "rgba(243, 197, 107, 0.08)",
              border: "1px solid rgba(243, 197, 107, 0.4)",
              borderRadius: 10,
            }}
          >
            <strong style={{ color: AMBER, fontWeight: 900 }}>Heads up ·</strong>{" "}
            your personal country on NEX is{" "}
            <span style={{ color: CREAM, fontWeight: 800 }}>
              {lookupCountry(accountProfileCountryCode)?.label ?? accountProfileCountryCode}
            </span>{" "}
            but you&rsquo;ve set this shop to operate in{" "}
            <span style={{ color: CREAM, fontWeight: 800 }}>
              {selectedCountry?.label}
            </span>
            . That&rsquo;s fine for cross-border sellers — currency, tax
            overlays and SEO will follow the shop&rsquo;s country.
          </div>
        ) : null}

        {/* City. */}
        <div>
          <label htmlFor="shop-city" style={LABEL_STYLE}>
            City
          </label>
          <input
            id="shop-city"
            type="text"
            maxLength={80}
            placeholder="Dublin · London · Jakarta · Sydney · …"
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
            placeholder="Street, city, postcode"
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
            {errorCopy(status.message)}
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

function errorCopy(code: string): string {
  switch (code) {
    case "country-invalid":
      return "Please pick a country from the list.";
    case "city-length":
      return "City must be 1-80 characters.";
    case "address-too-long":
      return "Address must be 500 characters or fewer.";
    case "not-authenticated":
      return "You've been signed out · please sign in again.";
    default:
      return code;
  }
}
