// src/app/nex-native/packages/page.tsx
//
// NEX Packages · public pricing page. Matches the shop landing
// aesthetic (dark navy · serif display · orange CTA · cyan
// eyebrows) so the whole /nex-native surface reads as one product.
//
// Two seller tiers side by side · Gratis (free forever) and Bisnis
// (IDR 99k/mo). Optional buyer-paid services listed below · FAQ at
// the bottom. No login required to view · the CTAs route into the
// existing create-account / upgrade flows.
//
// Sealed 2026-09-27.

import type * as React from "react";
import Link from "next/link";
// Owner directive 2026-11-05 iter 29 · Ship B3 · Stripe Checkout
// client helper · wraps the sealed /api/nex-native/billing/checkout
// endpoint + redirects to the Stripe-hosted session URL.
import { StartCheckoutButton } from "@/components/nex-native/billing/start-checkout-client";
// Owner directive 2026-11-05 iter 29 · Ship B3b · parallel client
// helper for the ONE-TIME Starter Pack purchase. Different endpoint,
// different flow, same fail-safe toast vocabulary.
import { StarterPackCheckoutButton } from "@/components/nex-native/billing/starter-pack-checkout-client";
import { NEX_OFFICIAL_CHAT_HREF } from "@/lib/nex-native/nex-official";
import { NexPageHeader } from "../_page-header";

export const dynamic = "force-static";

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
  cyanSoft: "rgba(0,175,255,0.5)",
  orange: "#FF7200",
  orangeSoft: "rgba(255,114,0,0.6)",
  green: "#16D66B",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default function PackagesPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
      }}
    >
      {/* --- HEADER · shared NEX chrome ----------------------------- */}
      <div style={{ padding: "0 14px" }}>
        <NexPageHeader dataScope="packages" />
      </div>

      {/* --- HERO --------------------------------------------------- */}
      <section
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "24px 20px 8px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          NEX Packages
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontWeight: 500,
            fontSize: "clamp(34px, 7vw, 52px)",
            lineHeight: 1.05,
            letterSpacing: "-0.014em",
            marginBottom: 12,
          }}
        >
          One low price · zero cut of your sales
        </h1>
        <p
          style={{
            margin: "0 auto",
            fontSize: 15,
            lineHeight: 1.6,
            color: "rgba(244,247,252,0.82)",
            maxWidth: 520,
          }}
        >
          NEX doesn&apos;t take a percentage of what you sell.
          <b> Ever.</b> List 10 products free, top up with a one-time
          pack when you need more, or open a NEX Shop for unlimited
          listings with a 7-day free trial.
        </p>
        {/* Bridge 16a · Safe-trade doctrine callout · the reason we
            can charge 0% is because NEX never touches payments.
            Every reader gets one tap to the full explanation. */}
        <Link
          href="/nex-native/safe-trade"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            marginTop: 22,
            padding: "10px 16px",
            borderRadius: 999,
            background: "rgba(22,214,107,0.10)",
            border: "1px solid rgba(22,214,107,0.35)",
            color: "#16D66B",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          🛡 Safe on NEX · how buyers stay protected →
        </Link>
      </section>

      {/* --- PACKAGE CARDS ----------------------------------------- */}
      <section
        style={{
          maxWidth: 780,
          margin: "0 auto",
          padding: "24px 16px 8px",
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 16,
        }}
      >
        {/* Owner directive 2026-11-05 iter 29 · Ship B1 · NEX Ireland
            three-tier model. Grid: 1-col mobile · 2-col tablet · 3-col
            desktop. Sealed PackageCard primitive · zero design drift.
            Stripe wiring is Ship B3-B5 (separate authorised commits) ·
            today the CTAs route through the existing create-account
            with ?intent=* params that the signup flow can read when
            B3 wires checkout session URLs. */}
        <style>{`
          @media (min-width: 640px) {
            [data-nex-package-grid] {
              grid-template-columns: 1fr 1fr !important;
            }
          }
          @media (min-width: 960px) {
            [data-nex-package-grid] {
              grid-template-columns: 1fr 1fr 1fr !important;
            }
          }
        `}</style>
        <div
          data-nex-package-grid
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 16,
          }}
        >
          <PackageCard
            eyebrow="Free forever"
            title="NEX Free"
            priceLabel="€0"
            priceSubline="No card required"
            features={FREE_FEATURES_IE}
            ctaHref="/nex-native/create-account?intent=free"
            ctaLabel="Start free"
            ctaVariant="secondary"
            highlight={false}
          />
          <PackageCard
            eyebrow="One-time top-up"
            title="Starter Pack"
            priceLabel="€5"
            priceSubline="one-time · 10 products · 60 days"
            features={STARTER_PACK_FEATURES_IE}
            ctaHref="/nex-native/create-account?intent=starter_pack"
            ctaLabel="Buy Starter Pack"
            ctaVariant="secondary"
            // Owner directive 2026-11-05 iter 29 · Ship B3b · routes
            // through /api/nex-native/billing/starter-pack-checkout
            // when env is configured · fail-soft "not available yet"
            // toast otherwise.
            starterPack
            highlight={false}
          />
          <PackageCard
            eyebrow="Full power"
            title="NEX Shop"
            priceLabel="€19.99"
            priceSubline="per month · 7-day free trial · €99 / year"
            features={SHOP_FEATURES_IE}
            ctaHref="/nex-native/create-account?intent=shop_trial"
            ctaLabel="Start 7-day free trial"
            ctaVariant="primary"
            // Owner directive 2026-11-05 iter 29 · Ship B3 · Shop
            // monthly CTA routes through the sealed Stripe Checkout
            // endpoint when env vars are configured · gracefully
            // surfaces "Billing not configured yet" when not. Yearly
            // (€99) maps to the sealed `unlimited` tier · yearly
            // selector (B3 follow-up) will give the viewer a choice;
            // today the primary CTA defaults to monthly/`standard`.
            checkoutTier="standard"
            secondaryCta={{
              href: NEX_OFFICIAL_CHAT_HREF,
              label: "💬 Already have an account · chat with NEX",
            }}
            highlight
            badge="Most popular"
          />
        </div>
      </section>

      {/* --- ZERO-CUT PROMISE -------------------------------------- */}
      <section
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "32px 20px 8px",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderRadius: 16,
            background: "rgba(22,214,107,0.08)",
            border: "1px solid rgba(22,214,107,0.3)",
            fontSize: 14,
            lineHeight: 1.6,
            color: "rgba(244,247,252,0.9)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "#B8F1CC",
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            The moat
          </div>
          NEX takes{" "}
          <b style={{ color: "#B8F1CC" }}>0% of every sale</b> on both
          Gratis and Bisnis. A seller doing Rp 100 million a month on
          Shopee pays Rp 7–15 million in fees. On NEX Bisnis they pay
          Rp 99,000. On NEX Gratis they pay nothing.
        </div>
      </section>

      {/* --- OPTIONAL BUYER-PAID SERVICES -------------------------- */}
      <section
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "32px 20px 8px",
        }}
      >
        <SectionHead
          eyebrow="Optional add-ons"
          title="Buyer-paid trust services"
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 12,
          }}
        >
          <AddonCard
            title="NEX SafeTrade"
            fee="20% · paid by the buyer"
            body="Optional inspection service for buyers who want their order physically checked at NEX Center in Yogyakarta before payment is released to the supplier. Supplier receives the full quoted price · buyer pays the fee only if they opt in."
            accent={NEX.orange}
          />
        </div>
      </section>

      {/* --- FAQ --------------------------------------------------- */}
      <section
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "32px 20px 8px",
        }}
      >
        <SectionHead eyebrow="FAQ" title="What you might be wondering" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FaqCard
            q="Will you ever take a cut of my sales?"
            a="No. Not on Gratis, not on Bisnis, not ever. That's the sealed doctrine. NEX only makes money from the flat Bisnis subscription and optional buyer-paid services (SafeTrade). The percentage-of-sale model is what every marketplace does — NEX is deliberately not that."
          />
          <FaqCard
            q="How do I cancel Bisnis?"
            a="Message NEX via the NEX1 support chat. Cancellation is processed manually by NEX while the self-service flow is being built. Once cancelled, your account returns to Gratis: your shop stays live, your products stay listed (subject to the 10-product cap), your chat history stays intact, and your NEX address (yourshop.nex) stays yours. Your reach returns to local — international buyers won't see you in Directory search until you resubscribe."
          />
          <FaqCard
            q="Why is export locked to Bisnis?"
            a="International orders come with higher stakes: customs, freight, currency, dispute cost. Pairing export visibility with Bisnis means international buyers only meet sellers who've committed to running a real business. It's what makes the international directory feel curated rather than open."
          />
          <FaqCard
            q="Can I use SafeTrade on Gratis?"
            a="Yes. SafeTrade is available to every seller regardless of tier. It's a buyer choice, buyer-paid, and doesn't affect your subscription."
          />
          <FaqCard
            q="Do I have to pay to accept COD or bank transfer?"
            a="No. Every payment method — COD, bank transfer, e-wallet, QRIS, in-person cash — works on both tiers with zero commission. NEX doesn't touch the transaction."
          />
        </div>
      </section>

      {/* --- FOOTER ------------------------------------------------ */}
      <footer
        style={{
          padding:
            "48px 20px calc(env(safe-area-inset-bottom, 0) + 40px)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: NEX.textMute,
            fontWeight: 700,
          }}
        >
          Powered by NEX
        </div>
        <div
          style={{
            fontSize: 11,
            color: NEX.textMute,
            marginTop: 8,
          }}
        >
          <Link
            href="/nex-native/about"
            style={{ color: NEX.cyan, textDecoration: "none" }}
          >
            What is NEX?
          </Link>
        </div>
      </footer>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Package cards
 * ──────────────────────────────────────────────────────────────── */

interface FeatureRow {
  label: string;
  on: boolean;
  hint?: string;
  /** One-line plain-English explanation shown under the label so
   *  visitors don't have to guess what each capability actually
   *  gives them. Sealed 2026-09-28. */
  explain?: string;
}

// Owner directive 2026-11-05 iter 29 · Ship B1 · NEX Ireland three
// tier content. Sealed GRATIS_FEATURES + BISNIS_FEATURES below are
// retained (Indonesia market · nex-original · future unlock). Only
// the CARD GRID above uses these three Ireland lists.
//
// Doctrine honoured:
//   · Sealed "NEX never takes commission" called out on every tier.
//   · Sealed Package Contract DRAFT 2026-10-20 · 3 unimplemented
//     claims (verified badge · 20 boosted messages · cancel-any-
//     time) are NOT listed anywhere.
//   · 10-product cap on Free tier = sealed tier-gate.ts Gratis cap.
//   · 7-day trial on Shop tier = sealed trial doctrine pattern.
//
// Stripe wiring + real purchase flow = Ship B3-B5 (separate commits).

const FREE_FEATURES_IE: FeatureRow[] = [
  {
    label: "0% commission on every sale",
    on: true,
    explain: "NEX never takes a percentage of what you sell · ever.",
  },
  {
    label: "List up to 10 products",
    on: true,
    explain:
      "Enough to try NEX Live, find your first customers, and decide if a Shop is right for you.",
  },
  {
    label: "Shareable shop URL (nex.com/your-shop)",
    on: true,
    explain:
      "Your public shop cover · post the link on socials or share into chats.",
  },
  {
    label: "Chat shop drawer",
    on: true,
    explain:
      "Share any product into a chat in one tap · customers tap to view + checkout with you directly.",
  },
  {
    label: "NEX Live feed placement",
    on: true,
    explain:
      "Your products can appear in the NEX Live feed as shoppable-card overlays on your videos.",
  },
  {
    label: "Analytics + priority placement",
    on: false,
    explain: "Unlock these by opening a NEX Shop below.",
  },
];

const STARTER_PACK_FEATURES_IE: FeatureRow[] = [
  {
    label: "0% commission on every sale",
    on: true,
    explain: "Same no-cut promise as every tier · forever.",
  },
  {
    label: "10 more products (20 total)",
    on: true,
    explain:
      "One-time top-up · no subscription · lasts 60 days from purchase.",
  },
  {
    label: "Everything in NEX Free",
    on: true,
    explain:
      "Shareable shop URL · chat shop drawer · NEX Live placement.",
  },
  {
    label: "Perfect for Christmas markets, event sellers, hobby stock",
    on: true,
    explain:
      "No commitment · if you're not posting regularly, you pay nothing after day 60.",
  },
  {
    label: "Analytics + priority placement",
    on: false,
    explain: "Unlock these by opening a NEX Shop below.",
  },
];

const SHOP_FEATURES_IE: FeatureRow[] = [
  {
    label: "0% commission on every sale",
    on: true,
    explain:
      "Still no-cut · your €19.99/mo is the only thing NEX ever charges.",
  },
  {
    label: "Unlimited product listings",
    on: true,
    explain: "List as many products as you can ship · no caps.",
  },
  {
    label: "7-day free trial",
    on: true,
    explain:
      "Try everything · cancel any time in Settings before day 8 · no charge.",
  },
  {
    label: "Shop analytics + CSV export",
    on: true,
    explain:
      "Visitor + chat + order stats · last 90 days · export for your accountant.",
  },
  {
    label: "Priority placement in NEX Live",
    on: true,
    explain:
      "Your shoppable videos surface earlier in the feed vs. Free-tier sellers.",
  },
  {
    label: "Cancel any time · clear monthly or yearly",
    on: true,
    explain:
      "Monthly €19.99 or yearly €99 (17% saving). Self-serve cancel in /settings/billing.",
  },
];

const GRATIS_FEATURES: FeatureRow[] = [
  {
    label: "0% commission on every sale",
    on: true,
    explain:
      "NEX never takes a percentage of what you sell · a Rp 285 million camera pays you Rp 285 million.",
  },
  {
    label: "Full chat + relationships",
    on: true,
    explain:
      "Every message with a buyer is preserved · the conversation itself is your receipt.",
  },
  {
    label: "10 products listed",
    on: true,
    explain:
      "Showcase up to 10 items on your shop page at a time.",
  },
  {
    label: "3 posts per week",
    on: true,
    explain:
      "Announcements, restock alerts, or promotions you push to your NEX followers.",
  },
  {
    label: "100 email subscribers",
    on: true,
    explain:
      "Capture buyer emails from a small \"Get updates\" signup on your shop · blast new arrivals or Ramadan sales to up to 100 contacts.",
  },
  {
    label: "20 AI replies per day",
    on: true,
    explain:
      "NEX AI auto-replies to buyers when you're away · holding messages (\"back in 3 hours\") or common Q&A from your product data. 20 auto-replies daily.",
  },
  {
    label: "1 business",
    on: true,
    explain:
      "One shop under your account · e.g. yourshop.nex. Second and third shops need Bisnis.",
  },
  {
    label: "7-day analytics window",
    on: true,
    explain:
      "See visitor, chat-open, and order stats for the last 7 days. Older history + CSV export are Bisnis.",
  },
  {
    label: "COD · bank · e-wallet · SafeTrade opt-in",
    on: true,
    explain:
      "All payment methods available: cash on delivery, bank transfer, GoPay / DANA / OVO / QRIS, plus SafeTrade if a buyer opts in.",
  },
  {
    label: "No priority customer service",
    on: false,
    explain:
      "Community + docs only · Bisnis unlocks direct NEX support with a same-business-day reply.",
  },
  {
    label: "Custom name.nex address",
    on: false,
    hint: "Bisnis unlock",
    explain:
      "Own aisha.nex directly instead of the long aisha-vintage-cameras.nex slug.",
  },
  {
    label: "Featured chip in directory",
    on: false,
    hint: "Bisnis unlock",
    explain:
      "Your shop appears above free listings in NEX Directory search results.",
  },
  {
    label: "International (export) visibility",
    on: false,
    hint: "Bisnis unlock",
    explain:
      "Appear in international buyer searches. Gratis sellers stay local-only by doctrine.",
  },
  {
    label: "Unlimited products + posts + AI",
    on: false,
    hint: "Bisnis unlock",
    explain:
      "No caps on catalogue size, weekly posts, email subscribers, or AI replies.",
  },
];

const BISNIS_FEATURES: FeatureRow[] = [
  {
    label: "0% commission on every sale",
    on: true,
    explain: "Same doctrine as Gratis · NEX never takes a percentage.",
  },
  {
    label: "Everything in Gratis",
    on: true,
    explain: "Chat, relationships, all payment methods · plus everything below.",
  },
  {
    label: "Unlimited products + posts + email subs + AI",
    on: true,
    explain:
      "All Gratis caps lifted: uncapped catalogue, posts, email list, and AI auto-replies.",
  },
  {
    label: "Custom name.nex address (yourshop.nex)",
    on: true,
    explain:
      "Direct address like aisha.nex without the slug · easier to share, better in bios.",
  },
  {
    label: "Featured chip · sorts above free listings",
    on: true,
    explain:
      "Priority placement in every Directory search result · you're seen first.",
  },
  {
    label: "International (export) reach unlocked",
    on: true,
    explain:
      "Appear in international buyer searches worldwide · doctrine reserves export for Bisnis.",
  },
  {
    label: "Full analytics + CSV export",
    on: true,
    explain:
      "Track months of trend data on the dashboard · download for your own bookkeeping.",
  },
  {
    label: "Up to 5 businesses under one account",
    on: true,
    explain:
      "Run separate shops for different product lines under one login (e.g. cameras + lenses + prints).",
  },
  {
    label: "Priority customer service",
    on: true,
    explain:
      "Direct NEX support · same-business-day reply on account, payment, and Directory questions.",
  },
  {
    label: "SafeTrade eligible for cross-region orders",
    on: true,
    explain:
      "Buyers can opt into NEX Center inspection in Yogyakarta before releasing payment · higher-value trade unlocks.",
  },
];

function PackageCard({
  eyebrow,
  title,
  priceLabel,
  priceSubline,
  features,
  ctaHref,
  ctaLabel,
  ctaVariant,
  secondaryCta,
  highlight,
  badge,
  checkoutTier,
  starterPack,
}: {
  eyebrow: string;
  title: string;
  priceLabel: string;
  priceSubline: string;
  features: FeatureRow[];
  ctaHref: string;
  ctaLabel: string;
  ctaVariant: "primary" | "secondary";
  /** Optional secondary link rendered under the primary CTA · Bridge 32c
   *  uses this to offer "chat with NEX" as an alternate upgrade path for
   *  users who already have an account. */
  secondaryCta?: { href: string; label: string };
  highlight: boolean;
  badge?: string;
  /** Owner directive 2026-11-05 iter 29 · Ship B3 · when set, the
   *  primary CTA POSTs to the sealed billing checkout endpoint and
   *  redirects to Stripe instead of a plain Link navigation. Null
   *  (or omitted) keeps the sealed Link behaviour (used by Free
   *  tier until B3b wires Starter Pack). Mutually exclusive with
   *  `starterPack` below. */
  checkoutTier?: "standard" | "unlimited" | null;
  /** Owner directive 2026-11-05 iter 29 · Ship B3b · when true, the
   *  primary CTA POSTs to /api/nex-native/billing/starter-pack-
   *  checkout for the one-time €5 top-up. Mutually exclusive with
   *  `checkoutTier` by convention. */
  starterPack?: boolean;
}) {
  return (
    <div
      style={{
        position: "relative",
        padding: "22px 20px 22px",
        borderRadius: 20,
        background: highlight
          ? "linear-gradient(180deg, rgba(255,114,0,0.08) 0%, rgba(6,15,28,0.85) 40%, rgba(3,10,20,0.9) 100%)"
          : NEX.panelSoft,
        border: highlight
          ? `1px solid ${NEX.orangeSoft}`
          : `1px solid ${NEX.border}`,
        boxShadow: highlight
          ? "0 24px 60px rgba(0,0,0,0.5), 0 0 40px rgba(255,114,0,0.14), inset 0 1px 0 rgba(255,255,255,0.05)"
          : "0 12px 32px rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {badge && (
        <div
          style={{
            position: "absolute",
            top: -12,
            left: 20,
            padding: "5px 12px",
            borderRadius: 999,
            background: NEX.orange,
            color: "#0B0F1A",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            boxShadow: "0 6px 16px rgba(255,114,0,0.4)",
          }}
        >
          {badge}
        </div>
      )}
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: highlight ? NEX.orange : NEX.cyan,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {eyebrow}
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: SERIF,
          fontWeight: 500,
          fontSize: 34,
          letterSpacing: "-0.01em",
          lineHeight: 1.1,
          marginBottom: 14,
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: highlight ? NEX.orange : NEX.text,
            letterSpacing: "-0.01em",
          }}
        >
          {priceLabel}
        </div>
        {title === "Bisnis" && (
          <div style={{ fontSize: 14, color: NEX.textDim }}>/ month</div>
        )}
      </div>
      <div
        style={{
          fontSize: 12,
          color: NEX.textDim,
          marginBottom: 20,
        }}
      >
        {priceSubline}
      </div>

      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          flex: 1,
        }}
      >
        {features.map((f) => (
          <FeatureItem key={f.label} feature={f} />
        ))}
      </ul>

      {starterPack ? (
        <StarterPackCheckoutButton
          style={{
            display: "block",
            width: "100%",
            marginTop: 22,
            padding: "14px 16px",
            borderRadius: 12,
            background:
              ctaVariant === "primary"
                ? "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)"
                : "rgba(0,175,255,0.14)",
            border:
              ctaVariant === "primary"
                ? `1px solid ${NEX.orangeSoft}`
                : `1px solid ${NEX.cyanSoft}`,
            color: ctaVariant === "primary" ? "#0B0F1A" : NEX.text,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textAlign: "center",
            boxShadow:
              ctaVariant === "primary"
                ? "0 10px 26px rgba(255,114,0,0.4), inset 0 1px 0 rgba(255,255,255,0.28)"
                : "none",
          }}
        >
          {ctaLabel}
        </StarterPackCheckoutButton>
      ) : checkoutTier ? (
        <StartCheckoutButton
          tier={checkoutTier}
          style={{
            display: "block",
            width: "100%",
            marginTop: 22,
            padding: "14px 16px",
            borderRadius: 12,
            background:
              ctaVariant === "primary"
                ? "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)"
                : "rgba(0,175,255,0.14)",
            border:
              ctaVariant === "primary"
                ? `1px solid ${NEX.orangeSoft}`
                : `1px solid ${NEX.cyanSoft}`,
            color: ctaVariant === "primary" ? "#0B0F1A" : NEX.text,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textAlign: "center",
            boxShadow:
              ctaVariant === "primary"
                ? "0 10px 26px rgba(255,114,0,0.4), inset 0 1px 0 rgba(255,255,255,0.28)"
                : "none",
          }}
        >
          {ctaLabel}
        </StartCheckoutButton>
      ) : (
        <Link
          href={ctaHref}
          style={{
            display: "block",
            marginTop: 22,
            padding: "14px 16px",
            borderRadius: 12,
            background:
              ctaVariant === "primary"
                ? "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)"
                : "rgba(0,175,255,0.14)",
            border:
              ctaVariant === "primary"
                ? `1px solid ${NEX.orangeSoft}`
                : `1px solid ${NEX.cyanSoft}`,
            color: ctaVariant === "primary" ? "#0B0F1A" : NEX.text,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textDecoration: "none",
            textAlign: "center",
            boxShadow:
              ctaVariant === "primary"
                ? "0 10px 26px rgba(255,114,0,0.4), inset 0 1px 0 rgba(255,255,255,0.28)"
                : "none",
          }}
        >
          {ctaLabel}
        </Link>
      )}
      {secondaryCta && (
        <Link
          href={secondaryCta.href}
          style={{
            display: "block",
            marginTop: 8,
            padding: "10px 14px",
            borderRadius: 10,
            background: "transparent",
            border: `1px solid ${NEX.cyanSoft}`,
            color: NEX.cyan,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          {secondaryCta.label}
        </Link>
      )}
    </div>
  );
}

function FeatureItem({ feature }: { feature: FeatureRow }) {
  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "18px 1fr",
        gap: 10,
        alignItems: "start",
        fontSize: 13,
        color: feature.on ? "rgba(244,247,252,0.92)" : NEX.textMute,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: feature.on ? NEX.green : "rgba(255,255,255,0.08)",
          color: feature.on ? "#0B0F1A" : NEX.textMute,
          display: "grid",
          placeItems: "center",
          fontSize: 11,
          fontWeight: 800,
          marginTop: 1,
          boxShadow: feature.on ? "0 3px 8px rgba(22,214,107,0.3)" : "none",
        }}
      >
        {feature.on ? "✓" : "×"}
      </span>
      <span style={{ lineHeight: 1.5, minWidth: 0 }}>
        <span
          style={{
            fontWeight: 600,
            textDecoration: feature.on ? "none" : "line-through",
          }}
        >
          {feature.label}
        </span>
        {feature.hint && (
          <span
            style={{
              display: "inline-block",
              marginLeft: 6,
              padding: "1px 7px",
              borderRadius: 999,
              background: "rgba(255,114,0,0.16)",
              border: "1px solid rgba(255,114,0,0.4)",
              color: NEX.orange,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              verticalAlign: "1px",
            }}
          >
            {feature.hint}
          </span>
        )}
        {feature.explain && (
          <span
            style={{
              display: "block",
              marginTop: 3,
              fontSize: 11.5,
              lineHeight: 1.45,
              color: feature.on
                ? "rgba(139,169,209,0.85)"
                : "rgba(82,107,137,0.85)",
              fontWeight: 400,
            }}
          >
            {feature.explain}
          </span>
        )}
      </span>
    </li>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Add-on cards + FAQ + section head
 * ──────────────────────────────────────────────────────────────── */

function AddonCard({
  title,
  fee,
  body,
  accent,
}: {
  title: string;
  fee: string;
  body: string;
  accent: string;
}) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 14,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "-0.005em",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: accent,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          {fee}
        </div>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.6,
          color: "rgba(244,247,252,0.82)",
        }}
      >
        {body}
      </p>
    </div>
  );
}

function FaqCard({ q, a }: { q: string; a: string }) {
  return (
    <details
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          fontSize: 14,
          fontWeight: 700,
          color: NEX.text,
        }}
      >
        {q}
      </summary>
      <p
        style={{
          margin: "10px 0 0",
          fontSize: 13,
          lineHeight: 1.6,
          color: "rgba(244,247,252,0.8)",
        }}
      >
        {a}
      </p>
    </details>
  );
}

function SectionHead({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: NEX.cyan,
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        {eyebrow}
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: SERIF,
          fontWeight: 500,
          fontSize: 24,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h2>
    </div>
  );
}

/* Header icon helpers removed · shared NexPageHeader owns the chrome
 * now (home + search + gear). */
