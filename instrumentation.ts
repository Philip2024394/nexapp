// instrumentation.ts
//
// Next.js 16 instrumentation hook. Loads the appropriate Sentry config
// per runtime. See https://nextjs.org/docs/app/guides/instrumentation.
//
// If SENTRY_DSN (server) or NEXT_PUBLIC_SENTRY_DSN (client) is not set,
// Sentry.init runs with no DSN and silently no-ops · safe default.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
