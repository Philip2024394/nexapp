// src/app/nex-native/manage/shop/setup/contact/page.tsx
//
// Shop Setup · Step 7 · Contact + socials.
// Owner-authorised 2026-11-06.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { ContactStepClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function ShopSetupContactPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/shop/setup/contact");
  }
  const businesses = await listBusinessesByOwner(session.account.id);
  const existing = businesses[0];
  if (!existing) {
    redirect("/nex-native/manage/shop/setup/identity");
  }

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-shop-setup-contact
        style={{
          position: "absolute",
          inset: 0,
          background: NEX_BG,
          color: NEX_TEXT,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 18px) 20px calc(env(safe-area-inset-bottom, 0px) + 18px)",
          boxSizing: "border-box",
        }}
      >
        <ContactStepClient
          initial={{
            instagramHandle: existing.instagram_handle ?? "",
            facebookHandle: existing.facebook_handle ?? "",
            tiktokHandle: existing.tiktok_handle ?? "",
            websiteUrl: existing.website_url ?? "",
            publicPhone: existing.public_phone ?? "",
            publicEmail: existing.public_email ?? "",
          }}
        />
      </main>
    </>
  );
}
