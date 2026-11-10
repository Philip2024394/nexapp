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
      { protocol: "https", hostname: "kdstoyyeygcopkogqsyv.supabase.co" },
      { protocol: "https", hostname: "ik.imagekit.io" },
      // Owner directive 2026-11-10 · mock-persona avatars + covers on
      // the sandbox preview deployment · dicebear provides stable PNG
      // faces (free, no key), picsum.photos provides stable cover
      // banners. Both are seed-URL only · never used for real users.
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
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
    ];
    return [{ source: "/(.*)", headers: common }];
  },
};

export default nextConfig;
