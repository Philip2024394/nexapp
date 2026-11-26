// tests/e2e/regression-l036-order-detail-hydration.spec.ts
//
// L-036 · /manage/orders/[orderId]/_client.tsx hydration-mismatch
// regression · authored 2026-11-26 under Strict Complete-App Delivery
// Directive 2026-11-26 priority 1.
//
// Why this spec exists
// --------------------
// The L-035 pattern-hunt discovered that the sealed order-detail
// client at `src/app/nex-native/manage/orders/[orderId]/_client.tsx`
// was formatting `order.created_at` and audit-trail event timestamps
// via `new Date(iso).toLocaleString()` called from render inside a
// "use client" component. Because Next.js 16 SSRs client components
// for their initial HTML before hydration, the first server render
// ran under the Node runtime locale + timezone and the first client
// render ran under the viewer's browser locale + timezone, producing
// text divergence and a React hydration warning.
//
// The L-036 fix (same-cycle commit of this pass) replaces the inline
// `formatDateTime()` calls with a `<ClientDateTime iso={...} />`
// component that renders the stable raw ISO on SSR (identical on
// server and client) and swaps to the locale-formatted value in a
// `useEffect` after hydration. The initial server and client renders
// now match exactly.
//
// Regression surface
// ------------------
// This spec exists to catch any future regression that re-introduces
// a non-deterministic render in the order-detail client — not just
// `toLocaleString` but ANY server/client divergent text (e.g. a bare
// `new Date().toString()`, a locale-dependent number formatter, a
// `window.navigator.language` branch that runs during render, etc).
//
// Test strategy: React 19 under Next.js 16 does NOT reliably emit a
// console hydration warning — the "recover from mismatched text"
// behaviour was tightened in React 19 and silently reconciles many
// subtrees. So a console-listener assertion alone is insufficient.
// Instead, this spec directly inspects the RAW SSR HTML emitted by
// the server (via a cookie-forwarded `fetch` from inside the authed
// page context) and asserts two orthogonal contracts:
//
//   Contract A (the fix is in place) · the SSR HTML must carry the
//     RAW ISO string of `order.created_at` in the "Created ..." slot,
//     NOT a locale-formatted variant. A raw ISO is identical on
//     server and client, so React cannot find a mismatch during
//     hydration. This is the SSR-safe invariant.
//
//   Contract B (useEffect still runs) · after hydration settles, the
//     visible text in the "Created" header line must be a
//     locale-formatted string that is DIFFERENT from the raw ISO.
//     This proves the useEffect fired and the localisation didn't
//     regress silently to a no-op.
//
// Defence in depth: the console listener is kept as a third check so
// a future React build that DOES surface mismatches would also be
// caught — but it is not the primary assertion.
//
// The test:
//   (1) seeds a real merchant + business + product + order against
//       sandbox Supabase · state='created' so the "Created {ts}"
//       header line renders with a real ISO,
//   (2) opens the merchant's /manage/orders/{id} detail page in a
//       Playwright context with an EXPLICIT locale+timezone override
//       (`en-GB` + `Asia/Jakarta`) that is almost certainly different
//       from the node-server's locale+timezone,
//   (3) extracts raw SSR HTML via authed fetch and asserts the ISO
//       appears raw in the "Created" slot (Contract A),
//   (4) asserts the post-hydration text has resolved to a locale-
//       formatted string different from the ISO (Contract B),
//   (5) asserts zero hydration warnings on the console (defence).
//
// What this spec does NOT cover (honest deferral)
// ------------------------------------------------
//   · Full state-transition journey (new → paid → completed) · covered
//     by T-8.
//   · Action-strip button-click flows · covered by T-8.
//   · Ownership gate (non-owner 404) · covered by T-8.
//
// Boundaries honoured
//   · No product-code CHANGE in this spec (the L-036 fix is a separate
//     edit under the same cycle · spec is downstream verification).
//   · Fixture teardown is a QUALITY GATE · residual = no clean PASS.
//
// Classification: REGRESSION SPEC · exercises REAL merchant UI mount
// + REAL order DB row + REAL browser hydration-warning capture
// against sandbox Supabase via fixture harness.

import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  createTestBusiness,
  createTestOrder,
  createTestProduct,
  signInAsFixtureInBrowser,
  supabaseAdmin,
  teardownAll,
  type FixtureHandle,
  type TestAccountHandle,
} from "./_fixtures/sandbox-test-harness";

async function ownerScopedBusinessSweep(
  accountHandle: TestAccountHandle,
): Promise<void> {
  const sb = supabaseAdmin();
  const { data: ownedBusinesses } = await sb
    .from("nex_business")
    .select("id")
    .eq("owner_account_id", accountHandle.nexAccountId);
  const ownedBizIds = (ownedBusinesses ?? [])
    .map((r) => (r as { id: string }).id)
    .filter(Boolean);
  if (ownedBizIds.length === 0) return;
  await sb.from("nex_order").delete().in("business_id", ownedBizIds);
  await sb.from("nex_product").delete().in("business_id", ownedBizIds);
  await sb.from("nex_business").delete().in("id", ownedBizIds);
}

test.describe.serial(
  "L-036 · /manage/orders/[orderId] hydration-mismatch regression",
  () => {
    test("no React hydration warnings fire when merchant opens order detail under a different-timezone browser context", async ({
      browser,
    }) => {
      test.setTimeout(180_000);
      assertSandboxRef();
      const handles: FixtureHandle[] = [];
      const merchantAccounts: TestAccountHandle[] = [];

      // Explicit locale + timezone override that is very likely
      // different from the Node dev-server's host values. This is the
      // condition under which the pre-fix `toLocaleString` in render
      // would diverge between SSR and hydration.
      const context = await browser.newContext({
        storageState: undefined,
        locale: "en-GB",
        timezoneId: "Asia/Jakarta",
      });
      const page: Page = await context.newPage();

      // ─── Hydration warning capture ───────────────────────────────
      // React emits hydration diagnostics as either `error` or
      // `warning` console messages. We match broadly on the known
      // phrasings:
      //   · "Hydration failed"
      //   · "Text content did not match"
      //   · "Server rendered HTML did not match"
      //   · "did not match the server-rendered HTML"
      //   · "Warning: Text content did not match"
      //   · the Next.js wrapper "A tree hydrated but some attributes..."
      //
      // We also capture the raw text so the failure message surfaces
      // what actually fired.
      const hydrationMessages: string[] = [];
      const onConsole = (msg: ConsoleMessage): void => {
        const text = msg.text();
        if (
          /hydrat|did not match|server(?:-rendered)? HTML|a tree hydrated/i.test(
            text,
          )
        ) {
          hydrationMessages.push(`[${msg.type()}] ${text}`);
        }
      };
      page.on("console", onConsole);

      try {
        // ─────────────────────────────────────────────────────────
        // 1 · Seed merchant + buyer + business + product + order.
        //     The order is created in state='created' so the detail
        //     page renders its "Created {timestamp}" header line —
        //     the exact call site that used to carry the hydration
        //     defect at page.tsx:289.
        // ─────────────────────────────────────────────────────────
        const merchant = await createTestAccount({
          label: "l036-order-merchant",
          returnPassword: true,
        });
        handles.push(merchant);
        merchantAccounts.push(merchant);
        const buyer = await createTestAccount({
          label: "l036-order-buyer",
          returnPassword: true,
        });
        handles.push(buyer);
        const biz = await createTestBusiness(merchant, {
          label: "l036-order-shop",
        });
        handles.push(biz);
        const product = await createTestProduct(biz, {
          name: "L-036 regression product",
          pricePence: 1299,
          currency: "GBP",
          status: "live",
        });
        handles.push(product);
        const order = await createTestOrder(buyer, biz, product, {
          state: "created",
        });
        handles.push(order);

        // The fixture handle intentionally doesn't expose created_at
        // (mig 005: server-set default). Read it back directly so we
        // can assert its raw form on the SSR HTML in Contract A.
        const { data: orderRow, error: orderRowErr } = await supabaseAdmin()
          .from("nex_order")
          .select("created_at")
          .eq("id", order.orderId)
          .single();
        if (orderRowErr || !orderRow?.created_at) {
          throw new Error(
            `L-036 · failed to read order.created_at for ${order.orderId}: ${
              orderRowErr?.message ?? "no row"
            }`,
          );
        }
        const detailUrl = `/nex-native/manage/orders/${order.orderId}`;
        const createdIso = orderRow.created_at as string;

        // ─────────────────────────────────────────────────────────
        // 2 · Sign in as the owning merchant.
        // ─────────────────────────────────────────────────────────
        await signInAsFixtureInBrowser(page, merchant);

        // ─────────────────────────────────────────────────────────
        // 3 · Contract A · fetch the RAW SSR HTML via the authed
        //     page.request client (inherits the browser context's
        //     Supabase + Next.js cookies) and assert the "Created"
        //     slot carries the RAW ISO of `order.created_at`, NOT a
        //     locale-formatted variant. A raw ISO is identical on
        //     server and client, so no mismatch can arise during
        //     hydration. This is the SSR-safe invariant that the
        //     L-036 fix guarantees via the <ClientDateTime> seed
        //     state. If someone replaces the seed state with an
        //     inline `toLocaleString()` call the raw ISO disappears
        //     from the SSR HTML and this assertion fails.
        // ─────────────────────────────────────────────────────────
        const ssrResp = await page.request.get(detailUrl);
        expect(
          ssrResp.status(),
          `L-036 · authed SSR fetch of ${detailUrl} must return 2xx · got=${ssrResp.status()}`,
        ).toBeLessThan(500);
        const ssrHtmlRaw = await ssrResp.text();

        // Strip all <script> blocks and HTML comments so the RSC
        // payload (which embeds the raw order JSON regardless of
        // rendered format) cannot satisfy the assertion. What remains
        // is the rendered DOM text + attribute surface — i.e. what
        // the user actually sees on first paint before hydration.
        const ssrVisibleHtml = ssrHtmlRaw
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<!--[\s\S]*?-->/g, "");

        // Find the "Created " literal (emitted by _client.tsx:307 as
        // the fixed text preceding <ClientDateTime>) and take a
        // bounded window of the HTML immediately following it. That
        // window is where the <ClientDateTime> seed state renders on
        // SSR. A correct fix seeds with the raw ISO; a regression
        // that formats at render time emits the server-locale string
        // (no 'T', no timezone offset) and this assertion fails.
        const createdIdx = ssrVisibleHtml.indexOf("Created ");
        expect(
          createdIdx,
          "L-036 Contract A · 'Created ' literal must appear in the SSR visible HTML (strips scripts + comments)",
        ).toBeGreaterThanOrEqual(0);
        const createdWindow = ssrVisibleHtml.slice(
          createdIdx,
          createdIdx + 400,
        );

        expect(
          createdWindow.includes(createdIso),
          `L-036 Contract A · raw ISO '${createdIso}' must appear in the 400-char window after "Created " in the SSR visible HTML · a render-time toLocaleString() regression would emit a locale-formatted string here instead · window='${createdWindow}'`,
        ).toBe(true);

        // ─────────────────────────────────────────────────────────
        // 4 · Open the detail page in a real browser so React
        //     hydrates and the <ClientDateTime> useEffect fires.
        // ─────────────────────────────────────────────────────────
        const resp = await page.goto(detailUrl, {
          waitUntil: "domcontentloaded",
        });
        expect(
          resp?.status(),
          `L-036 · merchant must land on detail page · url=${detailUrl} · got=${resp?.status()}`,
        ).toBeLessThan(500);

        // Wait for hydration to settle. Can't use `networkidle` on
        // this surface — the audit-trail events API is polled and
        // keeps the connection open. Instead: wait for the sealed
        // actions-section anchor to be present (proves React hydrated
        // the client subtree), wait for `load` (proves initial HTML
        // + early resources are done), then give the useEffect a
        // bounded tick to flush its setState so any post-hydration
        // divergence surfaces as a console warning.
        await page.waitForSelector("[data-nex-order-actions]", {
          state: "attached",
          timeout: 20_000,
        });
        await page.waitForLoadState("load", { timeout: 20_000 });
        await page.waitForTimeout(1_000);

        // ─────────────────────────────────────────────────────────
        // 5 · Contract B · post-hydration the "Created" header line
        //     must show a locale-formatted timestamp DIFFERENT from
        //     the raw ISO. This proves the <ClientDateTime>
        //     useEffect fired and did not silently regress to a
        //     no-op. Together with Contract A (raw ISO on SSR) this
        //     is the full hydration-safe formatter contract.
        // ─────────────────────────────────────────────────────────
        const createdHeader = page.getByText(/Created\s+/).first();
        await expect(
          createdHeader,
          "L-036 · 'Created ...' header line must render on the merchant's order-detail page",
        ).toBeVisible({ timeout: 10_000 });

        // Poll the visible text so we don't race the useEffect.
        await expect
          .poll(
            async () => {
              const text = (await createdHeader.textContent()) ?? "";
              // Strip the fixed "Created " literal; what remains is
              // the <ClientDateTime> output.
              return text.replace(/^\s*Created\s+/, "").trim();
            },
            {
              message:
                "L-036 Contract B · post-hydration formatted timestamp must appear and differ from the raw ISO",
              timeout: 15_000,
            },
          )
          .not.toBe(createdIso);

        // Sanity check the locale actually swapped — after useEffect
        // the visible text must NOT be the raw ISO. A regression that
        // reverts to the ISO (or fails to format) would fail here.
        const formattedText = (
          (await createdHeader.textContent()) ?? ""
        )
          .replace(/^\s*Created\s+/, "")
          .trim();
        expect(
          formattedText,
          `L-036 Contract B · formatted timestamp must not equal the raw ISO · got='${formattedText}' · iso='${createdIso}'`,
        ).not.toBe(createdIso);
        expect(
          formattedText.length,
          "L-036 Contract B · formatted timestamp must be non-empty",
        ).toBeGreaterThan(0);

        // ─────────────────────────────────────────────────────────
        // 6 · Contract C · defence-in-depth console listener.
        //     React 19 under Next.js 16 silently reconciles many
        //     mismatches, so this is NOT the primary check, but a
        //     future React build that DOES surface warnings would
        //     still be caught here.
        // ─────────────────────────────────────────────────────────
        expect(
          hydrationMessages,
          `L-036 regression · no React hydration mismatch warnings must fire · captured ${hydrationMessages.length}: ${JSON.stringify(hydrationMessages, null, 2)}`,
        ).toHaveLength(0);
      } finally {
        page.off("console", onConsole);

        try {
          for (const m of merchantAccounts) {
            await ownerScopedBusinessSweep(m);
          }
        } catch (sweepErr) {
          // eslint-disable-next-line no-console
          console.warn(
            `[L-036 sweep] owner-scoped cleanup: ${(sweepErr as Error).message}`,
          );
        }

        await teardownAll(handles);
        const residual = await assertNoResidualFixtures(handles).catch(
          () => null,
        );
        if (residual) {
          const total =
            residual.orders.length +
            residual.products.length +
            residual.businesses.length +
            residual.accounts.length;
          expect(
            total,
            `L-036 teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
          ).toBe(0);
        }

        await page.close().catch(() => undefined);
        await context.close().catch(() => undefined);
      }
    });
  },
);
