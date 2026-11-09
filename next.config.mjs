import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: { root: __dirname },
  devIndicators: false,
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: [
    "unzipper",
    "tesseract.js",
    "ffmpeg-static",
    "ffprobe-static",
  ],
  experimental: {
    turbopackFileSystemCacheForBuild: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ijvqdvsvwtwxzcqmoqit.supabase.co" },
      { protocol: "https", hostname: "ik.imagekit.io" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/nex-native/settings/theme",
        destination: "/nex-native/chat-themes-library",
        permanent: true,
      },
      // Owner-approved 2026-10-16 · the repository folder is `nexapp`
      // but the Next route segment is `/nex-native/`. New visitors who
      // type the obvious repository-name URL (or follow a shared
      // `/nexapp/landing` link) should land on the real NEX Directory
      // landing page rather than seeing a 404. Non-permanent (307) so
      // browsers don't cache the mapping while it is being validated.
      // Does NOT add `/nexapp/:path*` catch-all · each alias is an
      // intentional, verified destination per owner directive.
      {
        source: "/nexapp",
        destination: "/nex-native/directory/landing",
        permanent: false,
      },
      {
        source: "/nexapp/landing",
        destination: "/nex-native/directory/landing",
        permanent: false,
      },
    ];
  },
  async headers() {
    // Owner-authorised 2026-11-09 under ops-gates build · Content Security
    // Policy added in REPORT-ONLY mode. Does not block anything · the browser
    // reports violations to the configured report-uri and we observe them.
    // Once a 2-week observation window is clean, owner flips to enforce.
    //
    // Allow-list rationale:
    //   · self            · base
    //   · unsafe-inline   · Next.js hydration + sealed phone-frame inline styles
    //   · https:          · trusted CDN images + external hosts (Supabase storage,
    //                        ImageKit) — explicit hostnames preferred once CSP
    //                        enforcement starts
    //   · wss:            · Supabase Realtime + future signalling WebSocket
    //   · blob:           · WebCrypto exports + attachment thumbnails on device
    //   · data:           · inline SVG + small data-URL images
    const cspReportOnly = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://ijvqdvsvwtwxzcqmoqit.supabase.co https://ik.imagekit.io",
      "font-src 'self' data:",
      "connect-src 'self' https://ijvqdvsvwtwxzcqmoqit.supabase.co wss://ijvqdvsvwtwxzcqmoqit.supabase.co https://api.stripe.com https://*.ingest.sentry.io",
      "frame-src 'self' https://js.stripe.com https://checkout.stripe.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://checkout.stripe.com",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    const common = [
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(self), microphone=(self), geolocation=(self), interest-cohort=()",
      },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      {
        key: "Content-Security-Policy-Report-Only",
        value: cspReportOnly,
      },
    ];
    return [{ source: "/(.*)", headers: common }];
  },
};

export default nextConfig;
