// src/app/nex-native/create-account/building/_setup.ts
//
// NEX · S2 · "Building Your NEX" setup logic.
// Owner-authorised 2026-10-18 · build-step honesty rules + Q1b + Q2b.
// -----------------------------------------------------------------------------
// Plain server-only module (not "use server") so a server component can
// import and call `runBuildingSetup` directly, and vitest can exercise
// the same function with mocked dependencies.
//
// What runBuildingSetup does, step by step:
//
//   Step 1 · THEME
//     Verifies the signed-in `nex_account.chat_theme` has been
//     persisted by an earlier `updateChatThemeAction` call. Does NOT
//     write anything. If missing/unknown, returns `pending` so the UI
//     can route the user back to Step 1.
//
//   Step 2 · FACE COVER (Shop intent only)
//     If `nex_welcome_intent === "shop"`, verifies the httpOnly
//     `nex_pending_cover_layout` cookie (S0) is present and holds a
//     whitelisted id. Does NOT create a `nex_business` row (Q2b
//     seal). Does NOT write `nex_business.cover_layout_id`. Returns
//     `complete` if the pending pick is honestly stored, otherwise
//     `pending` so the UI can route back to pick-cover.
//     For non-shop intents, returns `skipped`.
//
//   Step 3 · WELCOME MESSAGE
//     Ensures the NEX-official welcome conversation + at least one
//     message exist for this user. Idempotent:
//       · If a conversation with ≥1 message is found → `complete`
//         (no write)
//       · If a conversation exists but has 0 messages → inserts the
//         sealed Bridge-62 welcome body using the sealed send-intent
//         pattern (send_intent_id = user's account_id). Postgres
//         UNIQUE (sender, send_intent_id) rejects duplicates on
//         retry → treated as `complete`
//       · If no conversation → get-or-create then insert with same
//         idempotency key
//       · Any other error → `error` with a safe label (no PII) so
//         the UI can offer retry/recovery
//
// What runBuildingSetup DOES NOT do:
//   · Create a `nex_business` row (sealed Q2b)
//   · Write `nex_business.cover_layout_id` (sealed · deferred until
//     actual Bisnis activation)
//   · Start the 7-day themes trial (sealed D4 · explicit action
//     later)
//   · Provision Vault (sealed · excluded from onboarding)
//   · Email verification side-effects
//
// Honesty invariant:
//   Every step's reported state must reflect ACTUAL DB truth. Never
//   mark `complete` based on client-supplied data. Never fabricate
//   progress to make the UI feel responsive.

import "server-only";
import { cookies } from "next/headers";
import * as accountService from "@/lib/nex-native/account-service";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as peerMessageService from "@/lib/nex-native/peer-message-service";
import { NEX_OFFICIAL_ACCOUNT_ID } from "@/lib/nex-native/nex-official";
import { renderNex1WelcomeBody } from "@/lib/nex-native/nex-official-welcome";
import { readPendingCoverLayoutId } from "@/lib/nex-native/pending-cover-cookie";
import {
  WELCOME_INTENT_COOKIE,
  isWelcomeIntent,
} from "../../welcome/_welcome-intent";
import {
  COVER_LAYOUT_LABELS,
  type CoverLayoutId,
} from "../../cover/layout-ids";

export type BuildingStepId = "theme" | "face_cover" | "welcome";

export type BuildingStepState =
  | "complete"
  | "pending"
  | "skipped"
  | "error";

export interface BuildingStepStatus {
  readonly id: BuildingStepId;
  readonly label: string;
  readonly state: BuildingStepState;
  /** When state === "pending" OR "error" · honest short reason so the
   *  UI can route the user back to the right previous step OR show a
   *  retry button. Never contains PII. */
  readonly detail?: string;
  /** When state === "complete" AND the step persisted a user choice ·
   *  the chosen value (e.g. the picked layout id). Pure informational,
   *  never used as auth. */
  readonly value?: string;
}

export interface RunBuildingSetupInput {
  readonly accountId: string;
  readonly displayName: string;
}

export interface RunBuildingSetupResult {
  readonly steps: readonly BuildingStepStatus[];
  readonly allComplete: boolean;
}

/** Keep the sealed enum tight · the account's `chat_theme` column
 *  is nullable, and legacy accounts may hold "" or "none" as a
 *  "no theme chosen" sentinel. Anything else is treated as a
 *  real pick. */
function isThemeChosen(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    value.toLowerCase() !== "none"
  );
}

export async function runBuildingSetup(
  input: RunBuildingSetupInput,
): Promise<RunBuildingSetupResult> {
  const steps: BuildingStepStatus[] = [];

  // ─── Step 1 · theme ─────────────────────────────────────────────
  try {
    const account = await accountService.getAccountById(input.accountId);
    const theme = account?.chat_theme;
    if (isThemeChosen(theme)) {
      steps.push({
        id: "theme",
        label: "Chat theme saved",
        state: "complete",
        value: theme,
      });
    } else {
      steps.push({
        id: "theme",
        label: "Chat theme not chosen yet",
        state: "pending",
        detail:
          "Pick a theme from Step 1 before entering chat.",
      });
    }
  } catch {
    steps.push({
      id: "theme",
      label: "Could not verify chat theme",
      state: "error",
      detail: "Lookup failed · retry.",
    });
  }

  // ─── Step 2 · face cover · shop intent only ─────────────────────
  const jar = await cookies();
  const intentRaw = jar.get(WELCOME_INTENT_COOKIE)?.value ?? null;
  const intent = isWelcomeIntent(intentRaw) ? intentRaw : null;

  if (intent === "shop") {
    const coverId = await readPendingCoverLayoutId();
    if (coverId) {
      // The pending pick is NOT applied to any business here · the
      // seal is explicit: Shop intent must not auto-create a
      // business. The pick becomes a real `nex_business.cover_layout_id`
      // only after the user activates a Bisnis setup via the sealed
      // business-service primitive · covered by a later slice.
      steps.push({
        id: "face_cover",
        label: `Face Cover remembered · ${COVER_LAYOUT_LABELS[coverId as CoverLayoutId]}`,
        state: "complete",
        value: coverId,
      });
    } else {
      steps.push({
        id: "face_cover",
        label: "Face Cover not picked yet",
        state: "pending",
        detail:
          "Pick a Face Cover from Step 2 before entering chat.",
      });
    }
  } else {
    steps.push({
      id: "face_cover",
      label: "Face Cover not needed for this signup",
      state: "skipped",
      detail:
        intent === null
          ? "No shop intent recorded · consumer onboarding."
          : `Intent "${intent}" does not require a Face Cover.`,
    });
  }

  // ─── Step 3 · welcome conversation ──────────────────────────────
  try {
    if (input.accountId === NEX_OFFICIAL_ACCOUNT_ID) {
      // Guard · NEX1 account should never be onboarding itself. Mark
      // skipped so no self-conversation gets attempted.
      steps.push({
        id: "welcome",
        label: "Welcome message not applicable",
        state: "skipped",
      });
    } else {
      const existingConv =
        await peerConversationService.findPeerConversation(
          input.accountId,
          NEX_OFFICIAL_ACCOUNT_ID,
        );
      let messagesCount = 0;
      let convId = existingConv?.id ?? null;
      if (existingConv) {
        const msgs = await peerMessageService.listPeerMessages(
          existingConv.id,
          { limit: 1 },
        );
        messagesCount = msgs.length;
      }

      if (existingConv && messagesCount > 0) {
        steps.push({
          id: "welcome",
          label: "NEX welcome message ready",
          state: "complete",
        });
      } else {
        // Recovery path · the Bridge 62 inline insert at signup may
        // have failed. Ensure the conversation + welcome message
        // exist. Idempotent via Bridge 99 send_intent_id so a
        // concurrent retry (two Building page loads) results in
        // exactly one row.
        if (!convId) {
          const conv =
            await peerConversationService.getOrCreatePeerConversation(
              NEX_OFFICIAL_ACCOUNT_ID,
              input.accountId,
            );
          convId = conv.id;
        }
        try {
          const body = renderNex1WelcomeBody({
            first_name: input.displayName,
          });
          await peerMessageService.sendPeerMessage({
            conversation_id: convId,
            sender_account_id: NEX_OFFICIAL_ACCOUNT_ID,
            body,
            attachment_url: null,
            attachment_type: null,
            attachment_meta: null,
            // Bridge 99 idempotency · (sender_account_id,
            // send_intent_id) UNIQUE. Deterministic key = recipient's
            // account id · a parallel retry hits the sealed
            // uq_nex_peer_message_send_intent index and we treat the
            // duplicate as success.
            send_intent_id: input.accountId,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Partial-duplicate from the sealed Bridge 99 UNIQUE index
          // means another path already inserted the welcome · that's
          // the honest success case for this step.
          if (/uq_nex_peer_message_send_intent/i.test(msg)) {
            // fall through · the welcome exists
          } else {
            throw e;
          }
        }
        steps.push({
          id: "welcome",
          label: "NEX welcome message ready",
          state: "complete",
        });
      }
    }
  } catch {
    steps.push({
      id: "welcome",
      label: "Could not prepare the NEX welcome message",
      state: "error",
      detail: "Delivery failed · retry.",
    });
  }

  const allComplete = steps.every(
    (s) => s.state === "complete" || s.state === "skipped",
  );
  return { steps, allComplete };
}
