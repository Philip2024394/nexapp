// tests/e2e/journey-chat-send-e2e.spec.ts
//
// T-1.1 · chat send end-to-end · authored under Stage A Conditional
// Approval 2026-11-24.
//
// Observable behaviour under test (within the single-account tier):
//   · /nex-native/chat is a RETIRED HUB: the server page
//     (src/app/nex-native/chat/page.tsx:31-32) performs a pure server-
//     side redirect to /nex-native/contacts. The composer lives on
//     the per-peer route /nex-native/chat/peer/[accountId]
//     (src/app/nex-native/chat/_portrait-bloom-shell.tsx:2163
//     mounts <PeerComposer /> only inside a peer conversation).
//     We therefore assert the OBSERVABLE architecture:
//       · /chat responds (redirect chain completes).
//       · /contacts (the sealed destination) renders a contacts hub.
//       · The composer branch is BLOCKED-PENDING-SANDBOX-PEER-FIXTURE.
//         We do NOT invent an accountId. We do NOT seed data.
//   · Outbox under forced-offline: ORIGINALLY assumed a durable
//     offline outbox. 2026-11-27 inspection corrected this: the
//     composer only has an in-memory useFormStatus().pending flag
//     (_composer.tsx:1174, 1180) · no persisted queue exists · a
//     reload while offline loses the typed message. This is a
//     product gap, not a fixture gap.
//   · Retract: ORIGINALLY stated as a "sealed message context menu"
//     entry. 2026-11-27 inspection corrected this: retract is a
//     long-press gesture (500ms hold on own bubble < 1 hour old)
//     that opens a portaled confirm modal with
//     `role="dialog" aria-label="Delete this message?"`
//     (_message-bubble-client.tsx:9-10, :247-250). The bubble action
//     menu (_bubble-action-menu-client.tsx:400-437) exposes only
//     Reply/Copy/Forward/Edit — no retract entry.
//   · Delete-for-me: ORIGINALLY assumed shipped alongside retract.
//     2026-11-27 inspection corrected this: delete-for-me is listed
//     as a future action (_bubble-action-menu-client.tsx:26-30) and
//     the current retract flow is delete-for-everyone only.
//
// BLOCKED scenarios (updated 2026-11-27):
//   · offline outbox · BLOCKED-ON-UNIMPLEMENTED-FEATURE
//   · retract         · BLOCKED-PENDING-SEED-HELPER (seedPeerSentMessage)
//   · delete-for-me   · BLOCKED-ON-UNIMPLEMENTED-FEATURE
//
// Doctrine respected:
//   · Device-only E2E (sealed 2026-11-09): we do NOT inspect the server-
//     side body column; every assertion is at the DOM level.
//   · Plaintext freeze (NEX_CHAT_PLAINTEXT_FREEZE default ON): the spec
//     does NOT attempt a plaintext send path.
//
// Classification: SPEC AUTHORED.

import * as fs from "node:fs";
import * as path from "node:path";
import { expect, test } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  seedDeviceKeyForFixtureAccount,
  seedPeerSentMessage,
  teardownAll,
  type FixtureHandle,
} from "./_fixtures/sandbox-test-harness";

/** L-058 · read the dev-founder viewer email out of .env.local without
 *  exposing it anywhere observable. Mirrors the pattern in
 *  `auth.setup.ts:91` — intentionally local-only (no new shared helper
 *  module yet). Strips surrounding single / double quotes. */
function readViewerEmailFromEnvLocal(): string {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const raw = fs.readFileSync(envPath, "utf8");
  const m = raw.match(/^NEX_ADMIN_EMAILS=(.*)$/m);
  if (!m) {
    throw new Error(
      "NEX_ADMIN_EMAILS missing from .env.local · required to seed a " +
        "sender-side message for the retract test",
    );
  }
  let v = m[1].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  const first = v.split(",").map((e) => e.trim()).filter((e) => e.length > 0)[0];
  if (!first) {
    throw new Error("NEX_ADMIN_EMAILS resolved to zero entries");
  }
  return first;
}

test.use({ storageState: "tests/e2e/.auth/state.json" });

test.describe.serial("T-1.1 · chat send end-to-end", () => {
  test("sanity · /chat redirects to /contacts (retired hub)", async ({ page }) => {
    // Remediation 2026-11-24 · the /chat hub is a server-side redirect
    // to /contacts (chat/page.tsx:31-32). We assert the OBSERVABLE
    // redirect chain completes with a <500 status at the final URL.
    const response = await page.goto("/nex-native/chat", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status(), "/chat redirect chain completes").toBeLessThan(500);
    await expect(
      page,
      "/chat lands on /contacts (or signed-out /sign-in bounce)",
    ).toHaveURL(/\/nex-native\/(contacts|sign-in)(?:[/?#]|$)/);
  });

  test("composer renders on a peer conversation route", async ({ page }) => {
    // 2026-11-26 remediation · the historical skip cited "we will not
    // invent an accountId or seed data"; the `_fixtures/sandbox-test-
    // harness` has since matured to the point where a fixture peer can
    // be created via service-role (same pattern already proven in
    // `journey-ask-seller-nonowner-full.spec.ts` lines 79-104). The
    // peer page's own code (src/app/nex-native/chat/peer/[accountId]/
    // page.tsx:320-324) calls `getOrCreatePeerConversation` on load, so
    // simply navigating to a valid peer uuid is sufficient to assert
    // the composer branch. No weakening of encryption invariants: we
    // only observe DOM — no reads of nex_message.body or key material.
    test.setTimeout(60_000);
    assertSandboxRef();

    const handles: FixtureHandle[] = [];
    try {
      const peer = await createTestAccount("chatsend-peer");
      handles.push(peer);
      // Seed the peer's public device key so the sending-side encryption
      // path does not fail-closed on `no_peer_devices`. Private half is
      // discarded · it never leaves this process.
      await seedDeviceKeyForFixtureAccount(peer);

      const resp = await page.goto(
        `/nex-native/chat/peer/${peer.nexAccountId}`,
        { waitUntil: "domcontentloaded" },
      );
      expect(resp?.status(), "peer chat route responds <500").toBeLessThan(500);

      // Peer chat may bounce to /sign-in if storageState rotated.
      if (/\/sign-in/.test(page.url())) {
        test.skip(
          true,
          `BLOCKED-AUTH · redirected to /sign-in (url=${page.url()}) · ` +
            "storageState rotated · owner must refresh auth state",
        );
      }

      // Observable anchor from _composer.tsx:558 ·
      // <form data-nex-peer-composer>...<textarea /></form>.
      const composer = page.locator("[data-nex-peer-composer]");
      await expect(composer, "peer composer form mounts").toBeVisible({
        timeout: 15_000,
      });
      // _composer.tsx:968 + :982 tag the textarea with
      // `data-nex-composer-textarea`. This is the stable anchor; the
      // physical textarea is rendered inside one of two ambient pill
      // wrappers (free-chat shape vs embedded shape).
      const textarea = page.locator("[data-nex-composer-textarea]").first();
      await expect(textarea, "peer composer textarea mounts").toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await teardownAll(handles);
      await assertNoResidualFixtures(handles);
    }
  });

  test("offline outbox · send under forced-offline reflects pending state", async ({
    page,
    context,
  }) => {
    // 2026-11-27 investigation · the composer uses `useFormStatus().pending`
    // (src/app/nex-native/chat/peer/[accountId]/_composer.tsx:1174, 1180)
    // to toggle the submit-button `aria-label` between "Send message" and
    // "Sending message" while the server action is in-flight. There is
    // NO durable outbox layer: no IndexedDB queue, no localStorage retry
    // list, no `data-nex-outbox` / `data-nex-pending-send` DOM anchor.
    // If the user closes or reloads the tab while offline, the typed
    // message is lost. This is a PRODUCT GAP, not a fixture gap — the
    // prior skip reason "requires a second test account" was wrong.
    test.skip(
      true,
      "BLOCKED-ON-UNIMPLEMENTED-FEATURE · composer has no durable " +
        "offline outbox · pending state is pure in-memory useFormStatus " +
        "(see _composer.tsx:1174, 1180) · no persisted queue exists · " +
        "spec cannot assert durable-outbox behaviour that is not built",
    );
    void page;
    void context;
  });

  test("retract · long-press on own bubble opens confirm-delete modal", async ({
    page,
  }) => {
    // 2026-11-27 L-058 follow-up · the retract flow is NOT a message-
    // menu entry. The bubble action menu (_bubble-action-menu-client
    // .tsx:400-437) renders only Reply / Copy / Forward / Edit. Retract
    // is a separate gesture flow in _message-bubble-client.tsx:9-10:
    //   · onPointerDown starts a 500ms timer (LONG_PRESS_MS at :35)
    //   · onPointerMove cancels if the pointer drifts > 10px
    //     (MOVE_CANCEL_PX at :36)
    //   · when the timer fires without movement, `setDeleteOpen(true)`
    //     mounts a portaled confirm modal with
    //       role="dialog"  aria-label="Delete this message?"
    //     (:247-250). Confirming posts to deletePeerMessageAction via
    //     a hidden `message_id` input (:312-313).
    //
    // We seed one sent message with `sender_account_id = viewer` so
    // `mine=true` (computed at peer/[accountId]/page.tsx:936). We then
    // locate the bubble by `[data-nex-msg-id]`, press-and-hold for
    // > 500ms, and assert the modal appears. We CANCEL the modal — we
    // never actually retract, so the fixture message gets cleaned up
    // via CASCADE in teardown rather than through the real action path.
    test.setTimeout(60_000);
    assertSandboxRef();

    const handles: FixtureHandle[] = [];
    try {
      const viewerEmail = readViewerEmailFromEnvLocal();
      const seeded = await seedPeerSentMessage({
        viewerEmail,
        peerLabel: "retract",
        body: "retract fixture · spec will cancel the modal",
        handles,
      });

      const resp = await page.goto(
        `/nex-native/chat/peer/${seeded.peer.nexAccountId}`,
        { waitUntil: "domcontentloaded" },
      );
      expect(resp?.status(), "peer chat route responds <500").toBeLessThan(500);

      // storageState may have rotated · same safety gate the composer-
      // renders test uses at :97-103.
      if (/\/sign-in/.test(page.url())) {
        test.skip(
          true,
          `BLOCKED-AUTH · redirected to /sign-in (url=${page.url()}) · ` +
            "storageState rotated · owner must refresh auth state",
        );
      }

      // Find the seeded bubble by its stable `data-nex-msg-id` anchor
      // (set at _portrait-bloom-shell.tsx:1367).
      const bubble = page.locator(
        `[data-nex-msg-id="${seeded.messageId}"]`,
      );
      await expect(bubble, "seeded message bubble mounts").toBeVisible({
        timeout: 15_000,
      });
      // Sanity gate: the shell must mark this as `mine=true` or the
      // long-press delete path is disabled (canDelete at
      // _message-bubble-client.tsx:78-83).
      await expect(
        bubble,
        "seeded bubble is viewer-authored (mine=true)",
      ).toHaveAttribute("data-nex-bloom-msg-mine", "true");

      // Press-and-hold with the mouse for > LONG_PRESS_MS (500 ms) and
      // < MOVE_CANCEL_PX (10 px) movement. Playwright's `mouse.down()`
      // dispatches `pointerdown` so the React onPointerDown handler
      // (_message-bubble-client.tsx:92-105) fires.
      const box = await bubble.boundingBox();
      if (!box) throw new Error("bubble boundingBox unresolved");
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      // Hold for 650 ms to clear LONG_PRESS_MS (500 ms) with margin.
      // We do NOT move during this window · the timer must fire.
      // eslint-disable-next-line playwright/no-wait-for-timeout
      await page.waitForTimeout(650);

      // Confirm modal mounts via portal into document.body. Anchor is
      // the aria-label at _message-bubble-client.tsx:249-250.
      const confirmModal = page.locator(
        'div[role="dialog"][aria-label="Delete this message?"]',
      );
      await expect(
        confirmModal,
        "confirm-delete modal mounts after long-press hold",
      ).toBeVisible({ timeout: 5_000 });

      await page.mouse.up();

      // Close the modal via the sealed Escape keybinding (DeleteConfirm
      // Modal at _message-bubble-client.tsx:219-224 listens for
      // keydown Escape and calls onClose). We intentionally do NOT
      // click the delete submit button · this spec asserts the
      // AFFORDANCE renders, not the destructive side effect. Server-
      // side retract state (row update + "message was deleted"
      // placeholder) is a separate assertion worth its own spec when
      // the sender-side retract reader lands.
      await page.keyboard.press("Escape");
      await expect(
        confirmModal,
        "modal dismisses after Escape",
      ).toBeHidden({ timeout: 3_000 });
    } finally {
      await teardownAll(handles);
      await assertNoResidualFixtures(handles);
    }
  });

  test("delete-for-me · placeholder for future distinct action", async () => {
    // 2026-11-27 investigation · delete-for-me is NOT a shipped feature.
    // _bubble-action-menu-client.tsx:26-30 lists it as "Future (option
    // A expansion when authorised): Forward · Delete-for-me · Delete-
    // for-everyone". The confirm modal text at _message-bubble-client
    // .tsx:290 ("It disappears for both of you") describes retract /
    // delete-for-everyone, not delete-for-me. The two actions are not
    // distinguished anywhere in the current UI.
    test.skip(
      true,
      "BLOCKED-ON-UNIMPLEMENTED-FEATURE · delete-for-me is not shipped " +
        "(see _bubble-action-menu-client.tsx:26-30 future list) · " +
        "current retract flow is delete-for-everyone only · no distinct " +
        "label exists to assert",
    );
  });
});
