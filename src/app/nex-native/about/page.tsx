// src/app/nex-native/about/page.tsx
//
// Public /about page · SSR · SEO B3.
// Owner-authorised 2026-11-11 (copy drafted under honesty rule · owner
// reviews before public launch).

import type { Metadata } from "next";
import {
  JsonLdScript,
} from "@/app/nex-native/_marketing/_json-ld-script";
import {
  MarketingList,
  MarketingSection,
  MarketingShell,
} from "@/app/nex-native/_marketing/_shell";
import {
  buildBreadcrumbList,
  buildOrganization,
} from "@/lib/nex-native/seo/json-ld";
import { nexCanonicalUrl } from "@/lib/nex-native/seo/site-url-resolver";

export const runtime = "nodejs";
export const dynamic = "force-static";

const TITLE = "About NEX · One platform for shops, link-in-bio, chat and discovery";
const DESCRIPTION =
  "NEX brings together an online shop, a link-in-bio business page, private chat with customers, and a product and business directory. Built for independent sellers and creators in Ireland and worldwide.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: nexCanonicalUrl("/nex-native/about") },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    url: nexCanonicalUrl("/nex-native/about"),
    siteName: "NEX",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function AboutPage() {
  return (
    <>
      <JsonLdScript payload={buildOrganization()} />
      <JsonLdScript
        payload={buildBreadcrumbList([
          { name: "NEX", path: "/nex-native" },
          { name: "About", path: "/nex-native/about" },
        ])}
      />
      <MarketingShell
        eyebrow="About NEX"
        title="One place for your shop, your bio, your chat and your customers."
        lede="NEX is a single platform that brings together the pieces independent businesses and creators usually piece together from four or five separate services — a shop, a link-in-bio page, a private chat for customer conversations, and a directory where buyers can find you."
        breadcrumb={[
          { name: "NEX", href: "/nex-native" },
          { name: "About", href: "/nex-native/about" },
        ]}
      >
        <MarketingSection heading="What NEX is">
          <p>
            NEX is a shop, a public business profile, a link-in-bio page,
            a private chat with your customers and a product and business
            directory — all in one place. Everything connects to the same
            account, the same products and the same conversations, so your
            customers never bounce between tools.
          </p>
        </MarketingSection>

        <MarketingSection heading="What NEX gives independent sellers and creators">
          <MarketingList
            items={[
              "An online shop with product listings, cover themes and customer chat.",
              "A link-in-bio business profile on a clean public URL.",
              "A device-to-device encrypted chat with your customers.",
              "A directory where products, services and shops can be discovered.",
              "A Vault for private files and records.",
              "A chat theme library for the look of your conversations.",
            ]}
          />
        </MarketingSection>

        <MarketingSection heading="Ireland and worldwide">
          <p>
            NEX is available in Ireland and worldwide. The product is the
            same; some surfaces (payment methods, pricing, country-specific
            discovery) adapt to the country the shop is set up in.
          </p>
        </MarketingSection>

        <MarketingSection heading="Privacy you can describe honestly">
          <p>
            Private chat and attachments are device-to-device encrypted.
            NEX servers deliver the ciphertext; they do not read the
            content. Shop listings, product pages and business profiles
            are public by design — they are the parts of NEX meant to be
            found.
          </p>
        </MarketingSection>
      </MarketingShell>
    </>
  );
}
