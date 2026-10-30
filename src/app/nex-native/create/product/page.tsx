// src/app/nex-native/create/product/page.tsx
//
// Shared Create Product entry · Phase 1 of the Product System
// Implementation Contract (sealed 2026-10-30, §K owner-resolved).
//
// Owner picks a business (if multi-business) · then routes to the
// category picker. Zero businesses → onboarding redirect.
//
// §K.7 · 30-day device-level persistence of last-chosen business is
// handled client-side in the business picker component (localStorage).
// Server here just resolves the owner's businesses + hands off.

import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";

export const dynamic = "force-dynamic";

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";

export default async function CreateProductEntryPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=" + encodeURIComponent("/nex-native/create/product"));
  }

  let businesses: Array<{ id: string; name: string; slug: string }> = [];
  try {
    const raw = await listBusinessesByOwner(session.account.id);
    businesses = raw.map((b) => ({ id: b.id, name: b.display_name, slug: b.slug }));
  } catch {
    businesses = [];
  }

  // Zero businesses → onboarding
  if (businesses.length === 0) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          background: "#F7F9FC",
          color: INK,
          fontFamily: "Inter, system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          gap: 20,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Create a shop first</h1>
        <p style={{ fontSize: 14, color: INK_DIM, maxWidth: 420, textAlign: "center", lineHeight: 1.5 }}>
          You need a NEX business before you can create products. The onboarding will set one up and bring you back here.
        </p>
        <Link
          href="/nex-native/onboarding"
          style={{
            background: ACCENT, color: "#031018", padding: "12px 24px", borderRadius: 999,
            fontWeight: 800, fontSize: 14, textDecoration: "none",
          }}
        >
          Start onboarding
        </Link>
      </main>
    );
  }

  // Single business → auto-forward to category picker
  if (businesses.length === 1) {
    redirect(`/nex-native/create/product/category?business=${encodeURIComponent(businesses[0]!.id)}`);
  }

  // Multiple businesses → render picker
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#F7F9FC",
        color: INK,
        fontFamily: "Inter, system-ui, sans-serif",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, marginBottom: 8 }}>Which shop?</h1>
        <p style={{ fontSize: 13, color: INK_DIM, marginBottom: 24, lineHeight: 1.5 }}>
          Choose the business this product belongs to. You can change this later from the product's Edit page.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`/nex-native/create/product/category?business=${encodeURIComponent(b.id)}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                background: "#FFFFFF",
                border: `1.5px solid ${ACCENT}22`,
                borderRadius: 14,
                color: INK,
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              <span>{b.name}</span>
              <span style={{ color: ACCENT, fontSize: 20 }}>→</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
