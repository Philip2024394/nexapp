// src/app/nex-native/features/[slug]/page.tsx
//
// Public /features/[slug] page · SSR · SEO B3.
// Owner-authorised 2026-11-11 (copy drafted under honesty rule).
// -----------------------------------------------------------------------------
// One page per feature NEX actually ships today:
//   shops · link-in-bio · chat · chat-themes · directory · vault
//
// Add new slugs to FEATURES only when the feature really exists on NEX;
// never list a feature that is not built.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

interface FeatureCopy {
  readonly title: string;
  readonly eyebrow: string;
  readonly lede: string;
  readonly description: string;
  readonly sections: readonly {
    readonly heading: string;
    readonly body: string;
    readonly bullets?: readonly string[];
  }[];
}

const FEATURES: Readonly<Record<string, FeatureCopy>> = {
  shops: {
    title: "NEX Shops · Your online shop on one URL",
    eyebrow: "Feature · NEX Shops",
    lede: "A NEX Shop is a public page for your products and services at your own URL, with a cover theme, direct customer chat and a connection to the NEX Directory.",
    description:
      "Online shop pages on NEX carry your business profile, product and service listings, a chat with you as the owner, and a cover theme you can style.",
    sections: [
      {
        heading: "What a NEX Shop is",
        body: "A public shop page at your own slug. Customers land on your products, read what you offer and can chat with you directly from the page.",
      },
      {
        heading: "What's included",
        body: "",
        bullets: [
          "Product and service listings — name, description, price, image.",
          "A cover theme you choose for the look of your shop.",
          "A burger menu for About, Visit, Shipping and Services.",
          "A floating chat button that opens a private conversation with you as the owner.",
        ],
      },
      {
        heading: "Who it's for",
        body: "Small businesses and independent sellers who want a shop plus a contactable business presence, without splitting across three services.",
      },
    ],
  },
  "link-in-bio": {
    title: "NEX Link-in-Bio · A public business profile at a clean URL",
    eyebrow: "Feature · Link-in-bio",
    lede: "Your NEX profile doubles as a link-in-bio page. Share one URL in your socials; the people who click land on your public profile — and, if you have a shop, your shop.",
    description:
      "NEX profiles are public link-in-bio pages for creators and sellers, at a clean URL based on the user's NEX handle.",
    sections: [
      {
        heading: "What it is",
        body: "A public profile page at /nex-native/profile/<your handle>. It's where people land when they tap your NEX link anywhere.",
      },
      {
        heading: "What appears on it",
        body: "",
        bullets: [
          "Your display name, avatar, bio and any interests you add.",
          "Safe Trade status, if you've linked a business that has verified status.",
          "A Connect and Message button so visitors can reach you.",
        ],
      },
      {
        heading: "What NEX never shows publicly",
        body: "Private chat messages, attachments, drafts, settings and friend lists are never shown on the public profile.",
      },
    ],
  },
  chat: {
    title: "NEX Chat · Private, device-to-device encrypted",
    eyebrow: "Feature · NEX Chat",
    lede: "NEX Chat is a private messenger for you, your customers and your community. Messages and attachments are device-to-device encrypted.",
    description:
      "NEX Chat is a device-to-device encrypted messenger connected to your shop, profile and directory. NEX servers deliver messages but cannot read them.",
    sections: [
      {
        heading: "What it is",
        body: "A messenger that lives inside the same account as your shop and profile. Open a conversation from any of those surfaces and it continues in the same chat.",
      },
      {
        heading: "What NEX can and cannot see",
        body: "",
        bullets: [
          "NEX servers deliver your messages and attachments as ciphertext.",
          "NEX staff cannot read the contents of your chats.",
          "Message history lives on your devices · it is not centrally stored in plaintext.",
        ],
      },
      {
        heading: "Who uses it",
        body: "Shop owners and customers, creators and their audience, friends. One account, one chat, visible from every NEX surface you grant access to.",
      },
    ],
  },
  "chat-themes": {
    title: "NEX Chat Themes · A library of looks for your conversations",
    eyebrow: "Feature · Chat Themes",
    lede: "NEX ships with a library of chat themes · from clean defaults through country-specific wallpapers and curated backgrounds. Themes apply to your chat without changing the message content.",
    description:
      "NEX Chat Themes is a library of visual themes for your conversations, including free starter tiles, Ireland and Worldwide wallpapers and premium curated themes.",
    sections: [
      {
        heading: "What it is",
        body: "A visual library for your chat background and bubble styling. Pick a theme once and every conversation you open carries that look.",
      },
      {
        heading: "What's in the library",
        body: "",
        bullets: [
          "Free pinned themes, including the NEX default and country-specific tiles.",
          "A rotating selection of premium themes with a preview before you buy.",
          "A full library page with every theme in one grid.",
        ],
      },
    ],
  },
  directory: {
    title: "NEX Directory · Discovery for shops, products and services",
    eyebrow: "Feature · Directory",
    lede: "The NEX Directory is where buyers find shops, products and services. Businesses that opt in are listed with category tiles, search and featured deals.",
    description:
      "The NEX Directory is a discovery surface for shops, products and services, with category tiles, search and featured deals.",
    sections: [
      {
        heading: "What it is",
        body: "A public discovery page listing shops and services by category, with search and featured deals on the directory landing.",
      },
      {
        heading: "How your shop appears here",
        body: "",
        bullets: [
          "By opting in during shop setup and completing your business profile.",
          "With the category and keywords you assign to your business.",
          "In search results when buyers type matching terms.",
        ],
      },
    ],
  },
  vault: {
    title: "NEX Vault · Private files and records",
    eyebrow: "Feature · Vault",
    lede: "The NEX Vault is private storage inside your NEX account for files you want to keep but not share. Vault is included with a Shop subscription.",
    description:
      "NEX Vault is private, account-scoped storage for files and records, included with a Shop subscription.",
    sections: [
      {
        heading: "What it is",
        body: "A private storage area tied to your account. Files are gated by fingerprint or a 6-digit PIN when you open the Vault.",
      },
      {
        heading: "What Vault is not",
        body: "Vault is not a public showcase, a shared folder, or a payment system. Private contents stay private.",
      },
    ],
  },
};

const SLUGS = Object.keys(FEATURES);

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): { slug: string }[] {
  return SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const copy = FEATURES[slug];
  if (!copy) return { title: "Feature · NEX" };
  const canonical = nexCanonicalUrl(`/nex-native/features/${slug}`);
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: copy.title,
      description: copy.description,
      url: canonical,
      siteName: "NEX",
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.description,
    },
  };
}

export default async function FeaturePage({ params }: PageProps) {
  const { slug } = await params;
  const copy = FEATURES[slug];
  if (!copy) notFound();
  return (
    <>
      <JsonLdScript
        payload={buildBreadcrumbList([
          { name: "NEX", path: "/nex-native" },
          { name: "Features", path: "/nex-native/features/shops" },
          { name: copy.title, path: `/nex-native/features/${slug}` },
        ])}
      />
      <MarketingShell
        eyebrow={copy.eyebrow}
        title={copy.title}
        lede={copy.lede}
        breadcrumb={[
          { name: "NEX", href: "/nex-native" },
          { name: "Features", href: `/nex-native/features/shops` },
          { name: copy.title, href: `/nex-native/features/${slug}` },
        ]}
      >
        {copy.sections.map((section, i) => (
          <MarketingSection key={i} heading={section.heading}>
            {section.body ? <p>{section.body}</p> : null}
            {section.bullets ? <MarketingList items={section.bullets} /> : null}
          </MarketingSection>
        ))}
      </MarketingShell>
    </>
  );
}
