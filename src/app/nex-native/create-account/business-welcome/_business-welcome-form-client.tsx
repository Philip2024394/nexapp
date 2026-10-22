"use client";

// src/app/nex-native/create-account/business-welcome/_business-welcome-form-client.tsx
//
// NEX · Business Welcome · interactive form (business type + location).
// Owner-authorised 2026-10-21.
// -----------------------------------------------------------------------------
// Guest-facing. Four business-type tiles in the order the owner specified
// (Accommodation / Food & Drink / Products / Services). Phase A1 release
// hold is respected · only Accommodation is tappable, the other three show
// an honest "Coming soon" badge and don't submit.
//
// When Accommodation is picked, the user picks a sub-type (Villa / Homestay
// / Kost) · enters a location · and submits via rememberBusinessWelcomeAction.

import * as React from "react";
import { rememberBusinessWelcomeAction } from "./_remember-business-welcome-action";
import {
  WELCOME_BUSINESS_BIO_LINK_BASE,
  WELCOME_BUSINESS_DESCRIPTION_MAX_LENGTH,
  WELCOME_BUSINESS_FACILITIES_MAX_COUNT,
  WELCOME_BUSINESS_FACILITY_CATALOGUE,
  WELCOME_BUSINESS_ROOMS_MAX,
  WELCOME_BUSINESS_ROOMS_MIN,
  WELCOME_BUSINESS_SHOP_NAME_MAX_LENGTH,
  WELCOME_BUSINESS_SOCIAL_URL_MAX_LENGTH,
  isValidTimeString,
  shopNameToSlug,
} from "./_business-welcome-cookies";

const NEX = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
  orangeSoft: "rgba(255, 114, 0, 0.6)",
  panel: "rgba(3, 16, 29, 0.70)",
  panelBorder: "rgba(0, 175, 255, 0.28)",
  danger: "#F46A6A",
};

interface VerticalTile {
  readonly category: string;
  readonly label: string;
  readonly glyph: string;
  readonly ready: boolean;
  readonly subtypes?: ReadonlyArray<AccommodationOption>;
}

/** Owner directive 2026-10-21 (iteration 5) · the accommodation
 *  sub-type picker is now an 11-item dropdown. The sealed
 *  `vertical-presets.isVerticalSubtype` validator currently accepts
 *  only `villa` / `homestay` / `kost` · the two tokens that map
 *  cleanly from the owner's list are marked `ready: true`. The
 *  remaining 9 options render as disabled "Coming soon" entries so
 *  the owner's full ladder is visible without baiting users into a
 *  dead-end submission (the server would reject anything else). */
interface AccommodationOption {
  readonly subtype: string;
  readonly label: string;
  readonly ready: boolean;
}

const ACCOMMODATION_OPTIONS: readonly AccommodationOption[] = [
  { subtype: "hotels_resorts", label: "Hotels & Resorts", ready: false },
  { subtype: "villa", label: "Villas", ready: true },
  { subtype: "houses", label: "Houses", ready: false },
  { subtype: "apartments", label: "Apartments", ready: false },
  { subtype: "camping", label: "Camping", ready: false },
  { subtype: "hostels", label: "Hostels", ready: false },
  { subtype: "homestay", label: "Homestays", ready: true },
  { subtype: "eco_lodges", label: "Eco-Lodges", ready: false },
  { subtype: "unique_stays", label: "Unique Stays", ready: false },
  { subtype: "long_stay_rentals", label: "Long-Stay Rentals", ready: false },
  { subtype: "boats_floating", label: "Boats & Floating Stays", ready: false },
] as const;

// Phase A1 hold · Accommodation only. The other three tiles are rendered
// honestly as "Coming soon" so the user sees the shape of the ladder.
const TILES: readonly VerticalTile[] = [
  {
    category: "accommodation",
    label: "Accommodation",
    glyph: "🏨",
    ready: true,
    subtypes: ACCOMMODATION_OPTIONS,
  },
  { category: "food", label: "Food & Drink", glyph: "🍲", ready: false },
  { category: "products", label: "Products", glyph: "🛍️", ready: false },
  { category: "services", label: "Services", glyph: "🛠️", ready: false },
] as const;

export function BusinessWelcomeFormClient(): React.JSX.Element {
  const [pickedCategory, setPickedCategory] = React.useState<string | null>(null);
  const [pickedSubtype, setPickedSubtype] = React.useState<string | null>(null);
  const [shopName, setShopName] = React.useState<string>("");
  const [location, setLocation] = React.useState<string>("");
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = React.useState<boolean>(false);
  const [locationError, setLocationError] = React.useState<string | null>(null);
  // Opening + closing times · HH:MM 24h · validated by the shared
  // `isValidTimeString` guard (same guard the server re-validates).
  const [openTime, setOpenTime] = React.useState<string>("09:00");
  const [closeTime, setCloseTime] = React.useState<string>("22:00");
  // Facilities · owner picks up to WELCOME_BUSINESS_FACILITIES_MAX_COUNT.
  // Each entry is a sealed catalogue token (`wifi`, `pool`, …).
  const [facilities, setFacilities] = React.useState<readonly string[]>([]);
  // Optional extras (owner directive 2026-10-21 iteration 12) · none
  // of these affect canSubmit · all are liberal-validation strings
  // that get their own cookies on continue.
  const [rooms, setRooms] = React.useState<string>("");
  const [description, setDescription] = React.useState<string>("");
  const [socialInstagram, setSocialInstagram] = React.useState<string>("");
  const [socialFacebook, setSocialFacebook] = React.useState<string>("");
  const [socialTiktok, setSocialTiktok] = React.useState<string>("");
  const [socialWebsite, setSocialWebsite] = React.useState<string>("");
  const toggleFacility = React.useCallback((token: string) => {
    setFacilities((prev) => {
      if (prev.includes(token)) {
        return prev.filter((t) => t !== token);
      }
      if (prev.length >= WELCOME_BUSINESS_FACILITIES_MAX_COUNT) {
        return prev; // cap · ignore extra picks silently
      }
      return [...prev, token];
    });
  }, []);
  const [submitting, setSubmitting] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Browser geolocation · requests the browser permission prompt on
  // first click. On success we attempt a reverse geocode via
  // OpenStreetMap Nominatim (free, no API key, CORS-friendly) to show
  // a human-readable address. If reverse geocoding fails we fall
  // back to the raw coordinate string so the form can still submit.
  const handleRequestLocation = React.useCallback(() => {
    setLocationError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Your browser doesn't expose a location API.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=14&addressdetails=1`,
            { headers: { Accept: "application/json" } },
          );
          if (resp.ok) {
            const data: { display_name?: string } = await resp.json();
            if (data?.display_name && data.display_name.length > 0) {
              setLocation(data.display_name);
            } else {
              setLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
            }
          } else {
            setLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          }
        } catch {
          setLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setCoords(null);
        if (err.code === 1) {
          setLocationError(
            "Location permission denied. You can enable it in your browser settings and try again.",
          );
        } else if (err.code === 2) {
          setLocationError("Couldn't determine your location · try again.");
        } else if (err.code === 3) {
          setLocationError("Location request timed out · try again.");
        } else {
          setLocationError("Couldn't get your location · try again.");
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const handleResetLocation = React.useCallback(() => {
    setCoords(null);
    setLocation("");
    setLocationError(null);
  }, []);

  const activeTile = TILES.find((t) => t.category === pickedCategory) ?? null;
  const needsSubtype = activeTile?.ready && (activeTile.subtypes?.length ?? 0) > 0;
  // Live preview of the public bio link · derived from the shop name
  // via the shared `shopNameToSlug` helper (same slug the server
  // persists). Empty when the shop name slugs to nothing.
  const shopSlug = React.useMemo(() => shopNameToSlug(shopName), [shopName]);
  const bioLinkFull = `${WELCOME_BUSINESS_BIO_LINK_BASE}/${shopSlug}`;
  const canCopyBioLink = shopSlug.length > 0;
  const [copied, setCopied] = React.useState<boolean>(false);
  const handleCopyBioLink = React.useCallback(async () => {
    if (!canCopyBioLink) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(bioLinkFull);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Silently ignore · older browsers / permissions blocked. The
      // user can select the text manually.
    }
  }, [bioLinkFull, canCopyBioLink]);
  const hoursValid =
    isValidTimeString(openTime) &&
    isValidTimeString(closeTime) &&
    openTime !== closeTime;
  // Per-step completion flags · drive the green tick indicators next
  // to each step label. Facilities (step 5) is optional · tick shows
  // when the owner has engaged with it (≥1 pick).
  const step1Complete =
    pickedCategory !== null &&
    activeTile?.ready === true &&
    (!needsSubtype || pickedSubtype !== null);
  const step2Complete = shopName.trim().length > 0 && shopSlug.length > 0;
  const step3Complete = location.trim().length > 0;
  const step4Complete = hoursValid;
  // Owner directive 2026-10-21 (iteration 11) · facilities tick is
  // awarded ONLY at the full cap (4 picks), not at any pick.
  const step5Complete = facilities.length >= WELCOME_BUSINESS_FACILITIES_MAX_COUNT;
  const canSubmit =
    !submitting &&
    step1Complete &&
    step2Complete &&
    step3Complete &&
    step4Complete;

  const handleSubmit = React.useCallback(
    async (ev: React.FormEvent<HTMLFormElement>) => {
      ev.preventDefault();
      if (!canSubmit) return;
      setError(null);
      setSubmitting(true);
      try {
        const fd = new FormData();
        fd.append("category", pickedCategory ?? "");
        fd.append("subtype", pickedSubtype ?? "");
        fd.append("shop_name", shopName.trim());
        fd.append("location", location.trim());
        fd.append("open_time", openTime);
        fd.append("close_time", closeTime);
        for (const f of facilities) {
          fd.append("facilities", f);
        }
        if (rooms.trim().length > 0) fd.append("rooms", rooms.trim());
        if (description.trim().length > 0) fd.append("description", description.trim());
        if (socialInstagram.trim().length > 0)
          fd.append("social_instagram", socialInstagram.trim());
        if (socialFacebook.trim().length > 0)
          fd.append("social_facebook", socialFacebook.trim());
        if (socialTiktok.trim().length > 0)
          fd.append("social_tiktok", socialTiktok.trim());
        if (socialWebsite.trim().length > 0)
          fd.append("social_website", socialWebsite.trim());
        // The server action redirects on success · if we return, something
        // failed before the redirect (validation error with a message).
        const result = await rememberBusinessWelcomeAction(fd);
        if (result && result.ok === false) {
          setError(result.error ?? "Something went wrong. Try again.");
        }
      } catch (e) {
        // Next.js throws a NEXT_REDIRECT internally for successful redirects ·
        // let that bubble up (the browser will follow it).
        if (
          e instanceof Error &&
          /NEXT_REDIRECT|digest/.test(e.message)
        ) {
          throw e;
        }
        setError(e instanceof Error ? e.message : "Submit failed.");
      } finally {
        setSubmitting(false);
      }
    },
    [
      canSubmit,
      pickedCategory,
      pickedSubtype,
      shopName,
      location,
      openTime,
      closeTime,
      facilities,
      rooms,
      description,
      socialInstagram,
      socialFacebook,
      socialTiktok,
      socialWebsite,
    ],
  );

  return (
    <form
      onSubmit={handleSubmit}
      data-nex-business-welcome-form
      style={{ display: "flex", flexDirection: "column", gap: 18 }}
    >
      {/* ── 1 · What's your business? ───────────────────────────── */}
      <section>
        <SectionLabel
          step="1"
          title="What's your business?"
          complete={step1Complete}
        />
        <p
          style={{
            margin: "-4px 2px 10px",
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.4,
          }}
        >
          Choose which best describes
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 8,
          }}
        >
          {TILES.map((t) => {
            const isPicked = pickedCategory === t.category;
            return (
              <button
                key={t.category}
                type="button"
                onClick={() => {
                  if (!t.ready) return;
                  if (pickedCategory === t.category) {
                    setPickedCategory(null);
                    setPickedSubtype(null);
                  } else {
                    setPickedCategory(t.category);
                    setPickedSubtype(null);
                  }
                }}
                disabled={!t.ready || submitting}
                aria-pressed={isPicked}
                data-nex-business-welcome-tile={t.category}
                data-nex-business-welcome-tile-ready={t.ready ? "true" : "false"}
                style={{
                  position: "relative",
                  padding: "14px 10px",
                  borderRadius: 12,
                  border: `1px solid ${isPicked ? NEX.cyan : NEX.panelBorder}`,
                  background: isPicked
                    ? NEX.cyanFaint
                    : t.ready
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(255,255,255,0.015)",
                  color: t.ready ? NEX.text : NEX.textMute,
                  cursor: t.ready ? "pointer" : "not-allowed",
                  opacity: t.ready ? 1 : 0.6,
                  fontFamily: "inherit",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 26, lineHeight: 1 }} aria-hidden>
                  {t.glyph}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {t.label}
                </div>
                {!t.ready && (
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 9,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: NEX.textMute,
                    }}
                  >
                    Coming soon
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 1b · Sub-type dropdown · dark-background ────────────── */}
      {needsSubtype && activeTile?.subtypes && (
        <section
          data-nex-business-welcome-subtypes={pickedCategory}
          style={{
            padding: "12px 12px 14px",
            borderRadius: 10,
            background: "rgba(2, 9, 20, 0.5)",
            border: `1px solid ${NEX.panelBorder}`,
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: 11,
              color: NEX.textDim,
              marginBottom: 8,
              textAlign: "left",
            }}
          >
            Pick the closest match
          </label>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <select
              value={pickedSubtype ?? ""}
              onChange={(e) => {
                const next = e.target.value;
                setPickedSubtype(next.length > 0 ? next : null);
              }}
              disabled={submitting}
              data-nex-business-welcome-subtype-select
              style={{
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                width: "100%",
                padding: "12px 40px 12px 14px",
                background: "#020914",
                color: pickedSubtype ? NEX.text : NEX.textMute,
                fontSize: 14,
                fontWeight: 700,
                border: `1px solid ${pickedSubtype ? NEX.cyanSoft : NEX.panelBorder}`,
                borderRadius: 10,
                outline: "none",
                fontFamily: "inherit",
                cursor: "pointer",
                boxSizing: "border-box",
              }}
            >
              <option value="" disabled hidden style={{ background: "#020914", color: NEX.textMute }}>
                Choose your accommodation type…
              </option>
              {activeTile.subtypes.map((s) => (
                <option
                  key={s.subtype}
                  value={s.ready ? s.subtype : ""}
                  disabled={!s.ready}
                  style={{
                    background: "#020914",
                    color: s.ready ? NEX.text : NEX.textMute,
                  }}
                >
                  {s.ready ? s.label : `${s.label} · Coming soon`}
                </option>
              ))}
            </select>
            {/* Caret glyph · absolute-positioned so it sits above the
                native select without blocking clicks (pointer-events
                none). */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                right: 14,
                color: NEX.cyan,
                fontSize: 12,
                pointerEvents: "none",
              }}
            >
              ▾
            </span>
          </div>
          {/* Rooms count · owner directive 2026-10-21 iteration 12 ·
              accommodation-only follow-up inside the sub-type reveal.
              Optional · doesn't gate submission. */}
          <label style={{ display: "block", marginTop: 12 }}>
            <span
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                color: NEX.textDim,
                marginBottom: 4,
                letterSpacing: "0.03em",
              }}
            >
              Number of rooms · optional
            </span>
            <input
              type="number"
              inputMode="numeric"
              value={rooms}
              onChange={(e) => setRooms(e.target.value)}
              min={WELCOME_BUSINESS_ROOMS_MIN}
              max={WELCOME_BUSINESS_ROOMS_MAX}
              step={1}
              disabled={submitting}
              placeholder={`${WELCOME_BUSINESS_ROOMS_MIN}–${WELCOME_BUSINESS_ROOMS_MAX}`}
              data-nex-business-welcome-rooms
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "rgba(6,15,28,0.9)",
                color: NEX.text,
                fontSize: 14,
                border: `1px solid ${NEX.panelBorder}`,
                borderRadius: 10,
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </label>
        </section>
      )}

      {/* ── 2 · Shop name + bio-link preview ──────────────────── */}
      {/* Owner directive 2026-10-21 (iteration 6) · when the picked
          category is Accommodation, the step label flips from
          "Shop Name" → "Trading Name" (the accommodation industry
          term). The underlying form field, cookie, and server
          validator are unchanged · it's a pure label swap. */}
      <section>
        <SectionLabel
          step="2"
          title={pickedCategory === "accommodation" ? "Trading Name" : "Shop Name"}
          complete={step2Complete}
        />
        <input
          type="text"
          name="shop-name-visible"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          maxLength={WELCOME_BUSINESS_SHOP_NAME_MAX_LENGTH}
          disabled={submitting}
          placeholder="e.g. Villa Mango · Warung Melati · Hammerex Rentals"
          data-nex-business-welcome-shop-name
          style={{
            width: "100%",
            padding: "12px 14px",
            background: "rgba(6,15,28,0.9)",
            color: NEX.text,
            fontSize: 14,
            border: `1px solid ${NEX.panelBorder}`,
            borderRadius: 10,
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
        <p
          style={{
            margin: "6px 2px 0",
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.4,
          }}
        >
          Main Name Users will see
        </p>
        {/* Live bio-link preview container · reads the slug derived
            from the shop name above (shared `shopNameToSlug`). Shows
            a muted placeholder when the slug is empty. */}
        <div
          data-nex-business-welcome-bio-link
          data-nex-business-welcome-bio-link-empty={shopSlug.length === 0 ? "true" : "false"}
          style={{
            marginTop: 8,
            padding: "10px 14px",
            background: "rgba(0,175,255,0.06)",
            border: `1px dashed ${NEX.panelBorder}`,
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        >
          {/* Row 1 · "Your bio link:" header on the left · Copy
              button on the right. The copy button is disabled until
              the shop name slugs to a non-empty handle. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: "-0.005em",
                color: NEX.text,
                fontFamily: "inherit",
              }}
            >
              Your bio link:
            </span>
            <button
              type="button"
              onClick={handleCopyBioLink}
              disabled={!canCopyBioLink}
              aria-label={
                canCopyBioLink
                  ? `Copy ${bioLinkFull} to clipboard`
                  : "Enter a shop name to copy your bio link"
              }
              data-nex-business-welcome-bio-link-copy
              data-nex-business-welcome-bio-link-copied={copied ? "true" : "false"}
              style={{
                padding: "6px 14px",
                background: copied
                  ? "#16D66B"
                  : canCopyBioLink
                    ? NEX.orange
                    : "rgba(255,255,255,0.05)",
                color: copied
                  ? "#0A1A0A"
                  : canCopyBioLink
                    ? "#1A0808"
                    : NEX.textMute,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                border: `1px solid ${
                  copied
                    ? "#16D66B"
                    : canCopyBioLink
                      ? NEX.orangeSoft
                      : NEX.panelBorder
                }`,
                borderRadius: 8,
                cursor: canCopyBioLink ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                transition: "background 160ms ease, color 160ms ease, border-color 160ms ease",
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {/* Row 2 · URL full-width (base + slug contiguous) */}
          <span
            style={{
              display: "inline-flex",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontSize: 13,
              minWidth: 0,
            }}
          >
            <span style={{ color: NEX.textDim }}>
              {WELCOME_BUSINESS_BIO_LINK_BASE}/
            </span>
            <span style={{ color: shopSlug.length > 0 ? NEX.cyan : NEX.textMute }}>
              {shopSlug.length > 0 ? shopSlug : "your-shop-name"}
            </span>
          </span>
        </div>
        <p
          style={{
            margin: "6px 2px 0",
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.4,
          }}
        >
          Share on social media
        </p>
      </section>

      {/* ── 3 · Business Location · browser geolocation ──────── */}
      {/* Owner directive 2026-10-21 (iteration 7) · Location is now
          captured via the browser geolocation API (navigator.geolocation
          .getCurrentPosition). First tap triggers the permission prompt.
          On success we attempt a reverse geocode via OpenStreetMap
          Nominatim for a human-readable address · fall back to raw
          coordinates if that fails. The user can reset at any time
          and request a fresh capture. The underlying form field (name
          "location") and server validator are unchanged. */}
      <section>
        <SectionLabel step="3" title="Business Location" complete={step3Complete} />
        {location.length === 0 ? (
          <button
            type="button"
            onClick={handleRequestLocation}
            disabled={locating || submitting}
            data-nex-business-welcome-location-request
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              padding: "12px 14px",
              background: locating ? "rgba(255,255,255,0.05)" : NEX.orange,
              color: locating ? NEX.textMute : "#1A0808",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.02em",
              border: `1px solid ${locating ? NEX.panelBorder : NEX.orangeSoft}`,
              borderRadius: 10,
              cursor: locating ? "wait" : "pointer",
              fontFamily: "inherit",
            }}
          >
            <span aria-hidden style={{ fontSize: 15 }}>📍</span>
            {locating ? "Locating…" : "Use my current location"}
          </button>
        ) : (
          <div
            data-nex-business-welcome-location-captured
            style={{
              padding: "12px 14px",
              background: "rgba(0,175,255,0.06)",
              border: `1px solid ${NEX.cyanSoft}`,
              borderRadius: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: NEX.textMute,
                    marginBottom: 4,
                  }}
                >
                  Captured location
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: NEX.text,
                    lineHeight: 1.45,
                    wordBreak: "break-word",
                  }}
                >
                  {location}
                </div>
                {coords && (
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 10,
                      color: NEX.textMute,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    }}
                  >
                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleResetLocation}
                disabled={submitting}
                data-nex-business-welcome-location-reset
                style={{
                  padding: "6px 12px",
                  background: "transparent",
                  color: NEX.cyan,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  border: `1px solid ${NEX.cyanSoft}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                Reset
              </button>
            </div>
          </div>
        )}
        {locationError && (
          <div
            role="alert"
            data-nex-business-welcome-location-error
            style={{
              marginTop: 8,
              padding: "8px 12px",
              background: "rgba(244,106,106,0.12)",
              border: `1px solid ${NEX.danger}`,
              borderRadius: 8,
              color: NEX.danger,
              fontSize: 11.5,
              lineHeight: 1.4,
            }}
          >
            {locationError}
          </div>
        )}
        <p
          style={{
            margin: "6px 2px 0",
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.4,
          }}
        >
          Shows in Business Directory · location search
        </p>
      </section>

      {/* ── 4 · Opening Hours ──────────────────────────────────── */}
      {/* Owner directive 2026-10-21 (iteration 8) · Opening + closing
          time for the business. Two HH:MM time inputs. Both required ·
          same server validator guards HH:MM shape. Business hours get
          their own cookie (nex_welcome_business_hours) as JSON for
          downstream signup to seed nex_business_hours. */}
      <section>
        <SectionLabel step="4" title="Time" complete={step4Complete} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <label style={{ display: "block" }}>
            <span
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                color: NEX.textDim,
                marginBottom: 4,
                letterSpacing: "0.03em",
              }}
            >
              Open
            </span>
            <input
              type="time"
              value={openTime}
              onChange={(e) => setOpenTime(e.target.value)}
              disabled={submitting}
              data-nex-business-welcome-open-time
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "rgba(6,15,28,0.9)",
                color: NEX.text,
                fontSize: 14,
                border: `1px solid ${NEX.panelBorder}`,
                borderRadius: 10,
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
                colorScheme: "dark",
              }}
            />
          </label>
          <label style={{ display: "block" }}>
            <span
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                color: NEX.textDim,
                marginBottom: 4,
                letterSpacing: "0.03em",
              }}
            >
              Close
            </span>
            <input
              type="time"
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
              disabled={submitting}
              data-nex-business-welcome-close-time
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "rgba(6,15,28,0.9)",
                color: NEX.text,
                fontSize: 14,
                border: `1px solid ${NEX.panelBorder}`,
                borderRadius: 10,
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
                colorScheme: "dark",
              }}
            />
          </label>
        </div>
        <p
          style={{
            margin: "6px 2px 0",
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.4,
          }}
        >
          For 24/7 availability set 00:00 to 23:59.
        </p>
      </section>

      {/* ── 5 · Top Facilities · owner picks up to 4 ───────────── */}
      {/* Owner directive 2026-10-21 (iteration 9) · owners pick up to
          4 "most important" amenities from the sealed 12-item
          catalogue. Grid of icon + label tiles. Each tile toggles.
          When the cap is hit, further taps are ignored silently.
          Server validator enforces token membership + max 4. */}
      <section>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: NEX.cyan,
                fontWeight: 800,
              }}
            >
              Step 5
            </div>
            <h2
              style={{
                margin: "4px 0 0",
                fontSize: 18,
                fontWeight: 800,
                color: NEX.text,
                letterSpacing: "-0.01em",
              }}
            >
              Top Facilities
            </h2>
          </div>
          {step5Complete && <StepCompleteTick step="5" />}
        </div>
        <p
          style={{
            margin: "-4px 2px 10px",
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.4,
          }}
        >
          Choose 4 Services provided
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 8,
          }}
        >
          {WELCOME_BUSINESS_FACILITY_CATALOGUE.map((f) => {
            const isPicked = facilities.includes(f.token);
            const atCap =
              !isPicked &&
              facilities.length >= WELCOME_BUSINESS_FACILITIES_MAX_COUNT;
            return (
              <button
                key={f.token}
                type="button"
                onClick={() => toggleFacility(f.token)}
                disabled={submitting || atCap}
                aria-pressed={isPicked}
                data-nex-business-welcome-facility={f.token}
                data-nex-business-welcome-facility-picked={isPicked ? "true" : "false"}
                style={{
                  padding: "10px 4px",
                  borderRadius: 10,
                  background: isPicked
                    ? "rgba(0,175,255,0.14)"
                    : atCap
                      ? "rgba(255,255,255,0.015)"
                      : "rgba(255,255,255,0.04)",
                  color: isPicked ? NEX.text : atCap ? NEX.textMute : NEX.text,
                  border: `1px solid ${
                    isPicked ? NEX.cyan : NEX.panelBorder
                  }`,
                  cursor: submitting ? "default" : atCap ? "not-allowed" : "pointer",
                  opacity: atCap ? 0.55 : 1,
                  fontFamily: "inherit",
                  textAlign: "center",
                  minWidth: 0,
                }}
              >
                <div style={{ fontSize: 20, lineHeight: 1 }} aria-hidden>
                  {f.glyph}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: "-0.002em",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f.label}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 6 · Description · optional ────────────────────────── */}
      {/* Owner directive 2026-10-21 iteration 12 · short public blurb
          shown on the shop page before per-room descriptions get
          filled in via /manage/accommodation. Optional · doesn't gate
          submission. */}
      <section>
        <SectionLabel step="6" title="Description" />
        <p
          style={{
            margin: "-4px 2px 8px",
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.4,
          }}
        >
          Describe your place in your own words
        </p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={WELCOME_BUSINESS_DESCRIPTION_MAX_LENGTH}
          disabled={submitting}
          rows={3}
          placeholder="A 1-2 sentence intro customers will read first · optional."
          data-nex-business-welcome-description
          style={{
            width: "100%",
            padding: "10px 14px",
            background: "rgba(6,15,28,0.9)",
            color: NEX.text,
            fontSize: 13.5,
            lineHeight: 1.4,
            border: `1px solid ${NEX.panelBorder}`,
            borderRadius: 10,
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
            resize: "vertical",
            minHeight: 72,
          }}
        />
        <p
          style={{
            margin: "6px 2px 0",
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.4,
          }}
        >
          {description.length}/{WELCOME_BUSINESS_DESCRIPTION_MAX_LENGTH} chars
        </p>
      </section>

      {/* ── 7 · Social & Website · optional ───────────────────── */}
      {/* Owner directive 2026-10-21 iteration 12 · 4 optional links.
          Server does liberal URL/handle validation. Cover-themes-library
          + pick-cover pages do NOT collect these fields (confirmed) ·
          this is the first capture point. */}
      <section>
        <SectionLabel step="7" title="Social & Website" />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <SocialInput
            name="social_instagram"
            value={socialInstagram}
            onChange={setSocialInstagram}
            disabled={submitting}
            glyph="📷"
            label="Instagram"
            placeholder="https://instagram.com/your-shop"
          />
          <SocialInput
            name="social_facebook"
            value={socialFacebook}
            onChange={setSocialFacebook}
            disabled={submitting}
            glyph="📘"
            label="Facebook"
            placeholder="https://facebook.com/your-shop"
          />
          <SocialInput
            name="social_tiktok"
            value={socialTiktok}
            onChange={setSocialTiktok}
            disabled={submitting}
            glyph="🎵"
            label="TikTok"
            placeholder="https://tiktok.com/@your-shop"
          />
          <SocialInput
            name="social_website"
            value={socialWebsite}
            onChange={setSocialWebsite}
            disabled={submitting}
            glyph="🌐"
            label="Website"
            placeholder="https://yourwebsite.com"
          />
        </div>
        <p
          style={{
            margin: "8px 2px 0",
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.4,
          }}
        >
          All optional · leave blank to skip.
        </p>
      </section>

      {/* ── Error banner ────────────────────────────────────────── */}
      {error && (
        <div
          role="alert"
          data-nex-business-welcome-error
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(244,106,106,0.12)",
            border: `1px solid ${NEX.danger}`,
            color: NEX.danger,
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}

      {/* ── Submit ──────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={!canSubmit}
        data-nex-business-welcome-submit
        style={{
          padding: "14px 18px",
          background: canSubmit ? NEX.orange : "rgba(255,255,255,0.08)",
          color: canSubmit ? "#1A0808" : NEX.textMute,
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "0.02em",
          border: `1px solid ${canSubmit ? NEX.orangeSoft : NEX.panelBorder}`,
          borderRadius: 12,
          cursor: canSubmit ? "pointer" : "not-allowed",
          fontFamily: "inherit",
        }}
      >
        {submitting ? "Saving…" : "Continue to signup"}
      </button>

      <p
        data-nex-business-welcome-footer
        style={{
          margin: 0,
          fontSize: 10,
          color: NEX.textMute,
          textAlign: "center",
          lineHeight: 1.4,
          opacity: 0.85,
          letterSpacing: "0.05em",
        }}
      >
        Powered By Nex Network
      </p>
    </form>
  );
}

function SectionLabel({
  step,
  title,
  complete = false,
}: {
  step: string;
  title: string;
  complete?: boolean;
}): React.JSX.Element {
  return (
    <div
      style={{
        marginBottom: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 800,
          }}
        >
          Step {step}
        </div>
        <h2
          style={{
            margin: "4px 0 0",
            fontSize: 18,
            fontWeight: 800,
            color: NEX.text,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h2>
      </div>
      {complete && <StepCompleteTick step={step} />}
    </div>
  );
}

function SocialInput({
  name,
  value,
  onChange,
  disabled,
  glyph,
  label,
  placeholder,
}: {
  name: string;
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
  glyph: string;
  label: string;
  placeholder: string;
}): React.JSX.Element {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 0 0 2px",
      }}
    >
      <span
        aria-hidden
        style={{
          fontSize: 18,
          width: 24,
          display: "inline-flex",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {glyph}
      </span>
      <span style={{ position: "relative", flex: 1, minWidth: 0 }}>
        <input
          type="url"
          name={`${name}-visible`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          maxLength={WELCOME_BUSINESS_SOCIAL_URL_MAX_LENGTH}
          placeholder={placeholder}
          aria-label={label}
          data-nex-business-welcome-social={name}
          style={{
            width: "100%",
            padding: "10px 14px",
            background: "rgba(6,15,28,0.9)",
            color: NEX.text,
            fontSize: 13,
            border: `1px solid ${NEX.panelBorder}`,
            borderRadius: 10,
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
      </span>
    </label>
  );
}

function StepCompleteTick({ step }: { step: string }): React.JSX.Element {
  return (
    <div
      role="status"
      aria-label={`Step ${step} complete`}
      data-nex-business-welcome-step-complete={step}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        borderRadius: "50%",
        background: "#16D66B",
        color: "#0A1A0A",
        fontSize: 14,
        fontWeight: 900,
        lineHeight: 1,
        flexShrink: 0,
        boxShadow:
          "0 0 0 2px rgba(22,214,107,0.22), 0 2px 8px rgba(22,214,107,0.35)",
      }}
    >
      ✓
    </div>
  );
}
