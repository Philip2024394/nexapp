// tests/e2e/journey-chat-retract-peer-reader.spec.ts
//
// L-062 · peer-side retract READER spec · authored 2026-11-27 as the
// complement to L-061 which covers the SENDER-side retract reader
// (server state + sender DOM showing "You deleted this message").
// This spec asserts the OTHER half of the retract contract: once a
// row carries `deleted_for_everyone = true`, the PEER account — the
// one who received the message — sees the peer-side placeholder
// "This message was deleted" in the exact same bubble slot (anchored
// by `data-nex-msg-id`), WITHOUT ever being exposed to the plaintext
// body or the sender-side copy.
//
// Design decisions:
//   · We flip `deleted_for_everyone = true` via service-role UPDATE
//     rather than re-running the long-press gesture. L-061 already
//     locks the gesture → server state path end-to-end; this spec's
//     job is to exercise the READ path from a fresh peer session.
//     That isolation keeps the spec fast and makes failures legible
//     (a red here means the peer-side render branch is broken, not
//     the gesture handler).
//   · Fresh `browser.newContext()` without `storageState` so the
//     Dev-Pass viewer's cookies do not leak into the peer session.
//     The peer signs in via the sealed `data-nex-sign-in-form` path
//     using `signInAsFixtureInBrowser` — same code path a real user
//     takes, no auth bypass.
//   · Peer navigates to `/nex-native/chat/peer/<viewer's accountId>`.
//     On the peer's side, their peer IS the viewer — the route
//     parameter is always "the OTHER account's id" (confirmed by the
//     mirror pattern in L-061 which sends the viewer to
//     `.../peer/<peer.nexAccountId>`).
//   · We assert `data-nex-bloom-msg-mine` is NOT "true" — the peer-
//     side placeholder branch gates on `m.mine === false` at
//     `_portrait-bloom-shell.tsx:1615-1617`. If a future refactor
//     incorrectly flips the ternary we want to catch that here,
//     not in a user report.
//
// Sealed-invariant preservation:
//   · Device-only E2E (2026-11-09): the spec reads NO plaintext body
//     out of `nex_peer_message` · it only writes `deleted_for_everyone`
//     + `deleted_at` via service-role, same column set as L-061.
//   · Rule 7 / standing 2026-11-27 source-control policy: this is a
//     read-only test authoring change · no migration · no production
//     · no credential activated.
//   · `assertSandboxRef()` fails loudly if a non-sandbox project ref
//     slips in.
//   · The seeded peer carries a published device key (default of
//     `seedPeerSentMessage`) so the shell's encryption path does not
//     fail-closed when the peer renders. `encrypted=false` on the
//     seed row mirrors L-061.
//   · Teardown: the peer handle CASCADEs the conversation + message
//     on delete. The viewer is NEVER added to `handles[]`.
//
// Classification: SPEC AUTHORED → run under this cycle promotes to
// VERIFIED on green.

import * as fs from "node:fs";
import * as path from "node:path";
import { expect, test } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  seedPeerSentMessage,
  signInAsFixtureInBrowser,
  supabaseAdmin,
  teardownAll,
  type FixtureHandle,
} from "./_fixtures/sandbox-test-harness";

/** Mirrors the local `readViewerEmailFromEnvLocal` helper in
 *  `journey-chat-send-e2e.spec.ts` and `journey-chat-retract-reader
 *  .spec.ts` — kept local to each spec rather than promoted to a
 *  shared helper until a fourth caller exists. The email value is
 *  never printed. */
function readViewerEmailFromEnvLocal(): string {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const raw = fs.readFileSync(envPath, "utf8");
  const m = raw.match(/^NEX_ADMIN_EMAILS=(.*)$/m);
  if (!m) {
    throw new Error(
      "NEX_ADMIN_EMAILS missing from .env.local · required to resolve " +
        "the viewer whose nex_account id becomes the retracted message's " +
        "sender",
    );
  }
  let v = m[1].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  const first = v
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0)[0];
  if (!first) {
    throw new Error("NEX_ADMIN_EMAILS resolved to zero entries");
  }
  return first;
}

// NOTE: this spec deliberately does NOT use the default
// `storageState: "tests/e2e/.auth/state.json"` — we need an empty
// context so we can sign in as the peer fixture. Playwright tests
// inherit the config-level `use.storageState`, so we override it
// locally with `storageState: undefined`.
test.use({ storageState: undefined });

test.describe.serial("L-062 · peer-side retract reader · 'This message was deleted'", () => {
  test("retracted row · peer sees peer-side placeholder (not sender copy, not plaintext)", async ({
    browser,
  }) => {
    // Headroom: seed + service-role flip + fresh sign-in + nav +
    // bubble mount + attribute poll. 90s matches L-061's envelope.
    test.setTimeout(90_000);
    assertSandboxRef();

    const handles: FixtureHandle[] = [];
    let peerContext: Awaited<ReturnType<typeof browser.newContext>> | null =
      null;
    try {
      const viewerEmail = readViewerEmailFromEnvLocal();
      const seeded = await seedPeerSentMessage({
        viewerEmail,
        peerLabel: "retract-peer-reader",
        body: "retract-peer-reader fixture · will be retracted before peer reads",
        handles,
        returnPeerPassword: true,
      });

      // --- Flip the message to deleted_for_everyone via service role. ---
      // Rationale: L-061 already proves "long-press → submit → row
      // updated → sender DOM shows 'You deleted this message'".
      // L-062's scope is strictly the PEER-SIDE READ branch, so we
      // bypass the gesture and land the row directly in the state
      // the peer is meant to observe.
      const sb = supabaseAdmin();
      const nowIso = new Date().toISOString();
      const up = await sb
        .from("nex_peer_message")
        .update({ deleted_for_everyone: true, deleted_at: nowIso })
        .eq("id", seeded.messageId)
        .select("id, deleted_for_everyone, deleted_at")
        .maybeSingle();
      expect(up.error, "service-role UPDATE has no error").toBeNull();
      expect(
        up.data?.deleted_for_everyone,
        "seed step: row flipped to deleted_for_everyone=true",
      ).toBe(true);
      expect(
        up.data?.deleted_at,
        "seed step: deleted_at populated",
      ).not.toBeNull();

      // --- Open a fresh browser context as the peer. -----------------
      // No storageState = empty cookie jar. The sign-in below writes
      // the peer's session cookies into THIS context only · the
      // test-wide Dev-Pass viewer state is untouched.
      peerContext = await browser.newContext();
      const peerPage = await peerContext.newPage();
      await signInAsFixtureInBrowser(peerPage, seeded.peer);

      // --- Navigate as the peer to their view of the conversation. ---
      // The peer's "peer" is the viewer, so the route parameter is
      // the viewer's nex_account id.
      const resp = await peerPage.goto(
        `/nex-native/chat/peer/${seeded.viewerNexAccountId}`,
        { waitUntil: "domcontentloaded" },
      );
      expect(
        resp?.status(),
        "peer-side chat route responds <500",
      ).toBeLessThan(500);

      // If sign-in silently rotated us back out, skip rather than
      // mis-classify as a product defect (mirror of L-061's gate).
      if (/\/sign-in/.test(peerPage.url())) {
        test.skip(
          true,
          `BLOCKED-AUTH · peer bounced back to /sign-in (url=${peerPage.url()}) ` +
            "· peer sign-in failed inside fresh context",
        );
      }

      // --- Locate the retracted bubble and assert peer-side shape. ---
      const bubble = peerPage.locator(
        `[data-nex-msg-id="${seeded.messageId}"]`,
      );
      await expect(
        bubble,
        "retracted message bubble mounts in peer's view",
      ).toBeVisible({ timeout: 15_000 });

      await expect(
        bubble,
        "bubble carries deleted tombstone marker",
      ).toHaveAttribute("data-nex-bloom-msg-deleted", "true", {
        timeout: 10_000,
      });

      // Peer-side branch requires `mine !== true`. The shell sets
      // `data-nex-bloom-msg-mine` to "true" for the author's view
      // and "false" (or absent) for the peer's view. Either shape
      // is valid; "true" is the regression we want to catch.
      const mineAttr = await bubble.getAttribute("data-nex-bloom-msg-mine");
      expect(
        mineAttr,
        "peer-side bubble must NOT carry data-nex-bloom-msg-mine=\"true\"",
      ).not.toBe("true");

      // The copy branch at `_portrait-bloom-shell.tsx:1615-1617`:
      //   m.mine ? "You deleted this message" : "This message was deleted"
      // Assert the PEER wording and the ABSENCE of the sender wording
      // in the same bubble · a flipped ternary would surface both.
      await expect(
        bubble,
        "retracted bubble renders peer-side placeholder",
      ).toContainText("This message was deleted", { timeout: 10_000 });
      await expect(
        bubble,
        "peer must NOT see the sender-side wording",
      ).not.toContainText("You deleted this message");

      // Device-only E2E preservation: the plaintext body must NOT
      // leak into the DOM once retracted. Assert the seeded body
      // string is absent. (The seed body is deliberately unusual
      // so this check is meaningful.)
      await expect(
        bubble,
        "peer must NOT see the plaintext body after retract",
      ).not.toContainText("retract-peer-reader fixture");
    } finally {
      if (peerContext) {
        await peerContext.close().catch(() => undefined);
      }
      await teardownAll(handles);
      await assertNoResidualFixtures(handles);
    }
  });
});
