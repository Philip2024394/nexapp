// src/app/nex-native/live-commerce/library/page.tsx
//
// NEX Live Product Library · Phase 2 of the Product System
// Implementation Contract (sealed 2026-10-30, §K owner-resolved).
//
// Owner-facing surface shown before Go Live. Lists the owner's
// LIVE products (status='live' per §K.14 draft-leak closure) and
// routes the chosen product straight into the broadcast room so
// it becomes the initial featured product.
//
// Entry flow:
//   /nex-native/live-commerce/library
//     if no businesses       → onboarding
//     if one business        → ?business=<id>
//     if multiple businesses → BusinessPicker
//     then list live products for that business
//     tap product → /enter-broadcast-room?business=<id>&product=<id>
//
// Sealed per §E of the contract. Reuses the sealed
// listProductsByBusiness(id, "live") read path.

import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import { resolveLiveEligibility } from "@/lib/nex-native/live-broadcast/live-eligibility";
import { extractMarket, describeMarket } from "@/lib/nex-native/catalogue/market-spec";

export const dynamic = "force-dynamic";

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";

export default async function LiveProductLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ business?: string }>;
}): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=" + encodeURIComponent("/nex-native/live-commerce/library"));
  }

  // Sealed R9 eligibility (2026-10-27) · only Shop-tier accounts broadcast.
  const eligibility = resolveLiveEligibility(session.account);
  if (!eligibility.ok) {
    redirect(
      `/packages?upsell=live&reason=${encodeURIComponent(eligibility.reason)}&returnTo=/nex-native/live-commerce/library`,
    );
  }

  let businesses: Array<{ id: string; name: string }>;
  try {
    const raw = await listBusinessesByOwner(session.account.id);
    businesses = raw.map((b) => ({ id: b.id, name: b.display_name }));
  } catch {
    businesses = [];
  }

  if (businesses.length === 0) {
    return (
      <main style={pageStyle}>
        <div style={container}>
          <h1 style={h1Style}>Live Product Library</h1>
          <p style={subStyle}>You need a NEX business before you can feature products on Live.</p>
          <Link href="/nex-native/onboarding" style={ctaStyle}>Start onboarding</Link>
        </div>
      </main>
    );
  }

  const { business: businessParam } = await searchParams;
  if (!businessParam && businesses.length > 1) {
    return (
      <main style={pageStyle}>
        <div style={container}>
          <h1 style={h1Style}>Which shop?</h1>
          <p style={subStyle}>Choose the business you're broadcasting from.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {businesses.map((b) => (
              <Link
                key={b.id}
                href={`/nex-native/live-commerce/library?business=${encodeURIComponent(b.id)}`}
                style={tileStyle}
              >
                <span style={{ fontWeight: 700 }}>{b.name}</span>
                <span style={{ color: ACCENT }}>→</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    );
  }

  const businessId = businessParam ?? businesses[0]!.id;
  const business = businesses.find((b) => b.id === businessId) ?? businesses[0]!;

  // Sealed §K.14 draft-leak closure · "live" status is mandatory.
  let products: Array<{
    id: string;
    name: string;
    image_url: string | null;
    price_pence: number;
    currency: string;
    stock_status: string | null;
    market_label: string;
    market_scope: "local" | "export" | "both" | null;
  }>;
  try {
    const raw = await productService.listProductsByBusiness(businessId, "live");
    products = raw.map((p) => {
      const market = extractMarket(p.spec);
      return {
        id: p.id,
        name: p.name,
        image_url: p.image_url ?? null,
        price_pence: p.price_pence,
        currency: p.currency,
        stock_status: p.stock_status ?? null,
        market_label: describeMarket(market),
        market_scope: market?.scope ?? null,
      };
    });
  } catch {
    products = [];
  }

  return (
    <main style={pageStyle}>
      <div style={container}>
        <nav style={{ fontSize: 12, color: INK_DIM, marginBottom: 10 }}>
          <strong style={{ color: INK }}>{business.name}</strong> · {products.length} live products
          {businesses.length > 1 && (
            <>
              {" · "}
              <Link href="/nex-native/live-commerce/library" style={{ color: ACCENT, textDecoration: "none" }}>
                Change shop
              </Link>
            </>
          )}
        </nav>
        <h1 style={h1Style}>Live Product Library</h1>
        <p style={subStyle}>Pick a product to feature at the start of your broadcast. You can switch it anytime during Live.</p>

        {products.length === 0 ? (
          <div style={{ ...tileStyle, flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
            <strong>No live products yet.</strong>
            <span style={{ fontSize: 13, color: INK_DIM }}>Create a product and publish it as "live" to feature it during Live broadcasts.</span>
            <Link
              href={`/nex-native/create/product?business=${encodeURIComponent(businessId)}`}
              style={{ ...ctaStyle, marginTop: 8 }}
            >
              Create a product
            </Link>
          </div>
        ) : (
          <div style={gridStyle}>
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/nex-native/live-commerce/enter-broadcast-room?business=${encodeURIComponent(businessId)}&product=${encodeURIComponent(p.id)}`}
                style={productTileStyle}
              >
                <div style={{
                  width: "100%",
                  aspectRatio: "1",
                  background: p.image_url ? `url(${p.image_url}) center/cover` : "#E8EEF5",
                  borderRadius: 10,
                  marginBottom: 10,
                }} />
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }}>
                  {truncate(p.name, 48)}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>
                  {formatPrice(p.price_pence, p.currency)}
                </div>
                {p.market_label ? (
                  <div style={marketBadgeStyle(p.market_scope)}>{p.market_label}</div>
                ) : null}
                {p.stock_status === "sold_out" && (
                  <div style={{ fontSize: 11, color: "#C8102E", fontWeight: 700, marginTop: 4 }}>
                    Sold out
                  </div>
                )}
                {p.stock_status === "low_stock" && (
                  <div style={{ fontSize: 11, color: "#B86E00", fontWeight: 700, marginTop: 4 }}>
                    Low stock
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}

        <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 20, fontSize: 12, color: INK_DIM }}>
          <div>
            Need a new product?{" "}
            <Link
              href={`/nex-native/create/product?business=${encodeURIComponent(businessId)}`}
              style={{ color: ACCENT, textDecoration: "none", fontWeight: 700 }}
            >
              Create one →
            </Link>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <Link
              href="/nex-native/live-commerce/enter-broadcast-room"
              style={{ color: INK_DIM, textDecoration: "none", fontWeight: 700 }}
            >
              Skip · broadcast without a featured product →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function formatPrice(pence: number, currency: string): string {
  const major = pence / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency", currency, maximumFractionDigits: currency === "IDR" ? 0 : 2,
    }).format(major);
  } catch {
    return `${currency} ${major.toLocaleString()}`;
  }
}

const pageStyle: React.CSSProperties = {
  minHeight: "100dvh", background: "#F7F9FC", color: INK,
  fontFamily: "Inter, system-ui, sans-serif", padding: 20,
};
const container: React.CSSProperties = { maxWidth: 760, margin: "0 auto" };
const h1Style: React.CSSProperties = { fontSize: 22, fontWeight: 800, margin: 0, marginBottom: 8 };
const subStyle: React.CSSProperties = { fontSize: 13, color: INK_DIM, marginBottom: 20, lineHeight: 1.5 };
const ctaStyle: React.CSSProperties = {
  display: "inline-block", background: ACCENT, color: "#031018",
  padding: "12px 24px", borderRadius: 999, fontWeight: 800, fontSize: 14, textDecoration: "none",
};
const tileStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "16px 20px", background: "#FFFFFF",
  border: `1.5px solid ${ACCENT}22`, borderRadius: 14,
  color: INK, textDecoration: "none", fontSize: 15,
};
const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
  gap: 12,
};
function marketBadgeStyle(scope: "local" | "export" | "both" | null): React.CSSProperties {
  const palette: Record<Exclude<typeof scope, null>, { bg: string; fg: string }> = {
    local:  { bg: "rgba(16, 32, 51, 0.08)",  fg: INK_DIM },
    export: { bg: "rgba(0, 175, 255, 0.14)", fg: ACCENT },
    both:   { bg: "rgba(16, 214, 107, 0.14)", fg: "#0E8A4A" },
  };
  const p = scope ? palette[scope] : palette.local;
  return {
    display: "inline-block",
    marginTop: 4,
    padding: "2px 8px",
    background: p.bg,
    color: p.fg,
    borderRadius: 999,
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: "0.03em",
  };
}

const productTileStyle: React.CSSProperties = {
  background: "#FFFFFF",
  padding: 12,
  borderRadius: 14,
  border: `1.5px solid ${ACCENT}22`,
  color: INK,
  textDecoration: "none",
  display: "flex",
  flexDirection: "column",
};
