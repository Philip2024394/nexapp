// sentry.edge.config.ts
//
// Sentry Edge Runtime initialisation (middleware + edge routes).

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/nex-native/observability/sentry-pii-scrubber";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.05,
  environment: process.env.VERCEL_ENV ?? "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  beforeSend(event) {
    return scrubSentryEvent(event);
  },
  beforeSendTransaction(event) {
    return scrubSentryEvent(event as any) as any;
  },
});
