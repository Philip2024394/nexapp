// /nexapp/welcome — NEX account-creation landing.
//
// Dark navy authentication surface for the NEX app. Rendered to any
// visitor of /nexapp who isn't signed in (see /nexapp/page.tsx gate).

import type { Metadata, Viewport } from "next";
import { CreateAccountShell } from "./CreateAccountShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create your NEX account",
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

export default function NexWelcomePage() {
  return <CreateAccountShell />;
}
