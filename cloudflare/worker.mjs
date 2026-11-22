// cloudflare/worker.mjs
//
// Custom Workers entry that wraps the OpenNext-generated worker.
// Adds a scheduled() handler so Cloudflare Cron Triggers can replace
// the Vercel cron jobs previously declared in vercel.json.
//
// Why a wrapper
// -------------
// OpenNext generates `.open-next/worker.js` on every build. That file
// only exports `default.fetch` + the three Durable Objects. Cloudflare
// Cron Triggers require a `scheduled()` export on the same Worker.
// This wrapper re-exports the Durable Objects verbatim, forwards all
// fetch requests to the OpenNext worker, and adds scheduled() which
// invokes the correct Next.js route internally via the wrapped fetch
// (bearer-authed, no external network hop).
//
// Vercel crons use GET and that's what each of the three route
// handlers primarily documents (billing explicitly, security-audit via
// a shared handle(), harvest via lines 67/169 exporting both). We send
// GET to match the convention the handlers were written for.

import openNextWorker from "../.open-next/worker.js";
export {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge,
} from "../.open-next/worker.js";

/**
 * Map from Cloudflare Cron expression → route + secret env var.
 * Must stay in sync with wrangler.jsonc triggers.crons (currently
 * commented until Vercel crons are confirmed off).
 */
const CRON_ROUTES = {
  "0 * * * *": {
    path: "/api/nex-native/harvest/tick",
    secretEnv: "NEX_HARVEST_CRON_SECRET",
    label: "harvest/tick",
  },
  "*/15 * * * *": {
    path: "/api/nex-native/billing/cron/reconcile",
    secretEnv: "NEX_BILLING_CRON_SECRET",
    label: "billing/reconcile",
  },
  "*/10 * * * *": {
    path: "/api/nex-native/cron/security-audit-reconcile",
    secretEnv: "NEX_CRON_SECRET",
    label: "security-audit",
  },
};

export default {
  fetch: openNextWorker.fetch,

  async scheduled(controller, env, ctx) {
    const schedule = controller.cron;
    const route = CRON_ROUTES[schedule];
    if (!route) {
      console.error(`[cron] unrecognised schedule: ${schedule}`);
      return;
    }
    const secret = env[route.secretEnv];
    if (!secret) {
      console.error(`[cron ${route.label}] missing env ${route.secretEnv}`);
      return;
    }
    const url = `https://nexcorner.com${route.path}`;
    const req = new Request(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
        "User-Agent": "cloudflare-cron/1.0",
      },
    });
    const start = Date.now();
    ctx.waitUntil(
      (async () => {
        try {
          const r = await openNextWorker.fetch(req, env, ctx);
          const body = await r.text().catch(() => "");
          console.log(
            `[cron ${route.label}] ${route.path} → ${r.status} in ${Date.now() - start}ms :: ${body.slice(0, 400)}`,
          );
        } catch (err) {
          console.error(
            `[cron ${route.label}] FAILED after ${Date.now() - start}ms:`,
            err && err.message ? err.message : err,
          );
        }
      })(),
    );
  },
};
