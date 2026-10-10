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
