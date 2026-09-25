// /nexapp/sign-in — NEX password sign-in surface.

import type { Metadata, Viewport } from "next";
import { PasswordSignInShell } from "./PasswordSignInShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in · NEX",
  description: "Your world is waiting.",
  robots: { index: false, follow: false }
};

export const viewport: Viewport = {
  themeColor: "#020914",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover"
};

export default function NexSignInPage() {
  return <PasswordSignInShell />;
}
