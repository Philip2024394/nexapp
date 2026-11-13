// src/app/nex-native/manage/shop/intro/page.tsx
//
// NEX Shop · "Chat intro message" editor · owner-sealed 2026-11-13.
// -----------------------------------------------------------------------------
// Dedicated focused editor for `nex_business.shop_intro_message` (mig 344).
// Reached from the Shop Management Centre hub at /nex-native/manage.
//
// Visitors see this message as the shop owner's first chat bubble when they
// open the public shop chat. When the field is blank, visitors see the
// default template with the shop's display name substituted automatically.
//
// Shell: same cream + gold wave backdrop + 360 phone-frame scroll pattern
// as /manage and /manage/share so the Shop Settings surface reads as one
// design family.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import {
  resolveShopIntroMessage,
  SHOP_INTRO_MESSAGE_MAX,
} from "@/lib/nex-native/business-service";
import { NexPageHeader } from "../../../_page-header";
import { saveShopIntroMessageAction } from "./_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_BG = "#F5EDD3";
const INK = "#0A0608";
const INK_MUTE = "#7D5A3A";
const ACCENT = "#FF7200";

export default async function ShopIntroEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; e?: string; m?: string }>;
}): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/shop/intro");
  }
  const businesses = await listBusinessesByOwner(session.account.id);
  const business = businesses[0];
  if (!business) {
    redirect("/nex-native/manage/shop/setup");
  }

  const sp = await searchParams;
  const banner =
    sp.s === "saved"
      ? { tone: "ok" as const, text: "Intro saved · visitors will see this bubble first" }
      : sp.e
        ? { tone: "err" as const, text: sp.m ? `Save failed · ${sp.m}` : "Save failed" }
        : null;

  const stored = business.shop_intro_message ?? "";
  const previewText = resolveShopIntroMessage(business);
  const isUsingDefault = stored.trim().length === 0;

  return (
    <main
      data-nex-shop-intro-editor
      style={{
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        backgroundColor: PAGE_BG,
        backgroundImage: "url(/nex-native/cream-gold-wave-bg.png)",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        backgroundPosition: "top center",
        backgroundAttachment: "local",
        color: INK,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: "16px 20px 32px",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <NexPageHeader dataScope="manage-shop-intro" />

        <header style={{ margin: "20px 0 6px", textAlign: "center" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: ACCENT,
            }}
          >
            Chat intro message
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 12,
              color: INK_MUTE,
              lineHeight: 1.5,
            }}
          >
            The first bubble visitors see when they tap the Chat button on
            your shop. Keep it warm · they haven&apos;t talked to you yet.
          </p>
        </header>

        {banner ? (
          <div
            role="status"
            style={{
              margin: "14px 0 0",
              padding: "10px 14px",
              background: "#F5EDD3",
              border: `1px solid ${banner.tone === "err" ? "#D82A2A" : ACCENT}`,
              borderRadius: 10,
              color: banner.tone === "err" ? "#7F1D1D" : ACCENT,
              fontSize: 12,
              fontWeight: 800,
              textAlign: "center",
              letterSpacing: "0.02em",
            }}
          >
            {banner.text}
          </div>
        ) : null}

        <div style={{ height: 14 }} />

        {/* Live preview bubble · shows exactly what visitors will see. */}
        <div
          data-nex-shop-intro-preview
          style={{
            margin: "0 0 14px",
            padding: "14px 16px",
            background: "#FFFFFF",
            border: `1px solid ${ACCENT}`,
            borderRadius: 16,
            color: INK,
            fontSize: 14,
            lineHeight: 1.5,
            boxShadow: "0 2px 8px rgba(255, 114, 0, 0.12)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: INK_MUTE,
              marginBottom: 6,
            }}
          >
            Preview · what visitors see
          </div>
          {previewText}
          {isUsingDefault ? (
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: INK_MUTE,
                fontStyle: "italic",
              }}
            >
              Using the default template · edit below to make it your own.
            </div>
          ) : null}
        </div>

        <form action={saveShopIntroMessageAction}>
          <label
            htmlFor="intro-textarea"
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: INK_MUTE,
              marginBottom: 6,
            }}
          >
            Your intro
          </label>
          <textarea
            id="intro-textarea"
            name="intro"
            defaultValue={stored}
            maxLength={SHOP_INTRO_MESSAGE_MAX}
            rows={5}
            placeholder={`Hi! Welcome to ${business.display_name}. Thanks for visiting our shop. If you have any questions about our products, prices or services, just send us a message. We're happy to help!`}
            style={{
              width: "100%",
              padding: "14px 16px",
              background: "#FFFFFF",
              border: "1px solid rgba(42, 31, 15, 0.22)",
              borderRadius: 12,
              color: INK,
              fontSize: 14,
              lineHeight: 1.5,
              resize: "vertical",
              fontFamily: "inherit",
              boxShadow: "0 1px 3px rgba(42, 31, 15, 0.08)",
            }}
          />
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: INK_MUTE,
              textAlign: "right",
              letterSpacing: "0.02em",
            }}
          >
            Up to {SHOP_INTRO_MESSAGE_MAX} characters · leave blank to use the
            default template
          </div>

          <div style={{ height: 14 }} />

          <button
            type="submit"
            data-nex-shop-intro-save
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              padding: "14px 16px",
              borderRadius: 14,
              background: ACCENT,
              color: "#FFFFFF",
              border: "none",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(255, 114, 0, 0.25)",
            }}
          >
            Save intro
          </button>
        </form>

        <div
          style={{
            marginTop: 24,
            textAlign: "center",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: INK_MUTE,
          }}
        >
          Powered by NEX
        </div>
      </div>
    </main>
  );
}
