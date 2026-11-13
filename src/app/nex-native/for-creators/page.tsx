// src/app/nex-native/for-creators/page.tsx
//
// Public /for-creators page · SSR · SEO B3.
// Owner-authorised 2026-11-11 (copy drafted under honesty rule).

import type { Metadata } from "next";
import { JsonLdScript } from "@/app/nex-native/_marketing/_json-ld-script";
import {
  MarketingList,
  MarketingSection,
  MarketingShell,
} from "@/app/nex-native/_marketing/_shell";
import { buildBreadcrumbList } from "@/lib/nex-native/seo/json-ld";
import { nexCanonicalUrl } from "@/lib/nex-native/seo/site-url-resolver";

export const runtime = "nodejs";
export const dynamic = "force-static";

const TITLE = "NEX for Creators · Profile, link-in-bio and chat themes";
const DESCRIPTION =
  "NEX gives independent creators a public profile, a link-in-bio page, direct chat with their audience and a chat theme library — on one account, one URL.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: nexCanonicalUrl("/nex-native/for-creators") },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    url: nexCanonicalUrl("/nex-native/for-creators"),
    siteName: "NEX",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function ForCreatorsPage() {
  return (
    <>
      <JsonLdScript
        payload={buildBreadcrumbList([
          { name: "NEX", path: "/nex-native" },
          { name: "For creators", path: "/nex-native/for-creators" },
        ])}
      />
      <MarketingShell
        eyebrow="For creators"
        title="One profile, one link-in-bio, one place for your community."
        lede="NEX gives creators a public profile, a shareable link-in-bio page, and private chat with the people who follow you — without bouncing between four apps. Your handle is your URL."
        breadcrumb={[
          { name: "NEX", href: "/nex-native" },
          { name: "For creators", href: "/nex-native/for-creators" },
        ]}
      >
        <MarketingSection heading="What creators use NEX for">
          <MarketingList
            items={[
              "A public profile at a clean, memorable URL based on your NEX handle.",
              "A link-in-bio hub that can point to shops, products, or any public NEX surface.",
              "Private chat with followers and collaborators that is end-to-end encrypted.",
              "A chat theme library so your conversations carry your look.",
              "Discovery through the NEX Directory if you choose to be listed.",
            ]}
          />
        </MarketingSection>

        <MarketingSection heading="Privacy for creators">
          <p>
            Private chat and attachments are device-to-device encrypted.
            NEX servers deliver messages but cannot read them. Your public
            profile is public only when you opt in to discovery.
          </p>
        </MarketingSection>
      </MarketingShell>
    </>
  );
}
