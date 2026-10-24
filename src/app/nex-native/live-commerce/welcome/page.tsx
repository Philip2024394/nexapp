// src/app/nex-native/live-commerce/welcome/page.tsx
//
// Owner directive 2026-10-24 · "welcome nex live - move to page - not
// container and we need the back ground image displaying".
// Full-page welcome experience shown to NEX-chat users before their
// first Live broadcast. Replaces the previous in-footer modal.
//
// Server shell · forwards the optional ?returnTo so the client can
// route back to the broadcaster surface (defaults to the sealed
// `/nex-native/live-commerce/go-live`) after the owner accepts.

import { WelcomeClient } from "./_welcome-client";

export const metadata = {
  title: "Welcome to NEX LIVE",
  description:
    "Your moment. Your people. Your LIVE. Read the NEX LIVE guidelines before you go live.",
};

export default async function LiveWelcomePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly returnTo?: string }>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  // Honest default · the broadcaster surface. Any explicit returnTo
  // from the viewer is forwarded verbatim (the client does its own
  // same-origin safety check before navigating).
  const returnTo = params.returnTo ?? "/nex-native/live-commerce/go-live";
  return <WelcomeClient returnTo={returnTo} />;
}
