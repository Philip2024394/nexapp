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

/** Dynamic robots route · Next.js reads this at /robots.txt. */
export default function robots(): MetadataRoute.Robots {
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

  const base = nexSiteUrl();
  const sitemapUrl = assertProdSafeUrl(`${base}/sitemap.xml`, "robots.sitemap");

  return {
    rules,
    sitemap: sitemapUrl,
    host: base,
  };
}
