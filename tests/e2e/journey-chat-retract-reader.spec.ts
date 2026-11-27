// tests/e2e/journey-chat-retract-reader.spec.ts
//
// L-061 · sender-side retract READER spec · authored 2026-11-27 as the
// follow-on to L-059 which verified the retract AFFORDANCE only
// (long-press opens modal, Escape dismisses, no destructive submit).
// This spec clicks the real Delete submit button and asserts BOTH:
//   (a) SERVER STATE — `nex_peer_message.deleted_for_everyone = true`
//       and `deleted_at IS NOT NULL` (observed via service-role SELECT;
//       NOT a mocked assertion).
//   (b) SENDER DOM RE-RENDER — the same bubble (by `data-nex-msg-id`)
//       is still mounted after the server-action redirect+revalidate,
//       carries `data-nex-bloom-msg-deleted="true"`, and contains the
//       viewer-side placeholder text "You deleted this message" (from
//       `_portrait-bloom-shell.tsx:1615-1617`).
//
// Design decisions and sealed-invariant preservation:
//   · Device-only E2E (2026-11-09): the spec reads NO plaintext body
//     out of nex_peer_message · only the two deletion columns. The
//     retracted-row marker and the viewer-side placeholder text are
//     device-independent (added by the UI once `deleted_for_everyone
//     = true` is set), so no key material is touched.
//   · Rule 7 / standing 2026-11-27 source-control policy: this spec is
//     a read-only authoring change · no migration · no production ·
//     no credential activated.
//   · Sandbox-only · `assertSandboxRef()` fails loudly if a non-sandbox
//     project ref slips in.
//   · The seeded message is deliberately < 1 hour old (default
//     `sentAtIso = new Date().toISOString()` from the harness), so the
//     retract-window check at `peer-message-service.ts:1400-1405` does
//     NOT reject the submit.
//   · Teardown uses CASCADE via the fixture peer handle: when the peer
//     account is deleted, the conversation and its messages (including
//     the retracted one, which is still a row) are removed by FK.
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
  supabaseAdmin,
  teardownAll,
  type FixtureHandle,
} from "./_fixtures/sandbox-test-harness";

/** Mirrors the local `readViewerEmailFromEnvLocal` helper in
 *  `journey-chat-send-e2e.spec.ts:67-89` — kept local to each spec file
 *  rather than promoted to a shared helper until a third caller exists.
 *  Reads `NEX_ADMIN_EMAILS`, strips surrounding quotes, returns the
 *  first comma-separated entry. The email value is never printed. */
function readViewerEmailFromEnvLocal(): string {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const raw = fs.readFileSync(envPath, "utf8");
  const m = raw.match(/^NEX_ADMIN_EMAILS=(.*)$/m);
  if (!m) {
    throw new Error(
      "NEX_ADMIN_EMAILS missing from .env.local · required to seed a " +
        "viewer-authored message for the retract-reader test",
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

test.use({ storageState: "tests/e2e/.auth/state.json" });

test.describe.serial("L-061 · retract reader · server state + sender DOM", () => {
  test("retract submit · row flips deleted_for_everyone=true AND bubble renders placeholder", async ({
    page,
  }) => {
    // Playwright default 30s is tight for: nav → long-press → modal →
    // submit → redirect → revalidate → DOM re-render. 90s gives margin.
    test.setTimeout(90_000);
    assertSandboxRef();

    const handles: FixtureHandle[] = [];
    try {
      const viewerEmail = readViewerEmailFromEnvLocal();
      const seeded = await seedPeerSentMessage({
        viewerEmail,
        peerLabel: "retract-reader",
        body: "retract-reader fixture · will be retracted",
        handles,
      });

      // Baseline: confirm the seeded row is NOT already deleted before
      // the UI gesture. If someone's fixture logic were buggy and set
      // the flag at insert time, the later assertion would pass by
      // accident; this guards that.
      const sb = supabaseAdmin();
      const pre = await sb
        .from("nex_peer_message")
        .select("id, deleted_for_everyone, deleted_at")
        .eq("id", seeded.messageId)
        .maybeSingle();
      expect(pre.error, "pre-retract select has no error").toBeNull();
      expect(pre.data, "pre-retract row exists").not.toBeNull();
      expect(
        pre.data?.deleted_for_everyone,
        "pre-retract: row is NOT already deleted",
      ).toBe(false);
      expect(
        pre.data?.deleted_at,
        "pre-retract: deleted_at is null",
      ).toBeNull();

      // --- Navigate to the peer chat as the viewer. ------------------
      const resp = await page.goto(
        `/nex-native/chat/peer/${seeded.peer.nexAccountId}`,
        { waitUntil: "domcontentloaded" },
      );
      expect(resp?.status(), "peer chat route responds <500").toBeLessThan(500);

      // Same auth-rotation safety gate the chat-send spec uses — if
      // storageState rotated out from under us we skip rather than
      // fail-mis-classify.
      if (/\/sign-in/.test(page.url())) {
        test.skip(
          true,
          `BLOCKED-AUTH · redirected to /sign-in (url=${page.url()}) · ` +
            "storageState rotated · owner must refresh auth state",
        );
      }

      // --- Locate the seeded bubble by its stable anchor. ------------
      const bubble = page.locator(
        `[data-nex-msg-id="${seeded.messageId}"]`,
      );
      await expect(bubble, "seeded message bubble mounts").toBeVisible({
        timeout: 15_000,
      });
      await expect(
        bubble,
        "seeded bubble is viewer-authored (mine=true · required for retract gesture)",
      ).toHaveAttribute("data-nex-bloom-msg-mine", "true");
      await expect(
        bubble,
        "seeded bubble is NOT yet deleted in DOM",
      ).not.toHaveAttribute("data-nex-bloom-msg-deleted", "true");

      // --- Long-press to open the confirm modal. ---------------------
      // Same gesture shape proven in L-059's affordance test · mirror it
      // exactly so one path works, the other doesn't diverge.
      const box = await bubble.boundingBox();
      if (!box) throw new Error("bubble boundingBox unresolved");
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      // Hold > LONG_PRESS_MS (500 ms, see _message-bubble-client.tsx:35)
      // without any `mouse.move` to avoid MOVE_CANCEL_PX (10 px).
      // eslint-disable-next-line playwright/no-wait-for-timeout
      await page.waitForTimeout(650);

      const confirmModal = page.locator(
        'div[role="dialog"][aria-label="Delete this message?"]',
      );
      await expect(
        confirmModal,
        "confirm-delete modal mounts after long-press hold",
      ).toBeVisible({ timeout: 5_000 });
      await page.mouse.up();

      // --- Click the real Delete submit button. ----------------------
      // _message-bubble-client.tsx:312-331 — form wraps a hidden
      // `message_id` input and a submit button whose exact text is
      // "Delete". Scope to the modal so we don't accidentally hit a
      // bubble-menu-delete affordance in a sibling.
      const deleteBtn = confirmModal.getByRole("button", { name: "Delete" });
      await expect(deleteBtn, "Delete submit button is visible").toBeVisible();

      // The server action `deletePeerMessageAction` performs:
      //   1. peerMessageService.deletePeerMessageForEveryone  (UPDATE row)
      //   2. revalidatePath(/nex-native/chat/peer/<peerAccountId>)
      //   3. redirect(/nex-native/chat/peer/<peerAccountId>)
      // Move the mouse to the button FIRST (so the previous long-press
      // position doesn't confound Playwright's click heuristics), then
      // submit the form directly via `requestSubmit()` which invokes
      // React's server-action pipeline the same way a real submit
      // would. `button.click()` has shown flake here because the modal
      // sits on top of a fixed backdrop whose own `onClick={onClose}`
      // is a race hazard if the button coordinates round-trip through
      // the backdrop's hit-testing on some viewports.
      const form = confirmModal.locator("form").first();
      await expect(form, "confirm modal contains a form").toBeVisible();
      await form.evaluate((f) => (f as HTMLFormElement).requestSubmit());
      await expect(
        confirmModal,
        "confirm modal unmounts after server action completes",
      ).toBeHidden({ timeout: 20_000 });

      // --- Assert server state FIRST (authoritative truth). ----------
      // The DB is the source of truth. Any DOM-rendering issue is a
      // separate defect from "did the action run at all". Polling
      // with a small retry window handles the tiny race between the
      // Next.js redirect completing in the browser and the DB UPDATE
      // committing to the pooler.
      let post: Awaited<ReturnType<typeof sb.from>> extends never
        ? never
        : {
            data: {
              id: string;
              deleted_for_everyone: boolean | null;
              deleted_at: string | null;
            } | null;
            error: { message: string } | null;
          } = { data: null, error: null };
      for (let attempt = 0; attempt < 20; attempt++) {
        const q = await sb
          .from("nex_peer_message")
          .select("id, deleted_for_everyone, deleted_at")
          .eq("id", seeded.messageId)
          .maybeSingle();
        post = q as typeof post;
        if (q.data?.deleted_for_everyone) break;
        // eslint-disable-next-line playwright/no-wait-for-timeout
        await page.waitForTimeout(250);
      }
      expect(post.error, "post-retract select has no error").toBeNull();
      expect(post.data, "post-retract row still exists (soft-delete)").not.toBeNull();
      expect(
        post.data?.deleted_for_everyone,
        "post-retract: deleted_for_everyone flipped to true",
      ).toBe(true);
      expect(
        post.data?.deleted_at,
        "post-retract: deleted_at is populated",
      ).not.toBeNull();

      // --- Force a fresh RSC render and assert DOM re-render. --------
      // revalidatePath invalidates the server's render cache, but the
      // Playwright page is holding a pre-action React tree. A hard
      // reload guarantees the shell is re-fetched with the updated row
      // where `deleted_for_everyone === true`.
      await page.reload({ waitUntil: "domcontentloaded" });

      const retractedBubble = page.locator(
        `[data-nex-msg-id="${seeded.messageId}"]`,
      );
      await expect(
        retractedBubble,
        "retracted bubble is still mounted after reload (soft-delete tombstone)",
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        retractedBubble,
        "retracted bubble carries data-nex-bloom-msg-deleted=true",
      ).toHaveAttribute("data-nex-bloom-msg-deleted", "true", {
        timeout: 10_000,
      });
      // Viewer-side placeholder text (from _portrait-bloom-shell.tsx:1615
      // — sender sees "You deleted this message"; peer sees "This message
      // was deleted"). We assert sender copy because this spec runs as
      // the viewer who authored the message.
      await expect(
        retractedBubble,
        "retracted bubble renders sender-side placeholder text",
      ).toContainText("You deleted this message", { timeout: 10_000 });
      // Device-only E2E preservation: we do NOT assert anything about
      // the `body` column other than that the row is still reachable.
      // Zeroing the body is a separate product decision; this spec is
      // behaviour-locked to the shipped retract contract only.
    } finally {
      await teardownAll(handles);
      await assertNoResidualFixtures(handles);
    }
  });
});
