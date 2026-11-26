// tests/e2e/regression-l042-orders-list-hydration.spec.ts
//
// L-042 · /nex-native/manage/orders list hydration-mismatch regression
// · authored 2026-11-26 under Strict Complete-App Delivery Directive
// 2026-11-26 priority 3 (Merchant order journey).
//
// Why this spec exists
// --------------------
// L-036 fixed a render-time `new Date(iso).toLocaleString()` in the
// order DETAIL client. A disk-free pattern-hunt in the same cycle
// extended the search to the orders LIST client and found the same
// class of defect:
//
//   `src/app/nex-native/manage/orders/_client.tsx:49-63` ·
//   `formatRelTime(iso)` called in render emits
//   `new Date(iso).toLocaleDateString()` for orders ≥ 7 days old.
//   `toLocaleDateString()` with no locale argument picks the HOST
//   locale · Node (SSR) vs browser (hydration) diverge · React 19
//   silently reconciles the mismatch but the first paint is wrong.
//
// Secondary SSR hazard in the same function: `Date.now()` differs
// between the Node SSR pass and browser hydration by whatever latency
// the shell adds. In pathological cases this can cross the "just now"
// / "Xm ago" / "Xh ago" / "Xd ago" boundaries and flip the text.
//
// The L-042 fix wraps the entire `formatRelTime` call in a
// `<ClientRelTime iso={...} />` component that renders the stable
// raw ISO on SSR (via `useState<string>(iso)` seed) and swaps to
// `formatRelTime(iso)` in a `useEffect` after hydration. Same
// `ClientDateTime` pattern as the L-036 fix.
//
// Regression surface
// ------------------
// This spec catches any future regression that re-introduces a
// non-deterministic render in the orders LIST client — not just
// `toLocaleDateString()` but any server/client divergent text in
// the per-row timestamp slot.
//
// Test strategy: identical shape to the L-036 regression (three
// orthogonal contracts). React 19 under Next.js 16 does NOT reliably
// emit a console hydration warning, so a console-listener-only
// assertion is insufficient; the SSR HTML inspection is the primary
// check.
//
//   Contract A (the fix is in place) · the SSR HTML for the order
//     row must carry the RAW ISO string of `order.created_at` in the
//     per-row timestamp slot, NOT a locale-formatted variant. A raw
//     ISO is identical on server and client, so React cannot find a
//     mismatch during hydration.
//
//   Contract B (useEffect still runs) · after hydration settles, the
//     visible text in the row's timestamp slot must have resolved to
//     the `formatRelTime` output (`"Xd ago"` for a < 7-day order, or
//     a locale date string for ≥ 7 days) and must be DIFFERENT from
//     the raw ISO.
//
//   Contract C (defence-in-depth) · zero React hydration warnings
//     fire on the console during the mount-to-settle window.
//
// The spec deliberately seeds a >= 7-day-old order so the `useEffect`
// branch exercises the locale-dependent `toLocaleDateString()` code
// path — the strongest signal that the fix works end-to-end. Default
// `nex_order.created_at` is a server-set NOW(); the spec uses the
// service-role admin client to UPDATE the row to an explicit older
// timestamp after insert.
//
// What this spec does NOT cover (honest deferral)
// ------------------------------------------------
//   · Row-click → /manage/orders/[orderId] navigation · covered by
//     L-033 and T-8.
//   · Ownership gate (cross-merchant leakage) · covered by L-033.
//   · Status-filter chips + free-text search interactions · out of
//     scope for the hydration contract.
//
// Boundaries honoured
//   · No product-code CHANGE in this spec (the L-042 fix is a
//     separate edit under the same cycle).
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
  "L-042 · /manage/orders list hydration-mismatch regression",
  () => {
    test("no React hydration warnings fire when merchant opens orders LIST under a different-timezone browser context (>= 7-day-old order exercises the toLocaleDateString branch)", async ({
      browser,
    }) => {
      test.setTimeout(180_000);
      assertSandboxRef();
      const handles: FixtureHandle[] = [];
      const merchantAccounts: TestAccountHandle[] = [];

      // Explicit locale + timezone override that is almost certainly
      // different from the Node dev-server's host values. This is the
      // condition under which the pre-fix render-time
      // `toLocaleDateString()` would diverge between SSR and hydration.
      const context = await browser.newContext({
        storageState: undefined,
        locale: "en-GB",
        timezoneId: "Asia/Jakarta",
      });
      const page: Page = await context.newPage();

      // ─── Hydration warning capture ───────────────────────────────
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
        //     The order is created at DB-default `now()`, then
        //     UPDATEd to an explicit >= 7-day-old timestamp so the
        //     render-time branch exercises `toLocaleDateString()`
        //     (the real SSR/CSR divergence trigger).
        // ─────────────────────────────────────────────────────────
        const merchant = await createTestAccount({
          label: "l042-list-merchant",
          returnPassword: true,
        });
        handles.push(merchant);
        merchantAccounts.push(merchant);
        const buyer = await createTestAccount({
          label: "l042-list-buyer",
          returnPassword: true,
        });
        handles.push(buyer);
        const biz = await createTestBusiness(merchant, {
          label: "l042-list-shop",
        });
        handles.push(biz);
        const product = await createTestProduct(biz, {
          name: "L-042 regression product",
          pricePence: 1299,
          currency: "GBP",
          status: "live",
        });
        handles.push(product);
        const order = await createTestOrder(buyer, biz, product, {
          state: "created",
        });
        handles.push(order);

        // Backdate created_at to 10 days ago so formatRelTime's
        // `days >= 7` branch runs and exercises toLocaleDateString().
        // Service-role UPDATE bypasses RLS · sandbox-only.
        const tenDaysAgoIso = new Date(
          Date.now() - 10 * 24 * 60 * 60 * 1000,
        ).toISOString();
        const sb = supabaseAdmin();
        const { error: updateErr } = await sb
          .from("nex_order")
          .update({ created_at: tenDaysAgoIso })
          .eq("id", order.orderId);
        if (updateErr) {
          throw new Error(
            `L-042 · failed to backdate order ${order.orderId}: ${updateErr.message}`,
          );
        }

        // Read the row back · Supabase may canonicalise the ISO to
        // a different representation (e.g. appending microseconds
        // or trailing Z vs +00:00). Contract A asserts the exact
        // DB-canonical string appears in the SSR HTML.
        const { data: orderRow, error: orderRowErr } = await sb
          .from("nex_order")
          .select("created_at")
          .eq("id", order.orderId)
          .single();
        if (orderRowErr || !orderRow?.created_at) {
          throw new Error(
            `L-042 · failed to read order.created_at for ${order.orderId}: ${
              orderRowErr?.message ?? "no row"
            }`,
          );
        }
        const createdIso = orderRow.created_at as string;
        const listUrl = `/nex-native/manage/orders`;

        // ─────────────────────────────────────────────────────────
        // 2 · Sign in as the owning merchant.
        // ─────────────────────────────────────────────────────────
        await signInAsFixtureInBrowser(page, merchant);

        // ─────────────────────────────────────────────────────────
        // 3 · Contract A · fetch raw SSR HTML of the orders list
        //     and assert the raw ISO appears in the <li> row
        //     emitted for this order. A regression that re-adds a
        //     render-time toLocaleDateString() would emit a Node
        //     locale string here (e.g. "11/16/2026" under en-US
        //     SSR host vs "16/11/2026" under en-GB browser), and
        //     the raw ISO substring would be absent.
        // ─────────────────────────────────────────────────────────
        const ssrResp = await page.request.get(listUrl);
        expect(
          ssrResp.status(),
          `L-042 · authed SSR fetch of ${listUrl} must return 2xx · got=${ssrResp.status()}`,
        ).toBeLessThan(500);
        const ssrHtmlRaw = await ssrResp.text();

        // Strip <script> blocks + HTML comments so the RSC data
        // payload (which embeds the raw order JSON regardless of
        // rendered format) cannot satisfy the assertion. What
        // remains is the rendered DOM.
        const ssrVisibleHtml = ssrHtmlRaw
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<!--[\s\S]*?-->/g, "");

        // Locate the order's own row via the short-id text the row
        // emits (sealed at `_client.tsx:309` · `#{order.id.slice(0,8)}`).
        // That anchor is unique per order and nearby to the
        // timestamp slot that <ClientRelTime> renders.
        const shortId = order.orderId.slice(0, 8);
        const rowAnchorIdx = ssrVisibleHtml.indexOf(`#${shortId}`);
        expect(
          rowAnchorIdx,
          `L-042 Contract A · row anchor '#${shortId}' must appear in SSR visible HTML · a missing row would fail here`,
        ).toBeGreaterThanOrEqual(0);

        // Take a bounded window after the anchor · the per-row
        // timestamp slot (<ClientRelTime iso={order.created_at} />)
        // renders within ~400 chars of the short-id at the current
        // row layout. A correct fix seeds with the raw ISO; a
        // regression that calls toLocaleDateString() at render emits
        // the host-locale date string and this assertion fails.
        const rowWindow = ssrVisibleHtml.slice(
          rowAnchorIdx,
          rowAnchorIdx + 800,
        );
        expect(
          rowWindow.includes(createdIso),
          `L-042 Contract A · raw ISO '${createdIso}' must appear in the 800-char window after row anchor '#${shortId}' in SSR visible HTML · a render-time toLocaleDateString() regression would emit a locale-formatted date string here instead · window='${rowWindow}'`,
        ).toBe(true);

        // ─────────────────────────────────────────────────────────
        // 4 · Open the list page in a real browser so React
        //     hydrates and <ClientRelTime>'s useEffect fires.
        // ─────────────────────────────────────────────────────────
        const resp = await page.goto(listUrl, {
          waitUntil: "domcontentloaded",
        });
        expect(
          resp?.status(),
          `L-042 · merchant must land on orders list · url=${listUrl} · got=${resp?.status()}`,
        ).toBeLessThan(500);

        // Wait for list to mount, then give useEffect a bounded
        // tick to run so Contract B can observe the swap.
        await page.waitForSelector(`[data-nex-manage-orders]`, {
          state: "attached",
          timeout: 20_000,
        });
        await page.waitForLoadState("load", { timeout: 20_000 });
        await page.waitForTimeout(1_000);

        // ─────────────────────────────────────────────────────────
        // 5 · Contract B · post-hydration the per-row timestamp
        //     slot must have resolved to formatRelTime's output
        //     (for a 10-day-old order: a locale date string from
        //     toLocaleDateString()). It must be DIFFERENT from the
        //     raw ISO, proving the useEffect fired.
        // ─────────────────────────────────────────────────────────
        // Scope by text match on the short-id row anchor to find
        // this specific row (the list is newest-first; with a
        // single seeded order the row is first).
        const rowLink = page
          .locator(`a[href="/nex-native/manage/orders/${order.orderId}"]`)
          .first();
        await expect(
          rowLink,
          `L-042 · row link for order ${order.orderId} must mount`,
        ).toBeVisible({ timeout: 10_000 });

        // Poll the row's visible text so we don't race the
        // useEffect; assert the raw ISO is absent (proves the
        // useEffect swapped in the formatRelTime output).
        await expect
          .poll(
            async () => {
              const text = (await rowLink.textContent()) ?? "";
              return text.includes(createdIso);
            },
            {
              message:
                "L-042 Contract B · post-hydration row text must NOT contain the raw ISO (useEffect must swap it to formatRelTime output)",
              timeout: 15_000,
            },
          )
          .toBe(false);

        const postHydrationRowText =
          (await rowLink.textContent()) ?? "";
        expect(
          postHydrationRowText.length,
          "L-042 Contract B · post-hydration row text must be non-empty",
        ).toBeGreaterThan(0);
        expect(
          postHydrationRowText.includes(createdIso),
          `L-042 Contract B · row text must not equal the raw ISO · got='${postHydrationRowText}' · iso='${createdIso}'`,
        ).toBe(false);

        // ─────────────────────────────────────────────────────────
        // 6 · Contract C · defence-in-depth console listener.
        // ─────────────────────────────────────────────────────────
        expect(
          hydrationMessages,
          `L-042 regression · no React hydration mismatch warnings must fire · captured ${hydrationMessages.length}: ${JSON.stringify(hydrationMessages, null, 2)}`,
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
            `[L-042 sweep] owner-scoped cleanup: ${(sweepErr as Error).message}`,
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
            `L-042 teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
          ).toBe(0);
        }

        await page.close().catch(() => undefined);
        await context.close().catch(() => undefined);
      }
    });
  },
);
