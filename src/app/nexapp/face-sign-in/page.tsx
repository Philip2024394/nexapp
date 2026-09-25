// /nexapp/face-sign-in — NEX biometric authentication surface.

import type { Metadata, Viewport } from "next";
import { FaceSignInShell } from "./FaceSignInShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Face sign-in · NEX",
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

export default function NexFaceSignInPage() {
  return <FaceSignInShell />;
}
