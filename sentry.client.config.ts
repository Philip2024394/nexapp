// sentry.client.config.ts
//
// Sentry browser-side initialisation. Executed in the browser bundle.
// Owner must set NEXT_PUBLIC_SENTRY_DSN for this to activate.

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/nex-native/observability/sentry-pii-scrubber";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.05,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0, // DO NOT enable session replay · would capture private chat UI
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  beforeSend(event) {
    return scrubSentryEvent(event);
  },
  beforeBreadcrumb(breadcrumb) {
    // Drop fetch/xhr breadcrumbs that might capture request/response body.
    if (breadcrumb.category === "fetch" || breadcrumb.category === "xhr") {
      if (breadcrumb.data) {
        delete breadcrumb.data.response_body_size;
        delete breadcrumb.data.request_body_size;
        // Blanket drop URL query string · may contain tokens
        if (typeof breadcrumb.data.url === "string") {
          breadcrumb.data.url = breadcrumb.data.url.split("?")[0];
        }
      }
    }
    return breadcrumb;
  },

  integrations: (defaults) => defaults.filter((i) => i.name !== "RequestData"),
});
