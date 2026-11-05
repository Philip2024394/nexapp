"use client";

// src/app/nex-native/manage/watches/new/_upload-client.tsx
//
// Owner directive 2026-10-26 (Round 3g) · world-class watch upload
// skeleton · 3-tier progressive form:
//   · Level 1 Essential · always visible
//   · Level 2 Detailed · collapsible, movement-dependent reveal
//   · Level 3 Verified premium · collapsible
//
// Honours sealed universal NEX keypad on every text / numeric input.
// Pure UI · no DB write · submit = toast until nex_watch_listing
// migration lands (see doctrine
// docs/doctrine/nex-shop-watches-upload-draft-2026-10-26.md).

import * as React from "react";
import { useRouter } from "next/navigation";
import { NexInput } from "@/lib/nex-native/nex-keyboard/nex-input";
import { NexTextarea } from "@/lib/nex-native/nex-keyboard/nex-textarea";
import {
  WatchOverlayCaption,
  type WatchSpecs,
} from "@/components/nex-native/watches/WatchOverlayCaption";
import { BrandPicker } from "./_brand-picker";
import { CategoryPicker, type VerticalId } from "./_category-picker";
import { VariantImageRow, type Variant } from "./_variant-image-row";
import {
  createWatchListingAction,
  grantWatchListingEntitlementMockAction,
} from "@/lib/nex-native/watches/watch-listing-actions";
import { LISTING_FEE_LABEL_IDR } from "@/lib/nex-native/watches/watch-listing-money";
import {
  WATCH_TYPES, type WatchType,
  MOVEMENT_TYPES, type MovementType,
  MECHANICAL_MOVEMENTS, QUARTZ_MOVEMENTS, DIGITAL_MOVEMENTS,
  CASE_SHAPES, type CaseShape,
  CRYSTAL_MATERIALS, type CrystalMaterial,
  STRAP_MATERIALS, type StrapMaterial,
  CLASP_TYPES, type ClaspType,
  CONDITIONS, type Condition,
  CASE_MATERIAL_CATEGORIES, type CaseMaterialCategory,
  WATER_RESISTANCE_RATINGS, type WaterResistance,
  BEZEL_STYLES, type BezelStyle,
  DIAL_FINISHES, type DialFinish,
  HAND_STYLES, type HandStyle,
  CASE_FINISHES, type CaseFinish,
  STYLE_AUDIENCES, type StyleAudience,
  STRAP_INTERCHANGEABILITIES, type StrapInterchangeability,
  LUG_TYPES, type LugType,
  CROWN_POSITIONS, type CrownPosition,
  CASE_SIZE_CATEGORIES, type CaseSizeCategory,
  AUTHENTICITY_OPTIONS, type Authenticity,
  SELLER_TYPES, type SellerType,
  SHIPPING_SCOPES, type ShippingScope,
  PRICING_MODES, type PricingMode,
  PACKAGING_ITEMS, type PackagingItem,
  AVAILABILITY_OPTIONS, type Availability,
} from "@/lib/nex-native/watch-catalog/watch-vocabularies";

const NEX = {
  text: "#F2F5F8",
  textDim: "#C8D4E8",
  textFaint: "#7D9BC0",
  cyan: "#00AFFF",
  gold: "#FFC24B",
  warn: "#FF7200",
  rowBg: "rgba(255,255,255,0.04)",
  rowBorder: "rgba(255,255,255,0.08)",
  panelBg: "rgba(6,16,30,0.9)",
  panelBorder: "rgba(0,175,255,0.3)",
  tierOpen: "rgba(0,175,255,0.08)",
} as const;

const DESCRIPTION_MAX_LEN = 500;
const DESCRIPTION_MAX_LINES = 6;

interface DraftState {
  // ─── Essential ──────────────────────────
  brand: string;
  brandIsCustom: boolean;
  modelName: string;
  referenceNumber: string;
  watchType: WatchType | "";
  movement: MovementType | "";
  caseDiameterMm: string;
  dialColor: string;
  strapMaterial: StrapMaterial | "";
  condition: Condition | "";
  buyNowPriceIdr: string;
  description: string;
  // ─── Detailed · dimensions ──────────────
  caseThicknessMm: string;
  lugToLugMm: string;
  caseShape: CaseShape | "";
  caseMaterialCategory: CaseMaterialCategory | "";
  caseMaterialDetail: string;
  crystalMaterial: CrystalMaterial | "";
  waterResistance: WaterResistance | "";
  waterResistanceCustom: string;
  // ─── Detailed · strap ───────────────────
  strapWidthMm: string;
  lugWidthMm: string;
  strapInterchangeability: StrapInterchangeability | "";
  lugType: LugType | "";
  clasp: ClaspType | "";
  strapLengthMm: string;
  quickRelease: boolean;
  // ─── Detailed · movement (mechanical) ──
  movementCaliber: string;
  movementManufacturer: string;
  powerReserveHours: string;
  jewelsCount: string;
  frequencyBph: string;
  hackingSeconds: boolean;
  handWinding: boolean;
  // ─── Detailed · movement (smartwatch) ──
  displayTechnology: string;
  screenSize: string;
  batteryLifeNote: string;
  operatingSystem: string;
  hasGps: boolean;
  hasHeartRate: boolean;
  hasNfcPayments: boolean;
  // ─── Detailed · fit & comfort ──────────
  weightGrams: string;
  caseSizeCategory: CaseSizeCategory | "";
  crownPosition: CrownPosition | "";
  leftHanded: boolean;
  // ─── Detailed · durability ─────────────
  bezelStyle: BezelStyle | "";
  screwDownCrown: boolean;
  screwDownCaseback: boolean;
  // ─── Detailed · appearance ─────────────
  dialFinish: DialFinish | "";
  handStyle: HandStyle | "";
  caseFinish: CaseFinish | "";
  styleAudience: StyleAudience | "";
  madeIn: string;
  productionYear: string;
  // ─── Verified premium ───────────────────
  serialNumberMasked: string;
  authenticity: Authenticity | "";
  originalBox: boolean;
  originalPapers: boolean;
  serviceHistoryNote: string;
  warrantyNote: string;
  sellerType: SellerType | "";
  shippingScope: readonly ShippingScope[];
  pricingModes: readonly PricingMode[];
  packaging: readonly PackagingItem[];
  availability: Availability | "";
  returnsPolicy: string;
  priceNote: string;
}

const EMPTY_DRAFT: DraftState = {
  brand: "", brandIsCustom: false, modelName: "", referenceNumber: "",
  watchType: "", movement: "", caseDiameterMm: "", dialColor: "",
  strapMaterial: "", condition: "", buyNowPriceIdr: "", description: "",
  caseThicknessMm: "", lugToLugMm: "", caseShape: "",
  caseMaterialCategory: "", caseMaterialDetail: "", crystalMaterial: "",
  waterResistance: "", waterResistanceCustom: "",
  strapWidthMm: "", lugWidthMm: "", strapInterchangeability: "", lugType: "",
  clasp: "", strapLengthMm: "", quickRelease: false,
  movementCaliber: "", movementManufacturer: "", powerReserveHours: "",
  jewelsCount: "", frequencyBph: "", hackingSeconds: false, handWinding: false,
  displayTechnology: "", screenSize: "", batteryLifeNote: "",
  operatingSystem: "", hasGps: false, hasHeartRate: false, hasNfcPayments: false,
  weightGrams: "", caseSizeCategory: "", crownPosition: "", leftHanded: false,
  bezelStyle: "", screwDownCrown: false, screwDownCaseback: false,
  dialFinish: "", handStyle: "", caseFinish: "", styleAudience: "",
  madeIn: "", productionYear: "",
  serialNumberMasked: "", authenticity: "",
  originalBox: false, originalPapers: false,
  serviceHistoryNote: "", warrantyNote: "", sellerType: "",
  shippingScope: [], pricingModes: [], packaging: [],
  availability: "", returnsPolicy: "", priceNote: "",
};

const parseNumeric = (raw: string): number | undefined => {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

const parseRupiah = (raw: string): number | undefined => {
  const stripped = raw.replace(/\./g, "").replace(/,/g, "").replace(/\s/g, "");
  const n = Number(stripped);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export interface UploadClientProps {
  /** Honest signal from the server · "is publishing available at
   *  all in this environment?" Owner directive 2026-10-26 · the UI
   *  must NOT present Rp 30.000 as a working production payment
   *  when no provider is wired. */
  readonly paymentAvailable?: boolean;
  readonly paymentUnavailableReason?: string | null;
}

export function UploadClient(props: UploadClientProps = {}): React.JSX.Element {
  const router = useRouter();
  const paymentAvailable = props.paymentAvailable !== false;
  const paymentUnavailableReason = props.paymentUnavailableReason ?? null;
  const [draft, setDraft] = React.useState<DraftState>(EMPTY_DRAFT);
  const [showPreview, setShowPreview] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [tier2Open, setTier2Open] = React.useState(false);
  const [tier3Open, setTier3Open] = React.useState(false);
  const [submitting, setSubmitting] = React.useState<null | "save" | "publish">(null);

  // Stage A1 · category picker state. Only "watches" ships today; "other"
  // files a request to the placeholder queue (console + toast). Stage B
  // will persist to nex_category_request.
  const [category, setCategory] = React.useState<VerticalId>("watches");

  // Stage A2 · variant images (per-color one image). Client-only state
  // for Stage A · Stage B will upload to nex-media + add a `variants`
  // JSONB column on nex_watch_listing.
  const [variants, setVariants] = React.useState<readonly Variant[]>([]);

  const onRequestCategory = React.useCallback((requestedName: string): void => {
    // Owner-sealed 2026-10-28 · honest copy. There is no durable request
    // queue in Stage A2-T2 (filesystem queue was audited and reverted;
    // Supabase table requires separate authorisation). The toast must
    // not claim a review workflow that does not exist. Console log is
    // dev-only breadcrumb; production readers see only the toast.
    // eslint-disable-next-line no-console
    console.info("[nex-category-request]", { requestedName, ts: new Date().toISOString() });
    setToast("Your request hasn't been submitted yet. Category requests aren't available just yet.");
  }, []);

  const setDescription = React.useCallback((next: string): void => {
    const lineCount = next.split("\n").length;
    if (lineCount > DESCRIPTION_MAX_LINES) {
      next = next.split("\n").slice(0, DESCRIPTION_MAX_LINES).join("\n");
    }
    if (next.length > DESCRIPTION_MAX_LEN) {
      next = next.slice(0, DESCRIPTION_MAX_LEN);
    }
    setDraft((d) => ({ ...d, description: next }));
  }, []);

  const update = <K extends keyof DraftState>(key: K, value: DraftState[K]): void => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const toggleListItem = <T extends string>(
    key: keyof DraftState,
    item: T,
    current: readonly T[],
  ): void => {
    const next = current.includes(item)
      ? current.filter((x) => x !== item)
      : [...current, item];
    setDraft((d) => ({ ...d, [key]: next } as DraftState));
  };

  const movementCategory: "mechanical" | "quartz" | "digital" | "none" =
    MECHANICAL_MOVEMENTS.includes(draft.movement as MovementType) ? "mechanical"
    : QUARTZ_MOVEMENTS.includes(draft.movement as MovementType) ? "quartz"
    : DIGITAL_MOVEMENTS.includes(draft.movement as MovementType) ? "digital"
    : "none";

  const specsForPreview: WatchSpecs = {
    caseDiameterMm: parseNumeric(draft.caseDiameterMm),
    caseThicknessMm: parseNumeric(draft.caseThicknessMm),
    lugToLugMm: parseNumeric(draft.lugToLugMm),
    movement: (draft.movement || undefined) as WatchSpecs["movement"],
    movementCaliber: draft.movementCaliber.trim() || undefined,
    waterResistanceM: (() => {
      if (draft.waterResistance === "not-rated") return 0;
      const raw = draft.waterResistance;
      if (!raw) return parseNumeric(draft.waterResistanceCustom);
      const m = raw.match(/^(\d+)m/);
      return m ? Number(m[1]) : undefined;
    })(),
    caseMaterial: draft.caseMaterialDetail.trim() || undefined,
    strapMaterial: draft.strapMaterial || undefined,
    strapWidthMm: parseNumeric(draft.strapWidthMm),
    strapLengthMm: parseNumeric(draft.strapLengthMm),
    madeIn: draft.madeIn.trim() || undefined,
    dialColor: draft.dialColor.trim() || undefined,
    productionYear: parseNumeric(draft.productionYear),
    condition: (draft.condition || undefined) as WatchSpecs["condition"],
    authenticity: (draft.authenticity || undefined) as WatchSpecs["authenticity"],
    warrantyNote: draft.warrantyNote.trim() || undefined,
    priceNote: draft.priceNote.trim() || undefined,
    shippingScope:
      draft.shippingScope.length > 0 ? (draft.shippingScope as unknown as readonly ("local" | "domestic" | "export" | "pickup-only")[]) : undefined,
    pricingModes:
      draft.pricingModes.length > 0 ? (draft.pricingModes as unknown as readonly ("retail" | "wholesale" | "trade-in")[]) : undefined,
    packaging:
      draft.packaging.length > 0
        ? (draft.packaging.filter((p) =>
            ["box","papers","warranty-card","service-card","manual","spare-link","none"].includes(p)
          ) as unknown as readonly ("box" | "papers" | "warranty-card" | "service-card" | "manual" | "spare-link" | "none")[])
        : undefined,
    fullSet: draft.originalBox && draft.originalPapers ? true : undefined,
  };

  const previewHeadline =
    [draft.brand.trim(), draft.modelName.trim()].filter(Boolean).join(" · ") ||
    draft.brand.trim();
  const canSave = draft.brand.trim().length > 0 && draft.modelName.trim().length > 0;

  // Map DraftState → CreateListingInput for the server action. Pure
  // function · no side-effects. Owner directive 2026-10-26 · wire the
  // sealed 3-tier form to the sibling-table backend.
  const buildCreatePayload = (): Record<string, unknown> => {
    const rupiahMajor = parseRupiah(draft.buyNowPriceIdr);
    // ×100 sen convention · sealed codebase-wide (price_pence bigint).
    const pricePence = rupiahMajor != null ? rupiahMajor * 100 : null;
    // DB pricing_mode is the 4-mode listing display mode. Default to
    // "price_only" when the seller supplied a hard price, else "chat".
    const pricingMode = pricePence != null ? "price_only" : "chat";
    return {
      pricing_mode: pricingMode,
      price_pence: pricePence,
      currency: "IDR",
      brand: draft.brand.trim(),
      brand_is_custom: draft.brandIsCustom,
      model_name: draft.modelName.trim(),
      reference_number: draft.referenceNumber.trim() || null,
      watch_type: draft.watchType || "wristwatch",
      movement: draft.movement || "unknown",
      case_diameter_mm: parseNumeric(draft.caseDiameterMm) ?? null,
      dial_color: draft.dialColor.trim() || null,
      strap_material: draft.strapMaterial || null,
      condition: draft.condition || "pre-owned",
      description: draft.description.trim() || null,
      case_shape: draft.caseShape || null,
      case_material_category: draft.caseMaterialCategory || null,
      crystal_material: draft.crystalMaterial || null,
      clasp_type: draft.clasp || null,
      water_resistance_m:
        draft.waterResistance === "not-rated"
          ? 0
          : (() => {
              const m = draft.waterResistance.match(/^(\d+)m/);
              return m ? Number(m[1]) : parseNumeric(draft.waterResistanceCustom) ?? null;
            })(),
      bezel_style: draft.bezelStyle || null,
      dial_finish: draft.dialFinish || null,
      hand_style: draft.handStyle || null,
      case_finish: draft.caseFinish || null,
      style_audience: draft.styleAudience || null,
      strap_interchangeability: draft.strapInterchangeability || null,
      lug_type: draft.lugType || null,
      crown_position: draft.crownPosition || null,
      case_size_category: draft.caseSizeCategory || null,
      authenticity: draft.authenticity || null,
      seller_type: draft.sellerType || null,
      shipping_scope: draft.shippingScope[0] ?? null,
      packaging_items: draft.packaging.length > 0 ? [...draft.packaging] : null,
      availability: draft.availability || null,
      warranty_note: draft.warrantyNote.trim() || null,
      provenance_note: draft.serviceHistoryNote.trim() || null,
    };
  };

  const onSave = async (): Promise<void> => {
    if (!canSave || submitting) {
      if (!canSave) setToast("Brand and model are required.");
      return;
    }
    setSubmitting("save");
    try {
      const result = await createWatchListingAction(buildCreatePayload());
      if (!result.ok) {
        setToast(`Could not save draft: ${result.message}`);
        return;
      }
      setToast(`Draft saved · listing ${result.listing.id.slice(0, 8)} · status ${result.listing.status}.`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Unknown error saving draft.");
    } finally {
      setSubmitting(null);
    }
  };

  const onPublish = async (): Promise<void> => {
    if (!canSave || submitting) {
      if (!canSave) setToast("Brand and model are required.");
      return;
    }
    setSubmitting("publish");
    try {
      const draftResult = await createWatchListingAction(buildCreatePayload());
      if (!draftResult.ok) {
        setToast(`Could not create listing: ${draftResult.message}`);
        return;
      }
      const grantResult = await grantWatchListingEntitlementMockAction({
        listingId: draftResult.listing.id,
      });
      if (!grantResult.ok) {
        setToast(`Draft saved but publish failed: ${grantResult.message}`);
        return;
      }
      // Navigate to the live listing page. Fresh entitlement window
      // in effect for 30 days per the sealed P0 S-decision.
      router.push(`/nex-native/watches/${grantResult.listing.id}`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Unknown error publishing.");
    } finally {
      setSubmitting(null);
    }
  };

  React.useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  return (
    <div
      data-nex-shop-watch-upload
      style={{
        minHeight: "100dvh",
        background: "var(--nex-world-background-base, #020914)",
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: "env(safe-area-inset-top, 0) 16px 24px",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          padding: "20px 0 16px",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.gold,
            }}
          >
            Create listing
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: "4px 0 0", letterSpacing: "-0.01em" }}>
            {category === "watches" ? "Add a watch" : "Create listing"}
          </h1>
          <p style={{ fontSize: 12.5, color: NEX.textDim, marginTop: 6, lineHeight: 1.5 }}>
            Pick a category, add colour variants, fill the spec sheet. Fields
            reveal based on movement type for watches.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          style={{
            flexShrink: 0,
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)",
            color: NEX.text,
            fontSize: 18,
            lineHeight: 1,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ×
        </button>
      </header>

      {/* ─── STEP 1 · Category ─────────────────────────────── */}
      <TierHeader
        tier={1}
        title="Category"
        subtitle="What are you selling?"
        open={true}
      />
      <section style={sectionStyle}>
        <CategoryPicker
          value={category}
          onChange={setCategory}
          onRequestCategory={onRequestCategory}
        />
      </section>

      {/* ─── STEP 2 · Colour variants ──────────────────────── */}
      <TierHeader
        tier={2}
        title="Colour variants"
        subtitle="Optional · one image per colour or strap"
        open={true}
      />
      <section style={sectionStyle}>
        <VariantImageRow variants={variants} onChange={setVariants} />
      </section>

      {/* ─── STEP 3 · Essential (was LEVEL 1) ──────────────── */}
      <TierHeader
        tier={3}
        title="Essential"
        subtitle="Required on every listing"
        open={true}
      />
      <section style={sectionStyle}>
        <Field label="Brand · pick from list or type custom (2 words max)">
          <BrandPicker
            value={draft.brand}
            onChange={(v) => update("brand", v)}
            isCustom={draft.brandIsCustom}
            onIsCustomChange={(v) => update("brandIsCustom", v)}
          />
        </Field>
        <Row>
          <Field label="Model name · required">
            <NexInput
              value={draft.modelName}
              onChange={(v) => update("modelName", v)}
              placeholder="e.g. Cosmograph Daytona"
              maxLength={120}
              forceKeypadActive={true}
              style={inputStyle}
            />
          </Field>
          <Field label="Reference number">
            <NexInput
              value={draft.referenceNumber}
              onChange={(v) => update("referenceNumber", v)}
              placeholder="e.g. 116503"
              maxLength={40}
              forceKeypadActive={true}
              style={inputStyle}
            />
          </Field>
        </Row>
        <Row>
          <Field label="Watch type">
            <Select
              value={draft.watchType}
              onChange={(v) => update("watchType", v as WatchType | "")}
              options={WATCH_TYPES}
            />
          </Field>
          <Field label="Movement type · drives optional fields below">
            <Select
              value={draft.movement}
              onChange={(v) => update("movement", v as MovementType | "")}
              options={MOVEMENT_TYPES}
            />
          </Field>
        </Row>
        <Row>
          <Field label="Face Dia (mm)">
            <NexInput
              value={draft.caseDiameterMm}
              onChange={(v) => update("caseDiameterMm", v)}
              placeholder="40"
              maxLength={6}
              forceKeypadActive={true}
              planes={["numbers", "symbols"]}
              inputMode="decimal"
              style={inputStyle}
            />
          </Field>
          <Field label="Dial colour">
            <NexInput
              value={draft.dialColor}
              onChange={(v) => update("dialColor", v)}
              placeholder="Black"
              maxLength={40}
              forceKeypadActive={true}
              style={inputStyle}
            />
          </Field>
        </Row>
        <Row>
          <Field label="Strap material">
            <Select
              value={draft.strapMaterial}
              onChange={(v) => update("strapMaterial", v as StrapMaterial | "")}
              options={STRAP_MATERIALS}
            />
          </Field>
          <Field label="Condition">
            <Select
              value={draft.condition}
              onChange={(v) => update("condition", v as Condition | "")}
              options={CONDITIONS}
            />
          </Field>
        </Row>
        <Field label="Buy Now price (IDR integer, no decimals)">
          <NexInput
            value={draft.buyNowPriceIdr}
            onChange={(v) => update("buyNowPriceIdr", v.replace(/\D/g, ""))}
            placeholder="e.g. 450000000 for Rp 450.000.000"
            maxLength={14}
            forceKeypadActive={true}
            planes={["numbers"]}
            inputMode="numeric"
            style={inputStyle}
          />
          {parseRupiah(draft.buyNowPriceIdr) ? (
            <div style={{ fontSize: 11, color: NEX.gold, marginTop: 4, fontWeight: 800 }}>
              Preview: Rp {parseRupiah(draft.buyNowPriceIdr)?.toLocaleString("id-ID")}
            </div>
          ) : null}
        </Field>
        <Field label={`Description · max ${DESCRIPTION_MAX_LINES} lines, ${DESCRIPTION_MAX_LEN} chars`}>
          <NexTextarea
            value={draft.description}
            onChange={setDescription}
            placeholder="Factual description of the watch · condition, provenance, what's included."
            maxLength={DESCRIPTION_MAX_LEN}
            forceKeypadActive={true}
            keypadMode="multiline"
            rows={5}
            style={{ ...inputStyle, resize: "none", minHeight: 110 }}
          />
          <div style={{ fontSize: 11, color: NEX.textDim, marginTop: 4 }}>
            {draft.description.length} / {DESCRIPTION_MAX_LEN} chars · lines:{" "}
            {draft.description.split("\n").length} / {DESCRIPTION_MAX_LINES}
          </div>
        </Field>
      </section>

      {/* ─── STEP 4 · Detailed (was LEVEL 2) ───────────────── */}
      <TierHeader
        tier={4}
        title="Detailed specifications"
        subtitle="Dimensions, movement, fit, durability, appearance"
        open={tier2Open}
        onToggle={() => setTier2Open((v) => !v)}
      />
      {tier2Open ? (
        <>
          <section style={sectionStyle}>
            <h2 style={h2Style}>Dimensions &amp; case</h2>
            <Row>
              <Field label="Case thickness (mm)">
                <NexInput value={draft.caseThicknessMm} onChange={(v) => update("caseThicknessMm", v)} placeholder="12" maxLength={5} forceKeypadActive={true} planes={["numbers","symbols"]} inputMode="decimal" style={inputStyle} />
              </Field>
              <Field label="Lug-to-lug (mm)">
                <NexInput value={draft.lugToLugMm} onChange={(v) => update("lugToLugMm", v)} placeholder="47" maxLength={5} forceKeypadActive={true} planes={["numbers","symbols"]} inputMode="decimal" style={inputStyle} />
              </Field>
            </Row>
            <Row>
              <Field label="Case shape">
                <Select value={draft.caseShape} onChange={(v) => update("caseShape", v as CaseShape | "")} options={CASE_SHAPES} />
              </Field>
              <Field label="Case material category">
                <Select value={draft.caseMaterialCategory} onChange={(v) => update("caseMaterialCategory", v as CaseMaterialCategory | "")} options={CASE_MATERIAL_CATEGORIES} />
              </Field>
            </Row>
            <Field label="Case material · detail (free text)">
              <NexInput value={draft.caseMaterialDetail} onChange={(v) => update("caseMaterialDetail", v)} placeholder="Stainless steel + 18ct yellow gold · 316L" maxLength={120} forceKeypadActive={true} style={inputStyle} />
            </Field>
            <Row>
              <Field label="Crystal material">
                <Select value={draft.crystalMaterial} onChange={(v) => update("crystalMaterial", v as CrystalMaterial | "")} options={CRYSTAL_MATERIALS} />
              </Field>
              <Field label="Water resistance (manufacturer-stated)">
                <Select value={draft.waterResistance} onChange={(v) => update("waterResistance", v as WaterResistance | "")} options={WATER_RESISTANCE_RATINGS} />
              </Field>
            </Row>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>Strap, lug, clasp</h2>
            <Row>
              <Field label="Strap width (mm)">
                <NexInput value={draft.strapWidthMm} onChange={(v) => update("strapWidthMm", v)} placeholder="20" maxLength={5} forceKeypadActive={true} planes={["numbers","symbols"]} inputMode="decimal" style={inputStyle} />
              </Field>
              <Field label="Lug width (mm · may differ from strap)">
                <NexInput value={draft.lugWidthMm} onChange={(v) => update("lugWidthMm", v)} placeholder="20" maxLength={5} forceKeypadActive={true} planes={["numbers","symbols"]} inputMode="decimal" style={inputStyle} />
              </Field>
            </Row>
            <Row>
              <Field label="Strap interchangeability">
                <Select value={draft.strapInterchangeability} onChange={(v) => update("strapInterchangeability", v as StrapInterchangeability | "")} options={STRAP_INTERCHANGEABILITIES} />
              </Field>
              <Field label="Lug type">
                <Select value={draft.lugType} onChange={(v) => update("lugType", v as LugType | "")} options={LUG_TYPES} />
              </Field>
            </Row>
            <Row>
              <Field label="Clasp / closure">
                <Select value={draft.clasp} onChange={(v) => update("clasp", v as ClaspType | "")} options={CLASP_TYPES} />
              </Field>
              <Field label="Strap length (mm · optional)">
                <NexInput value={draft.strapLengthMm} onChange={(v) => update("strapLengthMm", v)} placeholder="180" maxLength={5} forceKeypadActive={true} planes={["numbers"]} inputMode="numeric" style={inputStyle} />
              </Field>
            </Row>
            <Toggle label="Quick-release strap" value={draft.quickRelease} onChange={(v) => update("quickRelease", v)} />
          </section>

          {/* Movement · reveal based on category */}
          {movementCategory === "mechanical" || movementCategory === "quartz" ? (
            <section style={sectionStyle}>
              <h2 style={h2Style}>
                {movementCategory === "mechanical" ? "Mechanical movement" : "Quartz movement"}
              </h2>
              <Row>
                <Field label="Calibre reference">
                  <NexInput value={draft.movementCaliber} onChange={(v) => update("movementCaliber", v)} placeholder="e.g. Cal. 4130" maxLength={80} forceKeypadActive={true} style={inputStyle} />
                </Field>
                <Field label="Movement manufacturer">
                  <NexInput value={draft.movementManufacturer} onChange={(v) => update("movementManufacturer", v)} placeholder="e.g. Rolex, ETA, Miyota" maxLength={60} forceKeypadActive={true} style={inputStyle} />
                </Field>
              </Row>
              {movementCategory === "mechanical" ? (
                <>
                  <Row>
                    <Field label="Power reserve (hours)">
                      <NexInput value={draft.powerReserveHours} onChange={(v) => update("powerReserveHours", v)} placeholder="72" maxLength={4} forceKeypadActive={true} planes={["numbers"]} inputMode="numeric" style={inputStyle} />
                    </Field>
                    <Field label="Jewels count">
                      <NexInput value={draft.jewelsCount} onChange={(v) => update("jewelsCount", v)} placeholder="21" maxLength={3} forceKeypadActive={true} planes={["numbers"]} inputMode="numeric" style={inputStyle} />
                    </Field>
                  </Row>
                  <Field label="Frequency (vph)">
                    <NexInput value={draft.frequencyBph} onChange={(v) => update("frequencyBph", v)} placeholder="28800" maxLength={6} forceKeypadActive={true} planes={["numbers"]} inputMode="numeric" style={inputStyle} />
                  </Field>
                  <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
                    <Toggle label="Hacking seconds" value={draft.hackingSeconds} onChange={(v) => update("hackingSeconds", v)} />
                    <Toggle label="Hand-winding" value={draft.handWinding} onChange={(v) => update("handWinding", v)} />
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          {movementCategory === "digital" ? (
            <section style={sectionStyle}>
              <h2 style={h2Style}>Digital / smartwatch</h2>
              <Row>
                <Field label="Display technology">
                  <NexInput value={draft.displayTechnology} onChange={(v) => update("displayTechnology", v)} placeholder="AMOLED / LCD / e-paper" maxLength={40} forceKeypadActive={true} style={inputStyle} />
                </Field>
                <Field label="Screen size (inches or mm)">
                  <NexInput value={draft.screenSize} onChange={(v) => update("screenSize", v)} placeholder="1.9&quot;" maxLength={10} forceKeypadActive={true} style={inputStyle} />
                </Field>
              </Row>
              <Field label="Operating system / platform">
                <NexInput value={draft.operatingSystem} onChange={(v) => update("operatingSystem", v)} placeholder="watchOS 11 · Wear OS 5 · proprietary" maxLength={60} forceKeypadActive={true} style={inputStyle} />
              </Field>
              <Field label="Battery life (typical)">
                <NexInput value={draft.batteryLifeNote} onChange={(v) => update("batteryLifeNote", v)} placeholder="18 hours · 7 days with always-on off" maxLength={120} forceKeypadActive={true} style={inputStyle} />
              </Field>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                <Toggle label="GPS" value={draft.hasGps} onChange={(v) => update("hasGps", v)} />
                <Toggle label="Heart rate" value={draft.hasHeartRate} onChange={(v) => update("hasHeartRate", v)} />
                <Toggle label="NFC payments" value={draft.hasNfcPayments} onChange={(v) => update("hasNfcPayments", v)} />
              </div>
            </section>
          ) : null}

          <section style={sectionStyle}>
            <h2 style={h2Style}>Fit &amp; comfort</h2>
            <Row>
              <Field label="Weight (g)">
                <NexInput value={draft.weightGrams} onChange={(v) => update("weightGrams", v)} placeholder="150" maxLength={4} forceKeypadActive={true} planes={["numbers"]} inputMode="numeric" style={inputStyle} />
              </Field>
              <Field label="Case size category">
                <Select value={draft.caseSizeCategory} onChange={(v) => update("caseSizeCategory", v as CaseSizeCategory | "")} options={CASE_SIZE_CATEGORIES} />
              </Field>
            </Row>
            <Row>
              <Field label="Crown position">
                <Select value={draft.crownPosition} onChange={(v) => update("crownPosition", v as CrownPosition | "")} options={CROWN_POSITIONS} />
              </Field>
              <Field label="&nbsp;">
                <Toggle label="Left-handed / destro" value={draft.leftHanded} onChange={(v) => update("leftHanded", v)} />
              </Field>
            </Row>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>Durability &amp; protection</h2>
            <Field label="Bezel style">
              <Select value={draft.bezelStyle} onChange={(v) => update("bezelStyle", v as BezelStyle | "")} options={BEZEL_STYLES} />
            </Field>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <Toggle label="Screw-down crown" value={draft.screwDownCrown} onChange={(v) => update("screwDownCrown", v)} />
              <Toggle label="Screw-down caseback" value={draft.screwDownCaseback} onChange={(v) => update("screwDownCaseback", v)} />
            </div>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>Appearance</h2>
            <Row>
              <Field label="Dial finish">
                <Select value={draft.dialFinish} onChange={(v) => update("dialFinish", v as DialFinish | "")} options={DIAL_FINISHES} />
              </Field>
              <Field label="Hand style">
                <Select value={draft.handStyle} onChange={(v) => update("handStyle", v as HandStyle | "")} options={HAND_STYLES} />
              </Field>
            </Row>
            <Row>
              <Field label="Case finish">
                <Select value={draft.caseFinish} onChange={(v) => update("caseFinish", v as CaseFinish | "")} options={CASE_FINISHES} />
              </Field>
              <Field label="Style audience">
                <Select value={draft.styleAudience} onChange={(v) => update("styleAudience", v as StyleAudience | "")} options={STYLE_AUDIENCES} />
              </Field>
            </Row>
            <Row>
              <Field label="Made in">
                <NexInput value={draft.madeIn} onChange={(v) => update("madeIn", v)} placeholder="Switzerland" maxLength={40} forceKeypadActive={true} style={inputStyle} />
              </Field>
              <Field label="Production year">
                <NexInput value={draft.productionYear} onChange={(v) => update("productionYear", v)} placeholder="2020" maxLength={4} forceKeypadActive={true} planes={["numbers"]} inputMode="numeric" style={inputStyle} />
              </Field>
            </Row>
          </section>
        </>
      ) : null}

      {/* ─── STEP 5 · Verified premium (was LEVEL 3) ───────── */}
      <TierHeader
        tier={5}
        title="Verified premium details"
        subtitle="Authenticity, provenance, warranty, commerce"
        open={tier3Open}
        onToggle={() => setTier3Open((v) => !v)}
      />
      {tier3Open ? (
        <>
          <section style={sectionStyle}>
            <h2 style={h2Style}>Authenticity &amp; provenance</h2>
            <Field label="Serial number (masked · never public without evidence)">
              <NexInput value={draft.serialNumberMasked} onChange={(v) => update("serialNumberMasked", v)} placeholder="last 4 digits ok" maxLength={30} forceKeypadActive={true} style={inputStyle} />
            </Field>
            <Field label="Authenticity · select honestly">
              <Select value={draft.authenticity} onChange={(v) => update("authenticity", v as Authenticity | "")} options={AUTHENTICITY_OPTIONS} />
            </Field>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
              <Toggle label="Original box" value={draft.originalBox} onChange={(v) => update("originalBox", v)} />
              <Toggle label="Original papers" value={draft.originalPapers} onChange={(v) => update("originalPapers", v)} />
            </div>
            <Field label="Service history (free text)">
              <NexInput value={draft.serviceHistoryNote} onChange={(v) => update("serviceHistoryNote", v)} placeholder="Last Rolex service 2024 · papers available" maxLength={200} forceKeypadActive={true} style={inputStyle} />
            </Field>
            <Field label="Warranty note">
              <NexInput value={draft.warrantyNote} onChange={(v) => update("warrantyNote", v)} placeholder="Rolex international warranty · 2 years remaining" maxLength={200} forceKeypadActive={true} style={inputStyle} />
            </Field>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>Included (packaging)</h2>
            <CheckboxGroup
              options={PACKAGING_ITEMS}
              values={draft.packaging}
              onToggle={(k) => toggleListItem("packaging", k, draft.packaging)}
            />
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>Commerce &amp; shipping</h2>
            <Row>
              <Field label="Seller type">
                <Select value={draft.sellerType} onChange={(v) => update("sellerType", v as SellerType | "")} options={SELLER_TYPES} />
              </Field>
              <Field label="Availability">
                <Select value={draft.availability} onChange={(v) => update("availability", v as Availability | "")} options={AVAILABILITY_OPTIONS} />
              </Field>
            </Row>
            <Field label="Shipping scope · choose any">
              <CheckboxGroup
                options={SHIPPING_SCOPES}
                values={draft.shippingScope}
                onToggle={(k) => toggleListItem("shippingScope", k, draft.shippingScope)}
              />
            </Field>
            <Field label="Pricing modes · choose any">
              <CheckboxGroup
                options={PRICING_MODES}
                values={draft.pricingModes}
                onToggle={(k) => toggleListItem("pricingModes", k, draft.pricingModes)}
              />
            </Field>
            <Field label="Price note (seller-authored · NEX asserts nothing)">
              <NexInput value={draft.priceNote} onChange={(v) => update("priceNote", v)} placeholder="Retail only · wholesale from 3 units" maxLength={200} forceKeypadActive={true} style={inputStyle} />
            </Field>
            <Field label="Returns policy (free text)">
              <NexInput value={draft.returnsPolicy} onChange={(v) => update("returnsPolicy", v)} placeholder="14-day return on authenticity dispute" maxLength={200} forceKeypadActive={true} style={inputStyle} />
            </Field>
          </section>
        </>
      ) : null}

      {/* ─── Sticky action bar ─────────────────────────── */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          background: "linear-gradient(180deg, rgba(2,9,20,0) 0%, #020914 40%)",
          padding: "12px 0 8px",
          display: "flex",
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          style={{
            flex: "1 1 50%",
            minHeight: 46,
            borderRadius: 12,
            background: "rgba(0,175,255,0.14)",
            border: "1px solid rgba(0,175,255,0.5)",
            color: NEX.cyan,
            fontSize: 13.5,
            fontWeight: 800,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          {showPreview ? "Hide preview" : "Preview on Live"}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || submitting !== null}
          style={{
            flex: "1 1 25%",
            minHeight: 46,
            borderRadius: 12,
            background: canSave && submitting === null
              ? "rgba(255,255,255,0.10)"
              : "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.14)",
            color: canSave && submitting === null ? NEX.text : NEX.textDim,
            fontSize: 12.5,
            fontWeight: 800,
            fontFamily: "inherit",
            cursor: canSave && submitting === null ? "pointer" : "not-allowed",
          }}
        >
          {submitting === "save" ? "Saving..." : "Save draft"}
        </button>
        <button
          type="button"
          onClick={paymentAvailable ? onPublish : undefined}
          disabled={!canSave || submitting !== null || !paymentAvailable}
          style={{
            flex: "1 1 25%",
            minHeight: 46,
            borderRadius: 12,
            background: canSave && submitting === null && paymentAvailable
              ? "linear-gradient(135deg, #FF3355 0%, #FF7200 100%)"
              : "rgba(255,255,255,0.08)",
            border: paymentAvailable ? "none" : "1px dashed rgba(255,255,255,0.25)",
            color: canSave && submitting === null && paymentAvailable
              ? "#FFFFFF"
              : NEX.textDim,
            fontSize: 12.5,
            fontWeight: 900,
            fontFamily: "inherit",
            cursor:
              canSave && submitting === null && paymentAvailable
                ? "pointer"
                : "not-allowed",
            padding: "0 10px",
            lineHeight: 1.2,
          }}
          title={
            paymentAvailable
              ? `Publish for ${LISTING_FEE_LABEL_IDR} · 30 days`
              : paymentUnavailableReason ?? "Payment unavailable"
          }
          data-nex-watch-upload-publish
          data-nex-watch-upload-publish-available={paymentAvailable ? "true" : "false"}
        >
          {!paymentAvailable
            ? "Payment unavailable"
            : submitting === "publish"
              ? "Publishing..."
              : <>Publish · {LISTING_FEE_LABEL_IDR}</>}
        </button>
      </div>
      {paymentUnavailableReason ? (
        <p
          data-nex-watch-upload-payment-note
          style={{
            fontSize: 11,
            color: NEX.textDim,
            lineHeight: 1.5,
            margin: "6px 0 0",
            padding: "0 2px",
          }}
        >
          {paymentUnavailableReason}
        </p>
      ) : null}

      {showPreview ? (
        <div
          style={{
            marginTop: 20,
            position: "relative",
            minHeight: 440,
            borderRadius: 16,
            background:
              "linear-gradient(135deg, #0b1a30 0%, #1a2f55 50%, #0b1a30 100%)",
            border: `1px dashed ${NEX.panelBorder}`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.gold,
              borderBottom: `1px dashed ${NEX.panelBorder}`,
            }}
          >
            Live overlay preview
          </div>
          <div style={{ position: "relative", minHeight: 400 }}>
            <WatchOverlayCaption
              headline={previewHeadline || undefined}
              description={draft.description.trim() || undefined}
              brand={draft.brand.trim() || undefined}
              specs={specsForPreview}
              bottomOffsetPx={20}
              defaultExpanded={true}
            />
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 90,
            transform: "translateX(-50%)",
            background: "rgba(6,16,30,0.96)",
            border: `1px solid ${NEX.cyan}`,
            color: NEX.text,
            padding: "12px 18px",
            borderRadius: 12,
            fontSize: 13.5,
            fontWeight: 700,
            maxWidth: 340,
            zIndex: 50,
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

/* ─── Presentational helpers ─────────────────────────────────── */

const sectionStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: "14px 14px 16px",
  background: NEX.panelBg,
  border: `1px solid ${NEX.panelBorder}`,
  borderRadius: 14,
};

const h2Style: React.CSSProperties = {
  fontSize: 13.5,
  fontWeight: 800,
  margin: "0 0 10px",
  letterSpacing: "0.02em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: NEX.rowBg,
  border: `1px solid ${NEX.rowBorder}`,
  color: NEX.text,
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  lineHeight: 1.4,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
  maxWidth: "100%",
};

function TierHeader(props: {
  tier: number;
  title: string;
  subtitle: string;
  open: boolean;
  onToggle?: () => void;
}): React.JSX.Element {
  const togglable = typeof props.onToggle === "function";
  return (
    <div
      onClick={props.onToggle}
      style={{
        margin: "22px 0 10px",
        padding: "10px 12px",
        background: props.open ? NEX.tierOpen : "transparent",
        border: `1px solid ${NEX.panelBorder}`,
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: togglable ? "pointer" : "default",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: NEX.cyan,
          color: "#001A33",
          fontSize: 13,
          fontWeight: 900,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {props.tier}
      </div>
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 900 }}>{props.title}</div>
        <div style={{ fontSize: 11, color: NEX.textDim }}>{props.subtitle}</div>
      </div>
      {togglable ? (
        <span aria-hidden style={{ color: NEX.cyan, fontSize: 14, fontWeight: 900 }}>
          {props.open ? "−" : "+"}
        </span>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: NEX.textDim,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {React.Children.map(children, (c) => (
        <div style={{ flex: "1 1 140px", minWidth: 140 }}>{c}</div>
      ))}
    </div>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T | "";
  onChange: (v: T | "") => void;
  options: ReadonlyArray<readonly [T, string]>;
}): React.JSX.Element {
  return (
    <select
      value={value}
      onChange={(ev) => onChange(ev.target.value as T | "")}
      style={{
        ...inputStyle,
        appearance: "none",
        WebkitAppearance: "none",
      }}
    >
      <option value="">— choose —</option>
      {options.map(([k, label]) => (
        <option key={k} value={k}>
          {label}
        </option>
      ))}
    </select>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }): React.JSX.Element {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        padding: "6px 2px",
      }}
    >
      <input
        type="checkbox"
        checked={value}
        onChange={(ev) => onChange(ev.target.checked)}
        style={{ width: 18, height: 18, accentColor: NEX.cyan, cursor: "pointer" }}
      />
      <span style={{ fontSize: 12.5, color: NEX.text, fontWeight: 600 }}>{label}</span>
    </label>
  );
}

function CheckboxGroup<T extends string>({
  options,
  values,
  onToggle,
}: {
  options: ReadonlyArray<readonly [T, string]>;
  values: readonly T[];
  onToggle: (k: T) => void;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map(([k, label]) => {
        const picked = values.includes(k);
        return (
          <button
            key={k}
            type="button"
            onClick={() => onToggle(k)}
            style={{
              padding: "7px 11px",
              borderRadius: 999,
              background: picked ? "rgba(0,175,255,0.2)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${picked ? NEX.cyan : NEX.rowBorder}`,
              color: picked ? NEX.cyan : NEX.text,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {picked ? "✓ " : ""}
            {label}
          </button>
        );
      })}
    </div>
  );
}
