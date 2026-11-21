// docs/doctrine/cloudflare-cutover-drafts/crons-worker.ts
//
// DRAFT 2026-11-21 · standalone Cloudflare Worker · NOT imported by
// the nexapp build. Deployed separately via wrangler.crons.toml.
//
// Purpose
// -------
// Replace the three Vercel cron entries in vercel.json by running
// them on Cloudflare's Cron Triggers. The Worker does NOT contain
// any business logic · it just fires an authenticated HTTPS request
// to the matching Next.js route on the Pages deployment, which runs
// the existing handler code unchanged.
//
// Why dispatch instead of inlining the handler
// --------------------------------------------
// The three cron handlers already live in the Next.js app at:
//   src/app/api/nex-native/harvest/tick/route.ts
//   src/app/api/nex-native/billing/cron/reconcile/route.ts
//   src/app/api/nex-native/cron/security-audit-reconcile/route.ts
// They pull Supabase, LLM clients, Brevo, HQ observability, etc.
// Reproducing that stack inside a separate Worker would fork the
// logic and create a drift risk. Dispatch keeps a single source of
// truth in the Pages app.

interface Env {
  readonly PAGES_ORIGIN: string;
  readonly WORKER_TAG: string;
  readonly NEX_HARVEST_CRON_SECRET: string;
  readonly NEX_BILLING_CRON_SECRET: string;
  readonly NEX_CRON_SECRET: string;
}

// Map cron expression → { path, secret env key, purpose }
// Keys here MUST match the strings in wrangler.crons.toml [triggers].crons.
interface CronJob {
  readonly path: string;
  readonly secretKey: keyof Env;
  readonly purpose: string;
}

const CRON_MAP: Record<string, CronJob> = {
  "0 * * * *": {
    path: "/api/nex-native/harvest/tick",
    secretKey: "NEX_HARVEST_CRON_SECRET",
    purpose: "harvest.tick",
  },
  "*/15 * * * *": {
    path: "/api/nex-native/billing/cron/reconcile",
    secretKey: "NEX_BILLING_CRON_SECRET",
    purpose: "billing.reconcile",
  },
  "*/10 * * * *": {
    path: "/api/nex-native/cron/security-audit-reconcile",
    secretKey: "NEX_CRON_SECRET",
    purpose: "security.audit.reconcile",
  },
};

export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const job = CRON_MAP[event.cron];
    if (!job) {
      console.error(
        `[${env.WORKER_TAG}] unknown cron expression: ${event.cron}`,
      );
      return;
    }

    const url = new URL(job.path, env.PAGES_ORIGIN).toString();
    const secret = env[job.secretKey];

    if (!secret) {
      console.error(
        `[${env.WORKER_TAG}] missing secret ${String(job.secretKey)} for ${job.purpose}`,
      );
      return;
    }

    // waitUntil so the request completes even if the scheduled event
    // handler returns first.
    ctx.waitUntil(
      (async () => {
        const startedAt = Date.now();
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${secret}`,
              "Content-Type": "application/json",
              "User-Agent": env.WORKER_TAG,
              "X-Nex-Cron-Source": "cloudflare-worker",
              "X-Nex-Cron-Expression": event.cron,
            },
            // No body · the handlers don't read one; they derive
            // everything from Supabase state + the auth header.
          });
          const ms = Date.now() - startedAt;
          console.log(
            `[${env.WORKER_TAG}] ${job.purpose} → ${res.status} in ${ms}ms`,
          );
          if (!res.ok) {
            // Body may contain useful error context · read it so the
            // Workers log has something diagnosable.
            const text = await res.text().catch(() => "");
            console.error(
              `[${env.WORKER_TAG}] ${job.purpose} body: ${text.slice(0, 500)}`,
            );
          }
        } catch (err) {
          const ms = Date.now() - startedAt;
          console.error(
            `[${env.WORKER_TAG}] ${job.purpose} FAILED after ${ms}ms:`,
            err,
          );
        }
      })(),
    );
  },

  // Optional HTTP surface · lets a human (or a monitoring probe)
  // hit the Worker URL and see which crons are wired. Does NOT expose
  // secrets. Does NOT run the crons.
  async fetch(_req: Request, env: Env): Promise<Response> {
    const summary = Object.entries(CRON_MAP).map(([cron, job]) => ({
      cron,
      purpose: job.purpose,
      path: job.path,
      origin: env.PAGES_ORIGIN,
      hasSecret: Boolean(env[job.secretKey]),
    }));
    return new Response(
      JSON.stringify({ worker: env.WORKER_TAG, jobs: summary }, null, 2),
      { headers: { "Content-Type": "application/json" } },
    );
  },
};
