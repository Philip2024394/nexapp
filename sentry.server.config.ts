// sentry.server.config.ts
//
// Sentry server-side initialisation. Loaded by instrumentation.ts.
// Owner must set SENTRY_DSN secret in Vercel production env vars for
// this to activate. Until then this file is a no-op (init() with no
// DSN is harmless).

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/nex-native/observability/sentry-pii-scrubber";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.05,
  profilesSampleRate: 0,
  environment: process.env.VERCEL_ENV ?? "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // CRITICAL · sealed-invariant I-1 protection. Never send a Sentry event
  // containing private message content or credentials.
  beforeSend(event) {
    return scrubSentryEvent(event);
  },
  beforeSendTransaction(event) {
    return scrubSentryEvent(event as any) as any;
  },

  // Keep stack frames anonymous · do not capture local variable values
  // that might include message content.
  includeLocalVariables: false,

  // Default integrations · opt out of the ones that can capture body or
  // cookie data without our beforeSend getting the first look.
  integrations: (defaults) => defaults.filter((i) => i.name !== "RequestData"),
});
