// src/app/nex-native/for-sellers/page.tsx
//
// Public /for-sellers page · SSR · SEO B3.
// Owner-authorised 2026-11-11 (copy drafted under honesty rule).

import type { Metadata } from "next";
import { JsonLdScript } from "@/app/nex-native/_marketing/_json-ld-script";
import {
  MarketingList,
  MarketingSection,
  MarketingShell,
} from "@/app/nex-native/_marketing/_shell";
import {
  buildBreadcrumbList,
  buildSoftwareApplication,
} from "@/lib/nex-native/seo/json-ld";
import { nexCanonicalUrl } from "@/lib/nex-native/seo/site-url-resolver";

export const runtime = "nodejs";
export const dynamic = "force-static";

const TITLE = "NEX for Sellers · Online shop, link-in-bio and customer chat in one place";
const DESCRIPTION =
  "NEX gives sellers an online shop, a link-in-bio business profile, direct chat with customers and discovery through the NEX Directory, under one account.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: nexCanonicalUrl("/nex-native/for-sellers") },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    url: nexCanonicalUrl("/nex-native/for-sellers"),
    siteName: "NEX",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function ForSellersPage() {
  return (
    <>
      <JsonLdScript payload={buildSoftwareApplication()} />
      <JsonLdScript
        payload={buildBreadcrumbList([
          { name: "NEX", path: "/nex-native" },
          { name: "For sellers", path: "/nex-native/for-sellers" },
        ])}
      />
      <MarketingShell
        eyebrow="For sellers"
        title="Your shop, your bio, your chat with customers — one platform."
        lede="If you run a small shop or service business today, you are probably stitching together a storefront, a link-in-bio service and a messaging app. NEX combines these into one account so your products, your public page and your conversations stay connected."
        breadcrumb={[
          { name: "NEX", href: "/nex-native" },
          { name: "For sellers", href: "/nex-native/for-sellers" },
        ]}
      >
        <MarketingSection heading="What you get as a seller on NEX">
          <MarketingList
            items={[
              "An online shop with product and service listings.",
              "A public business profile at a clean URL you can share.",
              "Direct chat with customers from your shop — no external app.",
              "Discovery through the NEX Directory, where buyers browse by category.",
              "Cover themes and a chat theme library to make your shop feel like yours.",
            ]}
          />
        </MarketingSection>

        <MarketingSection heading="How selling on NEX works">
          <MarketingList
            items={[
              "Create an account and your business profile.",
              "Add your products or services — name, description, price, image.",
              "Pick a cover theme for your public shop page.",
              "Share your shop URL. Customers can also find you through the directory.",
              "Customers chat with you directly from your shop page.",
            ]}
          />
        </MarketingSection>

        <MarketingSection heading="What NEX does not do">
          <p>
            NEX is not a marketplace that owns your customer relationships.
            Your shop is your shop; your conversations are yours. NEX
            delivers the platform.
          </p>
        </MarketingSection>
      </MarketingShell>
    </>
  );
}
