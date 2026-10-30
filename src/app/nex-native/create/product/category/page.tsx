// src/app/nex-native/create/product/category/page.tsx
//
// Shared category picker · Phase 1 Product System.
//
// Reads the sealed 30-dept taxonomy from
// src/lib/nex-native/catalogue/departments.ts and uses the sealed
// isCategorySpecRegistered() to decide which sub-categories are
// selectable right now. Fashion & Clothing is Phase 1 pilot per §K.1.
// Other departments graduate as their batch per §I.5 ships a Zod spec.
//
// Non-registered departments render a disabled tile with a sealed
// "Coming soon" message. The sealed Watches entry at
// /manage/watches/new continues to work until Phase 4 reconciliation.

import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { DEPARTMENTS } from "@/lib/nex-native/catalogue/departments";
import { isCategorySpecRegistered } from "@/lib/nex-native/catalogue/specs";

export const dynamic = "force-dynamic";

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";
const DISABLED_INK = "#8BA9D1";

export default async function CreateProductCategoryPage({
  searchParams,
}: {
  searchParams: Promise<{ business?: string; dept?: string }>;
}): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=" + encodeURIComponent("/nex-native/create/product"));
  }

  const { business, dept } = await searchParams;
  if (!business) {
    redirect("/nex-native/create/product");
  }

  let owned: Array<{ id: string }>;
  try {
    const raw = await listBusinessesByOwner(session.account.id);
    owned = raw.map((b) => ({ id: b.id }));
  } catch {
    owned = [];
  }
  if (!owned.some((b) => b.id === business)) {
    redirect("/nex-native/create/product");
  }

  // Second-level view · a department was chosen · show its sub-categories
  if (dept) {
    const department = DEPARTMENTS.find((d) => d.id === dept);
    if (!department) {
      redirect(`/nex-native/create/product/category?business=${encodeURIComponent(business!)}`);
    }
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>
          <Link
            href={`/nex-native/create/product/category?business=${encodeURIComponent(business!)}`}
            style={backLink}
          >
            ← Change department
          </Link>
          <h1 style={h1Style}>{department!.label}</h1>
          <p style={subStyle}>{department!.blurb}</p>
          <div style={gridStyle}>
            {department!.categories.map((c) => {
              const enabled = isCategorySpecRegistered(department!.id, c.id);
              return enabled ? (
                <Link
                  key={c.id}
                  href={`/nex-native/create/product/form?business=${encodeURIComponent(business!)}&dept=${encodeURIComponent(department!.id)}&cat=${encodeURIComponent(c.id)}`}
                  style={tileEnabledStyle}
                >
                  <span style={tileLabelStyle}>{c.label}</span>
                  <span style={{ color: ACCENT }}>→</span>
                </Link>
              ) : (
                <div
                  key={c.id}
                  aria-disabled
                  style={tileDisabledStyle}
                  title="Coming in a future batch"
                >
                  <span style={{ ...tileLabelStyle, color: DISABLED_INK }}>{c.label}</span>
                  <span style={{ color: DISABLED_INK, fontSize: 11, fontWeight: 700 }}>Soon</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  // Top-level view · pick a department
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <Link href="/nex-native/create/product" style={backLink}>
          ← Change shop
        </Link>
        <h1 style={h1Style}>Pick a department</h1>
        <p style={subStyle}>
          Choose the right home for your product. Fields and specifications adapt to each
          category.
        </p>
        <div style={gridStyle}>
          {DEPARTMENTS.map((d) => {
            const anyCategoryEnabled = d.categories.some((c) =>
              isCategorySpecRegistered(d.id, c.id),
            );
            return anyCategoryEnabled ? (
              <Link
                key={d.id}
                href={`/nex-native/create/product/category?business=${encodeURIComponent(business!)}&dept=${encodeURIComponent(d.id)}`}
                style={tileEnabledStyle}
              >
                <span style={tileLabelStyle}>{d.label}</span>
                <span style={{ fontSize: 11, color: INK_DIM, fontWeight: 600 }}>{d.blurb}</span>
                <span style={{ color: ACCENT, alignSelf: "flex-end" }}>→</span>
              </Link>
            ) : (
              <div
                key={d.id}
                aria-disabled
                style={tileDisabledStyle}
                title="Coming in a future batch"
              >
                <span style={{ ...tileLabelStyle, color: DISABLED_INK }}>{d.label}</span>
                <span style={{ fontSize: 11, color: DISABLED_INK, fontWeight: 600 }}>{d.blurb}</span>
                <span style={{ color: DISABLED_INK, fontSize: 11, fontWeight: 700, alignSelf: "flex-end" }}>
                  Soon
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100dvh",
  background: "#F7F9FC",
  color: INK,
  fontFamily: "Inter, system-ui, sans-serif",
  padding: 24,
};

const containerStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
};

const backLink: React.CSSProperties = {
  display: "inline-block",
  marginBottom: 12,
  color: ACCENT,
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 700,
};

const h1Style: React.CSSProperties = { fontSize: 22, fontWeight: 800, margin: 0, marginBottom: 8 };

const subStyle: React.CSSProperties = {
  fontSize: 13,
  color: INK_DIM,
  marginBottom: 20,
  lineHeight: 1.5,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 10,
};

const tileEnabledStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "16px 18px",
  background: "#FFFFFF",
  border: `1.5px solid ${ACCENT}22`,
  borderRadius: 14,
  color: INK,
  textDecoration: "none",
  minHeight: 72,
};

const tileDisabledStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "16px 18px",
  background: "#F0F3F8",
  border: `1.5px solid ${DISABLED_INK}22`,
  borderRadius: 14,
  color: DISABLED_INK,
  minHeight: 72,
};

const tileLabelStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
};
