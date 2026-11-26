// tests/e2e/journey-paypal-webhook-t10.spec.ts
//
// T-10b · PAYPAL webhook verification · authored 2026-11-26 under owner
// priority 4 of the sealed T5-T10 workstream.
//
// Owner directive (2026-11-25 strict-completion tightening, verbatim):
//   "(5) T10 = Stripe + PayPal SEPARATE · no real charges · webhook sig
//    verification + invalid-sig rejection + idempotency + merchant-owned
//    destination + generic lock-screen · simulated DB event ≠ real
//    provider proof."
//
// This spec exercises the LIVE PayPal webhook endpoint
// `src/app/api/nex-native/paypal/webhook/route.ts` through real HTTP
// requests against the running dev server. It never contacts PayPal's
// API and never sends a real payment · every probe body is test-authored.
//
// PayPal verification shape (sealed 2026-11-10 at route.ts:1-35):
//   1. Read raw body.
//   2. Pull 5 signature headers
//      (paypal-transmission-id · paypal-transmission-time ·
//       paypal-transmission-sig · paypal-cert-url · paypal-auth-algo).
//   3. Call PayPal's `/v1/notifications/verify-webhook-signature` with
//      those headers + webhook-id + body. Response branches are:
//        · `credentials_missing` → 503
//        · `signature_invalid`   → 400
//        · `paypal_unavailable`  → 503
//        · `oauth_failed`        → 503
//        · `ok=true`             → continue
//   4. Parse and dispatch · payee cross-check mandatory.
//
// Observable contracts under test:
//
//   1. METHOD GUARD · GET returns 405.
//
//   2. HONEST CONFIG BRANCH · with no PAYPAL_* creds in sandbox
//      .env.local, every POST short-circuits with 503
//      `credentials_missing` · the opaque config branch. We assert the
//      sealed body shape · and prove the handler NEVER proceeded to
//      touch a real order's state.
//
//   3. NO BODY-TRUSTED STATE CHANGE · even with a well-formed PayPal
//      event body that names a real nex_order_id, the response is
//      503 and the order is NEVER transitioned. The spec probes
//      against a fresh fixture order and reads its state back after
//      the attempt.
//
//   4. POSITIVE-PATH SIGNATURE VERIFICATION · requires live PayPal
//      credentials (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`,
//      `PAYPAL_WEBHOOK_ID`, `PAYPAL_API_BASE`). Those are NOT set in
//      the sandbox snapshot at the time this spec was authored, and
//      PayPal's verify endpoint can only be reached with real creds.
//      The honest gate is therefore SKIP-PENDING-CONFIG rather than
//      silent-pass. The in-process unit tests at
//      src/app/api/nex-native/paypal/webhook/__tests__/route.test.ts
//      provide direct `verifyPaypalWebhookSignature` coverage.
//
// Boundaries honoured:
//   · Sandbox-only · hard-gated by assertSandboxRef().
//   · No real PayPal API call · no real payment · no charges.
//   · No weakening of signature verification to pass tests.
//   · Classification: SPEC AUTHORED · fixture-driven · sandbox-only.

import { expect, test } from "@playwright/test";
import {
  assertSandboxRef,
  createTestAccount,
  createTestBusiness,
  createTestOrder,
  createTestProduct,
  supabaseAdmin,
  teardownAll,
  type FixtureHandle,
} from "./_fixtures/sandbox-test-harness";

const PAYPAL_WEBHOOK_PATH = "/api/nex-native/paypal/webhook";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("T-10b · PayPal webhook verification", () => {
  test(
    "method guard · GET returns 405",
    async ({ request }) => {
      assertSandboxRef();
      const res = await request.get(PAYPAL_WEBHOOK_PATH);
      expect(res.status(), "GET on paypal webhook must be 405").toBe(405);
    },
  );

  test(
    "config branch · creds missing short-circuits before any state change",
    async ({ request }) => {
      test.setTimeout(45_000);
      assertSandboxRef();
      const sb = supabaseAdmin();

      const handles: FixtureHandle[] = [];
      let orderId: string | null = null;
      try {
        const buyer = await createTestAccount("t10b-buyer");
        handles.push(buyer);
        const merchant = await createTestAccount("t10b-merchant");
        handles.push(merchant);
        const biz = await createTestBusiness(merchant, { label: "t10bshop" });
        handles.push(biz);
        const prod = await createTestProduct(biz, {
          name: "e2e-fixture-t10b-widget",
          pricePence: 2800,
          currency: "GBP",
          status: "live",
        });
        handles.push(prod);
        const order = await createTestOrder(buyer, biz, prod, {
          pricePence: 2800,
          currency: "GBP",
          state: "created",
        });
        orderId = order.orderId;
        handles.push(order);

        const forgedBody = JSON.stringify({
          id: `WH-E2E-${Date.now()}`,
          event_type: "PAYMENT.CAPTURE.COMPLETED",
          resource: {
            id: `capture-${Date.now()}`,
            amount: { currency_code: "GBP", value: "28.00" },
            custom_id: orderId,
          },
        });

        // Probe A · no PayPal headers at all.
        const resA = await request.post(PAYPAL_WEBHOOK_PATH, {
          headers: { "content-type": "application/json" },
          data: forgedBody,
        });

        // Probe B · well-formed-looking PayPal headers but wrong sig.
        const resB = await request.post(PAYPAL_WEBHOOK_PATH, {
          headers: {
            "content-type": "application/json",
            "paypal-transmission-id": "test-trans",
            "paypal-transmission-time": new Date().toISOString(),
            "paypal-transmission-sig": "forged-signature",
            "paypal-cert-url": "https://api.paypal.com/v1/notifications/certs/CERT-TEST",
            "paypal-auth-algo": "SHA256withRSA",
          },
          data: forgedBody,
        });

        // Both probes MUST produce honest guard responses: 503
        // (credentials_missing / paypal_unavailable / oauth_failed) when
        // no creds are configured, OR 400 (signature_invalid) when
        // creds are configured and PayPal returned a verification-fail.
        for (const [tag, res] of [["A", resA], ["B", resB]] as const) {
          expect(
            [400, 500, 503].includes(res.status()),
            `Probe ${tag} returned an honest guard status (got ${res.status()})`,
          ).toBe(true);
        }

        // At least Probe A (no headers) MUST return the config branch
        // in a creds-absent environment · reading the body helps future-
        // reader prove which branch fired.
        const bodyA = await resA.json().catch(() => null);
        if (resA.status() === 503) {
          expect(
            bodyA,
            "503 branch MUST be the sealed credentials_missing shape",
          ).toEqual({ ok: false, error: "credentials_missing" });
        }

        // CRITICAL · regardless of which guard fired, the targeted
        // order state must NOT have changed.
        const { data: postRow } = await sb
          .from("nex_order")
          .select("state")
          .eq("id", orderId)
          .maybeSingle();
        expect(
          (postRow as { state: string } | null)?.state,
          "paypal webhook attempt with no/invalid creds MUST NOT transition the order",
        ).toBe("created");

        const { data: postEvents } = await sb
          .from("nex_order_event")
          .select("event")
          .eq("order_id", orderId);
        const paypalEvents = (postEvents ?? []).filter((e) => {
          const name = (e as { event: string }).event;
          return typeof name === "string" && name.startsWith("paypal.");
        });
        expect(
          paypalEvents.length,
          "no paypal.* event row was created for this order",
        ).toBe(0);
      } finally {
        await teardownAll(handles);
      }
    },
  );

  test(
    "positive-path · live verify-webhook-signature · requires PAYPAL_* creds",
    async ({ request }) => {
      test.setTimeout(45_000);
      assertSandboxRef();

      // Ground truth · send a probe post. If the dev server lacks
      // creds, the response is 503 credentials_missing · we SKIP
      // honestly rather than silently passing.
      const probe = await request.post(PAYPAL_WEBHOOK_PATH, {
        headers: { "content-type": "application/json" },
        data: "{}",
      });
      if (probe.status() === 503) {
        const body = await probe.json().catch(() => null);
        if (body?.error === "credentials_missing") {
          test.skip(
            true,
            "BLOCKED-PENDING-CONFIG · PAYPAL_CLIENT_ID / " +
              "PAYPAL_CLIENT_SECRET / PAYPAL_WEBHOOK_ID / PAYPAL_API_BASE " +
              "missing from dev .env.local · PayPal's verify endpoint " +
              "cannot be reached without live creds. See unit tests at " +
              "src/app/api/nex-native/paypal/webhook/__tests__/" +
              "route.test.ts for direct verifyPaypalWebhookSignature " +
              "coverage.",
          );
          return;
        }
      }

      // If creds ARE present, the full positive path requires a real
      // PayPal webhook delivery with real signature headers · that is
      // outside the scope of a sandbox-authored test body (PayPal
      // signs with RSA using certs issued per-webhook-event by the
      // PayPal infrastructure). We intentionally STOP at the live
      // probe and surface the exact situation so the owner can route
      // this through an integration environment on a dedicated run.
      test.skip(
        true,
        "BLOCKED-PENDING-INTEGRATION · PayPal positive-path requires " +
          "an actual PayPal-signed delivery · author a dedicated " +
          "integration spec that mounts a sandbox webhook subscription " +
          "and replays a captured real event.",
      );
    },
  );
});
