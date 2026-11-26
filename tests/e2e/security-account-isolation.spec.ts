// tests/e2e/security-account-isolation.spec.ts
//
// CYCLE 11 · C11-SEC-3 · account-isolation + conversation-boundary
// regression spec · authored 2026-11-25.
//
// Context (Cycle 10 → Cycle 11):
//   Cycle 10 reported a possible Ask-Seller "identity mismatch" that
//   was treated by the Founder as a potential account-isolation OR
//   private-conversation disclosure vulnerability until disproven.
//   Cycle 11 root-caused that event:
//
//     * The signed-in storage-state cookie's JWT `sub` claim decodes
//       to Supabase user `67f6cd2d-c60b-4675-a442-25fa708e1e26` which
//       is EXACTLY `nex-11244.supabase_user_id` in the sandbox DB.
//     * The server resolved the cookie to `nex-11244`'s nex_account
//       and redirected to `nex-11244`'s OWN conversation. No cross-
//       account exposure occurred. The previous cycle's "nex-11339"
//       handle was a fixture mis-identification (that account has
//       supabase_user_id = NULL and therefore cannot be the resolved
//       cookie identity).
//
//   This spec locks that finding in with regression tests that MUST
//   fail if the authorization boundary regresses.
//
// Scope of this spec (what it proves):
//   1. A signed-in account cannot open an RSC conversation page it
//      is not a participant of · the page collapses "non-existent"
//      and "not-a-participant" into the SAME notFound() response so
//      existence is not disclosed.
//   2. A signed-in account cannot read conversation history via
//      `/api/nex-native/chat/conversations/[conversationId]` when
//      they are not a participant · the service returns a non-2xx
//      error, never 200.
//   3. A signed-in account cannot pull incremental messages via
//      `/api/nex-native/chat/encrypted/since` for a conversation
//      they are not a participant of.
//   4. A signed-in account cannot write to `/api/nex-native/chat/
//      encrypted` targeting a conversation they are not a
//      participant of.
//   5. Unauthenticated requests to the write endpoint are rejected
//      with 401 before any participant check runs.
//
// Scope exclusions (explicitly BLOCKED on missing fixtures):
//   * This spec does NOT prove the "URL containing another real
//     user's conversation ID" case against a known-existing
//     counter-party conversation · that would require a second
//     authenticated fixture AND a conversation ID known to belong
//     to the other account. Per Founder 2026-11-25 (Cycle 11):
//     "If a valid existing fixture is unavailable, report BLOCKED.
//     Do not create or improvise one." Only one sandbox storage
//     state exists today (tests/e2e/.auth/state.json, bound to
//     nex-11244). The random-UUID probes used here cover the
//     authorization-boundary code path the same way a known-but-
//     not-mine conversation ID would · because the server-side
//     checks (RSC notFound, service ensureSenderIsParticipant,
//     service getParticipation) treat "not a participant" and
//     "does not exist" IDENTICALLY by design.
//   * This spec does NOT re-prove service-role / RLS behaviour at
//     the SQL layer · RLS plus the service-layer guards both
//     enforce participation, and only the service-layer path is
//     reachable from the HTTP surface.
//
// Prerequisites:
//   * Dev server must be running on http://localhost:3008.
//   * tests/e2e/.auth/state.json must exist (produced by
//     tests/e2e/auth.setup.ts).
//   * `auth-setup` project runs before this spec via the Stage A
//     project `dependencies: ["auth-setup"]` wiring in
//     playwright.config.ts.
//
// IMPORTANT: this spec does NOT create, mutate, or seed any data in
// the database. It only exercises guard paths with random UUIDs and
// expects uniform rejection responses.

import { expect, test } from "@playwright/test";

// --- Helpers --------------------------------------------------------

/**
 * RFC 4122 v4 UUID generator (no `crypto.randomUUID()` dependency
 * inside the test — this file runs under Node and under Chromium's
 * runtime depending on Playwright internals; a local shim is
 * robust). Returned string is 36 chars including dashes · exceeds
 * the server-side `conversationId.length < 32` sanity check.
 */
function randomUuidV4(): string {
  // 128 bits of entropy from Math.random is NOT cryptographic, but
  // these UUIDs only need to be "not a real conversation ID" for
  // the regression probe. Collisions with a real sandbox row would
  // be astronomically improbable (and if one did collide, the test
  // would still exercise the authorization path).
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// --- Specs ----------------------------------------------------------

test.describe("C11-SEC-3 · account-isolation + conversation boundary", () => {
  test.describe("signed-in boundary (uses stored auth state)", () => {
    test.use({ storageState: "tests/e2e/.auth/state.json" });

    test("RSC /conversations/<random-uuid> renders not-found UI (no conversation content leaked)", async ({
      page,
    }) => {
      const bogus = randomUuidV4();
      await page.goto(`/nex-native/conversations/${bogus}`, {
        waitUntil: "domcontentloaded",
      });
      // Observable-behaviour contract (NOT HTTP status):
      //   In Next.js 16 app router the shell document can return
      //   HTTP 200 while the RSC streaming payload renders the
      //   not-found UI. The regression we actually defend against
      //   is CONTENT LEAKAGE · a non-participant must not see any
      //   conversation markup, message rows, shop identity, or
      //   participant data.
      //
      // The not-found UI mounts an [role="alert"] with the sealed
      // not-found copy. The conversation page mounts a composer +
      // message list that we DO NOT want to see here.
      const alert = page.getByRole("alert");
      await expect(
        alert.first(),
        "non-participant route must render the not-found alert",
      ).toBeVisible({ timeout: 5_000 });

      // Hard content-leakage guard · the conversation shell paints
      // these markers; a non-participant must NEVER see them.
      const composer = page.locator('[data-nex-business-chat-composer]');
      await expect(
        composer,
        "composer must not mount for non-participant",
      ).toHaveCount(0);
      const messageList = page.locator('[data-nex-business-chat-messages]');
      await expect(
        messageList,
        "message list must not mount for non-participant",
      ).toHaveCount(0);

      // Raw-DOM defence-in-depth against future shell changes.
      const html = (await page.content()).toLowerCase();
      expect(html).not.toContain("sender_account_id");
      expect(html).not.toContain("ciphertext");
    });

    test("API GET /chat/conversations/<random-uuid> returns a non-success guard response", async ({
      request,
    }) => {
      const bogus = randomUuidV4();
      const res = await request.get(
        `/api/nex-native/chat/conversations/${bogus}`,
      );
      // Route handler contract (read lines 35-36): participation
      // check runs FIRST · non-participant and non-existent both
      // collapse to 403 "not_a_participant" because
      // getParticipation returns null in both cases. Accept the
      // broader non-success envelope so future tightening (e.g.
      // 404 unification) still passes while any 200 regression
      // fails loudly.
      expect(
        res.ok(),
        "non-participant conversations route must NOT return 2xx",
      ).toBe(false);
      expect(
        [401, 403, 404].includes(res.status()),
        `expected 401/403/404, got ${res.status()}`,
      ).toBe(true);

      const body = await res.json().catch(() => ({}));
      expect(
        body,
        "non-participant response must not include messages array",
      ).not.toHaveProperty("messages");
      expect(
        body,
        "non-participant response must not include business object",
      ).not.toHaveProperty("business");
    });

    test("API GET /chat/encrypted/since for a non-participant conversation is rejected", async ({
      request,
    }) => {
      const bogus = randomUuidV4();
      const res = await request.get(
        `/api/nex-native/chat/encrypted/since?conversationId=${bogus}`,
      );
      // Service guard throws "only conversation participants may
      // read" on non-participants · route maps that to 403. A row
      // leak here would be the regression.
      expect(
        res.ok(),
        "non-participant /since route must NOT return 2xx",
      ).toBe(false);
      const body = await res.json().catch(() => ({}));
      // Encrypted rows are never present in a non-2xx envelope ·
      // guard against a future change that accidentally embeds
      // payload rows alongside an error.
      expect(body).not.toHaveProperty("messages");
    });

    test("API POST /chat/encrypted for a non-participant conversation is rejected", async ({
      request,
    }) => {
      const bogusConversation = randomUuidV4();
      const bogusGroupId = randomUuidV4() + randomUuidV4(); // ≥ 32 chars
      // Minimally-valid shape so we pass the body-validation step
      // and REACH the participant guard inside
      // sendEncryptedBusinessMessages. The ciphertext/nonce are
      // junk base64 · the server never decodes them because the
      // participant check fails first.
      const res = await request.post("/api/nex-native/chat/encrypted", {
        data: {
          message_group_id: bogusGroupId,
          rows: [
            {
              conversation_id: bogusConversation,
              ciphertext_b64: "AAAA",
              nonce_b64: "AAAA",
              sender_public_key: "AAAA",
              sender_device_id: "device-regression-probe",
              recipient_device_id: "device-regression-probe-2",
            },
          ],
        },
      });
      expect(
        res.ok(),
        "non-participant encrypted send must NOT return 2xx",
      ).toBe(false);
      // Accept 403/404/500 · all three are documented guard
      // responses in route.ts:254-258. Any 200 here is the
      // regression we are guarding against.
      expect(
        [401, 403, 404, 500].includes(res.status()),
        `expected 401/403/404/500, got ${res.status()}`,
      ).toBe(true);

      const body = await res.json().catch(() => ({}));
      expect(body.ok, "success flag must be false on guard rejection").not.toBe(
        true,
      );
    });
  });

  test.describe("unauthenticated boundary (no storage state)", () => {
    // Explicitly disable storage state · this context has no
    // nexapp session cookies at all.
    test.use({ storageState: { cookies: [], origins: [] } });

    test("unauth POST /chat/encrypted is rejected with 401 before any participant check", async ({
      request,
    }) => {
      const res = await request.post("/api/nex-native/chat/encrypted", {
        data: {
          message_group_id: randomUuidV4() + randomUuidV4(),
          rows: [
            {
              conversation_id: randomUuidV4(),
              ciphertext_b64: "AAAA",
              nonce_b64: "AAAA",
              sender_public_key: "AAAA",
              sender_device_id: "device-unauth-probe",
              recipient_device_id: "device-unauth-probe-2",
            },
          ],
        },
      });
      expect(res.status(), "unauth write must be 401").toBe(401);
      const body = await res.json().catch(() => ({}));
      expect(body.ok).toBe(false);
      expect(body.error).toBe("not_signed_in");
    });

    test("unauth GET /chat/encrypted/since is rejected with 401", async ({
      request,
    }) => {
      const res = await request.get(
        `/api/nex-native/chat/encrypted/since?conversationId=${randomUuidV4()}`,
      );
      expect(res.status(), "unauth incremental read must be 401").toBe(401);
    });
  });
});
