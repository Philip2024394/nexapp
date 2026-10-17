// src/app/nex-native/manage/promos/page.tsx
//
// Owner Promo Manager · up to 3 time-boxed promos per business.
// -------------------------------------------------------------
// Each slot (1, 2, 3) is rendered as either:
//   · "Active promo" card · showing title + description + colour +
//     days until expiry + an inline Delete form
//   · "Empty slot" form · add promo with title / description / colour
//     picker (hex input) / optional image URL / 1-14 day expiry
//
// When migration 159 (nex_business_promo) hasn't been applied yet
// the page renders a clear "awaiting migration" state with the exact
// migration file name so an admin knows what to run.

import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import { listPromosForBusiness } from "@/lib/nex-native/business-promo-service";
import { NexPageHeader } from "../../_page-header";
import { createPromoAction, deletePromoAction } from "./_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  surface: "#07152A",
  panel: "#0A1B36",
  panelHi: "#0E2140",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#8BA9D1",
  textSoft: "#6B82A5",
  orange: "#FF7200",
  orangeSoft: "rgba(255,114,0,0.4)",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.4)",
  green: "#16D66B",
  danger: "#C94A4A",
  border: "rgba(255,255,255,0.1)",
  borderSoft: "rgba(255,255,255,0.06)",
};

const SUCCESS_CODES = new Set(["created", "deleted"]);

interface SearchParams {
  readonly e?: string;
  readonly m?: string;
}

export default async function PromoManagerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const business = owned[0] ?? null;

  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const bannerOk = banner ? SUCCESS_CODES.has(banner.code) : false;

  if (!business) {
    return (
      <>
        <PageStyle />
        <main style={pageStyle()}>
          <NexPageHeader dataScope="manage-promos" />
          <HeroTitle />
          <EmptyBusinessState />
        </main>
      </>
    );
  }

  const promosResult = await listPromosForBusiness(business.id);
  const tableMissing = !promosResult.ok && promosResult.reason === "table_missing";
  const promos = promosResult.ok ? promosResult.data ?? [] : [];
  const promosByPosition = new Map(promos.map((p) => [p.position, p]));

  return (
    <>
      <PageStyle />
      <main style={pageStyle()}>
        <NexPageHeader dataScope="manage-promos" />
        <HeroTitle />
        <SubCopy business={business.display_name} />

        {banner ? (
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: 12,
              background: bannerOk ? "rgba(22,214,107,0.1)" : "rgba(201,74,74,0.1)",
              border: `1px solid ${bannerOk ? NEX.green : NEX.danger}66`,
              color: NEX.text,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {banner.message}
          </div>
        ) : null}

        {tableMissing ? <MigrationGate /> : null}

        <section style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {([1, 2, 3] as const).map((position) => {
            const promo = promosByPosition.get(position) ?? null;
            return (
              <SlotRow
                key={position}
                position={position}
                promo={promo}
                disabled={tableMissing}
              />
            );
          })}
        </section>

        <p
          style={{
            marginTop: 24,
            fontSize: 11,
            color: NEX.textSoft,
            lineHeight: 1.6,
            textAlign: "center",
          }}
        >
          Promos expire automatically up to 14 days after creation. They appear as
          round circles on the right edge of your business card in{" "}
          <Link href="/nex-native/directory/landing" style={{ color: NEX.cyan, textDecoration: "none" }}>
            NEX Directory
          </Link>
          .
        </p>
      </main>
    </>
  );
}

// ─── Pieces ────────────────────────────────────────────────────────

function PageStyle(): React.JSX.Element {
  return (
    <style>{`
      html, body { background: ${NEX.bg} !important; }
      html, body { scrollbar-width: none; -ms-overflow-style: none; }
      html::-webkit-scrollbar, body::-webkit-scrollbar { width: 0; height: 0; display: none; }
    `}</style>
  );
}

function pageStyle(): React.CSSProperties {
  return {
    minHeight: "100dvh",
    background: NEX.bg,
    color: NEX.text,
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    padding: "16px 18px 48px",
    maxWidth: 540,
    margin: "0 auto",
  };
}

function HeroTitle(): React.JSX.Element {
  return (
    <section style={{ marginTop: 22 }}>
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: NEX.orange,
          fontWeight: 700,
        }}
      >
        NEX Discover · Promos
      </div>
      <h1
        style={{
          margin: "4px 0 0",
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          color: NEX.text,
        }}
      >
        Your 3 promo slots
      </h1>
    </section>
  );
}

function SubCopy({ business }: { readonly business: string }): React.JSX.Element {
  return (
    <p
      style={{
        marginTop: 6,
        fontSize: 13,
        color: NEX.textMuted,
        lineHeight: 1.55,
      }}
    >
      Create up to three time-boxed promos for{" "}
      <strong style={{ color: NEX.text, fontWeight: 700 }}>{business}</strong>.
      Each promo lives for 1–14 days then disappears from your card
      automatically.
    </p>
  );
}

function MigrationGate(): React.JSX.Element {
  return (
    <div
      style={{
        marginTop: 16,
        padding: 14,
        background: "rgba(255,114,0,0.08)",
        border: `1px solid ${NEX.orangeSoft}`,
        borderRadius: 12,
        fontSize: 12,
        color: NEX.text,
        lineHeight: 1.6,
      }}
    >
      <strong style={{ color: NEX.orange, fontWeight: 700 }}>
        Awaiting migration 159.
      </strong>{" "}
      The <code>nex_business_promo</code> table does not exist yet. Ask the
      NEX admin to apply{" "}
      <code style={{ color: NEX.cyan }}>
        nex-supabase/migrations/159_nex_business_promo.sql
      </code>
      . The form below still accepts input so you can prepare content, but
      saving is disabled until the migration lands.
    </div>
  );
}

function EmptyBusinessState(): React.JSX.Element {
  return (
    <div
      style={{
        marginTop: 20,
        padding: 20,
        background: NEX.panel,
        border: `1px dashed ${NEX.cyanSoft}`,
        borderRadius: 14,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: NEX.text }}>
        No business claimed yet
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 12, color: NEX.textMuted, lineHeight: 1.5 }}>
        Promos belong to a NEX business. Finish your business setup first.
      </p>
      <Link
        href="/nex-native/business-setup"
        style={{
          marginTop: 14,
          display: "inline-block",
          padding: "10px 16px",
          background: NEX.orange,
          color: "#FFFFFF",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        Set up business →
      </Link>
    </div>
  );
}

function SlotRow({
  position,
  promo,
  disabled,
}: {
  readonly position: 1 | 2 | 3;
  readonly promo: {
    readonly id: string;
    readonly title: string;
    readonly description: string | null;
    readonly imageUrl: string | null;
    readonly backgroundHex: string | null;
    readonly expiresAt: string;
  } | null;
  readonly disabled: boolean;
}): React.JSX.Element {
  const bg = promo?.backgroundHex ?? NEX.orange;
  const expiryLabel = promo ? formatExpiry(promo.expiresAt) : null;

  if (promo) {
    return (
      <article
        style={{
          background: NEX.panel,
          border: `1px solid ${bg}66`,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            padding: 12,
          }}
        >
          <div
            aria-hidden
            style={{
              flex: "0 0 auto",
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: bg,
              border: `2px solid rgba(255,255,255,0.9)`,
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
            }}
          >
            {promo.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={promo.imageUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <span
                style={{
                  color: "#FFFFFF",
                  fontSize: 20,
                  fontWeight: 800,
                  textShadow: "0 1px 2px rgba(0,0,0,0.4)",
                }}
              >
                {promo.title.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: bg,
                fontWeight: 700,
              }}
            >
              Slot {position}
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: 15,
                fontWeight: 700,
                color: NEX.text,
                letterSpacing: "-0.01em",
                lineHeight: 1.25,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {promo.title}
            </div>
            {promo.description ? (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12,
                  color: NEX.textDim,
                  lineHeight: 1.5,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {promo.description}
              </p>
            ) : null}
            <div style={{ marginTop: 6, fontSize: 11, color: NEX.textMuted }}>
              ⏱ {expiryLabel}
            </div>
          </div>
        </div>
        <form
          action={deletePromoAction}
          style={{
            borderTop: `1px solid ${NEX.borderSoft}`,
            padding: 10,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <input type="hidden" name="promo_id" value={promo.id} />
          <button
            type="submit"
            disabled={disabled}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: `1px solid ${NEX.danger}66`,
              background: "transparent",
              color: NEX.danger,
              fontSize: 12,
              fontWeight: 700,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            Delete
          </button>
        </form>
      </article>
    );
  }

  return <SlotForm position={position} disabled={disabled} />;
}

function SlotForm({
  position,
  disabled,
}: {
  readonly position: 1 | 2 | 3;
  readonly disabled: boolean;
}): React.JSX.Element {
  return (
    <article
      style={{
        background: NEX.panel,
        border: `1px dashed ${NEX.cyanSoft}`,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: NEX.cyan,
          fontWeight: 700,
        }}
      >
        Slot {position} · empty
      </div>
      <form
        action={createPromoAction}
        style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}
      >
        <input type="hidden" name="position" value={position} />
        <Field label="Title" required>
          <input
            type="text"
            name="title"
            maxLength={80}
            minLength={1}
            placeholder="e.g. 20% off today"
            required
            style={inputStyle()}
          />
        </Field>
        <Field label="Description (optional)">
          <textarea
            name="description"
            maxLength={400}
            rows={2}
            placeholder="Short line, up to 400 characters."
            style={{ ...inputStyle(), resize: "vertical", minHeight: 60, fontFamily: "inherit" }}
          />
        </Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Colour (hex)" style={{ flex: 1 }}>
            <input
              type="text"
              name="background_hex"
              placeholder="#FF7200"
              pattern="#?[0-9A-Fa-f]{6}"
              style={inputStyle()}
            />
          </Field>
          <Field label="Expires in (days)" style={{ flex: 1 }}>
            <input
              type="number"
              name="days_until_expiry"
              min={1}
              max={14}
              defaultValue={7}
              required
              style={inputStyle()}
            />
          </Field>
        </div>
        <Field label="Image URL (optional)">
          <input
            type="url"
            name="image_url"
            placeholder="https://…"
            maxLength={2048}
            style={inputStyle()}
          />
        </Field>
        <button
          type="submit"
          disabled={disabled}
          style={{
            marginTop: 2,
            padding: "11px 16px",
            borderRadius: 12,
            border: "none",
            background: disabled ? NEX.panelHi : NEX.orange,
            color: disabled ? NEX.textMuted : "#FFFFFF",
            fontSize: 14,
            fontWeight: 700,
            cursor: disabled ? "not-allowed" : "pointer",
            boxShadow: disabled ? "none" : `0 6px 14px ${NEX.orange}44`,
          }}
        >
          {disabled ? "Save disabled · migration 159 pending" : "Create promo"}
        </button>
      </form>
    </article>
  );
}

function Field({
  label,
  required,
  children,
  style,
}: {
  readonly label: string;
  readonly required?: boolean;
  readonly children: React.ReactNode;
  readonly style?: React.CSSProperties;
}): React.JSX.Element {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      <span
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: NEX.textSoft,
          fontWeight: 700,
        }}
      >
        {label}
        {required ? <span style={{ color: NEX.orange, marginLeft: 4 }}>·</span> : null}
      </span>
      {children}
    </label>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${NEX.border}`,
    background: NEX.surface,
    color: NEX.text,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };
}

function formatExpiry(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "Expiry unknown";
  const diffMs = then - now;
  if (diffMs <= 0) return "Expired";
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  if (days >= 2) return `Ends in ${days} days`;
  if (days === 1) return hours > 0 ? `Ends in 1 day, ${hours}h` : "Ends in 1 day";
  if (hours >= 1) return `Ends in ${hours}h`;
  return "Ends in under 1h";
}
