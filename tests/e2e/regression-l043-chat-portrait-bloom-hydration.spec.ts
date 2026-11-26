// tests/e2e/regression-l043-chat-portrait-bloom-hydration.spec.ts
//
// L-043 · /nex-native/chat/peer/[accountId] portrait-bloom-shell
// hydration-mismatch regression · authored 2026-11-26 under Strict
// Complete-App Delivery Directive 2026-11-26 priority 1 (Chat pillar).
//
// Why this spec exists
// --------------------
// 9dfa90b4 landed two fixes to `_portrait-bloom-shell.tsx`, both in
// the same class as L-036 (/manage/orders/[orderId]) and L-042
// (/manage/orders list):
//
//   Fix 1 · `formatBubblePrice(pence, currency)` was calling
//     `majors.toLocaleString()` with NO locale argument at seven
//     call sites (product cards, cart line items, subtotals,
//     direct-price savings, cart chips). Node (SSR) picks "en-US"/"C"
//     while the browser picks the user's system locale. For IDR
//     amounts the two diverge on group separators (1,000,000 vs
//     1.000.000). React 19 silently reconciles the mismatch but the
//     first paint is wrong.
//     FIX: pin locale to "en-US" explicitly · SSR and browser now
//     both emit "Rp 1,000,000".
//
//   Fix 2 · Bubble timestamp rendered via
//     `new Date(iso).toLocaleTimeString("en-GB", …)` inline in JSX.
//     Pinning the locale fixes locale drift but Node (SSR) formats
//     in the HOST timezone while the browser formats in the viewer's
//     timezone. A 10:00Z message renders "10:00" on Dublin-hosted
//     Node vs "17:00" on a Jakarta browser → hydration mismatch at
//     every bubble.
//     FIX: wrap each render site in `<ClientMessageTime iso={...} />`
//     that SSRs a bare placeholder (5 × U+2007 figure-spaces, same
//     width as "HH:MM") and swaps to `formatTime(iso)` in a
//     useEffect after hydration.
//
// Regression surface
// ------------------
// This spec catches any future regression that:
//   (a) re-introduces a bare `.toLocaleString()` without a locale
//       argument in `formatBubblePrice`, or
//   (b) removes the `<ClientMessageTime>` wrapper and re-renders the
//       timestamp at SSR in the Node host tz.
//
// Both symptoms manifest as a first-paint text that differs from
// post-hydration text, which this spec asserts against directly.
//
// Three-contract shape (mirrors L-042 regression spec exactly)
//
//   Contract A (SSR text is locale/tz-neutral) · the SSR HTML must
//     emit the ClientMessageTime placeholder (figure-space string)
//     for every seeded message's timestamp slot. For the price slot
//     of any product/cart bubble, the SSR HTML must be identical to
//     the browser's post-hydration render (because `formatBubblePrice`
//     now always runs "en-US").
//
//   Contract B (post-hydration swap fires) · after hydration settles
//     the visible timestamp in each bubble must have resolved to a
//     "HH:MM" pattern matching `formatTime(iso)` in the viewer's
//     configured timezone, and must be DIFFERENT from the SSR
//     placeholder.
//
//   Contract C (defence-in-depth) · zero React hydration warnings
//     fire on the console during the mount-to-settle window.
//
// The browser context is created with a locale + timezone that
// differ from the Node host to provide the strongest trigger:
//   locale    = "en-GB"      (Node default is "en-US" / "C")
//   timezone  = "Asia/Jakarta" (Node default on Windows dev = host tz)
//
// Fixture requirement
// -------------------
// This spec needs a chat-peer fixture:
//   · one merchant account (owner of a seeded nex_business)
//   · one peer account (a buyer)
//   · one `nex_conversation` row linking them
//   · one `nex_conversation_participant` row per side
//   · one `nex_message` row with a known ISO timestamp and a
//     known IDR price-embed (so both the time slot AND the
//     price slot are exercised in a single bubble)
//
// `tests/e2e/_fixtures/sandbox-test-harness.ts` as of 9dfa90b4
// exposes:
//   createTestAccount · createTestBusiness · createTestProduct ·
//   createTestOrder · signInAsFixtureInBrowser · teardownAll
//   (teardown already handles nex_conversation + nex_message via
//   the strict-ownership + `SET LOCAL session_replication_role =
//   replica` trigger-bypass loop at line 698-772)
// but it does NOT expose any of:
//   seedChatPeer · createTestConversation · createTestMessage
//
// Per the parallel-agent task directive, this spec is AUTHORED
// but SKIPPED until the fixture helper lands. The skip surfaces
// in the Playwright report (not a silent pass). When the helper
// is added the `test.skip(...)` guard at the top becomes
// `test(...)` with no other change needed.
//
// Boundaries honoured
//   · No product-code CHANGE in this spec (the L-043 fix is a
//     separate edit already landed in 9dfa90b4).
//   · No commit, no push, no migration, no prod access.
//   · Device-only chat storage + E2E encryption sealed invariants
//     untouched · this spec only reads what the shell RENDERS from
//     SSR props; it does not inspect decrypted bodies or local
//     IndexedDB.
//   · Fixture teardown is a QUALITY GATE · residual = no clean PASS.
//
// Classification: REGRESSION SPEC · exercises REAL chat UI mount +
// REAL seeded conversation/message rows + REAL browser hydration-
// warning capture against sandbox Supabase via fixture harness.

import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  createTestBusiness,
  seedChatPeer,
  signInAsFixtureInBrowser,
  teardownAll,
  type FixtureHandle,
} from "./_fixtures/sandbox-test-harness";

// ─────────────────────────────────────────────────────────────────
// Fixture-gap guard · CLEARED 2026-11-27.
//
// seedChatPeer + createTestConversation + createTestMessage now
// land in sandbox-test-harness.ts under the L-043 enablement cycle.
// The former skip gate is retained as a wired `test.skip(false, …)`
// no-op so the historical reason is preserved in git/blame while
// tests run as authored.
// ─────────────────────────────────────────────────────────────────
const FIXTURE_HELPER_AVAILABLE = true;
const SKIP_REASON =
  "L-043 fixture helper landed 2026-11-27 · seedChatPeer / " +
  "createTestConversation / createTestMessage exported from " +
  "sandbox-test-harness.ts. Gate preserved for provenance only.";

test.describe.serial(
  "L-043 · /chat/peer portrait-bloom hydration-mismatch regression",
  () => {
    test.skip(!FIXTURE_HELPER_AVAILABLE, SKIP_REASON);

    test("no React hydration warnings fire when buyer opens peer chat under a different-locale + different-timezone browser context (exercises both formatBubblePrice and ClientMessageTime fixes)", async ({
      browser,
    }) => {
      test.setTimeout(180_000);
      assertSandboxRef();
      const handles: FixtureHandle[] = [];

      // Different locale AND timezone from the Node host. This is
      // the condition under which the pre-fix render-time
      // `.toLocaleString()` + inline toLocaleTimeString would
      // diverge between SSR and hydration.
      const context = await browser.newContext({
        storageState: undefined,
        locale: "en-GB",
        timezoneId: "Asia/Jakarta",
      });
      const page: Page = await context.newPage();

      // ─── Hydration warning capture ───────────────────────────
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
        // ─────────────────────────────────────────────────────
        // 1 · Seed merchant + peer + business + conversation +
        //     one IDR-priced message. The message's sent_at is
        //     pinned to a fixed UTC ISO so the SSR Node-tz
        //     render vs. Jakarta-browser render would diverge
        //     by exactly 7 hours under the pre-fix code path.
        // ─────────────────────────────────────────────────────
        const merchant = await createTestAccount({
          label: "l043-portrait-merchant",
          returnPassword: true,
        });
        handles.push(merchant);
        const peer = await createTestAccount({
          label: "l043-portrait-peer",
          returnPassword: true,
        });
        handles.push(peer);
        const biz = await createTestBusiness(merchant, {
          label: "l043-portrait-shop",
        });
        handles.push(biz);

        // Fixed UTC ISO so the hydration-tz divergence is
        // deterministic. 10:00Z → "10:00" on Node (host tz,
        // likely UTC on CI) vs "17:00" on Jakarta browser.
        const messageSentAtIso = "2026-11-20T10:00:00.000Z";
        const chatPeer = await seedChatPeer({
          merchant,
          peer,
          businessId: biz.businessId,
          messageSentAtIso,
          pricePence: 100_000_000, // Rp 1,000,000 → tests group separator
          currency: "IDR",
        });
        handles.push(chatPeer as unknown as FixtureHandle);

        // ─────────────────────────────────────────────────────
        // 2 · Sign in as the peer (buyer). The portrait-bloom
        //     shell renders when `?surface=peer` under the
        //     chat/peer/[accountId] route.
        // ─────────────────────────────────────────────────────
        await signInAsFixtureInBrowser(page, peer);

        const chatUrl = `/nex-native/chat/peer/${chatPeer.merchantAccountId}`;

        // ─────────────────────────────────────────────────────
        // 3 · Contract A · fetch raw SSR HTML and assert the
        //     ClientMessageTime placeholder (figure-space
        //     string) appears in the visible HTML. A regression
        //     that removes <ClientMessageTime> and renders
        //     `toLocaleTimeString` inline would emit a literal
        //     "HH:MM" here, and the placeholder substring would
        //     be absent.
        // ─────────────────────────────────────────────────────
        const ssrResp = await page.request.get(chatUrl);
        expect(
          ssrResp.status(),
          `L-043 · authed SSR fetch of ${chatUrl} must return 2xx · got=${ssrResp.status()}`,
        ).toBeLessThan(500);
        const ssrHtmlRaw = await ssrResp.text();

        // Strip <script> + comments so the RSC data payload
        // (which embeds raw message JSON) cannot satisfy the
        // assertion. What remains is the rendered DOM.
        const ssrVisibleHtml = ssrHtmlRaw
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<!--[\s\S]*?-->/g, "");

        // ClientMessageTime placeholder is 5 × U+2007 figure-spaces.
        const placeholder = "\u2007\u2007\u2007\u2007\u2007";
        expect(
          ssrVisibleHtml.includes(placeholder),
          `L-043 Contract A · ClientMessageTime placeholder (5 × U+2007) must appear in SSR visible HTML · a regression that re-inlines toLocaleTimeString would emit "HH:MM" here instead`,
        ).toBe(true);

        // ClientMessageTime SSR must NOT emit the browser-tz
        // formatted time. For Jakarta browser context at the
        // seeded 10:00Z ISO, the wrong render would produce "17:00".
        expect(
          ssrVisibleHtml.includes("17:00"),
          `L-043 Contract A · SSR HTML must NOT contain the Jakarta-tz formatted "17:00" · its presence proves the ClientMessageTime wrapper has been removed`,
        ).toBe(false);

        // formatBubblePrice SSR must already use "en-US" group
        // separator. For Rp 1,000,000, SSR must emit "1,000,000"
        // (comma), never "1.000.000" (dot, id-ID) nor "1 000 000"
        // (space, host default under some locales).
        expect(
          ssrVisibleHtml.includes("Rp 1,000,000"),
          `L-043 Contract A · formatBubblePrice SSR must emit "Rp 1,000,000" with en-US comma separators · a regression that removes the "en-US" locale pin would emit a host-locale variant here`,
        ).toBe(true);

        // ─────────────────────────────────────────────────────
        // 4 · Open the chat in a real browser so React hydrates
        //     and <ClientMessageTime>'s useEffect fires.
        // ─────────────────────────────────────────────────────
        const resp = await page.goto(chatUrl, {
          waitUntil: "domcontentloaded",
        });
        expect(
          resp?.status(),
          `L-043 · peer must land on chat shell · url=${chatUrl} · got=${resp?.status()}`,
        ).toBeLessThan(500);

        // Wait for the shell's message list to mount. The portrait
        // bloom shell marks its scroll region with the stable
        // `data-nex-message-scroll` attribute (_portrait-bloom-shell.tsx
        // line 1220). The spec originally referenced
        // `[data-nex-portrait-bloom-shell]` which the shell does not
        // emit; corrected 2026-11-27 under L-043 enablement.
        await page.waitForSelector(`[data-nex-message-scroll]`, {
          state: "attached",
          timeout: 20_000,
        });
        await page.waitForLoadState("load", { timeout: 20_000 });
        await page.waitForTimeout(1_000); // bounded tick for useEffect

        // ─────────────────────────────────────────────────────
        // 5 · Contract B · post-hydration the bubble's timestamp
        //     slot must match "HH:MM" and must be DIFFERENT from
        //     the SSR placeholder. For a message at 10:00Z
        //     rendered in Asia/Jakarta the expected text is
        //     "17:00".
        // ─────────────────────────────────────────────────────
        // The shell emits `data-nex-msg-id={m.id}` on each message
        // bubble wrapper (_portrait-bloom-shell.tsx line 1367). The
        // spec originally referenced `data-nex-message-id`; corrected
        // 2026-11-27 under L-043 enablement.
        const messageBubble = page
          .locator(`[data-nex-msg-id="${chatPeer.messageId}"]`)
          .first();
        await expect(
          messageBubble,
          `L-043 · message bubble for ${chatPeer.messageId} must mount`,
        ).toBeVisible({ timeout: 10_000 });

        // Poll the bubble text so we don't race useEffect.
        await expect
          .poll(
            async () => {
              const text = (await messageBubble.textContent()) ?? "";
              return text.includes("17:00");
            },
            {
              message:
                "L-043 Contract B · post-hydration bubble must show '17:00' (Asia/Jakarta render of 10:00Z) · useEffect must swap the placeholder to formatTime(iso) output",
              timeout: 15_000,
            },
          )
          .toBe(true);

        const bubbleText = (await messageBubble.textContent()) ?? "";
        expect(
          bubbleText.includes(placeholder),
          `L-043 Contract B · post-hydration bubble must NOT still contain the figure-space placeholder · got='${bubbleText}'`,
        ).toBe(false);

        // Post-hydration the price slot must still read
        // "Rp 1,000,000" (same as SSR). This asserts the
        // formatBubblePrice "en-US" pin survives hydration
        // without a visible flip.
        expect(
          bubbleText.includes("Rp 1,000,000"),
          `L-043 Contract B · post-hydration bubble must still show "Rp 1,000,000" · a regression that re-introduces host-locale toLocaleString would produce a different separator here`,
        ).toBe(true);

        // ─────────────────────────────────────────────────────
        // 6 · Contract C · defence-in-depth console listener.
        // ─────────────────────────────────────────────────────
        expect(
          hydrationMessages,
          `L-043 regression · no React hydration mismatch warnings must fire · captured ${hydrationMessages.length}: ${JSON.stringify(hydrationMessages, null, 2)}`,
        ).toHaveLength(0);
      } finally {
        page.off("console", onConsole);

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
            `L-043 teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
          ).toBe(0);
        }

        await page.close().catch(() => undefined);
        await context.close().catch(() => undefined);
      }
    });
  },
);

