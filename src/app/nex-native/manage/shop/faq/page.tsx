// src/app/nex-native/manage/shop/faq/page.tsx
//
// NEX Seller FAQ · owner-facing editor. Owner directive 2026-11-17.
// -----------------------------------------------------------------------------
// Renders inside .nex-native-stage so the active world theme (Ireland
// Cream Team / Worldwide / etc.) cascades automatically through
// `var(--nex-world-*)` without this page having to hard-code colours.
//
// Server responsibilities:
//   · resolve the viewer (dev-override enabled so Nex-99901 can
//     author without being bounced to sign-in)
//   · pick the viewer's business (first one owned, matching other
//     /manage/shop/* surfaces)
//   · load existing info_pages so the editor can seed from the
//     starter bank MERGED with the owner's already-saved entries
//
// Client responsibilities (see _faq-editor-client.tsx):
//   · let the owner tick/untick, reword, reorder, add custom, publish
//   · submit via FormData → saveShopFaqAction

import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as businessService from "@/lib/nex-native/business-service";
import { getInfoPages } from "@/lib/nex-native/info-pages-service";
import type { NexInfoFaqItem } from "@/lib/nex-native/info-pages";
import { NEX_FAQ_STARTER_BANK } from "./_starter-bank";
import { FaqEditorClient } from "./_faq-editor-client";
import { saveShopFaqAction } from "./_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FaqPageProps {
  readonly searchParams?: Promise<{ e?: string; m?: string }>;
}

export default async function FaqPage(props: FaqPageProps): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect(
      "/nex-native/sign-in?next=" +
        encodeURIComponent("/nex-native/manage/shop/faq"),
    );
  }

  const businesses = await businessService.listBusinessesByOwner(
    session.account.id,
  );
  if (businesses.length === 0) {
    // Non-owners land on the shop-setup flow · same convention as
    // /manage/shop/page.tsx.
    redirect("/nex-native/manage/shop/setup");
  }

  const business = businesses[0];
  const info = await getInfoPages(business.id);

  // Seed path: build the initial list by MERGING the owner's saved
  // entries with the starter bank. Saved starters keep their current
  // question/answer/enabled/order; unsaved starters append (core
  // first, then optional) in bank order so a brand-new shop sees the
  // directive-defined default state without any extra DB writes.
  const seeded = seedInitialList(info?.faq_items ?? []);

  const banner = await props.searchParams;
  const bannerLevel = banner?.e;
  const bannerMsg = banner?.m ? decodeURIComponent(banner.m) : null;

  const bindSave = saveShopFaqAction.bind(null, business.id);

  return (
    <main
      className="nex-native-stage"
      style={{
        minHeight: "100vh",
        padding: "20px 16px 100px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        color: "var(--nex-world-text-primary, #F2F5F8)",
        background:
          "var(--nex-world-background-base, linear-gradient(180deg, #020914 0%, #050f1e 100%))",
        fontFamily:
          "var(--nex-font-sans, system-ui, -apple-system, sans-serif)",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link
          href="/nex-native/manage"
          aria-label="Back to shop centre"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 999,
            background: "var(--nex-world-surface, rgba(255,255,255,0.06))",
            color: "var(--nex-world-text-primary, #F2F5F8)",
            textDecoration: "none",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          ←
        </Link>
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            flex: 1,
            minWidth: 0,
          }}
        >
          FAQ
        </h1>
      </header>

      <section
        style={{
          background: "var(--nex-world-surface, rgba(255,255,255,0.04))",
          border:
            "1px solid var(--nex-world-border, rgba(139,169,209,0.14))",
          borderRadius: 12,
          padding: "14px 14px",
          lineHeight: 1.45,
          fontSize: 14,
          color: "var(--nex-world-text-secondary, #B5C3D6)",
        }}
      >
        <p style={{ margin: 0 }}>
          <strong
            style={{ color: "var(--nex-world-text-primary, #F2F5F8)" }}
          >
            Answer once, save hours.
          </strong>{" "}
          Your published answers appear automatically as tappable quick
          answers at the top of every customer chat with your shop, so
          you never have to type the same reply again. Only answered,
          published entries are shown to customers &mdash; unanswered
          questions stay hidden.
        </p>
      </section>

      {bannerMsg ? (
        <div
          role="status"
          style={{
            background:
              bannerLevel === "faq_err"
                ? "rgba(255,83,83,0.12)"
                : "rgba(22,214,107,0.12)",
            border:
              bannerLevel === "faq_err"
                ? "1px solid rgba(255,83,83,0.40)"
                : "1px solid rgba(22,214,107,0.40)",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 13,
            color: "var(--nex-world-text-primary, #F2F5F8)",
          }}
        >
          {bannerMsg}
        </div>
      ) : null}

      <FaqEditorClient
        initialEntries={seeded}
        saveAction={bindSave}
        shopDisplayName={business.display_name}
      />
    </main>
  );
}

/** Merge saved entries with the starter bank.
 *  - Saved entries first, in the order the owner persisted them.
 *  - Then any starter-bank entries the owner hasn't saved yet, in
 *    bank order (core before optional).
 *  - Starter default-enabled drives the initial toggle only for
 *    starters that have no saved row yet; saved rows keep their
 *    on-disk enabled flag. */
function seedInitialList(saved: NexInfoFaqItem[]): NexInfoFaqItem[] {
  const savedById = new Map<string, NexInfoFaqItem>();
  for (const row of saved) {
    savedById.set(row.id, row);
  }
  const out: NexInfoFaqItem[] = [];
  // Saved entries in persisted order.
  for (const row of saved) {
    out.push({
      id: row.id,
      enabled: row.enabled === false ? false : true,
      question: row.question,
      answer: row.answer ?? "",
    });
  }
  // Append starter-bank entries not yet saved.
  for (const starter of NEX_FAQ_STARTER_BANK) {
    if (savedById.has(starter.id)) continue;
    out.push({
      id: starter.id,
      enabled: starter.defaultEnabled,
      question: starter.question,
      answer: "",
    });
  }
  return out;
}
