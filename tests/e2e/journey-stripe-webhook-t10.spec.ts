// tests/e2e/journey-stripe-webhook-t10.spec.ts
//
// T-10a · STRIPE webhook verification · authored 2026-11-26 under owner
// priority 4 of the sealed T5-T10 workstream.
//
// Owner directive (2026-11-25 strict-completion tightening, verbatim):
//   "(5) T10 = Stripe + PayPal SEPARATE · no real charges · webhook sig
//    verification + invalid-sig rejection + idempotency + merchant-owned
//    destination + generic lock-screen · simulated DB event ≠ real
//    provider proof."
//
// This spec exercises the LIVE Stripe webhook endpoint
// `src/app/api/nex-native/stripe/webhook/route.ts` through real HTTP
// requests against the running dev server. It never contacts Stripe's
// API and never sends a real charge · every probe body is test-authored.
//
// Observable contracts under test:
//
//   1. METHOD GUARD · GET returns 405 with Allow: POST. Verb-guard is
//      the first defence; a missing guard would let a GET-only CSRF
//      probe reach downstream logic.
//
//   2. OPAQUE FAILURE SURFACE · POST without a stripe-signature header,
//      POST with a syntactically malformed stripe-signature header, and
//      POST with a well-formed-but-wrong signature ALL return the SAME
//      shape (status + body) so an attacker cannot distinguish which
//      part of verification failed. The sealed route explicitly
//      documents this invariant · comments at route.ts:96-102 and
//      route.ts:464-471 forbid echoing "which part failed".
//
//   3. NO BODY-TRUSTED STATE CHANGE · the handler never calls
//      markOrderPaid before signature verification succeeds. We prove
//      this observable-only by posting a signature-free payload that
//      names a real NEX order id and then confirming nex_order.state
//      did NOT change (still 'created') and no new nex_order_event row
//      with a `stripe_*` prefix landed for that order.
//
//   4. CONFIG BRANCH IS HONEST · the sealed route returns 500
//      `config_error` when STRIPE_WEBHOOK_SECRET is missing or empty
//      (route.ts:87-94). This branch MUST NEVER leak "secret missing"
//      in the response body · we assert the response body is literally
//      `{"ok":false,"error":"config_error"}`.
//
//   5. POSITIVE-PATH SIGNATURE VERIFICATION · requires the dev server
//      to be configured with a known STRIPE_WEBHOOK_SECRET we can
//      compute HMAC-SHA256 signatures against (sealed scheme at
//      stripe-webhook-service.ts:125-132 · `${timestamp}.${rawBody}`).
//      In the sandbox .env.local snapshot at the time this spec was
//      authored, STRIPE_WEBHOOK_SECRET is declared but empty, so the
//      positive-path assertion cannot be exercised honestly. We SKIP
//      with a documented reason rather than silently passing. The
//      companion unit tests at
//      src/lib/nex-native/payments/__tests__/stripe-webhook-service.test.ts
//      do exercise `verifyStripeSignature` directly.
//
// Boundaries honoured:
//   · Sandbox-only · hard-gated by assertSandboxRef().
//   · No real Stripe API call · no real card data · no charges.
//   · No weakening of signature verification to pass tests.
//   · Classification: SPEC AUTHORED · fixture-driven · sandbox-only.

import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  assertSandboxRef,
  createTestAccount,
  createTestBusiness,
  createTestOrder,
  createTestProduct,
  supabaseAdmin,
  teardownAll,
  withPgClient,
  type FixtureHandle,
} from "./_fixtures/sandbox-test-harness";

const STRIPE_WEBHOOK_PATH = "/api/nex-native/stripe/webhook";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("T-10a · Stripe webhook verification", () => {
  test(
    "method guard · GET returns 405 with Allow: POST",
    async ({ request }) => {
      assertSandboxRef();
      const res = await request.get(STRIPE_WEBHOOK_PATH);
      expect(res.status(), "GET on webhook endpoint must be 405").toBe(405);
      expect(
        (res.headers()["allow"] ?? "").toUpperCase(),
        "Allow header advertises POST only",
      ).toContain("POST");
    },
  );

  test(
    "unsigned/bad-sig POST never reaches state change · opaque failure surface",
    async ({ request }) => {
      test.setTimeout(45_000);
      assertSandboxRef();
      const sb = supabaseAdmin();

      const handles: FixtureHandle[] = [];
      let orderId: string | null = null;
      try {
        // Mint a real order so we can prove the handler NEVER wrote to
        // it. The order id is embedded in the unsigned webhook payload.
        const buyer = await createTestAccount("t10a-buyer");
        handles.push(buyer);
        const merchant = await createTestAccount("t10a-merchant");
        handles.push(merchant);
        const biz = await createTestBusiness(merchant, { label: "t10ashop" });
        handles.push(biz);
        const prod = await createTestProduct(biz, {
          name: "e2e-fixture-t10a-widget",
          pricePence: 3200,
          currency: "GBP",
          status: "live",
        });
        handles.push(prod);
        const order = await createTestOrder(buyer, biz, prod, {
          pricePence: 3200,
          currency: "GBP",
          state: "created",
        });
        orderId = order.orderId;
        handles.push(order);

        const forgedBody = JSON.stringify({
          id: `evt_e2e_${Date.now()}`,
          type: "checkout.session.completed",
          data: {
            object: {
              id: `cs_test_${Date.now()}`,
              payment_status: "paid",
              metadata: { nex_order_id: orderId },
            },
          },
        });

        // Probe A · no stripe-signature header at all.
        const resA = await request.post(STRIPE_WEBHOOK_PATH, {
          headers: { "content-type": "application/json" },
          data: forgedBody,
        });

        // Probe B · syntactically-malformed header.
        const resB = await request.post(STRIPE_WEBHOOK_PATH, {
          headers: {
            "content-type": "application/json",
            "stripe-signature": "not-a-signature-header",
          },
          data: forgedBody,
        });

        // Probe C · well-formed header but wrong HMAC.
        const resC = await request.post(STRIPE_WEBHOOK_PATH, {
          headers: {
            "content-type": "application/json",
            "stripe-signature": `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}`,
          },
          data: forgedBody,
        });

        // The three probes MUST produce indistinguishable failure
        // surfaces · either 400 (invalid signature · when secret is
        // configured) or 500 (config_error · when secret is empty).
        // What matters is they are all the SAME · the attacker learns
        // nothing about which part failed.
        for (const [tag, res] of [["A", resA], ["B", resB], ["C", resC]] as const) {
          expect(
            [400, 500].includes(res.status()),
            `Probe ${tag} rejected with a honest status (got ${res.status()})`,
          ).toBe(true);
        }
        expect(
          resA.status(),
          "unsigned and malformed produce the same status",
        ).toBe(resB.status());
        expect(
          resB.status(),
          "malformed and bad-hex produce the same status",
        ).toBe(resC.status());

        // Observed status tells us which branch fired · assert the
        // SEALED body for the matching branch. This locks the "never
        // echo which part failed" invariant.
        const bodyA = await resA.json();
        if (resA.status() === 500) {
          // Config branch · secret missing/empty.
          expect(
            bodyA,
            "config_error branch body is the sealed shape",
          ).toEqual({ ok: false, error: "config_error" });
        } else if (resA.status() === 400) {
          expect(
            bodyA,
            "invalid-sig branch body is the sealed shape",
          ).toEqual({ ok: false, error: "invalid signature" });
        }

        // No state change may have landed on the targeted order. This
        // is the key safety assertion of the whole spec.
        const { data: postRow } = await sb
          .from("nex_order")
          .select("state")
          .eq("id", orderId)
          .maybeSingle();
        expect(
          (postRow as { state: string } | null)?.state,
          "unsigned webhook MUST NOT transition the order",
        ).toBe("created");

        const { data: postEvents } = await sb
          .from("nex_order_event")
          .select("event, metadata")
          .eq("order_id", orderId);
        const stripeEvents = (postEvents ?? []).filter((e) => {
          const name = (e as { event: string }).event;
          return typeof name === "string" && name.startsWith("stripe.");
        });
        expect(
          stripeEvents.length,
          "no stripe.* event row was created for this order",
        ).toBe(0);
      } finally {
        if (orderId) {
          try {
            await withPgClient(async (c) => {
              await c.query(
                "DELETE FROM nex_ledger_line WHERE entry_id IN (SELECT id FROM nex_ledger_entry WHERE order_id = $1)",
                [orderId],
              );
              await c.query(
                "DELETE FROM nex_ledger_entry WHERE order_id = $1",
                [orderId],
              );
            });
          } catch {
            // best effort · see T8 UI-loop spec for the identical pattern
          }
        }
        await teardownAll(handles);
      }
    },
  );

  test(
    "positive-path · valid signature transitions state · dedup replay same event",
    async ({ request }) => {
      test.setTimeout(60_000);
      assertSandboxRef();

      // Ground truth · the dev server must actually have a configured
      // STRIPE_WEBHOOK_SECRET we can compute signatures against. In the
      // current sandbox .env.local the value is empty. We detect this
      // honestly by sending a signature-free POST: if the route returns
      // 500 `config_error`, the secret is missing and we SKIP.
      const probe = await request.post(STRIPE_WEBHOOK_PATH, {
        headers: { "content-type": "application/json" },
        data: "{}",
      });
      const probeStatus = probe.status();
      if (probeStatus === 500) {
        const body = await probe.json().catch(() => null);
        if (body?.error === "config_error") {
          test.skip(
            true,
            "BLOCKED-PENDING-CONFIG · STRIPE_WEBHOOK_SECRET empty in dev " +
              ".env.local · positive-path signature verification cannot be " +
              "exercised honestly against the live route. See companion " +
              "unit tests at src/lib/nex-native/payments/__tests__/" +
              "stripe-webhook-service.test.ts for direct verify coverage.",
          );
          return;
        }
      }

      // If we fall through, a secret IS configured · exercise the real
      // positive path. The spec is PREPARED for this: once the owner
      // seeds a non-empty secret, the path below runs end-to-end.
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!secret) {
        test.skip(
          true,
          "BLOCKED-PENDING-CONFIG · test process cannot read the dev " +
            "server's STRIPE_WEBHOOK_SECRET (not exported). Run with the " +
            "same env the dev server uses to exercise this leg.",
        );
        return;
      }

      const handles: FixtureHandle[] = [];
      let orderId: string | null = null;
      try {
        const buyer = await createTestAccount("t10a-pos-buyer");
        handles.push(buyer);
        const merchant = await createTestAccount("t10a-pos-merchant");
        handles.push(merchant);
        const biz = await createTestBusiness(merchant, { label: "t10apos" });
        handles.push(biz);
        const prod = await createTestProduct(biz, {
          name: "e2e-fixture-t10a-pos-widget",
          pricePence: 4500,
          currency: "GBP",
          status: "live",
        });
        handles.push(prod);
        const order = await createTestOrder(buyer, biz, prod, {
          pricePence: 4500,
          currency: "GBP",
          state: "created",
        });
        orderId = order.orderId;
        handles.push(order);

        const stripeEventId = `evt_e2e_pos_${Date.now()}`;
        const body = JSON.stringify({
          id: stripeEventId,
          type: "checkout.session.completed",
          data: {
            object: {
              id: `cs_test_${Date.now()}`,
              payment_status: "paid",
              metadata: { nex_order_id: orderId },
            },
          },
        });
        const ts = Math.floor(Date.now() / 1000).toString();
        const v1 = createHmac("sha256", secret)
          .update(`${ts}.${body}`, "utf8")
          .digest("hex");

        // First delivery.
        const first = await request.post(STRIPE_WEBHOOK_PATH, {
          headers: {
            "content-type": "application/json",
            "stripe-signature": `t=${ts},v1=${v1}`,
            "stripe-account": "acct_e2e_connected_merchant",
          },
          data: body,
        });
        expect(first.status(), "first delivery 200").toBe(200);

        // Duplicate delivery · same stripe-event-id.
        const dup = await request.post(STRIPE_WEBHOOK_PATH, {
          headers: {
            "content-type": "application/json",
            "stripe-signature": `t=${ts},v1=${v1}`,
            "stripe-account": "acct_e2e_connected_merchant",
          },
          data: body,
        });
        expect(dup.status(), "duplicate delivery 200 · idempotent").toBe(200);

        const sb = supabaseAdmin();
        const { data: evs } = await sb
          .from("nex_order_event")
          .select("event, metadata")
          .eq("order_id", orderId!);
        const matches = (evs ?? []).filter((e) => {
          const meta = (e as { metadata: unknown }).metadata as
            | Record<string, unknown>
            | null;
          return meta && meta.stripe_event_id === stripeEventId;
        });
        expect(
          matches.length,
          "exactly one nex_order_event row carries the stripe_event_id · no duplicate audit",
        ).toBe(1);

        // Merchant-owned destination · the connected-account id travels
        // on the event metadata (sealed contract · route.ts:200-207).
        const connectedIds = matches.map(
          (m) =>
            ((m as { metadata: { stripe_connected_account_id?: unknown } })
              .metadata.stripe_connected_account_id as string | undefined) ??
            null,
        );
        expect(
          connectedIds,
          "merchant-owned destination preserved in the audit trail",
        ).toEqual(["acct_e2e_connected_merchant"]);
      } finally {
        if (orderId) {
          try {
            await withPgClient(async (c) => {
              await c.query(
                "DELETE FROM nex_ledger_line WHERE entry_id IN (SELECT id FROM nex_ledger_entry WHERE order_id = $1)",
                [orderId],
              );
              await c.query(
                "DELETE FROM nex_ledger_entry WHERE order_id = $1",
                [orderId],
              );
            });
          } catch {
            // best effort
          }
        }
        await teardownAll(handles);
      }
    },
  );
});
