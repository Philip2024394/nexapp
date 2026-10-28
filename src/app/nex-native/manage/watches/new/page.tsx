// src/app/nex-native/manage/watches/new/page.tsx
//
// Owner directive 2026-10-26 · "save the shop upload page as we start
// to add watches we will build but save".
//
// This is the SKELETON of the Shop > Watches upload page. UI-only.
// Does NOT write to the database · no `nex_watch_listing` table yet
// (see docs/doctrine/nex-shop-watches-upload-draft-2026-10-26.md).
// On submit · logs to console + shows a toast "Draft saved locally"
// until the full backend lands.
//
// Honours the sealed universal NEX keypad rule: every text / numeric
// input routes through NexInput / NexTextarea with `forceKeypadActive=
// true`. Honours the sealed Chat Master Layout (no fork · no new
// chat chrome).
//
// Scope guardrail: this page is NOT linked from any navigation. It
// is reachable only by direct URL · `/nex-native/manage/watches/new`
// · so there is no risk of a user stumbling into an incomplete flow.
// The owner can link it from `manage/` when the backend arrives.

import * as React from "react";
import { UploadClient } from "./_upload-client";
import { hasConfiguredWebhookProvider } from "@/lib/nex-native/watches/watch-payment-webhook";

export const metadata = {
  title: "Upload Watch · NEX",
  description:
    "Draft a watch listing for your NEX shop. The upload surface is in build; drafts are kept locally until the backend lands.",
};

export const dynamic = "force-dynamic";

export default async function UploadWatchPage(): Promise<React.JSX.Element> {
  // Server-side probe · honest "is the payment provider wired?" signal
  // for the Publish button. The client never sees whether a secret is
  // configured, only the boolean result.
  const isProduction = process.env.NODE_ENV === "production";
  const providerConfigured = hasConfiguredWebhookProvider(
    process.env as Record<string, string | undefined>,
  );
  const devMockOptIn = process.env.NEX_WATCHES_DEV_MOCK_PAYMENT_ALLOWED === "1";

  // Publish is only functional when:
  //   · a real provider is wired (any env), OR
  //   · non-production AND the dev-mock opt-in is set.
  const paymentAvailable = providerConfigured || (!isProduction && devMockOptIn);

  const paymentUnavailableReason: string | null = paymentAvailable
    ? null
    : isProduction
      ? "Payment provider not yet connected. You can save a draft; publishing opens when NEX enables payments for your shop."
      : "Mock payment is disabled in this dev environment. Set NEX_WATCHES_DEV_MOCK_PAYMENT_ALLOWED=1 to enable the local publish path.";

  return (
    <UploadClient
      paymentAvailable={paymentAvailable}
      paymentUnavailableReason={paymentUnavailableReason}
    />
  );
}
