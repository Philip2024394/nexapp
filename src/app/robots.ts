// src/app/robots.ts
//
// Next.js 16 robots.txt generator. Returned content depends on the Vercel
// environment:
//   · production  → allow public surfaces, disallow auth-gated + admin
//   · preview     → disallow everything (keep preview Vercel URLs out of
//                    Google index — a common hygiene gap per the launch
//                    readiness audit 2026-11-09)
//   · development → disallow everything (should not be publicly reachable
//                    but defence in depth)
//
// This file generates `/robots.txt` at request time. No UI changes.

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const env = process.env.VERCEL_ENV ?? "development";

  if (env !== "production") {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  // Production · allow public pages, disallow admin and auth-gated paths.
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/nex-native/directory",
          "/nex-native/community",
          "/nex-native/privacy",
          "/nex-native/terms",
          "/nex-native/help",
          "/nex-native/support",
        ],
        disallow: [
          "/api/",
          "/nex-native/hq/",
          "/nex-native/manage/",
          "/nex-native/settings/",
          "/nex-native/vault/",
          "/nex-native/chat/",
          "/nex-native/free-chat/",
          "/nex-native/orders/",
          "/nex-native/cart/",
          "/nex-native/profile/",
        ],
      },
    ],
  };
}
