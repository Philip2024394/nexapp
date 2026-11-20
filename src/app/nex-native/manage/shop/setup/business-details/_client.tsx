"use client";

// src/app/nex-native/manage/shop/setup/business-details/_client.tsx
//
// Shop Setup · Step 1 · Combined Business Details · Client.
// Owner-authorised 2026-11-12 (simplification review).
// -----------------------------------------------------------------------------
// Single scrollable form combining shop name + logo picker + country +
// city + address + geolocation + business category + subcategory. Fires
// one server action (saveShopBusinessDetailsAction) that persists all
// fields atomically and hands control back to the setup dispatcher.
//
// Field-level behaviour mirrors the standalone legacy steps:
//   · Shop name validation (2-40 chars) + live share-link preview.
//   · Logo upload via uploadShopIdentityLogoAction (unchanged).
//   · Country pre-fill + amber "divergence" hint when the shop
//     country differs from the account profile country.
//   · "Set my location" one-tap geolocation (browser + Nominatim
//     reverse-geocode · fills country + city + address).
//   · Category dropdown · subcategory dropdown disabled until a
//     category is chosen. "Other → request a category" routes to the
//     sealed request flow.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  WizardShell,
  FIELD_STYLE,
  PRIMARY_CTA_STYLE,
  LABEL_STYLE,
  HINT_STYLE,
  ERROR_STYLE,
  SURFACE_CARD_STYLE,
} from "../_wizard-shell";
import {
  saveShopBusinessDetailsAction,
  uploadShopIdentityLogoAction,
} from "../_actions";
import {
  COUNTRY_CATALOGUE_SORTED,
  lookupCountry,
} from "@/lib/nex-native/country-catalogue";
import {
  BUSINESS_CATEGORIES,
  BUSINESS_CATEGORY_BLURB,
  BUSINESS_CATEGORY_LABEL,
} from "@/lib/nex-native/business/categories";
import {
  BUSINESS_SUBTYPE_CATEGORY,
  BUSINESS_SUBTYPE_LABEL,
  CATEGORIES_WITHOUT_OTHER_SUBTYPE,
  OTHER_BUSINESS_FALLBACK_SUBTYPE,
  subtypesByCategory,
} from "@/lib/nex-native/business/subtypes";
import type {
  BusinessCategory,
  BusinessSubtype,
} from "@/lib/nex-native/business/types";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const BORDER = "rgba(198, 161, 91, 0.25)";
const BORDER_HI = "rgba(198, 161, 91, 0.55)";
const AMBER = "#F3C56B";

const CATEGORY_OTHER = "__other_category__";

const CATEGORY_EMOJI: Record<BusinessCategory, string> = {
  food:          "🍽",
  accommodation: "🏨",
  property:      "🏠",
  products:      "📦",
  services:      "🛎",
};

const SELECT_STYLE: React.CSSProperties = {
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
};

interface Props {
  readonly chatName: string;
  readonly initialShopName: string;
  readonly initialLogoUrl: string | null;
  readonly initialCountryCode: string | null;
  readonly initialCity: string;
  readonly initialAddress: string;
  readonly initialCategory: BusinessCategory | null;
  readonly initialSubtype: BusinessSubtype | null;
  readonly accountProfileCountryCode: string | null;
}

export function BusinessDetailsStepClient({
  chatName,
  initialShopName,
  initialLogoUrl,
  initialCountryCode,
  initialCity,
  initialAddress,
  initialCategory,
  initialSubtype,
  accountProfileCountryCode,
}: Props): React.JSX.Element {
  const router = useRouter();

  // Identity state.
  const [shopName, setShopName] = React.useState(initialShopName);
  const [logoUrl, setLogoUrl] = React.useState<string | null>(initialLogoUrl);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Location state.
  const [countryCode, setCountryCode] = React.useState<string>(
    initialCountryCode ?? "",
  );
  const [city, setCity] = React.useState(initialCity);
  const [address, setAddress] = React.useState(initialAddress);
  const [locating, setLocating] = React.useState(false);
  const [geoError, setGeoError] = React.useState<string | null>(null);

  // Category state.
  const [category, setCategory] = React.useState<string>(initialCategory ?? "");
  const [subtype, setSubtype] = React.useState<string>(initialSubtype ?? "");

  // Form status.
  const [status, setStatus] = React.useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  // ── Derived ─────────────────────────────────────────────────────────
  const trimmedName = shopName.trim();
  const nameError =
    trimmedName.length > 0 &&
    (trimmedName.length < 2 || trimmedName.length > 40)
      ? "Shop name must be 2 to 40 characters."
      : null;

  const activeCategory: BusinessCategory | null =
    (BUSINESS_CATEGORIES as readonly string[]).includes(category)
      ? (category as BusinessCategory)
      : null;
  const activeSubtypes = activeCategory
    ? subtypesByCategory(activeCategory)
    : [];
  const pickedSubtype: BusinessSubtype | null =
    activeCategory && (activeSubtypes as readonly string[]).includes(subtype)
      ? (subtype as BusinessSubtype)
      : null;

  const selectedCountry = lookupCountry(countryCode);
  const divergesFromAccount =
    accountProfileCountryCode !== null &&
    countryCode !== "" &&
    countryCode !== accountProfileCountryCode;

  // Live URL preview · client-side mirror of generateBusinessSlug.
  const slugPreview = React.useMemo(() => {
    const base = trimmedName
      .replace(/^@/, "")
      .replace(/^nex-/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    return base.length > 0 ? base : "";
  }, [trimmedName]);
  const [publicHost, setPublicHost] = React.useState("nexapp.app");
  React.useEffect(() => {
    setPublicHost(window.location.host);
  }, []);
  const [copied, setCopied] = React.useState(false);
  async function copyPreviewUrl() {
    if (!slugPreview) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/nex-native/${slugPreview}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard denied · ignore silently */
    }
  }

  const canSave =
    trimmedName.length >= 2 &&
    trimmedName.length <= 40 &&
    status.kind !== "saving";

  // ── Handlers ────────────────────────────────────────────────────────
  async function onFilePicked(file: File) {
    setUploading(true);
    setStatus({ kind: "idle" });
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadShopIdentityLogoAction(fd);
    setUploading(false);
    if (result.ok) {
      setLogoUrl(result.url);
    } else {
      setStatus({ kind: "error", message: `Logo upload: ${result.error}` });
    }
  }

  async function detectLocation() {
    setGeoError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Your browser doesn't support geolocation.");
      return;
    }
    setLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 12_000,
          maximumAge: 60_000,
        });
      });
      const { latitude, longitude } = pos.coords;
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        { headers: { Accept: "application/json" } },
      );
      if (!r.ok) throw new Error(`reverse-geocode-${r.status}`);
      const data = (await r.json()) as {
        address?: Record<string, string | undefined>;
        display_name?: string;
      };
      const addr = data.address ?? {};
      const resolvedCity =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.county ||
        "";
      const resolvedCountry = (addr.country_code ?? "").toUpperCase();
      const street = [
        [addr.house_number, addr.road].filter(Boolean).join(" "),
        addr.suburb || addr.neighbourhood,
        addr.postcode,
      ]
        .filter(Boolean)
        .join(", ");
      if (resolvedCity) setCity(resolvedCity);
      if (street) setAddress(street);
      else if (data.display_name) setAddress(data.display_name);
      if (
        resolvedCountry &&
        resolvedCountry.length === 2 &&
        lookupCountry(resolvedCountry)
      ) {
        setCountryCode(resolvedCountry);
      }
    } catch (e) {
      const msg = (e as GeolocationPositionError | Error).message ?? "";
      if (/denied|permission/i.test(msg)) {
        setGeoError(
          "Location permission denied · you can type it instead.",
        );
      } else if (/timeout/i.test(msg)) {
        setGeoError("Location timed out · try again or type it in.");
      } else {
        setGeoError("Couldn't detect location · you can type it instead.");
      }
    } finally {
      setLocating(false);
    }
  }

  function onCategoryChange(next: string) {
    if (next === CATEGORY_OTHER) {
      router.push("/nex-native/manage/shop/setup/request-category");
      return;
    }
    setCategory(next);
    setSubtype("");
  }

  function onSubtypeChange(next: string) {
    if (next.startsWith("__other__:")) {
      const cat = next.split(":")[1] ?? "";
      const qs = new URLSearchParams({ category: cat });
      router.push(
        `/nex-native/manage/shop/setup/request-category?${qs.toString()}`,
      );
      return;
    }
    setSubtype(next);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSave) return;
    setStatus({ kind: "saving" });
    const fd = new FormData();
    fd.set("displayName", trimmedName);
    if (logoUrl) fd.set("logoUrl", logoUrl);
    fd.set("operatingCountryCode", countryCode);
    fd.set("city", city.trim());
    fd.set("address", address.trim());
    if (activeCategory && pickedSubtype) {
      fd.set("category", activeCategory);
      fd.set("subtype", pickedSubtype);
    }
    const result = await saveShopBusinessDetailsAction(fd);
    if (result.ok) {
      router.push(result.nextHref);
    } else {
      setStatus({ kind: "error", message: errorCopy(result.error) });
    }
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <WizardShell
      stepNumber={1}
      stepTitle="Your shop details"
      stepLead="Shop name, where you're based, and what you sell — all in one place. You can edit any of this later from Manage Shop."
      backHref="/nex-native/manage/shop/start"
    >
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 18 }}
      >
        {/* ── Chat-name reminder ──────────────────────────────── */}
        <div style={SURFACE_CARD_STYLE}>
          <span style={LABEL_STYLE}>You chat as</span>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: CREAM,
              letterSpacing: "-0.005em",
            }}
          >
            {chatName}
          </div>
          <span style={HINT_STYLE}>
            Your chat name stays yours. The shop name below is a separate
            brand badge.
          </span>
        </div>

        {/* ── Shop name + logo + URL preview ──────────────────── */}
        <section
          aria-label="Shop name"
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <div>
            <label htmlFor="shop-name" style={LABEL_STYLE}>
              Shop name
            </label>
            <input
              id="shop-name"
              name="displayName"
              type="text"
              autoFocus
              maxLength={40}
              placeholder="e.g. Irish Pride · The Little Bakery · Grafton Studio"
              value={shopName}
              onChange={(e) => setShopName(e.currentTarget.value)}
              style={{
                ...FIELD_STYLE,
                borderColor: nameError ? "#FF6B6B" : BORDER_HI,
              }}
            />
            {nameError ? (
              <span style={ERROR_STYLE}>{nameError}</span>
            ) : (
              <span style={HINT_STYLE}>
                {trimmedName.length} / 40 characters · you can rename later.
              </span>
            )}

            {/* Live share-link preview · appears once 2+ chars typed. */}
            {slugPreview && trimmedName.length >= 2 ? (
              <div
                data-nex-shop-url-preview
                style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  background: "rgba(198, 161, 91, 0.08)",
                  border: `1px solid ${BORDER_HI}`,
                  borderRadius: 10,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 900,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: GOLD,
                      marginBottom: 3,
                    }}
                  >
                    Your share link
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: CREAM,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                    }}
                  >
                    {publicHost}/nex-native/
                    <span style={{ color: GOLD }}>{slugPreview}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={copyPreviewUrl}
                  aria-label="Copy share link"
                  style={{
                    flexShrink: 0,
                    padding: "6px 12px",
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: copied ? "#1A120A" : GOLD,
                    background: copied ? "#FFD600" : "transparent",
                    border: `1px solid ${copied ? "#E6B800" : GOLD}`,
                    borderRadius: 999,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            ) : null}
          </div>

          {/* Logo picker · optional. */}
          <div>
            <span style={LABEL_STYLE}>Shop logo (optional)</span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 12,
                background: "rgba(5, 15, 28, 0.9)",
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  backgroundImage: logoUrl ? `url(${logoUrl})` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  background: logoUrl
                    ? undefined
                    : "linear-gradient(135deg, rgba(198,161,91,0.25), rgba(198,161,91,0.08))",
                  border: `1px solid ${BORDER_HI}`,
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 22,
                }}
              >
                {logoUrl ? "" : "🖼"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    padding: "8px 14px",
                    fontSize: 11.5,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: GOLD,
                    background: "transparent",
                    border: `1px solid ${GOLD}`,
                    borderRadius: 999,
                    cursor: uploading ? "wait" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {uploading
                    ? "Uploading…"
                    : logoUrl
                      ? "Change logo"
                      : "Upload logo"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    if (f) void onFilePicked(f);
                    e.currentTarget.value = "";
                  }}
                />
                {logoUrl ? (
                  <button
                    type="button"
                    onClick={() => setLogoUrl(null)}
                    style={{
                      marginLeft: 8,
                      padding: "6px 10px",
                      fontSize: 10.5,
                      color: INK_MUTED,
                      background: "transparent",
                      border: `1px solid ${BORDER}`,
                      borderRadius: 999,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Remove
                  </button>
                ) : null}
                <div style={{ ...HINT_STYLE, marginTop: 6 }}>
                  PNG · JPG · WebP · up to 8 MB.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── What do you sell · category + subcategory ─────── */}
        <section
          aria-label="Category"
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <div>
            <label htmlFor="shop-category" style={LABEL_STYLE}>
              What do you sell?
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
                {activeCategory ? CATEGORY_EMOJI[activeCategory] : "🏷"}
              </span>
              <select
                id="shop-category"
                value={category}
                onChange={(e) => onCategoryChange(e.currentTarget.value)}
                style={SELECT_STYLE}
              >
                <option value="" style={{ background: "#000" }}>
                  Select a category…
                </option>
                {BUSINESS_CATEGORIES.map((c) => (
                  <option key={c} value={c} style={{ background: "#000" }}>
                    {CATEGORY_EMOJI[c]} &nbsp;{BUSINESS_CATEGORY_LABEL[c]}
                  </option>
                ))}
                <option
                  value={CATEGORY_OTHER}
                  style={{ background: "#000" }}
                >
                  ✳ &nbsp;Other → request a category
                </option>
              </select>
            </div>
            <span style={HINT_STYLE}>
              {activeCategory
                ? BUSINESS_CATEGORY_BLURB[activeCategory]
                : "Pick the family that best fits your shop · optional at this step."}
            </span>
          </div>

          <div>
            <label htmlFor="shop-subtype" style={LABEL_STYLE}>
              Business type
            </label>
            <div
              style={{
                ...SURFACE_CARD_STYLE,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                opacity: activeCategory ? 1 : 0.5,
              }}
            >
              <span aria-hidden style={{ fontSize: 22, minWidth: 24 }}>
                📂
              </span>
              <select
                id="shop-subtype"
                value={subtype}
                onChange={(e) => onSubtypeChange(e.currentTarget.value)}
                disabled={!activeCategory}
                style={{
                  ...SELECT_STYLE,
                  cursor: activeCategory ? "pointer" : "not-allowed",
                }}
              >
                <option value="" style={{ background: "#000" }}>
                  {activeCategory
                    ? "Select a type…"
                    : "Pick a category first"}
                </option>
                {activeSubtypes
                  .filter(
                    (s) =>
                      OTHER_BUSINESS_FALLBACK_SUBTYPE[
                        BUSINESS_SUBTYPE_CATEGORY[s]
                      ] !== s,
                  )
                  .map((s) => (
                    <option
                      key={s}
                      value={s}
                      style={{ background: "#000" }}
                    >
                      {BUSINESS_SUBTYPE_LABEL[s]}
                    </option>
                  ))}
                {activeCategory ? renderOtherOption(activeCategory) : null}
              </select>
            </div>
            <span style={HINT_STYLE}>
              Can&rsquo;t find your exact business?{" "}
              <Link
                href={{
                  pathname:
                    "/nex-native/manage/shop/setup/request-category",
                  query: activeCategory
                    ? { category: activeCategory }
                    : undefined,
                }}
                style={{ color: GOLD, fontWeight: 800 }}
              >
                Request a category →
              </Link>
            </span>
          </div>
        </section>

        {/* ── Where your shop is based ────────────────────────── */}
        <section
          aria-label="Shop location"
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <span style={LABEL_STYLE}>Where is your shop based?</span>

          {/* Set my location · one-tap geolocation + reverse-geocode. */}
          <div>
            <button
              type="button"
              onClick={detectLocation}
              disabled={locating}
              data-nex-shop-location-detect
              style={{
                width: "100%",
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#FFFFFF",
                background: locating ? "rgba(255, 114, 0, 0.7)" : "#FF7200",
                border: "1px solid #E66800",
                borderRadius: 999,
                cursor: locating ? "wait" : "pointer",
                fontFamily: "inherit",
                boxShadow: "0 4px 14px rgba(255, 114, 0, 0.25)",
              }}
            >
              <span aria-hidden style={{ fontSize: 14 }}>📍</span>
              {locating ? "Detecting…" : "Set my location"}
            </button>
            {geoError ? (
              <span
                style={{
                  ...HINT_STYLE,
                  color: AMBER,
                  marginTop: 6,
                  display: "block",
                }}
              >
                {geoError}
              </span>
            ) : (
              <span style={{ ...HINT_STYLE, marginTop: 6, display: "block" }}>
                Optional · fills country, city and address below in one
                tap. You can still type any field manually.
              </span>
            )}
          </div>

          {/* Country · required. */}
          <div>
            <label htmlFor="shop-country" style={LABEL_STYLE}>
              Country
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
                style={SELECT_STYLE}
              >
                <option value="" style={{ background: "#000" }}>
                  Select country…
                </option>
                {COUNTRY_CATALOGUE_SORTED.map((c, i, arr) => {
                  const prev = arr[i - 1];
                  const separator =
                    prev && prev.launchMarket && !c.launchMarket
                      ? "─── Other countries ───"
                      : null;
                  return (
                    <React.Fragment key={c.code}>
                      {separator ? (
                        <option
                          disabled
                          style={{ background: "#000", color: INK_MUTED }}
                        >
                          {separator}
                        </option>
                      ) : null}
                      <option
                        value={c.code}
                        style={{ background: "#000" }}
                      >
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
                    border: `1px solid ${BORDER_HI}`,
                    borderRadius: 999,
                  }}
                >
                  {selectedCountry.code}
                </span>
              ) : null}
            </div>
            {divergesFromAccount ? (
              <div
                style={{
                  marginTop: 6,
                  padding: "10px 12px",
                  fontSize: 11.5,
                  lineHeight: 1.45,
                  color: AMBER,
                  background: "rgba(243, 197, 107, 0.08)",
                  border: "1px solid rgba(243, 197, 107, 0.4)",
                  borderRadius: 10,
                }}
              >
                <strong style={{ color: AMBER, fontWeight: 900 }}>
                  Heads up ·
                </strong>{" "}
                your personal country is{" "}
                <span style={{ color: CREAM, fontWeight: 800 }}>
                  {lookupCountry(accountProfileCountryCode)?.label ??
                    accountProfileCountryCode}
                </span>{" "}
                but your shop is set to{" "}
                <span style={{ color: CREAM, fontWeight: 800 }}>
                  {selectedCountry?.label}
                </span>
                . That&rsquo;s fine for cross-border sellers.
              </div>
            ) : null}
          </div>

          {/* City · optional. */}
          <div>
            <label htmlFor="shop-city" style={LABEL_STYLE}>
              City (optional)
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
          </div>

          {/* Address · optional. */}
          <div>
            <label htmlFor="shop-address" style={LABEL_STYLE}>
              Street address (optional)
            </label>
            <textarea
              id="shop-address"
              rows={2}
              maxLength={500}
              placeholder="Street, postcode · leave blank for online-only shops"
              value={address}
              onChange={(e) => setAddress(e.currentTarget.value)}
              style={{
                ...FIELD_STYLE,
                fontFamily: "inherit",
                resize: "vertical",
                minHeight: 60,
              }}
            />
          </div>
        </section>

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
          disabled={!canSave}
          style={{
            ...PRIMARY_CTA_STYLE,
            opacity: canSave ? 1 : 0.5,
            cursor: canSave ? "pointer" : "not-allowed",
            marginTop: 4,
          }}
        >
          {status.kind === "saving" ? "Saving…" : "Save & continue →"}
        </button>

        <span
          style={{
            display: "block",
            textAlign: "center",
            fontSize: 10.5,
            color: INK_DIM,
          }}
        >
          You can edit any of this later from Manage Shop.
        </span>
      </form>
    </WizardShell>
  );
}

function renderOtherOption(
  category: BusinessCategory,
): React.JSX.Element | null {
  const subtypeFallback = OTHER_BUSINESS_FALLBACK_SUBTYPE[category];
  if (subtypeFallback) {
    return (
      <option value={subtypeFallback} style={{ background: "#000" }}>
        ✳ &nbsp;Other {BUSINESS_CATEGORY_LABEL[category]} business…
      </option>
    );
  }
  if (
    (CATEGORIES_WITHOUT_OTHER_SUBTYPE as readonly string[]).includes(category)
  ) {
    return (
      <option value={`__other__:${category}`} style={{ background: "#000" }}>
        ✳ &nbsp;Other {BUSINESS_CATEGORY_LABEL[category]} business → request
      </option>
    );
  }
  return null;
}

function errorCopy(code: string): string {
  switch (code) {
    case "shop-name-length":
      return "Shop name must be 2 to 40 characters.";
    case "country-invalid":
      return "Please pick a country from the list.";
    case "city-length":
      return "City must be 1-80 characters.";
    case "address-too-long":
      return "Address must be 500 characters or fewer.";
    case "category-required":
      return "Pick a category + subcategory, or leave both blank.";
    case "unknown-category":
    case "unknown-subtype":
    case "subtype-mismatch":
      return "That category pair isn't recognised. Pick again from the list.";
    case "not-authenticated":
      return "You've been signed out · please sign in again.";
    case "owner-mismatch":
    // Lane C · prompt-7 round 18 · 2026-11-19 · service-layer
    // `updateBusinessDisplayName` throws when the owner_account_id
    // scope matches zero rows (concurrent ownership transfer OR the
    // session's account no longer owns this business). The action
    // converts that to the stable `owner-scope-denied` wire code so
    // the seller sees the same user-safe banner as the pre-existing
    // owner-mismatch branch from round 11.
    case "owner-scope-denied":
      return "You can only edit a shop you own · please sign in again.";
    // Lane C · prompt-7 round 11 · 2026-11-19 · safe-error fall-through.
    // Previously `return code;` leaked raw server/driver strings (e.g.
    // Postgres error messages, library stack-trace preambles) to the
    // seller's phone. Replace with a stable copy; the specific `code`
    // is logged to aid debugging but never shown to the end user.
    default:
      if (code && typeof code === "string") {
        console.warn("[nex] shop-setup · unmapped server error code", code);
      }
      return "We couldn't save that just now · please try again in a moment.";
  }
}
