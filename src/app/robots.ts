// src/app/robots.ts
//
// NEX SEO · dynamic robots route (Next.js 16 MetadataRoute).
// Owner-authorised 2026-11-11 (SEO B1-B4 build).
// -----------------------------------------------------------------------------
// Separates search-discovery crawlers (Allow) from model-training crawlers
// (Disallow). This is a search-visibility decision · it does NOT guarantee
// inclusion or recommendations in any AI service.
//
// Owner-sealed policy 2026-11-11:
//   Allow     · Googlebot, OAI-SearchBot, ChatGPT-User, PerplexityBot
//   Disallow  · GPTBot, ClaudeBot, anthropic-ai, CCBot, Google-Extended
//   Default * · Allow public app shell, Disallow every PRIVATE_PATH_PREFIX.
//
// Private surfaces (/nex-native/manage, /chat, /vault, /hq, /api, auth,
// payments, orders, settings) are Disallow-ed for EVERY user-agent, including
// the allowlisted search crawlers. Policy is sealed in exclude-routes.ts.

import type { MetadataRoute } from "next";
import { PRIVATE_PATH_PREFIXES } from "@/lib/nex-native/seo/exclude-routes";
import {
  assertProdSafeUrl,
  nexSiteUrl,
} from "@/lib/nex-native/seo/site-url-resolver";
import { isPrelaunchModeOn } from "@/lib/nex-native/prelaunch/feature-flag";
import { listPublicAllowlistSnapshot } from "@/lib/nex-native/prelaunch/allowlist";

const ALLOWED_SEARCH_BOTS: readonly string[] = [
  "Googlebot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
];

const DISALLOWED_TRAINING_BOTS: readonly string[] = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
];

/** Dynamic robots route · Next.js reads this at /robots.txt.
 *
 *  2026-11-18 · when NEX_PRELAUNCH_MODE is "true", this route returns a
 *  narrow-allowlist policy: ONLY the Nexcorner landing + the published
 *  buying guides are allow-crawled. Everything else is disallowed for
 *  every user-agent. When the flag is off, the pre-existing public /
 *  private partition is returned unchanged. */
export default function robots(): MetadataRoute.Robots {
  const base = nexSiteUrl();
  const sitemapUrl = assertProdSafeUrl(`${base}/sitemap.xml`, "robots.sitemap");

  if (isPrelaunchModeOn()) {
    const snap = listPublicAllowlistSnapshot();
    // Allow the exact Nexcorner paths + the guides prefix + framework
    // internals. Disallow everything else at the root.
    const allow: readonly string[] = [
      ...snap.exactPaths,
      ...snap.prefixPaths,
    ];
    return {
      rules: [
        {
          userAgent: "*",
          allow: [...allow],
          disallow: ["/"],
        },
        // Model-training crawlers · still blanket Disallow even under
        // prelaunch so the public landing isn't ingested into a model
        // set we don't trust.
        ...DISALLOWED_TRAINING_BOTS.map((bot) => ({
          userAgent: bot,
          disallow: ["/"],
        })),
      ],
      sitemap: sitemapUrl,
      host: base,
    };
  }

  // Private paths always disallow for every user-agent (including the
  // allowlist). Expressed with trailing `/` so Allow: /nex-native/directory
  // still works alongside Disallow: /nex-native/manage/ for Googlebot.
  const privateDisallow: readonly string[] = PRIVATE_PATH_PREFIXES.map(
    (p) => `${p}/`,
  );

  const rules: MetadataRoute.Robots["rules"] = [
    // Search / discovery crawlers · Allow public app, Disallow private.
    ...ALLOWED_SEARCH_BOTS.map((bot) => ({
      userAgent: bot,
      allow: ["/"],
      disallow: [...privateDisallow],
    })),
    // Model-training crawlers · blanket Disallow.
    ...DISALLOWED_TRAINING_BOTS.map((bot) => ({
      userAgent: bot,
      disallow: ["/"],
    })),
    // Default fallback for every other user-agent · Allow public, Disallow
    // private. Keeps the door open for legitimate crawlers the owner hasn't
    // explicitly named, but never leaks private surfaces.
    {
      userAgent: "*",
      allow: ["/"],
      disallow: [...privateDisallow],
    },
  ];

  return {
    rules,
    sitemap: sitemapUrl,
    host: base,
  };
}
