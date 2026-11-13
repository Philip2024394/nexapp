// src/app/nex-native/developers/page.tsx
//
// Public /developers page · SSR · SEO B3.
// Owner-authorised 2026-11-11 (copy drafted under honesty rule).
// -----------------------------------------------------------------------------
// Developer-facing page describing what integrations NEX currently ships.
// Does NOT claim a public MCP endpoint — the MCP HTTP transport is
// deferred pending auth + rate limit + public-data migration (B5 scope).

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

const TITLE = "NEX for Developers · Integrations overview";
const DESCRIPTION =
  "Overview of NEX integrations — payment webhooks, AI tool contracts, and the Model Context Protocol server used internally today.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: nexCanonicalUrl("/nex-native/developers") },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    url: nexCanonicalUrl("/nex-native/developers"),
    siteName: "NEX",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function DevelopersPage() {
  return (
    <>
      <JsonLdScript
        payload={buildBreadcrumbList([
          { name: "NEX", path: "/nex-native" },
          { name: "Developers", path: "/nex-native/developers" },
        ])}
      />
      <MarketingShell
        eyebrow="For developers"
        title="Integrations on NEX, described honestly."
        lede="This page describes the integrations that live inside NEX today. It is intentionally sparse — we only list capabilities that exist and work. Public endpoints and API tokens will be added here as they ship."
        breadcrumb={[
          { name: "NEX", href: "/nex-native" },
          { name: "Developers", href: "/nex-native/developers" },
        ]}
      >
        <MarketingSection heading="Payment webhooks">
          <p>
            NEX runs signature-verified webhook handlers for payment events
            (Stripe today, PayPal scaffolding staged behind credentials).
            These are inbound-only and used to update order status.
          </p>
        </MarketingSection>

        <MarketingSection heading="Model Context Protocol (MCP)">
          <p>
            NEX has a JSON-RPC 2.0 MCP server implementation inside the
            application. It is not yet exposed over HTTP. A public HTTP
            endpoint is planned behind authentication, per-session rate
            limiting and audit logging, with only public-data tools in the
            initial scope (shop and product discovery).
          </p>
          <p>
            Private surfaces — chat messages, attachments, customer
            information and payment data — will never be exposed through
            MCP.
          </p>
        </MarketingSection>

        <MarketingSection heading="AI tool contracts">
          <p>
            NEX uses a provider-neutral LLM layer built around canonical
            tool and message types. The TypeScript contracts live in the
            NEX source tree (not yet published to a public package) and
            route every AI tool call through an authorisation pipeline
            before execution.
          </p>
        </MarketingSection>

        <MarketingSection heading="What this page intentionally does not claim">
          <MarketingList
            items={[
              "No public REST API is available today.",
              "No public MCP endpoint is live today.",
              "No public webhooks are offered today.",
              "No SDK packages are published today.",
            ]}
          />
          <p>
            When any of the above ship, they will be added here with the
            exact endpoint, authentication scheme and data scope.
          </p>
        </MarketingSection>
      </MarketingShell>
    </>
  );
}
