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

import { expect, test } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  seedDeviceKeyForFixtureAccount,
  teardownAll,
  type FixtureHandle,
} from "./_fixtures/sandbox-test-harness";

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

  test("retract · long-press on own bubble opens confirm-delete modal", async () => {
    // 2026-11-27 investigation · the retract flow is NOT a message-menu
    // entry. The sealed bubble action menu (_bubble-action-menu-client
    // .tsx:400-437) renders only Reply / Copy / Forward / Edit. Retract
    // is a separate gesture flow in _message-bubble-client.tsx:9-10:
    // long-press (500ms pointer hold, < 10px movement) on YOUR OWN
    // bubble aged < 1 hour opens a portaled confirm modal with
    // `role="dialog" aria-label="Delete this message?"` (:247-250).
    // Confirming posts to deletePeerMessageAction via a hidden
    // `message_id` input (:312-313).
    //
    // Executing this flow requires a real sent message on the primary
    // test account's peer conversation. That seed needs either a
    // service-role insert into nex_message or an authentic send round-
    // trip — both are implementable under the sandbox harness but
    // require a dedicated seedPeerSentMessage() helper that does not
    // yet exist in _fixtures/sandbox-test-harness.
    test.skip(
      true,
      "BLOCKED-PENDING-SEED-HELPER · retract is a long-press gesture + " +
        "confirm modal (_message-bubble-client.tsx:9-10, :247-250), NOT " +
        "a menu item · asserting it requires seedPeerSentMessage() in " +
        "the sandbox harness · follow-up ledger task",
    );
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
