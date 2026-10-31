"use client";

// src/app/nex-native/delivery-prototype/_delivery-client.tsx
//
// Owner directive 2026-10-22 · delivery pricing prototype · interactive
// client. Prototype only · localStorage persistence · no server actions.
// When graduated to production this UI threads to:
//   · schema migration (nex_business_delivery_policy + _zone)
//   · server action updateDeliveryPolicyAction (gated by assertOwner)
//   · populates existing NexPeerCartOrderSnapshot.delivery_quote
//     field on checkout (ALREADY exists in peer-message-service.ts
//     per 2026-10-22 cart audit)

import * as React from "react";
import {
  INDONESIA_PROVINCES,
  PERMENHUB_OJOL_ZONES,
  DELIVERY_TIME_PRESETS,
  DELIVERY_SIZE_TIERS,
  BIKE_TIME_ESTIMATES,
  type DeliveryTimePreset,
  type DeliverySizeTier,
  type BikeTimeEstimate,
  type IndonesiaProvince,
} from "./_indonesia-data";

// ─── NEX design tokens (inlined per admin surface convention) ─────
const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "#050f1e",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.14)",
  cyanBorder: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  orangeInk: "#1A0808",
  green: "#16D66B",
  amber: "#F59E0B",
  red: "#FF3355",
} as const;

const NEX_FONT_SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// ─── Policy shape ──────────────────────────────────────────────────
interface DeliveryZoneRow {
  readonly id: string;
  readonly provinceCode: string;
  readonly cityName: string | null; // null = whole province
  readonly priceIdr: number;
  readonly deliveryTime: DeliveryTimePreset;
  readonly sizeTier: DeliverySizeTier | null; // null = flat (no size tiers)
  readonly notes: string;
}

interface DeliveryPolicy {
  readonly countryCode: "ID";
  readonly sellerProvinceCode: string;
  /** Owner directive 2026-10-22 · free-text pickup address shown on the
   *  shop page's Visit Us panel. Indonesian addresses are often informal
   *  ("Jl. Melati, dekat warung Pak Bud") so this is intentionally free
   *  text · no geocoding gate. The GPS lat/lng below is the authoritative
   *  ground truth for distance math. */
  readonly pickupAddress: string;
  /** Owner directive 2026-10-22 · ground-truth coordinates captured via
   *  navigator.geolocation. Null until the seller taps "Set my business
   *  location". When null, bike delivery section shows a warning and
   *  distance-based price computation is unavailable. */
  readonly locationLat: number | null;
  readonly locationLng: number | null;
  readonly locationAccuracyMeters: number | null;
  readonly locationVerifiedAt: number | null;
  readonly pickupOnly: boolean;
  readonly offersBike: boolean;
  readonly bikePricePerKmIdr: number;
  readonly bikeMaxDistanceKm: number;
  readonly bikeTimeEstimate: BikeTimeEstimate;
  readonly offersCargo: boolean;
  readonly cargoZones: readonly DeliveryZoneRow[];
  readonly policyUpdatedAt: number;
}

const STORAGE_KEY = "nex-delivery-prototype-policy-v1";

function defaultPolicy(): DeliveryPolicy {
  return {
    countryCode: "ID",
    sellerProvinceCode: "ID-JK", // Jakarta default
    pickupAddress: "",
    locationLat: null,
    locationLng: null,
    locationAccuracyMeters: null,
    locationVerifiedAt: null,
    pickupOnly: false,
    offersBike: true,
    bikePricePerKmIdr: PERMENHUB_OJOL_ZONES.II.batasAtasPerKmIdr, // mid of range
    bikeMaxDistanceKm: 15,
    bikeTimeEstimate: "20-40-min",
    offersCargo: true,
    cargoZones: [
      {
        id: cryptoId(),
        provinceCode: "ID-JK",
        cityName: null,
        priceIdr: 20000,
        deliveryTime: "1-2-days",
        sizeTier: null,
        notes: "",
      },
      {
        id: cryptoId(),
        provinceCode: "ID-JB",
        cityName: null,
        priceIdr: 25000,
        deliveryTime: "2-5-days",
        sizeTier: null,
        notes: "",
      },
      {
        id: cryptoId(),
        provinceCode: "ID-BA",
        cityName: null,
        priceIdr: 50000,
        deliveryTime: "2-5-days",
        sizeTier: null,
        notes: "",
      },
    ],
    policyUpdatedAt: Date.now(),
  };
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `zone-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

function formatIdr(amount: number): string {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `Rp ${amount.toLocaleString("id-ID")}`;
  }
}

// ─── Main client component ─────────────────────────────────────────
export function DeliveryPrototypeClient(): React.JSX.Element {
  const [policy, setPolicy] = React.useState<DeliveryPolicy>(defaultPolicy);
  const [savedToast, setSavedToast] = React.useState<string | null>(null);

  // Hydrate from localStorage on mount.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DeliveryPolicy;
      if (parsed && typeof parsed === "object" && parsed.countryCode === "ID") {
        setPolicy(parsed);
      }
    } catch {
      /* corrupt storage · fall back to default */
    }
  }, []);

  const sellerProvince = React.useMemo(
    () =>
      INDONESIA_PROVINCES.find((p) => p.code === policy.sellerProvinceCode) ??
      INDONESIA_PROVINCES[0],
    [policy.sellerProvinceCode],
  );
  const sellerOjolZone = PERMENHUB_OJOL_ZONES[sellerProvince.ojolZone];

  const handleSave = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const next = { ...policy, policyUpdatedAt: Date.now() };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setPolicy(next);
      setSavedToast("Policy saved · prototype localStorage only");
      window.setTimeout(() => setSavedToast(null), 2400);
    } catch {
      setSavedToast("Save failed · storage denied");
      window.setTimeout(() => setSavedToast(null), 2400);
    }
  }, [policy]);

  const handleDiscard = React.useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
    setPolicy(defaultPolicy());
    setSavedToast("Policy reset to defaults");
    window.setTimeout(() => setSavedToast(null), 2400);
  }, []);

  const addZone = React.useCallback(() => {
    setPolicy((p) => ({
      ...p,
      cargoZones: [
        ...p.cargoZones,
        {
          id: cryptoId(),
          provinceCode: "ID-JT",
          cityName: null,
          priceIdr: 20000,
          deliveryTime: "2-5-days",
          sizeTier: null,
          notes: "",
        },
      ],
    }));
  }, []);

  const updateZone = React.useCallback(
    (id: string, patch: Partial<DeliveryZoneRow>) => {
      setPolicy((p) => ({
        ...p,
        cargoZones: p.cargoZones.map((z) =>
          z.id === id ? { ...z, ...patch } : z,
        ),
      }));
    },
    [],
  );

  const removeZone = React.useCallback((id: string) => {
    setPolicy((p) => ({
      ...p,
      cargoZones: p.cargoZones.filter((z) => z.id !== id),
    }));
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: NEX_FONT_SANS,
        padding: "20px 16px 120px",
        boxSizing: "border-box",
        overflowX: "hidden",
        width: "100%",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
        <PrototypeBanner />

        <Header policy={policy} sellerProvince={sellerProvince} />

        <Section
          title="Business basics"
          subtitle="Where you ship from · drives the regulated per-km anchor"
        >
          <Field label="Country">
            <StaticValue>Indonesia</StaticValue>
          </Field>
          <Field
            label="Your province"
            hint="Override if GPS lands in the wrong one (e.g. you're home but your shop is next door)"
          >
            <Select
              value={policy.sellerProvinceCode}
              onChange={(v) =>
                setPolicy((p) => ({ ...p, sellerProvinceCode: v }))
              }
              options={INDONESIA_PROVINCES.map((p) => ({
                value: p.code,
                label: `${p.name} · ${p.group}`,
              }))}
            />
          </Field>
          <Field
            label="Pickup address"
            hint="Shown on your shop page · informal is fine (nearby landmarks, 'behind X', etc.)"
          >
            <textarea
              value={policy.pickupAddress}
              onChange={(e) =>
                setPolicy((p) => ({
                  ...p,
                  pickupAddress: e.currentTarget.value,
                }))
              }
              placeholder="e.g. Jl. Sudirman No. 1, Jakarta Pusat · behind the Starbucks"
              rows={3}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: NEX.panel,
                border: `1px solid ${NEX.borderStrong}`,
                color: NEX.text,
                fontSize: 13,
                fontFamily: NEX_FONT_SANS,
                outline: "none",
                width: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                resize: "vertical",
                lineHeight: 1.5,
              }}
            />
          </Field>
          <Field
            label="Business location (GPS)"
            hint="The ground truth for bike-distance math and pickup directions · you can re-verify anytime"
          >
            <LocationBlock policy={policy} setPolicy={setPolicy} />
          </Field>
        </Section>

        <Section
          title="Policy"
          subtitle="Toggle this if you don't deliver at all"
        >
          <Checkbox
            checked={policy.pickupOnly}
            onChange={(checked) =>
              setPolicy((p) => ({ ...p, pickupOnly: checked }))
            }
            label="Pickup only · buyer collects from my location"
            hint="Overrides bike + cargo sections below. Shop page shows pickup address + hours only."
          />
        </Section>

        {!policy.pickupOnly && (
          <>
            <Section
              title="Bike delivery · local"
              subtitle="Delivery local"
            >
              <Checkbox
                checked={policy.offersBike}
                onChange={(checked) =>
                  setPolicy((p) => ({ ...p, offersBike: checked }))
                }
                label="I offer local bike delivery"
              />
              {policy.offersBike && (
                <BikeSection policy={policy} setPolicy={setPolicy} />
              )}
            </Section>

            <Section
              title="Intercity cargo"
              subtitle="JNT · JNE · SiCepat · Pos · set your own price per province"
            >
              <Checkbox
                checked={policy.offersCargo}
                onChange={(checked) =>
                  setPolicy((p) => ({ ...p, offersCargo: checked }))
                }
                label="I offer intercity shipping"
              />
              {policy.offersCargo && (
                <CargoSection
                  zones={policy.cargoZones}
                  onAdd={addZone}
                  onUpdate={updateZone}
                  onRemove={removeZone}
                />
              )}
            </Section>
          </>
        )}

        <Section
          title="Checkout preview"
          subtitle="What the buyer sees · what the seller receives"
        >
          <CheckoutPreview policy={policy} />
        </Section>

        <SaveBar
          onSave={handleSave}
          onDiscard={handleDiscard}
          savedToast={savedToast}
        />

        <Honesty />
      </div>
    </main>
  );
}

// ─── Section primitives ────────────────────────────────────────────
function PrototypeBanner(): React.JSX.Element {
  return (
    <div
      style={{
        marginBottom: 16,
        padding: "10px 14px",
        borderRadius: 10,
        background: "rgba(245, 158, 11, 0.14)",
        border: `1px solid rgba(245, 158, 11, 0.42)`,
        color: NEX.amber,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.2,
      }}
    >
      PROTOTYPE · localStorage only · nothing saved to database. Owner-review
      surface for the delivery pricing architecture.
    </div>
  );
}

function Header({
  policy,
  sellerProvince,
}: {
  readonly policy: DeliveryPolicy;
  readonly sellerProvince: IndonesiaProvince;
}): React.JSX.Element {
  return (
    <header style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.5,
          color: NEX.cyan,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        Seller admin · prototype
      </div>
      <h1
        style={{
          margin: 0,
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: -0.3,
          color: NEX.text,
        }}
      >
        Delivery pricing
      </h1>
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 13,
          color: NEX.textDim,
          lineHeight: 1.5,
        }}
      >
        Shipping from {sellerProvince.name} · Policy last saved{" "}
        {new Date(policy.policyUpdatedAt).toLocaleDateString("en-GB")}
      </p>
    </header>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      style={{
        marginBottom: 20,
        padding: 16,
        borderRadius: 14,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
        boxSizing: "border-box",
        width: "100%",
        minWidth: 0,
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 800,
            color: NEX.text,
            letterSpacing: -0.1,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: "3px 0 0",
            fontSize: 12,
            color: NEX.textMute,
          }}
        >
          {subtitle}
        </p>
      </div>
      <div style={{ display: "grid", gap: 12 }}>{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: NEX.textDim,
          letterSpacing: 0.3,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {children}
      {hint && (
        <span
          style={{
            fontSize: 11,
            color: NEX.textMute,
            marginTop: -2,
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

function StaticValue({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: "9px 12px",
        borderRadius: 10,
        background: NEX.cyanSoft,
        border: `1px solid ${NEX.cyanBorder}`,
        color: NEX.text,
        fontSize: 13,
        fontWeight: 600,
        boxSizing: "border-box",
        wordBreak: "break-word",
        lineHeight: 1.4,
      }}
    >
      {children}
    </div>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  readonly value: T;
  readonly onChange: (next: T) => void;
  readonly options: ReadonlyArray<{ value: T; label: string }>;
}): React.JSX.Element {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.currentTarget.value as T)}
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        background: NEX.panel,
        border: `1px solid ${NEX.borderStrong}`,
        color: NEX.text,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: NEX_FONT_SANS,
        width: "100%",
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ background: NEX.panel }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  prefix,
}: {
  readonly value: number;
  readonly onChange: (next: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly prefix?: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 12px",
        borderRadius: 10,
        background: NEX.panel,
        border: `1px solid ${NEX.borderStrong}`,
        boxSizing: "border-box",
        width: "100%",
        minWidth: 0,
      }}
    >
      {prefix && (
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: NEX.textDim,
            flexShrink: 0,
          }}
        >
          {prefix}
        </span>
      )}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.currentTarget.value) || 0)}
        style={{
          flex: 1,
          minWidth: 0,
          width: "100%",
          padding: "8px 0",
          background: "transparent",
          border: "none",
          color: NEX.text,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: NEX_FONT_SANS,
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
  hint,
}: {
  readonly checked: boolean;
  readonly onChange: (next: boolean) => void;
  readonly label: string;
  readonly hint?: string;
}): React.JSX.Element {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
        style={{
          marginTop: 2,
          width: 18,
          height: 18,
          accentColor: NEX.cyan,
        }}
      />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: NEX.text }}>
          {label}
        </div>
        {hint && (
          <div
            style={{
              fontSize: 11,
              color: NEX.textMute,
              marginTop: 2,
            }}
          >
            {hint}
          </div>
        )}
      </div>
    </label>
  );
}

// ─── Location block (province · address · GPS verification) ──────
type LocationStatus =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "error"; message: string };

type ReverseGeocodeState =
  | { kind: "idle" }
  | { kind: "resolving" }
  | { kind: "ready"; address: string }
  | { kind: "unavailable" };

/** OpenStreetMap Nominatim reverse geocode · free · public server
 *  rate-limited to 1 req/sec (fine for a one-time seller save). CORS
 *  is open from any origin on this endpoint. Language set to id (Bahasa
 *  Indonesia) so returned labels read naturally for Indonesian sellers.
 *  Honest fallback: on any error (network, rate limit, no result) we
 *  return null and the UI silently hides the suggestion panel · the
 *  seller can still save with a self-written address. */
async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&accept-language=id`;
    const resp = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { display_name?: unknown };
    if (typeof data.display_name !== "string") return null;
    const trimmed = data.display_name.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function LocationBlock({
  policy,
  setPolicy,
}: {
  readonly policy: DeliveryPolicy;
  readonly setPolicy: React.Dispatch<React.SetStateAction<DeliveryPolicy>>;
}): React.JSX.Element {
  const [status, setStatus] = React.useState<LocationStatus>({ kind: "idle" });
  const [geocode, setGeocode] = React.useState<ReverseGeocodeState>({
    kind: "idle",
  });

  const isVerified =
    policy.locationLat !== null && policy.locationLng !== null;

  const handleGeolocate = React.useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus({
        kind: "error",
        message:
          "This browser doesn't support location services · you can still save without GPS.",
      });
      return;
    }
    setStatus({ kind: "pending" });
    setGeocode({ kind: "idle" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setPolicy((p) => ({
          ...p,
          locationLat: latitude,
          locationLng: longitude,
          locationAccuracyMeters: Math.round(accuracy),
          locationVerifiedAt: Date.now(),
        }));
        setStatus({ kind: "idle" });
        // Kick off reverse geocode · honest-null on failure.
        setGeocode({ kind: "resolving" });
        void reverseGeocode(latitude, longitude).then((address) => {
          if (address) {
            setGeocode({ kind: "ready", address });
          } else {
            setGeocode({ kind: "unavailable" });
          }
        });
      },
      (error) => {
        let message = "Could not get your location.";
        if (error.code === error.PERMISSION_DENIED) {
          message =
            "Location permission denied · allow it in your browser settings or save without GPS.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message =
            "Your device couldn't determine its position · try again outside or save without GPS.";
        } else if (error.code === error.TIMEOUT) {
          message = "Location request timed out · try again.";
        }
        setStatus({ kind: "error", message });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [setPolicy]);

  const handleClear = React.useCallback(() => {
    setPolicy((p) => ({
      ...p,
      locationLat: null,
      locationLng: null,
      locationAccuracyMeters: null,
      locationVerifiedAt: null,
    }));
    setStatus({ kind: "idle" });
    setGeocode({ kind: "idle" });
  }, [setPolicy]);

  const handleUseSuggestion = React.useCallback(
    (address: string) => {
      setPolicy((p) => ({ ...p, pickupAddress: address }));
      setGeocode({ kind: "idle" });
    },
    [setPolicy],
  );

  const handleDismissSuggestion = React.useCallback(() => {
    setGeocode({ kind: "idle" });
  }, []);

  const verifiedAgo = policy.locationVerifiedAt
    ? formatVerifiedAgo(policy.locationVerifiedAt)
    : null;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          background: isVerified
            ? "rgba(22, 214, 107, 0.08)"
            : "rgba(245, 158, 11, 0.08)",
          border: isVerified
            ? `1px solid rgba(22, 214, 107, 0.42)`
            : `1px solid rgba(245, 158, 11, 0.42)`,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.5,
            color: isVerified ? NEX.green : NEX.amber,
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          {isVerified ? "✓ GPS verified" : "⚠ GPS not verified"}
        </div>
        {isVerified ? (
          <div style={{ fontSize: 12, color: NEX.textDim, lineHeight: 1.5 }}>
            <div style={{ color: NEX.text, fontWeight: 700 }}>
              {policy.locationLat?.toFixed(5)},{" "}
              {policy.locationLng?.toFixed(5)}
            </div>
            Accuracy ±{policy.locationAccuracyMeters ?? "—"}m · verified{" "}
            {verifiedAgo}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: NEX.textDim, lineHeight: 1.5 }}>
            Pickup directions and bike-distance math won't work until you
            confirm your business location.
          </div>
        )}
        {status.kind === "error" && (
          <div
            style={{
              marginTop: 8,
              padding: "6px 10px",
              borderRadius: 8,
              background: "rgba(255, 51, 85, 0.08)",
              border: `1px solid rgba(255, 51, 85, 0.3)`,
              color: NEX.red,
              fontSize: 11,
              lineHeight: 1.4,
            }}
          >
            {status.message}
          </div>
        )}
      </div>

      {/* Owner directive 2026-10-22 · reverse-geocode suggestion panel ·
          fires on every successful GPS fetch. Honest-null: Nominatim
          failures (rate limit, no result, network) silently fall
          through · the seller keeps the manual textarea. */}
      {geocode.kind === "resolving" && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: NEX.cyanSoft,
            border: `1px dashed ${NEX.cyanBorder}`,
            fontSize: 12,
            color: NEX.textDim,
            boxSizing: "border-box",
          }}
        >
          Finding your address from GPS…
        </div>
      )}

      {geocode.kind === "ready" && (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            background: NEX.cyanSoft,
            border: `1px solid ${NEX.cyanBorder}`,
            boxSizing: "border-box",
            display: "grid",
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 0.5,
                color: NEX.cyan,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Suggested address from GPS
            </div>
            <div
              style={{
                fontSize: 13,
                color: NEX.text,
                lineHeight: 1.5,
                wordBreak: "break-word",
              }}
            >
              {geocode.address}
            </div>
            <div
              style={{
                fontSize: 11,
                color: NEX.textMute,
                marginTop: 4,
                lineHeight: 1.4,
              }}
            >
              Based on OpenStreetMap · may differ from your actual
              signage. You can use it as-is or edit the Pickup address
              above.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => handleUseSuggestion(geocode.address)}
              style={{
                flex: "1 1 160px",
                minHeight: 44,
                padding: "0 14px",
                borderRadius: 10,
                background: NEX.cyan,
                color: "#031018",
                border: "none",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 0.3,
                cursor: "pointer",
                fontFamily: NEX_FONT_SANS,
                touchAction: "manipulation",
              }}
            >
              Use this address
            </button>
            <button
              type="button"
              onClick={handleDismissSuggestion}
              style={{
                minHeight: 44,
                padding: "0 14px",
                borderRadius: 10,
                background: "transparent",
                border: `1px solid ${NEX.borderStrong}`,
                color: NEX.textDim,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: NEX_FONT_SANS,
                touchAction: "manipulation",
              }}
            >
              I'll write my own
            </button>
          </div>
        </div>
      )}

      {geocode.kind === "unavailable" && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(245, 158, 11, 0.08)",
            border: `1px solid rgba(245, 158, 11, 0.28)`,
            fontSize: 11,
            color: NEX.textDim,
            lineHeight: 1.5,
            boxSizing: "border-box",
          }}
        >
          <strong style={{ color: NEX.amber }}>
            Address lookup unavailable.
          </strong>{" "}
          GPS coordinates are saved · please write your pickup address
          manually above.
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={handleGeolocate}
          disabled={status.kind === "pending"}
          style={{
            flex: "1 1 220px",
            minHeight: 48,
            padding: "0 16px",
            borderRadius: 12,
            background: isVerified ? NEX.cyanSoft : NEX.cyan,
            border: isVerified
              ? `1px solid ${NEX.cyanBorder}`
              : "none",
            color: isVerified ? NEX.cyan : "#031018",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 0.3,
            cursor: status.kind === "pending" ? "wait" : "pointer",
            opacity: status.kind === "pending" ? 0.6 : 1,
            fontFamily: NEX_FONT_SANS,
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {status.kind === "pending"
            ? "Getting location…"
            : isVerified
              ? "📍 Re-verify my location"
              : "📍 Set my business location"}
        </button>
        {isVerified && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              minHeight: 48,
              padding: "0 16px",
              borderRadius: 12,
              background: "transparent",
              border: `1px solid ${NEX.borderStrong}`,
              color: NEX.textDim,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: NEX_FONT_SANS,
              touchAction: "manipulation",
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function formatVerifiedAgo(ts: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// ─── Bike section ──────────────────────────────────────────────────
function BikeSection({
  policy,
  setPolicy,
}: {
  readonly policy: DeliveryPolicy;
  readonly setPolicy: React.Dispatch<React.SetStateAction<DeliveryPolicy>>;
}): React.JSX.Element {
  return (
    <div style={{ display: "grid", gap: 12, marginTop: 6 }}>
      <Field label="Price per km" hint="Price estimated from Gojek">
        <NumberInput
          value={policy.bikePricePerKmIdr}
          onChange={(v) =>
            setPolicy((p) => ({ ...p, bikePricePerKmIdr: v }))
          }
          min={0}
          prefix="Rp"
        />
      </Field>
      <Field label="Max distance" hint="Gojek typical ceiling: 25 km">
        <NumberInput
          value={policy.bikeMaxDistanceKm}
          onChange={(v) =>
            setPolicy((p) => ({ ...p, bikeMaxDistanceKm: v }))
          }
          min={1}
          max={30}
          prefix="km"
        />
      </Field>
    </div>
  );
}

// ─── Cargo section ─────────────────────────────────────────────────
function CargoSection({
  zones,
  onAdd,
  onUpdate,
  onRemove,
}: {
  readonly zones: readonly DeliveryZoneRow[];
  readonly onAdd: () => void;
  readonly onUpdate: (id: string, patch: Partial<DeliveryZoneRow>) => void;
  readonly onRemove: (id: string) => void;
}): React.JSX.Element {
  return (
    <div style={{ display: "grid", gap: 10, marginTop: 6 }}>
      {zones.length === 0 && (
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            background: NEX.panel,
            border: `1px dashed ${NEX.border}`,
            color: NEX.textMute,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          No zones yet · tap "Add zone" to set your first destination.
        </div>
      )}
      {zones.map((z) => (
        <ZoneRow
          key={z.id}
          zone={z}
          onUpdate={(patch) => onUpdate(z.id, patch)}
          onRemove={() => onRemove(z.id)}
        />
      ))}
      <button
        type="button"
        onClick={onAdd}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          background: NEX.cyanSoft,
          border: `1px solid ${NEX.cyanBorder}`,
          color: NEX.cyan,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: 0.4,
          cursor: "pointer",
          fontFamily: NEX_FONT_SANS,
          textTransform: "uppercase",
        }}
      >
        + Add zone
      </button>
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          background: "rgba(245, 158, 11, 0.08)",
          border: `1px solid rgba(245, 158, 11, 0.28)`,
          fontSize: 11,
          color: NEX.textDim,
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: NEX.amber }}>Fallback behaviour:</strong>{" "}
        buyers in provinces not listed here see "Ask seller about shipping to
        your area" with a chat button · no price shown.
      </div>
    </div>
  );
}

function ZoneRow({
  zone,
  onUpdate,
  onRemove,
}: {
  readonly zone: DeliveryZoneRow;
  readonly onUpdate: (patch: Partial<DeliveryZoneRow>) => void;
  readonly onRemove: () => void;
}): React.JSX.Element {
  const province = INDONESIA_PROVINCES.find((p) => p.code === zone.provinceCode);
  const [showAdvanced, setShowAdvanced] = React.useState<boolean>(
    zone.sizeTier !== null || zone.cityName !== null || zone.notes.length > 0,
  );

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        background: NEX.panel,
        border: `1px solid ${NEX.borderStrong}`,
        boxSizing: "border-box",
        width: "100%",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 10,
          alignItems: "start",
          marginBottom: 10,
        }}
      >
        <Field label="Deliver to">
          <Select
            value={zone.provinceCode}
            onChange={(v) =>
              onUpdate({ provinceCode: v, cityName: null })
            }
            options={INDONESIA_PROVINCES.map((p) => ({
              value: p.code,
              label: `${p.name} · ${p.group}`,
            }))}
          />
        </Field>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove zone"
          style={{
            width: 32,
            height: 32,
            marginTop: 24,
            borderRadius: 8,
            background: "transparent",
            border: `1px solid ${NEX.borderStrong}`,
            color: NEX.red,
            cursor: "pointer",
            fontSize: 16,
            fontWeight: 800,
            lineHeight: 1,
            fontFamily: NEX_FONT_SANS,
          }}
        >
          ×
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 10,
        }}
      >
        <Field label="Price">
          <NumberInput
            value={zone.priceIdr}
            onChange={(v) => onUpdate({ priceIdr: v })}
            min={0}
            prefix="Rp"
          />
        </Field>
        <Field label="Delivery time">
          <Select
            value={zone.deliveryTime}
            onChange={(v) =>
              onUpdate({ deliveryTime: v as DeliveryTimePreset })
            }
            options={(
              Object.keys(DELIVERY_TIME_PRESETS) as DeliveryTimePreset[]
            ).map((k) => ({ value: k, label: DELIVERY_TIME_PRESETS[k].label }))}
          />
        </Field>
      </div>

      {!showAdvanced && (
        <button
          type="button"
          onClick={() => setShowAdvanced(true)}
          style={{
            marginTop: 10,
            padding: "6px 10px",
            borderRadius: 8,
            background: "transparent",
            border: `1px solid ${NEX.border}`,
            color: NEX.textMute,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: NEX_FONT_SANS,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          + City override / size tier / notes
        </button>
      )}

      {showAdvanced && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px dashed ${NEX.border}`,
            display: "grid",
            gap: 10,
          }}
        >
          <Field
            label="City override"
            hint="Leave blank to cover the whole province"
          >
            <Select
              value={zone.cityName ?? ""}
              onChange={(v) => onUpdate({ cityName: v === "" ? null : v })}
              options={[
                { value: "", label: "Whole province" },
                ...(province?.majorCities ?? []).map((c) => ({
                  value: c,
                  label: c,
                })),
              ]}
            />
          </Field>
          <Field label="Size tier" hint="Leave as flat for uniform pricing">
            <Select
              value={zone.sizeTier ?? ""}
              onChange={(v) =>
                onUpdate({ sizeTier: v === "" ? null : (v as DeliverySizeTier) })
              }
              options={[
                { value: "", label: "Flat · one price for any size" },
                ...(Object.keys(DELIVERY_SIZE_TIERS) as DeliverySizeTier[]).map(
                  (k) => ({ value: k, label: DELIVERY_SIZE_TIERS[k].label }),
                ),
              ]}
            />
          </Field>
          <Field label="Notes · optional" hint="Shown to buyer at checkout">
            <input
              type="text"
              value={zone.notes}
              onChange={(e) => onUpdate({ notes: e.currentTarget.value })}
              placeholder="e.g. Cash on delivery available"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: NEX.panel,
                border: `1px solid ${NEX.borderStrong}`,
                color: NEX.text,
                fontSize: 13,
                fontFamily: NEX_FONT_SANS,
                outline: "none",
                width: "100%",
                minWidth: 0,
                boxSizing: "border-box",
              }}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

// ─── Checkout preview ──────────────────────────────────────────────
function CheckoutPreview({
  policy,
}: {
  readonly policy: DeliveryPolicy;
}): React.JSX.Element {
  // Pretend the buyer's cart has one item, Rp 85k, and they live in Bandung.
  const sampleCartIdr = 85000;
  const sampleBuyerProvince = "ID-JB";
  const matchedZone = policy.cargoZones.find(
    (z) => z.provinceCode === sampleBuyerProvince,
  );
  const deliveryIdr = policy.pickupOnly
    ? 0
    : matchedZone?.priceIdr ?? null;
  const totalIdr =
    deliveryIdr === null ? sampleCartIdr : sampleCartIdr + deliveryIdr;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          padding: 14,
          borderRadius: 12,
          background: NEX.panel,
          border: `1px solid ${NEX.borderStrong}`,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.5,
            color: NEX.cyan,
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Buyer sees at checkout
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            marginBottom: 6,
            color: NEX.textDim,
          }}
        >
          <span>Subtotal</span>
          <span>{formatIdr(sampleCartIdr)}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            marginBottom: 6,
            color: NEX.textDim,
          }}
        >
          <span>
            Delivery to Bandung ·{" "}
            {matchedZone
              ? DELIVERY_TIME_PRESETS[matchedZone.deliveryTime].label
              : "—"}
          </span>
          <span>
            {policy.pickupOnly
              ? "Pickup only"
              : deliveryIdr === null
                ? "Ask seller"
                : formatIdr(deliveryIdr)}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 15,
            fontWeight: 800,
            paddingTop: 8,
            marginTop: 6,
            borderTop: `1px solid ${NEX.border}`,
            color: NEX.text,
          }}
        >
          <span>Total</span>
          <span>{formatIdr(totalIdr)}</span>
        </div>
        <div
          style={{
            marginTop: 10,
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(22, 214, 107, 0.08)",
            border: `1px solid rgba(22, 214, 107, 0.3)`,
            fontSize: 11,
            color: NEX.textDim,
          }}
        >
          <strong style={{ color: NEX.green }}>Owner confirms before dispatch</strong>
          {" · "}
          buyer only pays the seller once stock + lead time are confirmed in
          chat.
        </div>
      </div>

      <div
        style={{
          padding: 14,
          borderRadius: 12,
          background: "rgba(255, 114, 0, 0.06)",
          border: `1px solid rgba(255, 114, 0, 0.28)`,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.5,
            color: NEX.orange,
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Seller receives in chat
        </div>
        <ChatBubbleRow who="order-card" cartIdr={sampleCartIdr} deliveryIdr={deliveryIdr} totalIdr={totalIdr} />
        <ChatBubbleRow who="auto" text="Thanks for your order! We are now processing and will confirm dispatch time shortly." />
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.5,
          }}
        >
          Auto-message fires immediately after the order card lands · owner
          then confirms stock + lead time + dispatch window with their own
          follow-up messages.
        </div>
      </div>
    </div>
  );
}

function ChatBubbleRow({
  who,
  text,
  cartIdr,
  deliveryIdr,
  totalIdr,
}: {
  readonly who: "order-card" | "auto";
  readonly text?: string;
  readonly cartIdr?: number;
  readonly deliveryIdr?: number | null;
  readonly totalIdr?: number;
}): React.JSX.Element {
  if (who === "order-card") {
    return (
      <div
        style={{
          marginBottom: 8,
          padding: 10,
          borderRadius: 12,
          background: NEX.panel,
          border: `1px solid ${NEX.borderStrong}`,
          maxWidth: 320,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.5,
            color: NEX.cyan,
            textTransform: "uppercase",
          }}
        >
          🛒 Order from buyer
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: NEX.text,
            marginTop: 4,
          }}
        >
          Cart · {formatIdr(cartIdr ?? 0)} · delivery{" "}
          {deliveryIdr === null ? "pending" : formatIdr(deliveryIdr ?? 0)}
        </div>
        <div
          style={{
            fontSize: 12,
            color: NEX.textDim,
            marginTop: 2,
          }}
        >
          Total {formatIdr(totalIdr ?? 0)} · Deliver to Bandung
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 16,
        background: "rgba(255, 114, 0, 0.14)",
        border: `1px solid rgba(255, 114, 0, 0.42)`,
        color: NEX.text,
        fontSize: 13,
        maxWidth: 320,
        lineHeight: 1.5,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.5,
          color: NEX.orange,
          textTransform: "uppercase",
          marginBottom: 3,
        }}
      >
        🤖 NEX auto-reply · to buyer
      </div>
      {text}
    </div>
  );
}

// ─── Save bar ──────────────────────────────────────────────────────
function SaveBar({
  onSave,
  onDiscard,
  savedToast,
}: {
  readonly onSave: () => void;
  readonly onDiscard: () => void;
  readonly savedToast: string | null;
}): React.JSX.Element {
  return (
    <div
      style={{
        position: "sticky",
        bottom: 16,
        display: "flex",
        gap: 10,
        padding: 12,
        marginTop: 20,
        borderRadius: 14,
        background: "rgba(2, 9, 20, 0.92)",
        border: `1px solid ${NEX.borderStrong}`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        alignItems: "center",
      }}
    >
      <button
        type="button"
        onClick={onSave}
        style={{
          flex: 1,
          minHeight: 48,
          padding: "0 16px",
          borderRadius: 12,
          background: NEX.orange,
          color: "#FFFFFF",
          border: "none",
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: 0.3,
          textShadow: "0 1px 3px rgba(0,0,0,0.55)",
          boxShadow: `0 8px 20px -8px ${NEX.orange}`,
          cursor: "pointer",
          fontFamily: NEX_FONT_SANS,
        }}
      >
        Save policy
      </button>
      <button
        type="button"
        onClick={onDiscard}
        style={{
          minHeight: 48,
          padding: "0 16px",
          borderRadius: 12,
          background: "transparent",
          border: `1px solid ${NEX.borderStrong}`,
          color: NEX.textDim,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: NEX_FONT_SANS,
        }}
      >
        Reset
      </button>
      {savedToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            top: -36,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "8px 14px",
            borderRadius: 999,
            background: "rgba(22, 214, 107, 0.14)",
            border: `1px solid rgba(22, 214, 107, 0.42)`,
            color: NEX.green,
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {savedToast}
        </div>
      )}
    </div>
  );
}

function Honesty(): React.JSX.Element {
  return (
    <div
      style={{
        marginTop: 20,
        padding: 14,
        borderRadius: 12,
        background: NEX.panelSoft,
        border: `1px dashed ${NEX.border}`,
        fontSize: 11,
        color: NEX.textMute,
        lineHeight: 1.6,
      }}
    >
      <strong style={{ color: NEX.textDim }}>Honest statement:</strong>
      <br />
      1. This is a visual prototype · nothing persists to Supabase · no server
      action yet.
      <br />
      2. Permenhub tariffs (Kepmenhub KP 1001/2022) are the LEGAL baseline.
      Market prices on Gojek/Grab/Maxim typically run higher due to surge.
      Treat the per-km anchor as a floor, not a quote.
      <br />
      3. The seller books their own courier (bike or cargo). NEX never touches
      money or logistics bookings.
      <br />
      4. The country-agnostic shape (province code · city override · size
      tier · time preset) applies to any country · Indonesia constants are
      swappable per-market.
    </div>
  );
}
