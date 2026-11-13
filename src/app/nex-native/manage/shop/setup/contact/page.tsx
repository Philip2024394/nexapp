// src/app/nex-native/manage/shop/setup/contact/page.tsx
//
// Shop Setup · Step 7 · Contact + socials.
// Owner-authorised 2026-11-06 · profile pre-fill 2026-11-12.
// -----------------------------------------------------------------------------
// Pre-fill rule (owner-sealed 2026-11-12):
//   Shop social fields are populated from the owner's Chat profile ONLY
//   when the shop field is empty. If the seller has already typed a
//   Shop-specific value, we leave it alone. Shop edits NEVER write back
//   to the Chat profile · nex_account_profile stays untouched.
//
// Covered handles: Instagram · Facebook · TikTok · X. YouTube is in the
// Chat profile but not yet a shop column · the field is intentionally
// omitted from the shop form today. Contact number / email / website
// are shop-specific and NOT pre-filled from the personal profile.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { getProfileByAccountId } from "@/lib/nex-native/account-profile-service";
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

  // Load the Chat profile so we can pre-fill empty shop social fields.
  // `getProfileByAccountId` reads nex_account_profile · it is a READ-
  // ONLY call here · nothing writes back to it from this page.
  const profile = await getProfileByAccountId(session.account.id);

  // Pre-fill helper · returns {value, copiedFromProfile} so the client
  // can show a small badge on each chat-sourced field. Shop value wins
  // when non-empty · otherwise fall back to chat profile · otherwise "".
  function preFill(
    shopValue: string | null | undefined,
    chatValue: string | null | undefined,
  ): { value: string; copiedFromProfile: boolean } {
    const shop = (shopValue ?? "").trim();
    if (shop.length > 0) return { value: shop, copiedFromProfile: false };
    const chat = (chatValue ?? "").trim();
    if (chat.length > 0) return { value: chat, copiedFromProfile: true };
    return { value: "", copiedFromProfile: false };
  }

  const ig = preFill(existing.instagram_handle, profile?.instagram_handle);
  const fb = preFill(existing.facebook_handle, profile?.facebook_handle);
  const tt = preFill(existing.tiktok_handle, profile?.tiktok_handle);
  const x = preFill(existing.x_handle, profile?.x_handle);

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
            instagramHandle: ig.value,
            facebookHandle: fb.value,
            tiktokHandle: tt.value,
            xHandle: x.value,
            websiteUrl: existing.website_url ?? "",
            publicPhone: existing.public_phone ?? "",
            publicEmail: existing.public_email ?? "",
          }}
          copiedFromProfile={{
            instagramHandle: ig.copiedFromProfile,
            facebookHandle: fb.copiedFromProfile,
            tiktokHandle: tt.copiedFromProfile,
            xHandle: x.copiedFromProfile,
          }}
          profileYoutubeHandle={profile?.youtube_handle ?? null}
        />
      </main>
    </>
  );
}
